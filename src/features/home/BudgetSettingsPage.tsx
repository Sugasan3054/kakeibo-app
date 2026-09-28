import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/database';
import type { Category, Budget, Transaction } from '../../db/models';
import { useSettings } from '../../hooks/useSettings';
import { getCurrentYearMonth } from '../../utils/date';
import { formatAmount, formatYen, parseAmountInput } from '../../utils/format';
import {
  calculateMonthlyExpenseByCategory,
  calculatePastMonthsAverageExpense,
} from '../../utils/calculation';
import { Icon } from '../../components/Icon/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { useToast } from '../../components/Toast/Toast';
import { Loading } from '../../components/Loading/Loading';
import styles from './BudgetSettingsPage.module.css';

export function BudgetSettingsPage() {
  const navigate = useNavigate();
  const { settings, updateSettings } = useSettings();
  const { showToast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [expectedIncomeInput, setExpectedIncomeInput] = useState<string>('');
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({});
  const [initialExpectedIncome, setInitialExpectedIncome] = useState<string>('');
  const [initialBudgets, setInitialBudgets] = useState<Record<string, string>>({});
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentMonth = getCurrentYearMonth();

  const loadData = useCallback(async () => {
    try {
      const [cats, buds, txs] = await Promise.all([
        db.categories.where('kind').equals('expense').sortBy('order'),
        db.budgets.toArray(),
        db.transactions.toArray(),
      ]);

      setCategories(cats);
      setBudgets(buds);
      setTransactions(txs);

      // Initialize expected income
      const incStr = settings.expectedMonthlyIncome != null
        ? formatAmount(settings.expectedMonthlyIncome)
        : '';
      setExpectedIncomeInput(incStr);
      setInitialExpectedIncome(incStr);

      // Initialize budget inputs
      const budMap: Record<string, string> = {};
      cats.forEach((cat) => {
        const b = buds.find((item) => item.categoryId === cat.id);
        budMap[cat.id] = b && b.monthlyAmount != null ? formatAmount(b.monthlyAmount) : '';
      });
      setBudgetInputs(budMap);
      setInitialBudgets(budMap);
    } catch (err) {
      console.error('Failed to load budget settings:', err);
      showToast('データの読み込みに失敗しました', { type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [settings.expectedMonthlyIncome, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Check if form is dirty
  const isDirty = useMemo(() => {
    if (expectedIncomeInput !== initialExpectedIncome) return true;
    for (const key of Object.keys(budgetInputs)) {
      if ((budgetInputs[key] || '') !== (initialBudgets[key] || '')) return true;
    }
    return false;
  }, [expectedIncomeInput, initialExpectedIncome, budgetInputs, initialBudgets]);

  // Current month spent by category
  const expenseByCategory = useMemo(() => {
    return calculateMonthlyExpenseByCategory(transactions, currentMonth);
  }, [transactions, currentMonth]);

  // Past 3 months average by category
  const past3MonthsAvgByCategory = useMemo(() => {
    const map = new Map<string, number>();
    categories.forEach((cat) => {
      map.set(cat.id, calculatePastMonthsAverageExpense(transactions, currentMonth, cat.id, 3));
    });
    return map;
  }, [categories, transactions, currentMonth]);

  // Total budget calculation
  const totalBudget = useMemo(() => {
    let sum = 0;
    for (const val of Object.values(budgetInputs)) {
      if (val) {
        const parsed = parseAmountInput(val);
        if (parsed) sum += parsed;
      }
    }
    return sum;
  }, [budgetInputs]);

  // Parsed expected income
  const parsedIncome = useMemo(() => {
    if (!expectedIncomeInput.trim()) return null;
    return parseAmountInput(expectedIncomeInput);
  }, [expectedIncomeInput]);

  const difference = useMemo(() => {
    if (parsedIncome === null) return null;
    return parsedIncome - totalBudget;
  }, [parsedIncome, totalBudget]);

  const handleIncomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    if (raw === '') {
      setExpectedIncomeInput('');
    } else {
      const num = Number(raw);
      setExpectedIncomeInput(formatAmount(num));
    }
  };

  const handleBudgetChange = (catId: string, value: string) => {
    const raw = value.replace(/[^0-9]/g, '');
    setBudgetInputs((prev) => ({
      ...prev,
      [catId]: raw === '' ? '' : formatAmount(Number(raw)),
    }));
  };

  const handleBack = () => {
    if (isDirty) {
      setShowConfirmLeave(true);
    } else {
      navigate('/');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();

      // Save expected income
      await updateSettings({
        expectedMonthlyIncome: parsedIncome,
      });

      // Save budgets
      for (const cat of categories) {
        const inputVal = budgetInputs[cat.id];
        const monthlyAmount = inputVal ? parseAmountInput(inputVal) : null;
        const existing = budgets.find((b) => b.categoryId === cat.id);

        if (existing) {
          await db.budgets.put({
            ...existing,
            monthlyAmount,
            updatedAt: now,
          });
        } else {
          await db.budgets.add({
            id: crypto.randomUUID(),
            categoryId: cat.id,
            monthlyAmount,
            updatedAt: now,
          });
        }
      }

      showToast('予算設定を保存しました');
      window.dispatchEvent(new CustomEvent('kakeibo:data-changed'));
      navigate('/');
    } catch (err) {
      console.error('Failed to save budget settings:', err);
      showToast('保存に失敗しました', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <button
          className={styles.backBtn}
          onClick={handleBack}
          aria-label="戻る"
          type="button"
        >
          <Icon name="arrow_left" variant="line" size={24} aria-hidden="true" />
        </button>
        <h1 className={styles.pageTitle}>予算設定</h1>
        <div className={styles.headerSpacer} />
      </header>

      {/* 想定月収入力 */}
      <section className={styles.incomeSection} aria-label="想定月収設定">
        <div className={styles.sectionHeader}>
          <label htmlFor="expected-income-input" className={styles.label}>
            想定月収（任意）
          </label>
          <span className={styles.subLabel}>
            未入力の場合は過去3か月の平均収入を使用します
          </span>
        </div>
        <div className={styles.amountInputWrap}>
          <span className={styles.yenSymbol}>¥</span>
          <input
            id="expected-income-input"
            type="text"
            inputMode="numeric"
            className={styles.amountInput}
            value={expectedIncomeInput}
            onChange={handleIncomeChange}
            placeholder="0"
          />
        </div>
      </section>

      {/* 支出分類ごとの月予算入力 */}
      <section className={styles.categorySection} aria-label="支出分類別予算">
        <h2 className={styles.sectionTitle}>支出分類ごとの月予算</h2>
        <p className={styles.sectionDesc}>空欄の場合は「予算未設定」として扱われます</p>

        <ul className={styles.categoryList}>
          {categories.map((cat) => {
            const spent = expenseByCategory.get(cat.id) || 0;
            const pastAvg = past3MonthsAvgByCategory.get(cat.id) || 0;
            const val = budgetInputs[cat.id] || '';

            return (
              <li key={cat.id} className={styles.categoryItem}>
                <div className={styles.catLeft}>
                  <div className={styles.catNameRow}>
                    <span
                      className={styles.colorDot}
                      style={{ backgroundColor: cat.color }}
                      aria-hidden="true"
                    />
                    <span className={styles.catName}>{cat.name}</span>
                  </div>
                  <div className={styles.refInfo}>
                    <span>今月: {formatYen(spent)}</span>
                    <span className={styles.refDivider}>•</span>
                    <span>3か月平均: {formatYen(pastAvg)}</span>
                  </div>
                </div>

                <div className={styles.catRight}>
                  <div className={styles.budgetInputWrap}>
                    <span className={styles.yenSymbolSmall}>¥</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className={styles.catInput}
                      value={val}
                      onChange={(e) => handleBudgetChange(cat.id, e.target.value)}
                      placeholder="未設定"
                      aria-label={`${cat.name}の月予算`}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 固定フッターサマリー */}
      <footer className={styles.fixedFooter} aria-label="予算合計サマリー">
        <div className={styles.footerContent}>
          <div className={styles.footerRow}>
            <div className={styles.footerStat}>
              <span className={styles.footerLabel}>月予算合計</span>
              <span className={styles.footerValue}>{formatYen(totalBudget)}</span>
            </div>

            {difference !== null ? (
              <div className={styles.footerStat}>
                <span className={styles.footerLabel}>想定月収との差額</span>
                <span
                  className={`${styles.footerValue} ${
                    difference >= 0 ? styles.positiveDiff : styles.negativeDiff
                  }`}
                >
                  {difference >= 0 ? `+¥${formatAmount(difference)}` : `−¥${formatAmount(Math.abs(difference))}`}
                </span>
              </div>
            ) : (
              <div className={styles.footerStat}>
                <span className={styles.footerLabel}>想定月収</span>
                <span className={styles.footerMuted}>未設定</span>
              </div>
            )}
          </div>

          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={saving}
            type="button"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </footer>

      {/* 未保存時の離脱確認ダイアログ */}
      <ConfirmDialog
        isOpen={showConfirmLeave}
        title="変更を破棄しますか？"
        message="保存されていない変更があります。この画面を離れると入力内容は失われます。"
        confirmLabel="破棄して戻る"
        cancelLabel="編集を続ける"
        variant="danger"
        onConfirm={() => {
          setShowConfirmLeave(false);
          navigate('/');
        }}
        onCancel={() => setShowConfirmLeave(false)}
      />
    </div>
  );
}
