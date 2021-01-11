/* global window, setTimeout, clearTimeout, textsecure, WebAPI, ConversationController */

module.exports = {
  initialize,
};

const ONE_DAY = 24 * 60 * 60 * 1000; // one day
const MINIMUM_TIME_LEFT = 2 * 60 * 60 * 1000; // two hours

let timeout = null;
let scheduledTime = null;
let scheduleNext = null;

// We need to refresh our own profile regularly to account for newly-added devices which
//   do not support unidentified delivery.
function refreshOurProfile() {
  window.log.info('refreshOurProfile');
  const ourNumber = textsecure.storage.user.getNumber();
  const conversation = ConversationController.getOrCreate(ourNumber, 'private');
  conversation.getProfiles();
}

function initialize({ events, storage, navigator, logger }) {
  // We don't want to set up all of the below functions, but we do want to ensure that our
  //   refresh timer is up-to-date.
  if (scheduleNext) {
    scheduleNext();
    return;
  }

  runWhenOnline();

  events.on('timetravel', scheduleNextRotation);

  function scheduleNextRotation() {
    const now = Date.now();
    const certificate = storage.get('senderCertificate');
    if (!certificate) {
      setTimeoutForNextRun(scheduledTime || now);

      return;
    }

    // The useful information in a SenderCertificate is all serialized, so we
    //   need to do another layer of decoding.
    const decoded = textsecure.protobuf.SenderCertificate.Certificate.decode(
      certificate.certificate
    );
    const expires = decoded.expires.toNumber();

    // If we have a time in place and it's already before the safety zone before expire,
    //   we keep it
    if (scheduledTime && scheduledTime <= expires - MINIMUM_TIME_LEFT) {
      setTimeoutForNextRun(scheduledTime);
      return;
    }

    // Otherwise, we reset every day, or earlier if the safety zone requires it
    const time = Math.min(now + ONE_DAY, expires - MINIMUM_TIME_LEFT);
    setTimeoutForNextRun(time);
  }

  // Keeping this entrypoint around so more inialize() calls just kick the timing
  scheduleNext = scheduleNextRotation;

  async function run() {
    logger.info('refreshSenderCertificate: Getting new certificate...');
    try {
      const username = storage.get('number_id');
      const password = storage.get('password');
      const server = WebAPI.connect({ username, password });

      const { certificate } = await server.getSenderCertificate();
      const arrayBuffer = window.Signal.Crypto.base64ToArrayBuffer(certificate);
      const decoded = textsecure.protobuf.SenderCertificate.decode(arrayBuffer);

      decoded.certificate = decoded.certificate.toArrayBuffer();
      decoded.signature = decoded.signature.toArrayBuffer();
      decoded.serialized = arrayBuffer;

      storage.put('senderCertificate', decoded);
      scheduledTime = null;

      scheduleNextRotation();
    } catch (error) {
      logger.error(
        'refreshSenderCertificate: Get failed. Trying again in five minutes...',
        error && error.stack ? error.stack : error
      );

      scheduledTime = Date.now() + 5 * 60 * 1000;

      scheduleNextRotation();
    }

    refreshOurProfile();
  }

  function runWhenOnline() {
    if (navigator.onLine) {
      run();
    } else {
      logger.info(
        'refreshSenderCertificate: Offline. Will update certificate when online...'
      );
      const listener = () => {
        logger.info(
          'refreshSenderCertificate: Online. Now updating certificate...'
        );
        window.removeEventListener('online', listener);
        run();
      };
      window.addEventListener('online', listener);
    }
  }

  function setTimeoutForNextRun(time = Date.now()) {
    const now = Date.now();

    if (scheduledTime !== time || !timeout) {
      logger.info(
        'Next sender certificate refresh scheduled for',
        new Date(time).toISOString()
      );
    }

    scheduledTime = time;
    const waitTime = Math.max(0, time - now);

    clearTimeout(timeout);
    timeout = setTimeout(runWhenOnline, waitTime);
  }
}
