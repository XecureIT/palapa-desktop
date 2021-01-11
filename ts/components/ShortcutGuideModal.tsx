import * as React from 'react';
import { createPortal } from 'react-dom';
import { LocalizerType } from '../types/Util';
import { ShortcutGuide } from './ShortcutGuide';

export type PropsType = {
  hasInstalledStickers: boolean;
  platform: string;
  readonly close: () => unknown;
  readonly i18n: LocalizerType;
};

export const ShortcutGuideModal = React.memo(
  // tslint:disable-next-line max-func-body-length
  (props: PropsType) => {
    const { i18n, close, hasInstalledStickers, platform } = props;
    const [root, setRoot] = React.useState<HTMLElement | null>(null);

    React.useEffect(() => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      setRoot(div);

      return () => {
        document.body.removeChild(div);
      };
    }, []);

    return root
      ? createPortal(
          <div className="module-shortcut-guide-modal">
            <div className="module-shortcut-guide-container">
              <ShortcutGuide
                hasInstalledStickers={hasInstalledStickers}
                platform={platform}
                close={close}
                i18n={i18n}
              />
            </div>
          </div>,
          root
        )
      : null;
  }
);
