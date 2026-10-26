import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { TextReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js';
import { PrismaService } from '../prisma/prisma.service';
import { CategorizationService } from '../categorization/categorization.service';
import { ImportService } from './import.service';

const fixture = readFileSync(
  join(__dirname, 'parsers/__fixtures__/camt053-synthetic.xml'),
);
const OWN = 'SK0099000000000000000001';

describe('ImportService', () => {
  let prisma: {
    importBatch: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    bankTransaction: { findMany: jest.Mock; createMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let categorization: { categorizePending: jest.Mock };
  let service: ImportService;

  beforeEach(() => {
    prisma = {
      importBatch: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(({ data }) =>
          Promise.resolve({ id: 'batch-1', ...data }),
        ),
        update: jest.fn(),
      },
      bankTransaction: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    const config = {
      get: () => 'SK00 9900 0000 0000 0000 0003',
    } as unknown as ConfigService;
    categorization = {
      categorizePending: jest
        .fn()
        .mockResolvedValue({ categorized: 0, ignored: 0, remaining: 4 }),
    };
    service = new ImportService(
      prisma as unknown as PrismaService,
      categorization as unknown as CategorizationService,
      config,
    );
  });

  const rows = () => prisma.bankTransaction.createMany.mock.calls[0][0].data;
  const statusOf = (ref: string) =>
    rows().find((r: any) => r.bankTransactionId === `${OWN}:${ref}`);

  it('stores every transaction with its status and records the batch', async () => {
    const result = await service.importUpload('statement.xml', fixture);

    expect(result.files).toEqual([
      expect.objectContaining({
        fileName: 'statement.xml',
        status: 'imported',
        batchId: 'batch-1',
        format: 'camt.053.001.02',
        totalCount: 8,
        importedCount: 8,
        duplicateCount: 0,
        ignoredCount: 4,
        needsReviewCount: 4,
        errors: [expect.objectContaining({ entryRef: '1000000009' })],
      }),
    ]);
    expect(prisma.importBatch.create.mock.calls[0][0].data).toMatchObject({
      source: 'UPLOAD',
      fileHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      accountIban: OWN,
      errorCount: 1,
    });
    expect(rows()).toHaveLength(8);
    expect(rows().every((r: any) => r.importBatchId === 'batch-1')).toBe(true);
  });

  it('categorizes the new transactions and reports what is left for review', async () => {
    categorization.categorizePending.mockResolvedValue({
      categorized: 2,
      ignored: 1,
      remaining: 1,
    });
    const { files } = await service.importUpload('statement.xml', fixture);
    expect(categorization.categorizePending).toHaveBeenCalledWith({
      importBatchId: 'batch-1',
    });
    expect(files[0]).toMatchObject({
      categorizedCount: 2,
      ignoredCount: 5,
      needsReviewCount: 1,
    });
    expect(prisma.importBatch.update).toHaveBeenCalledWith({
      where: { id: 'batch-1' },
      data: { ignoredCount: 5 },
    });
  });

  it('keeps the import when categorization fails', async () => {
    categorization.categorizePending.mockRejectedValue(new Error('boom'));
    const { files } = await service.importUpload('statement.xml', fixture);
    expect(files[0]).toMatchObject({
      status: 'imported',
      categorizedCount: 0,
      needsReviewCount: 4,
    });
  });

  it('marks credits, reversals and own transfers ignored and debits for review', async () => {
    await service.importUpload('statement.xml', fixture);
    expect(statusOf('1000000001')).toMatchObject({
      status: 'NEEDS_REVIEW',
      ignoreReason: null,
    });
    expect(statusOf('1000000004')).toMatchObject({ status: 'NEEDS_REVIEW' });
    expect(statusOf('1000000003')).toMatchObject({
      status: 'IGNORED',
      ignoreReason: 'own_transfer',
    });
    expect(statusOf('1000000006')).toMatchObject({
      status: 'IGNORED',
      ignoreReason: 'own_transfer',
    });
    expect(statusOf('1000000008')).toMatchObject({
      status: 'IGNORED',
      ignoreReason: 'reversal',
    });
    expect(statusOf('1000000010')).toMatchObject({
      status: 'IGNORED',
      ignoreReason: 'credit',
    });
  });

  it('stores dates as UTC-midnight calendar days', async () => {
    await service.importUpload('statement.xml', fixture);
    const card = statusOf('1000000004');
    expect(card.bookingDate.toISOString()).toBe('2026-10-25T00:00:00.000Z');
    expect(card.transactionDate.toISOString()).toBe('2026-10-24T00:00:00.000Z');
  });

  it('skips transactions that were already imported', async () => {
    prisma.bankTransaction.findMany.mockResolvedValue([
      { bankTransactionId: `${OWN}:1000000001` },
      { bankTransactionId: `${OWN}:1000000004` },
    ]);
    const { files } = await service.importUpload('statement.xml', fixture);
    expect(files[0]).toMatchObject({ importedCount: 6, duplicateCount: 2 });
    expect(rows()).toHaveLength(6);
    expect(statusOf('1000000001')).toBeUndefined();
  });

  it('skips a file whose hash was already imported', async () => {
    prisma.importBatch.findUnique.mockResolvedValue({
      id: 'old-batch',
      format: 'camt.053.001.02',
      totalCount: 8,
      importedCount: 8,
      duplicateCount: 0,
      ignoredCount: 4,
      errors: [],
    });
    const { files } = await service.importUpload('statement.xml', fixture);
    expect(files[0]).toMatchObject({
      status: 'duplicate_file',
      batchId: 'old-batch',
      importedCount: 0,
      duplicateCount: 8,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('imports each XML inside a password-protected ZIP', async () => {
    const writer = new ZipWriter(new Uint8ArrayWriter(), {
      password: '1234',
      zipCrypto: true,
    });
    await writer.add('V000004.xml', new TextReader(fixture.toString()));
    const archive = Buffer.from(await writer.close());

    const { files } = await service.importUpload(
      'statement.zip',
      archive,
      '1234',
    );
    expect(files).toEqual([
      expect.objectContaining({ fileName: 'V000004.xml', status: 'imported' }),
    ]);
  });

  it('rejects files it cannot parse', async () => {
    await expect(
      service.importUpload('x.xml', Buffer.from('<foo/>')),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.importUpload('x.xml', Buffer.from('not xml')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
