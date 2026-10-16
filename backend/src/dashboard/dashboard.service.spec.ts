import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

const decimal = (v: number) => new Prisma.Decimal(v);

function category(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cat-1',
    name: 'Groceries',
    icon: 'tag',
    color: '#6366f1',
    allocatedAmount: decimal(300),
    activeMonths: [] as number[],
    isUnbudgeted: false,
    subcategories: [],
    ...overrides,
  };
}

describe('DashboardService', () => {
  let prisma: {
    incomeConfig: { findFirst: jest.Mock };
    category: { findMany: jest.Mock };
    expense: { findMany: jest.Mock };
  };
  let service: DashboardService;

  beforeEach(() => {
    // 00:30 local time on 2026-10-16 — still Oct 15 in UTC
    jest.useFakeTimers({ now: new Date('2026-10-16T00:30:00+02:00') });
    prisma = {
      incomeConfig: {
        findFirst: jest.fn().mockResolvedValue({ monthlyAmount: decimal(2000), incomeDay: 25 }),
      },
      category: { findMany: jest.fn().mockResolvedValue([category()]) },
      expense: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new DashboardService(prisma as unknown as PrismaService);
  });

  afterEach(() => jest.useRealTimers());

  it('returns an empty dashboard without income config', async () => {
    prisma.incomeConfig.findFirst.mockResolvedValue(null);
    await expect(service.getDashboard()).resolves.toEqual({
      period: null,
      income: null,
      summary: null,
      categories: [],
    });
  });

  it('defaults to the period containing today, using the local date', async () => {
    const { period } = await service.getDashboard();
    expect(period).toMatchObject({
      year: 2026,
      month: 9,
      periodStart: '2026-09-25',
      periodEnd: '2026-10-24',
      today: '2026-10-16',
    });
  });

  it('queries @db.Date bounds as UTC midnight of the period days', async () => {
    await service.getDashboard();
    const { expenseDate } = prisma.expense.findMany.mock.calls[0][0].where;
    expect(expenseDate.gte.toISOString()).toBe('2026-09-25T00:00:00.000Z');
    expect(expenseDate.lte.toISOString()).toBe('2026-10-24T00:00:00.000Z');
  });

  it('uses the selected month when navigating', async () => {
    const { period } = await service.getDashboard(2026, 7);
    expect(period).toMatchObject({
      year: 2026,
      month: 7,
      periodStart: '2026-07-25',
      periodEnd: '2026-08-24',
      daysElapsed: 31,
      daysRemaining: 0,
    });
    const { expenseDate } = prisma.expense.findMany.mock.calls[0][0].where;
    expect(expenseDate.gte.toISOString()).toBe('2026-07-25T00:00:00.000Z');
  });

  it('checks seasonal categories against the month the period starts in', async () => {
    prisma.category.findMany.mockResolvedValue([category({ activeMonths: [10] })]);

    // Sep 25 – Oct 24 starts in September: an October-only category is off
    const sep = await service.getDashboard(2026, 9);
    expect(sep.categories[0]).toMatchObject({ isActiveThisPeriod: false, allocatedAmount: '0.00' });

    // Oct 25 – Nov 24 starts in October
    const oct = await service.getDashboard(2026, 10);
    expect(oct.categories[0]).toMatchObject({ isActiveThisPeriod: true, allocatedAmount: '300.00' });
  });

  it('checks seasonal categories against the start month for the current late-month period', async () => {
    // Today is Oct 16, so the current period is Sep 25 – Oct 24
    prisma.category.findMany.mockResolvedValue([
      category({ id: 'sep', activeMonths: [9] }),
      category({ id: 'oct', activeMonths: [10] }),
    ]);
    const { categories } = await service.getDashboard();
    expect(categories.map((c) => [c.id, c.isActiveThisPeriod])).toEqual([
      ['sep', true],
      ['oct', false],
    ]);
  });

  it('formats expense dates as the stored calendar day', async () => {
    prisma.expense.findMany.mockResolvedValue([
      {
        id: 'exp-1',
        categoryId: 'cat-1',
        subcategoryId: null,
        amount: decimal(12.5),
        description: 'Milk',
        // What Prisma returns for a DATE column of 2026-10-01
        expenseDate: new Date('2026-10-01T00:00:00.000Z'),
        createdAt: new Date('2026-10-01T08:00:00.000Z'),
      },
    ]);
    const { categories, summary } = await service.getDashboard();
    expect(categories[0].expenses[0].expenseDate).toBe('2026-10-01');
    expect(summary!.totalSpent).toBe('12.50');
  });
});
