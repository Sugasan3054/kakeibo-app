/**
 * 日付ユーティリティ
 * UTC変換による日付ズレを防ぐため、すべてローカルタイム基準で処理する
 */

/**
 * 今日の日付を 'YYYY-MM-DD' 形式で返す（日本時間）
 */
export function getTodayString(): string {
  const now = new Date();
  return formatDateToString(now);
}

/**
 * Dateオブジェクトから 'YYYY-MM-DD' 文字列に変換する
 * ※ UTCではなくローカルタイムの年月日を使用
 */
export function formatDateToString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 'YYYY-MM-DD' 文字列からDateオブジェクトに変換する
 * ※ ローカルタイムとして解釈する（UTCズレ防止）
 */
export function parseDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * 日付を表示用にフォーマットする（例: 2024年1月15日）
 */
export function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

/**
 * 日付を短縮表示する（例: 1/15）
 */
export function formatDateShort(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}/${d}`;
}

/**
 * 年月を取得する（例: '2024-01'）
 */
export function getYearMonth(dateStr: string): string {
  return dateStr.substring(0, 7);
}

/**
 * 年月の表示用フォーマット（例: 2024年1月）
 */
export function formatYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  return `${y}年${m}月`;
}

/**
 * 今月の年月文字列を取得する
 */
export function getCurrentYearMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * 前月の年月文字列を取得する
 */
export function getPreviousMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  if (m === 1) {
    return `${y - 1}-12`;
  }
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

/**
 * 指定年月の直前Nか月の一覧を取得する（新しい順）
 */
export function getPastMonths(baseYearMonth: string, count = 3): string[] {
  const months: string[] = [];
  let current = baseYearMonth;
  for (let i = 0; i < count; i++) {
    current = getPreviousMonth(current);
    months.push(current);
  }
  return months;
}

/**
 * 翌月の年月文字列を取得する
 */
export function getNextMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  if (m === 12) {
    return `${y + 1}-01`;
  }
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

/**
 * 指定月の日数を取得する
 */
export function getDaysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/**
 * 今月の経過日数を取得する
 */
export function getElapsedDaysInMonth(): number {
  const now = new Date();
  return now.getDate();
}

/**
 * 指定年月の最初の日の曜日を取得する（0=日, 1=月, ...）
 */
export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

/**
 * 日付文字列が有効か検証する
 */
export function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}
