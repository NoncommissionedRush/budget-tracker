import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Decimal from 'decimal.js';
import {
  getDaysInMonth,
  differenceInDays,
  format,
  startOfDay,
} from 'date-fns';

type CategoryStatus = 'ok' | 'warning' | 'over';

interface PeriodBoundaries {
  periodStart: Date;
  periodEnd: Date;
  daysInPeriod: number;
  daysElapsed: number;
  daysRemaining: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(year?: number, month?: number) {
    const today = startOfDay(new Date());
    const targetYear = year ?? today.getFullYear();
    const targetMonth = month ?? today.getMonth() + 1; // 1-indexed

    const incomeConfig = await this.prisma.incomeConfig.findFirst();
    if (!incomeConfig) {
      return {
        period: null,
        income: null,
        summary: null,
        categories: [],
      };
    }

    const period = this.calculatePeriodBoundaries(
      today,
      incomeConfig.incomeDay,
      targetYear,
      targetMonth,
    );

    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        subcategories: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    // Single query for all period expenses
    const expenses = await this.prisma.expense.findMany({
      where: {
        expenseDate: {
          gte: period.periodStart,
          lte: period.periodEnd,
        },
      },
      include: { category: true },
      orderBy: { expenseDate: 'desc' },
    });

    // Group expenses by categoryId in memory
    const expensesByCategory = new Map<string, typeof expenses>();
    for (const expense of expenses) {
      if (!expensesByCategory.has(expense.categoryId)) {
        expensesByCategory.set(expense.categoryId, []);
      }
      expensesByCategory.get(expense.categoryId)!.push(expense);
    }

    const monthlyAmount = new Decimal(incomeConfig.monthlyAmount.toString());

    // Build category summaries
    let totalAllocated = new Decimal(0);
    let totalBudgetedSpent = new Decimal(0);
    let totalUnbudgetedSpent = new Decimal(0);
    let totalProjected = new Decimal(0);

    const categorySummaries = categories.map((category) => {
      const catExpenses = expensesByCategory.get(category.id) ?? [];

      // A category is active this period if activeMonths is empty (= every month)
      // or if the period's calendar month is listed in activeMonths.
      const isActiveThisPeriod =
        category.activeMonths.length === 0 ||
        category.activeMonths.includes(targetMonth);

      // Use the real allocated amount only when active; zero otherwise.
      const allocated = isActiveThisPeriod
        ? new Decimal(category.allocatedAmount.toString())
        : new Decimal(0);

      const spent = catExpenses.reduce(
        (sum, e) => sum.plus(new Decimal(e.amount.toString())),
        new Decimal(0),
      );
      const remaining = allocated.minus(spent);
      const spentPercentage =
        allocated.isZero()
          ? 0
          : spent.div(allocated).times(100).toDecimalPlaces(1).toNumber();

      const projectedSpend = this.projectSpend(spent, period.daysElapsed, period.daysInPeriod);

      const status: CategoryStatus =
        spentPercentage > 100 ? 'over' : spentPercentage >= 75 ? 'warning' : 'ok';

      // Only count active, budgeted categories toward allocated and projected totals
      if (isActiveThisPeriod && !category.isUnbudgeted) {
        totalAllocated = totalAllocated.plus(allocated);
        totalProjected = totalProjected.plus(projectedSpend);
        totalBudgetedSpent = totalBudgetedSpent.plus(spent);
      } else if (category.isUnbudgeted) {
        totalUnbudgetedSpent = totalUnbudgetedSpent.plus(spent);
      }

      // Build subcategory paid status
      const subcategories = category.subcategories.map((sub) => {
        const paidExpense = catExpenses.find((e) => e.subcategoryId === sub.id);
        return {
          id: sub.id,
          name: sub.name,
          amount: new Decimal(sub.amount.toString()).toFixed(2),
          isPaid: !!paidExpense,
          paidExpenseId: paidExpense?.id ?? null,
        };
      });

      return {
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
        activeMonths: category.activeMonths,
        isActiveThisPeriod,
        isUnbudgeted: category.isUnbudgeted,
        allocatedAmount: allocated.toFixed(2),
        spentAmount: spent.toFixed(2),
        remainingAmount: remaining.toFixed(2),
        spentPercentage,
        projectedSpend: projectedSpend.toFixed(2),
        status,
        subcategories,
        expenses: catExpenses.map((e) => ({
          id: e.id,
          categoryId: e.categoryId,
          subcategoryId: e.subcategoryId ?? null,
          amount: new Decimal(e.amount.toString()).toFixed(2),
          description: e.description,
          expenseDate: format(e.expenseDate, 'yyyy-MM-dd'),
          createdAt: e.createdAt.toISOString(),
        })),
      };
    });

    // Surplus = income not allocated to any category, minus what was spent on unexpected items
    const unallocated = monthlyAmount.minus(totalAllocated).minus(totalUnbudgetedSpent);
    const projectedRemaining = monthlyAmount.minus(totalProjected);
    // Progress % is budgeted spending vs allocated budget (unbudgeted doesn't erode the budget)
    const summarySpentPct = totalAllocated.isZero()
      ? 0
      : totalBudgetedSpent.div(totalAllocated).times(100).toDecimalPlaces(1).toNumber();

    return {
      period: {
        year: targetYear,
        month: targetMonth,
        periodStart: format(period.periodStart, 'yyyy-MM-dd'),
        periodEnd: format(period.periodEnd, 'yyyy-MM-dd'),
        today: format(today, 'yyyy-MM-dd'),
        daysInPeriod: period.daysInPeriod,
        daysElapsed: period.daysElapsed,
        daysRemaining: period.daysRemaining,
      },
      income: {
        monthlyAmount: monthlyAmount.toFixed(2),
      },
      summary: {
        totalAllocated: totalAllocated.toFixed(2),
        totalSpent: totalBudgetedSpent.plus(totalUnbudgetedSpent).toFixed(2),
        budgetedSpent: totalBudgetedSpent.toFixed(2),
        unbudgetedSpent: totalUnbudgetedSpent.toFixed(2),
        totalRemaining: totalAllocated.minus(totalBudgetedSpent).toFixed(2),
        unallocatedAmount: unallocated.toFixed(2),
        projectedTotalSpend: totalProjected.toFixed(2),
        projectedRemainingAtMonthEnd: projectedRemaining.toFixed(2),
        spentPercentage: summarySpentPct,
      },
      categories: categorySummaries,
    };
  }

