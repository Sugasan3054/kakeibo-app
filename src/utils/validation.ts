/**
 * バリデーションユーティリティ
 */

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * 金額のバリデーション
 */
export function validateAmount(value: string | number): string | null {
  let num: number;
  if (typeof value === 'number') {
    num = value;
  } else {
    const cleaned = value.replace(/[,，、\s¥￥]/g, '');
    if (cleaned === '') return '金額を入力してください';
    num = Number(cleaned);
  }

  if (isNaN(num)) return '有効な数値を入力してください';
  if (!Number.isInteger(num)) return '整数で入力してください';
  if (num < 1) return '1円以上で入力してください';
  if (num > 1000000000) return '金額が上限を超えています';
  return null;
}

/**
 * 口座名のバリデーション
 */
export function validateAccountName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed === '') return '口座名を入力してください';
  if (trimmed.length > 50) return '口座名は50文字以内で入力してください';
  return null;
}

/**
 * 分類名のバリデーション
 */
export function validateCategoryName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed === '') return '分類名を入力してください';
  if (trimmed.length > 30) return '分類名は30文字以内で入力してください';
  return null;
}

/**
 * メモのバリデーション
 */
export function validateMemo(memo: string): string | null {
  if (memo.length > 100) return '内容は100文字以内で入力してください';
  return null;
}

/**
 * 入力値のサニタイズ（XSS対策）
 * HTMLエンティティをエスケープする
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 表示用テキストのサニタイズ
 * Reactは自動的にエスケープするため、dangerouslySetInnerHTMLを使わない限り安全
 * この関数はデータ保存時に使用する
 */
export function sanitizeForStorage(input: string): string {
  return input.trim().substring(0, 100);
}
