/**
 * Helpers for calendar dates stored in `@db.Date` columns.
 *
 * Prisma reads and writes `@db.Date` values as UTC midnight, so every calendar
 * date in the backend is represented as a `Date` at 00:00:00.000Z. Building
 * dates at *local* midnight (e.g. `new Date(y, m, d)` or date-fns `startOfDay`)
 * shifts them back a day on servers east of UTC.
 */

const MS_PER_DAY = 86_400_000;

/** UTC-midnight date for a calendar day. `month` is 1-indexed; overflow rolls over. */
export function dateOnly(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Today's calendar date in the server's local timezone, as UTC midnight. */
export function todayDateOnly(now: Date = new Date()): Date {
  return dateOnly(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** Parses `yyyy-MM-dd` (or the date part of an ISO string) as UTC midnight. */
export function parseDateOnly(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) throw new Error(`Invalid date: ${value}`);
  return dateOnly(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** Formats a UTC-midnight date as `yyyy-MM-dd`. */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysDateOnly(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Whole calendar days from `from` to `to` (DST-safe because both are UTC). */
export function diffDaysDateOnly(to: Date, from: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
