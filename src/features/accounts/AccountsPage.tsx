import { useState, useEffect, useCallback } from 'react';
import { db } from '../../db/database';
import type { Account, Transaction } from '../../db/models';
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_ICONS } from '../../db/models';
import { calcAccountBalance, calcTotalAssets } from '../../utils/calculation';
import { formatYen, formatYenAria } from '../../utils/format';
import { Modal } from '../../components/Modal/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { Loading } from '../../components/Loading/Loading';
import { Icon } from '../../components/Icon/Icon';
import { useToast } from '../../components/Toast/Toast';
import { AccountForm } from './AccountForm';
import { AdjustBalanceForm } from './AdjustBalanceForm';
import styles from './AccountsPage.module.css';

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [adjustingAccount, setAdjustingAccount] = useState<Account | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const { showToast } = useToast();

  const loadData = useCallback(async () => {
    try {
      const [accs, txs] = await Promise.all([
        db.accounts.orderBy('createdAt').toArray(),
        db.transactions.toArray(),
      ]);
      setAccounts(accs);
      setTransactions(txs);
    } catch (err) {
      console.error('Failed to load accounts:', err);
      showToast('データの読み込みに失敗しました', { type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdd = () => {
    setEditingAccount(null);
    setShowForm(true);
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setShowForm(true);
  };

  const handleSave = async (accountData: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    try {
      if (editingAccount) {
        const updated: Account = {
          ...editingAccount,
          ...accountData,
          updatedAt: now,
        };
        await db.accounts.put(updated);
        showToast('口座を更新しました');
      } else {
        const newAccount: Account = {
          ...accountData,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
        };
        await db.accounts.add(newAccount);
        showToast('口座を登録しました');
      }
      setShowForm(false);
      setEditingAccount(null);
      await loadData();
    } catch (err) {
      console.error('Failed to save account:', err);
      showToast('保存に失敗しました', { type: 'error' });
    }
  };

  const handleDeleteRequest = (account: Account) => {
    const hasTransactions = transactions.some((t) => t.accountId === account.id);
    if (hasTransactions) {
      showToast('この口座には取引が紐づいているため削除できません', { type: 'error', duration: 5000 });
      return;
    }
    setDeleteTarget(account);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await db.accounts.delete(deleteTarget.id);
      showToast('口座を削除しました');
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      console.error('Failed to delete account:', err);
      showToast('削除に失敗しました', { type: 'error' });
    }
  };

  const handleAdjust = (account: Account) => {
    setAdjustingAccount(account);
  };

  const handleAdjustSave = async (amount: number) => {
    if (!adjustingAccount) return;
    const now = new Date().toISOString();
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    try {
      const adjustmentTx: Transaction = {
        id: crypto.randomUUID(),
        kind: 'adjustment',
        amount,
        categoryId: null,
        date: dateStr,
        memo: '残高調整',
        accountId: adjustingAccount.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.transactions.add(adjustmentTx);
      showToast('残高を調整しました');
      setAdjustingAccount(null);
      await loadData();
    } catch (err) {
      console.error('Failed to adjust balance:', err);
      showToast('残高調整に失敗しました', { type: 'error' });
    }
  };

  const totalAssets = calcTotalAssets(accounts, transactions);

  if (loading) return <Loading />;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.pageTitle}>口座</h1>
        <button className={styles.addBtn} onClick={handleAdd} aria-label="口座を追加" type="button">
          <Icon name="add" variant="line" size={18} aria-hidden="true" />
          追加
        </button>
      </header>

      <div className={`${styles.totalCard} ${totalAssets < 0 ? styles.negativeTotalCard : ''}`}>
        <span className={styles.totalLabel}>総資産</span>
        <span
          className={styles.totalAmount}
          aria-label={formatYenAria(totalAssets)}
        >
          {formatYen(totalAssets)}
        </span>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          iconName="bank"
          title="口座がありません"
          description="口座を登録して、支出や収入を管理しましょう"
          action={{ label: '口座を追加', onClick: handleAdd }}
        />
      ) : (
        <ul className={styles.list} aria-label="口座一覧">
          {accounts.map((account) => {
            const balance = calcAccountBalance(account, transactions);
            const isNegative = balance < 0;
            const iconName = (ACCOUNT_TYPE_ICONS[account.type] || 'bank') as any;
            return (
              <li
                key={account.id}
                className={`${styles.card} ${isNegative ? styles.cardNegative : ''}`}
              >
                <div className={styles.cardMain}>
                  <div className={styles.cardIcon} style={{ backgroundColor: account.color + '20', color: account.color }}>
                    <Icon name={iconName} variant="line" size={24} aria-hidden="true" />
                  </div>
                  <div className={styles.cardInfo}>
                    <span className={styles.cardName}>{account.name}</span>
                    <span className={styles.cardType}>{ACCOUNT_TYPE_LABELS[account.type]}</span>
                  </div>
                  <span
                    className={`${styles.cardBalance} ${isNegative ? styles.negativeBalance : ''}`}
                    aria-label={formatYenAria(balance)}
                  >
                    {formatYen(balance)}
                  </span>
                </div>
                {isNegative && (
                  <div className={styles.negativeNotice} role="note">
                    <Icon name="attention" variant="line" size={16} aria-hidden="true" />
                    <span>残高がマイナスです。初期残高の設定や残高調整を確認してください</span>
                  </div>
                )}
                <div className={styles.cardActions}>
                  <button
                    className={styles.actionBtn}
                    onClick={() => handleAdjust(account)}
                    aria-label={`${account.name}の残高を調整`}
                    type="button"
                  >
                    残高調整
                  </button>
                  <button
                    className={styles.iconBtn}
                    onClick={() => handleEdit(account)}
                    aria-label={`${account.name}を編集`}
                    type="button"
                  >
                    <Icon name="pencil" variant="line" size={18} aria-hidden="true" />
                  </button>
                  <button
                    className={`${styles.iconBtn} ${styles.deleteBtn}`}
                    onClick={() => handleDeleteRequest(account)}
                    aria-label={`${account.name}を削除`}
                    type="button"
                  >
                    <Icon name="trash" variant="line" size={18} aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingAccount(null); }}
        title={editingAccount ? '口座を編集' : '口座を追加'}
      >
        <AccountForm
          account={editingAccount}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingAccount(null); }}
        />
      </Modal>

      <Modal
        isOpen={!!adjustingAccount}
        onClose={() => setAdjustingAccount(null)}
        title="残高調整"
        size="sm"
      >
        {adjustingAccount && (
          <AdjustBalanceForm
            account={adjustingAccount}
            currentBalance={calcAccountBalance(adjustingAccount, transactions)}
            onSave={handleAdjustSave}
            onCancel={() => setAdjustingAccount(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="口座を削除"
        message={`「${deleteTarget?.name}」を削除しますか？この操作は元に戻せません。`}
        confirmLabel="削除"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        variant="danger"
      />
    </div>
  );
}
