import { dateOnly, formatDateOnly } from '../common/date-only';
import { calculatePeriod } from './period';

const range = (p: ReturnType<typeof calculatePeriod>) =>
  `${formatDateOnly(p.periodStart)}..${formatDateOnly(p.periodEnd)}`;

describe('calculatePeriod', () => {
  describe('current period (no target month)', () => {
    it('starts this month when payday has passed', () => {
      const p = calculatePeriod(dateOnly(2026, 10, 16), 10);
      expect(range(p)).toBe('2026-10-10..2026-11-09');
      expect([p.year, p.month]).toEqual([2026, 10]);
    });

    it('starts on payday itself', () => {
      const p = calculatePeriod(dateOnly(2026, 10, 25), 25);
      expect(range(p)).toBe('2026-10-25..2026-11-24');
      expect(p.daysElapsed).toBe(0);
    });

    it('belongs to last month before a late-month payday', () => {
      const p = calculatePeriod(dateOnly(2026, 10, 16), 25);
      expect(range(p)).toBe('2026-09-25..2026-10-24');
      expect([p.year, p.month]).toEqual([2026, 9]);
      expect(p.daysElapsed).toBe(21);
      expect(p.daysRemaining).toBe(8);
    });

    it('rolls back over the new year', () => {
      const p = calculatePeriod(dateOnly(2027, 1, 5), 25);
      expect(range(p)).toBe('2026-12-25..2027-01-24');
      expect([p.year, p.month]).toEqual([2026, 12]);
    });
  });

  describe('month navigation', () => {
    const today = dateOnly(2026, 10, 16);

    it('returns the period that starts in the selected month', () => {
      expect(range(calculatePeriod(today, 25, 2026, 8))).toBe('2026-08-25..2026-09-24');
      expect(range(calculatePeriod(today, 25, 2026, 9))).toBe('2026-09-25..2026-10-24');
      expect(range(calculatePeriod(today, 25, 2026, 10))).toBe('2026-10-25..2026-11-24');
    });

    it('rolls forward over the new year', () => {
      const p = calculatePeriod(today, 25, 2026, 12);
      expect(range(p)).toBe('2026-12-25..2027-01-24');
      expect([p.year, p.month]).toEqual([2026, 12]);
    });

    it('treats past periods as fully elapsed', () => {
      const p = calculatePeriod(today, 1, 2026, 3);
      expect(p.daysInPeriod).toBe(31);
      expect(p.daysElapsed).toBe(31);
      expect(p.daysRemaining).toBe(0);
    });

    it('treats future periods as not started', () => {
      const p = calculatePeriod(today, 1, 2027, 2);
      expect(p.daysInPeriod).toBe(28);
      expect(p.daysElapsed).toBe(0);
      expect(p.daysRemaining).toBe(28);
    });
  });

  it('clamps payday to short months', () => {
    expect(range(calculatePeriod(dateOnly(2026, 1, 1), 31, 2026, 1))).toBe('2026-01-31..2026-02-27');
    expect(range(calculatePeriod(dateOnly(2026, 1, 1), 31, 2026, 2))).toBe('2026-02-28..2026-03-30');
    expect(range(calculatePeriod(dateOnly(2026, 1, 1), 30, 2028, 2))).toBe('2028-02-29..2028-03-29');
  });

  it('counts days correctly across a DST change', () => {
    // Oct 25 – Nov 24 spans the end of summer time
    expect(calculatePeriod(dateOnly(2026, 11, 1), 25).daysInPeriod).toBe(31);
    expect(calculatePeriod(dateOnly(2026, 11, 1), 25).daysElapsed).toBe(7);
  });
});
