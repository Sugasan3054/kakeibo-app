import type { ReactNode } from 'react';
import { HomePage } from '../features/home/HomePage';
import { TransactionsPage } from '../features/transactions/TransactionsPage';
import { ReportPage } from '../features/report/ReportPage';
import { AccountsPage } from '../features/accounts/AccountsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { NotificationListPage } from '../features/notifications/NotificationListPage';
import { NotificationDetailPage } from '../features/notifications/NotificationDetailPage';

export interface AppRoute {
  path: string;
  element: ReactNode;
  showFab: boolean;
}

/**
 * アプリのルート定義
 * 修正3: ホーム、入出金、家計簿の3画面でのみFAB（収支登録ボタン）を表示する
 * 口座画面、設定画面とその配下、通知画面では表示しない
 */
export const APP_ROUTES: AppRoute[] = [
  { path: '/', element: <HomePage />, showFab: true },
  { path: '/transactions', element: <TransactionsPage />, showFab: true },
  { path: '/report', element: <ReportPage />, showFab: true },
  { path: '/accounts', element: <AccountsPage />, showFab: false },
  { path: '/settings', element: <SettingsPage />, showFab: false },
  { path: '/notifications', element: <NotificationListPage />, showFab: false },
  { path: '/notifications/:version', element: <NotificationDetailPage />, showFab: false },
];
