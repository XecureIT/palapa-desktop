import * as React from 'react';
import { createPortal } from 'react-dom';
import { ConfirmationDialog } from './ConfirmationDialog';
import { LocalizerType } from '../types/Util';

export type OwnProps = {
  readonly i18n: LocalizerType;
  readonly children: React.ReactNode;
  readonly affirmativeText?: string;
  readonly onAffirmative?: () => unknown;
  readonly onClose: () => unknown;
  readonly negativeText?: string;
  readonly onNegative?: () => unknown;
};

export type Props = OwnProps;

export const ConfirmationModal = React.memo(
  // tslint:disable-next-line max-func-body-length
  ({
    i18n,
    onClose,
    children,
    onAffirmative,
    onNegative,
    affirmativeText,
    negativeText,
  }: Props) => {
    const [root, setRoot] = React.useState<HTMLElement | null>(null);

    React.useEffect(() => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      setRoot(div);

      return () => {
        document.body.removeChild(div);
        setRoot(null);
      };
    }, []);

    React.useEffect(() => {
      const handler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onClose();

          event.preventDefault();
          event.stopPropagation();
        }
      };
      document.addEventListener('keydown', handler);

      return () => {
        document.removeEventListener('keydown', handler);
      };
    }, [onClose]);

    const handleCancel = React.useCallback(
      (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      },
      [onClose]
    );

    return root
      ? createPortal(
          <div
            // Not really a button. Just a background which can be clicked to close modal
            role="button"
            className="module-confirmation-dialog__overlay"
            onClick={handleCancel}
          >
            <ConfirmationDialog
              i18n={i18n}
              onClose={onClose}
              onAffirmative={onAffirmative}
              onNegative={onNegative}
              affirmativeText={affirmativeText}
              negativeText={negativeText}
            >
              {children}
            </ConfirmationDialog>
          </div>,
          root
        )
      : null;
  }
);
