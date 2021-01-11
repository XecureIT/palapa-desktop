import React from 'react';
import classNames from 'classnames';
import moment from 'moment';

import { formatRelativeTime } from '../../util/formatRelativeTime';

import { LocalizerType } from '../../types/Util';

interface Props {
  timestamp?: number;
  extended?: boolean;
  module?: string;
  withImageNoCaption?: boolean;
  withSticker?: boolean;
  withTapToViewExpired?: boolean;
  withUnread?: boolean;
  direction?: 'incoming' | 'outgoing';
  i18n: LocalizerType;
}

const UPDATE_FREQUENCY = 60 * 1000;

export class Timestamp extends React.Component<Props> {
  private interval: any;

  constructor(props: Props) {
    super(props);

    this.interval = null;
  }

  public componentDidMount() {
    const update = () => {
      this.setState({
        lastUpdated: Date.now(),
      });
    };
    this.interval = setInterval(update, UPDATE_FREQUENCY);
  }

  public componentWillUnmount() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  public render() {
    const {
      direction,
      i18n,
      module,
      timestamp,
      withImageNoCaption,
      withSticker,
      withTapToViewExpired,
      withUnread,
      extended,
    } = this.props;
    const moduleName = module || 'module-timestamp';

    if (timestamp === null || timestamp === undefined) {
      return null;
    }

    return (
      <span
        className={classNames(
          moduleName,
          direction ? `${moduleName}--${direction}` : null,
          withTapToViewExpired && direction
            ? `${moduleName}--${direction}-with-tap-to-view-expired`
            : null,
          withImageNoCaption ? `${moduleName}--with-image-no-caption` : null,
          withSticker ? `${moduleName}--with-sticker` : null,
          withUnread ? `${moduleName}--with-unread` : null
        )}
        title={moment(timestamp).format('llll')}
      >
        {formatRelativeTime(timestamp, { i18n, extended })}
      </span>
    );
  }
}
