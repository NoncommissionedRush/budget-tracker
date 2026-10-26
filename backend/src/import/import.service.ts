import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImportSource, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { parseDateOnly } from '../common/date-only';
import { extractXmlFiles } from './archive';
import { classify, parseIbanList } from './classify';
import {
  ParsedStatement,
  UnsupportedFormatError,
  parseStatement,
} from './parsers';

export interface ImportFileResult {
  fileName: string;
  status: 'imported' | 'duplicate_file';
  batchId: string;
  format: string;
  totalCount: number;
  importedCount: number;
  duplicateCount: number;
  ignoredCount: number;
  needsReviewCount: number;
  errors: Prisma.JsonValue;
}

export interface ImportOptions {
  source: ImportSource;
  messageId?: string;
  receivedAt?: Date;
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);
  private readonly ownIbans: string[];

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.ownIbans = parseIbanList(config.get<string>('OWN_IBANS'));
  }

  async importUpload(name: string, content: Buffer, password?: string) {
    const files = await extractXmlFiles(name, content, password);
    const results: ImportFileResult[] = [];
    for (const file of files) {
      results.push(
        await this.importXml(file.name, file.content, { source: 'UPLOAD' }),
      );
    }
    return { files: results };
  }

  async importXml(
    fileName: string,
    content: Buffer,
    options: ImportOptions,
  ): Promise<ImportFileResult> {
    const fileHash = createHash('sha256').update(content).digest('hex');
    const existing = await this.prisma.importBatch.findUnique({
      where: { fileHash },
    });
    if (existing) {
      return {
        ...this.summary(fileName, existing),
        status: 'duplicate_file',
        importedCount: 0,
        duplicateCount: existing.totalCount,
        ignoredCount: 0,
        needsReviewCount: 0,
      };
    }

    const statement = this.parse(fileName, content);
    const own = {
      ibans: new Set([
        ...this.ownIbans,
        ...(statement.accountIban ? [statement.accountIban] : []),
      ]),
      ownerName: statement.accountOwnerName,
    };

    const unique = new Map(
      statement.transactions.map((t) => [t.bankTransactionId, t]),
    );
    const known = await this.prisma.bankTransaction.findMany({
      where: { bankTransactionId: { in: [...unique.keys()] } },
      select: { bankTransactionId: true },
    });
    for (const { bankTransactionId } of known) unique.delete(bankTransactionId);

    const rows = [...unique.values()].map((t) => {
      const { status, ignoreReason } = classify(t, own);
      return {
        bankTransactionId: t.bankTransactionId,
        accountIban: t.accountIban,
        bookingDate: parseDateOnly(t.bookingDate),
        valueDate: t.valueDate ? parseDateOnly(t.valueDate) : null,
        transactionDate: t.transactionDate
          ? parseDateOnly(t.transactionDate)
          : null,
        amount: t.amount,
        currency: t.currency,
        direction: t.direction,
        counterpartyName: t.counterpartyName,
        counterpartyIban: t.counterpartyIban,
        variableSymbol: t.variableSymbol,
        constantSymbol: t.constantSymbol,
        specificSymbol: t.specificSymbol,
        description: t.description,
        bankTxCode: t.bankTxCode,
        status,
        ignoreReason,
      };
    });
    const ignoredCount = rows.filter((r) => r.status === 'IGNORED').length;

    const batch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.importBatch.create({
        data: {
          source: options.source,
          messageId: options.messageId,
          receivedAt: options.receivedAt,
          fileName,
          fileHash,
          format: statement.format,
          statementId: statement.statementId,
          accountIban: statement.accountIban,
          totalCount: statement.transactions.length,
          importedCount: rows.length,
          duplicateCount: statement.transactions.length - rows.length,
          ignoredCount,
          errorCount: statement.errors.length,
          errors: statement.errors as unknown as Prisma.InputJsonValue,
        },
      });
      if (rows.length > 0) {
        await tx.bankTransaction.createMany({
          data: rows.map((r) => ({ ...r, importBatchId: created.id })),
        });
      }
      return created;
    });

    this.logger.log(
      `Imported ${fileName} (${statement.format}): ${rows.length} new, ` +
        `${batch.duplicateCount} duplicates, ${ignoredCount} ignored, ${statement.errors.length} errors`,
    );

    return {
      ...this.summary(fileName, batch),
      status: 'imported',
      needsReviewCount: rows.length - ignoredCount,
    };
  }

  private parse(fileName: string, content: Buffer): ParsedStatement {
    try {
      return parseStatement(content.toString('utf8'));
    } catch (e) {
      if (e instanceof UnsupportedFormatError) {
        throw new BadRequestException(`${fileName}: ${e.message}`);
      }
      throw new BadRequestException(
        `${fileName}: could not parse the XML file`,
      );
    }
  }

  private summary(
    fileName: string,
    batch: Prisma.ImportBatchGetPayload<object>,
  ): Omit<ImportFileResult, 'status' | 'needsReviewCount'> {
    return {
      fileName,
      batchId: batch.id,
      format: batch.format,
      totalCount: batch.totalCount,
      importedCount: batch.importedCount,
      duplicateCount: batch.duplicateCount,
      ignoredCount: batch.ignoredCount,
      errors: batch.errors,
    };
  }
}
