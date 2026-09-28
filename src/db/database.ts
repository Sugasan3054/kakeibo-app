import Dexie, { type Table } from 'dexie';
import type { Account, Transaction, Category, Budget, Settings } from './models';

export class KakeiboDB extends Dexie {
  accounts!: Table<Account, string>;
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  budgets!: Table<Budget, string>;
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
