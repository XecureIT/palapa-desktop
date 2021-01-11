const { assert } = require('chai');

const {
  findLinks,
  getTitleMetaTag,
  getImageMetaTag,
  isLinkInWhitelist,
  isLinkSneaky,
  isMediaLinkInWhitelist,
} = require('../../js/modules/link_previews');

describe('Link previews', () => {
  describe('#isLinkInWhitelist', () => {
    it('returns true for valid links', () => {
      assert.strictEqual(isLinkInWhitelist('https://youtube.com/blah'), true);
      assert.strictEqual(
        isLinkInWhitelist('https://www.youtube.com/blah'),
        true
      );
      assert.strictEqual(isLinkInWhitelist('https://m.youtube.com/blah'), true);
      assert.strictEqual(isLinkInWhitelist('https://youtu.be/blah'), true);
      assert.strictEqual(isLinkInWhitelist('https://reddit.com/blah'), true);
      assert.strictEqual(
        isLinkInWhitelist('https://www.reddit.com/blah'),
        true
      );
      assert.strictEqual(isLinkInWhitelist('https://m.reddit.com/blah'), true);
      assert.strictEqual(isLinkInWhitelist('https://imgur.com/blah'), true);
      assert.strictEqual(isLinkInWhitelist('https://www.imgur.com/blah'), true);
      assert.strictEqual(isLinkInWhitelist('https://m.imgur.com/blah'), true);
      assert.strictEqual(isLinkInWhitelist('https://instagram.com/blah'), true);
      assert.strictEqual(
        isLinkInWhitelist('https://www.instagram.com/blah'),
        true
      );
      assert.strictEqual(
        isLinkInWhitelist('https://m.instagram.com/blah'),
        true
      );
      assert.strictEqual(isLinkInWhitelist('https://pinterest.com/blah'), true);
      assert.strictEqual(
        isLinkInWhitelist('https://www.pinterest.com/blah'),
        true
      );
      assert.strictEqual(isLinkInWhitelist('https://pin.it/blah'), true);
    });

    it('returns false for subdomains', () => {
      assert.strictEqual(
        isLinkInWhitelist('https://any.subdomain.youtube.com/blah'),
        false
      );
      assert.strictEqual(
        isLinkInWhitelist('https://any.subdomain.instagram.com/blah'),
        false
      );
    });

    it('returns false for http links', () => {
      assert.strictEqual(isLinkInWhitelist('http://instagram.com/blah'), false);
      assert.strictEqual(isLinkInWhitelist('http://youtube.com/blah'), false);
    });

    it('returns false for links with no protocol', () => {
      assert.strictEqual(isLinkInWhitelist('instagram.com/blah'), false);
      assert.strictEqual(isLinkInWhitelist('youtube.com/blah'), false);
    });

    it('returns false for link to root path', () => {
      assert.strictEqual(isLinkInWhitelist('https://instagram.com'), false);
      assert.strictEqual(isLinkInWhitelist('https://youtube.com'), false);

      assert.strictEqual(isLinkInWhitelist('https://instagram.com/'), false);
      assert.strictEqual(isLinkInWhitelist('https://youtube.com/'), false);
    });

    it('returns false for other well-known sites', () => {
      assert.strictEqual(isLinkInWhitelist('https://facebook.com/blah'), false);
      assert.strictEqual(isLinkInWhitelist('https://twitter.com/blah'), false);
    });

    it('returns false for links that look like our target links', () => {
      assert.strictEqual(
        isLinkInWhitelist('https://evil.site.com/.instagram.com/blah'),
        false
      );
      assert.strictEqual(
        isLinkInWhitelist('https://evil.site.com/.instagram.com/blah'),
        false
      );
      assert.strictEqual(
        isLinkInWhitelist('https://sinstagram.com/blah'),
        false
      );
    });
  });

  describe('#isMediaLinkInWhitelist', () => {
    it('returns true for valid links', () => {
      assert.strictEqual(
        isMediaLinkInWhitelist(
          'https://i.ytimg.com/vi/bZHShcCEH3I/hqdefault.jpg'
        ),
        true
      );
      assert.strictEqual(
        isMediaLinkInWhitelist('https://random.cdninstagram.com/blah'),
        true
      );
      assert.strictEqual(
        isMediaLinkInWhitelist('https://preview.redd.it/something'),
        true
      );
      assert.strictEqual(
        isMediaLinkInWhitelist('https://i.imgur.com/something'),
        true
      );
      assert.strictEqual(
        isMediaLinkInWhitelist('https://pinimg.com/something'),
        true
      );
    });

    it('returns false for insecure protocol', () => {
      assert.strictEqual(
        isMediaLinkInWhitelist(
          'http://i.ytimg.com/vi/bZHShcCEH3I/hqdefault.jpg'
        ),
        false
      );
      assert.strictEqual(
        isMediaLinkInWhitelist('http://random.cdninstagram.com/blah'),
        false
      );
      assert.strictEqual(
        isMediaLinkInWhitelist('http://preview.redd.it/something'),
        false
      );
      assert.strictEqual(
        isMediaLinkInWhitelist('http://i.imgur.com/something'),
        false
      );
      assert.strictEqual(
        isMediaLinkInWhitelist('http://pinimg.com/something'),
        false
      );
    });

    it('returns false for other domains', () => {
      assert.strictEqual(
        isMediaLinkInWhitelist('https://www.youtube.com/something'),
        false
      );
      assert.strictEqual(
        isMediaLinkInWhitelist('https://youtu.be/something'),
        false
      );
      assert.strictEqual(
        isMediaLinkInWhitelist('https://www.instagram.com/something'),
        false
      );
      assert.strictEqual(
        isMediaLinkInWhitelist('https://cnn.com/something'),
        false
      );
    });
  });

  describe('#_getMetaTag', () => {
    it('returns html-decoded tag contents from Youtube', () => {
      const youtube = `
        <meta property="og:site_name" content="YouTube">
        <meta property="og:url" content="https://www.youtube.com/watch?v=tP-Ipsat90c">
        <meta property="og:type" content="video.other">
        <meta property="og:title" content="Randomness is Random - Numberphile">
        <meta property="og:image" content="https://i.ytimg.com/vi/tP-Ipsat90c/maxresdefault.jpg">
      `;

      assert.strictEqual(
        'Randomness is Random - Numberphile',
        getTitleMetaTag(youtube)
      );
      assert.strictEqual(
        'https://i.ytimg.com/vi/tP-Ipsat90c/maxresdefault.jpg',
        getImageMetaTag(youtube)
      );
    });

    it('returns html-decoded tag contents from Instagram', () => {
      const instagram = `
        <meta property="og:site_name" content="Instagram" />
        <meta property="og:url" content="https://www.instagram.com/p/BrgpsUjF9Jo/" />
        <meta property="og:type" content="instapp:photo" />
        <meta property="og:title" content="Walter &#34;MFPallytime&#34; on Instagram: “Lol gg”" />
        <meta property="og:description" content="632 Likes, 56 Comments - Walter &#34;MFPallytime&#34; (@mfpallytime) on Instagram: “Lol gg    ”" />
<meta property="og:image" content="https://scontent-lax3-1.cdninstagram.com/vp/1c69aa381c2201720c29a6c28de42ffd/5CD49B5B/t51.2885-15/e35/47690175_2275988962411653_1145978227188801192_n.jpg?_nc_ht=scontent-lax3-1.cdninstagram.com" />
      `;

      assert.strictEqual(
        'Walter "MFPallytime" on Instagram: “Lol gg”',
        getTitleMetaTag(instagram)
      );
      assert.strictEqual(
        'https://scontent-lax3-1.cdninstagram.com/vp/1c69aa381c2201720c29a6c28de42ffd/5CD49B5B/t51.2885-15/e35/47690175_2275988962411653_1145978227188801192_n.jpg?_nc_ht=scontent-lax3-1.cdninstagram.com',
        getImageMetaTag(instagram)
      );
    });

    it('returns html-decoded tag contents from Imgur', () => {
      const imgur = `
        <meta property="og:site_name" content="Imgur">
        <meta property="og:url" content="https://imgur.com/gallery/KFCL8fm">
        <meta property="og:type" content="article">
        <meta property="og:title" content="&nbsp;">
        <meta property="og:description" content="13246 views and 482 votes on Imgur">
        <meta property="og:image" content="https://i.imgur.com/Y3wjlwY.jpg?fb">
        <meta property="og:image:width" content="600">
        <meta property="og:image:height" content="315">
      `;

      assert.strictEqual('', getTitleMetaTag(imgur));
      assert.strictEqual(
        'https://i.imgur.com/Y3wjlwY.jpg?fb',
        getImageMetaTag(imgur)
      );
    });

    it('returns html-decoded tag contents from Pinterest', () => {
      const pinterest = `
        <meta property="og:image" name="og:image" content="https://i.pinimg.com/736x/9a/9e/64/9a9e64ed6b42b0a0e480dded4579d940--yard-sale-mulches.jpg" data-app>
        <meta property="og:image:height" name="og:image:height" content="200" data-app>
        <meta property="og:image:width" name="og:image:width" content="300" data-app>
        <meta property="og:title" name="og:title" content="Inexpensive Landscaping Ideas" data-app>
        <meta property="og:type" name="og:type" content="pinterestapp:pin" data-app>
        <meta property="og:url" name="og:url" content="https://www.pinterest.com/pin/3166662212807634/" data-app>
      `;

      assert.strictEqual(
        'Inexpensive Landscaping Ideas',
        getTitleMetaTag(pinterest)
      );
      assert.strictEqual(
        'https://i.pinimg.com/736x/9a/9e/64/9a9e64ed6b42b0a0e480dded4579d940--yard-sale-mulches.jpg',
        getImageMetaTag(pinterest)
      );
    });

    it('returns only the first tag', () => {
      const html = `
        <meta property="og:title" content="First&nbsp;Second&nbsp;Third"><meta property="og:title" content="Fourth&nbsp;Fifth&nbsp;Sixth">
      `;

      assert.strictEqual('First Second Third', getTitleMetaTag(html));
    });

    it('handles a newline in attribute value', () => {
      const html = `
        <meta property="og:title" content="First thing\r\nSecond thing\nThird thing">
      `;

      assert.strictEqual(
        'First thing\r\nSecond thing\nThird thing',
        getTitleMetaTag(html)
      );
    });
  });

  describe('#findLinks', () => {
    it('returns all links if no caretLocation is provided', () => {
      const text =
        'Check out this link: https://github.com/signalapp/Signal-Desktop\nAnd this one too: https://github.com/signalapp/Signal-Android';

      const expected = [
        'https://github.com/signalapp/Signal-Desktop',
        'https://github.com/signalapp/Signal-Android',
      ];

      const actual = findLinks(text);
      assert.deepEqual(expected, actual);
    });

    it('includes all links if cursor is not in a link', () => {
      const text =
        'Check out this link: https://github.com/signalapp/Signal-Desktop\nAnd this one too: https://github.com/signalapp/Signal-Android';
      const caretLocation = 10;

      const expected = [
        'https://github.com/signalapp/Signal-Desktop',
        'https://github.com/signalapp/Signal-Android',
      ];

      const actual = findLinks(text, caretLocation);
      assert.deepEqual(expected, actual);
    });

    it('excludes a link not at the end if the caret is inside of it', () => {
      const text =
        'Check out this link: https://github.com/signalapp/Signal-Desktop\nAnd this one too: https://github.com/signalapp/Signal-Android';
      const caretLocation = 30;

      const expected = ['https://github.com/signalapp/Signal-Android'];

      const actual = findLinks(text, caretLocation);
      assert.deepEqual(expected, actual);
    });

    it('excludes a link not at the end if the caret is at its end', () => {
      const text =
        'Check out this link: https://github.com/signalapp/Signal-Desktop\nAnd this one too: https://github.com/signalapp/Signal-Android';
      const caretLocation = 64;

      const expected = ['https://github.com/signalapp/Signal-Android'];

      const actual = findLinks(text, caretLocation);
      assert.deepEqual(expected, actual);
    });

    it('excludes a link at the end of the caret is inside of it', () => {
      const text =
        'Check out this link: https://github.com/signalapp/Signal-Desktop\nAnd this one too: https://github.com/signalapp/Signal-Android';
      const caretLocation = 100;

      const expected = ['https://github.com/signalapp/Signal-Desktop'];

      const actual = findLinks(text, caretLocation);
      assert.deepEqual(expected, actual);
    });

    it('includes link at the end if cursor is at its end', () => {
      const text =
        'Check out this link: https://github.com/signalapp/Signal-Desktop\nAnd this one too: https://github.com/signalapp/Signal-Android';
      const caretLocation = text.length;

      const expected = [
        'https://github.com/signalapp/Signal-Desktop',
        'https://github.com/signalapp/Signal-Android',
      ];

      const actual = findLinks(text, caretLocation);
      assert.deepEqual(expected, actual);
    });
  });

  describe('#isLinkSneaky', () => {
    it('returns false for all-latin domain', () => {
      const link = 'https://www.amazon.com';
      const actual = isLinkSneaky(link);
      assert.strictEqual(actual, false);
    });

    it('returns true for Latin + Cyrillic domain', () => {
      const link = 'https://www.aмazon.com';
      const actual = isLinkSneaky(link);
      assert.strictEqual(actual, true);
    });

    it('returns true for Latin + Greek domain', () => {
      const link = 'https://www.αpple.com';
      const actual = isLinkSneaky(link);
      assert.strictEqual(actual, true);
    });

    it('returns true for ASCII and non-ASCII mix', () => {
      const link = 'https://www.аррӏе.com';
      const actual = isLinkSneaky(link);
      assert.strictEqual(actual, true);
    });

    it('returns true for Latin + High Greek domain', () => {
      const link = `https://www.apple${String.fromCodePoint(0x101a0)}.com`;
      const actual = isLinkSneaky(link);
      assert.strictEqual(actual, true);
    });

    it('returns true for =', () => {
      const link = 'r.id=s.id';
      assert.strictEqual(isLinkSneaky(link), true);
    });

    it('returns true for $', () => {
      const link = 'r.id$s.id';
      assert.strictEqual(isLinkSneaky(link), true);
    });

    it('returns true for +', () => {
      const link = 'r.id+s.id';
      assert.strictEqual(isLinkSneaky(link), true);
    });

    it('returns true for ^', () => {
      const link = 'r.id^s.id';
      assert.strictEqual(isLinkSneaky(link), true);
    });
  });
});
