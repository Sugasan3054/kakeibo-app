import { describe, it, expect } from 'vitest';
import {
  validateAmount,
  validateAccountName,
  validateCategoryName,
} from '../validation';

describe('validation utils', () => {
  it('validates amount correctly', () => {
    expect(validateAmount(100)).toBeNull();
    expect(validateAmount(0)).toBe('1円以上で入力してください');
    expect(validateAmount(-50)).toBe('1円以上で入力してください');
    expect(validateAmount(1.5)).toBe('整数で入力してください');
    expect(validateAmount(1000000000000)).toBe('金額が上限を超えています');
  });

  it('validates account name correctly', () => {
    expect(validateAccountName('みずほ銀行')).toBeNull();
    expect(validateAccountName('')).toBe('口座名を入力してください');
    expect(validateAccountName('   ')).toBe('口座名を入力してください');
    expect(validateAccountName('a'.repeat(51))).toBe('口座名は50文字以内で入力してください');
  });

  it('validates category name correctly', () => {
    expect(validateCategoryName('食費')).toBeNull();
    expect(validateCategoryName('')).toBe('分類名を入力してください');
    expect(validateCategoryName('a'.repeat(31))).toBe('分類名は30文字以内で入力してください');
  });
});
