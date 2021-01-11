import React from 'react';
import classNames from 'classnames';

import { Emojify } from './Emojify';
import { Avatar } from '../Avatar';
import { LocalizerType } from '../../types/Util';
import {
  ContextMenu,
  ContextMenuTrigger,
  MenuItem,
  SubMenu,
} from 'react-contextmenu';

interface TimerOption {
  name: string;
  value: number;
}

interface Props {
  id: string;
  name?: string;

  phoneNumber: string;
  profileName?: string;
  color: string;
  avatarPath?: string;

  isVerified: boolean;
  isMe: boolean;
  isGroup: boolean;
  isArchived: boolean;

  expirationSettingName?: string;
  showBackButton: boolean;
  timerOptions: Array<TimerOption>;

  onSetDisappearingMessages: (seconds: number) => void;
  onDeleteMessages: () => void;
  onResetSession: () => void;
  onSearchInConversation: () => void;

  onShowSafetyNumber: () => void;
  onShowAllMedia: () => void;
  onShowGroupMembers: () => void;
  onGoBack: () => void;

  onArchive: () => void;
  onMoveToInbox: () => void;

  i18n: LocalizerType;
}

export class ConversationHeader extends React.Component<Props> {
  public showMenuBound: (event: React.MouseEvent<HTMLButtonElement>) => void;
  public menuTriggerRef: React.RefObject<any>;

  public constructor(props: Props) {
    super(props);

    this.menuTriggerRef = React.createRef();
    this.showMenuBound = this.showMenu.bind(this);
  }

  public showMenu(event: React.MouseEvent<HTMLButtonElement>) {
    if (this.menuTriggerRef.current) {
      this.menuTriggerRef.current.handleContextClick(event);
    }
  }

  public renderBackButton() {
    const { onGoBack, showBackButton } = this.props;

    return (
      <button
        onClick={onGoBack}
        className={classNames(
          'module-conversation-header__back-icon',
          showBackButton ? 'module-conversation-header__back-icon--show' : null
        )}
        disabled={!showBackButton}
      />
    );
  }

  public renderTitle() {
    const {
      name,
      phoneNumber,
      i18n,
      isMe,
      profileName,
      isVerified,
    } = this.props;

    if (isMe) {
      return (
        <div className="module-conversation-header__title">
          {i18n('noteToSelf')}
        </div>
      );
    }

    return (
      <div className="module-conversation-header__title">
        {name ? <Emojify text={name} /> : null}
        {name && phoneNumber ? ' · ' : null}
        {phoneNumber ? phoneNumber : null}{' '}
        {profileName && !name ? (
          <span className="module-conversation-header__title__profile-name">
            ~<Emojify text={profileName} />
          </span>
        ) : null}
        {isVerified ? ' · ' : null}
        {isVerified ? (
          <span>
            <span className="module-conversation-header__title__verified-icon" />
            {i18n('verified')}
          </span>
        ) : null}
      </div>
    );
  }

  public renderAvatar() {
    const {
      avatarPath,
      color,
      i18n,
      isGroup,
      isMe,
      name,
      phoneNumber,
      profileName,
    } = this.props;

    const conversationType = isGroup ? 'group' : 'direct';

    return (
      <span className="module-conversation-header__avatar">
        <Avatar
          avatarPath={avatarPath}
          color={color}
          conversationType={conversationType}
          i18n={i18n}
          noteToSelf={isMe}
          name={name}
          phoneNumber={phoneNumber}
          profileName={profileName}
          size={28}
        />
      </span>
    );
  }

  public renderExpirationLength() {
    const { expirationSettingName, showBackButton } = this.props;

    if (!expirationSettingName) {
      return null;
    }

    return (
      <div
        className={classNames(
          'module-conversation-header__expiration',
          showBackButton
            ? 'module-conversation-header__expiration--hidden'
            : null
        )}
      >
        <div className="module-conversation-header__expiration__clock-icon" />
        <div className="module-conversation-header__expiration__setting">
          {expirationSettingName}
        </div>
      </div>
    );
  }

  public renderMoreButton(triggerId: string) {
    const { showBackButton } = this.props;

    return (
      <ContextMenuTrigger id={triggerId} ref={this.menuTriggerRef}>
        <button
          onClick={this.showMenuBound}
          className={classNames(
            'module-conversation-header__more-button',
            showBackButton
              ? null
              : 'module-conversation-header__more-button--show'
          )}
          disabled={showBackButton}
        />
      </ContextMenuTrigger>
    );
  }

  public renderSearchButton() {
    const { onSearchInConversation, showBackButton } = this.props;

    return (
      <button
        onClick={onSearchInConversation}
        className={classNames(
          'module-conversation-header__search-button',
          showBackButton
            ? null
            : 'module-conversation-header__search-button--show'
        )}
        disabled={showBackButton}
      />
    );
  }

  public renderMenu(triggerId: string) {
    const {
      i18n,
      isMe,
      isGroup,
      isArchived,
      onDeleteMessages,
      onResetSession,
      onSetDisappearingMessages,
      onShowAllMedia,
      onShowGroupMembers,
      onShowSafetyNumber,
      onArchive,
      onMoveToInbox,
      timerOptions,
    } = this.props;

    const disappearingTitle = i18n('disappearingMessages') as any;

    return (
      <ContextMenu id={triggerId}>
        <SubMenu title={disappearingTitle}>
          {(timerOptions || []).map(item => (
            <MenuItem
              key={item.value}
              onClick={() => {
                onSetDisappearingMessages(item.value);
              }}
            >
              {item.name}
            </MenuItem>
          ))}
        </SubMenu>
        <MenuItem onClick={onShowAllMedia}>{i18n('viewAllMedia')}</MenuItem>
        {isGroup ? (
          <MenuItem onClick={onShowGroupMembers}>
            {i18n('showMembers')}
          </MenuItem>
        ) : null}
        {!isGroup && !isMe ? (
          <MenuItem onClick={onShowSafetyNumber}>
            {i18n('showSafetyNumber')}
          </MenuItem>
        ) : null}
        {!isGroup ? (
          <MenuItem onClick={onResetSession}>{i18n('resetSession')}</MenuItem>
        ) : null}
        {isArchived ? (
          <MenuItem onClick={onMoveToInbox}>
            {i18n('moveConversationToInbox')}
          </MenuItem>
        ) : (
          <MenuItem onClick={onArchive}>{i18n('archiveConversation')}</MenuItem>
        )}
        <MenuItem onClick={onDeleteMessages}>{i18n('deleteMessages')}</MenuItem>
      </ContextMenu>
    );
  }

  public render() {
    const { id } = this.props;
    const triggerId = `conversation-${id}`;

    return (
      <div className="module-conversation-header">
        {this.renderBackButton()}
        <div className="module-conversation-header__title-container">
          <div className="module-conversation-header__title-flex">
            {this.renderAvatar()}
            {this.renderTitle()}
          </div>
        </div>
        {this.renderExpirationLength()}
        {this.renderSearchButton()}
        {this.renderMoreButton(triggerId)}
        {this.renderMenu(triggerId)}
      </div>
    );
  }
}
