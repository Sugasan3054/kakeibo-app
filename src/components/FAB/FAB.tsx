import { Icon } from '../Icon/Icon';
import styles from './FAB.module.css';

interface FABProps {
  onClick: () => void;
}

export function FAB({ onClick }: FABProps) {
  return (
    <button
      className={styles.fab}
      onClick={onClick}
      aria-label="取引を追加"
    >
      <Icon name="add" variant="line" size={28} aria-hidden="true" />
    </button>
  );
}
