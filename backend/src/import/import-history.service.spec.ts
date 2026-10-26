import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CategorizationService } from '../categorization/categorization.service';
import { ImportHistoryService } from './import-history.service';

describe('ImportHistoryService', () => {
  let prisma: {
    importBatch: { findMany: jest.Mock; findUnique: jest.Mock };
    bankTransaction: { groupBy: jest.Mock };
  };
  let categorization: { categorizePending: jest.Mock };
  let service: ImportHistoryService;

  beforeEach(() => {
    prisma = {
      importBatch: { findMany: jest.fn(), findUnique: jest.fn() },
      bankTransaction: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    categorization = { categorizePending: jest.fn() };
    service = new ImportHistoryService(
      prisma as unknown as PrismaService,
      categorization as unknown as CategorizationService,
    );
  });

  it('lists batches with their current transaction status counts', async () => {
    prisma.importBatch.findMany.mockResolvedValue([
      { id: 'b1', source: 'EMAIL', totalCount: 5, ignoredCount: 1, errors: [] },
      {
        id: 'b2',
        source: 'UPLOAD',
        totalCount: 0,
        ignoredCount: 0,
        errors: [],
      },
    ]);
    prisma.bankTransaction.groupBy.mockResolvedValue([
      { importBatchId: 'b1', status: 'CATEGORIZED', _count: { _all: 3 } },
      { importBatchId: 'b1', status: 'IGNORED', _count: { _all: 2 } },
    ]);

    const batches = await service.batches();

    expect(prisma.bankTransaction.groupBy.mock.calls[0][0].where).toEqual({
      importBatchId: { in: ['b1', 'b2'] },
    });
    expect(batches[0]).toMatchObject({
      id: 'b1',
      source: 'EMAIL',
      categorizedCount: 3,
      needsReviewCount: 0,
      ignoredCount: 2,
    });
    expect(batches[1]).toMatchObject({
      categorizedCount: 0,
      needsReviewCount: 0,
      ignoredCount: 0,
    });
  });

  it("re-runs categorization on a batch's pending transactions", async () => {
    prisma.importBatch.findUnique.mockResolvedValue({ id: 'b1' });
    categorization.categorizePending.mockResolvedValue({
      categorized: 2,
      ignored: 0,
      remaining: 1,
    });

    await expect(service.recategorize('b1')).resolves.toEqual({
      categorized: 2,
      ignored: 0,
      remaining: 1,
    });
    expect(categorization.categorizePending).toHaveBeenCalledWith({
      importBatchId: 'b1',
    });
  });

  it('404s for an unknown batch', async () => {
    prisma.importBatch.findUnique.mockResolvedValue(null);
    await expect(service.recategorize('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
