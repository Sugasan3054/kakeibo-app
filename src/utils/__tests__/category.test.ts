import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../db/database';
import {
  normalizeCategoryName,
  isCategoryNameDuplicate,
  validateCategoryName,
  sortCategories,
  deleteCategoryWithRelocation,
} from '../category';
import type { Category, Transaction, Budget } from '../../db/models';

describe('Category utility and management', () => {
  describe('Name normalization and duplicate checking', () => {
    const categories: Category[] = [
      { id: '1', kind: 'expense', name: 'カフェ', color: '#ff0000', order: 1, isCustom: false },
      { id: '2', kind: 'expense', name: '食費', color: '#00ff00', order: 2, isCustom: false },
      { id: '3', kind: 'income', name: '給与', color: '#0000ff', order: 1, isCustom: false },
    ];

    it('normalizes full-width and half-width katakana (NFKC)', () => {
      expect(normalizeCategoryName('ｶﾌｪ')).toBe('カフェ');
      expect(normalizeCategoryName('カフェ')).toBe('カフェ');
    });

    it('strips leading and trailing ASCII and full-width spaces', () => {
      expect(normalizeCategoryName('  食費  ')).toBe('食費');
      expect(normalizeCategoryName('　食費　')).toBe('食費');
    });

    it('detects duplicate category name regardless of half/full width and whitespace', () => {
      expect(isCategoryNameDuplicate(categories, 'expense', 'ｶﾌｪ')).toBe(true);
      expect(isCategoryNameDuplicate(categories, 'expense', '  カフェ  ')).toBe(true);
      expect(isCategoryNameDuplicate(categories, 'expense', '　ｶﾌｪ　')).toBe(true);
      expect(isCategoryNameDuplicate(categories, 'expense', '日用品')).toBe(false);
    });

    it('allows same name under different kinds (expense vs income)', () => {
      expect(isCategoryNameDuplicate(categories, 'income', '食費')).toBe(false);
    });

    it('ignores self id when editing', () => {
      expect(isCategoryNameDuplicate(categories, 'expense', 'カフェ', '1')).toBe(false);
      expect(isCategoryNameDuplicate(categories, 'expense', 'カフェ', '2')).toBe(true);
    });

    it('validates category name correctly', () => {
      expect(validateCategoryName('', categories, 'expense').valid).toBe(false);
      expect(validateCategoryName('   ', categories, 'expense').valid).toBe(false);
      expect(validateCategoryName('あ'.repeat(21), categories, 'expense').valid).toBe(false);
      expect(validateCategoryName('ｶﾌｪ', categories, 'expense').valid).toBe(false);
      expect(validateCategoryName('ｶﾌｪ', categories, 'expense').error).toBe('「ｶﾌｪ」はすでにあります');

      const okResult = validateCategoryName('趣味・娯楽', categories, 'expense');
      expect(okResult.valid).toBe(true);
      expect(okResult.error).toBeUndefined();
    });
  });

  describe('Category sorting rules', () => {
    it('places initial categories first, custom categories in the middle, and その他 at the very bottom', () => {
      const input: Category[] = [
        { id: 'c-other', kind: 'expense', name: 'その他', color: '#666', order: 10, isCustom: false },
        { id: 'c-food', kind: 'expense', name: '食費', color: '#f00', order: 1, isCustom: false },
        { id: 'c-custom-2', kind: 'expense', name: 'サウナ', color: '#00f', order: 20, isCustom: true, createdAt: '2026-09-02T00:00:00Z' },
        { id: 'c-travel', kind: 'expense', name: '交通費', color: '#0f0', order: 2, isCustom: false },
        { id: 'c-custom-1', kind: 'expense', name: '本・書籍', color: '#0ff', order: 15, isCustom: true, createdAt: '2026-09-01T00:00:00Z' },
      ];

      const sorted = sortCategories(input);
      expect(sorted.map((c) => c.name)).toEqual([
        '食費',
        '交通費',
        '本・書籍',
        'サウナ',
        'その他',
      ]);
    });
  });

  describe('Category deletion with transaction relocation', () => {
    beforeEach(async () => {
      await db.categories.clear();
      await db.transactions.clear();
      await db.budgets.clear();
    });

    it('relocates transactions to destination category and deletes budgets when category is deleted', async () => {
      const catToDelete: Category = {
        id: 'cat-to-delete',
        kind: 'expense',
        name: 'カフェ代',
        color: '#f00',
        order: 5,
        isCustom: true,
      };
      const catDest: Category = {
        id: 'cat-other',
        kind: 'expense',
        name: 'その他',
        color: '#999',
        order: 10,
        isCustom: false,
      };
      await db.categories.bulkAdd([catToDelete, catDest]);

      const tx1: Transaction = {
        id: 'tx1',
        kind: 'expense',
        amount: 800,
        categoryId: 'cat-to-delete',
        date: '2026-09-28',
        memo: 'スタバ',
        accountId: 'acc1',
        createdAt: '2026-09-28T10:00:00Z',
        updatedAt: '2026-09-28T10:00:00Z',
      };
      const tx2: Transaction = {
        id: 'tx2',
        kind: 'expense',
        amount: 550,
        categoryId: 'cat-to-delete',
        date: '2026-09-28',
        memo: 'ドトール',
        accountId: 'acc1',
        createdAt: '2026-09-28T12:00:00Z',
        updatedAt: '2026-09-28T12:00:00Z',
      };
      await db.transactions.bulkAdd([tx1, tx2]);

      const budget: Budget = {
        id: 'bud1',
        categoryId: 'cat-to-delete',
        monthlyAmount: 5000,
        updatedAt: '2026-09-28T00:00:00Z',
      };
      await db.budgets.add(budget);

      // 削除実行
      const { movedCount } = await deleteCategoryWithRelocation('cat-to-delete', 'cat-other');
      expect(movedCount).toBe(2);

      // 分類が削除されていること
      const remainingCat = await db.categories.get('cat-to-delete');
      expect(remainingCat).toBeUndefined();

      // 取引が移行先カテゴリに変更されていること
      const updatedTxs = await db.transactions.where('id').anyOf(['tx1', 'tx2']).toArray();
      expect(updatedTxs.every((t) => t.categoryId === 'cat-other')).toBe(true);

      // 予算も削除されていること
      const remainingBudget = await db.budgets.where('categoryId').equals('cat-to-delete').first();
      expect(remainingBudget).toBeUndefined();
    });
  });
});
