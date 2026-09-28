import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  showPercentage?: boolean;
  variant?: 'default' | 'warning' | 'danger';
  className?: string;
}

export function ProgressBar({
  value,
  max,
  label,
  showPercentage = false,
  variant = 'default',
  className,
}: ProgressBarProps) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const overBudget = value > max;

  const effectiveVariant = overBudget ? 'danger' : variant;

  return (
    <div className={`${styles.container} ${className || ''}`}>
      {label && (
        <div className={styles.labelRow}>
          <span className={styles.label}>{label}</span>
          {showPercentage && (
            <span className={`${styles.percentage} ${overBudget ? styles.overBudget : ''}`}>
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || 'プログレスバー'}
      >
        <div
          className={`${styles.fill} ${styles[effectiveVariant]}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
