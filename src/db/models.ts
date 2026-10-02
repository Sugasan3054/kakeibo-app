export type AccountType = 'cash' | 'transit_ic' | 'bank' | 'e_money' | 'other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  color: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

export type TransactionKind = 'expense' | 'income' | 'adjustment';

export interface Transaction {
  id: string;
  kind: TransactionKind;
  amount: number;
  categoryId: string | null;
  date: string; // 'YYYY-MM-DD'
  memo: string;
  accountId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  kind: 'expense' | 'income';
  name: string;
  color: string;
  order: number;
  isCustom?: boolean;
  createdAt?: string;
}

export interface NotificationRecord {
  version: string; // バージョン番号をIDとする
  readAt: string; // 既読にした日時（ISO 8601）
}

export interface Settings {
  id: string;
  theme: 'light' | 'dark';
  passcodeEnabled: boolean;
  passcodeHash: string | null;
  passcodeSalt: string | null;
  passcodeIv: string | null;
  initialLaunchDone: boolean;
  passcodeFailedAttempts?: number; // 連続誤入力回数
  passcodeLockedUntil?: string | null; // ロック解除予定日時（ISO文字列）
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: '現金',
  transit_ic: '交通系IC',
  bank: '銀行口座',
  e_money: '電子マネー',
  other: 'その他',
};

export const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  cash: 'wallet',
  transit_ic: 'train',
  bank: 'bank',
  e_money: 'smartphone',
  other: 'card',
};
