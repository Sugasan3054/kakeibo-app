import { useState } from 'react';
import type { Account } from '../../db/models';
import { formatYen } from '../../utils/format';
import styles from './AdjustBalanceForm.module.css';

interface AdjustBalanceFormProps {
  account: Account;
  currentBalance: number;
  onSave: (adjustmentAmount: number) => void;
  onCancel: () => void;
}

export function AdjustBalanceForm({ account, currentBalance, onSave, onCancel }: AdjustBalanceFormProps) {
  const [actualBalance, setActualBalance] = useState('');
  const [error, setError] = useState('');

  const parsedBalance = Number(actualBalance.replace(/[,，]/g, ''));
  const isValid = actualBalance !== '' && !isNaN(parsedBalance) && Number.isInteger(parsedBalance);
  const difference = isValid ? parsedBalance - currentBalance : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) {
      setError('有効な金額を入力してください');
      return;
    }

    if (difference === 0) {
      setError('現在の残高と同じです');
      return;
    }

    onSave(difference);
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.currentBalance}>
        <span className={styles.label}>現在のアプリ上残高</span>
        <span className={styles.amount}>{formatYen(currentBalance)}</span>
      </div>

      <div className={styles.field}>
        <label htmlFor="actual-balance" className={styles.label}>
          実際の残高 <span className={styles.required}>必須</span>
        </label>
        <p className={styles.hint}>
          {account.name}の実際の残高を入力してください
        </p>
        <div className={styles.amountWrapper}>
          <span className={styles.yen}>¥</span>
          <input
            id="actual-balance"
            type="text"
            inputMode="numeric"
            className={`${styles.input} ${error ? styles.inputError : ''}`}
            value={actualBalance}
            onChange={(e) => { setActualBalance(e.target.value); setError(''); }}
            placeholder="0"
            autoFocus
            aria-invalid={!!error}
            aria-describedby={error ? 'adjust-error' : undefined}
          />
        </div>
        {error && <p id="adjust-error" className={styles.error} role="alert">{error}</p>}
      </div>

      {isValid && difference !== 0 && (
        <div className={`${styles.diff} ${difference > 0 ? styles.positive : styles.negative}`}>
          <span className={styles.diffLabel}>調整額</span>
          <span className={styles.diffAmount}>
            {difference > 0 ? '+' : '−'}¥{Math.abs(difference).toLocaleString()}
          </span>
        </div>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>
          キャンセル
        </button>
        <button type="submit" className={styles.submitBtn} disabled={!isValid || difference === 0}>
          調整する
        </button>
      </div>
    </form>
  );
}
