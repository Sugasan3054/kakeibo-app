import { describe, it, expect } from 'vitest';
import {
  formatDateToString,
  parseDateString,
  formatDateDisplay,
  formatDateShort,
  getYearMonth,
  formatYearMonth,
  getPreviousMonth,
  getNextMonth,
  getDaysInMonth,
  isValidDateString,
} from '../date';

describe('date utils', () => {
  it('formats Date to string without UTC shifts', () => {
    const d = new Date(2024, 4, 15); // May 15, 2024
    expect(formatDateToString(d)).toBe('2024-05-15');
  });

  it('parses date string to local Date correctly', () => {
    const d = parseDateString('2024-05-15');
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(4);
    expect(d.getDate()).toBe(15);
  });

  it('formats display date', () => {
    expect(formatDateDisplay('2024-05-15')).toBe('2024年5月15日');
  });

  it('formats short date', () => {
    expect(formatDateShort('2024-05-15')).toBe('5/15');
  });

  it('extracts year and month', () => {
    expect(getYearMonth('2024-05-15')).toBe('2024-05');
    expect(formatYearMonth('2024-05')).toBe('2024年5月');
  });

  it('navigates previous and next months correctly across year boundaries', () => {
    expect(getPreviousMonth('2024-05')).toBe('2024-04');
    expect(getPreviousMonth('2024-01')).toBe('2023-12');

    expect(getNextMonth('2024-05')).toBe('2024-06');
    expect(getNextMonth('2024-12')).toBe('2025-01');
  });

  it('returns days in month including leap years', () => {
    expect(getDaysInMonth('2024-02')).toBe(29); // 2024 is leap year
    expect(getDaysInMonth('2023-02')).toBe(28);
    expect(getDaysInMonth('2024-04')).toBe(30);
    expect(getDaysInMonth('2024-05')).toBe(31);
  });

  it('validates date strings', () => {
    expect(isValidDateString('2024-05-15')).toBe(true);
    expect(isValidDateString('2024-02-29')).toBe(true);
    expect(isValidDateString('2023-02-29')).toBe(false);
    expect(isValidDateString('invalid')).toBe(false);
  });
});
