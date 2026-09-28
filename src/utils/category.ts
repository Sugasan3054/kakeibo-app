import { db } from '../db/database';
import type { Category } from '../db/models';

/**
 * 2-1. 分類名の正規化
 * 全角・半角の差異（例: 'ｶﾌｪ' と 'カフェ'）をNFKCで統一し、
 * 前後の空白を除去して小文字化する。
 */
export function normalizeCategoryName(name: string): string {
  return name.trim().normalize('NFKC').toLowerCase();
}

/**
 * 分類名の重複チェック
 */
export function isCategoryNameDuplicate(
  categories: Category[],
  kind: 'expense' | 'income',
  name: string,
  excludeId?: string
): boolean {
  const normalized = normalizeCategoryName(name);
  if (!normalized) return false;
  return categories.some(
    (c) => c.kind === kind && c.id !== excludeId && normalizeCategoryName(c.name) === normalized
  );
}

/**
 * 分類名の入力バリデーション
 */
export function validateCategoryName(
  name: string,
  categories: Category[],
  kind: 'expense' | 'income',
  excludeId?: string
): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: '分類名を入力してください' };
  }
  if (trimmed.length > 20) {
    return { valid: false, error: '分類名は20文字以内で入力してください' };
  }
  if (isCategoryNameDuplicate(categories, kind, trimmed, excludeId)) {
    return { valid: false, error: `「${trimmed}」はすでにあります` };
  }
  return { valid: true };
}

/**
 * 視認性とコントラスト比（3:1以上）を確保したカラーパレット
 */
export const CATEGORY_COLOR_PALETTE = [
  '#0d9488', // Teal
  '#2563eb', // Blue
  '#7c3aed', // Purple
  '#db2777', // Pink
  '#d97706', // Amber
  '#059669', // Emerald
  '#ea580c', // Orange
  '#4f46e5', // Indigo
  '#0284c7', // Sky
  '#b91c1c', // Red
  '#c026d3', // Fuchsia
  '#475569', // Slate
] as const;

/**
 * 既存の分類と重複しにくい色を自動で割り当てる
 */
export function getNextCategoryColor(existingCategories: Category[]): string {
  const usedColors = new Set(existingCategories.map((c) => c.color.toLowerCase()));
  for (const color of CATEGORY_COLOR_PALETTE) {
    if (!usedColors.has(color.toLowerCase())) {
      return color;
    }
  }
  // 全て使用済みの場合はランダムまたは先頭
  const index = existingCategories.length % CATEGORY_COLOR_PALETTE.length;
  return CATEGORY_COLOR_PALETTE[index];
}

/**
 * 分類の並び替えルール：
 * 1. 初期分類（isCustom: false）は元の order 順
 * 2. 追加されたカスタム分類（isCustom: true）は初期分類の後ろ
 * 3. 「その他」は常に一番下にする
 */
export function sortCategories(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => {
    const aIsOther = a.name === 'その他';
    const bIsOther = b.name === 'その他';
    if (aIsOther && !bIsOther) return 1;
    if (!aIsOther && bIsOther) return -1;

    const aCustom = Boolean(a.isCustom);
    const bCustom = Boolean(b.isCustom);

    // 初期分類が先、カスタム分類が後
    if (!aCustom && bCustom) return -1;
    if (aCustom && !bCustom) return 1;

    // カスタム分類同士は作成日時またはorder順
    if (aCustom && bCustom) {
      if (a.createdAt && b.createdAt && a.createdAt !== b.createdAt) {
        return a.createdAt.localeCompare(b.createdAt);
      }
    }

    return (a.order ?? 0) - (b.order ?? 0);
  });
}

/**
 * 分類を削除し、紐づく取引を指定分類（初期値「その他」）へ移管する
 */
export async function deleteCategoryWithRelocation(
  targetCategoryId: string,
  destinationCategoryId: string | null
): Promise<{ movedCount: number }> {
  let movedCount = 0;
  await db.transaction('rw', [db.categories, db.transactions, db.budgets], async () => {
    if (destinationCategoryId) {
      const txs = await db.transactions
        .where('categoryId')
        .equals(targetCategoryId)
        .toArray();
      movedCount = txs.length;
      if (movedCount > 0) {
        await db.transactions
          .where('categoryId')
          .equals(targetCategoryId)
          .modify({
            categoryId: destinationCategoryId,
            updatedAt: new Date().toISOString(),
          });
      }
    } else {
      // 移行先が指定されていない場合は categoryId を null（またはそのまま）
      const txs = await db.transactions
        .where('categoryId')
        .equals(targetCategoryId)
        .toArray();
      movedCount = txs.length;
      if (movedCount > 0) {
        await db.transactions
          .where('categoryId')
          .equals(targetCategoryId)
          .modify({
            categoryId: null,
            updatedAt: new Date().toISOString(),
          });
      }
    }

    // 紐づく予算を削除
    await db.budgets.where('categoryId').equals(targetCategoryId).delete();

    // 分類を削除
    await db.categories.delete(targetCategoryId);
  });

  return { movedCount };
}
