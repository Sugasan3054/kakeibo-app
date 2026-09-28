import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../../db/database';
import type { Transaction, Category, Account } from '../../db/models';
import { formatSignedAmount } from '../../utils/format';
import { formatDateShort } from '../../utils/date';
import { filterTransactions } from '../../utils/calculation';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { Loading } from '../../components/Loading/Loading';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { SegmentControl } from '../../components/SegmentControl/SegmentControl';
import { Icon } from '../../components/Icon/Icon';
import { useToast } from '../../components/Toast/Toast';
import { TransactionCalendar } from './TransactionCalendar';
import { TransactionInputModal } from './TransactionInputModal';
import { SearchBar } from '../../components/SearchBar/SearchBar';
import styles from './TransactionsPage.module.css';

const formatDate = formatDateShort;

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [deleteTx, setDeleteTx] = useState<Transaction | null>(null);
  const { showToast } = useToast();

  // 11-5: カレンダー日付選択
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 11-5: 検索バー（300msデバウンス）
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // 11-5: 絞り込み（種別 & 分類チップ）
  const [selectedKind, setSelectedKind] = useState<'all' | 'expense' | 'income'>('all');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadData = useCallback(async () => {
    try {
      const [txs, cats, accs] = await Promise.all([
        db.transactions.orderBy('createdAt').reverse().toArray(),
        db.categories.toArray(),
        db.accounts.toArray(),
      ]);
      setTransactions(txs);
      setCategories(cats);
      setAccounts(accs);
    } catch (err) {
      console.error('Failed to load transactions:', err);
      showToast('データの読み込みに失敗しました', { type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('kakeibo:data-changed', handleUpdate);
    return () => window.removeEventListener('kakeibo:data-changed', handleUpdate);
  }, [loadData]);

  // 種別選択に応じて表示する分類チップを切り替え
  const displayedCategories = useMemo(() => {
    if (selectedKind === 'expense') return categories.filter((c) => c.kind === 'expense');
    if (selectedKind === 'income') return categories.filter((c) => c.kind === 'income');
    return categories;
  }, [categories, selectedKind]);

  const toggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const isFiltered = Boolean(
    selectedDate ||
    selectedKind !== 'all' ||
    selectedCategoryIds.length > 0 ||
    debouncedQuery.trim()
  );

  const handleClearAllFilters = () => {
    setSelectedDate(null);
    setSelectedKind('all');
    setSelectedCategoryIds([]);
    setSearchQuery('');
    setDebouncedQuery('');
  };

  // 検索・日付・種別・分類のAND条件フィルター
  const filteredTransactions = useMemo(() => {
    return filterTransactions(transactions, categories, accounts, {
      query: debouncedQuery,
      date: selectedDate,
      kind: selectedKind,
      categoryIds: selectedCategoryIds,
    });
  }, [transactions, categories, accounts, debouncedQuery, selectedDate, selectedKind, selectedCategoryIds]);

  const getCategoryName = useCallback((categoryId: string | null): string => {
    if (!categoryId) return '残高調整';
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.name || '不明';
  }, [categories]);

  const getCategoryColor = useCallback((categoryId: string | null): string => {
    if (!categoryId) return 'var(--color-adjustment)';
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.color || '#6b7280';
  }, [categories]);

  const getAccountName = useCallback((accountId: string): string => {
    const acc = accounts.find((a) => a.id === accountId);
    return acc?.name || '不明';
  }, [accounts]);

  const handleDelete = async () => {
    if (!deleteTx) return;
    const txToDelete = deleteTx;
    try {
      await db.transactions.delete(txToDelete.id);
      showToast('取引を削除しました', {
        action: {
          label: '元に戻す',
          onClick: async () => {
            try {
              await db.transactions.add(txToDelete);
              await loadData();
              showToast('取引を復元しました');
            } catch {
              showToast('復元に失敗しました', { type: 'error' });
            }
          },
        },
        duration: 5000,
      });
      setDeleteTx(null);
      await loadData();
    } catch (err) {
      console.error('Failed to delete transaction:', err);
      showToast('削除に失敗しました', { type: 'error' });
    }
  };

  if (loading) return <Loading />;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.pageTitle}>入出金</h1>
      </header>

      {/* 11-5: 1. カレンダー */}
      <section className={styles.section} aria-label="日別カレンダー">
        <TransactionCalendar
          transactions={transactions}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
        {selectedDate && (
          <div className={styles.selectedDateBanner} role="status">
            <span>{selectedDate.split('-')[1]}月{selectedDate.split('-')[2]}日の取引を表示中</span>
            <button
              type="button"
              className={styles.clearDateBtn}
              onClick={() => setSelectedDate(null)}
              aria-label="日付の絞り込みを解除"
            >
              <Icon name="close" size={16} aria-hidden="true" />
              <span>解除</span>
            </button>
          </div>
        )}
      </section>

      {/* 11-5: 2. 検索バー */}
      <section className={styles.section} aria-label="取引検索">
        <SearchBar
          id="transaction-search"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="メモ、分類、口座、金額で検索..."
          label="履歴を検索"
        />
      </section>

      {/* 11-5: 3. 絞り込み */}
      <section className={styles.filterSection} aria-label="絞り込み条件">
        <SegmentControl
          name="種別で絞り込み"
          options={[
            { value: 'all', label: 'すべて' },
            { value: 'expense', label: '支出' },
            { value: 'income', label: '収入' },
          ]}
          value={selectedKind}
          onChange={(val) => setSelectedKind(val)}
        />

        {/* 分類チップ（横スクロール・複数選択） */}
        <div className={styles.categoryChips} role="group" aria-label="分類で絞り込み">
          {displayedCategories.map((cat) => {
            const isSelected = selectedCategoryIds.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                className={`${styles.categoryChip} ${isSelected ? styles.chipSelected : ''}`}
                onClick={() => toggleCategory(cat.id)}
                aria-pressed={isSelected}
              >
                <span className={styles.chipDot} style={{ backgroundColor: cat.color }} aria-hidden="true" />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* 件数 & クリアボタン */}
        <div className={styles.filterStatusBar}>
          <span className={styles.countBadge}>
            該当 {filteredTransactions.length}件
          </span>
          {isFiltered && (
            <button
              type="button"
              className={styles.clearAllBtn}
              onClick={handleClearAllFilters}
            >
              <Icon name="close" size={14} aria-hidden="true" />
              <span>条件をクリア</span>
            </button>
          )}
        </div>
      </section>

      {/* 11-5: 4. 履歴一覧 */}
      <section className={styles.section} aria-label="取引履歴一覧">
        {filteredTransactions.length === 0 ? (
          <EmptyState
            iconName="transactions"
            title={isFiltered ? '一致する取引がありません' : '取引がありません'}
            description={
              isFiltered
                ? '検索条件や日付を変更してお試しください'
                : '右下の「＋」ボタンから収支を登録してみましょう'
            }
          />
        ) : (
          <ul className={styles.list} aria-label="取引一覧">
            {filteredTransactions.map((tx) => {
              const isExpense = tx.kind === 'expense';
              const isIncome = tx.kind === 'income';
              const isAdjustment = tx.kind === 'adjustment';

              return (
                <li key={tx.id} className={styles.row}>
                  <div className={styles.rowLeft}>
                    <div
                      className={styles.kindBadge}
                      style={{
                        backgroundColor: getCategoryColor(tx.categoryId) + '20',
                        color: getCategoryColor(tx.categoryId),
                      }}
                    >
                      <Icon
                        name={isExpense ? 'expense' : isIncome ? 'income' : 'update'}
                        variant="line"
                        size={14}
                        aria-hidden="true"
                      />
                      <span>{isExpense ? '支出' : isIncome ? '収入' : '調整'}</span>
                    </div>
                    <div className={styles.rowInfo}>
                      <div className={styles.rowTop}>
                        <span className={styles.category}>{getCategoryName(tx.categoryId)}</span>
                        <span className={styles.date}>{formatDate(tx.date)}</span>
                      </div>
                      {tx.memo && <span className={styles.memo}>{tx.memo}</span>}
                      <span className={styles.account}>{getAccountName(tx.accountId)}</span>
                    </div>
                  </div>
                  <div className={styles.rowRight}>
                    <span
                      className={`${styles.amount} ${
                        isExpense ? styles.expense : isIncome ? styles.income : ''
                      }`}
                    >
                      {isAdjustment
                        ? `${tx.amount >= 0 ? '+' : '−'}¥${Math.abs(tx.amount).toLocaleString()}`
                        : formatSignedAmount(tx.amount, tx.kind)}
                    </span>
                    <div className={styles.actions}>
                      {!isAdjustment && (
                        <button
                          className={styles.actionBtn}
                          onClick={() => setEditTx(tx)}
                          aria-label="編集"
                          type="button"
                        >
                          <Icon name="pencil" variant="line" size={16} aria-hidden="true" />
                        </button>
                      )}
                      <button
                        className={`${styles.actionBtn} ${styles.deleteAction}`}
                        onClick={() => setDeleteTx(tx)}
                        aria-label="削除"
                        type="button"
                      >
                        <Icon name="trash" variant="line" size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <TransactionInputModal
        isOpen={!!editTx}
        onClose={() => setEditTx(null)}
        editTransaction={editTx}
        onSaved={loadData}
      />

      <ConfirmDialog
        isOpen={!!deleteTx}
        title="取引を削除"
        message="この取引を削除しますか？削除後は「元に戻す」で復元できます。"
        confirmLabel="削除"
        cancelLabel="キャンセル"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTx(null)}
        variant="danger"
      />
    </div>
  );
}
