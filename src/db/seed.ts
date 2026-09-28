import { db } from './database';
import type { Category, Settings, Account } from './models';

const EXPENSE_CATEGORIES: Omit<Category, 'id'>[] = [
  { kind: 'expense', name: '食費', color: '#ef4444', order: 1 },
  { kind: 'expense', name: '日用品', color: '#f97316', order: 2 },
  { kind: 'expense', name: '交通費', color: '#eab308', order: 3 },
  { kind: 'expense', name: '住居', color: '#22c55e', order: 4 },
  { kind: 'expense', name: '水道光熱費', color: '#14b8a6', order: 5 },
  { kind: 'expense', name: '通信費', color: '#3b82f6', order: 6 },
  { kind: 'expense', name: '娯楽', color: '#8b5cf6', order: 7 },
  { kind: 'expense', name: '衣服・美容', color: '#ec4899', order: 8 },
  { kind: 'expense', name: '医療', color: '#06b6d4', order: 9 },
  { kind: 'expense', name: '交際費', color: '#f59e0b', order: 10 },
  { kind: 'expense', name: 'その他', color: '#6b7280', order: 11 },
];

const INCOME_CATEGORIES: Omit<Category, 'id'>[] = [
  { kind: 'income', name: '給与', color: '#22c55e', order: 1 },
  { kind: 'income', name: '賞与', color: '#14b8a6', order: 2 },
  { kind: 'income', name: '副業', color: '#3b82f6', order: 3 },
  { kind: 'income', name: 'お小遣い', color: '#f97316', order: 4 },
  { kind: 'income', name: '臨時収入', color: '#8b5cf6', order: 5 },
  { kind: 'income', name: 'その他', color: '#6b7280', order: 6 },
];

export async function seedDatabase(): Promise<void> {
  const categoryCount = await db.categories.count();
  if (categoryCount === 0) {
    const allCategories: Category[] = [
      ...EXPENSE_CATEGORIES.map((c) => ({
        ...c,
        id: crypto.randomUUID(),
      })),
      ...INCOME_CATEGORIES.map((c) => ({
        ...c,
        id: crypto.randomUUID(),
      })),
    ];
    await db.categories.bulkAdd(allCategories);
  }

  const accountCount = await db.accounts.count();
  if (accountCount === 0) {
    const now = new Date().toISOString();
    const defaultAccount: Account = {
      id: crypto.randomUUID(),
      name: '財布',
      type: 'cash',
      initialBalance: 0,
      color: '#22c55e',
      icon: 'wallet',
      createdAt: now,
      updatedAt: now,
    };
    await db.accounts.add(defaultAccount);
  }

  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    const defaultSettings: Settings = {
      id: 'app-settings',
      theme: 'system',
      passcodeEnabled: false,
      passcodeHash: null,
      passcodeSalt: null,
      passcodeIv: null,
      expectedMonthlyIncome: null,
      initialLaunchDone: false,
    };
    await db.settings.add(defaultSettings);
  }
}
