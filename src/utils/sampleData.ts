import { db } from '../db/database';
import type { Account, Transaction, Category } from '../db/models';
import { seedDatabase } from '../db/seed';

export async function insertSampleData(): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. 口座3件
  const accountBank: Account = {
    id: crypto.randomUUID(),
    name: '三井住友銀行',
    type: 'bank',
    initialBalance: 320000,
    color: '#0d9488',
    icon: 'bank',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const accountWallet: Account = {
    id: crypto.randomUUID(),
    name: 'お財布（現金）',
    type: 'cash',
    initialBalance: 18000,
    color: '#22c55e',
    icon: 'wallet',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const accountIC: Account = {
    id: crypto.randomUUID(),
    name: '交通系ICカード',
    type: 'transit_ic',
    initialBalance: 4500,
    color: '#ea580c',
    icon: 'card',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await db.accounts.bulkAdd([accountBank, accountWallet, accountIC]);

  // カテゴリ取得
  let categories: Category[] = await db.categories.toArray();
  if (categories.length === 0) {
    await seedDatabase();
    categories = await db.categories.toArray();
  }

  const findCat = (name: string, kind: 'expense' | 'income') =>
    categories.find((c) => c.name === name && c.kind === kind)?.id || null;

  const catFood = findCat('食費', 'expense');
  const catDaily = findCat('日用品', 'expense');
  const catTransit = findCat('交通費', 'expense');
  const catUtility = findCat('水道光熱費', 'expense');
  const catEntertainment = findCat('娯楽', 'expense');
  const catSalary = findCat('給与', 'income');
  const catSide = findCat('副業', 'income');

  // 2. 過去3ヶ月分の取引30件程度を生成
  const transactions: Transaction[] = [];

  const addDays = (baseDate: Date, dayOffset: number): string => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + dayOffset);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const sampleTemplates = [
    // 3ヶ月前
    { offset: -75, kind: 'income', amount: 260000, cat: catSalary, acc: accountBank.id, memo: '給与振込' },
    { offset: -72, kind: 'expense', amount: 5400, cat: catFood, acc: accountBank.id, memo: 'スーパーまとめ買い' },
    { offset: -70, kind: 'expense', amount: 880, cat: catFood, acc: accountWallet.id, memo: 'ランチ 定食' },
    { offset: -68, kind: 'expense', amount: 1680, cat: catDaily, acc: accountWallet.id, memo: 'ドラッグストア洗剤' },
    { offset: -65, kind: 'expense', amount: 2000, cat: catTransit, acc: accountIC.id, memo: 'ICチャージ・電車移動' },
    { offset: -60, kind: 'expense', amount: 8200, cat: catUtility, acc: accountBank.id, memo: '電気料金引き落とし' },
    { offset: -55, kind: 'expense', amount: 3500, cat: catEntertainment, acc: accountWallet.id, memo: '映画鑑賞・カフェ' },
    { offset: -52, kind: 'expense', amount: 1200, cat: catFood, acc: accountWallet.id, memo: 'カフェ作業' },
    { offset: -48, kind: 'expense', amount: 4600, cat: catFood, acc: accountBank.id, memo: 'スーパー買い出し' },
    { offset: -45, kind: 'income', amount: 25000, cat: catSide, acc: accountBank.id, memo: '副業執筆料' },

    // 2ヶ月前
    { offset: -44, kind: 'income', amount: 260000, cat: catSalary, acc: accountBank.id, memo: '給与振込' },
    { offset: -42, kind: 'expense', amount: 6200, cat: catFood, acc: accountBank.id, memo: '食材まとめ買い' },
    { offset: -39, kind: 'expense', amount: 950, cat: catFood, acc: accountWallet.id, memo: 'ラーメンランチ' },
    { offset: -36, kind: 'expense', amount: 2400, cat: catDaily, acc: accountWallet.id, memo: '生活雑貨・日用品' },
    { offset: -34, kind: 'expense', amount: 3000, cat: catTransit, acc: accountIC.id, memo: '電車・バス運賃' },
    { offset: -30, kind: 'expense', amount: 7900, cat: catUtility, acc: accountBank.id, memo: '水道料金引き落とし' },
    { offset: -27, kind: 'expense', amount: 4800, cat: catEntertainment, acc: accountWallet.id, memo: '書籍購入' },
    { offset: -24, kind: 'expense', amount: 1300, cat: catFood, acc: accountWallet.id, memo: 'ファミレス昼食' },
    { offset: -20, kind: 'expense', amount: 5100, cat: catFood, acc: accountBank.id, memo: 'スーパー買い出し' },
    { offset: -16, kind: 'expense', amount: 2800, cat: catEntertainment, acc: accountWallet.id, memo: 'ゲーム購入' },

    // 今月（直近15日〜本日）
    { offset: -14, kind: 'income', amount: 260000, cat: catSalary, acc: accountBank.id, memo: '今月分給与振込' },
    { offset: -12, kind: 'expense', amount: 4980, cat: catFood, acc: accountBank.id, memo: '生鮮食品スーパー' },
    { offset: -10, kind: 'expense', amount: 780, cat: catFood, acc: accountWallet.id, memo: 'お弁当購入' },
    { offset: -8, kind: 'expense', amount: 1540, cat: catDaily, acc: accountWallet.id, memo: 'シャンプー・ティッシュ' },
    { offset: -7, kind: 'expense', amount: 1000, cat: catTransit, acc: accountIC.id, memo: '往復交通費' },
    { offset: -5, kind: 'expense', amount: 8900, cat: catUtility, acc: accountBank.id, memo: 'ガス・水道料金' },
    { offset: -4, kind: 'expense', amount: 2200, cat: catEntertainment, acc: accountWallet.id, memo: 'カフェ・読書' },
    { offset: -2, kind: 'expense', amount: 3800, cat: catFood, acc: accountWallet.id, memo: '週末外食' },
    { offset: -1, kind: 'expense', amount: 1100, cat: catFood, acc: accountWallet.id, memo: 'コンビニ朝食・コーヒー' },
    { offset: 0, kind: 'expense', amount: 650, cat: catFood, acc: accountWallet.id, memo: 'ランチ サンドイッチ' },
  ] as const;

  for (let i = 0; i < sampleTemplates.length; i++) {
    const item = sampleTemplates[i];
    const dateStr = addDays(now, item.offset);
    const createdAt = `${dateStr}T12:00:00.000Z`;
    transactions.push({
      id: crypto.randomUUID(),
      kind: item.kind,
      amount: item.amount,
      categoryId: item.cat,
      accountId: item.acc,
      date: dateStr,
      memo: item.memo,
      createdAt,
      updatedAt: createdAt,
    });
  }

  await db.transactions.bulkAdd(transactions);
}

export async function resetAllData(): Promise<void> {
  await Promise.all([
    db.transactions.clear(),
    db.accounts.clear(),
    db.settings.clear(),
  ]);

  // シードデータを再投入し、初期カテゴリおよび口座を作成
  await seedDatabase();
}
