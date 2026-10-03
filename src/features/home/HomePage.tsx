import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/database';
import type { Transaction, Category, Account } from '../../db/models';
import {
  calcTotalAssets,
  calculateMonthlyExpenseByCategory,
  calculateMonthlyExpenseTotal,
  calculateMonthlyIncomeTotal,
} from '../../utils/calculation';
import { getCurrentYearMonth, formatYearMonth } from '../../utils/date';
import { formatYen, formatYenAria, calcPercentage } from '../../utils/format';
import { CountUp } from '../../components/CountUp/CountUp';
import { Loading } from '../../components/Loading/Loading';
import { Icon } from '../../components/Icon/Icon';
import { sortCategories } from '../../utils/category';
import { sortByAmountDesc } from '../../utils/chart';
import { CategoryPieChart } from '../../components/PieChart/CategoryPieChart';
import { useNotifications } from '../../utils/notification';
import styles from './HomePage.module.css';

export function HomePage() {
  const navigate = useNavigate();
  const { badgeText, ariaLabel } = useNotifications();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const currentMonth = getCurrentYearMonth();

  const loadData = useCallback(async () => {
    try {
      const [accs, txs, cats] = await Promise.all([
        db.accounts.toArray(),
        db.transactions.toArray(),
        db.categories.orderBy('order').toArray(),
      ]);
      const sortedCats = sortCategories(cats);
      setAccounts(accs);
      setTransactions(txs);
      setCategories(sortedCats);
    } catch (err) {
      console.error('Failed to load home data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const handleUpdate = () => {
      loadData();
    };
    window.addEventListener('kakeibo:data-changed', handleUpdate);
    return () => {
      window.removeEventListener('kakeibo:data-changed', handleUpdate);
    };
  }, [loadData]);

  // 総資産
  const totalAssets = useMemo(
    () => calcTotalAssets(accounts, transactions),
    [accounts, transactions]
  );

  // 今月の支出/収入合計
  const monthlyExpenseTotal = useMemo(
    () => calculateMonthlyExpenseTotal(transactions, currentMonth),
    [transactions, currentMonth]
  );
  const monthlyIncomeTotal = useMemo(
    () => calculateMonthlyIncomeTotal(transactions, currentMonth),
    [transactions, currentMonth]
  );

  // 円グラフ用データ
  const expenseByCategory = useMemo(
    () => calculateMonthlyExpenseByCategory(transactions, currentMonth),
    [transactions, currentMonth]
  );
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.kind === 'expense'),
    [categories]
  );

  const chartData = useMemo(() => {
    const rawItems = expenseCategories.map((cat) => ({
      name: cat.name,
      value: expenseByCategory.get(cat.id) || 0,
      color: cat.color,
      id: cat.id,
      order: cat.order,
    }));
    return sortByAmountDesc(rawItems);
  }, [expenseCategories, expenseByCategory]);

  // 今月の収支 (収入 - 支出)
  const monthlyNetTotal = useMemo(
    () => monthlyIncomeTotal - monthlyExpenseTotal,
    [monthlyIncomeTotal, monthlyExpenseTotal]
  );

  if (loading) return <Loading />;

  return (
    <div className={styles.page}>
      {/* ヘッダー */}
      <header className={styles.header}>
        <h1 className={styles.pageTitle}>ホーム</h1>
        <div className={styles.headerActions}>
          <button
            className={styles.notificationBtn}
            onClick={() => navigate('/notifications')}
            aria-label={ariaLabel}
            type="button"
          >
            <Icon name="notification" variant="line" size={24} aria-hidden="true" />
            {badgeText && (
              <span className={styles.badge} aria-hidden="true">
                {badgeText}
              </span>
            )}
          </button>
          <button
            className={styles.settingsBtn}
            onClick={() => navigate('/settings')}
            aria-label="設定"
            type="button"
          >
            <Icon name="settings" variant="line" size={24} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* 総資産カード */}
      <section
        className={`${styles.assetCard} ${totalAssets < 0 ? styles.negativeAssetCard : ''}`}
        aria-label="総資産"
      >
        <span className={styles.assetLabel}>総資産</span>
        <div className={styles.assetAmount}>
          <CountUp end={totalAssets} prefix="¥" className={styles.assetValue} />
        </div>
      </section>

      {/* 今月サマリー（収入・支出・収支の3カード横並び） */}
      <section className={styles.summary} aria-label="今月のサマリー">
        <h2 className={styles.sectionTitle}>{formatYearMonth(currentMonth)}</h2>
        <div className={styles.summaryCards}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>収入</span>
            <span className={`${styles.summaryAmount} ${styles.income}`}>
              +¥<CountUp end={monthlyIncomeTotal} />
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>支出</span>
            <span className={`${styles.summaryAmount} ${styles.expense}`}>
              −¥<CountUp end={monthlyExpenseTotal} />
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>収支</span>
            <span
              className={`${styles.summaryAmount} ${
                monthlyNetTotal >= 0 ? styles.income : styles.expense
              }`}
            >
              <CountUp
                end={monthlyNetTotal}
                prefix="¥"
                showPlusSign
              />
            </span>
          </div>
        </div>
      </section>

      {/* 支出内訳ドーナツチャート */}
      <section className={styles.chartSection} aria-label="支出内訳">
        <h2 className={styles.sectionTitle}>支出の内訳</h2>
        {chartData.length === 0 ? (
          <p className={styles.noData}>今月の支出データはまだありません</p>
        ) : (
          <div className={styles.chartCard}>
            <div className={styles.chartWrapper}>
              <CategoryPieChart
                data={chartData}
                height={220}
                innerRadius={60}
                outerRadius={90}
                tooltipLabel="支出"
                centerContent={
                  <div className={styles.chartCenter}>
                    <span className={styles.chartCenterLabel}>今月の支出</span>
                    <span
                      className={styles.chartCenterAmount}
                      aria-label={formatYenAria(monthlyExpenseTotal)}
                    >
                      {formatYen(monthlyExpenseTotal)}
                    </span>
                  </div>
                }
              />
            </div>
            <ul className={styles.legend} aria-label="支出分類">
              {chartData.map((entry) => (
                <li key={entry.id} className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ backgroundColor: entry.color }} aria-hidden="true" />
                  <span className={styles.legendName}>{entry.name}</span>
                  <span className={styles.legendValue}>{formatYen(entry.value)}</span>
                  <span className={styles.legendPct}>{calcPercentage(entry.value, monthlyExpenseTotal)}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
