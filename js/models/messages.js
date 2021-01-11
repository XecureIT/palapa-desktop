/* global
  _,
  Backbone,
  storage,
  filesize,
  ConversationController,
  MessageController,
  getAccountManager,
  i18n,
  Signal,
  textsecure,
  Whisper
*/

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  const { Message: TypedMessage, Contact, PhoneNumber, Errors } = Signal.Types;
  const {
    deleteExternalMessageFiles,
    getAbsoluteAttachmentPath,
    loadAttachmentData,
    loadQuoteData,
    loadPreviewData,
    loadStickerData,
    upgradeMessageSchema,
  } = window.Signal.Migrations;
  const {
    copyStickerToAttachments,
    deletePackReference,
    savePackMetadata,
    getStickerPackStatus,
  } = window.Signal.Stickers;
  const { GoogleChrome } = window.Signal.Util;

  const { addStickerPackReference, getMessageBySender } = window.Signal.Data;
  const { bytesFromString } = window.Signal.Crypto;

  window.AccountCache = Object.create(null);
  window.AccountJobs = Object.create(null);

  window.doesAccountCheckJobExist = number =>
    Boolean(window.AccountJobs[number]);
  window.checkForSignalAccount = number => {
    if (window.AccountJobs[number]) {
      return window.AccountJobs[number];
    }

    let job;
    if (textsecure.messaging) {
      // eslint-disable-next-line more/no-then
      job = textsecure.messaging
        .getProfile(number)
        .then(() => {
          window.AccountCache[number] = true;
        })
        .catch(() => {
          window.AccountCache[number] = false;
        });
    } else {
      // We're offline!
      job = Promise.resolve().then(() => {
        window.AccountCache[number] = false;
      });
    }

    window.AccountJobs[number] = job;

    return job;
  };

  window.isSignalAccountCheckComplete = number =>
    window.AccountCache[number] !== undefined;
  window.hasSignalAccount = number => window.AccountCache[number];

  window.Whisper.Message = Backbone.Model.extend({
    initialize(attributes) {
      if (_.isObject(attributes)) {
        this.set(
          TypedMessage.initializeSchemaVersion({
            message: attributes,
            logger: window.log,
          })
        );
      }

      this.CURRENT_PROTOCOL_VERSION =
        textsecure.protobuf.DataMessage.ProtocolVersion.CURRENT;
      this.INITIAL_PROTOCOL_VERSION =
        textsecure.protobuf.DataMessage.ProtocolVersion.INITIAL;
      this.OUR_NUMBER = textsecure.storage.user.getNumber();

      this.on('destroy', this.onDestroy);
      this.on('change:expirationStartTimestamp', this.setToExpire);
      this.on('change:expireTimer', this.setToExpire);
      this.on('unload', this.unload);
      this.on('expired', this.onExpired);
      this.setToExpire();

      this.on('change', this.notifyRedux);
    },

    notifyRedux() {
      const { messageChanged } = window.reduxActions.conversations;

      if (messageChanged) {
        const conversationId = this.get('conversationId');
        // Note: The clone is important for triggering a re-run of selectors
        messageChanged(this.id, conversationId, this.getReduxData());
      }
    },

    getReduxData() {
      const contact = this.getPropsForEmbeddedContact();

      return {
        ...this.attributes,
        // We need this in the reducer to detect if the message's height has changed
        hasSignalAccount: contact ? Boolean(contact.signalAccount) : null,
      };
    },

    isNormalBubble() {
      return (
        !this.isUnsupportedMessage() &&
        !this.isExpirationTimerUpdate() &&
        !this.isKeyChange() &&
        !this.isVerifiedChange() &&
        !this.isGroupUpdate() &&
        !this.isEndSession()
      );
    },

    // Top-level prop generation for the message bubble
    getPropsForBubble() {
      if (this.isUnsupportedMessage()) {
        return {
          type: 'unsupportedMessage',
          data: this.getPropsForUnsupportedMessage(),
        };
      } else if (this.isExpirationTimerUpdate()) {
        return {
          type: 'timerNotification',
          data: this.getPropsForTimerNotification(),
        };
      } else if (this.isKeyChange()) {
        return {
          type: 'safetyNumberNotification',
          data: this.getPropsForSafetyNumberNotification(),
        };
      } else if (this.isVerifiedChange()) {
        return {
          type: 'verificationNotification',
          data: this.getPropsForVerificationNotification(),
        };
      } else if (this.isGroupUpdate()) {
        return {
          type: 'groupNotification',
          data: this.getPropsForGroupNotification(),
        };
      } else if (this.isEndSession()) {
        return {
          type: 'resetSessionNotification',
          data: this.getPropsForResetSessionNotification(),
        };
      }

      return {
        type: 'message',
        data: this.getPropsForMessage(),
      };
    },

    // Other top-level prop-generation
    getPropsForSearchResult() {
      const fromNumber = this.getSource();
      const from = this.findAndFormatContact(fromNumber);
      if (fromNumber === this.OUR_NUMBER) {
        from.isMe = true;
      }

      const toNumber = this.get('conversationId');
      let to = this.findAndFormatContact(toNumber);
      if (toNumber === this.OUR_NUMBER) {
        to.isMe = true;
      } else if (fromNumber === toNumber) {
        to = {
          isMe: true,
        };
      }

      return {
        from,
        to,

        isSelected: this.isSelected,

        id: this.id,
        conversationId: this.get('conversationId'),
        sentAt: this.get('sent_at'),
        snippet: this.get('snippet'),
      };
    },
    getPropsForMessageDetail() {
      const newIdentity = i18n('newIdentity');
      const OUTGOING_KEY_ERROR = 'OutgoingIdentityKeyError';

      const unidentifiedLookup = (
        this.get('unidentifiedDeliveries') || []
      ).reduce((accumulator, item) => {
        // eslint-disable-next-line no-param-reassign
        accumulator[item] = true;
        return accumulator;
      }, Object.create(null));

      // We include numbers we didn't successfully send to so we can display errors.
      // Older messages don't have the recipients included on the message, so we fall
      //   back to the conversation's current recipients
      const phoneNumbers = this.isIncoming()
        ? [this.get('source')]
        : _.union(
            this.get('sent_to') || [],
            this.get('recipients') || this.getConversation().getRecipients()
          );

      // This will make the error message for outgoing key errors a bit nicer
      const allErrors = (this.get('errors') || []).map(error => {
        if (error.name === OUTGOING_KEY_ERROR) {
          // eslint-disable-next-line no-param-reassign
          error.message = newIdentity;
        }

        return error;
      });

      // If an error has a specific number it's associated with, we'll show it next to
      //   that contact. Otherwise, it will be a standalone entry.
      const errors = _.reject(allErrors, error => Boolean(error.number));
      const errorsGroupedById = _.groupBy(allErrors, 'number');
      const finalContacts = (phoneNumbers || []).map(id => {
        const errorsForContact = errorsGroupedById[id];
        const isOutgoingKeyError = Boolean(
          _.find(errorsForContact, error => error.name === OUTGOING_KEY_ERROR)
        );
        const isUnidentifiedDelivery =
          storage.get('unidentifiedDeliveryIndicators') &&
          this.isUnidentifiedDelivery(id, unidentifiedLookup);

        return {
          ...this.findAndFormatContact(id),

          status: this.getStatus(id),
          errors: errorsForContact,
          isOutgoingKeyError,
          isUnidentifiedDelivery,
          onSendAnyway: () =>
            this.trigger('force-send', { contactId: id, messageId: this.id }),
          onShowSafetyNumber: () => this.trigger('show-identity', id),
        };
      });

      // The prefix created here ensures that contacts with errors are listed
      //   first; otherwise it's alphabetical
      const sortedContacts = _.sortBy(
        finalContacts,
        contact => `${contact.errors ? '0' : '1'}${contact.title}`
      );

      return {
        sentAt: this.get('sent_at'),
        receivedAt: this.get('received_at'),
        message: {
          ...this.getPropsForMessage(),
          disableMenu: true,
          disableScroll: true,
          // To ensure that group avatar doesn't show up
          conversationType: 'direct',
          downloadNewVersion: () => {
            this.trigger('download-new-version');
          },
          deleteMessage: messageId => {
            this.trigger('delete', messageId);
          },
          showVisualAttachment: options => {
            this.trigger('show-visual-attachment', options);
          },
          displayTapToViewMessage: messageId => {
            this.trigger('display-tap-to-view-message', messageId);
          },
          openLink: url => {
            this.trigger('navigate-to', url);
          },
          reactWith: emoji => {
            this.trigger('react-with', emoji);
          },
        },
        errors,
        contacts: sortedContacts,
      };
    },

    // Bucketing messages
    isUnsupportedMessage() {
      const versionAtReceive = this.get('supportedVersionAtReceive');
      const requiredVersion = this.get('requiredProtocolVersion');

      return (
        _.isNumber(versionAtReceive) &&
        _.isNumber(requiredVersion) &&
        versionAtReceive < requiredVersion
      );
    },
    isExpirationTimerUpdate() {
      const flag =
        textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE;
      // eslint-disable-next-line no-bitwise
      return Boolean(this.get('flags') & flag);
    },
    isKeyChange() {
      return this.get('type') === 'keychange';
    },
    isVerifiedChange() {
      return this.get('type') === 'verified-change';
    },
    isGroupUpdate() {
      return !!this.get('group_update');
    },
    isEndSession() {
      const flag = textsecure.protobuf.DataMessage.Flags.END_SESSION;
      // eslint-disable-next-line no-bitwise
      return !!(this.get('flags') & flag);
    },

    // Props for each message type
    getPropsForUnsupportedMessage() {
      const requiredVersion = this.get('requiredProtocolVersion');
      const canProcessNow = this.CURRENT_PROTOCOL_VERSION >= requiredVersion;
      const phoneNumber = this.getSource();

      return {
        canProcessNow,
        contact: this.findAndFormatContact(phoneNumber),
      };
    },
    getPropsForTimerNotification() {
      const timerUpdate = this.get('expirationTimerUpdate');
      if (!timerUpdate) {
        return null;
      }

      const { expireTimer, fromSync, source } = timerUpdate;
      const timespan = Whisper.ExpirationTimerOptions.getName(expireTimer || 0);
      const disabled = !expireTimer;

      const basicProps = {
        ...this.findAndFormatContact(source),
        type: 'fromOther',
        timespan,
        disabled,
      };

      if (fromSync) {
        return {
          ...basicProps,
          type: 'fromSync',
        };
      } else if (source === this.OUR_NUMBER) {
        return {
          ...basicProps,
          type: 'fromMe',
        };
      }

      return basicProps;
    },
    getPropsForSafetyNumberNotification() {
      const conversation = this.getConversation();
      const isGroup = conversation && !conversation.isPrivate();
      const phoneNumber = this.get('key_changed');

      return {
        isGroup,
        contact: this.findAndFormatContact(phoneNumber),
      };
    },
    getPropsForVerificationNotification() {
      const type = this.get('verified') ? 'markVerified' : 'markNotVerified';
      const isLocal = this.get('local');
      const phoneNumber = this.get('verifiedChanged');

      return {
        type,
        isLocal,
        contact: this.findAndFormatContact(phoneNumber),
      };
    },
    getPropsForGroupNotification() {
      const groupUpdate = this.get('group_update');
      const changes = [];

      if (!groupUpdate.name && !groupUpdate.left && !groupUpdate.joined) {
        changes.push({
          type: 'general',
        });
      }

      if (groupUpdate.joined) {
        changes.push({
          type: 'add',
          contacts: _.map(
            Array.isArray(groupUpdate.joined)
              ? groupUpdate.joined
              : [groupUpdate.joined],
            phoneNumber => this.findAndFormatContact(phoneNumber)
          ),
        });
      }

      if (groupUpdate.left === 'You') {
        changes.push({
          type: 'remove',
          isMe: true,
        });
      } else if (groupUpdate.left) {
        changes.push({
          type: 'remove',
          contacts: _.map(
            Array.isArray(groupUpdate.left)
              ? groupUpdate.left
              : [groupUpdate.left],
            phoneNumber => this.findAndFormatContact(phoneNumber)
          ),
        });
      }

      if (groupUpdate.name) {
        changes.push({
          type: 'name',
          newName: groupUpdate.name,
        });
      }

      return {
        changes,
      };
    },
    getPropsForResetSessionNotification() {
      // It doesn't need anything right now!
      return {};
    },
    getAttachmentsForMessage() {
      const sticker = this.get('sticker');
      if (sticker && sticker.data) {
        const { data } = sticker;

        // We don't show anything if we're still loading a sticker
        if (data.pending || !data.path) {
          return [];
        }

        return [
          {
            ...data,
            url: getAbsoluteAttachmentPath(data.path),
          },
        ];
      }

      const attachments = this.get('attachments') || [];
      return attachments
        .filter(attachment => !attachment.error)
        .map(attachment => this.getPropsForAttachment(attachment));
    },
    getPropsForMessage() {
      const phoneNumber = this.getSource();
      const contact = this.findAndFormatContact(phoneNumber);
      const contactModel = this.findContact(phoneNumber);

      const authorColor = contactModel ? contactModel.getColor() : null;
      const authorAvatarPath = contactModel
        ? contactModel.getAvatarPath()
        : null;

      const expirationLength = this.get('expireTimer') * 1000;
      const expireTimerStart = this.get('expirationStartTimestamp');
      const expirationTimestamp =
        expirationLength && expireTimerStart
          ? expireTimerStart + expirationLength
          : null;

      const conversation = this.getConversation();
      const isGroup = conversation && !conversation.isPrivate();
      const sticker = this.get('sticker');

      const isTapToView = this.isTapToView();

      const reactions = (this.get('reactions') || []).map(re => {
        const c = this.findAndFormatContact(re.fromId);

        if (!c) {
          return {
            emoji: re.emoji,
            from: {
              id: re.fromId,
            },
          };
        }

        return {
          emoji: re.emoji,
          timestamp: re.timestamp,
          from: c,
        };
      });

      const selectedReaction = (
        (this.get('reactions') || []).find(
          re => re.fromId === this.OUR_NUMBER
        ) || {}
      ).emoji;

      return {
        text: this.createNonBreakingLastSeparator(this.get('body')),
        textPending: this.get('bodyPending'),
        id: this.id,
        conversationId: this.get('conversationId'),
        isSticker: Boolean(sticker),
        direction: this.isIncoming() ? 'incoming' : 'outgoing',
        timestamp: this.get('sent_at'),
        status: this.getMessagePropStatus(),
        contact: this.getPropsForEmbeddedContact(),
        canReply: this.canReply(),
        authorColor,
        authorName: contact.name,
        authorProfileName: contact.profileName,
        authorPhoneNumber: contact.phoneNumber,
        conversationType: isGroup ? 'group' : 'direct',
        attachments: this.getAttachmentsForMessage(),
        previews: this.getPropsForPreview(),
        quote: this.getPropsForQuote(),
        authorAvatarPath,
        isExpired: this.hasExpired,
        expirationLength,
        expirationTimestamp,
        reactions,
        selectedReaction,

        isTapToView,
        isTapToViewExpired: isTapToView && this.get('isErased'),
        isTapToViewError:
          isTapToView && this.isIncoming() && this.get('isTapToViewInvalid'),
      };
    },

    // Dependencies of prop-generation functions
    findAndFormatContact(phoneNumber) {
      const contactModel = this.findContact(phoneNumber);
      if (contactModel) {
        return contactModel.format();
      }

      const { format } = PhoneNumber;
      const regionCode = storage.get('regionCode');
      return {
        phoneNumber: format(phoneNumber, {
          ourRegionCode: regionCode,
        }),
      };
    },
    findContact(phoneNumber) {
      return ConversationController.get(phoneNumber);
    },
    getConversation() {
      // This needs to be an unsafe call, because this method is called during
      //   initial module setup. We may be in the middle of the initial fetch to
      //   the database.
      return ConversationController.getUnsafe(this.get('conversationId'));
    },
    createNonBreakingLastSeparator(text) {
      if (!text) {
        return null;
      }

      const nbsp = '\xa0';
      const regex = /(\S)( +)(\S+\s*)$/;
      return text.replace(regex, (match, start, spaces, end) => {
        const newSpaces =
          end.length < 12
            ? _.reduce(spaces, accumulator => accumulator + nbsp, '')
            : spaces;
        return `${start}${newSpaces}${end}`;
      });
    },
    isIncoming() {
      return this.get('type') === 'incoming';
    },
    getMessagePropStatus() {
      if (this.hasErrors()) {
        return 'error';
      }
      if (!this.isOutgoing()) {
        return null;
      }

      const readBy = this.get('read_by') || [];
      if (storage.get('read-receipt-setting') && readBy.length > 0) {
        return 'read';
      }
      const delivered = this.get('delivered');
      const deliveredTo = this.get('delivered_to') || [];
      if (delivered || deliveredTo.length > 0) {
        return 'delivered';
      }
      const sent = this.get('sent');
      const sentTo = this.get('sent_to') || [];
      if (sent || sentTo.length > 0) {
        return 'sent';
      }

      return 'sending';
    },
    getPropsForEmbeddedContact() {
      const contacts = this.get('contact');
      if (!contacts || !contacts.length) {
        return null;
      }

      const regionCode = storage.get('regionCode');
      const { contactSelector } = Contact;
      const contact = contacts[0];
      const firstNumber =
        contact.number && contact.number[0] && contact.number[0].value;

      // Would be nice to do this before render, on initial load of message
      if (!window.isSignalAccountCheckComplete(firstNumber)) {
        window.checkForSignalAccount(firstNumber).then(() => {
          this.trigger('change', this);
        });
      }

      return contactSelector(contact, {
        regionCode,
        getAbsoluteAttachmentPath,
        signalAccount: window.hasSignalAccount(firstNumber)
          ? firstNumber
          : null,
      });
    },
    getPropsForAttachment(attachment) {
      if (!attachment) {
        return null;
      }

      const { path, pending, flags, size, screenshot, thumbnail } = attachment;

      return {
        ...attachment,
        fileSize: size ? filesize(size) : null,
        isVoiceMessage:
          flags &&
          // eslint-disable-next-line no-bitwise
          flags & textsecure.protobuf.AttachmentPointer.Flags.VOICE_MESSAGE,
        pending,
        url: path ? getAbsoluteAttachmentPath(path) : null,
        screenshot: screenshot
          ? {
              ...screenshot,
              url: getAbsoluteAttachmentPath(screenshot.path),
            }
          : null,
        thumbnail: thumbnail
          ? {
              ...thumbnail,
              url: getAbsoluteAttachmentPath(thumbnail.path),
            }
          : null,
      };
    },
    getPropsForPreview() {
      const previews = this.get('preview') || [];

      return previews.map(preview => ({
        ...preview,
        isStickerPack: window.Signal.LinkPreviews.isStickerPack(preview.url),
        domain: window.Signal.LinkPreviews.getDomain(preview.url),
        image: preview.image ? this.getPropsForAttachment(preview.image) : null,
      }));
    },
    getPropsForQuote() {
      const quote = this.get('quote');
      if (!quote) {
        return null;
      }

      const { format } = PhoneNumber;
      const regionCode = storage.get('regionCode');

      const { author, id: sentAt, referencedMessageNotFound } = quote;
      const contact = author && ConversationController.get(author);
      const authorColor = contact ? contact.getColor() : 'grey';

      const authorPhoneNumber = format(author, {
        ourRegionCode: regionCode,
      });
      const authorProfileName = contact ? contact.getProfileName() : null;
      const authorName = contact ? contact.getName() : null;
      const isFromMe = contact ? contact.id === this.OUR_NUMBER : false;
      const firstAttachment = quote.attachments && quote.attachments[0];

      return {
        text: this.createNonBreakingLastSeparator(quote.text),
        attachment: firstAttachment
          ? this.processQuoteAttachment(firstAttachment)
          : null,
        isFromMe,
        sentAt,
        authorId: author,
        authorPhoneNumber,
        authorProfileName,
        authorName,
        authorColor,
        referencedMessageNotFound,
        onClick: () => this.trigger('scroll-to-message'),
      };
    },
    getStatus(number) {
      const readBy = this.get('read_by') || [];
      if (readBy.indexOf(number) >= 0) {
        return 'read';
      }
      const deliveredTo = this.get('delivered_to') || [];
      if (deliveredTo.indexOf(number) >= 0) {
        return 'delivered';
      }
      const sentTo = this.get('sent_to') || [];
      if (sentTo.indexOf(number) >= 0) {
        return 'sent';
      }

      return null;
    },
    processQuoteAttachment(attachment) {
      const { thumbnail } = attachment;
      const path =
        thumbnail &&
        thumbnail.path &&
        getAbsoluteAttachmentPath(thumbnail.path);
      const objectUrl = thumbnail && thumbnail.objectUrl;

      const thumbnailWithObjectUrl =
        !path && !objectUrl
          ? null
          : Object.assign({}, attachment.thumbnail || {}, {
              objectUrl: path || objectUrl,
            });

      return Object.assign({}, attachment, {
        isVoiceMessage: Signal.Types.Attachment.isVoiceMessage(attachment),
        thumbnail: thumbnailWithObjectUrl,
      });
    },

    // More display logic
    getDescription() {
      if (this.isUnsupportedMessage()) {
        return i18n('message--getDescription--unsupported-message');
      }
      if (this.isTapToView()) {
        if (this.isErased()) {
          return i18n('message--getDescription--disappearing-media');
        }

        const attachments = this.get('attachments');
        if (!attachments || !attachments[0]) {
          return i18n('mediaMessage');
        }

        const { contentType } = attachments[0];
        if (GoogleChrome.isImageTypeSupported(contentType)) {
          return i18n('message--getDescription--disappearing-photo');
        } else if (GoogleChrome.isVideoTypeSupported(contentType)) {
          return i18n('message--getDescription--disappearing-video');
        }

        return i18n('mediaMessage');
      }
      if (this.isGroupUpdate()) {
        const groupUpdate = this.get('group_update');
        if (groupUpdate.left === 'You') {
          return i18n('youLeftTheGroup');
        } else if (groupUpdate.left) {
          return i18n('leftTheGroup', this.getNameForNumber(groupUpdate.left));
        }

        const messages = [];
        if (!groupUpdate.name && !groupUpdate.joined) {
          messages.push(i18n('updatedTheGroup'));
        }
        if (groupUpdate.name) {
          messages.push(i18n('titleIsNow', groupUpdate.name));
        }
        if (groupUpdate.joined && groupUpdate.joined.length) {
          const names = _.map(
            groupUpdate.joined,
            this.getNameForNumber.bind(this)
          );
          if (names.length > 1) {
            messages.push(i18n('multipleJoinedTheGroup', names.join(', ')));
          } else {
            messages.push(i18n('joinedTheGroup', names[0]));
          }
        }

        return messages.join(', ');
      }
      if (this.isEndSession()) {
        return i18n('sessionEnded');
      }
      if (this.isIncoming() && this.hasErrors()) {
        return i18n('incomingError');
      }
      return this.get('body');
    },
    getNotificationText() {
      const description = this.getDescription();
      if (description) {
        return description;
      }
      if (this.get('attachments').length > 0) {
        return i18n('mediaMessage');
      }
      if (this.get('sticker')) {
        return i18n('message--getNotificationText--stickers');
      }
      if (this.isExpirationTimerUpdate()) {
        const { expireTimer } = this.get('expirationTimerUpdate');
        if (!expireTimer) {
          return i18n('disappearingMessagesDisabled');
        }

        return i18n(
          'timerSetTo',
          Whisper.ExpirationTimerOptions.getAbbreviated(expireTimer || 0)
        );
      }
      if (this.isKeyChange()) {
        const phoneNumber = this.get('key_changed');
        const conversation = this.findContact(phoneNumber);
        return i18n(
          'safetyNumberChangedGroup',
          conversation ? conversation.getTitle() : null
        );
      }
      const contacts = this.get('contact');
      if (contacts && contacts.length) {
        return Contact.getName(contacts[0]);
      }

      return '';
    },

    // General
    idForLogging() {
      return `${this.get('source')}.${this.get('sourceDevice')} ${this.get(
        'sent_at'
      )}`;
    },
    defaults() {
      return {
        timestamp: new Date().getTime(),
        attachments: [],
      };
    },
    validate(attributes) {
      const required = ['conversationId', 'received_at', 'sent_at'];
      const missing = _.filter(required, attr => !attributes[attr]);
      if (missing.length) {
        window.log.warn(`Message missing attributes: ${missing}`);
      }
    },
    isUnread() {
      return !!this.get('unread');
    },
    merge(model) {
      const attributes = model.attributes || model;
      this.set(attributes);
    },
    getNameForNumber(number) {
      const conversation = ConversationController.get(number);
      if (!conversation) {
        return number;
      }
      return conversation.getDisplayName();
    },
    onDestroy() {
      this.cleanup();
    },
    async cleanup() {
      const { messageDeleted } = window.reduxActions.conversations;
      messageDeleted(this.id, this.get('conversationId'));
      MessageController.unregister(this.id);
      this.unload();
      await this.deleteData();
    },
    async deleteData() {
      await deleteExternalMessageFiles(this.attributes);

      const sticker = this.get('sticker');
      if (!sticker) {
        return;
      }

      const { packId } = sticker;
      if (packId) {
        await deletePackReference(this.id, packId);
      }
    },
    isTapToView() {
      return Boolean(this.get('isViewOnce') || this.get('messageTimer'));
    },
    isValidTapToView() {
      const body = this.get('body');
      if (body) {
        return false;
      }

      const attachments = this.get('attachments');
      if (!attachments || attachments.length !== 1) {
        return false;
      }

      const firstAttachment = attachments[0];
      if (
        !GoogleChrome.isImageTypeSupported(firstAttachment.contentType) &&
        !GoogleChrome.isVideoTypeSupported(firstAttachment.contentType)
      ) {
        return false;
      }

      const quote = this.get('quote');
      const sticker = this.get('sticker');
      const contact = this.get('contact');
      const preview = this.get('preview');

      if (
        quote ||
        sticker ||
        (contact && contact.length > 0) ||
        (preview && preview.length > 0)
      ) {
        return false;
      }

      return true;
    },
    async markViewed(options) {
      const { fromSync } = options || {};

      if (!this.isValidTapToView()) {
        window.log.warn(
          `markViewed: Message ${this.idForLogging()} is not a valid tap to view message!`
        );
        return;
      }
      if (this.isErased()) {
        window.log.warn(
          `markViewed: Message ${this.idForLogging()} is already erased!`
        );
        return;
      }

      if (this.get('unread')) {
        await this.markRead();
      }

      await this.eraseContents();

      if (!fromSync) {
        const sender = this.getSource();
        const timestamp = this.get('sent_at');
        const ourNumber = textsecure.storage.user.getNumber();
        const { wrap, sendOptions } = ConversationController.prepareForSend(
          ourNumber,
          {
            syncMessage: true,
          }
        );

        await wrap(
          textsecure.messaging.syncViewOnceOpen(sender, timestamp, sendOptions)
        );
      }
    },
    isErased() {
      return Boolean(this.get('isErased'));
    },
    async eraseContents() {
      if (this.get('isErased')) {
        return;
      }

      window.log.info(`Erasing data for message ${this.idForLogging()}`);

      try {
        await this.deleteData();
      } catch (error) {
        window.log.error(
          `Error erasing data for message ${this.idForLogging()}:`,
          error && error.stack ? error.stack : error
        );
      }

      this.set({
        isErased: true,
        body: '',
        attachments: [],
        quote: null,
        contact: [],
        sticker: null,
        preview: [],
      });
      this.trigger('content-changed');

      await window.Signal.Data.saveMessage(this.attributes, {
        Message: Whisper.Message,
      });
    },
    unload() {
      if (this.quotedMessage) {
        this.quotedMessage = null;
      }
    },
    onExpired() {
      this.hasExpired = true;
    },
    isUnidentifiedDelivery(contactId, lookup) {
      if (this.isIncoming()) {
        return this.get('unidentifiedDeliveryReceived');
      }

      return Boolean(lookup[contactId]);
    },
    getSource() {
      if (this.isIncoming()) {
        return this.get('source');
      }

      return this.OUR_NUMBER;
    },
    getContact() {
      const source = this.getSource();

      if (!source) {
        return null;
      }

      return ConversationController.getOrCreate(source, 'private');
    },
    isOutgoing() {
      return this.get('type') === 'outgoing';
    },
    hasErrors() {
      return _.size(this.get('errors')) > 0;
    },
    async saveErrors(providedErrors, options = {}) {
      const { skipSave } = options;

      let errors = providedErrors;

      if (!(errors instanceof Array)) {
        errors = [errors];
      }
      errors.forEach(e => {
        window.log.error(
          'Message.saveErrors:',
          e && e.reason ? e.reason : null,
          e && e.stack ? e.stack : e
        );
      });
      errors = errors.map(e => {
        if (
          e.constructor === Error ||
          e.constructor === TypeError ||
          e.constructor === ReferenceError
        ) {
          return _.pick(e, 'name', 'message', 'code', 'number', 'reason');
        }
        return e;
      });
      errors = errors.concat(this.get('errors') || []);

      this.set({ errors });

      if (!skipSave) {
        await window.Signal.Data.saveMessage(this.attributes, {
          Message: Whisper.Message,
        });
      }
    },
    async markRead(readAt, options = {}) {
      const { skipSave } = options;

      this.unset('unread');

      if (this.get('expireTimer') && !this.get('expirationStartTimestamp')) {
        const expirationStartTimestamp = Math.min(
          Date.now(),
          readAt || Date.now()
        );
        this.set({ expirationStartTimestamp });
      }

      Whisper.Notifications.remove(
        Whisper.Notifications.where({
          messageId: this.id,
        })
      );

      if (!skipSave) {
        await window.Signal.Data.saveMessage(this.attributes, {
          Message: Whisper.Message,
        });
      }
    },
    isExpiring() {
      return this.get('expireTimer') && this.get('expirationStartTimestamp');
    },
    isExpired() {
      return this.msTilExpire() <= 0;
    },
    msTilExpire() {
      if (!this.isExpiring()) {
        return Infinity;
      }
      const now = Date.now();
      const start = this.get('expirationStartTimestamp');
      const delta = this.get('expireTimer') * 1000;
      let msFromNow = start + delta - now;
      if (msFromNow < 0) {
        msFromNow = 0;
      }
      return msFromNow;
    },
    async setToExpire(force = false, options) {
      const { skipSave } = options || {};

      if (this.isExpiring() && (force || !this.get('expires_at'))) {
        const start = this.get('expirationStartTimestamp');
        const delta = this.get('expireTimer') * 1000;
        const expiresAt = start + delta;

        this.set({ expires_at: expiresAt });
        const id = this.get('id');
        if (id && !skipSave) {
          await window.Signal.Data.saveMessage(this.attributes, {
            Message: Whisper.Message,
          });
        }

        window.log.info('Set message expiration', {
          expiresAt,
          sentAt: this.get('sent_at'),
        });
      }
    },
    getIncomingContact() {
      if (!this.isIncoming()) {
        return null;
      }
      const source = this.get('source');
      if (!source) {
        return null;
      }

      return ConversationController.getOrCreate(source, 'private');
    },
    getQuoteContact() {
      const quote = this.get('quote');
      if (!quote) {
        return null;
      }
      const { author } = quote;
      if (!author) {
        return null;
      }

      return ConversationController.get(author);
    },

    // Send infrastructure
    // One caller today: event handler for the 'Retry Send' entry in triple-dot menu
    async retrySend() {
      if (!textsecure.messaging) {
        window.log.error('retrySend: Cannot retry since we are offline!');
        return null;
      }

      this.set({ errors: null });

      const conversation = this.getConversation();
      const intendedRecipients = this.get('recipients') || [];
      const successfulRecipients = this.get('sent_to') || [];
      const currentRecipients = conversation.getRecipients();

      const profileKey = conversation.get('profileSharing')
        ? storage.get('profileKey')
        : null;

      let recipients = _.intersection(intendedRecipients, currentRecipients);
      recipients = _.without(recipients, successfulRecipients);

      if (!recipients.length) {
        window.log.warn('retrySend: Nobody to send to!');

        return window.Signal.Data.saveMessage(this.attributes, {
          Message: Whisper.Message,
        });
      }

      const attachmentsWithData = await Promise.all(
        (this.get('attachments') || []).map(loadAttachmentData)
      );
      const { body, attachments } = Whisper.Message.getLongMessageAttachment({
        body: this.get('body'),
        attachments: attachmentsWithData,
        now: this.get('sent_at'),
      });

      const quoteWithData = await loadQuoteData(this.get('quote'));
      const previewWithData = await loadPreviewData(this.get('preview'));
      const stickerWithData = await loadStickerData(this.get('sticker'));

      // Special-case the self-send case - we send only a sync message
      if (recipients.length === 1 && recipients[0] === this.OUR_NUMBER) {
        const [number] = recipients;
        const dataMessage = await textsecure.messaging.getMessageProto(
          number,
          body,
          attachments,
          quoteWithData,
          previewWithData,
          stickerWithData,
          null,
          this.get('sent_at'),
          this.get('expireTimer'),
          profileKey
        );
        return this.sendSyncMessageOnly(dataMessage);
      }

      let promise;
      const options = conversation.getSendOptions();

      if (conversation.isPrivate()) {
        const [number] = recipients;
        promise = textsecure.messaging.sendMessageToNumber(
          number,
          body,
          attachments,
          quoteWithData,
          previewWithData,
          stickerWithData,
          null,
          this.get('sent_at'),
          this.get('expireTimer'),
          profileKey,
          options
        );
      } else {
        // Because this is a partial group send, we manually construct the request like
        //   sendMessageToGroup does.

        promise = textsecure.messaging.sendMessage(
          {
            recipients,
            body,
            timestamp: this.get('sent_at'),
            attachments,
            quote: quoteWithData,
            preview: previewWithData,
            sticker: stickerWithData,
            expireTimer: this.get('expireTimer'),
            profileKey,
            group: {
              id: this.get('conversationId'),
              type: textsecure.protobuf.GroupContext.Type.DELIVER,
            },
          },
          options
        );
      }

      return this.send(conversation.wrapSend(promise));
    },
    isReplayableError(e) {
      return (
        e.name === 'MessageError' ||
        e.name === 'OutgoingMessageError' ||
        e.name === 'SendMessageNetworkError' ||
        e.name === 'SignedPreKeyRotationError' ||
        e.name === 'OutgoingIdentityKeyError'
      );
    },
    canReply() {
      const errors = this.get('errors');
      const isOutgoing = this.get('type') === 'outgoing';
      const numDelivered = this.get('delivered');

      // Case 1: We can reply if this is outgoing and delievered to at least one recipient
      if (isOutgoing && numDelivered > 0) {
        return true;
      }

      // Case 2: We can reply if there are no errors
      if (!errors || (errors && errors.length === 0)) {
        return true;
      }

      // Otherwise we cannot reply
      return false;
    },

    // Called when the user ran into an error with a specific user, wants to send to them
    //   One caller today: ConversationView.forceSend()
    async resend(number) {
      const error = this.removeOutgoingErrors(number);
      if (!error) {
        window.log.warn('resend: requested number was not present in errors');
        return null;
      }

      const profileKey = null;
      const attachmentsWithData = await Promise.all(
        (this.get('attachments') || []).map(loadAttachmentData)
      );
      const { body, attachments } = Whisper.Message.getLongMessageAttachment({
        body: this.get('body'),
        attachments: attachmentsWithData,
        now: this.get('sent_at'),
      });

      const quoteWithData = await loadQuoteData(this.get('quote'));
      const previewWithData = await loadPreviewData(this.get('preview'));
      const stickerWithData = await loadStickerData(this.get('sticker'));

      // Special-case the self-send case - we send only a sync message
      if (number === this.OUR_NUMBER) {
        const dataMessage = await textsecure.messaging.getMessageProto(
          number,
          body,
          attachments,
          quoteWithData,
          previewWithData,
          stickerWithData,
          null,
          this.get('sent_at'),
          this.get('expireTimer'),
          profileKey
        );
        return this.sendSyncMessageOnly(dataMessage);
      }

      const { wrap, sendOptions } = ConversationController.prepareForSend(
        number
      );
      const promise = textsecure.messaging.sendMessageToNumber(
        number,
        body,
        attachments,
        quoteWithData,
        previewWithData,
        stickerWithData,
        this.get('sent_at'),
        this.get('expireTimer'),
        profileKey,
        sendOptions
      );

      return this.send(wrap(promise));
    },
    removeOutgoingErrors(number) {
      const errors = _.partition(
        this.get('errors'),
        e =>
          e.number === number &&
          (e.name === 'MessageError' ||
            e.name === 'OutgoingMessageError' ||
            e.name === 'SendMessageNetworkError' ||
            e.name === 'SignedPreKeyRotationError' ||
            e.name === 'OutgoingIdentityKeyError')
      );
      this.set({ errors: errors[1] });
      return errors[0][0];
    },

    send(promise) {
      this.trigger('pending');
      return promise
        .then(async result => {
          this.trigger('done');

          // This is used by sendSyncMessage, then set to null
          if (result.dataMessage) {
            this.set({ dataMessage: result.dataMessage });
          }

          const sentTo = this.get('sent_to') || [];
          this.set({
            sent_to: _.union(sentTo, result.successfulNumbers),
            sent: true,
            expirationStartTimestamp: Date.now(),
            unidentifiedDeliveries: result.unidentifiedDeliveries,
          });

          await window.Signal.Data.saveMessage(this.attributes, {
            Message: Whisper.Message,
          });

          this.trigger('sent', this);
          this.sendSyncMessage();
        })
        .catch(result => {
          this.trigger('done');

          if (result.dataMessage) {
            this.set({ dataMessage: result.dataMessage });
          }

          let promises = [];

          if (result instanceof Error) {
            this.saveErrors(result);
            if (result.name === 'SignedPreKeyRotationError') {
              promises.push(getAccountManager().rotateSignedPreKey());
            } else if (result.name === 'OutgoingIdentityKeyError') {
              const c = ConversationController.get(result.number);
              promises.push(c.getProfiles());
            }
          } else {
            if (result.successfulNumbers.length > 0) {
              const sentTo = this.get('sent_to') || [];

              // In groups, we don't treat unregistered users as a user-visible
              //   error. The message will look successful, but the details
              //   screen will show that we didn't send to these unregistered users.
              const filteredErrors = _.reject(
                result.errors,
                error => error.name === 'UnregisteredUserError'
              );

              // We don't start the expiration timer if there are real errors
              //   left after filtering out all of the unregistered user errors.
              const expirationStartTimestamp = filteredErrors.length
                ? null
                : Date.now();

              this.saveErrors(filteredErrors);

              this.set({
                sent_to: _.union(sentTo, result.successfulNumbers),
                sent: true,
                expirationStartTimestamp,
                unidentifiedDeliveries: result.unidentifiedDeliveries,
              });
              promises.push(this.sendSyncMessage());
            } else {
              this.saveErrors(result.errors);
            }
            promises = promises.concat(
              _.map(result.errors, error => {
                if (error.name === 'OutgoingIdentityKeyError') {
                  const c = ConversationController.get(error.number);
                  promises.push(c.getProfiles());
                }
              })
            );
          }

          this.trigger('send-error', this.get('errors'));

          return Promise.all(promises);
        });
    },

    async sendSyncMessageOnly(dataMessage) {
      this.set({ dataMessage });

      try {
        this.set({
          // These are the same as a normal send()
          sent_to: [this.OUR_NUMBER],
          sent: true,
          expirationStartTimestamp: Date.now(),
        });
        const result = await this.sendSyncMessage();
        this.set({
          // We have to do this afterward, since we didn't have a previous send!
          unidentifiedDeliveries: result ? result.unidentifiedDeliveries : null,

          // These are unique to a Note to Self message - immediately read/delivered
          delivered_to: [this.OUR_NUMBER],
          read_by: [this.OUR_NUMBER],
        });
      } catch (result) {
        const errors = (result && result.errors) || [
          new Error('Unknown error'),
        ];
        this.set({ errors });
      } finally {
        await window.Signal.Data.saveMessage(this.attributes, {
          Message: Whisper.Message,
        });
        this.trigger('done');

        const errors = this.get('errors');
        if (errors) {
          this.trigger('send-error', errors);
        } else {
          this.trigger('sent');
        }
      }
    },

    sendSyncMessage() {
      const ourNumber = textsecure.storage.user.getNumber();
      const { wrap, sendOptions } = ConversationController.prepareForSend(
        ourNumber,
        {
          syncMessage: true,
        }
      );

      this.syncPromise = this.syncPromise || Promise.resolve();
      const next = () => {
        const dataMessage = this.get('dataMessage');
        if (!dataMessage) {
          return Promise.resolve();
        }
        const isUpdate = Boolean(this.get('synced'));

        return wrap(
          textsecure.messaging.sendSyncMessage(
            dataMessage,
            this.get('sent_at'),
            this.get('destination'),
            this.get('expirationStartTimestamp'),
            this.get('sent_to'),
            this.get('unidentifiedDeliveries'),
            isUpdate,
            sendOptions
          )
        ).then(result => {
          this.set({
            synced: true,
            dataMessage: null,
          });
          return window.Signal.Data.saveMessage(this.attributes, {
            Message: Whisper.Message,
          }).then(() => result);
        });
      };

      this.syncPromise = this.syncPromise.then(next, next);

      return this.syncPromise;
    },

    // Receive logic
    async queueAttachmentDownloads() {
      const messageId = this.id;
      let count = 0;
      let bodyPending;

      const [longMessageAttachments, normalAttachments] = _.partition(
        this.get('attachments') || [],
        attachment =>
          attachment.contentType === Whisper.Message.LONG_MESSAGE_CONTENT_TYPE
      );

      if (longMessageAttachments.length > 1) {
        window.log.error(
          `Received more than one long message attachment in message ${this.idForLogging()}`
        );
      }
      if (longMessageAttachments.length > 0) {
        count += 1;
        bodyPending = true;
        await window.Signal.AttachmentDownloads.addJob(
          longMessageAttachments[0],
          {
            messageId,
            type: 'long-message',
            index: 0,
          }
        );
      }

      const attachments = await Promise.all(
        normalAttachments.map((attachment, index) => {
          count += 1;
          return window.Signal.AttachmentDownloads.addJob(attachment, {
            messageId,
            type: 'attachment',
            index,
          });
        })
      );

      const preview = await Promise.all(
        (this.get('preview') || []).map(async (item, index) => {
          if (!item.image) {
            return item;
          }

          count += 1;
          return {
            ...item,
            image: await window.Signal.AttachmentDownloads.addJob(item.image, {
              messageId,
              type: 'preview',
              index,
            }),
          };
        })
      );

      const contact = await Promise.all(
        (this.get('contact') || []).map(async (item, index) => {
          if (!item.avatar || !item.avatar.avatar) {
            return item;
          }

          count += 1;
          return {
            ...item,
            avatar: {
              ...item.avatar,
              avatar: await window.Signal.AttachmentDownloads.addJob(
                item.avatar.avatar,
                {
                  messageId,
                  type: 'contact',
                  index,
                }
              ),
            },
          };
        })
      );

      let quote = this.get('quote');
      if (quote && quote.attachments && quote.attachments.length) {
        quote = {
          ...quote,
          attachments: await Promise.all(
            (quote.attachments || []).map(async (item, index) => {
              // If we already have a path, then we copied this image from the quoted
              //    message and we don't need to download the attachment.
              if (!item.thumbnail || item.thumbnail.path) {
                return item;
              }

              count += 1;
              return {
                ...item,
                thumbnail: await window.Signal.AttachmentDownloads.addJob(
                  item.thumbnail,
                  {
                    messageId,
                    type: 'quote',
                    index,
                  }
                ),
              };
            })
          ),
        };
      }

      let group = this.get('group_update');
      if (group && group.avatar) {
        count += 1;
        group = {
          ...group,
          avatar: await window.Signal.AttachmentDownloads.addJob(group.avatar, {
            messageId,
            type: 'group-avatar',
            index: 0,
          }),
        };
      }

      let sticker = this.get('sticker');
      if (sticker) {
        count += 1;
        const { packId, stickerId, packKey } = sticker;

        const status = getStickerPackStatus(packId);
        let data;

        if (status && (status === 'downloaded' || status === 'installed')) {
          try {
            const copiedSticker = await copyStickerToAttachments(
              packId,
              stickerId
            );
            data = {
              ...copiedSticker,
              contentType: 'image/webp',
            };
          } catch (error) {
            window.log.error(
              `Problem copying sticker (${packId}, ${stickerId}) to attachments:`,
              error && error.stack ? error.stack : error
            );
          }
        }
        if (!data) {
          data = await window.Signal.AttachmentDownloads.addJob(sticker.data, {
            messageId,
            type: 'sticker',
            index: 0,
          });
        }
        if (!status) {
          // Save the packId/packKey for future download/install
          savePackMetadata(packId, packKey, { messageId });
        } else {
          await addStickerPackReference(messageId, packId);
        }

        sticker = {
          ...sticker,
          packId,
          data,
        };
      }

      if (count > 0) {
        this.set({
          bodyPending,
          attachments,
          preview,
          contact,
          quote,
          group_update: group,
          sticker,
        });

        return true;
      }

      return false;
    },

    async copyFromQuotedMessage(message) {
      const { quote } = message;
      if (!quote) {
        return message;
      }

      const { attachments, id, author } = quote;
      const firstAttachment = attachments[0];

      const collection = await window.Signal.Data.getMessagesBySentAt(id, {
        MessageCollection: Whisper.MessageCollection,
      });
      const found = collection.find(item => {
        const messageAuthor = item.getContact();

        return messageAuthor && author === messageAuthor.id;
      });

      if (!found) {
        quote.referencedMessageNotFound = true;
        return message;
      }
      if (found.isTapToView()) {
        quote.text = null;
        quote.attachments = [
          {
            contentType: 'image/jpeg',
          },
        ];

        return message;
      }

      const queryMessage = MessageController.register(found.id, found);
      quote.text = queryMessage.get('body');
      if (firstAttachment) {
        firstAttachment.thumbnail = null;
      }

      if (
        !firstAttachment ||
        (!GoogleChrome.isImageTypeSupported(firstAttachment.contentType) &&
          !GoogleChrome.isVideoTypeSupported(firstAttachment.contentType))
      ) {
        return message;
      }

      try {
        if (
          queryMessage.get('schemaVersion') <
          TypedMessage.VERSION_NEEDED_FOR_DISPLAY
        ) {
          const upgradedMessage = await upgradeMessageSchema(
            queryMessage.attributes
          );
          queryMessage.set(upgradedMessage);
          await window.Signal.Data.saveMessage(upgradedMessage, {
            Message: Whisper.Message,
          });
        }
      } catch (error) {
        window.log.error(
          'Problem upgrading message quoted message from database',
          Errors.toLogFormat(error)
        );
        return message;
      }

      const queryAttachments = queryMessage.get('attachments') || [];
      if (queryAttachments.length > 0) {
        const queryFirst = queryAttachments[0];
        const { thumbnail } = queryFirst;

        if (thumbnail && thumbnail.path) {
          firstAttachment.thumbnail = {
            ...thumbnail,
            copied: true,
          };
        }
      }

      const queryPreview = queryMessage.get('preview') || [];
      if (queryPreview.length > 0) {
        const queryFirst = queryPreview[0];
        const { image } = queryFirst;

        if (image && image.path) {
          firstAttachment.thumbnail = {
            ...image,
            copied: true,
          };
        }
      }

      const sticker = queryMessage.get('sticker');
      if (sticker && sticker.data && sticker.data.path) {
        firstAttachment.thumbnail = {
          ...sticker.data,
          copied: true,
        };
      }

      return message;
    },

    handleDataMessage(initialMessage, confirm, options = {}) {
      const { data } = options;

      // This function is called from the background script in a few scenarios:
      //   1. on an incoming message
      //   2. on a sent message sync'd from another device
      //   3. in rare cases, an incoming message can be retried, though it will
      //      still go through one of the previous two codepaths
      const message = this;
      const source = message.get('source');
      const type = message.get('type');
      let conversationId = message.get('conversationId');
      if (initialMessage.group) {
        conversationId = initialMessage.group.id;
      }
      const GROUP_TYPES = textsecure.protobuf.GroupContext.Type;

      const conversation = ConversationController.get(conversationId);
      return conversation.queueJob(async () => {
        window.log.info(
          `Starting handleDataMessage for message ${message.idForLogging()} in conversation ${conversation.idForLogging()}`
        );

        // First, check for duplicates. If we find one, stop processing here.
        const existingMessage = await getMessageBySender(this.attributes, {
          Message: Whisper.Message,
        });
        const isUpdate = Boolean(data && data.isRecipientUpdate);

        if (existingMessage && type === 'incoming') {
          window.log.warn('Received duplicate message', this.idForLogging());
          confirm();
          return;
        }
        if (type === 'outgoing') {
          if (isUpdate && existingMessage) {
            window.log.info(
              `handleDataMessage: Updating message ${message.idForLogging()} with received transcript`
            );

            let sentTo = [];
            let unidentifiedDeliveries = [];
            if (Array.isArray(data.unidentifiedStatus)) {
              sentTo = data.unidentifiedStatus.map(item => item.destination);

              const unidentified = _.filter(data.unidentifiedStatus, item =>
                Boolean(item.unidentified)
              );
              unidentifiedDeliveries = unidentified.map(
                item => item.destination
              );
            }

            const toUpdate = MessageController.register(
              existingMessage.id,
              existingMessage
            );
            toUpdate.set({
              sent_to: _.union(toUpdate.get('sent_to'), sentTo),
              unidentifiedDeliveries: _.union(
                toUpdate.get('unidentifiedDeliveries'),
                unidentifiedDeliveries
              ),
            });
            await window.Signal.Data.saveMessage(toUpdate.attributes, {
              Message: Whisper.Message,
            });

            confirm();
            return;
          } else if (isUpdate) {
            window.log.warn(
              `handleDataMessage: Received update transcript, but no existing entry for message ${message.idForLogging()}. Dropping.`
            );

            confirm();
            return;
          } else if (existingMessage) {
            window.log.warn(
              `handleDataMessage: Received duplicate transcript for message ${message.idForLogging()}, but it was not an update transcript. Dropping.`
            );

            confirm();
            return;
          }
        }

        // We drop incoming messages for groups we already know about, which we're not a
        //   part of, except for group updates.
        const ourNumber = textsecure.storage.user.getNumber();
        const isGroupUpdate =
          initialMessage.group &&
          initialMessage.group.type !==
            textsecure.protobuf.GroupContext.Type.DELIVER;
        if (
          type === 'incoming' &&
          !conversation.isPrivate() &&
          !conversation.hasMember(ourNumber) &&
          !isGroupUpdate
        ) {
          window.log.warn(
            `Received message destined for group ${conversation.idForLogging()}, which we're not a part of. Dropping.`
          );
          confirm();
          return;
        }

        // Send delivery receipts, but only for incoming sealed sender messages
        if (
          type === 'incoming' &&
          this.get('unidentifiedDeliveryReceived') &&
          !this.hasErrors()
        ) {
          // Note: We both queue and batch because we want to wait until we are done
          //   processing incoming messages to start sending outgoing delivery receipts.
          //   The queue can be paused easily.
          Whisper.deliveryReceiptQueue.add(() => {
            Whisper.deliveryReceiptBatcher.add({
              source,
              timestamp: this.get('sent_at'),
            });
          });
        }

        const withQuoteReference = await this.copyFromQuotedMessage(
          initialMessage
        );
        const dataMessage = await upgradeMessageSchema(withQuoteReference);

        try {
          const now = new Date().getTime();

          const urls = window.Signal.LinkPreviews.findLinks(dataMessage.body);
          const incomingPreview = dataMessage.preview || [];
          const preview = incomingPreview.filter(
            item =>
              (item.image || item.title) &&
              urls.includes(item.url) &&
              window.Signal.LinkPreviews.isLinkInWhitelist(item.url)
          );
          if (preview.length < incomingPreview.length) {
            window.log.info(
              `${message.idForLogging()}: Eliminated ${preview.length -
                incomingPreview.length} previews with invalid urls'`
            );
          }

          message.set({
            id: window.getGuid(),
            attachments: dataMessage.attachments,
            body: dataMessage.body,
            contact: dataMessage.contact,
            conversationId: conversation.id,
            decrypted_at: now,
            errors: [],
            flags: dataMessage.flags,
            hasAttachments: dataMessage.hasAttachments,
            hasFileAttachments: dataMessage.hasFileAttachments,
            hasVisualMediaAttachments: dataMessage.hasVisualMediaAttachments,
            isViewOnce: Boolean(dataMessage.isViewOnce),
            preview,
            requiredProtocolVersion:
              dataMessage.requiredProtocolVersion ||
              this.INITIAL_PROTOCOL_VERSION,
            supportedVersionAtReceive: this.CURRENT_PROTOCOL_VERSION,
            quote: dataMessage.quote,
            schemaVersion: dataMessage.schemaVersion,
            sticker: dataMessage.sticker,
          });

          const isSupported = !message.isUnsupportedMessage();
          if (!isSupported) {
            await message.eraseContents();
          }

          if (isSupported) {
            let attributes = {
              ...conversation.attributes,
            };
            if (dataMessage.group) {
              let groupUpdate = null;
              attributes = {
                ...attributes,
                type: 'group',
                groupId: dataMessage.group.id,
              };
              if (dataMessage.group.type === GROUP_TYPES.UPDATE) {
                const removedMembers = _.difference(
                  conversation.get('members'),
                  dataMessage.group.members
                );
                const xMembers = _.without(
                  conversation.get('members'),
                  removedMembers
                );

                attributes = {
                  ...attributes,
                  name: dataMessage.group.name,
                  members: dataMessage.group.members
//                  members: _.union(
//                    dataMessage.group.members,
//                    conversation.get('members')
//                  ),
                };

                groupUpdate =
                  conversation.changedAttributes(
                    _.pick(dataMessage.group, 'name', 'avatar')
                  ) || {};

                const difference = _.difference(
                  attributes.members,
                  xMembers
                );
                if (difference.length > 0) {
                  groupUpdate.joined = difference;
                }
                if (removedMembers.length > 0) {
                  groupUpdate.left = removedMembers;
                }
                if (conversation.get('left')) {
                  window.log.warn('re-added to a left group');
                  attributes.left = false;
                }
              } else if (dataMessage.group.type === GROUP_TYPES.QUIT) {
                if (source === textsecure.storage.user.getNumber()) {
                  attributes.left = true;
                  groupUpdate = { left: 'You' };
                } else {
                  groupUpdate = { left: source };
                }
                attributes.members = _.without(
                  conversation.get('members'),
                  source
                );
              }

              if (groupUpdate !== null) {
                message.set({ group_update: groupUpdate });
              }
            }

            if (type === 'outgoing') {
              const receipts = Whisper.DeliveryReceipts.forMessage(
                conversation,
                message
              );
              receipts.forEach(receipt =>
                message.set({
                  delivered: (message.get('delivered') || 0) + 1,
                  delivered_to: _.union(message.get('delivered_to') || [], [
                    receipt.get('source'),
                  ]),
                })
              );
            }
            attributes.active_at = now;
            conversation.set(attributes);

            if (message.isExpirationTimerUpdate()) {
              message.set({
                expirationTimerUpdate: {
                  source,
                  expireTimer: dataMessage.expireTimer,
                },
              });
              conversation.set({ expireTimer: dataMessage.expireTimer });
            } else if (dataMessage.expireTimer) {
              message.set({ expireTimer: dataMessage.expireTimer });
            }

            // NOTE: Remove once the above uses
            // `Conversation::updateExpirationTimer`:
            const { expireTimer } = dataMessage;
            const shouldLogExpireTimerChange =
              message.isExpirationTimerUpdate() || expireTimer;
            if (shouldLogExpireTimerChange) {
              window.log.info("Update conversation 'expireTimer'", {
                id: conversation.idForLogging(),
                expireTimer,
                source: 'handleDataMessage',
              });
            }

            if (!message.isEndSession()) {
              if (dataMessage.expireTimer) {
                if (
                  dataMessage.expireTimer !== conversation.get('expireTimer')
                ) {
                  conversation.updateExpirationTimer(
                    dataMessage.expireTimer,
                    source,
                    message.get('received_at'),
                    {
                      fromGroupUpdate: message.isGroupUpdate(),
                    }
                  );
                }
              } else if (
                conversation.get('expireTimer') &&
                // We only turn off timers if it's not a group update
                !message.isGroupUpdate()
              ) {
                conversation.updateExpirationTimer(
                  null,
                  source,
                  message.get('received_at')
                );
              }
            }
            if (type === 'incoming') {
              const readSync = Whisper.ReadSyncs.forMessage(message);
              if (readSync) {
                if (
                  message.get('expireTimer') &&
                  !message.get('expirationStartTimestamp')
                ) {
                  message.set(
                    'expirationStartTimestamp',
                    Math.min(readSync.get('read_at'), Date.now())
                  );
                }
              }
              if (readSync || message.isExpirationTimerUpdate()) {
                message.unset('unread');
                // This is primarily to allow the conversation to mark all older
                // messages as read, as is done when we receive a read sync for
                // a message we already know about.
                const c = message.getConversation();
                if (c) {
                  c.onReadMessage(message);
                }
              } else {
                conversation.set({
                  unreadCount: conversation.get('unreadCount') + 1,
                  isArchived: false,
                });
              }
            }

            if (type === 'outgoing') {
              const reads = Whisper.ReadReceipts.forMessage(
                conversation,
                message
              );
              if (reads.length) {
                const readBy = reads.map(receipt => receipt.get('reader'));
                message.set({
                  read_by: _.union(message.get('read_by'), readBy),
                });
              }

              // A sync'd message to ourself is automatically considered read/delivered
              if (conversation.isMe()) {
                message.set({
                  read_by: conversation.getRecipients(),
                  delivered_to: conversation.getRecipients(),
                });
              }

              message.set({ recipients: conversation.getRecipients() });
            }

            if (dataMessage.profileKey) {
              const profileKey = dataMessage.profileKey.toString('base64');
              if (source === textsecure.storage.user.getNumber()) {
                conversation.set({ profileSharing: true });
              } else if (conversation.isPrivate()) {
                conversation.setProfileKey(profileKey);
              } else {
                ConversationController.getOrCreateAndWait(
                  source,
                  'private'
                ).then(sender => {
                  sender.setProfileKey(profileKey);
                });
              }
            }

            if (message.isTapToView() && type === 'outgoing') {
              await message.eraseContents();
            }

            if (
              type === 'incoming' &&
              message.isTapToView() &&
              !message.isValidTapToView()
            ) {
              window.log.warn(
                `Received tap to view message ${message.idForLogging()} with invalid data. Erasing contents.`
              );
              message.set({
                isTapToViewInvalid: true,
              });
              await message.eraseContents();
            }
            // Check for out-of-order view syncs
            if (type === 'incoming' && message.isTapToView()) {
              const viewSync = Whisper.ViewSyncs.forMessage(message);
              if (viewSync) {
                await message.markViewed({ fromSync: true });
              }
            }
          }

          const conversationTimestamp = conversation.get('timestamp');
          if (
            !conversationTimestamp ||
            message.get('sent_at') > conversationTimestamp
          ) {
            conversation.set({
              lastMessage: message.getNotificationText(),
              timestamp: message.get('sent_at'),
            });
          }

          MessageController.register(message.id, message);
          window.Signal.Data.updateConversation(
            conversationId,
            conversation.attributes
          );

          await message.queueAttachmentDownloads();
          await window.Signal.Data.saveMessage(message.attributes, {
            Message: Whisper.Message,
            forceSave: true,
          });

          conversation.trigger('newmessage', message);

          if (message.get('unread')) {
            await conversation.notify(message);
          }

          // Does this message have a pending, previously-received associated reaction?
          const reaction = Whisper.Reactions.forMessage(message);
          if (reaction) {
            message.handleReaction(reaction);
          }

          Whisper.events.trigger('incrementProgress');
          confirm();
        } catch (error) {
          const errorForLog = error && error.stack ? error.stack : error;
          window.log.error(
            'handleDataMessage',
            message.idForLogging(),
            'error:',
            errorForLog
          );
          throw error;
        }
      });
    },

    async handleReaction(reaction) {
      const reactions = this.get('reactions') || [];
      const messageId = this.idForLogging();
      const count = reactions.length;

      if (reaction.get('remove')) {
        window.log.info('Removing reaction for message', messageId);
        const newReactions = reactions.filter(
          re =>
            re.emoji !== reaction.get('emoji') ||
            re.fromId !== reaction.get('fromId')
        );
        this.set({ reactions: newReactions });
      } else {
        window.log.info('Adding reaction for message', messageId);
        const newReactions = reactions.filter(
          re => re.fromId !== reaction.get('fromId')
        );
        newReactions.push(reaction.toJSON());
        this.set({ reactions: newReactions });

        const conversation = ConversationController.get(
          this.get('conversationId')
        );

        // Only notify for reactions to our own messages
        if (conversation && this.isOutgoing() && !reaction.get('fromSync')) {
          conversation.notify(this, reaction);
        }
      }

      const newCount = this.get('reactions').length;
      window.log.info(
        `Done processing reaction for message ${messageId}. Went from ${count} to ${newCount} reactions.`
      );

      await window.Signal.Data.saveMessage(this.attributes, {
        Message: Whisper.Message,
      });
    },
  });

  // Receive will be enabled before we enable send
  Whisper.Message.LONG_MESSAGE_CONTENT_TYPE = 'text/x-signal-plain';

  Whisper.Message.getLongMessageAttachment = ({ body, attachments, now }) => {
    if (!body || body.length <= 2048) {
      return {
        body,
        attachments,
      };
    }

    const data = bytesFromString(body);
    const attachment = {
      contentType: Whisper.Message.LONG_MESSAGE_CONTENT_TYPE,
      fileName: `long-message-${now}.txt`,
      data,
      size: data.byteLength,
    };

    return {
      body: body.slice(0, 2048),
      attachments: [attachment, ...attachments],
    };
  };

  Whisper.Message.updateTimers = () => {
    Whisper.ExpiringMessagesListener.update();
    Whisper.TapToViewMessagesListener.update();
  };

  Whisper.MessageCollection = Backbone.Collection.extend({
    model: Whisper.Message,
    comparator(left, right) {
      if (left.get('received_at') === right.get('received_at')) {
        return (left.get('sent_at') || 0) - (right.get('sent_at') || 0);
      }

      return (left.get('received_at') || 0) - (right.get('received_at') || 0);
    },
  });
})();
