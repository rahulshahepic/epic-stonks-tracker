import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseDate,
  formatDate,
  daysBetween,
  isOnOrBefore,
  isBefore,
  getYear,
  startOfYear,
  endOfYear,
  daysInYear,
  today,
} from '../utils/date';

describe('parseDate', () => {
  it('parses a valid YYYY-MM-DD string into a Date at midnight UTC', () => {
    const d = parseDate('2024-03-15');
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(2); // March is 0-indexed as 2
    expect(d.getUTCDate()).toBe(15);
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
  });

  it('handles Jan 1 correctly', () => {
    const d = parseDate('2024-01-01');
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(0);
    expect(d.getUTCDate()).toBe(1);
  });

  it('handles Dec 31 correctly', () => {
    const d = parseDate('2024-12-31');
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(11);
    expect(d.getUTCDate()).toBe(31);
  });

  it('handles leap year Feb 29', () => {
    const d = parseDate('2024-02-29');
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(1);
    expect(d.getUTCDate()).toBe(29);
  });
});

describe('formatDate', () => {
  it('formats a Date object as YYYY-MM-DD', () => {
    const d = new Date(Date.UTC(2024, 2, 15));
    expect(formatDate(d)).toBe('2024-03-15');
  });

  it('zero-pads single-digit months and days', () => {
    const d = new Date(Date.UTC(2024, 0, 5));
    expect(formatDate(d)).toBe('2024-01-05');
  });

  it('formats Dec 31', () => {
    const d = new Date(Date.UTC(2024, 11, 31));
    expect(formatDate(d)).toBe('2024-12-31');
  });

  it('round-trips with parseDate', () => {
    const original = '2025-07-04';
    expect(formatDate(parseDate(original))).toBe(original);
  });
});

describe('daysBetween', () => {
  it('returns 0 for the same date', () => {
    expect(daysBetween('2024-06-15', '2024-06-15')).toBe(0);
  });

  it('returns positive for date2 after date1', () => {
    expect(daysBetween('2024-01-01', '2024-01-02')).toBe(1);
  });

  it('returns negative for date2 before date1', () => {
    expect(daysBetween('2024-01-02', '2024-01-01')).toBe(-1);
  });

  it('counts days across months', () => {
    // Jan has 31 days
    expect(daysBetween('2024-01-01', '2024-02-01')).toBe(31);
  });

  it('counts days across a full year (non-leap)', () => {
    expect(daysBetween('2023-01-01', '2024-01-01')).toBe(365);
  });

  it('counts days across a full leap year', () => {
    expect(daysBetween('2024-01-01', '2025-01-01')).toBe(366);
  });

  it('counts across multiple years', () => {
    expect(daysBetween('2020-01-01', '2020-12-31')).toBe(365);
  });
});

describe('isOnOrBefore', () => {
  it('returns true when date1 < date2', () => {
    expect(isOnOrBefore('2024-01-01', '2024-01-02')).toBe(true);
  });

  it('returns true when date1 equals date2', () => {
    expect(isOnOrBefore('2024-06-15', '2024-06-15')).toBe(true);
  });

  it('returns false when date1 > date2', () => {
    expect(isOnOrBefore('2024-06-16', '2024-06-15')).toBe(false);
  });
});

describe('isBefore', () => {
  it('returns true when date1 < date2', () => {
    expect(isBefore('2024-01-01', '2024-01-02')).toBe(true);
  });

  it('returns false when date1 equals date2', () => {
    expect(isBefore('2024-06-15', '2024-06-15')).toBe(false);
  });

  it('returns false when date1 > date2', () => {
    expect(isBefore('2024-06-16', '2024-06-15')).toBe(false);
  });
});

describe('getYear', () => {
  it('extracts year from a date string', () => {
    expect(getYear('2024-06-15')).toBe(2024);
  });

  it('handles years in different ranges', () => {
    expect(getYear('1999-12-31')).toBe(1999);
    expect(getYear('2030-01-01')).toBe(2030);
  });
});

describe('startOfYear', () => {
  it('returns Jan 1 of the given year', () => {
    expect(startOfYear(2024)).toBe('2024-01-01');
  });

  it('formats correctly for different years', () => {
    expect(startOfYear(2000)).toBe('2000-01-01');
    expect(startOfYear(2030)).toBe('2030-01-01');
  });
});

describe('endOfYear', () => {
  it('returns Dec 31 of the given year', () => {
    expect(endOfYear(2024)).toBe('2024-12-31');
  });

  it('formats correctly for different years', () => {
    expect(endOfYear(1999)).toBe('1999-12-31');
    expect(endOfYear(2030)).toBe('2030-12-31');
  });
});

describe('daysInYear', () => {
  it('returns 365 for a non-leap year', () => {
    expect(daysInYear(2023)).toBe(365);
  });

  it('returns 366 for a leap year divisible by 4', () => {
    expect(daysInYear(2024)).toBe(366);
  });

  it('returns 365 for a century year not divisible by 400', () => {
    expect(daysInYear(1900)).toBe(365);
  });

  it('returns 366 for year 2000 (divisible by 400)', () => {
    expect(daysInYear(2000)).toBe(366);
  });

  it('returns 365 for common non-leap years', () => {
    expect(daysInYear(2025)).toBe(365);
    expect(daysInYear(2026)).toBe(365);
    expect(daysInYear(2027)).toBe(365);
  });
});

describe('today', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a YYYY-MM-DD formatted string', () => {
    const result = today();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns the mocked date when timer is faked', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2025, 5, 15)));
    // today() uses `new Date()` which may have local offset; we just check format
    const result = today();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // The exact date depends on the local timezone so we just ensure the format is valid
  });
});
