import { useState, useCallback } from 'react';
import { getFirstDayOfMonth, getDaysInMonth, getTodayString, formatDateToString } from '../../utils/date';
import { Icon } from '../Icon/Icon';
import styles from './Calendar.module.css';

interface CalendarProps {
  value: string; // 'YYYY-MM-DD'
  onChange: (date: string) => void;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function Calendar({ value, onChange }: CalendarProps) {
  const [viewYear, viewMonth] = value ? value.split('-').map(Number) : (() => {
    const now = new Date();
    return [now.getFullYear(), now.getMonth() + 1];
  })();

  const [displayYear, setDisplayYear] = useState(viewYear);
  const [displayMonth, setDisplayMonth] = useState(viewMonth);

  const today = getTodayString();
  const daysInMonth = getDaysInMonth(`${displayYear}-${String(displayMonth).padStart(2, '0')}`);
  const firstDay = getFirstDayOfMonth(displayYear, displayMonth);

  const goToPrevMonth = useCallback(() => {
    if (displayMonth === 1) {
      setDisplayYear(displayYear - 1);
      setDisplayMonth(12);
    } else {
      setDisplayMonth(displayMonth - 1);
    }
  }, [displayYear, displayMonth]);

  const goToNextMonth = useCallback(() => {
    if (displayMonth === 12) {
      setDisplayYear(displayYear + 1);
      setDisplayMonth(1);
    } else {
      setDisplayMonth(displayMonth + 1);
    }
  }, [displayYear, displayMonth]);

  const handleDayClick = useCallback((day: number) => {
    const dateStr = `${displayYear}-${String(displayMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(dateStr);
  }, [displayYear, displayMonth, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, day: number) => {
    const currentDate = new Date(displayYear, displayMonth - 1, day);
    let newDate: Date | null = null;

    switch (e.key) {
      case 'ArrowLeft':
        newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() - 1);
        break;
      case 'ArrowRight':
        newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + 1);
        break;
      case 'ArrowUp':
        newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() - 7);
        break;
      case 'ArrowDown':
        newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleDayClick(day);
        return;
      default:
        return;
    }

    e.preventDefault();
    if (newDate) {
      const newDateStr = formatDateToString(newDate);
      onChange(newDateStr);
      if (newDate.getMonth() + 1 !== displayMonth || newDate.getFullYear() !== displayYear) {
        setDisplayYear(newDate.getFullYear());
        setDisplayMonth(newDate.getMonth() + 1);
      }
    }
  }, [displayYear, displayMonth, onChange, handleDayClick]);

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }

  return (
    <div className={styles.calendar} role="grid" aria-label="日付選択カレンダー">
      <div className={styles.header}>
        <button
          className={styles.navBtn}
          onClick={goToPrevMonth}
          aria-label="前月"
          type="button"
        >
          <Icon name="arrow_left" size={18} aria-hidden="true" />
        </button>
        <span className={styles.monthLabel} aria-live="polite">
          {displayYear}年{displayMonth}月
        </span>
        <button
          className={styles.navBtn}
          onClick={goToNextMonth}
          aria-label="翌月"
          type="button"
        >
          <Icon name="arrow_right" size={18} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.weekdays} role="row">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className={`${styles.weekday} ${i === 0 ? styles.sunday : ''} ${i === 6 ? styles.saturday : ''}`} role="columnheader" aria-label={`${w}曜日`}>
            {w}
          </div>
        ))}
      </div>

      <div className={styles.days}>
        {days.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className={styles.emptyDay} />;
          }
          const dateStr = `${displayYear}-${String(displayMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = dateStr === today;
          const isSelected = dateStr === value;
          const dayOfWeek = (firstDay + day - 1) % 7;

          return (
            <button
              key={day}
              type="button"
              className={`${styles.day} ${isToday ? styles.today : ''} ${isSelected ? styles.selected : ''} ${dayOfWeek === 0 ? styles.sunday : ''} ${dayOfWeek === 6 ? styles.saturday : ''}`}
              onClick={() => handleDayClick(day)}
              onKeyDown={(e) => handleKeyDown(e, day)}
              aria-label={`${displayYear}年${displayMonth}月${day}日${isToday ? '（今日）' : ''}`}
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              role="gridcell"
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
