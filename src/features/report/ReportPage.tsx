import { useState, useEffect, useCallback } from 'react';
import { db } from '../../db/database';
import type { Transaction, Category } from '../../db/models';
import { calculateMonthlyExpenseByCategory, calculateMonthlyIncomeByCategory, calculateMonthlyExpenseTotal, calculateMonthlyIncomeTotal } from '../../utils/calculation';
import { getCurrentYearMonth, getPreviousMonth, getNextMonth, formatYearMonth } from '../../utils/date';
import { formatYen, calcPercentage } from '../../utils/format';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { Loading } from '../../components/Loading/Loading';
import { Icon } from '../../components/Icon/Icon';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import styles from './ReportPage.module.css';

import { sortCategories } from '../../utils/category';

export function ReportPage() {
  const [yearMonth, setYearMonth] = useState(getCurrentYearMonth());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [txs, cats] = await Promise.all([
        db.transactions.toArray(),
        db.categories.orderBy('order').toArray(),
      ]);
      setTransactions(txs);
      setCategories(sortCategories(cats));
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const expenseByCategory = calculateMonthlyExpenseByCategory(transactions, yearMonth);
  const incomeByCategory = calculateMonthlyIncomeByCategory(transactions, yearMonth);
  const expenseTotal = calculateMonthlyExpenseTotal(transactions, yearMonth);
  const incomeTotal = calculateMonthlyIncomeTotal(transactions, yearMonth);

  const expenseCategories = categories.filter((c) => c.kind === 'expense');
  const incomeCategories = categories.filter((c) => c.kind === 'income');

  const expenseChartData = expenseCategories
    .map((cat) => ({
      name: cat.name,
      value: expenseByCategory.get(cat.id) || 0,
      color: cat.color,
      id: cat.id,
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const incomeChartData = incomeCategories
    .map((cat) => ({
      name: cat.name,
      value: incomeByCategory.get(cat.id) || 0,
      color: cat.color,
      id: cat.id,
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const hasData = expenseChartData.length > 0 || incomeChartData.length > 0;

  if (loading) return <Loading />;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.pageTitle}>家計簿</h1>
      </header>

      {/* 月切り替え */}
      <nav className={styles.monthNav} aria-label="月の選択">
        <button
          className={styles.monthBtn}
          onClick={() => setYearMonth(getPreviousMonth(yearMonth))}
          aria-label="前月"
        >
          <Icon name="arrow_left" size={20} />
        </button>
        <span className={styles.monthLabel} aria-live="polite">
          {formatYearMonth(yearMonth)}
        </span>
        <button
          className={styles.monthBtn}
          onClick={() => setYearMonth(getNextMonth(yearMonth))}
          aria-label="翌月"
        >
          <Icon name="arrow_right" size={20} />
        </button>
      </nav>

      {!hasData ? (
        <EmptyState
          iconName="chart"
          title="データがありません"
          description={`${formatYearMonth(yearMonth)}の取引はまだ登録されていません`}
        />
      ) : (
        <>
          {/* 支出セクション */}
          {expenseChartData.length > 0 && (
            <section className={styles.section} aria-label="支出内訳">
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  <span className={styles.sectionIcon} aria-hidden="true">−</span>
                  支出
                </h2>
                <span className={`${styles.sectionTotal} ${styles.expenseColor}`}>
                  {formatYen(expenseTotal)}
                </span>
              </div>

              <div className={styles.chartWrapper}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={expenseChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={800}
                    >
                      {expenseChartData.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => [formatYen(Number(value) || 0), '金額']}
                      contentStyle={{
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                        fontSize: '14px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <ul className={styles.breakdown} aria-label="支出分類一覧">
                {expenseChartData.map((entry) => (
                  <li key={entry.id} className={styles.breakdownItem}>
                    <span className={styles.breakdownDot} style={{ backgroundColor: entry.color }} aria-hidden="true" />
                    <span className={styles.breakdownName}>{entry.name}</span>
                    <span className={styles.breakdownAmount}>{formatYen(entry.value)}</span>
                    <span className={styles.breakdownPct}>
                      {calcPercentage(entry.value, expenseTotal)}%
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 収入セクション */}
          {incomeChartData.length > 0 && (
            <section className={styles.section} aria-label="収入内訳">
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  <span className={styles.sectionIcon} aria-hidden="true">+</span>
                  収入
                </h2>
                <span className={`${styles.sectionTotal} ${styles.incomeColor}`}>
                  {formatYen(incomeTotal)}
                </span>
              </div>

              <div className={styles.chartWrapper}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={incomeChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={800}
                    >
                      {incomeChartData.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => [formatYen(Number(value) || 0), '金額']}
                      contentStyle={{
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                        fontSize: '14px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <ul className={styles.breakdown} aria-label="収入分類一覧">
                {incomeChartData.map((entry) => (
                  <li key={entry.id} className={styles.breakdownItem}>
                    <span className={styles.breakdownDot} style={{ backgroundColor: entry.color }} aria-hidden="true" />
                    <span className={styles.breakdownName}>{entry.name}</span>
                    <span className={styles.breakdownAmount}>{formatYen(entry.value)}</span>
                    <span className={styles.breakdownPct}>
                      {calcPercentage(entry.value, incomeTotal)}%
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 月間収支 */}
          <section className={styles.balanceSection} aria-label="月間収支">
            <div className={styles.balanceRow}>
              <span>収入合計</span>
              <span className={styles.incomeColor}>+{formatYen(incomeTotal)}</span>
            </div>
            <div className={styles.balanceRow}>
              <span>支出合計</span>
              <span className={styles.expenseColor}>−{formatYen(expenseTotal)}</span>
            </div>
            <div className={`${styles.balanceRow} ${styles.balanceTotal}`}>
              <span>収支</span>
              <span className={incomeTotal - expenseTotal >= 0 ? styles.incomeColor : styles.expenseColor}>
                {incomeTotal - expenseTotal >= 0 ? '+' : '−'}{formatYen(Math.abs(incomeTotal - expenseTotal))}
              </span>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
