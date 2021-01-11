import React from 'react';
import classNames from 'classnames';

import { Image } from './Image';

import { AttachmentType, isImageAttachment } from '../../types/Attachment';
import { LocalizerType } from '../../types/Util';

interface Props {
  isLoaded: boolean;
  title: string;
  domain: string;
  image?: AttachmentType;

  i18n: LocalizerType;
  onClose?: () => void;
}

export class StagedLinkPreview extends React.Component<Props> {
  public render() {
    const { isLoaded, onClose, i18n, title, image, domain } = this.props;

    const isImage = image && isImageAttachment(image);

    return (
      <div
        className={classNames(
          'module-staged-link-preview',
          !isLoaded ? 'module-staged-link-preview--is-loading' : null
        )}
      >
        {!isLoaded ? (
          <div className="module-staged-link-preview__loading">
            {i18n('loadingPreview')}
          </div>
        ) : null}
        {isLoaded && image && isImage ? (
          <div className="module-staged-link-preview__icon-container">
            <Image
              alt={i18n('stagedPreviewThumbnail', [domain])}
              softCorners={true}
              height={72}
              width={72}
              url={image.url}
              attachment={image}
              i18n={i18n}
            />
          </div>
        ) : null}
        {isLoaded ? (
          <div className="module-staged-link-preview__content">
            <div className="module-staged-link-preview__title">{title}</div>
            <div className="module-staged-link-preview__location">{domain}</div>
          </div>
        ) : null}
        <button
          className="module-staged-link-preview__close-button"
          onClick={onClose}
        />
      </div>
    );
  }
}
