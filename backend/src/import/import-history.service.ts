import { Injectable, NotFoundException } from '@nestjs/common';
import { BankTransactionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CategorizationService } from '../categorization/categorization.service';

const HISTORY_LIMIT = 50;

@Injectable()
export class ImportHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categorization: CategorizationService,
  ) {}

  /** Recent batches with how their transactions stand today. */
  async batches() {
    const batches = await this.prisma.importBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
    });
    const counts = await this.prisma.bankTransaction.groupBy({
      by: ['importBatchId', 'status'],
      where: { importBatchId: { in: batches.map((b) => b.id) } },
      _count: { _all: true },
    });
    const byBatch = new Map<string, Record<BankTransactionStatus, number>>();
    for (const c of counts) {
      const entry = byBatch.get(c.importBatchId) ?? {
        CATEGORIZED: 0,
        NEEDS_REVIEW: 0,
        IGNORED: 0,
      };
      entry[c.status] = c._count._all;
      byBatch.set(c.importBatchId, entry);
    }
    return batches.map((b) => {
      const current = byBatch.get(b.id);
      return {
        id: b.id,
        source: b.source,
        fileName: b.fileName,
        format: b.format,
        messageId: b.messageId,
        createdAt: b.createdAt,
        totalCount: b.totalCount,
        importedCount: b.importedCount,
        duplicateCount: b.duplicateCount,
        errorCount: b.errorCount,
        errors: b.errors,
        categorizedCount: current?.CATEGORIZED ?? 0,
        needsReviewCount: current?.NEEDS_REVIEW ?? 0,
        ignoredCount: current?.IGNORED ?? 0,
      };
    });
  }

  mailMessages() {
    return this.prisma.mailMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
    });
  }

  /** Runs the categorization pipeline again over a batch's unreviewed transactions. */
  async recategorize(batchId: string) {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch)
      throw new NotFoundException(`Import batch ${batchId} not found`);
    return this.categorization.categorizePending({ importBatchId: batchId });
  }
}
