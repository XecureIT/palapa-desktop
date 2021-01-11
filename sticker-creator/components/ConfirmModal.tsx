import * as React from 'react';
import { createPortal } from 'react-dom';
import * as styles from './ConfirmModal.scss';
import { ConfirmDialog, Props } from '../elements/ConfirmDialog';

export type Mode = 'removable' | 'pick-emoji' | 'add';

export const ConfirmModal = React.memo(
  // tslint:disable-next-line max-func-body-length
  (props: Props) => {
    const { onCancel } = props;
    const [popperRoot, setPopperRoot] = React.useState<HTMLDivElement>();

    // Create popper root and handle outside clicks
    React.useEffect(() => {
      const root = document.createElement('div');
      setPopperRoot(root);
      document.body.appendChild(root);
      const handleOutsideClick = ({ target }: MouseEvent) => {
        if (!root.contains(target as Node)) {
          onCancel();
        }
      };
      document.addEventListener('click', handleOutsideClick);

      return () => {
        document.body.removeChild(root);
        document.removeEventListener('click', handleOutsideClick);
      };
    }, [onCancel]);

    return popperRoot
      ? createPortal(
          <div className={styles.facade}>
            <ConfirmDialog {...props} />
          </div>,
          popperRoot
        )
      : null;
  }
);
