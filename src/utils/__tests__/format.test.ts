import { describe, it, expect } from 'vitest';
import {
  formatAmount,
  formatSignedAmount,
  formatYen,
  parseAmountInput,
  calcPercentage,
} from '../format';

describe('format utils', () => {
  it('formats amounts with commas', () => {
    expect(formatAmount(0)).toBe('0');
    expect(formatAmount(1000)).toBe('1,000');
    expect(formatAmount(1234567)).toBe('1,234,567');
  });

  it('formats signed amounts for kinds', () => {
    expect(formatSignedAmount(1500, 'expense')).toBe('−¥1,500');
    expect(formatSignedAmount(200000, 'income')).toBe('+¥200,000');
    expect(formatSignedAmount(500, 'adjustment')).toBe('+¥500');
    expect(formatSignedAmount(-500, 'adjustment')).toBe('−¥500');
  });

  it('formats yen currency display', () => {
    expect(formatYen(5000)).toBe('¥5,000');
  });

  it('parses user amount input strings with commas and symbols', () => {
    expect(parseAmountInput('1000')).toBe(1000);
    expect(parseAmountInput('1,000')).toBe(1000);
    expect(parseAmountInput('¥1,500')).toBe(1500);
    expect(parseAmountInput('￥ 2,000 ')).toBe(2000);
    expect(parseAmountInput('abc')).toBeNull();
    expect(parseAmountInput('-50')).toBeNull();
    expect(parseAmountInput('0')).toBeNull();
  });

  it('calculates percentages correctly rounded to 1 decimal place', () => {
    expect(calcPercentage(25, 100)).toBe(25);
    expect(calcPercentage(1, 3)).toBe(33.3);
    expect(calcPercentage(0, 100)).toBe(0);
    expect(calcPercentage(10, 0)).toBe(0);
  });
});
