import { describe, it, expect } from 'vitest';
import {
  calculateAccountBalance,
  calculateTotalAssets,
  calculateMonthlyExpenseByCategory,
  calculateMonthlyIncomeByCategory,
  calculateMonthlyExpenseTotal,
  calculateMonthlyIncomeTotal,
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
