import { describe, it, expect } from 'vitest';
import {
  calculateAccountBalance,
  calculateTotalAssets,
  calculateMonthlyExpenseByCategory,
  calculateMonthlyIncomeByCategory,
  calculateMonthlyExpenseTotal,
  calculateMonthlyIncomeTotal,
  estimateMonthEndAmount,
  calculatePastMonthsAverageExpense,
  calculatePastMonthsAverageIncome,
  getEffectiveMonthlyIncome,
  calculateSliderMax,
  calculateSavingsEstimate,
  calculateBudgetDifference,
  getBudgetStatusComment,
  calculateDailyTotals,
  filterTransactions,
} from '../calculation';
import type { Account, Transaction, Category } from '../../db/models';

describe('calculation utils', () => {
  const mockAccount: Account = {
    id: 'acc-1',
    name: '普通預金',
    type: 'bank',
    initialBalance: 100000,
    color: '#3b82f6',
    icon: 'bank',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };

  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      date: '2024-05-10',
      kind: 'expense',
      amount: 1500,
      categoryId: 'cat-food',
      accountId: 'acc-1',
      memo: 'ランチ',
      createdAt: '2024-05-10T12:00:00Z',
      updatedAt: '2024-05-10T12:00:00Z',
    },
    {
      id: 'tx-2',
      date: '2024-05-12',
      kind: 'expense',
      amount: 3500,
      categoryId: 'cat-food',
      accountId: 'acc-1',
      memo: 'ディナー',
      createdAt: '2024-05-12T19:00:00Z',
      updatedAt: '2024-05-12T19:00:00Z',
    },
    {
      id: 'tx-3',
      date: '2024-05-25',
      kind: 'income',
      amount: 250000,
      categoryId: 'cat-salary',
      accountId: 'acc-1',
      memo: '給与',
      createdAt: '2024-05-25T09:00:00Z',
      updatedAt: '2024-05-25T09:00:00Z',
    },
    {
      id: 'tx-4',
      date: '2024-05-28',
      kind: 'adjustment',
      amount: -500,
      categoryId: null,
      accountId: 'acc-1',
      memo: '端数調整',
      createdAt: '2024-05-28T10:00:00Z',
      updatedAt: '2024-05-28T10:00:00Z',
    },
    {
      id: 'tx-5',
      date: '2024-06-01',
      kind: 'expense',
      amount: 2000,
      categoryId: 'cat-food',
      accountId: 'acc-1',
      memo: '翌月',
      createdAt: '2024-06-01T10:00:00Z',
      updatedAt: '2024-06-01T10:00:00Z',
    },
  ];

  it('calculates account balance correctly', () => {
    // 100000 - 1500 - 3500 + 250000 - 500 - 2000 = 342500
    const balance = calculateAccountBalance(mockAccount, mockTransactions);
    expect(balance).toBe(342500);
  });

  it('calculates total assets correctly across all accounts', () => {
    const acc2: Account = {
      id: 'acc-2',
      name: '財布',
      type: 'cash',
      initialBalance: 5000,
      color: '#10b981',
      icon: 'wallet',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };
    const total = calculateTotalAssets([mockAccount, acc2], mockTransactions);
    expect(total).toBe(342500 + 5000);
  });

  it('aggregates monthly expenses by category', () => {
    const map = calculateMonthlyExpenseByCategory(mockTransactions, '2024-05');
    expect(map.get('cat-food')).toBe(5000);
    expect(map.get('cat-salary')).toBeUndefined();
  });

  it('aggregates monthly incomes by category', () => {
    const map = calculateMonthlyIncomeByCategory(mockTransactions, '2024-05');
    expect(map.get('cat-salary')).toBe(250000);
    expect(map.get('cat-food')).toBeUndefined();
  });

  it('calculates monthly totals', () => {
    expect(calculateMonthlyExpenseTotal(mockTransactions, '2024-05')).toBe(5000);
    expect(calculateMonthlyIncomeTotal(mockTransactions, '2024-05')).toBe(250000);
  });

  it('estimates month-end amount based on pace', () => {
    // 10 days elapsed, 10,000 yen spent => 1,000 yen/day. 30 days total => 30,000 yen.
    const est = estimateMonthEndAmount(10000, 10, 30);
    expect(est).toBe(30000);

    // 0 days elapsed returns 0
    expect(estimateMonthEndAmount(10000, 0, 30)).toBe(0);
  });

  describe('past months averages and budget simulation', () => {
    const historicalTxs: Transaction[] = [
      // 2024-04 (1 month ago)
      { id: 'h1', date: '2024-04-10', kind: 'expense', amount: 30000, categoryId: 'cat-food', accountId: 'acc-1', memo: '', createdAt: '', updatedAt: '' },
      { id: 'h2', date: '2024-04-15', kind: 'expense', amount: 10000, categoryId: 'cat-util', accountId: 'acc-1', memo: '', createdAt: '', updatedAt: '' },
      { id: 'h3', date: '2024-04-25', kind: 'income', amount: 240000, categoryId: 'cat-salary', accountId: 'acc-1', memo: '', createdAt: '', updatedAt: '' },
      // 2024-03 (2 months ago)
      { id: 'h4', date: '2024-03-10', kind: 'expense', amount: 25000, categoryId: 'cat-food', accountId: 'acc-1', memo: '', createdAt: '', updatedAt: '' },
      { id: 'h5', date: '2024-03-25', kind: 'income', amount: 260000, categoryId: 'cat-salary', accountId: 'acc-1', memo: '', createdAt: '', updatedAt: '' },
      // 2024-02 (3 months ago)
      { id: 'h6', date: '2024-02-10', kind: 'expense', amount: 35000, categoryId: 'cat-food', accountId: 'acc-1', memo: '', createdAt: '', updatedAt: '' },
      { id: 'h7', date: '2024-02-25', kind: 'income', amount: 250000, categoryId: 'cat-salary', accountId: 'acc-1', memo: '', createdAt: '', updatedAt: '' },
      // 2024-01 (4 months ago - should NOT be included in past 3 months)
      { id: 'h8', date: '2024-01-10', kind: 'expense', amount: 100000, categoryId: 'cat-food', accountId: 'acc-1', memo: '', createdAt: '', updatedAt: '' },
    ];

    it('calculates past 3 months average expense for category', () => {
      // cat-food in 04 (30,000) + 03 (25,000) + 02 (35,000) = 90,000 / 3 = 30,000
      const avg = calculatePastMonthsAverageExpense(historicalTxs, '2024-05', 'cat-food', 3);
      expect(avg).toBe(30000);

      // cat-util in 04 (10,000) + 03 (0) + 02 (0) = 10,000 / 3 = 3333
      const avgUtil = calculatePastMonthsAverageExpense(historicalTxs, '2024-05', 'cat-util', 3);
      expect(avgUtil).toBe(3333);

      // non-existent category
      expect(calculatePastMonthsAverageExpense(historicalTxs, '2024-05', 'cat-unknown', 3)).toBe(0);
    });

    it('calculates past 3 months average income', () => {
      // 240,000 + 260,000 + 250,000 = 750,000 / 3 = 250,000
      const avgIncome = calculatePastMonthsAverageIncome(historicalTxs, '2024-05', 3);
      expect(avgIncome).toBe(250000);
    });

    it('resolves effective monthly income with setting priority', () => {
      // When expectedMonthlyIncome is set, use it
      expect(getEffectiveMonthlyIncome(300000, 250000)).toBe(300000);
      // When expectedMonthlyIncome is null, use past average
      expect(getEffectiveMonthlyIncome(null, 250000)).toBe(250000);
      // When both are 0 or null, return null
      expect(getEffectiveMonthlyIncome(null, 0)).toBeNull();
    });

    it('calculates slider max correctly according to specs', () => {
      // 1. Saved budget exists: 2x saved budget (e.g. 30,000 -> 60,000)
      expect(calculateSliderMax(30000, 20000)).toBe(60000);

      // 2. Budget unset, but past 3 months average exists: 2x average rounded to 500
      expect(calculateSliderMax(null, 32100)).toBe(64500);

      // 3. Neither exists: default 50,000
      expect(calculateSliderMax(null, 0)).toBe(50000);

      // 4. Ensure minimum 50,000
      expect(calculateSliderMax(10000, 5000)).toBe(50000);
    });

    it('calculates savings estimate and annual savings', () => {
      // Monthly income 250,000, total budget 180,000 => monthly 70,000, annual 840,000
      const res = calculateSavingsEstimate(250000, 180000);
      expect(res.monthlySavings).toBe(70000);
      expect(res.annualSavings).toBe(840000);

      // When income is null
      const nullRes = calculateSavingsEstimate(null, 180000);
      expect(nullRes.monthlySavings).toBeNull();
      expect(nullRes.annualSavings).toBeNull();
    });

    it('calculates budget difference correctly', () => {
      // Saved 50,000, Sim 45,000 => +5,000 reduction
      expect(calculateBudgetDifference(50000, 45000)).toBe(5000);
      // Saved 50,000, Sim 55,000 => -5,000 increase
      expect(calculateBudgetDifference(50000, 55000)).toBe(-5000);
    });
  });

  describe('Section 11: Budget Status Comment', () => {
    it('returns no_budget when all budgets are unset or zero', () => {
      const res = getBudgetStatusComment([
        { categoryId: 'c1', categoryName: '食費', budgetAmount: null, spentAmount: 1000, projectedAmount: 2000 },
        { categoryId: 'c2', categoryName: '日用品', budgetAmount: 0, spentAmount: 500, projectedAmount: 1000 },
      ]);
      expect(res.status).toBe('no_budget');
      expect(res.text).toBe('予算が未設定です。タップして設定しましょう');
      expect(res.icon).toBe('information');
    });

    it('returns overspent with details when categories exceed budget', () => {
      // Single overspent category
      const res1 = getBudgetStatusComment([
        { categoryId: 'c1', categoryName: '食費', budgetAmount: 30000, spentAmount: 32300, projectedAmount: 40000 },
        { categoryId: 'c2', categoryName: '日用品', budgetAmount: 10000, spentAmount: 5000, projectedAmount: 8000 },
      ]);
      expect(res1.status).toBe('overspent');
      expect(res1.text).toBe('予算を超えている項目があります（食費 +2,300円）');
      expect(res1.icon).toBe('attention');

      // Multiple overspent categories
      const res2 = getBudgetStatusComment([
        { categoryId: 'c1', categoryName: '食費', budgetAmount: 30000, spentAmount: 32300, projectedAmount: 40000 },
        { categoryId: 'c2', categoryName: '交通費', budgetAmount: 5000, spentAmount: 6000, projectedAmount: 7000 },
        { categoryId: 'c3', categoryName: '日用品', budgetAmount: 10000, spentAmount: 5000, projectedAmount: 8000 },
      ]);
      expect(res2.status).toBe('overspent');
      expect(res2.text).toBe('予算を超えている項目があります（食費 +2,300円 ほか1件）');
    });

    it('returns projected_over when not yet overspent but projected to exceed at month-end', () => {
      const res = getBudgetStatusComment([
        { categoryId: 'c1', categoryName: '食費', budgetAmount: 30000, spentAmount: 20000, projectedAmount: 34000 },
        { categoryId: 'c2', categoryName: '日用品', budgetAmount: 10000, spentAmount: 3000, projectedAmount: 6000 },
      ]);
      expect(res.status).toBe('projected_over');
      expect(res.text).toBe('このままだと食費が月末に約4,000円超過する見込みです');
      expect(res.icon).toBe('attention');
    });

    it('returns ok when current and projected spending are within budget', () => {
      const res = getBudgetStatusComment([
        { categoryId: 'c1', categoryName: '食費', budgetAmount: 30000, spentAmount: 15000, projectedAmount: 28000 },
        { categoryId: 'c2', categoryName: '日用品', budgetAmount: 10000, spentAmount: 3000, projectedAmount: 8000 },
      ]);
      expect(res.status).toBe('ok');
      expect(res.text).toBe('今のペースなら予算内に収まる見込みです');
      expect(res.icon).toBe('check');
    });
  });

  describe('Section 11: Daily totals aggregation', () => {
    const txs: Transaction[] = [
      { id: '1', date: '2024-05-10', kind: 'income', amount: 50000, categoryId: null, accountId: 'acc-1', memo: '', createdAt: '2024-05-10', updatedAt: '2024-05-10' },
      { id: '2', date: '2024-05-10', kind: 'expense', amount: 3000, categoryId: 'c1', accountId: 'acc-1', memo: '', createdAt: '2024-05-10', updatedAt: '2024-05-10' },
      { id: '3', date: '2024-05-10', kind: 'expense', amount: 1500, categoryId: 'c2', accountId: 'acc-1', memo: '', createdAt: '2024-05-10', updatedAt: '2024-05-10' },
      { id: '4', date: '2024-05-10', kind: 'adjustment', amount: 2000, categoryId: null, accountId: 'acc-1', memo: '', createdAt: '2024-05-10', updatedAt: '2024-05-10' }, // should be ignored
      { id: '5', date: '2024-05-11', kind: 'expense', amount: 2000, categoryId: 'c1', accountId: 'acc-1', memo: '', createdAt: '2024-05-11', updatedAt: '2024-05-11' },
      { id: '6', date: '2024-06-01', kind: 'expense', amount: 9999, categoryId: 'c1', accountId: 'acc-1', memo: '', createdAt: '2024-06-01', updatedAt: '2024-06-01' }, // different month
    ];

    it('aggregates income and expense per day, ignoring adjustments and other months', () => {
      const dailyMap = calculateDailyTotals(txs, '2024-05');
      expect(dailyMap.size).toBe(2);
      expect(dailyMap.get('2024-05-10')).toEqual({ income: 50000, expense: 4500 });
      expect(dailyMap.get('2024-05-11')).toEqual({ income: 0, expense: 2000 });
      expect(dailyMap.get('2024-06-01')).toBeUndefined();
    });
  });

  describe('Section 11: Filter and search transactions', () => {
    const categories: Category[] = [
      { id: 'cat-food', name: '食費', kind: 'expense', color: '#ff0000', order: 1 },
      { id: 'cat-travel', name: '交通費', kind: 'expense', color: '#00ff00', order: 2 },
      { id: 'cat-salary', name: '給与', kind: 'income', color: '#0000ff', order: 3 },
    ];
    const accounts: Account[] = [
      { id: 'acc-bank', name: '三井住友銀行', type: 'bank', initialBalance: 0, color: '#000', icon: 'bank', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
      { id: 'acc-wallet', name: 'お財布', type: 'cash', initialBalance: 0, color: '#000', icon: 'wallet', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    ];
    const txs: Transaction[] = [
      { id: 't1', date: '2024-05-01', kind: 'income', amount: 250000, categoryId: 'cat-salary', accountId: 'acc-bank', memo: '5月分給与振込', createdAt: '2024-05-01T09:00:00Z', updatedAt: '2024-05-01T09:00:00Z' },
      { id: 't2', date: '2024-05-02', kind: 'expense', amount: 1200, categoryId: 'cat-food', accountId: 'acc-wallet', memo: 'ランチ カフェ', createdAt: '2024-05-02T12:00:00Z', updatedAt: '2024-05-02T12:00:00Z' },
      { id: 't3', date: '2024-05-02', kind: 'expense', amount: 3500, categoryId: 'cat-travel', accountId: 'acc-bank', memo: '新幹線切符', createdAt: '2024-05-02T14:00:00Z', updatedAt: '2024-05-02T14:00:00Z' },
      { id: 't4', date: '2024-05-03', kind: 'expense', amount: 4800, categoryId: 'cat-food', accountId: 'acc-wallet', memo: 'スーパー買い出し', createdAt: '2024-05-03T18:00:00Z', updatedAt: '2024-05-03T18:00:00Z' },
    ];

    it('searches by memo, category name, account name, and amount with or without comma', () => {
      // memo match
      expect(filterTransactions(txs, categories, accounts, { query: 'カフェ' })).toHaveLength(1);
      // category name match
      expect(filterTransactions(txs, categories, accounts, { query: '食費' })).toHaveLength(2);
      // account name match
      expect(filterTransactions(txs, categories, accounts, { query: '三井住友' })).toHaveLength(2);
      // amount without comma
      expect(filterTransactions(txs, categories, accounts, { query: '250000' })).toHaveLength(1);
      // amount with comma
      expect(filterTransactions(txs, categories, accounts, { query: '250,000' })).toHaveLength(1);
    });

    it('filters by date', () => {
      const res = filterTransactions(txs, categories, accounts, { date: '2024-05-02' });
      expect(res).toHaveLength(2);
      expect(res.map((r) => r.id)).toEqual(['t2', 't3']);
    });

    it('filters by kind', () => {
      expect(filterTransactions(txs, categories, accounts, { kind: 'income' })).toHaveLength(1);
      expect(filterTransactions(txs, categories, accounts, { kind: 'expense' })).toHaveLength(3);
    });

    it('filters by multiple category IDs', () => {
      const res = filterTransactions(txs, categories, accounts, { categoryIds: ['cat-travel', 'cat-salary'] });
      expect(res).toHaveLength(2);
      expect(res.map((r) => r.id)).toEqual(['t1', 't3']);
    });

    it('combines multiple filters as AND conditions', () => {
      const res = filterTransactions(txs, categories, accounts, {
        date: '2024-05-02',
        kind: 'expense',
        categoryIds: ['cat-food'],
        query: 'ランチ',
      });
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('t2');
    });
  });
});
