import { Icon, type IconName } from '../Icon/Icon';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  iconName?: IconName;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ iconName = 'report', title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.container} role="status">
      <div className={styles.iconWrap}>
        <Icon name={iconName} variant="line" size={48} className={styles.icon} aria-hidden="true" />
      </div>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {action && (
        <button className={styles.action} onClick={action.onClick} type="button">
          {action.label}
        </button>
      )}
    </div>
  );
}
