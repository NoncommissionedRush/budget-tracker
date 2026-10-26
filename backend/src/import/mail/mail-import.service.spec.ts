import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { TextReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportService } from '../import.service';
import { MAX_AUTO_ATTEMPTS, MailImportService } from './mail-import.service';
import { MailRef, Mailbox } from './mailbox';
import { rawMail } from './__fixtures__/raw-mail';

const SENDER = 'statements@bank.example';
const env: Record<string, string> = {
  IMAP_HOST: 'imap.example.com',
  IMAP_USER: 'someone@example.com',
  IMAP_PASSWORD: 'secret',
  IMAP_ALLOWED_SENDERS: SENDER,
  STATEMENT_ZIP_PASSWORD: '1234',
};

async function encryptedZip(name: string, content: string, password = '1234') {
  const writer = new ZipWriter(new Uint8ArrayWriter(), {
    password,
    zipCrypto: true,
  });
  await writer.add(name, new TextReader(content));
  return Buffer.from(await writer.close());
}

const ref = (n: number): MailRef => ({
  uid: n,
  messageId: `<m${n}@bank.example>`,
  folder: 'INBOX',
});

describe('MailImportService', () => {
  let prisma: {
    mailMessage: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };
  let importService: { importXml: jest.Mock };
  let mailbox: Record<keyof Mailbox, jest.Mock>;
  let sources: Map<number, Buffer>;
  let openMailbox: jest.Mock;

  const create = (overrides: Record<string, string> = {}) =>
    new MailImportService(
      prisma as unknown as PrismaService,
      importService as unknown as ImportService,
      openMailbox,
      {
        get: (key: string) => ({ ...env, ...overrides })[key],
      } as unknown as ConfigService,
    );

  const saved = () =>
    prisma.mailMessage.upsert.mock.calls.map(([args]) => ({
      messageId: args.where.messageId,
      status: args.create.status,
      fileCount: args.create.fileCount,
      error: args.create.error,
    }));

  beforeEach(() => {
    prisma = {
      mailMessage: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        upsert: jest.fn(({ create }) => Promise.resolve(create)),
      },
    };
    importService = {
      importXml: jest.fn().mockResolvedValue({ status: 'imported' }),
    };
    sources = new Map();
    mailbox = {
      findCandidates: jest.fn(() =>
        Promise.resolve([...sources.keys()].map(ref)),
      ),
      findByMessageId: jest.fn(),
      download: jest.fn((r: MailRef) => Promise.resolve(sources.get(r.uid)!)),
      markProcessed: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };
    openMailbox = jest.fn().mockResolvedValue(mailbox);
  });

  it('imports the XML from a password-protected ZIP attachment', async () => {
    sources.set(
      1,
      rawMail({
        messageId: '<m1@bank.example>',
        attachments: [
          {
            filename: 'V000004.zip',
            contentType: 'application/zip',
            content: await encryptedZip('V000004.xml', '<Document/>'),
          },
        ],
      }),
    );

    const result = await create().check();

    expect(result).toMatchObject({ found: 1, processed: 1, failed: 0 });
    expect(importService.importXml).toHaveBeenCalledWith(
      'V000004.xml',
      Buffer.from('<Document/>'),
      {
        source: 'EMAIL',
        messageId: '<m1@bank.example>',
        receivedAt: new Date('2026-10-26T06:00:00Z'),
      },
    );
    expect(saved()).toEqual([
      {
        messageId: '<m1@bank.example>',
        status: 'PROCESSED',
        fileCount: 1,
        error: null,
      },
    ]);
    expect(mailbox.markProcessed).toHaveBeenCalledWith(ref(1));
    expect(mailbox.close).toHaveBeenCalled();
  });

  it('searches the allowed senders within the lookback window', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-20T12:00:00Z') });
    try {
      await create({ IMAP_LOOKBACK_DAYS: '3' }).check();
    } finally {
      jest.useRealTimers();
    }
    expect(mailbox.findCandidates).toHaveBeenCalledWith(
      [SENDER],
      new Date('2026-10-17T12:00:00Z'),
    );
  });

  it('skips messages that were already handled or failed too often', async () => {
    for (const n of [1, 2, 3])
      sources.set(n, rawMail({ messageId: ref(n).messageId }));
    prisma.mailMessage.findMany.mockResolvedValue([
      { messageId: ref(1).messageId, status: 'PROCESSED', attempts: 1 },
      {
        messageId: ref(2).messageId,
        status: 'FAILED',
        attempts: MAX_AUTO_ATTEMPTS,
      },
      { messageId: ref(3).messageId, status: 'FAILED', attempts: 1 },
    ]);

    const result = await create().check();

    expect(result.found).toBe(1);
    expect(mailbox.download).toHaveBeenCalledTimes(1);
    expect(mailbox.download).toHaveBeenCalledWith(ref(3));
  });

  it('records a wrong ZIP password as a failure and leaves the email unread', async () => {
    sources.set(
      1,
      rawMail({
        attachments: [
          {
            filename: 'V000004.zip',
            contentType: 'application/zip',
            content: await encryptedZip('V000004.xml', '<Document/>', '9999'),
          },
        ],
      }),
    );

    const result = await create().check();

    expect(result).toMatchObject({ processed: 0, failed: 1 });
    expect(saved()[0]).toMatchObject({
      status: 'FAILED',
      error: 'V000004.zip: Wrong ZIP password',
    });
    expect(importService.importXml).not.toHaveBeenCalled();
    expect(mailbox.markProcessed).not.toHaveBeenCalled();
  });

  it('records parse errors per attachment and keeps importing the others', async () => {
    sources.set(
      1,
      rawMail({
        attachments: [
          {
            filename: 'a.xml',
            contentType: 'text/xml',
            content: Buffer.from('<a/>'),
          },
          {
            filename: 'b.xml',
            contentType: 'text/xml',
            content: Buffer.from('<b/>'),
          },
        ],
      }),
    );
    importService.importXml
      .mockRejectedValueOnce(
        new BadRequestException('a.xml: could not parse the XML file'),
      )
      .mockResolvedValueOnce({ status: 'imported' });

    await create().check();

    expect(importService.importXml).toHaveBeenCalledTimes(2);
    expect(saved()[0]).toMatchObject({
      status: 'FAILED',
      fileCount: 1,
      error: 'a.xml: could not parse the XML file',
    });
  });

  it('skips mail from a look-alike sender and emails without statements', async () => {
    sources.set(
      1,
      rawMail({ messageId: ref(1).messageId, from: `x${SENDER}` }),
    );
    sources.set(2, rawMail({ messageId: ref(2).messageId }));

    const result = await create().check();

    expect(result).toMatchObject({ processed: 0, skipped: 2 });
    expect(saved().map((s) => s.error)).toEqual([
      `Sender x${SENDER} is not allow-listed`,
      'No XML or ZIP attachment',
    ]);
    expect(importService.importXml).not.toHaveBeenCalled();
    expect(mailbox.markProcessed).toHaveBeenCalledTimes(2);
  });

  it('shares one run between concurrent checks', async () => {
    const service = create();
    const [a, b] = await Promise.all([service.check(), service.check()]);
    expect(a).toBe(b);
    expect(openMailbox).toHaveBeenCalledTimes(1);
  });

  it('reports a connection failure and stays usable', async () => {
    openMailbox.mockRejectedValueOnce(new Error('Invalid credentials'));
    const service = create();

    await expect(service.check()).rejects.toThrow(
      'Mailbox check failed: Invalid credentials',
    );
    expect(service.status()).toMatchObject({
      running: false,
      lastCheck: { error: 'Invalid credentials' },
    });
    await expect(service.check()).resolves.toMatchObject({ error: null });
  });

  it('is disabled without IMAP settings', async () => {
    const service = create({ IMAP_HOST: '' });
    expect(service.enabled).toBe(false);
    await service.scheduledCheck();
    expect(openMailbox).not.toHaveBeenCalled();
    expect(() => service.check()).toThrow('not configured');
  });

  describe('rerun', () => {
    const record = {
      id: 'mail-1',
      messageId: '<m1@bank.example>',
      folder: 'INBOX',
      status: 'FAILED',
    };

    it('fetches the message again by Message-ID and imports it', async () => {
      prisma.mailMessage.findUnique.mockResolvedValue(record);
      mailbox.findByMessageId.mockResolvedValue(ref(1));
      sources.set(
        1,
        rawMail({
          attachments: [
            {
              filename: 'a.xml',
              contentType: 'text/xml',
              content: Buffer.from('<a/>'),
            },
          ],
        }),
      );

      const result = await create().rerun('mail-1');

      expect(mailbox.findByMessageId).toHaveBeenCalledWith('<m1@bank.example>');
      expect(result).toMatchObject({ status: 'PROCESSED', fileCount: 1 });
      expect(prisma.mailMessage.upsert.mock.calls[0][0].update).toMatchObject({
        attempts: { increment: 1 },
      });
    });

    it('records that the message is gone from the mailbox', async () => {
      prisma.mailMessage.findUnique.mockResolvedValue(record);
      mailbox.findByMessageId.mockResolvedValue(null);

      const result = await create().rerun('mail-1');

      expect(result).toMatchObject({
        status: 'FAILED',
        error: 'The message is no longer in the mailbox',
      });
      expect(mailbox.close).toHaveBeenCalled();
    });

    it('404s for an unknown record', async () => {
      prisma.mailMessage.findUnique.mockResolvedValue(null);
      await expect(create().rerun('nope')).rejects.toThrow('not found');
      expect(openMailbox).not.toHaveBeenCalled();
    });
  });
});
