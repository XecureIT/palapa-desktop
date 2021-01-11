import * as React from 'react';
import * as styles from './MessageSticker.scss';
import { MessageMeta, Props as MessageMetaProps } from './MessageMeta';

export type Props = MessageMetaProps & {
  image: string;
};

export const MessageSticker = ({ image, kind, minutesAgo }: Props) => {
  return (
    <div className={styles.base}>
      <img src={image} alt="Sticker" className={styles.image} />
      <MessageMeta kind={kind} minutesAgo={minutesAgo} />
    </div>
  );
};
