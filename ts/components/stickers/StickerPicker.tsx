/* tslint:disable:max-func-body-length */
/* tslint:disable:cyclomatic-complexity */
import * as React from 'react';
import classNames from 'classnames';
import { useRestoreFocus } from '../hooks';
import { StickerPackType, StickerType } from '../../state/ducks/stickers';
import { LocalizerType } from '../../types/Util';

export type OwnProps = {
  readonly i18n: LocalizerType;
  readonly onClose: () => unknown;
  readonly onClickAddPack: () => unknown;
  readonly onPickSticker: (packId: string, stickerId: number) => unknown;
  readonly packs: ReadonlyArray<StickerPackType>;
  readonly recentStickers: ReadonlyArray<StickerType>;
  readonly showPickerHint?: boolean;
};

export type Props = OwnProps & Pick<React.HTMLProps<HTMLDivElement>, 'style'>;

function useTabs<T>(tabs: ReadonlyArray<T>, initialTab = tabs[0]) {
  const [tab, setTab] = React.useState(initialTab);
  const handlers = React.useMemo(
    () =>
      tabs.map(t => () => {
        setTab(t);
      }),
    tabs
  );

  return [tab, handlers] as [T, ReadonlyArray<() => void>];
}

const PACKS_PAGE_SIZE = 7;
const PACK_ICON_WIDTH = 32;
const PACK_PAGE_WIDTH = PACKS_PAGE_SIZE * PACK_ICON_WIDTH;

function getPacksPageOffset(page: number, packs: number): number {
  if (page === 0) {
    return 0;
  }

  if (isLastPacksPage(page, packs)) {
    return (
      PACK_PAGE_WIDTH * (Math.floor(packs / PACKS_PAGE_SIZE) - 1) +
      ((packs % PACKS_PAGE_SIZE) - 1) * PACK_ICON_WIDTH
    );
  }

  return page * PACK_ICON_WIDTH * PACKS_PAGE_SIZE;
}

function isLastPacksPage(page: number, packs: number): boolean {
  return page === Math.floor(packs / PACKS_PAGE_SIZE);
}

