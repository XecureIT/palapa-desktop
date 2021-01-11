import * as React from 'react';
import { useDropzone } from 'react-dropzone';
import * as styles from './DropZone.scss';
import { useI18n } from '../util/i18n';

export type Props = {
  readonly inner?: boolean;
  onDrop(files: Array<string>): unknown;
  onDragActive?(active: boolean): unknown;
};

const getClassName = ({ inner }: Props, isDragActive: boolean) => {
  if (inner) {
    return styles.base;
  }

  if (isDragActive) {
    return styles.active;
  }

  return styles.standalone;
};

export const DropZone = (props: Props) => {
  const { inner, onDrop, onDragActive } = props;
  const i18n = useI18n();

  const handleDrop = React.useCallback(
    files => {
      onDrop(files.map(({ path }) => path));
    },
    [onDrop]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: ['image/png', 'image/webp'],
  });

  React.useEffect(() => {
    if (onDragActive) {
      onDragActive(isDragActive);
    }
  }, [isDragActive, onDragActive]);

  return (
    <div {...getRootProps({ className: getClassName(props, isDragActive) })}>
      {/* tslint:disable-next-line */}
      <input {...getInputProps()} />
      <svg viewBox="0 0 36 36" width="36px" height="36px">
        <path d="M32 17.25H18.75V4h-1.5v13.25H4v1.5h13.25V32h1.5V18.75H32v-1.5z" />
      </svg>
      {!inner ? (
        <p className={styles.text}>
          {isDragActive
            ? i18n('StickerCreator--DropZone--staticText')
            : i18n('StickerCreator--DropZone--activeText')}
        </p>
      ) : null}
    </div>
  );
};
