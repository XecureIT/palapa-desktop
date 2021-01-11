import { assert } from 'chai';

import { contactSelector, getName } from '../../types/Contact';

describe('Contact', () => {
  describe('getName', () => {
    it('returns displayName if provided', () => {
      const contact = {
        name: {
          displayName: 'displayName',
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
      };
      const expected = 'displayName';
      const actual = getName(contact);
      assert.strictEqual(actual, expected);
    });
    it('returns organization if no displayName', () => {
      const contact = {
        name: {
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
      };
      const expected = 'Somewhere, Inc.';
      const actual = getName(contact);
      assert.strictEqual(actual, expected);
    });
    it('returns givenName + familyName if no displayName or organization', () => {
      const contact = {
        name: {
          givenName: 'givenName',
          familyName: 'familyName',
        },
      };
      const expected = 'givenName familyName';
      const actual = getName(contact);
      assert.strictEqual(actual, expected);
    });
    it('returns just givenName', () => {
      const contact = {
        name: {
          givenName: 'givenName',
        },
      };
      const expected = 'givenName';
      const actual = getName(contact);
      assert.strictEqual(actual, expected);
    });
    it('returns just familyName', () => {
      const contact = {
        name: {
          familyName: 'familyName',
        },
      };
      const expected = 'familyName';
      const actual = getName(contact);
      assert.strictEqual(actual, expected);
    });
  });
  describe('contactSelector', () => {
    const regionCode = '1';
    const signalAccount = '+1202555000';
    const getAbsoluteAttachmentPath = (path: string) => `absolute:${path}`;

    it('eliminates avatar if it has had an attachment download error', () => {
      const contact = {
        name: {
          displayName: 'displayName',
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
        avatar: {
          isProfile: true,
          avatar: {
            error: true,
          },
        },
      };
      const expected = {
        name: {
          displayName: 'displayName',
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
        avatar: undefined,
        signalAccount,
        number: undefined,
      };
      const actual = contactSelector(contact, {
        regionCode,
        signalAccount,
        getAbsoluteAttachmentPath,
      });
      assert.deepEqual(actual, expected);
    });

    it('does not calculate absolute path if avatar is pending', () => {
      const contact = {
        name: {
          displayName: 'displayName',
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
        avatar: {
          isProfile: true,
          avatar: {
            pending: true,
          },
        },
      };
      const expected = {
        name: {
          displayName: 'displayName',
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
        avatar: {
          isProfile: true,
          avatar: {
            pending: true,
            path: undefined,
          },
        },
        signalAccount,
        number: undefined,
      };
      const actual = contactSelector(contact, {
        regionCode,
        signalAccount,
        getAbsoluteAttachmentPath,
      });
      assert.deepEqual(actual, expected);
    });

    it('calculates absolute path', () => {
      const contact = {
        name: {
          displayName: 'displayName',
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
        avatar: {
          isProfile: true,
          avatar: {
            path: 'somewhere',
          },
        },
      };
      const expected = {
        name: {
          displayName: 'displayName',
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
        avatar: {
          isProfile: true,
          avatar: {
            path: 'absolute:somewhere',
          },
        },
        signalAccount,
        number: undefined,
      };
      const actual = contactSelector(contact, {
        regionCode,
        signalAccount,
        getAbsoluteAttachmentPath,
      });
      assert.deepEqual(actual, expected);
    });
  });
});
