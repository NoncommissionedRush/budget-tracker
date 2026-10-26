import { Injectable } from '@nestjs/common';
import { BankTransaction, CategorizationMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CategorizerContext, Target, createCategorizer } from './categorizer';

export interface CategorizeResult {
  categorized: number;
  ignored: number;
  remaining: number;
}

@Injectable()
export class CategorizationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Runs the pipeline over transactions still waiting for review. */
  async categorizePending(
    where: Prisma.BankTransactionWhereInput = {},
  ): Promise<CategorizeResult> {
    const pending = await this.prisma.bankTransaction.findMany({
      where: { ...where, status: 'NEEDS_REVIEW' },
    });
    const result: CategorizeResult = {
      categorized: 0,
      ignored: 0,
      remaining: 0,
    };
    if (pending.length === 0) return result;

    const decide = createCategorizer(await this.loadContext());
    for (const tx of pending) {
      const decision = decide({ ...tx, amount: tx.amount.toString() });
      if (!decision) {
        result.remaining++;
      } else if ('target' in decision) {
        await this.assign(
          tx,
          decision.target,
          decision.method,
          decision.method === 'RULE' ? decision.ruleId : null,
        );
        result.categorized++;
      } else {
        await this.prisma.bankTransaction.update({
          where: { id: tx.id },
          data: {
            status: 'IGNORED',
            ignoreReason: 'rule',
            categorizedBy: 'RULE',
            ruleId: decision.ruleId,
          },
        });
        result.ignored++;
      }
    }
    return result;
  }

  /** Creates the expense for a transaction and marks it categorized, atomically. */
  assign(
    tx: BankTransaction,
    target: Target,
    method: CategorizationMethod,
    ruleId: string | null = null,
  ) {
    return this.prisma.$transaction([
      this.prisma.expense.create({
        data: {
          categoryId: target.categoryId,
          subcategoryId: target.subcategoryId,
          amount: tx.amount,
          description: tx.counterpartyName ?? tx.description ?? 'Bank payment',
          expenseDate: tx.transactionDate ?? tx.bookingDate,
          source: 'IMPORT',
          bankTransactionId: tx.id,
        },
      }),
      this.prisma.bankTransaction.update({
        where: { id: tx.id },
        data: {
          status: 'CATEGORIZED',
          ignoreReason: null,
          categorizedBy: method,
          ruleId,
        },
      }),
    ]);
  }

  private async loadContext(): Promise<CategorizerContext> {
    const [rules, history, bills] = await Promise.all([
      this.prisma.categorizationRule.findMany({
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        include: { category: true, subcategory: true },
      }),
      this.prisma.bankTransaction.findMany({
        where: {
          status: 'CATEGORIZED',
          expense: { category: { isActive: true } },
        },
        orderBy: [{ bookingDate: 'desc' }, { createdAt: 'desc' }],
        select: {
          counterpartyIban: true,
          counterpartyName: true,
          expense: {
            select: {
              categoryId: true,
              subcategoryId: true,
              subcategory: { select: { isActive: true } },
            },
          },
        },
      }),
      this.prisma.subcategory.findMany({
        where: { isActive: true, category: { isActive: true } },
      }),
    ]);

    return {
      rules: rules
        .filter(
          (r) =>
            r.action === 'IGNORE' ||
            (r.category?.isActive &&
              (!r.subcategory || r.subcategory.isActive)),
        )
        .map((r) => ({
          id: r.id,
          field: r.field,
          matchType: r.matchType,
          pattern: r.pattern,
          amountMin: r.amountMin?.toString() ?? null,
          amountMax: r.amountMax?.toString() ?? null,
          action: r.action,
          categoryId: r.categoryId,
          subcategoryId: r.subcategoryId,
        })),
      history: history.flatMap((h) =>
        h.expense
          ? [
              {
                counterpartyIban: h.counterpartyIban,
                counterpartyName: h.counterpartyName,
                categoryId: h.expense.categoryId,
                subcategoryId:
                  h.expense.subcategory?.isActive === false
                    ? null
                    : h.expense.subcategoryId,
              },
            ]
          : [],
      ),
      bills: bills.map((b) => ({
        id: b.id,
        categoryId: b.categoryId,
        name: b.name,
        amount: b.amount.toString(),
      })),
    };
  }
}
