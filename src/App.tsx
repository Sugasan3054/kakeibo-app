import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { seedDatabase } from './db/seed';
import { useSettings } from './hooks/useSettings';
import { useTheme } from './hooks/useTheme';
import { ToastProvider } from './components/Toast/Toast';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { AppShell } from './components/Layout/AppShell';
import { LockScreen } from './components/LockScreen/LockScreen';
import { HomePage } from './features/home/HomePage';
import { BudgetSettingsPage } from './features/home/BudgetSettingsPage';
import { TransactionsPage } from './features/transactions/TransactionsPage';
import { ReportPage } from './features/report/ReportPage';
import { AccountsPage } from './features/accounts/AccountsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { Loading } from './components/Loading/Loading';
import { PwaPrompt } from './components/PwaPrompt/PwaPrompt';
import { OnboardingModal } from './components/Onboarding/OnboardingModal';

function AppContent() {
  const { settings, loading, updateSettings } = useSettings();
  useTheme(); // テーマ自動適用
  const [dbReady, setDbReady] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        await seedDatabase();
      } catch (err) {
        console.error('Failed to seed database:', err);
      } finally {
        setDbReady(true);
      }
    }
    init();
  }, []);

  if (loading || !dbReady) {
    return <Loading message="家計簿を起動中..." />;
  }

  // パスコードロック有効時のロック画面
  if (settings.passcodeEnabled && settings.passcodeHash && settings.passcodeSalt && !isUnlocked) {
    return (
      <LockScreen
        passcodeHash={settings.passcodeHash}
        passcodeSalt={settings.passcodeSalt}
        onUnlock={() => setIsUnlocked(true)}
      />
    );
  }

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/home/budget" element={<BudgetSettingsPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      {!settings.initialLaunchDone && (
        <OnboardingModal
          onClose={() => updateSettings({ initialLaunchDone: true })}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <PwaPrompt />
        <AppContent />
      </ToastProvider>
    </ErrorBoundary>
  );
}
