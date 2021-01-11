import { assert } from 'chai';

import * as Message from '../../../../ts/types/message/initializeAttachmentMetadata';
import { IncomingMessage } from '../../../../ts/types/Message';
import { SignalService } from '../../../../ts/protobuf';
import * as MIME from '../../../../ts/types/MIME';
// @ts-ignore
import { stringToArrayBuffer } from '../../../../js/modules/string_to_array_buffer';

describe('Message', () => {
  describe('initializeAttachmentMetadata', () => {
    it('should classify visual media attachments', async () => {
      const input: IncomingMessage = {
        type: 'incoming',
        conversationId: 'foo',
        id: '11111111-1111-1111-1111-111111111111',
        timestamp: 1523317140899,
        received_at: 1523317140899,
        sent_at: 1523317140800,
        attachments: [
          {
            contentType: MIME.IMAGE_JPEG,
            data: stringToArrayBuffer('foo'),
            fileName: 'foo.jpg',
            size: 1111,
          },
        ],
      };
      const expected: IncomingMessage = {
        type: 'incoming',
        conversationId: 'foo',
        id: '11111111-1111-1111-1111-111111111111',
        timestamp: 1523317140899,
        received_at: 1523317140899,
        sent_at: 1523317140800,
        attachments: [
          {
            contentType: MIME.IMAGE_JPEG,
            data: stringToArrayBuffer('foo'),
            fileName: 'foo.jpg',
            size: 1111,
          },
        ],
        hasAttachments: 1,
        hasVisualMediaAttachments: 1,
        hasFileAttachments: undefined,
      };

      const actual = await Message.initializeAttachmentMetadata(input);
      assert.deepEqual(actual, expected);
    });

    it('should classify file attachments', async () => {
      const input: IncomingMessage = {
        type: 'incoming',
        conversationId: 'foo',
        id: '11111111-1111-1111-1111-111111111111',
        timestamp: 1523317140899,
        received_at: 1523317140899,
        sent_at: 1523317140800,
        attachments: [
          {
            contentType: MIME.APPLICATION_OCTET_STREAM,
            data: stringToArrayBuffer('foo'),
            fileName: 'foo.bin',
            size: 1111,
          },
        ],
      };
      const expected: IncomingMessage = {
        type: 'incoming',
        conversationId: 'foo',
        id: '11111111-1111-1111-1111-111111111111',
        timestamp: 1523317140899,
        received_at: 1523317140899,
        sent_at: 1523317140800,
        attachments: [
          {
            contentType: MIME.APPLICATION_OCTET_STREAM,
            data: stringToArrayBuffer('foo'),
            fileName: 'foo.bin',
            size: 1111,
          },
        ],
        hasAttachments: 1,
        hasVisualMediaAttachments: undefined,
        hasFileAttachments: 1,
      };

      const actual = await Message.initializeAttachmentMetadata(input);
      assert.deepEqual(actual, expected);
    });

    it('should classify voice message attachments', async () => {
      const input: IncomingMessage = {
        type: 'incoming',
        conversationId: 'foo',
        id: '11111111-1111-1111-1111-111111111111',
        timestamp: 1523317140899,
        received_at: 1523317140899,
        sent_at: 1523317140800,
        attachments: [
          {
            contentType: MIME.AUDIO_AAC,
            flags: SignalService.AttachmentPointer.Flags.VOICE_MESSAGE,
            data: stringToArrayBuffer('foo'),
            fileName: 'Voice Message.aac',
            size: 1111,
          },
        ],
      };
      const expected: IncomingMessage = {
        type: 'incoming',
        conversationId: 'foo',
        id: '11111111-1111-1111-1111-111111111111',
        timestamp: 1523317140899,
        received_at: 1523317140899,
        sent_at: 1523317140800,
        attachments: [
          {
            contentType: MIME.AUDIO_AAC,
            flags: SignalService.AttachmentPointer.Flags.VOICE_MESSAGE,
            data: stringToArrayBuffer('foo'),
            fileName: 'Voice Message.aac',
            size: 1111,
          },
        ],
        hasAttachments: 1,
        hasVisualMediaAttachments: undefined,
        hasFileAttachments: undefined,
      };

      const actual = await Message.initializeAttachmentMetadata(input);
      assert.deepEqual(actual, expected);
    });

    it('does not include long message attachments', async () => {
      const input: IncomingMessage = {
        type: 'incoming',
        conversationId: 'foo',
        id: '11111111-1111-1111-1111-111111111111',
        timestamp: 1523317140899,
        received_at: 1523317140899,
        sent_at: 1523317140800,
        attachments: [
          {
            contentType: MIME.LONG_MESSAGE,
            data: stringToArrayBuffer('foo'),
            fileName: 'message.txt',
            size: 1111,
          },
        ],
      };
      const expected: IncomingMessage = {
        type: 'incoming',
        conversationId: 'foo',
        id: '11111111-1111-1111-1111-111111111111',
        timestamp: 1523317140899,
        received_at: 1523317140899,
        sent_at: 1523317140800,
        attachments: [
          {
            contentType: MIME.LONG_MESSAGE,
            data: stringToArrayBuffer('foo'),
            fileName: 'message.txt',
            size: 1111,
          },
        ],
        hasAttachments: 0,
        hasVisualMediaAttachments: undefined,
        hasFileAttachments: undefined,
      };

      const actual = await Message.initializeAttachmentMetadata(input);
      assert.deepEqual(actual, expected);
    });

    it('handles not attachments', async () => {
      const input: IncomingMessage = {
        type: 'incoming',
        conversationId: 'foo',
        id: '11111111-1111-1111-1111-111111111111',
        timestamp: 1523317140899,
        received_at: 1523317140899,
        sent_at: 1523317140800,
        attachments: [],
      };
      const expected: IncomingMessage = {
        type: 'incoming',
        conversationId: 'foo',
        id: '11111111-1111-1111-1111-111111111111',
        timestamp: 1523317140899,
        received_at: 1523317140899,
        sent_at: 1523317140800,
        attachments: [],
        hasAttachments: 0,
        hasVisualMediaAttachments: undefined,
        hasFileAttachments: undefined,
      };

      const actual = await Message.initializeAttachmentMetadata(input);
      assert.deepEqual(actual, expected);
    });
  });
});
