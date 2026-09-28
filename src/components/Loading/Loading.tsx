import styles from './Loading.module.css';

interface LoadingProps {
  message?: string;
}

export function Loading({ message = '読み込み中...' }: LoadingProps) {
  return (
    <div className={styles.container} role="status" aria-live="polite">
      <div className={styles.spinner} aria-hidden="true" />
      <p className={styles.message}>{message}</p>
    </div>
  );
}
