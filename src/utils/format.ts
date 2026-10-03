/**
 * 金額をカンマ区切りでフォーマットする
 */
export function formatAmount(amount: number): string {
  return Math.abs(amount).toLocaleString('ja-JP');
}

/**
 * 金額を符号付きでフォーマットする
 */
export function formatSignedAmount(amount: number, kind: 'expense' | 'income' | 'adjustment'): string {
  const formatted = formatAmount(amount);
  if (kind === 'income') return `+¥${formatted}`;
  if (kind === 'expense') return `−¥${formatted}`;
  // adjustment
  if (amount >= 0) return `+¥${formatted}`;
  return `−¥${formatAmount(Math.abs(amount))}`;
}

export interface FormatYenOptions {
  showPlusSign?: boolean;
}

/**
 * 金額表示用（¥記号付き）
 * - マイナスの場合は「−¥2,200」（U+2212）の形式（記号は¥の前）
 * - options.showPlusSign が true かつプラスの場合は「+¥2,200」
 * - それ以外は「¥2,200」
 */
export function formatYen(amount: number, options?: FormatYenOptions): string {
  const formatted = Math.abs(amount).toLocaleString('ja-JP');
  if (amount < 0) {
    return `−¥${formatted}`;
  }
  if (amount > 0 && options?.showPlusSign) {
    return `+¥${formatted}`;
  }
  return `¥${formatted}`;
}

/**
 * スクリーンリーダー読み上げ用
 * - マイナスの場合：「マイナス2,200円」
 * - プラスかつshowPlusSignの場合：「プラス2,200円」
 * - それ以外：「2,200円」
 */
export function formatYenAria(amount: number, options?: FormatYenOptions): string {
  const formatted = Math.abs(amount).toLocaleString('ja-JP');
  if (amount < 0) {
    return `マイナス${formatted}円`;
  }
  if (amount > 0 && options?.showPlusSign) {
    return `プラス${formatted}円`;
  }
  return `${formatted}円`;
}

/**
 * 入力文字列をパースして整数金額にする
 * 不正な値はnullを返す
 */
export function parseAmountInput(input: string): number | null {
  const cleaned = input.replace(/[,，、\s¥￥]/g, '');
  if (cleaned === '') return null;
  const num = Number(cleaned);
  if (!Number.isInteger(num) || num < 1) return null;
  return num;
}

/**
 * 構成比（%）を計算する
 */
export function calcPercentage(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}
