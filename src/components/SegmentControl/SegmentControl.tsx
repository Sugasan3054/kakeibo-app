import styles from './SegmentControl.module.css';

interface SegmentControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  name: string;
}

export function SegmentControl<T extends string>({
  options,
  value,
  onChange,
  name,
}: SegmentControlProps<T>) {
  const selectedIndex = options.findIndex((o) => o.value === value);

  return (
    <div className={styles.container} role="radiogroup" aria-label={name}>
      <div
        className={styles.indicator}
        style={{
          width: `${100 / options.length}%`,
          transform: `translateX(${selectedIndex * 100}%)`,
        }}
      />
      {options.map((option) => (
        <button
          key={option.value}
          role="radio"
          aria-checked={value === option.value}
          className={`${styles.option} ${value === option.value ? styles.active : ''}`}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
