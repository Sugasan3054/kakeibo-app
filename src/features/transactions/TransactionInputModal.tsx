import { useState, useEffect, useCallback } from 'react';
import { db } from '../../db/database';
import type { Account, Transaction, Category, TransactionKind } from '../../db/models';
import { getTodayString } from '../../utils/date';
import { validateAmount, validateMemo, sanitizeForStorage } from '../../utils/validation';
import { Sheet } from '../../components/Sheet/Sheet';
import { SegmentControl } from '../../components/SegmentControl/SegmentControl';
import { Calendar } from '../../components/Calendar/Calendar';
import { Icon } from '../../components/Icon/Icon';
import { useToast } from '../../components/Toast/Toast';
import { usePwaUpdate } from '../../contexts/PwaUpdateContext';
import { CategorySelect } from '../../components/CategorySelect/CategorySelect';
import styles from './TransactionInputModal.module.css';

interface TransactionInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  editTransaction?: Transaction | null;
  onSaved?: () => void;
}

export function TransactionInputModal({
  isOpen,
  onClose,
  editTransaction,
  onSaved,
}: TransactionInputModalProps) {
  const { showToast } = useToast();
  const { setIsInputting } = usePwaUpdate();

  // 収支入力中はPWA更新トーストを保留
  useEffect(() => {
    setIsInputting(isOpen);
    return () => {
      setIsInputting(false);
    };
  }, [isOpen, setIsInputting]);
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(getTodayString());
  const [memo, setMemo] = useState('');
  const [accountId, setAccountId] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    const loadData = async () => {
      const [cats, accs] = await Promise.all([
        db.categories.orderBy('order').toArray(),
        db.accounts.orderBy('createdAt').toArray(),
      ]);
      setCategories(cats);
      setAccounts(accs);

      if (editTransaction) {
        setKind(editTransaction.kind as 'expense' | 'income');
        setAmount(String(editTransaction.amount));
        setCategoryId(editTransaction.categoryId || '');
        setDate(editTransaction.date);
        setMemo(editTransaction.memo);
        setAccountId(editTransaction.accountId);
      } else {
        setKind('expense');
        setAmount('');
        setCategoryId('');
        setDate(getTodayString());
        setMemo('');
        setAccountId(accs.length > 0 ? accs[0].id : '');
        setShowCalendar(false);
      }
      setErrors({});
    };
    loadData();
  }, [isOpen, editTransaction]);

  const handleCategoryAdded = (newCat: Category) => {
    setCategories((prev) => [...prev, newCat]);
    setCategoryId(newCat.id);
    setErrors((prev) => ({ ...prev, categoryId: '' }));
    showToast(`分類「${newCat.name}」を追加しました`);
  };

  const handleAmountChange = useCallback((value: string) => {
    // カンマや不正な文字を除去して数値のみに
    const cleaned = value.replace(/[^0-9]/g, '');
    setAmount(cleaned);
    setErrors((prev) => ({ ...prev, amount: '' }));
  }, []);

  const displayAmount = amount
    ? Number(amount).toLocaleString('ja-JP')
    : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    const amountError = validateAmount(amount);
    if (amountError) newErrors.amount = amountError;

    if (!categoryId) newErrors.categoryId = `${kind === 'expense' ? '支出' : '収入'}分類を選択してください`;

    if (!accountId) newErrors.accountId = `${kind === 'expense' ? '支出元' : '入金先'}を選択してください`;

    const memoError = validateMemo(memo);
    if (memoError) newErrors.memo = memoError;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const now = new Date().toISOString();
    const txData: Transaction = {
      id: editTransaction?.id || crypto.randomUUID(),
      kind: kind as TransactionKind,
      amount: Number(amount),
      categoryId,
      date,
      memo: sanitizeForStorage(memo),
      accountId,
      createdAt: editTransaction?.createdAt || now,
      updatedAt: now,
    };

    try {
      if (editTransaction) {
        await db.transactions.put(txData);
        showToast(`${kind === 'expense' ? '支出' : '収入'}を更新しました`);
      } else {
        await db.transactions.add(txData);
        showToast(`${kind === 'expense' ? '支出' : '収入'}を登録しました`);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Failed to save transaction:', err);
      showToast('保存に失敗しました', { type: 'error' });
    }
  };

  const title = editTransaction
    ? `${kind === 'expense' ? '支出' : '収入'}を編集`
    : '収支を入力';

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {!editTransaction && (
          <SegmentControl
            name="収支タイプ"
            options={[
              { value: 'expense', label: '支出' },
              { value: 'income', label: '収入' },
            ]}
            value={kind}
            onChange={(v) => { setKind(v); setCategoryId(''); }}
          />
        )}

        {/* 金額 */}
        <div className={styles.field}>
          <label htmlFor="tx-amount" className={styles.label}>
            金額 <span className={styles.required}>必須</span>
          </label>
          <div className={styles.amountWrapper}>
            <span className={styles.yen} aria-hidden="true">¥</span>
            <input
              id="tx-amount"
              type="text"
              inputMode="numeric"
              className={`${styles.amountInput} ${errors.amount ? styles.inputError : ''}`}
              value={displayAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0"
              autoFocus={!editTransaction}
              aria-invalid={!!errors.amount}
              aria-describedby={errors.amount ? 'amount-error' : undefined}
            />
          </div>
          {errors.amount && <p id="amount-error" className={styles.error} role="alert">{errors.amount}</p>}
        </div>

        {/* 分類 */}
        <div className={styles.field}>
          <label id="tx-category-label" htmlFor="tx-category" className={styles.label}>
            {kind === 'expense' ? '支出' : '収入'}分類 <span className={styles.required}>必須</span>
          </label>
          <CategorySelect
            id="tx-category"
            categories={categories}
            value={categoryId}
            onChange={(val) => {
              setCategoryId(val);
              setErrors((prev) => ({ ...prev, categoryId: '' }));
            }}
            kind={kind}
            hasError={!!errors.categoryId}
            onCategoryAdded={handleCategoryAdded}
            aria-describedby={errors.categoryId ? 'category-error' : undefined}
          />
          {errors.categoryId && <p id="category-error" className={styles.error} role="alert">{errors.categoryId}</p>}
        </div>

        {/* 日付 */}
        <div className={styles.field}>
          <label className={styles.label}>
            {kind === 'expense' ? '支出' : '収入'}日 <span className={styles.required}>必須</span>
          </label>
          <button
            type="button"
            className={styles.dateButton}
            onClick={() => setShowCalendar(!showCalendar)}
            aria-expanded={showCalendar}
          >
            <Icon name="calendar" variant="line" size={18} aria-hidden="true" />
            {date.replace(/-/g, '/')}
          </button>
          {showCalendar && (
            <div className={styles.calendarWrapper}>
              <Calendar value={date} onChange={(d) => { setDate(d); setShowCalendar(false); }} />
            </div>
          )}
        </div>

        {/* 内容 */}
        <div className={styles.field}>
          <label htmlFor="tx-memo" className={styles.label}>
            内容 <span className={styles.optional}>任意</span>
          </label>
          <input
            id="tx-memo"
            type="text"
            className={`${styles.input} ${errors.memo ? styles.inputError : ''}`}
            value={memo}
            onChange={(e) => { setMemo(e.target.value); setErrors((prev) => ({ ...prev, memo: '' })); }}
            placeholder="例：スーパーでの買い物"
            maxLength={100}
            aria-invalid={!!errors.memo}
            aria-describedby={errors.memo ? 'memo-error' : undefined}
          />
          <span className={styles.charCount}>{memo.length}/100</span>
          {errors.memo && <p id="memo-error" className={styles.error} role="alert">{errors.memo}</p>}
        </div>

        {/* 口座 */}
        <div className={styles.field}>
          <label htmlFor="tx-account" className={styles.label}>
            {kind === 'expense' ? '支出元' : '入金先'} <span className={styles.required}>必須</span>
          </label>
          {accounts.length === 0 ? (
            <p className={styles.noAccounts}>
              口座が登録されていません。先に「口座」タブから口座を登録してください。
            </p>
          ) : (
            <select
              id="tx-account"
              className={`${styles.select} ${errors.accountId ? styles.inputError : ''}`}
              value={accountId}
              onChange={(e) => { setAccountId(e.target.value); setErrors((prev) => ({ ...prev, accountId: '' })); }}
              aria-invalid={!!errors.accountId}
              aria-describedby={errors.accountId ? 'account-error' : undefined}
            >
              <option value="">選択してください</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          )}
          {errors.accountId && <p id="account-error" className={styles.error} role="alert">{errors.accountId}</p>}
        </div>

        {/* 保存 */}
        <button
          type="submit"
          className={`${styles.submitBtn} ${kind === 'expense' ? styles.expenseBtn : styles.incomeBtn}`}
          disabled={accounts.length === 0}
        >
          {editTransaction ? '更新する' : '保存する'}
        </button>
      </form>
    </Sheet>
  );
}
