import { useState, useMemo } from 'react';
import type { Transaction } from '../../db/models';
import { calculateDailyTotals, type DailyTotal } from '../../utils/calculation';
import {
  getCurrentYearMonth,
  getPreviousMonth,
  getNextMonth,
  formatYearMonth,
  getDaysInMonth,
  getFirstDayOfMonth,
  getTodayString,
} from '../../utils/date';
import { Icon } from '../../components/Icon/Icon';
import styles from './TransactionCalendar.module.css';

interface TransactionCalendarProps {
  transactions: Transaction[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function formatDailyCompact(amount: number): string {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1).replace('.0', '')}億`;
  }
  if (amount >= 10000) {
    return `${(amount / 10000).toFixed(1).replace('.0', '')}万`;
  }
  return amount.toLocaleString();
}

export function TransactionCalendar({
  transactions,
  selectedDate,
  onSelectDate,
}: TransactionCalendarProps) {
  const [currentYearMonth, setCurrentYearMonth] = useState(getCurrentYearMonth());

  const [year, month] = useMemo(() => {
    const [y, m] = currentYearMonth.split('-').map(Number);
    return [y, m];
  }, [currentYearMonth]);

  const today = getTodayString();
  const daysInMonth = getDaysInMonth(currentYearMonth);
  const firstDay = getFirstDayOfMonth(year, month);

  // カレンダー用の全日別集計（検索・絞り込みに関係なく全取引対象、残高調整は除外）
  const dailyTotals = useMemo(() => {
    return calculateDailyTotals(transactions, currentYearMonth);
  }, [transactions, currentYearMonth]);

  const handlePrevMonth = () => {
    setCurrentYearMonth((prev) => getPreviousMonth(prev));
  };

  const handleNextMonth = () => {
    setCurrentYearMonth((prev) => getNextMonth(prev));
  };

  const handleDayClick = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (selectedDate === dateStr) {
      onSelectDate(null); // 再度タップで解除
    } else {
      onSelectDate(dateStr);
    }
  };

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }

  return (
    <div className={styles.calendarCard} aria-label="日別収支カレンダー">
      {/* カレンダーヘッダー */}
      <div className={styles.header}>
        <button
          className={styles.navBtn}
          onClick={handlePrevMonth}
          aria-label="前月"
          type="button"
        >
          <Icon name="arrow_left" size={20} aria-hidden="true" />
        </button>

        <span className={styles.title} aria-live="polite">
          {formatYearMonth(currentYearMonth)}
        </span>

        <button
          className={styles.navBtn}
          onClick={handleNextMonth}
          aria-label="翌月"
          type="button"
        >
          <Icon name="arrow_right" size={20} aria-hidden="true" />
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className={styles.weekdays} role="row">
        {WEEKDAYS.map((wd, i) => (
          <span
            key={wd}
            className={`${styles.weekday} ${i === 0 ? styles.sunday : i === 6 ? styles.saturday : ''}`}
            role="columnheader"
          >
            {wd}
          </span>
        ))}
      </div>

      {/* 日付グリッド */}
      <div className={styles.grid} role="grid">
        {days.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className={styles.emptyCell} role="gridcell" />;
          }

          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;
          const dayTotal: DailyTotal | undefined = dailyTotals.get(dateStr);

          const hasIncome = dayTotal && dayTotal.income > 0;
          const hasExpense = dayTotal && dayTotal.expense > 0;

          // 読み上げ用の詳細aria-label
          const labelParts = [`${month}月${day}日`];
          if (hasIncome) labelParts.push(`収入 ${dayTotal.income.toLocaleString()}円`);
          if (hasExpense) labelParts.push(`支出 ${dayTotal.expense.toLocaleString()}円`);
          if (!hasIncome && !hasExpense) labelParts.push('取引なし');
          const accessibleLabel = labelParts.join('、');

          const colIndex = idx % 7;

          return (
            <button
              key={dateStr}
              type="button"
              role="gridcell"
              className={`${styles.dayCell} ${isToday ? styles.today : ''} ${
                isSelected ? styles.selected : ''
              } ${colIndex === 0 ? styles.sunCell : colIndex === 6 ? styles.satCell : ''}`}
              onClick={() => handleDayClick(day)}
              aria-label={accessibleLabel}
              aria-selected={isSelected}
            >
              <span className={styles.dayNumber}>{day}</span>

              <div className={styles.amountsWrapper} aria-hidden="true">
                {hasIncome && (
                  <span className={styles.incomeAmount}>
                    +{formatDailyCompact(dayTotal.income)}
                  </span>
                )}
                {hasExpense && (
                  <span className={styles.expenseAmount}>
                    −{formatDailyCompact(dayTotal.expense)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
