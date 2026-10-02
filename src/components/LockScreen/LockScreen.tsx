import { useState, useEffect, type FormEvent } from 'react';
import { db } from '../../db/database';
import { processPasscodeAttempt, getRemainingLockSeconds } from '../../utils/passcode';
import { resetAllData } from '../../utils/sampleData';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';
import { Icon } from '../Icon/Icon';
import styles from './LockScreen.module.css';

interface LockScreenProps {
  passcodeHash: string;
  passcodeSalt: string;
  onUnlock: () => void;
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // 初期化確認ダイアログ（2段階）
  const [showResetConfirm1, setShowResetConfirm1] = useState(false);
  const [showResetConfirm2, setShowResetConfirm2] = useState(false);

  // 初回および定期的なロック残秒数チェック
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const checkLockStatus = async () => {
      const s = await db.settings.get('app-settings');
      const rem = getRemainingLockSeconds(s?.passcodeLockedUntil);
      setRemainingSeconds(rem);
    };

    checkLockStatus();

    timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          checkLockStatus();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputCode || remainingSeconds > 0) return;

    setLoading(true);
    setError('');

    try {
      const result = await processPasscodeAttempt(db, inputCode);
      if (result.success) {
        onUnlock();
      } else {
        setError(result.error || 'パスコードが正しくありません');
        setInputCode('');
        if (result.remainingSeconds > 0) {
          setRemainingSeconds(result.remainingSeconds);
        }
      }
    } catch {
      setError('認証処理に失敗しました');
      setInputCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleResetExecute = async () => {
    try {
      await resetAllData();
      setShowResetConfirm2(false);
      window.location.reload();
    } catch (err) {
      console.error('Failed to reset data:', err);
      setError('データの初期化に失敗しました');
    }
  };

  const isLocked = remainingSeconds > 0;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="パスコード認証">
      <div className={styles.card}>
        <div className={styles.iconWrap} aria-hidden="true">
          <Icon name="lock" variant="fill" size={48} />
        </div>
        <h1 className={styles.title}>パスコードを入力</h1>
        <p className={styles.subtitle}>家計簿アプリのロックを解除してください</p>

        {isLocked && (
          <div className={styles.lockBanner} role="alert">
            連続で誤入力したため一時ロックされています。
            <br />
            あと <strong>{remainingSeconds}</strong> 秒お待ちください
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputWrap}>
            <input
              type={showPassword ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={inputCode}
              onChange={(e) => {
                setInputCode(e.target.value.replace(/[^0-9]/g, ''));
                setError('');
              }}
              placeholder="••••"
              className={styles.input}
              autoFocus
              disabled={isLocked || loading}
              aria-label="パスコード"
            />
            <button
              type="button"
              className={styles.toggleBtn}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'パスコードを隠す' : 'パスコードを表示する'}
            >
              {showPassword ? '非表示' : '表示'}
            </button>
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <button
            type="submit"
            className={styles.button}
            disabled={loading || inputCode.length < 4 || isLocked}
          >
            {loading ? '確認中...' : isLocked ? `ロック中（${remainingSeconds}秒）` : '解除する'}
          </button>
        </form>

        {/* パスコードを忘れた場合 */}
        <div className={styles.forgotWrap}>
          <p className={styles.forgotTitle}>パスコードを忘れた場合</p>
          <p className={styles.forgotText}>
            パスコードを忘れるとデータを復元できません。アプリを再度利用するには、すべてのデータを削除して初期化する必要があります。
          </p>
          <button
            type="button"
            className={styles.forgotBtn}
            onClick={() => setShowResetConfirm1(true)}
          >
            データを削除して初期化する...
          </button>
        </div>
      </div>

      {/* 初期化確認ダイアログ（段階1） */}
      <ConfirmDialog
        isOpen={showResetConfirm1}
        title="すべてのデータを初期化"
        message="パスコードを忘れた場合、データを復元することはできません。登録されたすべての口座、取引履歴、カスタム分類、設定が削除され、初期状態に戻ります。本当によろしいですか？"
        confirmLabel="次へ（最終確認）"
        cancelLabel="キャンセル"
        variant="danger"
        onConfirm={() => {
          setShowResetConfirm1(false);
          setShowResetConfirm2(true);
        }}
        onCancel={() => setShowResetConfirm1(false)}
      />

      {/* 初期化確認ダイアログ（段階2・最終確認） */}
      <ConfirmDialog
        isOpen={showResetConfirm2}
        title="最終確認：データ初期化の実行"
        message="本当にすべてのデータを初期化してよろしいですか？この操作は取り消せません。"
        confirmLabel="初期化を実行する"
        cancelLabel="キャンセル"
        variant="danger"
        onConfirm={handleResetExecute}
        onCancel={() => setShowResetConfirm2(false)}
      />
    </div>
  );
}
