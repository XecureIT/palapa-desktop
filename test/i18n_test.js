/* global i18n */

describe('i18n', () => {
  describe('i18n', () => {
    it('returns empty string for unknown string', () => {
      assert.strictEqual(i18n('random'), '');
    });
    it('returns message for given string', () => {
      assert.equal(i18n('reportIssue'), 'Report an issue');
    });
    it('returns message with single substitution', () => {
      const actual = i18n('cannotUpdateDetail', 'https://signal.org/download');
      assert.equal(
        actual,
        'Signal Desktop failed to update, but there is a new version available. Please go to https://signal.org/download and install the new version manually, then either contact support or file a bug about this problem.'
      );
    });
    it('returns message with multiple substitutions', () => {
      const actual = i18n('theyChangedTheTimer', ['Someone', '5 minutes']);
      assert.equal(
        actual,
        'Someone set the disappearing message timer to 5 minutes'
      );
    });
  });

  describe('getLocale', () => {
    it('returns a string with length two or greater', () => {
      const locale = i18n.getLocale();
      assert.isAtLeast(locale.trim().length, 2);
    });
  });
});
