import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';

describe('Database Schema Migration v2 -> v3', () => {
  it('drops budgets table and removes expectedMonthlyIncome from settings', async () => {
    const dbName = `migration-test-${Date.now()}`;

    // Step 1: Initialize DB with v2 schema
    const oldDb = new Dexie(dbName);
    oldDb.version(1).stores({
      accounts: 'id, name, type, createdAt',
      transactions: 'id, kind, accountId, categoryId, date, createdAt',
      categories: 'id, kind, order',
      budgets: 'id, categoryId',
      settings: 'id',
    });
    oldDb.version(2).stores({
      accounts: 'id, name, type, createdAt',
      transactions: 'id, kind, accountId, categoryId, date, createdAt',
      categories: 'id, kind, order, isCustom',
      budgets: 'id, categoryId',
      settings: 'id',
    });

    await oldDb.open();

    // Insert legacy data into budgets and settings
    await oldDb.table('budgets').add({
      id: 'b-1',
      categoryId: 'cat-food',
      monthlyAmount: 30000,
      updatedAt: '2026-09-01T00:00:00Z',
    });

    await oldDb.table('settings').add({
      id: 'app-settings',
      theme: 'light',
      passcodeEnabled: false,
      passcodeHash: null,
      passcodeSalt: null,
      passcodeIv: null,
      expectedMonthlyIncome: 280000,
      initialLaunchDone: true,
    });

    // Verify v2 state
    const budgetCountBefore = await oldDb.table('budgets').count();
    expect(budgetCountBefore).toBe(1);
    const settingsBefore: any = await oldDb.table('settings').get('app-settings');
    expect(settingsBefore.expectedMonthlyIncome).toBe(280000);

    oldDb.close();

    // Step 2: Open with v3 schema including migration
    const newDb = new Dexie(dbName);
    newDb.version(1).stores({
      accounts: 'id, name, type, createdAt',
      transactions: 'id, kind, accountId, categoryId, date, createdAt',
      categories: 'id, kind, order',
      budgets: 'id, categoryId',
      settings: 'id',
    });
    newDb.version(2).stores({
      accounts: 'id, name, type, createdAt',
      transactions: 'id, kind, accountId, categoryId, date, createdAt',
      categories: 'id, kind, order, isCustom',
      budgets: 'id, categoryId',
      settings: 'id',
    });
    newDb.version(3).stores({
      accounts: 'id, name, type, createdAt',
      transactions: 'id, kind, accountId, categoryId, date, createdAt',
      categories: 'id, kind, order, isCustom',
      budgets: null, // Table dropped
      notifications: 'version, readAt',
      settings: 'id',
    }).upgrade(async (tx) => {
      await tx.table('settings').toCollection().modify((settings: any) => {
        if ('expectedMonthlyIncome' in settings) {
          delete settings.expectedMonthlyIncome;
        }
      });
    });

    await newDb.open();

    // Verify budgets table is dropped
    expect(newDb.tables.some((t) => t.name === 'budgets')).toBe(false);

    // Verify notifications table is added
    expect(newDb.tables.some((t) => t.name === 'notifications')).toBe(true);

    // Verify expectedMonthlyIncome is deleted from settings
    const settingsAfter: any = await newDb.table('settings').get('app-settings');
    expect(settingsAfter).toBeDefined();
    expect('expectedMonthlyIncome' in settingsAfter).toBe(false);

    newDb.close();
  });

  it('handles importing legacy backups containing budgets gracefully without errors', async () => {
    const dbName = `legacy-import-test-${Date.now()}`;
    const testDb = new Dexie(dbName);
    testDb.version(3).stores({
      accounts: 'id, name, type, createdAt',
      transactions: 'id, kind, accountId, categoryId, date, createdAt',
      categories: 'id, kind, order, isCustom',
      notifications: 'version, readAt',
      settings: 'id',
    });

    await testDb.open();

    // Legacy backup data exported before budget removal
    const legacyImportData = {
      version: 1,
      exportedAt: '2026-09-20T00:00:00Z',
      data: {
        accounts: [
          {
            id: 'acc-1',
            name: '現金',
            type: 'cash',
            initialBalance: 10000,
            color: '#22c55e',
            icon: 'wallet',
            createdAt: '2026-09-01T00:00:00Z',
            updatedAt: '2026-09-01T00:00:00Z',
          },
        ],
        transactions: [],
        categories: [
          {
            id: 'cat-1',
            kind: 'expense',
            name: '食費',
            color: '#ef4444',
            order: 1,
          },
        ],
        budgets: [
          {
            id: 'bud-1',
            categoryId: 'cat-1',
            monthlyAmount: 30000,
            updatedAt: '2026-09-01T00:00:00Z',
          },
        ],
        settings: [],
      },
    };

    // Import logic matches SettingsPage.tsx
    const { accounts, transactions, categories: importedCats } = legacyImportData.data;

    await expect(
      testDb.transaction(
        'rw',
        testDb.table('accounts'),
        testDb.table('transactions'),
        testDb.table('categories'),
        async () => {
          await testDb.table('accounts').clear();
          await testDb.table('transactions').clear();
          await testDb.table('categories').clear();
          if (accounts) await testDb.table('accounts').bulkAdd(accounts);
          if (transactions) await testDb.table('transactions').bulkAdd(transactions);
          if (importedCats) await testDb.table('categories').bulkAdd(importedCats);
        }
      )
    ).resolves.not.toThrow();

    const importedAccs = await testDb.table('accounts').toArray();
    expect(importedAccs).toHaveLength(1);
    expect(importedAccs[0].id).toBe('acc-1');

    testDb.close();
  });
});
