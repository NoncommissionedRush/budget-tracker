/**
 * Calendar date in the browser's timezone as `yyyy-MM-dd`.
 * Unlike `toISOString()`, this doesn't jump back a day between local midnight
 * and the UTC offset (e.g. 00:00–02:00 in CEST).
 */
export function localDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Local calendar date `days` away from today, as `yyyy-MM-dd`. */
export function localDateStringFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

/** Parses `yyyy-MM-dd` as local midnight (`new Date('yyyy-MM-dd')` would be UTC). */
export function parseLocalDate(value: string): Date {
  return new Date(value + 'T00:00:00');
}