  private calculatePeriodBoundaries(
    today: Date,
    incomeDay: number,
    _targetYear: number,
    _targetMonth: number,
  ): PeriodBoundaries {
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-indexed

    // Clamp incomeDay to days in current month
    const daysInCurrent = getDaysInMonth(new Date(year, month, 1));
    const effectiveDay = Math.min(incomeDay, daysInCurrent);
    const incomeThisMonth = new Date(year, month, effectiveDay);

    let periodStart: Date;
    let periodEnd: Date;

    if (today >= incomeThisMonth) {
      // Period started this month
      periodStart = incomeThisMonth;
      const nextMonthIdx = (month + 1) % 12;
      const nextYear = month === 11 ? year + 1 : year;
      const daysInNext = getDaysInMonth(new Date(nextYear, nextMonthIdx, 1));
      const effectiveDayNext = Math.min(incomeDay, daysInNext);
      // Period ends day before next income
      periodEnd = new Date(nextYear, nextMonthIdx, effectiveDayNext - 1);
    } else {
      // Period started last month
      const prevMonthIdx = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const daysInPrev = getDaysInMonth(new Date(prevYear, prevMonthIdx, 1));
      const effectiveDayPrev = Math.min(incomeDay, daysInPrev);
      periodStart = new Date(prevYear, prevMonthIdx, effectiveDayPrev);
      // Period ends day before income this month
      periodEnd = new Date(year, month, effectiveDay - 1);
    }

    const daysInPeriod = differenceInDays(periodEnd, periodStart) + 1;
    const daysElapsed = Math.max(0, differenceInDays(today, periodStart));
    const daysRemaining = Math.max(0, differenceInDays(periodEnd, today));

    return { periodStart, periodEnd, daysInPeriod, daysElapsed, daysRemaining };
  }

  private projectSpend(
    spentAmount: Decimal,
    daysElapsed: number,
    daysInPeriod: number,
  ): Decimal {
    if (daysElapsed === 0 || spentAmount.isZero()) {
      return spentAmount;
    }
    const dailyRate = spentAmount.div(daysElapsed);
    return dailyRate.times(daysInPeriod);
  }
}
