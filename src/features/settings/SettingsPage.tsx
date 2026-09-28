import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/database';
import { useSettings } from '../../hooks/useSettings';
import { hashPasscode } from '../../utils/crypto';
import { useToast } from '../../components/Toast/Toast';
import { Icon } from '../../components/Icon/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { insertSampleData, resetAllData } from '../../utils/sampleData';
import { GITHUB_URL, X_URL, ISSUES_URL } from '../../config/links';
import styles from './SettingsPage.module.css';

export function SettingsPage() {
  const navigate = useNavigate();
  const { settings, updateSettings } = useSettings();
  const { showToast } = useToast();
  const [showPasscodeForm, setShowPasscodeForm] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [passcodeConfirm, setPasscodeConfirm] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [showSampleConfirm, setShowSampleConfirm] = useState(false);
  const [showDeleteConfirm1, setShowDeleteConfirm1] = useState(false);
  const [showDeleteConfirm2, setShowDeleteConfirm2] = useState(false);

  const handleThemeChange = async (theme: 'light' | 'dark' | 'system') => {
    const resolvedTheme = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    await updateSettings({ theme });
    showToast('テーマを変更しました');
  };

  const handleSetPasscode = async () => {
    if (passcode.length < 4 || passcode.length > 6) {
      setPasscodeError('パスコードは4〜6桁で設定してください');
      return;
    }
    if (!/^\d+$/.test(passcode)) {
      setPasscodeError('パスコードは数字のみで設定してください');
      return;
    }
    if (passcode !== passcodeConfirm) {
      setPasscodeError('パスコードが一致しません');
      return;
    }

    try {
      const { hash, salt } = await hashPasscode(passcode);
      await updateSettings({
        passcodeEnabled: true,
        passcodeHash: hash,
        passcodeSalt: salt,
      });
      setShowPasscodeForm(false);
      setPasscode('');
      setPasscodeConfirm('');
      showToast('パスコードを設定しました');
    } catch (err) {
      console.error('Failed to set passcode:', err);
      showToast('パスコードの設定に失敗しました', { type: 'error' });
    }
  };

  const handleRemovePasscode = async () => {
    await updateSettings({
      passcodeEnabled: false,
      passcodeHash: null,
      passcodeSalt: null,
      passcodeIv: null,
    });
    showToast('パスコードを解除しました');
  };

  const handleExport = useCallback(async () => {
    try {
      const [accounts, transactions, categories, budgets, settingsData] = await Promise.all([
        db.accounts.toArray(),
        db.transactions.toArray(),
        db.categories.toArray(),
        db.budgets.toArray(),
        db.settings.toArray(),
      ]);

      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        data: { accounts, transactions, categories, budgets, settings: settingsData },
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

        const { accounts, transactions, categories, budgets } = importData.data;

        await db.transaction('rw',
          db.accounts, db.transactions, db.categories, db.budgets,
          async () => {
            await db.accounts.clear();
            await db.transactions.clear();
            await db.categories.clear();
            await db.budgets.clear();
            if (accounts) await db.accounts.bulkAdd(accounts);
            if (transactions) await db.transactions.bulkAdd(transactions);
            if (categories) await db.categories.bulkAdd(categories);
            if (budgets) await db.budgets.bulkAdd(budgets);
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

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="戻る">
          <Icon name="arrow_left" size={20} />
        </button>
        <h1 className={styles.pageTitle}>設定</h1>
      </header>

      {/* テーマ */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>テーマ</h2>
        <div className={styles.themeOptions} role="radiogroup" aria-label="テーマ設定">
          {(['system', 'light', 'dark'] as const).map((t) => (
            <button
              key={t}
              role="radio"
              aria-checked={settings.theme === t}
              className={`${styles.themeBtn} ${settings.theme === t ? styles.themeActive : ''}`}
              onClick={() => handleThemeChange(t)}
            >
              <Icon
                name={t === 'system' ? 'computer' : t === 'light' ? 'sun' : 'moon'}
                variant={settings.theme === t ? 'fill' : 'line'}
                size={18}
              />
              <span>{t === 'system' ? 'システム' : t === 'light' ? 'ライト' : 'ダーク'}</span>
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
            <button className={styles.dangerBtn} onClick={handleRemovePasscode}>
              パスコードを解除
            </button>
          </div>
        ) : (
          <>
            {!showPasscodeForm ? (
              <button className={styles.actionBtn} onClick={() => setShowPasscodeForm(true)}>
                パスコードを設定
              </button>
            ) : (
              <div className={styles.passcodeForm}>
                <p className={styles.warning}>
                  <Icon name="attention" variant="fill" size={16} /> パスコードを忘れるとデータを復元できません
                </p>
                <div className={styles.field}>
                  <label htmlFor="passcode" className={styles.label}>
                    パスコード（4〜6桁の数字）
                  </label>
                  <input
                    id="passcode"
                    type="password"
                    inputMode="numeric"
                    className={styles.input}
                    value={passcode}
                    onChange={(e) => { setPasscode(e.target.value); setPasscodeError(''); }}
                    maxLength={6}
                    placeholder="●●●●"
                    autoComplete="new-password"
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="passcode-confirm" className={styles.label}>
                    パスコード（確認）
                  </label>
                  <input
                    id="passcode-confirm"
                    type="password"
                    inputMode="numeric"
                    className={styles.input}
                    value={passcodeConfirm}
                    onChange={(e) => { setPasscodeConfirm(e.target.value); setPasscodeError(''); }}
                    maxLength={6}
                    placeholder="●●●●"
                    autoComplete="new-password"
                  />
                </div>
                {passcodeError && <p className={styles.error} role="alert">{passcodeError}</p>}
                <div className={styles.formActions}>
                  <button type="button" className={styles.cancelBtn} onClick={() => { setShowPasscodeForm(false); setPasscode(''); setPasscodeConfirm(''); }}>
                    キャンセル
                  </button>
                  <button type="button" className={styles.submitBtn} onClick={handleSetPasscode}>
                    設定する
                  </button>
                </div>
              </div>
            )}
          </>
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
          <div className={styles.infoRow}>
            <span>バージョン</span>
            <span>{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'} ({typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'dev'})</span>
          </div>
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
          アプリの検証用機能です。口座・過去3か月の取引・予算を含むサンプルデータの投入や、全データの初期化が行えます。
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

      {/* 11-4. 開発者 */}
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
          <a
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.developerLink}
            aria-label="X（新しいタブで開きます）"
          >
            <Icon name="x" size={24} aria-hidden="true" />
            <span>X (Twitter)</span>
          </a>
        </div>
      </section>

      {/* サンプルデータ確認ダイアログ */}
      <ConfirmDialog
        isOpen={showSampleConfirm}
        title="サンプルデータの投入"
        message="口座3件、過去3か月分の取引履歴、予算設定のサンプルデータを追加します。よろしいですか？"
        confirmLabel="投入する"
        onConfirm={async () => {
          try {
            await insertSampleData();
            setShowSampleConfirm(false);
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
        message="登録済みの口座、取引履歴、予算、設定がすべて消去されます。本当に削除しますか？"
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
