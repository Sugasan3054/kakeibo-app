import { useState } from 'react';
import type { Account, AccountType } from '../../db/models';
import { ACCOUNT_TYPE_LABELS } from '../../db/models';
import { validateAccountName } from '../../utils/validation';
import styles from './AccountForm.module.css';

const ACCOUNT_COLORS = [
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316',
  '#06b6d4', '#eab308', '#ef4444', '#14b8a6', '#6b7280',
];

const ACCOUNT_TYPES: AccountType[] = ['cash', 'transit_ic', 'bank', 'e_money', 'other'];

interface AccountFormProps {
  account: Account | null;
  onSave: (data: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export function AccountForm({ account, onSave, onCancel }: AccountFormProps) {
  const [name, setName] = useState(account?.name || '');
  const [type, setType] = useState<AccountType>(account?.type || 'cash');
  const [initialBalance, setInitialBalance] = useState(
    account ? String(account.initialBalance) : '0'
  );
  const [color, setColor] = useState(account?.color || ACCOUNT_COLORS[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    const nameError = validateAccountName(name);
    if (nameError) newErrors.name = nameError;

    const balanceNum = Number(initialBalance.replace(/[,，]/g, ''));
    if (isNaN(balanceNum) || !Number.isInteger(balanceNum)) {
      newErrors.initialBalance = '有効な整数を入力してください';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      name: name.trim(),
      type,
      initialBalance: balanceNum,
      color,
      icon: '',
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label htmlFor="account-name" className={styles.label}>
          口座名 <span className={styles.required}>必須</span>
        </label>
        <input
          id="account-name"
          type="text"
          className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
          value={name}
          onChange={(e) => { setName(e.target.value); setErrors((prev) => ({ ...prev, name: '' })); }}
          placeholder="例：財布、PASMO"
          maxLength={50}
          autoFocus
          required
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
        />
        {errors.name && <p id="name-error" className={styles.error} role="alert">{errors.name}</p>}
      </div>

      <div className={styles.field}>
        <label htmlFor="account-type" className={styles.label}>
          種別 <span className={styles.required}>必須</span>
        </label>
        <select
          id="account-type"
          className={styles.select}
          value={type}
          onChange={(e) => setType(e.target.value as AccountType)}
          required
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor="initial-balance" className={styles.label}>
          初期残高 <span className={styles.required}>必須</span>
        </label>
        <div className={styles.amountWrapper}>
          <span className={styles.yen}>¥</span>
          <input
            id="initial-balance"
            type="text"
            inputMode="numeric"
            className={`${styles.input} ${styles.amountInput} ${errors.initialBalance ? styles.inputError : ''}`}
            value={initialBalance}
            onChange={(e) => { setInitialBalance(e.target.value); setErrors((prev) => ({ ...prev, initialBalance: '' })); }}
            placeholder="0"
            aria-invalid={!!errors.initialBalance}
            aria-describedby={errors.initialBalance ? 'balance-error' : undefined}
          />
        </div>
        {errors.initialBalance && <p id="balance-error" className={styles.error} role="alert">{errors.initialBalance}</p>}
      </div>

      <div className={styles.field}>
        <span className={styles.label}>カラー</span>
        <div className={styles.colorPicker} role="radiogroup" aria-label="口座のカラー">
          {ACCOUNT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              className={`${styles.colorOption} ${color === c ? styles.colorSelected : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>
          キャンセル
        </button>
        <button type="submit" className={styles.submitBtn}>
          {account ? '更新' : '追加'}
        </button>
      </div>
    </form>
  );
}
