/* global
  _,
  Backbone,
  i18n,
  MessageController,
  moment,
  Whisper
*/

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  async function destroyExpiredMessages() {
    try {
      window.log.info('destroyExpiredMessages: Loading messages...');
      const messages = await window.Signal.Data.getExpiredMessages({
        MessageCollection: Whisper.MessageCollection,
      });

      await Promise.all(
        messages.map(async fromDB => {
          const message = MessageController.register(fromDB.id, fromDB);

          window.log.info('Message expired', {
            sentAt: message.get('sent_at'),
          });

          // We delete after the trigger to allow the conversation time to process
          //   the expiration before the message is removed from the database.
          await window.Signal.Data.removeMessage(message.id, {
            Message: Whisper.Message,
          });

          Whisper.events.trigger(
            'messageExpired',
            message.id,
            message.conversationId
          );

          const conversation = message.getConversation();
          if (conversation) {
            conversation.trigger('expired', message);
          }
        })
      );
    } catch (error) {
      window.log.error(
        'destroyExpiredMessages: Error deleting expired messages',
        error && error.stack ? error.stack : error
      );
    }

    window.log.info('destroyExpiredMessages: complete');
    checkExpiringMessages();
  }

  let timeout;
  async function checkExpiringMessages() {
    // Look up the next expiring message and set a timer to destroy it
    const messages = await window.Signal.Data.getNextExpiringMessage({
      MessageCollection: Whisper.MessageCollection,
    });

    const next = messages.at(0);
    if (!next) {
      return;
    }

    const expiresAt = next.get('expires_at');
    Whisper.ExpiringMessagesListener.nextExpiration = expiresAt;
    window.log.info('next message expires', new Date(expiresAt).toISOString());

    let wait = expiresAt - Date.now();

    // In the past
    if (wait < 0) {
      wait = 0;
    }

    // Too far in the future, since it's limited to a 32-bit value
    if (wait > 2147483647) {
      wait = 2147483647;
    }

    clearTimeout(timeout);
    timeout = setTimeout(destroyExpiredMessages, wait);
  }
  const debouncedCheckExpiringMessages = _.debounce(
    checkExpiringMessages,
    1000
  );

  Whisper.ExpiringMessagesListener = {
    nextExpiration: null,
    init(events) {
      checkExpiringMessages();
      events.on('timetravel', debouncedCheckExpiringMessages);
    },
    update: debouncedCheckExpiringMessages,
  };

  const TimerOption = Backbone.Model.extend({
    getName() {
      return (
        i18n(['timerOption', this.get('time'), this.get('unit')].join('_')) ||
        moment.duration(this.get('time'), this.get('unit')).humanize()
      );
    },
    getAbbreviated() {
      return i18n(
        ['timerOption', this.get('time'), this.get('unit'), 'abbreviated'].join(
          '_'
        )
      );
    },
  });
  Whisper.ExpirationTimerOptions = new (Backbone.Collection.extend({
    model: TimerOption,
    getName(seconds = 0) {
      const o = this.findWhere({ seconds });
      if (o) {
        return o.getName();
      }
      return [seconds, 'seconds'].join(' ');
    },
    getAbbreviated(seconds = 0) {
      const o = this.findWhere({ seconds });
      if (o) {
        return o.getAbbreviated();
      }
      return [seconds, 's'].join('');
    },
  }))(
    [
      [0, 'seconds'],
      [5, 'seconds'],
      [10, 'seconds'],
      [30, 'seconds'],
      [1, 'minute'],
      [5, 'minutes'],
      [30, 'minutes'],
      [1, 'hour'],
      [6, 'hours'],
      [12, 'hours'],
      [1, 'day'],
      [1, 'week'],
    ].map(o => {
      const duration = moment.duration(o[0], o[1]); // 5, 'seconds'
      return {
        time: o[0],
        unit: o[1],
        seconds: duration.asSeconds(),
      };
    })
  );
})();
