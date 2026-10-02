import { useState, useEffect, useRef } from 'react';
import { db } from '../../db/database';
import { useSettings } from '../../hooks/useSettings';
import { useToast } from '../../components/Toast/Toast';
import { Sheet } from '../../components/Sheet/Sheet';
import { SegmentControl } from '../../components/SegmentControl/SegmentControl';
import { Icon } from '../../components/Icon/Icon';
import {
  processPasscodeAttempt,
  getRemainingLockSeconds,
} from '../../utils/passcode';
import styles from './PasscodeSheet.module.css';

export interface PasscodeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'change' | 'remove';
  onForgotPassword: () => void;
}

export function PasscodeSheet({
  isOpen,
  onClose,
  initialTab = 'change',
  onForgotPassword,
}: PasscodeSheetProps) {
  const { settings, setPasscode, changePasscode, removePasscode } = useSettings();
  const { showToast } = useToast();

  const isEnabled = settings.passcodeEnabled;
  const [activeTab, setActiveTab] = useState<'change' | 'remove'>('change');

  // パスコード入力状態
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');

  // 表示・非表示トグル
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // エラー状態
  const [currentError, setCurrentError] = useState('');
  const [newError, setNewError] = useState('');
  const [confirmError, setConfirmError] = useState('');

  // 送信・ロック状態
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockRemainingSeconds, setLockRemainingSeconds] = useState(0);

  // 自動フォーカス用ref
  const initialInputRef = useRef<HTMLInputElement>(null);

  // モーダルオープン時の初期化
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setCurrentPasscode('');
      setNewPasscode('');
      setConfirmPasscode('');
      setCurrentError('');
      setNewError('');
      setConfirmError('');
      setIsSubmitting(false);

      const checkLock = async () => {
        const s = await db.settings.get('app-settings');
        setLockRemainingSeconds(getRemainingLockSeconds(s?.passcodeLockedUntil));
      };
      checkLock();

      const timer = setTimeout(() => {
        initialInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialTab]);

  // ロック残秒数カウントダウン
  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      setLockRemainingSeconds((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  // タブ切り替え時の入力クリア
  const handleTabChange = (tab: 'change' | 'remove') => {
    setActiveTab(tab);
    setCurrentPasscode('');
    setNewPasscode('');
    setConfirmPasscode('');
    setCurrentError('');
    setNewError('');
    setConfirmError('');
  };

  // 1. パスコード新規設定
  const handleSetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    let hasError = false;
    if (newPasscode.length < 4 || newPasscode.length > 6) {
      setNewError('パスコードは4〜6桁で設定してください');
      hasError = true;
    } else if (!/^\d+$/.test(newPasscode)) {
      setNewError('パスコードは数字のみで設定してください');
      hasError = true;
    } else {
      setNewError('');
    }

    if (newPasscode !== confirmPasscode) {
      setConfirmError('パスコードが一致しません');
      hasError = true;
    } else {
      setConfirmError('');
    }

    if (hasError) return;

    try {
      setIsSubmitting(true);
      await setPasscode(newPasscode);
      onClose();
      showToast('パスコードを設定しました');
    } catch (err) {
      console.error('Failed to set passcode:', err);
      showToast('パスコードの設定に失敗しました', { type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. パスコード変更
  const handleChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || lockRemainingSeconds > 0) return;

    let hasError = false;
    if (!currentPasscode) {
      setCurrentError('現在のパスコードを入力してください');
      hasError = true;
    } else {
      setCurrentError('');
    }

    if (newPasscode.length < 4 || newPasscode.length > 6) {
      setNewError('パスコードは4〜6桁で設定してください');
      hasError = true;
    } else if (!/^\d+$/.test(newPasscode)) {
      setNewError('パスコードは数字のみで設定してください');
      hasError = true;
    } else {
      setNewError('');
    }

    if (newPasscode !== confirmPasscode) {
      setConfirmError('パスコードが一致しません');
      hasError = true;
    } else {
      setConfirmError('');
    }

    if (hasError) return;

    try {
      setIsSubmitting(true);
      // 誤入力回数・ロックの共通判定
      const attempt = await processPasscodeAttempt(db, currentPasscode);
      if (!attempt.success) {
        setCurrentError(attempt.error || 'パスコードが正しくありません');
        if (attempt.remainingSeconds > 0) {
          setLockRemainingSeconds(attempt.remainingSeconds);
        }
        setIsSubmitting(false);
        return;
      }

      await changePasscode(currentPasscode, newPasscode);
      onClose();
      showToast('パスコードを変更しました');
    } catch (err: unknown) {
      console.error('Failed to change passcode:', err);
      const message = err instanceof Error ? err.message : 'パスコードの変更に失敗しました';
      setCurrentError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. パスコード設定解除
  const handleRemoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || lockRemainingSeconds > 0) return;

    if (!currentPasscode) {
      setCurrentError('現在のパスコードを入力してください');
      return;
    }

    try {
      setIsSubmitting(true);
      // 誤入力回数・ロックの共通判定
      const attempt = await processPasscodeAttempt(db, currentPasscode);
      if (!attempt.success) {
        setCurrentError(attempt.error || 'パスコードが正しくありません');
        if (attempt.remainingSeconds > 0) {
          setLockRemainingSeconds(attempt.remainingSeconds);
        }
        setIsSubmitting(false);
        return;
      }

      await removePasscode(currentPasscode);
      onClose();
      showToast('パスコードを解除しました');
    } catch (err: unknown) {
      console.error('Failed to remove passcode:', err);
      const message = err instanceof Error ? err.message : 'パスコードの解除に失敗しました';
      setCurrentError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sheetTitle = isEnabled ? 'パスコード設定' : 'パスコードを設定';

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={sheetTitle} size="md">
      {!isEnabled ? (
        /* パスコード未設定時 */
        <form className={styles.form} onSubmit={handleSetSubmit} noValidate>
          <div className={styles.headingWrapper}>
            <p className={styles.singleTabTitle}>パスコードを設定</p>
          </div>

          <div className={styles.warningBox}>
            <Icon name="attention" variant="fill" size={16} />
            <span>パスコードを忘れるとデータを復元できません。お忘れのないようご注意ください。</span>
          </div>

          {/* 新しいパスコード */}
          <div className={styles.field}>
            <label htmlFor="set-new-passcode" className={styles.label}>
              新しいパスコード（4〜6桁） <span className={styles.required}>*</span>
            </label>
            <div className={styles.passwordInputWrap}>
              <input
                ref={initialInputRef}
                id="set-new-passcode"
                type={showNewPassword ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={newPasscode}
                onChange={(e) => {
                  setNewPasscode(e.target.value.replace(/[^0-9]/g, ''));
                  setNewError('');
                }}
                placeholder="••••"
                className={`${styles.input} ${newError ? styles.inputError : ''}`}
                autoComplete="new-password"
                aria-invalid={!!newError}
                aria-describedby={newError ? 'set-new-error' : undefined}
              />
              <button
                type="button"
                className={styles.passwordToggleBtn}
                onClick={() => setShowNewPassword(!showNewPassword)}
                aria-label={showNewPassword ? 'パスコードを隠す' : 'パスコードを表示する'}
              >
                {showNewPassword ? '非表示' : '表示'}
              </button>
            </div>
            {newError && (
              <p id="set-new-error" className={styles.error} role="alert">
                {newError}
              </p>
            )}
          </div>

          {/* 確認用の再入力 */}
          <div className={styles.field}>
            <label htmlFor="set-confirm-passcode" className={styles.label}>
              確認用の再入力 <span className={styles.required}>*</span>
            </label>
            <div className={styles.passwordInputWrap}>
              <input
                id="set-confirm-passcode"
                type={showConfirmPassword ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={confirmPasscode}
                onChange={(e) => {
                  setConfirmPasscode(e.target.value.replace(/[^0-9]/g, ''));
                  setConfirmError('');
                }}
                placeholder="••••"
                className={`${styles.input} ${confirmError ? styles.inputError : ''}`}
                autoComplete="new-password"
                aria-invalid={!!confirmError}
                aria-describedby={confirmError ? 'set-confirm-error' : undefined}
              />
              <button
                type="button"
                className={styles.passwordToggleBtn}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'パスコードを隠す' : 'パスコードを表示する'}
              >
                {showConfirmPassword ? '非表示' : '表示'}
              </button>
            </div>
            {confirmError && (
              <p id="set-confirm-error" className={styles.error} role="alert">
                {confirmError}
              </p>
            )}
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isSubmitting || newPasscode.length < 4 || confirmPasscode.length < 4}
          >
            {isSubmitting ? '処理中…' : '設定する'}
          </button>
        </form>
      ) : (
        /* パスコード設定済み時（変更 / 設定解除） */
        <div className={styles.form}>
          <SegmentControl
            name="パスコード設定タブ"
            options={[
              { value: 'change', label: '変更' },
              { value: 'remove', label: '設定解除' },
            ]}
            value={activeTab}
            onChange={handleTabChange}
          />

          {lockRemainingSeconds > 0 && (
            <div className={styles.lockAlert} role="alert">
              連続で誤入力したため一時ロックされています。
              <br />
              あと <strong>{lockRemainingSeconds}</strong> 秒お待ちください。
            </div>
          )}

          {activeTab === 'change' ? (
            /* タブ：変更 */
            <form onSubmit={handleChangeSubmit} noValidate className={styles.form}>
              {/* 現在のパスコード */}
              <div className={styles.field}>
                <label htmlFor="change-current-passcode" className={styles.label}>
                  現在のパスコード <span className={styles.required}>*</span>
                </label>
                <div className={styles.passwordInputWrap}>
                  <input
                    ref={initialInputRef}
                    id="change-current-passcode"
                    type={showCurrentPassword ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    disabled={lockRemainingSeconds > 0}
                    value={currentPasscode}
                    onChange={(e) => {
                      setCurrentPasscode(e.target.value.replace(/[^0-9]/g, ''));
                      setCurrentError('');
                    }}
                    placeholder="••••"
                    className={`${styles.input} ${currentError ? styles.inputError : ''}`}
                    autoComplete="current-password"
                    aria-invalid={!!currentError}
                    aria-describedby={currentError ? 'change-current-error' : undefined}
                  />
                  <button
                    type="button"
                    className={styles.passwordToggleBtn}
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    aria-label={showCurrentPassword ? 'パスコードを隠す' : 'パスコードを表示する'}
                  >
                    {showCurrentPassword ? '非表示' : '表示'}
                  </button>
                </div>
                {currentError && (
                  <p id="change-current-error" className={styles.error} role="alert">
                    {currentError}
                  </p>
                )}
              </div>

              {/* 新しいパスコード */}
              <div className={styles.field}>
                <label htmlFor="change-new-passcode" className={styles.label}>
                  新しいパスコード（4〜6桁） <span className={styles.required}>*</span>
                </label>
                <div className={styles.passwordInputWrap}>
                  <input
                    id="change-new-passcode"
                    type={showNewPassword ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={newPasscode}
                    onChange={(e) => {
                      setNewPasscode(e.target.value.replace(/[^0-9]/g, ''));
                      setNewError('');
                    }}
                    placeholder="••••"
                    className={`${styles.input} ${newError ? styles.inputError : ''}`}
                    autoComplete="new-password"
                    aria-invalid={!!newError}
                    aria-describedby={newError ? 'change-new-error' : undefined}
                  />
                  <button
                    type="button"
                    className={styles.passwordToggleBtn}
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    aria-label={showNewPassword ? 'パスコードを隠す' : 'パスコードを表示する'}
                  >
                    {showNewPassword ? '非表示' : '表示'}
                  </button>
                </div>
                {newError && (
                  <p id="change-new-error" className={styles.error} role="alert">
                    {newError}
                  </p>
                )}
              </div>

              {/* 確認用の再入力 */}
              <div className={styles.field}>
                <label htmlFor="change-confirm-passcode" className={styles.label}>
                  確認用の再入力 <span className={styles.required}>*</span>
                </label>
                <div className={styles.passwordInputWrap}>
                  <input
                    id="change-confirm-passcode"
                    type={showConfirmPassword ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={confirmPasscode}
                    onChange={(e) => {
                      setConfirmPasscode(e.target.value.replace(/[^0-9]/g, ''));
                      setConfirmError('');
                    }}
                    placeholder="••••"
                    className={`${styles.input} ${confirmError ? styles.inputError : ''}`}
                    autoComplete="new-password"
                    aria-invalid={!!confirmError}
                    aria-describedby={confirmError ? 'change-confirm-error' : undefined}
                  />
                  <button
                    type="button"
                    className={styles.passwordToggleBtn}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'パスコードを隠す' : 'パスコードを表示する'}
                  >
                    {showConfirmPassword ? '非表示' : '表示'}
                  </button>
                </div>
                {confirmError && (
                  <p id="change-confirm-error" className={styles.error} role="alert">
                    {confirmError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={
                  isSubmitting ||
                  lockRemainingSeconds > 0 ||
                  currentPasscode.length < 4 ||
                  newPasscode.length < 4 ||
                  confirmPasscode.length < 4
                }
              >
                {isSubmitting ? '処理中…' : '変更する'}
              </button>

              {/* パスコードを忘れた場合 */}
              <div className={styles.forgotBox}>
                <p className={styles.forgotTitle}>パスコードを忘れた場合</p>
                <p className={styles.forgotText}>
                  パスコードを忘れるとデータを復元できません。アプリを再度利用するには「すべてのデータを削除して初期化」するしか方法がありません。
                </p>
                <button
                  type="button"
                  className={styles.forgotResetBtn}
                  onClick={() => {
                    onClose();
                    onForgotPassword();
                  }}
                >
                  すべてのデータを削除して初期化...
                </button>
              </div>
            </form>
          ) : (
            /* タブ：設定解除 */
            <form onSubmit={handleRemoveSubmit} noValidate className={styles.form}>
              {/* 注意書き */}
              <div className={styles.dangerNoticeBox}>
                <Icon name="attention" variant="fill" size={16} />
                <span>パスコードを解除すると、データは暗号化されずに保存されます。</span>
              </div>

              {/* 現在のパスコード */}
              <div className={styles.field}>
                <label htmlFor="remove-current-passcode" className={styles.label}>
                  現在のパスコード <span className={styles.required}>*</span>
                </label>
                <div className={styles.passwordInputWrap}>
                  <input
                    ref={initialInputRef}
                    id="remove-current-passcode"
                    type={showCurrentPassword ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    disabled={lockRemainingSeconds > 0}
                    value={currentPasscode}
                    onChange={(e) => {
                      setCurrentPasscode(e.target.value.replace(/[^0-9]/g, ''));
                      setCurrentError('');
                    }}
                    placeholder="••••"
                    className={`${styles.input} ${currentError ? styles.inputError : ''}`}
                    autoComplete="current-password"
                    aria-invalid={!!currentError}
                    aria-describedby={currentError ? 'remove-current-error' : undefined}
                  />
                  <button
                    type="button"
                    className={styles.passwordToggleBtn}
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    aria-label={showCurrentPassword ? 'パスコードを隠す' : 'パスコードを表示する'}
                  >
                    {showCurrentPassword ? '非表示' : '表示'}
                  </button>
                </div>
                {currentError && (
                  <p id="remove-current-error" className={styles.error} role="alert">
                    {currentError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className={`${styles.submitBtn} ${styles.dangerBtn}`}
                disabled={isSubmitting || lockRemainingSeconds > 0 || currentPasscode.length < 4}
              >
                {isSubmitting ? '処理中…' : '解除する'}
              </button>

              {/* パスコードを忘れた場合 */}
              <div className={styles.forgotBox}>
                <p className={styles.forgotTitle}>パスコードを忘れた場合</p>
                <p className={styles.forgotText}>
                  パスコードを忘れるとデータを復元できません。アプリを再度利用するには「すべてのデータを削除して初期化」するしか方法がありません。
                </p>
                <button
                  type="button"
                  className={styles.forgotResetBtn}
                  onClick={() => {
                    onClose();
                    onForgotPassword();
                  }}
                >
                  すべてのデータを削除して初期化...
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </Sheet>
  );
}
