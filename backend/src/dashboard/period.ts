import {
  addDaysDateOnly,
  dateOnly,
  daysInMonth,
  diffDaysDateOnly,
} from '../common/date-only';

export interface BudgetPeriod {
  /** Calendar year/month the period starts in (1-indexed month). */
  year: number;
  month: number;
  periodStart: Date;
  periodEnd: Date;
  daysInPeriod: number;
  daysElapsed: number;
  daysRemaining: number;
}

/** Income date in a month, clamped to the month's length (e.g. day 31 → Feb 28). */
function incomeDate(year: number, month: number, incomeDay: number): Date {
  return dateOnly(year, month, Math.min(incomeDay, daysInMonth(year, month)));
}

/**
 * A budget period runs from one income day to the day before the next.
 * The period for month M is the one that *starts* on the income day in M,
 * so with a payday on the 25th, "October" is Oct 25 – Nov 24.
 *
 * Without a target month, returns the period containing `today`.
 * All dates are UTC-midnight calendar dates (see `common/date-only`).
 */
export function calculatePeriod(
  today: Date,
  incomeDay: number,
  targetYear?: number,
  targetMonth?: number,
): BudgetPeriod {
  let year: number;
  let month: number;

  if (targetYear !== undefined || targetMonth !== undefined) {
    year = targetYear ?? today.getUTCFullYear();
    month = targetMonth ?? today.getUTCMonth() + 1;
  } else {
    year = today.getUTCFullYear();
    month = today.getUTCMonth() + 1;
    if (today < incomeDate(year, month, incomeDay)) {
      // Before this month's payday: still in the period that began last month
      month -= 1;
      if (month === 0) {
        month = 12;
        year -= 1;
      }
    }
  }

  const periodStart = incomeDate(year, month, incomeDay);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const periodEnd = addDaysDateOnly(incomeDate(nextYear, nextMonth, incomeDay), -1);

  const daysInPeriod = diffDaysDateOnly(periodEnd, periodStart) + 1;
  let daysElapsed: number;
  let daysRemaining: number;
  if (today < periodStart) {
    daysElapsed = 0;
    daysRemaining = daysInPeriod;
  } else if (today > periodEnd) {
    daysElapsed = daysInPeriod;
    daysRemaining = 0;
  } else {
    daysElapsed = diffDaysDateOnly(today, periodStart);
    daysRemaining = diffDaysDateOnly(periodEnd, today);
  }

  return { year, month, periodStart, periodEnd, daysInPeriod, daysElapsed, daysRemaining };
}