export const StickerPicker = React.memo(
  React.forwardRef<HTMLDivElement, Props>(
    (
      {
        i18n,
        packs,
        recentStickers,
        onClose,
        onClickAddPack,
        onPickSticker,
        showPickerHint,
        style,
      }: Props,
      ref
    ) => {
      const focusRef = React.useRef<HTMLButtonElement>(null);
      const tabIds = React.useMemo(
        () => ['recents', ...packs.map(({ id }) => id)],
        packs
      );
      const [currentTab, [recentsHandler, ...packsHandlers]] = useTabs(
        tabIds,
        // If there are no recent stickers, default to the first sticker pack, unless there are no sticker packs.
        tabIds[recentStickers.length > 0 ? 0 : Math.min(1, tabIds.length)]
      );
      const selectedPack = packs.find(({ id }) => id === currentTab);
      const {
        stickers = recentStickers,
        title: packTitle = 'Recent Stickers',
      } = selectedPack || {};

      const [isUsingKeyboard, setIsUsingKeyboard] = React.useState(false);
      const [packsPage, setPacksPage] = React.useState(0);
      const onClickPrevPackPage = React.useCallback(() => {
        setPacksPage(i => i - 1);
      }, [setPacksPage]);
      const onClickNextPackPage = React.useCallback(() => {
        setPacksPage(i => i + 1);
      }, [setPacksPage]);

      // Handle escape key
      React.useEffect(() => {
        const handler = (event: KeyboardEvent) => {
          if (event.key === 'Tab') {
            // We do NOT prevent default here to allow Tab to be used normally

            setIsUsingKeyboard(true);

            return;
          }

          if (event.key === 'Escape') {
            event.stopPropagation();
            event.preventDefault();

            onClose();

            return;
          }
        };

        document.addEventListener('keydown', handler);

        return () => {
          document.removeEventListener('keydown', handler);
        };
      }, [onClose]);

      // Focus popup on after initial render, restore focus on teardown
      useRestoreFocus(focusRef);

      const isEmpty = stickers.length === 0;
      const addPackRef = isEmpty ? focusRef : undefined;
      const downloadError =
        selectedPack &&
        selectedPack.status === 'error' &&
        selectedPack.stickerCount !== selectedPack.stickers.length;
      const pendingCount =
        selectedPack && selectedPack.status === 'pending'
          ? selectedPack.stickerCount - stickers.length
          : 0;

      const hasPacks = packs.length > 0;
      const isRecents = hasPacks && currentTab === 'recents';
      const showPendingText = pendingCount > 0;
      const showDownlaodErrorText = downloadError;
      const showEmptyText = !downloadError && isEmpty;
      const showText =
        showPendingText || showDownlaodErrorText || showEmptyText;
      const showLongText = showPickerHint;

      return (
        <div className="module-sticker-picker" ref={ref} style={style}>
          <div className="module-sticker-picker__header">
            <div className="module-sticker-picker__header__packs">
              <div
                className="module-sticker-picker__header__packs__slider"
                style={{
                  transform: `translateX(-${getPacksPageOffset(
                    packsPage,
                    packs.length
                  )}px)`,
                }}
              >
                {hasPacks ? (
                  <button
                    onClick={recentsHandler}
                    className={classNames({
                      'module-sticker-picker__header__button': true,
                      'module-sticker-picker__header__button--recents': true,
                      'module-sticker-picker__header__button--selected':
                        currentTab === 'recents',
                    })}
                  />
                ) : null}
                {packs.map((pack, i) => (
                  <button
                    key={pack.id}
                    onClick={packsHandlers[i]}
                    className={classNames(
                      'module-sticker-picker__header__button',
                      {
                        'module-sticker-picker__header__button--selected':
                          currentTab === pack.id,
                        'module-sticker-picker__header__button--error':
                          pack.status === 'error',
                      }
                    )}
                  >
                    {pack.cover ? (
                      <img
                        className="module-sticker-picker__header__button__image"
                        src={pack.cover.url}
                        alt={pack.title}
                        title={pack.title}
                      />
                    ) : (
                      <div className="module-sticker-picker__header__button__image-placeholder" />
                    )}
                  </button>
                ))}
              </div>
              {!isUsingKeyboard && packsPage > 0 ? (
                <button
                  className={classNames(
                    'module-sticker-picker__header__button',
                    'module-sticker-picker__header__button--prev-page'
                  )}
                  onClick={onClickPrevPackPage}
                />
              ) : null}
              {!isUsingKeyboard && !isLastPacksPage(packsPage, packs.length) ? (
                <button
                  className={classNames(
                    'module-sticker-picker__header__button',
                    'module-sticker-picker__header__button--next-page'
                  )}
                  onClick={onClickNextPackPage}
                />
              ) : null}
            </div>
            <button
              ref={addPackRef}
              className={classNames(
                'module-sticker-picker__header__button',
                'module-sticker-picker__header__button--add-pack',
                {
                  'module-sticker-picker__header__button--hint': showPickerHint,
                }
              )}
              onClick={onClickAddPack}
            />
          </div>
          <div
            className={classNames('module-sticker-picker__body', {
              'module-sticker-picker__body--empty': isEmpty,
            })}
          >
            {showPickerHint ? (
              <div
                className={classNames(
                  'module-sticker-picker__body__text',
                  'module-sticker-picker__body__text--hint',
                  {
                    'module-sticker-picker__body__text--pin': showEmptyText,
                  }
                )}
              >
                {i18n('stickers--StickerPicker--Hint')}
              </div>
            ) : null}
            {!hasPacks ? (
              <div className="module-sticker-picker__body__text">
                {i18n('stickers--StickerPicker--NoPacks')}
              </div>
            ) : null}
            {pendingCount > 0 ? (
              <div className="module-sticker-picker__body__text">
                {i18n('stickers--StickerPicker--DownloadPending')}
              </div>
            ) : null}
            {downloadError ? (
              <div
                className={classNames(
                  'module-sticker-picker__body__text',
                  'module-sticker-picker__body__text--error'
                )}
              >
                {stickers.length > 0
                  ? i18n('stickers--StickerPicker--DownloadError')
                  : i18n('stickers--StickerPicker--Empty')}
              </div>
            ) : null}
            {hasPacks && showEmptyText ? (
              <div
                className={classNames('module-sticker-picker__body__text', {
                  'module-sticker-picker__body__text--error': !isRecents,
                })}
              >
                {isRecents
                  ? i18n('stickers--StickerPicker--NoRecents')
                  : i18n('stickers--StickerPicker--Empty')}
              </div>
            ) : null}
            {!isEmpty ? (
              <div
                className={classNames('module-sticker-picker__body__content', {
                  'module-sticker-picker__body__content--under-text': showText,
                  'module-sticker-picker__body__content--under-long-text': showLongText,
                })}
              >
                {stickers.map(({ packId, id, url }, index: number) => {
                  const maybeFocusRef = index === 0 ? focusRef : undefined;

                  return (
                    <button
                      ref={maybeFocusRef}
                      key={`${packId}-${id}`}
                      className="module-sticker-picker__body__cell"
                      onClick={() => onPickSticker(packId, id)}
                    >
                      <img
                        className="module-sticker-picker__body__cell__image"
                        src={url}
                        alt={packTitle}
                      />
                    </button>
                  );
                })}
                {Array(pendingCount)
                  .fill(0)
                  .map((_, i) => (
                    <div
                      key={i}
                      className="module-sticker-picker__body__cell__placeholder"
                      role="presentation"
                    />
                  ))}
              </div>
            ) : null}
          </div>
        </div>
      );
    }
  )
);
