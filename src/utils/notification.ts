import { useLiveQuery } from 'dexie-react-hooks';
import { db, type KakeiboDB } from '../db/database';
import type { NotificationRecord } from '../db/models';
import { RELEASES, type Release } from '../data/releases';

/**
 * 未読件数のバッジ表示文字列を生成する
 * - 0件以下: null（バッジ非表示）
 * - 1〜99件: 数字をそのまま表示
 * - 100件以上: '99+'
 */
export function formatBadgeCount(count: number): string | null {
  if (count <= 0) return null;
  if (count > 99) return '99+';
  return String(count);
}

/**
 * 通知ボタンの aria-label を生成する
 * - 0件: '通知'
 * - 1件以上: '通知、未読N件'（100件以上でも正確な数値を案内）
 */
export function getNotificationAriaLabel(count: number): string {
  if (count <= 0) return '通知';
  return `通知、未読${count}件`;
}

/**
 * releases と既読レコードから未読件数を計算する
 */
export function calculateUnreadCount(
  releases: Release[],
  readRecords: NotificationRecord[]
): number {
  const readVersions = new Set(readRecords.map((r) => r.version));
  return releases.filter((r) => !readVersions.has(r.version)).length;
}

/**
 * 初回起動時の端末で、過去のリリースをすべて既読として登録する
 */
export async function initFirstLaunchNotifications(
  database: KakeiboDB = db,
  releases: Release[] = RELEASES
): Promise<boolean> {
  const settings = await database.settings.get('app-settings');
  // 設定が存在しない、または initialLaunchDone が false の場合は初回起動とみなす
  const isFirstLaunch = !settings || !settings.initialLaunchDone;
  if (isFirstLaunch && releases.length > 0) {
    const now = new Date().toISOString();
    const records: NotificationRecord[] = releases.map((r) => ({
      version: r.version,
      readAt: now,
    }));
    await database.notifications.bulkPut(records);
    return true;
  }
  return false;
}

/**
 * 指定したバージョンを既読にする
 */
export async function markNotificationAsRead(
  version: string,
  database: KakeiboDB = db
): Promise<void> {
  const now = new Date().toISOString();
  await database.notifications.put({
    version,
    readAt: now,
  });
}

/**
 * すべてのリリースを既読にする
 */
export async function markAllNotificationsAsRead(
  releases: Release[] = RELEASES,
  database: KakeiboDB = db
): Promise<void> {
  const now = new Date().toISOString();
  const records: NotificationRecord[] = releases.map((r) => ({
    version: r.version,
    readAt: now,
  }));
  await database.notifications.bulkPut(records);
}

export interface NotificationItem extends Release {
  isRead: boolean;
  readAt?: string;
}

/**
 * アプリ内通知用カスタムフック
 */
export function useNotifications() {
  const readRecords = useLiveQuery(
    () => db.notifications.toArray(),
    [],
    undefined
  );

  const isLoaded = readRecords !== undefined;
  const readMap = new Map((readRecords ?? []).map((r) => [r.version, r.readAt]));

  const notifications: NotificationItem[] = RELEASES.map((rel) => ({
    ...rel,
    isRead: readMap.has(rel.version),
    readAt: readMap.get(rel.version),
  }));

  const unreadCount = calculateUnreadCount(RELEASES, readRecords ?? []);

  return {
    isLoaded,
    notifications,
    unreadCount,
    badgeText: formatBadgeCount(unreadCount),
    ariaLabel: getNotificationAriaLabel(unreadCount),
    markAsRead: (version: string) => markNotificationAsRead(version),
    markAllAsRead: () => markAllNotificationsAsRead(RELEASES),
  };
}
