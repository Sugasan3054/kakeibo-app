import type { Transaction, Account, Category } from '../db/models';

/**
 * 口座の現在残高を計算する
 * 現在残高 = 初期残高 + 収入 - 支出 + 残高調整
 */
export function calculateAccountBalance(account: Account, transactions: Transaction[]): number {
  const accountTransactions = transactions.filter((t) => t.accountId === account.id);
  let balance = account.initialBalance;

  for (const t of accountTransactions) {
    switch (t.kind) {
      case 'income':
        balance += t.amount;
        break;
      case 'expense':
        balance -= t.amount;
        break;
      case 'adjustment':
        balance += t.amount; // adjustmentのamountは符号付き
        break;
    }
  }

  return balance;
}

/**
 * 全口座の総資産を計算する
 */
export function calculateTotalAssets(accounts: Account[], transactions: Transaction[]): number {
  return accounts.reduce((total, account) => {
    return total + calculateAccountBalance(account, transactions);
  }, 0);
}

/**
 * 指定月の支出合計を分類別に集計する
 * adjustment は集計に含めない
 */
export function calculateMonthlyExpenseByCategory(
  transactions: Transaction[],
  yearMonth: string
): Map<string, number> {
  const result = new Map<string, number>();

  for (const t of transactions) {
    if (t.kind !== 'expense') continue;
    if (!t.date.startsWith(yearMonth)) continue;
    if (t.categoryId === null) continue;

    const current = result.get(t.categoryId) || 0;
    result.set(t.categoryId, current + t.amount);
  }

  return result;
}

/**
 * 指定月の収入合計を分類別に集計する
 */
export function calculateMonthlyIncomeByCategory(
  transactions: Transaction[],
  yearMonth: string
): Map<string, number> {
  const result = new Map<string, number>();

  for (const t of transactions) {
    if (t.kind !== 'income') continue;
    if (!t.date.startsWith(yearMonth)) continue;
    if (t.categoryId === null) continue;

    const current = result.get(t.categoryId) || 0;
    result.set(t.categoryId, current + t.amount);
  }

  return result;
}

/**
 * 指定月の支出合計を計算する（adjustment除外）
 */
export function calculateMonthlyExpenseTotal(
  transactions: Transaction[],
  yearMonth: string
): number {
  return transactions
    .filter((t) => t.kind === 'expense' && t.date.startsWith(yearMonth))
    .reduce((sum, t) => sum + t.amount, 0);
}

/**
 * 指定月の収入合計を計算する（adjustment除外）
 */
export function calculateMonthlyIncomeTotal(
  transactions: Transaction[],
  yearMonth: string
): number {
  return transactions
    .filter((t) => t.kind === 'income' && t.date.startsWith(yearMonth))
    .reduce((sum, t) => sum + t.amount, 0);
}





/**
 * カレンダー用：日別の収入合計と支出合計を集計する（残高調整は除外）
 */
export interface DailyTotal {
  income: number;
  expense: number;
}

export function calculateDailyTotals(
  transactions: Transaction[],
  yearMonth: string
): Map<string, DailyTotal> {
  const map = new Map<string, DailyTotal>();

  for (const t of transactions) {
    if (t.kind === 'adjustment') continue;
    if (!t.date.startsWith(yearMonth)) continue;

    const existing = map.get(t.date) || { income: 0, expense: 0 };
    if (t.kind === 'income') {
      existing.income += t.amount;
    } else if (t.kind === 'expense') {
      existing.expense += t.amount;
    }
    map.set(t.date, existing);
  }

  return map;
}

/**
 * 入出金履歴の検索と絞り込み
 */
export interface TransactionFilterOptions {
  query?: string;
  date?: string | null;
  kind?: 'all' | 'expense' | 'income';
  categoryIds?: string[];
}

export function filterTransactions(
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[],
  options: TransactionFilterOptions
): Transaction[] {
  const categoryMap = new Map<string, string>(categories.map((c) => [c.id, c.name]));
  const accountMap = new Map<string, string>(accounts.map((a) => [a.id, a.name]));

  const queryTrimmed = options.query?.trim().toLowerCase() || '';
  const queryWithoutComma = queryTrimmed.replace(/,/g, '');

  return transactions.filter((t) => {
    // 日付絞り込み
    if (options.date && t.date !== options.date) {
      return false;
    }

    // 種別絞り込み
    if (options.kind && options.kind !== 'all') {
      if (t.kind !== options.kind) {
        return false;
      }
    }

    // 分類絞り込み（複数選択）
    if (options.categoryIds && options.categoryIds.length > 0) {
      if (!t.categoryId || !options.categoryIds.includes(t.categoryId)) {
        return false;
      }
    }

    // 検索クエリ
    if (queryTrimmed) {
      const memoMatch = t.memo?.toLowerCase().includes(queryTrimmed) || false;
      const categoryName = t.categoryId ? (categoryMap.get(t.categoryId)?.toLowerCase() || '') : '';
      const categoryMatch = categoryName.includes(queryTrimmed);
      const accountName = accountMap.get(t.accountId)?.toLowerCase() || '';
      const accountMatch = accountName.includes(queryTrimmed);

      // 金額マッチ：カンマ有無にかかわらず一致
      const amountStr = t.amount.toString();
      const formattedAmount = t.amount.toLocaleString();
      const amountMatch =
        amountStr.includes(queryWithoutComma) ||
        formattedAmount.includes(queryTrimmed);

      if (!memoMatch && !categoryMatch && !accountMatch && !amountMatch) {
        return false;
      }
    }

    return true;
  });
}

