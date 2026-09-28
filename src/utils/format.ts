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

/**
 * 金額表示用（¥記号付き）
 */
export function formatYen(amount: number): string {
  return `¥${formatAmount(amount)}`;
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
