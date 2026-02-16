/** Parse a YYYY-MM-DD string to a Date (at midnight UTC). */
export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Format a Date as YYYY-MM-DD. */
export function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Number of days between two YYYY-MM-DD date strings. */
export function daysBetween(date1: string, date2: string): number {
  const d1 = parseDate(date1);
  const d2 = parseDate(date2);
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/** True if date1 <= date2 (both YYYY-MM-DD strings). */
export function isOnOrBefore(date1: string, date2: string): boolean {
  return date1 <= date2;
}

/** True if date1 < date2 (both YYYY-MM-DD strings). */
export function isBefore(date1: string, date2: string): boolean {
  return date1 < date2;
}

/** Extract year from a YYYY-MM-DD string. */
export function getYear(dateStr: string): number {
  return parseInt(dateStr.substring(0, 4), 10);
}

/** Get YYYY-MM-DD for Jan 1 of a given year. */
export function startOfYear(year: number): string {
  return `${year}-01-01`;
}

/** Get YYYY-MM-DD for Dec 31 of a given year. */
export function endOfYear(year: number): string {
  return `${year}-12-31`;
}

/** Number of days in a year (accounts for leap years). */
export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Get today's date as YYYY-MM-DD. */
export function today(): string {
  return formatDate(new Date());
}
