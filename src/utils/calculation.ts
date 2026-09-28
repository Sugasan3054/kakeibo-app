import type { Transaction, Account, Category } from '../db/models';
import { getPastMonths } from './date';

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
 * 予算シミュレーション：月末着地見込み額を計算する
 * 当月の経過日数比率から線形推定
 */
export function estimateMonthEndAmount(
  currentAmount: number,
  elapsedDays: number,
  totalDays: number
): number {
  if (elapsedDays === 0) return 0;
  const dailyRate = currentAmount / elapsedDays;
  return Math.round(dailyRate * totalDays);
}

/**
 * 年間貯蓄額を計算する
 * 月あたりの削減額 × 12
 */
export function calculateAnnualSavings(monthlyReduction: number): number {
  return monthlyReduction * 12;
}

/**
 * 過去Nか月の平均支出を計算する（カテゴリ指定可能）
 */
export function calculatePastMonthsAverageExpense(
  transactions: Transaction[],
  baseYearMonth: string,
  categoryId?: string | null,
  monthsCount = 3
): number {
  const pastMonths = getPastMonths(baseYearMonth, monthsCount);
  const relevantTxs = transactions.filter(
    (t) =>
      t.kind === 'expense' &&
      pastMonths.includes(t.date.substring(0, 7)) &&
      (!categoryId || t.categoryId === categoryId)
  );

  if (relevantTxs.length === 0) return 0;

  // 過去月ごとの支出合計
  const monthlySums = pastMonths.map((ym) =>
    relevantTxs
      .filter((t) => t.date.startsWith(ym))
      .reduce((sum, t) => sum + t.amount, 0)
  );

  // データが存在する月（合計>0）の月数、または指定月数で平均
  // ここでは実質的な平均としてmonthsCountで割る（0の月も0として計算）
  const total = monthlySums.reduce((a, b) => a + b, 0);
  return Math.round(total / monthsCount);
}

/**
 * 過去Nか月の平均収入を計算する
 */
export function calculatePastMonthsAverageIncome(
  transactions: Transaction[],
  baseYearMonth: string,
  monthsCount = 3
): number {
  const pastMonths = getPastMonths(baseYearMonth, monthsCount);
  const relevantTxs = transactions.filter(
    (t) => t.kind === 'income' && pastMonths.includes(t.date.substring(0, 7))
  );

  if (relevantTxs.length === 0) return 0;

  const total = relevantTxs.reduce((sum, t) => sum + t.amount, 0);
  return Math.round(total / monthsCount);
}

/**
 * 有効な想定月収を決定する
 * 設定値があれば優先、なければ過去平均、いずれもなければnull
 */
export function getEffectiveMonthlyIncome(
  expectedMonthlyIncome: number | null | undefined,
  pastMonthsAverageIncome: number
): number | null {
  if (expectedMonthlyIncome !== null && expectedMonthlyIncome !== undefined && expectedMonthlyIncome > 0) {
    return expectedMonthlyIncome;
  }
  if (pastMonthsAverageIncome > 0) {
    return pastMonthsAverageIncome;
  }
  return null;
}

/**
 * 予算シミュレータ：スライダーの上限額を計算する
 * - 保存済み予算の2倍
 * - 予算未設定の場合は過去3か月の平均支出の2倍
 * - それもなければ50,000円
 * - 500円単位に丸める
 */
export function calculateSliderMax(
  savedBudgetAmount: number | null | undefined,
  past3MonthsAvgExpense: number
): number {
  let rawMax: number;
  if (savedBudgetAmount !== null && savedBudgetAmount !== undefined && savedBudgetAmount > 0) {
    rawMax = savedBudgetAmount * 2;
  } else if (past3MonthsAvgExpense > 0) {
    rawMax = past3MonthsAvgExpense * 2;
  } else {
    rawMax = 50000;
  }

  // 最低50,000円を保証し、500円単位で切り上げ/丸め
  const adjusted = Math.max(50000, Math.ceil(rawMax / 500) * 500);
  return adjusted;
}

/**
 * 貯蓄見込みを計算する（月間および年間）
 */
export function calculateSavingsEstimate(
  effectiveMonthlyIncome: number | null,
  totalSimBudget: number
): { monthlySavings: number | null; annualSavings: number | null } {
  if (effectiveMonthlyIncome === null) {
    return { monthlySavings: null, annualSavings: null };
  }
  const monthlySavings = effectiveMonthlyIncome - totalSimBudget;
  const annualSavings = monthlySavings * 12;
  return { monthlySavings, annualSavings };
}

/**
 * 保存済み予算との差額を計算する
 * (保存済み予算合計 - 仮の月予算合計)
 * 正の値: 削減
 * 負の値: 増加
 */
export function calculateBudgetDifference(
  savedTotalBudget: number,
  simTotalBudget: number
): number {
  return savedTotalBudget - simTotalBudget;
}

/**
 * 予算シミュレーション：状況コメント判定用の分類ステータス
 */
export interface BudgetCategoryStatus {
  categoryId: string;
  categoryName: string;
  budgetAmount: number | null;
  spentAmount: number;
  projectedAmount: number;
}

export interface BudgetCommentResult {
  status: 'overspent' | 'projected_over' | 'ok' | 'no_budget';
  text: string;
  icon: 'attention' | 'check' | 'information';
}

/**
 * 予算シミュレーションの状況コメントを判定する
 * 1. 使用額が予算を超えている分類がある
 * 2. 今のペースだと月末に予算超過が見込まれる分類がある
 * 3. 予算内に収まる見込み
 * 4. 予算未設定
 */
export function getBudgetStatusComment(
  categoryStatuses: BudgetCategoryStatus[]
): BudgetCommentResult {
  const activeBudgets = categoryStatuses.filter(
    (c) => c.budgetAmount !== null && c.budgetAmount > 0
  );

  if (activeBudgets.length === 0) {
    return {
      status: 'no_budget',
      text: '予算が未設定です。タップして設定しましょう',
      icon: 'information',
    };
  }

  // 1. 使用額が予算を超えている分類がある
  const overspentList = activeBudgets
    .filter((c) => c.spentAmount > (c.budgetAmount ?? 0))
    .map((c) => ({
      ...c,
      diff: c.spentAmount - (c.budgetAmount ?? 0),
    }))
    .sort((a, b) => b.diff - a.diff);

  if (overspentList.length > 0) {
    const first = overspentList[0];
    const otherCount = overspentList.length - 1;
    const detail =
      otherCount > 0
        ? `${first.categoryName} +${first.diff.toLocaleString()}円 ほか${otherCount}件`
        : `${first.categoryName} +${first.diff.toLocaleString()}円`;

    return {
      status: 'overspent',
      text: `予算を超えている項目があります（${detail}）`,
      icon: 'attention',
    };
  }

  // 2. 今のペースだと月末に予算超過が見込まれる分類がある
  const projectedOverList = activeBudgets
    .filter((c) => c.projectedAmount > (c.budgetAmount ?? 0))
    .map((c) => ({
      ...c,
      diff: c.projectedAmount - (c.budgetAmount ?? 0),
    }))
    .sort((a, b) => b.diff - a.diff);

  if (projectedOverList.length > 0) {
    const first = projectedOverList[0];
    const roundedDiff = Math.round(first.diff / 100) * 100;
    return {
      status: 'projected_over',
      text: `このままだと${first.categoryName}が月末に約${roundedDiff.toLocaleString()}円超過する見込みです`,
      icon: 'attention',
    };
  }

  // 3. 上記に該当しない
  return {
    status: 'ok',
    text: '今のペースなら予算内に収まる見込みです',
    icon: 'check',
  };
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

