import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import {
  formatBadgeCount,
  getNotificationAriaLabel,
  calculateUnreadCount,
  initFirstLaunchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../../utils/notification';
import type { Release } from '../../../data/releases';
import type { NotificationRecord, Settings } from '../../../db/models';

describe('Notifications feature logic', () => {
  describe('Badge display logic (0, 1, 99, 100, 150)', () => {
    it('returns null for 0 unread (badge is hidden)', () => {
      expect(formatBadgeCount(0)).toBeNull();
    });

    it('returns null for negative counts', () => {
      expect(formatBadgeCount(-1)).toBeNull();
    });

    it('returns "1" for 1 unread', () => {
      expect(formatBadgeCount(1)).toBe('1');
    });

    it('returns "99" for 99 unread', () => {
      expect(formatBadgeCount(99)).toBe('99');
    });

    it('returns "99+" for 100 unread', () => {
      expect(formatBadgeCount(100)).toBe('99+');
    });

    it('returns "99+" for 150 unread', () => {
      expect(formatBadgeCount(150)).toBe('99+');
    });
  });

  describe('Aria-label calculation', () => {
    it('returns "通知" when 0 unread', () => {
      expect(getNotificationAriaLabel(0)).toBe('通知');
    });

    it('returns "通知、未読3件" when 3 unread', () => {
      expect(getNotificationAriaLabel(3)).toBe('通知、未読3件');
    });

    it('reads exact unread count even when display is "99+" (100 and 150)', () => {
      expect(getNotificationAriaLabel(100)).toBe('通知、未読100件');
      expect(getNotificationAriaLabel(150)).toBe('通知、未読150件');
    });
  });

  describe('Unread count calculation', () => {
    const mockReleases: Release[] = [
      { version: '1.2.0', date: '2026-10-02', title: 'v1.2.0', items: ['A'] },
      { version: '1.1.0', date: '2026-09-01', title: 'v1.1.0', items: ['B'] },
      { version: '1.0.0', date: '2026-08-01', title: 'v1.0.0', items: ['C'] },
    ];

    it('calculates full count when no records are marked as read', () => {
      const readRecords: NotificationRecord[] = [];
      expect(calculateUnreadCount(mockReleases, readRecords)).toBe(3);
    });

    it('calculates remaining unread count when some records are read', () => {
      const readRecords: NotificationRecord[] = [
        { version: '1.0.0', readAt: '2026-08-02T00:00:00Z' },
      ];
      expect(calculateUnreadCount(mockReleases, readRecords)).toBe(2);
    });

    it('calculates 0 unread count when all records are read', () => {
      const readRecords: NotificationRecord[] = [
        { version: '1.2.0', readAt: '2026-10-02T00:00:00Z' },
        { version: '1.1.0', readAt: '2026-09-02T00:00:00Z' },
        { version: '1.0.0', readAt: '2026-08-02T00:00:00Z' },
      ];
      expect(calculateUnreadCount(mockReleases, readRecords)).toBe(0);
    });
  });

  describe('First-time launch registration in IndexedDB', () => {
    class TestDB extends Dexie {
      settings!: Dexie.Table<Settings, string>;
      notifications!: Dexie.Table<NotificationRecord, string>;

      constructor(name: string) {
        super(name);
        this.version(1).stores({
          settings: 'id',
          notifications: 'version, readAt',
        });
      }
    }

    let testDb: TestDB;
    const testReleases: Release[] = [
      { version: '1.1.0', date: '2026-10-02', title: '最新', items: ['x'] },
      { version: '1.0.0', date: '2026-09-01', title: '初回', items: ['y'] },
    ];

    beforeEach(async () => {
      testDb = new TestDB(`test-notification-${Math.random()}`);
      await testDb.open();
    });

    it('marks all releases as read when device is first launched (!initialLaunchDone)', async () => {
      // settings is empty
      const handled = await initFirstLaunchNotifications(testDb as any, testReleases);
      expect(handled).toBe(true);

      const allRead = await testDb.notifications.toArray();
      expect(allRead).toHaveLength(2);
      expect(allRead.map((r) => r.version).sort()).toEqual(['1.0.0', '1.1.0']);

      const unread = calculateUnreadCount(testReleases, allRead);
      expect(unread).toBe(0);
    });

    it('does not auto-mark new releases as read when existing user has initialLaunchDone: true', async () => {
      // Existing user settings
      await testDb.settings.put({
        id: 'app-settings',
        theme: 'light',
        passcodeEnabled: false,
        passcodeHash: null,
        passcodeSalt: null,
        passcodeIv: null,
        initialLaunchDone: true,
      });

      // User previously read 1.0.0
      await testDb.notifications.put({
        version: '1.0.0',
        readAt: '2026-09-02T00:00:00Z',
      });

      const handled = await initFirstLaunchNotifications(testDb as any, testReleases);
      expect(handled).toBe(false);

      const notifications = await testDb.notifications.toArray();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].version).toBe('1.0.0');

      // The new version 1.1.0 remains unread (1 unread item)
      const unread = calculateUnreadCount(testReleases, notifications);
      expect(unread).toBe(1);
    });

    it('marks single notification as read with markNotificationAsRead', async () => {
      await markNotificationAsRead('1.1.0', testDb as any);
      const record = await testDb.notifications.get('1.1.0');
      expect(record).toBeDefined();
      expect(record?.version).toBe('1.1.0');
      expect(record?.readAt).toBeDefined();
    });

    it('marks all notifications as read with markAllNotificationsAsRead', async () => {
      await markAllNotificationsAsRead(testReleases, testDb as any);
      const allRead = await testDb.notifications.toArray();
      expect(allRead).toHaveLength(2);
      expect(calculateUnreadCount(testReleases, allRead)).toBe(0);
    });
  });
});
