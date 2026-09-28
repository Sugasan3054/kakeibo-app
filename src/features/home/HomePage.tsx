import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/database';
import type { Transaction, Category, Account, Budget } from '../../db/models';
import { useSettings } from '../../hooks/useSettings';
import {
  calculateTotalAssets,
  calculateMonthlyExpenseByCategory,
  calculateMonthlyExpenseTotal,
  calculateMonthlyIncomeTotal,
  estimateMonthEndAmount,
  calculatePastMonthsAverageExpense,
  calculatePastMonthsAverageIncome,
  getEffectiveMonthlyIncome,
  calculateSliderMax,
  calculateSavingsEstimate,
  calculateBudgetDifference,
  getBudgetStatusComment,
} from '../../utils/calculation';
import { getCurrentYearMonth, formatYearMonth, getDaysInMonth, getElapsedDaysInMonth } from '../../utils/date';
import { formatYen, formatAmount, calcPercentage } from '../../utils/format';
import { CountUp } from '../../components/CountUp/CountUp';
import { Loading } from '../../components/Loading/Loading';
import { Icon } from '../../components/Icon/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { sortCategories } from '../../utils/category';
import { useToast } from '../../components/Toast/Toast';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import styles from './HomePage.module.css';

export function HomePage() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { showToast } = useToast();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  // 予算シミュレータ用の一時状態（分類ごとの仮の月予算額）
  const [simBudgets, setSimBudgets] = useState<Record<string, number>>({});
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);
  const [isSimExpanded, setIsSimExpanded] = useState(false);

  const currentMonth = getCurrentYearMonth();
  const daysInMonth = getDaysInMonth(currentMonth);
  const elapsedDays = getElapsedDaysInMonth();

  const loadData = useCallback(async () => {
    try {
      const [accs, txs, cats, buds] = await Promise.all([
        db.accounts.toArray(),
        db.transactions.toArray(),
        db.categories.orderBy('order').toArray(),
        db.budgets.toArray(),
      ]);
      const sortedCats = sortCategories(cats);
      setAccounts(accs);
      setTransactions(txs);
      setCategories(sortedCats);
      setBudgets(buds);

      // 保存済み予算をスライダーの初期値としてセット
      const expenseCats = sortedCats.filter((c) => c.kind === 'expense');
      const initialSim: Record<string, number> = {};
      expenseCats.forEach((cat) => {
        const b = buds.find((item) => item.categoryId === cat.id);
        initialSim[cat.id] = b && b.monthlyAmount != null ? b.monthlyAmount : 0;
      });
      setSimBudgets(initialSim);
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
    () => calculateTotalAssets(accounts, transactions),
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
    return expenseCategories
      .map((cat) => ({
        name: cat.name,
        value: expenseByCategory.get(cat.id) || 0,
        color: cat.color,
        id: cat.id,
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [expenseCategories, expenseByCategory]);

  // 過去3か月の平均収入
  const past3MonthsAvgIncome = useMemo(
    () => calculatePastMonthsAverageIncome(transactions, currentMonth, 3),
    [transactions, currentMonth]
  );

  // 有効な想定月収
  const effectiveMonthlyIncome = useMemo(
    () => getEffectiveMonthlyIncome(settings.expectedMonthlyIncome, past3MonthsAvgIncome),
    [settings.expectedMonthlyIncome, past3MonthsAvgIncome]
  );

  // 保存済み予算の合計
  const savedTotalBudget = useMemo(() => {
    return budgets.reduce((sum, b) => sum + (b.monthlyAmount || 0), 0);
  }, [budgets]);

  // 仮の月予算の合計
  const totalSimBudget = useMemo(() => {
    return Object.values(simBudgets).reduce((sum, val) => sum + (val || 0), 0);
  }, [simBudgets]);

  // 貯蓄見込み計算
  const { monthlySavings, annualSavings } = useMemo(
    () => calculateSavingsEstimate(effectiveMonthlyIncome, totalSimBudget),
    [effectiveMonthlyIncome, totalSimBudget]
  );

  // 保存済み予算との差額
  const budgetDiff = useMemo(
    () => calculateBudgetDifference(savedTotalBudget, totalSimBudget),
    [savedTotalBudget, totalSimBudget]
  );

  // 今月の収支 (収入 - 支出)
  const monthlyNetTotal = useMemo(
    () => monthlyIncomeTotal - monthlyExpenseTotal,
    [monthlyIncomeTotal, monthlyExpenseTotal]
  );

  // 各分類の予算ステータス（状況コメント用）
  const categoryStatuses = useMemo(() => {
    return expenseCategories.map((cat) => {
      const savedBudget = budgets.find((b) => b.categoryId === cat.id)?.monthlyAmount ?? null;
      const simVal = simBudgets[cat.id];
      // スライダー値が存在し0より大きければその値、未設定ならsavedBudget
      const effectiveBudget = simVal !== undefined ? (simVal > 0 ? simVal : null) : savedBudget;
      const spent = expenseByCategory.get(cat.id) || 0;
      const projected = estimateMonthEndAmount(spent, elapsedDays, daysInMonth);
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        budgetAmount: effectiveBudget,
        spentAmount: spent,
        projectedAmount: projected,
      };
    });
  }, [expenseCategories, budgets, simBudgets, expenseByCategory, elapsedDays, daysInMonth]);

  // 11-1 状況コメント判定
  const statusComment = useMemo(() => {
    return getBudgetStatusComment(categoryStatuses);
  }, [categoryStatuses]);

  // スライダー変更ハンドラ
  const handleSliderChange = (catId: string, val: number) => {
    setSimBudgets((prev) => ({
      ...prev,
      [catId]: val,
    }));
  };

  // リセット：スライダーの値を保存済み予算に戻す
  const handleReset = () => {
    const resetValues: Record<string, number> = {};
    expenseCategories.forEach((cat) => {
      const b = budgets.find((item) => item.categoryId === cat.id);
      resetValues[cat.id] = b && b.monthlyAmount != null ? b.monthlyAmount : 0;
    });
    setSimBudgets(resetValues);
    showToast('スライダーの値を保存済み予算に戻しました');
  };

  // 反映：確認ダイアログを経て保存
  const handleApplyToBudget = async () => {
    try {
      const now = new Date().toISOString();
      for (const cat of expenseCategories) {
        const simVal = simBudgets[cat.id];
        const existing = budgets.find((b) => b.categoryId === cat.id);
        const monthlyAmount = simVal > 0 ? simVal : null;

        if (existing) {
          await db.budgets.put({
            ...existing,
            monthlyAmount,
            updatedAt: now,
          });
        } else if (monthlyAmount !== null) {
          await db.budgets.add({
            id: crypto.randomUUID(),
            categoryId: cat.id,
            monthlyAmount,
            updatedAt: now,
          });
        }
      }

      showToast('シミュレーション内容を予算に反映しました');
      setShowApplyConfirm(false);
      await loadData();
      window.dispatchEvent(new CustomEvent('kakeibo:data-changed'));
    } catch (err) {
      console.error('Failed to apply simulated budget:', err);
      showToast('予算の反映に失敗しました', { type: 'error' });
    }
  };

  if (loading) return <Loading />;

  return (
    <div className={styles.page}>
      {/* ヘッダー */}
      <header className={styles.header}>
        <h1 className={styles.pageTitle}>ホーム</h1>
        <button
          className={styles.settingsBtn}
          onClick={() => navigate('/settings')}
          aria-label="設定"
          type="button"
        >
          <Icon name="settings" variant="line" size={24} aria-hidden="true" />
        </button>
      </header>

      {/* 総資産カード */}
      <section className={styles.assetCard} aria-label="総資産">
        <span className={styles.assetLabel}>総資産</span>
        <div className={styles.assetAmount}>
          <CountUp end={totalAssets} prefix="¥" className={styles.assetValue} />
        </div>
      </section>

      {/* 11-2. 今月サマリー（収入・支出・収支の3カード横並び） */}
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
              {monthlyNetTotal >= 0 ? '+¥' : '−¥'}
              <CountUp end={Math.abs(monthlyNetTotal)} />
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
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={800}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [formatYen(Number(value) || 0), '支出']}
                    contentStyle={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      fontSize: '14px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.chartCenter}>
                <span className={styles.chartCenterLabel}>今月の支出</span>
                <span className={styles.chartCenterAmount}>{formatYen(monthlyExpenseTotal)}</span>
              </div>
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

      {/* 11-1. 予算シミュレーションカード（折りたたみ / 展開アコーディオン） */}
      <section
        className={`${styles.simulatorCard} ${isSimExpanded ? styles.cardExpanded : styles.cardFolded}`}
        aria-label="予算シミュレーション"
        role={isSimExpanded ? 'region' : 'button'}
        tabIndex={isSimExpanded ? undefined : 0}
        aria-expanded={isSimExpanded}
        onClick={() => {
          if (!isSimExpanded) setIsSimExpanded(true);
        }}
        onKeyDown={(e) => {
          if (!isSimExpanded && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setIsSimExpanded(true);
          }
        }}
      >
        {/* 見出しヘッダー */}
        <div
          className={styles.simulatorHeader}
          onClick={(e) => {
            if (isSimExpanded) {
              e.stopPropagation();
              setIsSimExpanded(false);
            }
          }}
          role={isSimExpanded ? 'button' : undefined}
          tabIndex={isSimExpanded ? 0 : undefined}
          onKeyDown={(e) => {
            if (isSimExpanded && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              e.stopPropagation();
              setIsSimExpanded(false);
            }
          }}
          aria-label={isSimExpanded ? '予算シミュレーションを折りたたむ' : undefined}
        >
          <div className={styles.simTitleGroup}>
            <div className={styles.simTitleRow}>
              <h2 className={styles.simCardTitle}>予算シミュレーション</h2>
              <span className={styles.simExpandHint}>
                {isSimExpanded ? 'タップで閉じる' : 'タップして展開'}
              </span>
            </div>
            <span className={styles.simCardSubtitle}>
              スライダーで月予算を調整し、貯蓄を試算
            </span>
          </div>

          <div className={styles.headerActionGroup}>
            {isSimExpanded ? (
              <button
                className={styles.closeCardBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSimExpanded(false);
                }}
                type="button"
                aria-label="閉じる"
              >
                <Icon name="close" variant="line" size={20} aria-hidden="true" />
              </button>
            ) : (
              <div className={styles.expandChevron} aria-hidden="true">
                <Icon name="arrow_down" variant="line" size={20} />
              </div>
            )}
          </div>
        </div>

        {/* 11-1. 折りたたみ時・展開時共通の4項目表示 */}
        <div className={styles.simSummaryBox}>
          {/* 1. 状況コメント */}
          <div
            className={`${styles.statusComment} ${
              statusComment.status === 'overspent'
                ? styles.statusOverspent
                : statusComment.status === 'projected_over'
                ? styles.statusProjectedOver
                : statusComment.status === 'ok'
                ? styles.statusOk
                : styles.statusNoBudget
            }`}
            role="status"
          >
            <Icon
              name={statusComment.icon}
              variant={statusComment.icon === 'check' || statusComment.status === 'overspent' ? 'fill' : 'line'}
              size={18}
              className={styles.statusIcon}
              aria-hidden="true"
            />
            <span className={styles.statusText}>{statusComment.text}</span>
          </div>

          {/* 2 & 3. 仮の月予算合計と月の貯蓄見込み */}
          <div className={styles.simStatRow}>
            <div className={styles.simStat}>
              <span className={styles.simStatLabel}>仮の月予算合計</span>
              <span className={styles.simStatValue}>
                ¥<CountUp end={totalSimBudget} />
              </span>
            </div>

            <div className={styles.simStat}>
              <span className={styles.simStatLabel}>月の貯蓄見込み</span>
              {monthlySavings !== null ? (
                <span
                  className={`${styles.simStatValue} ${
                    monthlySavings >= 0 ? styles.positiveStat : styles.negativeStat
                  }`}
                >
                  {monthlySavings >= 0 ? '+¥' : '−¥'}
                  <CountUp end={Math.abs(monthlySavings)} />
                </span>
              ) : (
                <span className={styles.simStatMuted}>収入未設定</span>
              )}
            </div>
          </div>

          {/* 4. 保存済み予算との差額 & 年間貯蓄見込み */}
          <div className={styles.simStatRow}>
            <div className={styles.simStat}>
              <span className={styles.simStatLabel}>保存済み予算との差額</span>
              <span
                className={`${styles.simStatDiff} ${
                  budgetDiff > 0 ? styles.diffReduction : budgetDiff < 0 ? styles.diffIncrease : ''
                }`}
              >
                {budgetDiff > 0
                  ? `今の予算より月${formatYen(budgetDiff)}削減`
                  : budgetDiff < 0
                  ? `今の予算より月${formatYen(Math.abs(budgetDiff))}増加`
                  : '差額なし'}
              </span>
            </div>

            {annualSavings !== null ? (
              <div className={styles.simStat}>
                <span className={styles.simStatLabel}>年間貯蓄見込み</span>
                <span
                  className={`${styles.simStatValue} ${styles.annualHighlight} ${
                    annualSavings >= 0 ? styles.positiveStat : styles.negativeStat
                  }`}
                >
                  {annualSavings >= 0 ? '+¥' : '−¥'}
                  <CountUp end={Math.abs(annualSavings)} />
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* 展開時のみ表示されるスライダーエリア（アコーディオン） */}
        <div
          className={`${styles.accordionArea} ${isSimExpanded ? styles.accordionOpen : styles.accordionClosed}`}
          aria-hidden={!isSimExpanded}
        >
          {/* スライダー一覧 */}
          <div className={styles.slidersList}>
            {expenseCategories.map((cat) => {
              const savedBudget = budgets.find((b) => b.categoryId === cat.id)?.monthlyAmount ?? null;
              const past3MonthsAvg = calculatePastMonthsAverageExpense(transactions, currentMonth, cat.id, 3);
              const sliderMax = calculateSliderMax(savedBudget, past3MonthsAvg);
              const simVal = simBudgets[cat.id] ?? 0;
              const spent = expenseByCategory.get(cat.id) || 0;
              const estimated = estimateMonthEndAmount(spent, elapsedDays, daysInMonth);

              // 警告判定
              const isOverSpent = simVal > 0 && spent > simVal;
              const isOverEstimated = simVal > 0 && !isOverSpent && estimated > simVal;

              // マーカー位置（%）
              const markerPct = Math.min(100, Math.max(0, (spent / sliderMax) * 100));

              return (
                <div key={cat.id} className={styles.sliderItem}>
                  <div className={styles.sliderInfoRow}>
                    <div className={styles.catBadge}>
                      <span className={styles.catDot} style={{ backgroundColor: cat.color }} aria-hidden="true" />
                      <span className={styles.catName}>{cat.name}</span>
                    </div>

                    <div className={styles.sliderValues}>
                      <span className={styles.simValueDisplay}>
                        仮予算: <strong>{formatYen(simVal)}</strong>
                      </span>
                      <span className={styles.spentDisplay}>
                        今月: {formatYen(spent)}
                      </span>
                    </div>
                  </div>

                  {/* スライダートラックと使用額マーカー */}
                  <div className={styles.sliderTrackWrapper}>
                    <input
                      type="range"
                      min={0}
                      max={sliderMax}
                      step={500}
                      value={simVal}
                      onChange={(e) => handleSliderChange(cat.id, Number(e.target.value))}
                      className={styles.rangeInput}
                      aria-label={`${cat.name}の仮の月予算`}
                      aria-valuetext={`${cat.name} ${formatAmount(simVal)}円`}
                    />
                    {spent > 0 && (
                      <div
                        className={styles.spentMarker}
                        style={{ left: `${markerPct}%` }}
                        title={`今月の使用額: ${formatYen(spent)}`}
                        aria-hidden="true"
                      >
                        <div className={styles.markerPin} />
                      </div>
                    )}
                  </div>

                  <div className={styles.sliderBoundLabels}>
                    <span>¥0</span>
                    <span className={styles.markerNote}>▲ 今月使用額</span>
                    <span>{formatYen(sliderMax)}</span>
                  </div>

                  {/* 予算超過警告 */}
                  {isOverSpent && (
                    <div className={styles.warningAlert} role="alert">
                      <Icon name="attention" variant="fill" size={16} className={styles.warningIcon} aria-hidden="true" />
                      <span>今月の支出（{formatYen(spent)}）が仮予算を超過しています</span>
                    </div>
                  )}
                  {isOverEstimated && (
                    <div className={styles.warningAlertCaution} role="alert">
                      <Icon name="attention" variant="line" size={16} className={styles.cautionIcon} aria-hidden="true" />
                      <span>現在の支出ペースでは月末着地見込み（{formatYen(estimated)}）が仮予算を超過します</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 展開下部のアクション群 */}
          <div className={styles.expandedFooter}>
            <div className={styles.simActions}>
              <button
                className={styles.applyBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowApplyConfirm(true);
                }}
                type="button"
              >
                <Icon name="check" variant="fill" size={18} aria-hidden="true" />
                <span>この内容を予算に反映</span>
              </button>

              <button
                className={styles.resetBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  handleReset();
                }}
                type="button"
              >
                <Icon name="update" variant="line" size={18} aria-hidden="true" />
                <span>リセット</span>
              </button>
            </div>

            <div className={styles.detailLinkWrapper}>
              <button
                className={styles.detailSettingsLink}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/home/budget');
                }}
                type="button"
                aria-label="予算設定画面へ移動"
              >
                <span>予算を細かく設定する</span>
                <Icon name="arrow_right" variant="line" size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 反映確認ダイアログ */}
      <ConfirmDialog
        isOpen={showApplyConfirm}
        title="予算に反映しますか？"
        message={`現在のシミュレーション内容（月予算合計: ${formatYen(totalSimBudget)}）を正式な予算設定として保存します。`}
        confirmLabel="反映して保存"
        cancelLabel="キャンセル"
        onConfirm={handleApplyToBudget}
        onCancel={() => setShowApplyConfirm(false)}
      />
    </div>
  );
}
