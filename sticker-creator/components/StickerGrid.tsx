import * as React from 'react';
import PQueue from 'p-queue';
import {
  SortableContainer,
  SortableElement,
  SortEndHandler,
} from 'react-sortable-hoc';
import * as styles from './StickerGrid.scss';
import { Props as StickerFrameProps, StickerFrame } from './StickerFrame';
import { stickersDuck } from '../store';
import { DropZone, Props as DropZoneProps } from '../elements/DropZone';
import { convertToWebp } from '../util/preload';

const queue = new PQueue({ concurrency: 3 });

const SmartStickerFrame = SortableElement(
  ({ id, showGuide, mode }: StickerFrameProps) => {
    const data = stickersDuck.useStickerData(id);
    const actions = stickersDuck.useStickerActions();
    const image = data.webp ? data.webp.src : undefined;

    return (
      <StickerFrame
        id={id}
        showGuide={showGuide}
        mode={mode}
        image={image}
        onRemove={actions.removeSticker}
        onPickEmoji={actions.setEmoji}
        emojiData={data.emoji}
      />
    );
  }
);

export type Props = Pick<StickerFrameProps, 'showGuide' | 'mode'>;

export type InnerGridProps = Props & {
  ids: Array<string>;
};

const InnerGrid = SortableContainer(
  ({ ids, mode, showGuide }: InnerGridProps) => {
    const containerClassName = ids.length > 0 ? styles.grid : styles.drop;
    const frameMode = mode === 'add' ? 'removable' : 'pick-emoji';

    const actions = stickersDuck.useStickerActions();

    const handleDrop = React.useCallback<DropZoneProps['onDrop']>(
      async paths => {
        actions.initializeStickers(paths);
        paths.forEach(path => {
          // tslint:disable-next-line no-floating-promises
          queue.add(async () => {
            try {
              const webp = await convertToWebp(path);
              actions.addWebp(webp);
            } catch (e) {
              // @ts-ignore
              window.log.error('Error processing image:', e);
              actions.removeSticker(path);
              actions.addToast('StickerCreator--Toasts--errorProcessing');
            }
          });
        });
      },
      [actions]
    );

    return (
      <div className={containerClassName}>
        {ids.length > 0 ? (
          <>
            {ids.map((p, i) => (
              <SmartStickerFrame
                key={p}
                index={i}
                id={p}
                showGuide={showGuide}
                mode={frameMode}
              />
            ))}
            {mode === 'add' && ids.length < stickersDuck.maxStickers ? (
              <StickerFrame
                showGuide={showGuide}
                mode="add"
                onDrop={handleDrop}
              />
            ) : null}
          </>
        ) : (
          <DropZone onDrop={handleDrop} />
        )}
      </div>
    );
  }
);

export const StickerGrid = SortableContainer((props: Props) => {
  const ids = stickersDuck.useStickerOrder();
  const actions = stickersDuck.useStickerActions();
  const handleSortEnd = React.useCallback<SortEndHandler>(
    sortEnd => {
      actions.moveSticker(sortEnd);
    },
    [actions]
  );

  return (
    <InnerGrid
      {...props}
      ids={ids}
      axis="xy"
      onSortEnd={handleSortEnd}
      useDragHandle={true}
    />
  );
});
