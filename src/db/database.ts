import Dexie, { type Table } from 'dexie';
import type { Account, Transaction, Category, Settings, NotificationRecord } from './models';

export class KakeiboDB extends Dexie {
  accounts!: Table<Account, string>;
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  notifications!: Table<NotificationRecord, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('kakeibo-db');
    this.version(1).stores({
      accounts: 'id, name, type, createdAt',
      transactions: 'id, kind, accountId, categoryId, date, createdAt',
      categories: 'id, kind, order',
      budgets: 'id, categoryId',
      settings: 'id',
    });

    this.version(2).stores({
      accounts: 'id, name, type, createdAt',
      transactions: 'id, kind, accountId, categoryId, date, createdAt',
      categories: 'id, kind, order, isCustom',
      budgets: 'id, categoryId',
      settings: 'id',
    }).upgrade(async (tx) => {
      // 既存の分類に isCustom: false を設定
      await tx.table('categories').toCollection().modify((category) => {
        if (category.isCustom === undefined) {
          category.isCustom = false;
        }
        if (!category.createdAt) {
          category.createdAt = new Date().toISOString();
        }
      });
      // 既存の設定に 'system' があれば 'light' または 'dark' に移行
      await tx.table('settings').toCollection().modify((settings) => {
        if (settings.theme === 'system' || !settings.theme) {
          const prefersDark =
            typeof window !== 'undefined' &&
            window.matchMedia &&
            window.matchMedia('(prefers-color-scheme: dark)').matches;
          settings.theme = prefersDark ? 'dark' : 'light';
        }
      });
    });

    this.version(3).stores({
      accounts: 'id, name, type, createdAt',
      transactions: 'id, kind, accountId, categoryId, date, createdAt',
      categories: 'id, kind, order, isCustom',
      budgets: null,
      notifications: 'version, readAt',
      settings: 'id',
    }).upgrade(async (tx) => {
      // settings から expectedMonthlyIncome を削除
      await tx.table('settings').toCollection().modify((settings: any) => {
        if ('expectedMonthlyIncome' in settings) {
          delete settings.expectedMonthlyIncome;
        }
      });
    });
  }
}

export const db = new KakeiboDB();

// リクエスト永続化ストレージ
export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    return await navigator.storage.persist();
  }
  return false;
}
