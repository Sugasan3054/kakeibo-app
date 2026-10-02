import { useNavigate } from 'react-router-dom';
import { useNotifications, type NotificationItem } from '../../utils/notification';
import { formatReleaseDate } from '../../data/releases';
import { Icon } from '../../components/Icon/Icon';
import styles from './NotificationListPage.module.css';

export function NotificationListPage() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllAsRead } = useNotifications();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => navigate('/')}
            aria-label="ホームへ戻る"
          >
            <Icon name="arrow_left" size={24} aria-hidden="true" />
          </button>
          <h1 className={styles.title}>通知</h1>
        </div>

        <button
          type="button"
          className={styles.markAllBtn}
          onClick={() => markAllAsRead()}
          disabled={unreadCount === 0}
          aria-label="すべての通知を既読にする"
        >
          <Icon name="check" size={16} aria-hidden="true" />
          <span>すべて既読にする</span>
        </button>
      </header>

      <main>
        {notifications.length === 0 ? (
          <div className={styles.empty} role="status">
            <p className={styles.emptyText}>通知はありません</p>
          </div>
        ) : (
          <ul className={styles.list} aria-label="通知一覧">
            {notifications.map((item: NotificationItem) => {
              const previewText = item.items[0] ?? '';
              return (
                <li key={item.version}>
                  <div
                    role="button"
                    tabIndex={0}
                    className={`${styles.item} ${!item.isRead ? styles.itemUnread : ''}`}
                    onClick={() => navigate(`/notifications/${item.version}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/notifications/${item.version}`);
                      }
                    }}
                    aria-label={`${!item.isRead ? '未読: ' : ''}${item.title}、バージョン${item.version}、更新日${formatReleaseDate(item.date)}`}
                  >
                    <div className={styles.dotContainer} aria-hidden="true">
                      {!item.isRead ? (
                        <span className={styles.unreadDot} title="未読" />
                      ) : (
                        <span className={styles.readPlaceholder} />
                      )}
                    </div>

                    <div className={styles.itemContent}>
                      <div className={styles.metaRow}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className={styles.versionBadge}>v{item.version}</span>
                          {!item.isRead && (
                            <span className={styles.unreadBadge}>未読</span>
                          )}
                        </div>
                        <time dateTime={item.date}>{formatReleaseDate(item.date)}</time>
                      </div>

                      <h2
                        className={`${styles.itemTitle} ${
                          !item.isRead ? styles.titleUnread : ''
                        }`}
                      >
                        {item.title}
                      </h2>

                      {previewText && (
                        <p className={styles.preview}>
                          {previewText}
                        </p>
                      )}
                    </div>

                    <Icon
                      name="arrow_right"
                      size={18}
                      className={styles.arrowIcon}
                      aria-hidden="true"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
