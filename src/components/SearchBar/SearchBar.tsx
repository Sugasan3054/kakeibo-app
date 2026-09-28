import React from 'react';
import { Icon } from '../Icon/Icon';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  id?: string;
  className?: string;
  autoFocus?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = '検索...',
  label = '検索',
  id = 'search-input',
  className = '',
  autoFocus = false,
}) => {
  return (
    <div className={`${styles.searchContainer} ${className}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className={styles.searchIconWrapper} aria-hidden="true">
        <Icon name="search" size={20} />
      </div>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={styles.searchInput}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck="false"
      />
      {value.length > 0 && (
        <button
          type="button"
          className={styles.clearButton}
          onClick={() => onChange('')}
          aria-label="検索キーワードをクリア"
        >
          <Icon name="close" size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
