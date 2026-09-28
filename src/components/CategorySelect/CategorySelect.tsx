import React, { useState, useRef, useEffect, useId, useMemo } from 'react';
import { db } from '../../db/database';
import type { Category } from '../../db/models';
import { Icon } from '../Icon/Icon';
import {
  sortCategories,
  validateCategoryName,
  getNextCategoryColor,
  CATEGORY_COLOR_PALETTE,
} from '../../utils/category';
import styles from './CategorySelect.module.css';

interface CategorySelectProps {
  categories: Category[];
  value: string;
  onChange: (categoryId: string) => void;
  kind: 'expense' | 'income';
  hasError?: boolean;
  onCategoryAdded?: (newCategory: Category) => void;
  id?: string;
  'aria-describedby'?: string;
}

export const CategorySelect: React.FC<CategorySelectProps> = ({
  categories,
  value,
  onChange,
  kind,
  hasError = false,
  onCategoryAdded,
  id = 'category-select',
  'aria-describedby': ariaDescribedby,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // 新規分類追加ダイアログの状態
  const [newCatName, setNewCatName] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [nameError, setNameError] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // 現在の種類に合致する分類を並び替え
  const filteredSortedCategories = useMemo(() => {
    const list = categories.filter((c) => c.kind === kind);
    return sortCategories(list);
  }, [categories, kind]);

  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === value);
  }, [categories, value]);

  // 外側クリックで閉じる
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [isOpen]);

  // キーボード操作
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }

    const totalOptions = filteredSortedCategories.length + 1; // +1 for "＋ 分類を追加"

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % totalOptions);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + totalOptions) % totalOptions);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredSortedCategories.length) {
          onChange(filteredSortedCategories[highlightedIndex].id);
          setIsOpen(false);
        } else if (highlightedIndex === filteredSortedCategories.length) {
          openAddModal();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  const openAddModal = () => {
    setIsOpen(false);
    setNewCatName('');
    setNameError('');
    // 自動割り当て色を初期選択
    const autoColor = getNextCategoryColor(filteredSortedCategories);
    setSelectedColor(autoColor);
    setShowAddDialog(true);
  };

  const handleCreateCategory = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const validation = validateCategoryName(newCatName, categories, kind);
    if (!validation.valid) {
      setNameError(validation.error || '無効な分類名です');
      return;
    }

    try {
      // 順序の計算: 初期分類の次、その他の直前
      const maxOrder = filteredSortedCategories.reduce(
        (max, c) => (c.name !== 'その他' && c.order > max ? c.order : max),
        0
      );

      const colorToUse = selectedColor || getNextCategoryColor(filteredSortedCategories);

      const newCategory: Category = {
        id: crypto.randomUUID(),
        kind,
        name: newCatName.trim(),
        color: colorToUse,
        order: maxOrder + 1,
        isCustom: true,
        createdAt: new Date().toISOString(),
      };

      await db.categories.add(newCategory);

      if (onCategoryAdded) {
        onCategoryAdded(newCategory);
      }

      // 新規追加された分類を自動選択
      onChange(newCategory.id);
      setShowAddDialog(false);
    } catch (err) {
      console.error('Failed to create category:', err);
      setNameError('分類の作成に失敗しました');
    }
  };

  return (
    <div className={styles.wrapper} ref={containerRef}>
      {/* Combobox Trigger */}
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-invalid={hasError}
        aria-describedby={ariaDescribedby}
        className={`${styles.trigger} ${hasError ? styles.triggerError : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
      >
        <span className={styles.triggerContent}>
          {selectedCategory ? (
            <>
              <span
                className={styles.colorDot}
                style={{ backgroundColor: selectedCategory.color }}
                aria-hidden="true"
              />
              <span>{selectedCategory.name}</span>
            </>
          ) : (
            <span className={styles.placeholder}>選択してください</span>
          )}
        </span>
        <span
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
          aria-hidden="true"
        >
          <Icon name="arrow_down" size={18} />
        </span>
      </button>

      {/* Listbox Dropdown */}
      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          className={styles.dropdown}
          aria-label={`${kind === 'expense' ? '支出' : '収入'}分類の候補`}
        >
          {filteredSortedCategories.map((cat, idx) => {
            const isSelected = cat.id === value;
            const isHighlighted = idx === highlightedIndex;
            return (
              <button
                key={cat.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`${styles.option} ${isSelected ? styles.optionSelected : ''} ${
                  isHighlighted ? styles.optionHighlighted : ''
                }`}
                onClick={() => {
                  onChange(cat.id);
                  setIsOpen(false);
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
              >
                <span
                  className={styles.colorDot}
                  style={{ backgroundColor: cat.color }}
                  aria-hidden="true"
                />
                <span>{cat.name}</span>
                {isSelected && (
                  <span className={styles.optionCheck} aria-hidden="true">
                    <Icon name="check" size={16} />
                  </span>
                )}
              </button>
            );
          })}

          {/* 区切り線 */}
          <div className={styles.divider} role="separator" />

          {/* ＋ 分類を追加 */}
          <button
            type="button"
            role="option"
            aria-selected={false}
            className={`${styles.addOption} ${
              highlightedIndex === filteredSortedCategories.length
                ? styles.addOptionHighlighted
                : ''
            }`}
            onClick={openAddModal}
            onMouseEnter={() => setHighlightedIndex(filteredSortedCategories.length)}
          >
            <Icon name="add" size={18} aria-hidden="true" />
            <span>分類を追加</span>
          </button>
        </div>
      )}

      {/* 新規分類追加モーダル（ダイアログ） */}
      {showAddDialog && (
        <div
          className={styles.dialogOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-category-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddDialog(false);
            }
          }}
        >
          <div className={styles.dialogContent}>
            <h3 id="add-category-title" className={styles.dialogTitle}>
              新しい{kind === 'expense' ? '支出' : '収入'}分類を追加
            </h3>
            <div className={styles.dialogForm}>
              <div className={styles.dialogField}>
                <label htmlFor="new-category-name" className={styles.dialogLabel}>
                  分類名 <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input
                  id="new-category-name"
                  type="text"
                  autoFocus
                  maxLength={20}
                  value={newCatName}
                  onChange={(e) => {
                    setNewCatName(e.target.value);
                    setNameError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCreateCategory(e);
                    }
                  }}
                  placeholder="例：カフェ、趣味"
                  className={`${styles.dialogInput} ${nameError ? styles.dialogInputError : ''}`}
                  aria-invalid={!!nameError}
                  aria-describedby={nameError ? 'new-category-error' : undefined}
                />
                {nameError && (
                  <p id="new-category-error" className={styles.fieldError} role="alert">
                    {nameError}
                  </p>
                )}
              </div>

              <div className={styles.dialogField}>
                <label className={styles.dialogLabel}>カラー（任意）</label>
                <div className={styles.paletteRow}>
                  {CATEGORY_COLOR_PALETTE.map((c) => {
                    const isPicked = selectedColor === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        className={`${styles.paletteChip} ${
                          isPicked ? styles.paletteChipSelected : ''
                        }`}
                        style={{ backgroundColor: c }}
                        onClick={() => setSelectedColor(c)}
                        aria-label={`色 ${c}`}
                      >
                        {isPicked && <Icon name="check" size={14} aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={styles.dialogActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowAddDialog(false)}
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  className={styles.submitBtn}
                  onClick={handleCreateCategory}
                >
                  追加
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
