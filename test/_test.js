/* global chai, Whisper, _, Backbone */

mocha.setup('bdd');
window.assert = chai.assert;
window.PROTO_ROOT = '../protos';

const OriginalReporter = mocha._reporter;

const SauceReporter = function Constructor(runner) {
  const failedTests = [];

  runner.on('end', () => {
    window.mochaResults = runner.stats;
    window.mochaResults.reports = failedTests;
  });

  runner.on('fail', (test, err) => {
    const flattenTitles = item => {
      const titles = [];
      while (item.parent.title) {
        titles.push(item.parent.title);
        // eslint-disable-next-line no-param-reassign
        item = item.parent;
      }
      return titles.reverse();
    };
    failedTests.push({
      name: test.title,
      result: false,
      message: err.message,
      stack: err.stack,
      titles: flattenTitles(test),
    });
  });

  // eslint-disable-next-line no-new
  new OriginalReporter(runner);
};

SauceReporter.prototype = OriginalReporter.prototype;

mocha.reporter(SauceReporter);

// Override the database id.
window.Whisper = window.Whisper || {};
window.Whisper.Database = window.Whisper.Database || {};
Whisper.Database.id = 'test';

/*
 * global helpers for tests
 */
window.assertEqualArrayBuffers = (ab1, ab2) => {
  assert.deepEqual(new Uint8Array(ab1), new Uint8Array(ab2));
};

window.hexToArrayBuffer = str => {
  const ret = new ArrayBuffer(str.length / 2);
  const array = new Uint8Array(ret);
  for (let i = 0; i < str.length / 2; i += 1) {
    array[i] = parseInt(str.substr(i * 2, 2), 16);
  }
  return ret;
};

function deleteIndexedDB() {
  return new Promise((resolve, reject) => {
    const idbReq = indexedDB.deleteDatabase('test');
    idbReq.onsuccess = resolve;
    idbReq.error = reject;
  });
}

/* Delete the database before running any tests */
before(async () => {
  await deleteIndexedDB();
  await window.Signal.Data.removeAll();
  await window.storage.fetch();
});

window.clearDatabase = async () => {
  await window.Signal.Data.removeAll();
  await window.storage.fetch();
};

window.Whisper = window.Whisper || {};
window.Whisper.events = _.clone(Backbone.Events);
