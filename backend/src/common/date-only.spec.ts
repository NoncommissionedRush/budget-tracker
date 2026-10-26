import {
  addDaysDateOnly,
  dateOnly,
  daysInMonth,
  diffDaysDateOnly,
  formatDateOnly,
  parseDateOnly,
  todayDateOnly,
} from './date-only';

describe('date-only helpers', () => {
  it('runs in a timezone east of UTC', () => {
    // Guard: the regression tests below are only meaningful with a non-zero offset
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBeLessThan(0);
  });

  it('builds UTC-midnight dates', () => {
    expect(dateOnly(2026, 9, 25).toISOString()).toBe('2026-09-25T00:00:00.000Z');
  });

  it('uses the local calendar day for "today", even just after local midnight', () => {
    // 00:30 in Bratislava (UTC+2) is still the previous day in UTC
    const now = new Date('2026-10-16T00:30:00+02:00');
    expect(now.toISOString().slice(0, 10)).toBe('2026-10-15');
    expect(formatDateOnly(todayDateOnly(now))).toBe('2026-10-16');
  });

  it('parses yyyy-MM-dd and ISO strings as the given calendar day', () => {
    expect(parseDateOnly('2026-02-26').toISOString()).toBe('2026-02-26T00:00:00.000Z');
    expect(formatDateOnly(parseDateOnly('2026-02-26T23:30:00+02:00'))).toBe('2026-02-26');
    expect(() => parseDateOnly('26.02.2026')).toThrow();
  });

  it('counts days across a DST change', () => {
    // Europe switches back to winter time on 2026-10-25
    expect(diffDaysDateOnly(dateOnly(2026, 11, 1), dateOnly(2026, 10, 25))).toBe(7);
    expect(formatDateOnly(addDaysDateOnly(dateOnly(2026, 10, 24), 2))).toBe('2026-10-26');
  });

  it('knows month lengths', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});
