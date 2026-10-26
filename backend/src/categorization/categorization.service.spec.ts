import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CategorizationService } from './categorization.service';

const bankTx = (id: string, overrides = {}) => ({
  id,
  status: 'NEEDS_REVIEW',
  counterpartyIban: null,
  counterpartyName: 'COFFEE SHOP',
  description: 'Platba kartou',
  variableSymbol: null,
  amount: new Prisma.Decimal('3.10'),
  bookingDate: new Date('2026-10-25T00:00:00Z'),
  transactionDate: new Date('2026-10-24T00:00:00Z'),
  ...overrides,
});

describe('CategorizationService', () => {
  let prisma: any;
  let service: CategorizationService;

  beforeEach(() => {
    prisma = {
      bankTransaction: { findMany: jest.fn(), update: jest.fn((a) => a) },
      categorizationRule: { findMany: jest.fn().mockResolvedValue([]) },
      subcategory: { findMany: jest.fn().mockResolvedValue([]) },
      expense: { create: jest.fn((a) => a) },
      $transaction: jest.fn((ops) => Promise.resolve(ops)),
    };
    service = new CategorizationService(prisma as PrismaService);
  });

  const pending = (...txs: unknown[]) =>
    prisma.bankTransaction.findMany.mockImplementation(({ where }: any) =>
      Promise.resolve(where.status === 'NEEDS_REVIEW' ? txs : []),
    );

  it('creates an expense for a rule match and records how it was categorized', async () => {
    pending(bankTx('t1'));
    prisma.categorizationRule.findMany.mockResolvedValue([
      {
        id: 'r1',
        field: 'COUNTERPARTY_NAME',
        matchType: 'CONTAINS',
        pattern: 'coffee',
        amountMin: null,
        amountMax: null,
        action: 'CATEGORIZE',
        categoryId: 'cat-food',
        subcategoryId: null,
        category: { isActive: true },
        subcategory: null,
      },
    ]);

    const result = await service.categorizePending({ importBatchId: 'b1' });

    expect(result).toEqual({ categorized: 1, ignored: 0, remaining: 0 });
    expect(prisma.bankTransaction.findMany.mock.calls[0][0].where).toEqual({
      importBatchId: 'b1',
      status: 'NEEDS_REVIEW',
    });
    expect(prisma.expense.create).toHaveBeenCalledWith({
      data: {
        categoryId: 'cat-food',
        subcategoryId: null,
        amount: new Prisma.Decimal('3.10'),
        description: 'COFFEE SHOP',
        expenseDate: new Date('2026-10-24T00:00:00Z'),
        source: 'IMPORT',
        bankTransactionId: 't1',
      },
    });
    expect(prisma.bankTransaction.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: {
        status: 'CATEGORIZED',
        ignoreReason: null,
        categorizedBy: 'RULE',
        ruleId: 'r1',
      },
    });
  });

  it('skips rules that point at an inactive category', async () => {
    pending(bankTx('t1'));
    prisma.categorizationRule.findMany.mockResolvedValue([
      {
        id: 'r1',
        field: 'COUNTERPARTY_NAME',
        matchType: 'CONTAINS',
        pattern: 'coffee',
        amountMin: null,
        amountMax: null,
        action: 'CATEGORIZE',
        categoryId: 'cat-old',
        subcategoryId: null,
        category: { isActive: false },
        subcategory: null,
      },
    ]);
    const result = await service.categorizePending();
    expect(result).toEqual({ categorized: 0, ignored: 0, remaining: 1 });
    expect(prisma.expense.create).not.toHaveBeenCalled();
  });

  it('ignores transactions matched by an ignore rule', async () => {
    pending(bankTx('t1'));
    prisma.categorizationRule.findMany.mockResolvedValue([
      {
        id: 'r1',
        field: null,
        matchType: 'CONTAINS',
        pattern: null,
        amountMin: null,
        amountMax: new Prisma.Decimal('5'),
        action: 'IGNORE',
        categoryId: null,
        subcategoryId: null,
        category: null,
        subcategory: null,
      },
    ]);
    const result = await service.categorizePending();
    expect(result).toEqual({ categorized: 0, ignored: 1, remaining: 0 });
    expect(prisma.bankTransaction.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: {
        status: 'IGNORED',
        ignoreReason: 'rule',
        categorizedBy: 'RULE',
        ruleId: 'r1',
      },
    });
  });

  it('learns from earlier categorizations of the same counterparty', async () => {
    prisma.bankTransaction.findMany.mockImplementation(({ where }: any) =>
      Promise.resolve(
        where.status === 'NEEDS_REVIEW'
          ? [bankTx('t1'), bankTx('t2', { counterpartyName: 'BAKERY' })]
          : [
              {
                counterpartyIban: null,
                counterpartyName: 'Coffee Shop',
                expense: {
                  categoryId: 'cat-food',
                  subcategoryId: null,
                  subcategory: null,
                },
              },
            ],
      ),
    );
    const result = await service.categorizePending();
    expect(result).toEqual({ categorized: 1, ignored: 0, remaining: 1 });
    expect(prisma.bankTransaction.update.mock.calls[0][0]).toMatchObject({
      where: { id: 't1' },
      data: { categorizedBy: 'HISTORY', ruleId: null },
    });
  });

  it('does not load anything when nothing is pending', async () => {
    pending();
    expect(await service.categorizePending()).toEqual({
      categorized: 0,
      ignored: 0,
      remaining: 0,
    });
    expect(prisma.categorizationRule.findMany).not.toHaveBeenCalled();
  });
});
