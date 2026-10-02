import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/database';
import { useSettings } from '../../hooks/useSettings';
import { usePwaUpdate } from '../../contexts/PwaUpdateContext';
import { useToast } from '../../components/Toast/Toast';
import { Icon } from '../../components/Icon/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { PasscodeSheet } from './PasscodeSheet';
import { insertSampleData, resetAllData } from '../../utils/sampleData';
import { applyTheme } from '../../utils/theme';
import {
  validateCategoryName,
  deleteCategoryWithRelocation,
  CATEGORY_COLOR_PALETTE,
} from '../../utils/category';
import type { Category } from '../../db/models';
import { GITHUB_URL, ISSUES_URL } from '../../config/links';
import { LATEST_RELEASE, formatReleaseDate } from '../../data/releases';
import styles from './SettingsPage.module.css';

export function SettingsPage() {
  const navigate = useNavigate();
  const { settings, updateSettings } = useSettings();
  const { showToast } = useToast();
  const { checkForUpdate, isCheckingUpdate, updateStatusMessage } = usePwaUpdate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryTab, setCategoryTab] = useState<'expense' | 'income'>('expense');

  // パスコードボトムシート状態
  const [passcodeSheetOpen, setPasscodeSheetOpen] = useState(false);
  const [passcodeSheetTab, setPasscodeSheetTab] = useState<'change' | 'remove'>('change');

  // テスト用確認ダイアログ
  const [showSampleConfirm, setShowSampleConfirm] = useState(false);
  const [showDeleteConfirm1, setShowDeleteConfirm1] = useState(false);
  const [showDeleteConfirm2, setShowDeleteConfirm2] = useState(false);

  // 分類編集ダイアログ
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editError, setEditError] = useState('');

  // 分類削除・移行ダイアログ
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [deleteTxCount, setDeleteTxCount] = useState<number>(0);
  const [relocateDestId, setRelocateDestId] = useState<string>('');
  const [showDirectDeleteConfirm, setShowDirectDeleteConfirm] = useState(false);



  const loadCategories = useCallback(async () => {
    try {
      const cats = await db.categories.orderBy('order').toArray();
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // テーマ変更（ライトまたはダークの2択、トースト通知は出さない）
  const handleThemeChange = async (theme: 'light' | 'dark') => {
    applyTheme(theme);
    await updateSettings({ theme });
  };



  // 分類編集の開始
  const handleOpenEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setEditName(cat.name);
    setEditColor(cat.color);
    setEditError('');
  };

  // 分類編集の保存
  const handleSaveEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;

    const validation = validateCategoryName(editName, categories, editingCategory.kind, editingCategory.id);
    if (!validation.valid) {
      setEditError(validation.error || '無効な分類名です');
      return;
    }

    try {
      await db.categories.update(editingCategory.id, {
        name: editName.trim(),
        color: editColor,
      });
      showToast(`分類「${editName.trim()}」を更新しました`);
      setEditingCategory(null);
      await loadCategories();
    } catch (err) {
      console.error('Failed to update category:', err);
      setEditError('分類の更新に失敗しました');
    }
  };

  // 分類削除の開始
  const handleOpenDeleteCategory = async (cat: Category) => {
    const txCount = await db.transactions.where('categoryId').equals(cat.id).count();
    setDeletingCategory(cat);
    setDeleteTxCount(txCount);

    if (txCount === 0) {
      setShowDirectDeleteConfirm(true);
    } else {
      // 紐づく取引がある場合、初期値として「その他」を探す
      const otherCat = categories.find((c) => c.kind === cat.kind && c.name === 'その他' && c.id !== cat.id);
      const fallbackCat = categories.find((c) => c.kind === cat.kind && c.id !== cat.id);
      setRelocateDestId(otherCat?.id || fallbackCat?.id || '');
    }
  };

  // 分類削除の実行（取引移行あり／なし）
  const handleConfirmDeleteCategory = async () => {
    if (!deletingCategory) return;
    try {
      const destId = deleteTxCount > 0 ? relocateDestId : null;
      const { movedCount } = await deleteCategoryWithRelocation(deletingCategory.id, destId);

      const destCatName = categories.find((c) => c.id === destId)?.name;
      if (movedCount > 0 && destCatName) {
        showToast(`分類を削除し、${movedCount}件の取引を「${destCatName}」に移行しました`);
      } else {
        showToast(`分類「${deletingCategory.name}」を削除しました`);
      }

      setDeletingCategory(null);
      setShowDirectDeleteConfirm(false);
      await loadCategories();
    } catch (err) {
      console.error('Failed to delete category:', err);
      showToast('分類の削除に失敗しました', { type: 'error' });
    }
  };

  const handleExport = useCallback(async () => {
    try {
      const [accounts, transactions, cats, settingsData] = await Promise.all([
        db.accounts.toArray(),
        db.transactions.toArray(),
        db.categories.toArray(),
        db.settings.toArray(),
      ]);

      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        data: { accounts, transactions, categories: cats, settings: settingsData },
      };

      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kakeibo-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('バックアップをエクスポートしました');
    } catch (err) {
      console.error('Export failed:', err);
      showToast('エクスポートに失敗しました', { type: 'error' });
    }
  }, [showToast]);

  const handleImport = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importData = JSON.parse(text);

        if (!importData.version || !importData.data) {
          showToast('無効なバックアップファイルです', { type: 'error' });
          return;
        }

        const { accounts, transactions, categories: importedCats } = importData.data;

        await db.transaction('rw',
          db.accounts, db.transactions, db.categories,
          async () => {
            await db.accounts.clear();
            await db.transactions.clear();
            await db.categories.clear();
            if (accounts) await db.accounts.bulkAdd(accounts);
            if (transactions) await db.transactions.bulkAdd(transactions);
            if (importedCats) await db.categories.bulkAdd(importedCats);
          }
        );

        showToast('バックアップを復元しました');
        setTimeout(() => window.location.reload(), 1000);
      } catch (err) {
        console.error('Import failed:', err);
        showToast('インポートに失敗しました', { type: 'error' });
      }
    };
    input.click();
  }, [showToast]);

  const customCategories = categories.filter((c) => c.isCustom && c.kind === categoryTab);
  const eligibleRelocateCategories = categories.filter(
    (c) => deletingCategory && c.kind === deletingCategory.kind && c.id !== deletingCategory.id
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="戻る">
          <Icon name="arrow_left" size={20} />
        </button>
        <h1 className={styles.pageTitle}>設定</h1>
      </header>

      {/* 修正1: テーマ（ライトとダークの2択） */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>テーマ</h2>
        <div className={styles.themeOptions} role="radiogroup" aria-label="テーマ設定">
          {(['light', 'dark'] as const).map((t) => (
            <button
              key={t}
              role="radio"
              aria-checked={settings.theme === t}
              className={`${styles.themeBtn} ${settings.theme === t ? styles.themeActive : ''}`}
              onClick={() => handleThemeChange(t)}
            >
              <Icon
                name={t === 'light' ? 'sun' : 'moon'}
                variant={settings.theme === t ? 'fill' : 'line'}
                size={18}
              />
              <span>{t === 'light' ? 'ライト' : 'ダーク'}</span>
            </button>
          ))}
        </div>
      </section>

      {/* パスコード */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>セキュリティ</h2>
        {settings.passcodeEnabled ? (
          <div className={styles.securityStatus}>
            <span className={styles.statusBadge}>
              <Icon name="lock" variant="fill" size={16} /> パスコード設定済み
            </span>
            <div className={styles.securityActions}>
              <button
                type="button"
                className={styles.secondaryActionBtn}
                onClick={() => {
                  setPasscodeSheetTab('change');
                  setPasscodeSheetOpen(true);
                }}
              >
                パスコードを変更
              </button>
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={() => {
                  setPasscodeSheetTab('remove');
                  setPasscodeSheetOpen(true);
                }}
              >
                設定解除
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => setPasscodeSheetOpen(true)}
          >
            パスコードを設定
          </button>
        )}
      </section>

      {/* 修正2: 追加した分類の管理 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>分類の管理</h2>
        <p className={styles.description}>
          自分で新しく追加した分類の名前変更や削除が行えます（初期分類は変更・削除できません）。
        </p>

        <div className={styles.categoryTabs} role="tablist" aria-label="分類種別">
          <button
            type="button"
            role="tab"
            aria-selected={categoryTab === 'expense'}
            className={`${styles.categoryTabBtn} ${categoryTab === 'expense' ? styles.categoryTabActive : ''}`}
            onClick={() => setCategoryTab('expense')}
          >
            支出分類
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={categoryTab === 'income'}
            className={`${styles.categoryTabBtn} ${categoryTab === 'income' ? styles.categoryTabActive : ''}`}
            onClick={() => setCategoryTab('income')}
          >
            収入分類
          </button>
        </div>

        {customCategories.length === 0 ? (
          <div className={styles.emptyCategory}>
            追加した{categoryTab === 'expense' ? '支出' : '収入'}分類はありません
          </div>
        ) : (
          <div className={styles.categoryList}>
            {customCategories.map((cat) => (
              <div key={cat.id} className={styles.categoryItem}>
                <div className={styles.categoryInfo}>
                  <span
                    className={styles.categoryColorDot}
                    style={{ backgroundColor: cat.color }}
                    aria-hidden="true"
                  />
                  <span className={styles.categoryName}>{cat.name}</span>
                </div>
                <div className={styles.categoryActions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => handleOpenEditCategory(cat)}
                    aria-label={`「${cat.name}」を編集`}
                  >
                    <Icon name="pencil" size={18} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                    onClick={() => handleOpenDeleteCategory(cat)}
                    aria-label={`「${cat.name}」を削除`}
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* バックアップ */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>バックアップ</h2>
        <p className={styles.description}>
          データをJSONファイルとしてエクスポート・インポートできます。定期的にバックアップを取ることをお勧めします。
        </p>
        <div className={styles.backupActions}>
          <button className={styles.actionBtn} onClick={handleExport}>
            <Icon name="download" size={18} />
            エクスポート
          </button>
          <button className={styles.actionBtn} onClick={handleImport}>
            <Icon name="upload" size={18} />
            インポート
          </button>
        </div>
      </section>

      {/* 情報 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>アプリ情報</h2>
        <div className={styles.infoList}>
          <div className={styles.versionRow}>
            <div className={styles.versionDetails}>
              <span className={styles.versionLabel}>バージョン</span>
              <span className={styles.versionValue}>
                バージョン {LATEST_RELEASE.version}（{formatReleaseDate(LATEST_RELEASE.date)}）
              </span>
              <span className={styles.commitHash}>
                {typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'dev'}
              </span>
            </div>
            <button
              type="button"
              className={styles.checkUpdateBtn}
              onClick={() => checkForUpdate()}
              disabled={isCheckingUpdate}
              aria-label="新しいバージョンがあるか確認する"
            >
              <Icon
                name="update"
                size={14}
                className={isCheckingUpdate ? styles.spinIcon : ''}
                aria-hidden="true"
              />
              <span>{isCheckingUpdate ? '確認中…' : '更新を確認'}</span>
            </button>
          </div>
          {updateStatusMessage && (
            <div className={styles.updateStatusMessage} role="status">
              <Icon
                name={updateStatusMessage.includes('新しい') ? 'attention' : 'check'}
                size={14}
                aria-hidden="true"
              />
              <span>{updateStatusMessage}</span>
            </div>
          )}
          <div className={styles.infoRow}>
            <span>データ保存先</span>
            <span>端末内（IndexedDB）</span>
          </div>
          <div className={styles.infoRow}>
            <span>外部通信</span>
            <span>なし</span>
          </div>
        </div>
        <div style={{ marginTop: 'var(--space-3)' }}>
          <a
            href={ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.reportLink}
            aria-label="不具合を報告する（GitHub Issuesが新しいタブで開きます）"
          >
            <Icon name="information" size={18} aria-hidden="true" />
            <span>不具合を報告する (GitHub Issues)</span>
          </a>
        </div>
      </section>

      {/* 3-2. テスト用 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>テスト用</h2>
        <p className={styles.description}>
          アプリの検証用機能です。口座・過去3か月の取引を含むサンプルデータの投入や、全データの初期化が行えます。
        </p>
        <div className={styles.testActions}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => setShowSampleConfirm(true)}
          >
            <Icon name="wallet" size={18} aria-hidden="true" />
            サンプルデータを入れる
          </button>
          <button
            type="button"
            className={styles.dangerBtn}
            onClick={() => setShowDeleteConfirm1(true)}
          >
            <Icon name="trash" size={18} aria-hidden="true" />
            すべてのデータを削除
          </button>
        </div>
      </section>

      {/* 開発者 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>開発者</h2>
        <div className={styles.developerLinks}>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.developerLink}
            aria-label="GitHub（新しいタブで開きます）"
          >
            <Icon name="github" size={24} aria-hidden="true" />
            <span>GitHub</span>
          </a>
        </div>
      </section>

      {/* 分類編集ダイアログ */}
      {editingCategory && (
        <div
          className={styles.dialogOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-category-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingCategory(null);
          }}
        >
          <div className={styles.dialogContent}>
            <h3 id="edit-category-title" className={styles.dialogTitle}>
              分類の編集
            </h3>
            <form onSubmit={handleSaveEditCategory}>
              <div className={styles.dialogField}>
                <label htmlFor="edit-category-name" className={styles.dialogLabel}>
                  分類名 <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input
                  id="edit-category-name"
                  type="text"
                  autoFocus
                  maxLength={20}
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    setEditError('');
                  }}
                  className={`${styles.dialogInput} ${editError ? styles.dialogInputError : ''}`}
                />
                {editError && (
                  <p className={styles.fieldError} role="alert">
                    {editError}
                  </p>
                )}
              </div>

              <div className={styles.dialogField}>
                <label className={styles.dialogLabel}>カラー</label>
                <div className={styles.paletteRow}>
                  {CATEGORY_COLOR_PALETTE.map((c) => {
                    const isPicked = editColor === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        className={`${styles.paletteChip} ${
                          isPicked ? styles.paletteChipSelected : ''
                        }`}
                        style={{ backgroundColor: c }}
                        onClick={() => setEditColor(c)}
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
                  onClick={() => setEditingCategory(null)}
                >
                  キャンセル
                </button>
                <button type="submit" className={styles.submitBtn}>
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 取引件数0件の分類削除確認ダイアログ */}
      <ConfirmDialog
        isOpen={showDirectDeleteConfirm && !!deletingCategory}
        title={`分類「${deletingCategory?.name}」の削除`}
        message="この分類を削除しますか？"
        confirmLabel="削除する"
        variant="danger"
        onConfirm={handleConfirmDeleteCategory}
        onCancel={() => {
          setShowDirectDeleteConfirm(false);
          setDeletingCategory(null);
        }}
      />

      {/* 取引件数1件以上の分類移行・削除ダイアログ */}
      {deletingCategory && !showDirectDeleteConfirm && (
        <div
          className={styles.dialogOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="relocate-title"
        >
          <div className={styles.dialogContent}>
            <h3 id="relocate-title" className={styles.dialogTitle}>
              分類「{deletingCategory.name}」の削除
            </h3>
            <p className={styles.description}>
              この分類には <strong>{deleteTxCount}件</strong> の取引が登録されています。
              削除するには、これらの取引を移行する先の分類を選択してください。
            </p>
            <div className={styles.dialogField}>
              <label htmlFor="relocate-dest" className={styles.dialogLabel}>
                移行先の分類
              </label>
              <select
                id="relocate-dest"
                className={styles.relocateSelect}
                value={relocateDestId}
                onChange={(e) => setRelocateDestId(e.target.value)}
              >
                {eligibleRelocateCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setDeletingCategory(null)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className={styles.submitBtn}
                style={{ backgroundColor: 'var(--color-error)' }}
                onClick={handleConfirmDeleteCategory}
              >
                移行して削除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* パスコードボトムシート */}
      <PasscodeSheet
        isOpen={passcodeSheetOpen}
        onClose={() => setPasscodeSheetOpen(false)}
        initialTab={passcodeSheetTab}
        onForgotPassword={() => setShowDeleteConfirm1(true)}
      />

      {/* サンプルデータ確認ダイアログ */}
      <ConfirmDialog
        isOpen={showSampleConfirm}
        title="サンプルデータの投入"
        message="口座3件、過去3か月分の取引履歴のサンプルデータを追加します。よろしいですか？"
        confirmLabel="投入する"
        onConfirm={async () => {
          try {
            await insertSampleData();
            setShowSampleConfirm(false);
            await loadCategories();
            showToast('サンプルデータを投入しました');
          } catch (err) {
            console.error('Failed to insert sample data:', err);
            showToast('サンプルデータの投入に失敗しました', { type: 'error' });
          }
        }}
        onCancel={() => setShowSampleConfirm(false)}
      />

      {/* 全データ削除確認ダイアログ 1/2 */}
      <ConfirmDialog
        isOpen={showDeleteConfirm1}
        title="すべてのデータを削除（確認 1/2）"
        message="登録済みの口座、取引履歴、設定がすべて消去されます。本当に削除しますか？"
        confirmLabel="次へ進む"
        variant="danger"
        onConfirm={() => {
          setShowDeleteConfirm1(false);
          setShowDeleteConfirm2(true);
        }}
        onCancel={() => setShowDeleteConfirm1(false)}
      />

      {/* 全データ削除確認ダイアログ 2/2 */}
      <ConfirmDialog
        isOpen={showDeleteConfirm2}
        title="本当にすべてのデータを削除しますか？（確認 2/2）"
        message="この操作を実行するとデータは完全に初期化され、元に戻せません。"
        confirmLabel="完全に初期化する"
        variant="danger"
        onConfirm={async () => {
          try {
            await resetAllData();
            setShowDeleteConfirm2(false);
            await loadCategories();
            showToast('すべてのデータを初期化しました');
          } catch (err) {
            console.error('Failed to reset all data:', err);
            showToast('データの初期化に失敗しました', { type: 'error' });
          }
        }}
        onCancel={() => setShowDeleteConfirm2(false)}
      />
    </div>
  );
}
