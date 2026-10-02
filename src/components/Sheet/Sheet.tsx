import { useEffect, useRef, useCallback } from 'react';
import { Icon } from '../Icon/Icon';
import styles from './Sheet.module.css';

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * 収支入力画面やパスコード設定画面で共通利用するボトムシートコンポーネント
 * - 見た目、開閉アニメーション、閉じるボタン、背景オーバーレイ、フォーカス管理、Escキーで閉じる操作を統一
 */
export function Sheet({ isOpen, onClose, title, children, size = 'md' }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      dialog.showModal();
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      dialog.close();
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className={`${styles.dialog} ${styles[size]}`}
      onClick={handleBackdropClick}
      aria-labelledby="sheet-title"
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <h2 id="sheet-title" className={styles.title}>{title}</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="閉じる"
          >
            <Icon name="close" variant="line" size={20} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.body}>
          {children}
        </div>
      </div>
    </dialog>
  );
}
