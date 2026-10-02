import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RELEASES, formatReleaseDate } from '../../data/releases';
import { useNotifications } from '../../utils/notification';
import { Icon } from '../../components/Icon/Icon';
import styles from './NotificationDetailPage.module.css';

export function NotificationDetailPage() {
  const { version } = useParams<{ version: string }>();
  const navigate = useNavigate();
  const { markAsRead } = useNotifications();

  const release = RELEASES.find((r) => r.version === version);

  // 画面を開いたら自動的に既読にする
  useEffect(() => {
    if (version) {
      markAsRead(version);
    }
  }, [version, markAsRead]);

  if (!release) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => navigate('/notifications')}
            aria-label="通知一覧へ戻る"
          >
            <Icon name="arrow_left" size={24} aria-hidden="true" />
          </button>
          <h1 className={styles.headerTitle}>通知詳細</h1>
        </header>
        <div className={styles.notFound} role="alert">
          <p>指定された通知は見つかりませんでした。</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigate('/notifications')}
          aria-label="通知一覧へ戻る"
        >
          <Icon name="arrow_left" size={24} aria-hidden="true" />
        </button>
        <h1 className={styles.headerTitle}>通知詳細</h1>
      </header>

      <main>
        <article className={styles.article}>
          <div className={styles.metaRow}>
            <span className={styles.versionBadge}>バージョン {release.version}</span>
            <time dateTime={release.date}>{formatReleaseDate(release.date)}</time>
          </div>

          <h2 className={styles.title}>{release.title}</h2>

          <hr className={styles.divider} />

          <h3 className={styles.sectionHeading}>変更内容</h3>
          <ul className={styles.itemsList} aria-label="更新内容の箇条書き">
            {release.items.map((item, index) => (
              <li key={index} className={styles.itemText}>
                {item}
              </li>
            ))}
          </ul>
        </article>
      </main>
    </div>
  );
}
