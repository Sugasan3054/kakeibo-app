import { useState, type FormEvent } from 'react';
import { verifyPasscode } from '../../utils/crypto';
import { Icon } from '../Icon/Icon';
import styles from './LockScreen.module.css';

interface LockScreenProps {
  passcodeHash: string;
  passcodeSalt: string;
  onUnlock: () => void;
}

export function LockScreen({ passcodeHash, passcodeSalt, onUnlock }: LockScreenProps) {
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputCode) return;

    setLoading(true);
    setError('');

    try {
      const isValid = await verifyPasscode(inputCode, passcodeHash, passcodeSalt);
      if (isValid) {
        onUnlock();
      } else {
        setError('パスコードが間違っています');
        setInputCode('');
      }
    } catch {
      setError('認証に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="パスコード認証">
      <div className={styles.card}>
        <div className={styles.iconWrap} aria-hidden="true">
          <Icon name="lock" variant="fill" size={48} />
        </div>
        <h1 className={styles.title}>パスコードを入力</h1>
        <p className={styles.subtitle}>家計簿アプリのロックを解除してください</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="password"
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
            aria-label="パスコード"
          />

          {error && <p className={styles.error} role="alert">{error}</p>}

          <button
            type="submit"
            className={styles.button}
            disabled={loading || inputCode.length < 4}
          >
            {loading ? '確認中...' : '解除する'}
          </button>
        </form>
      </div>
    </div>
  );
}
