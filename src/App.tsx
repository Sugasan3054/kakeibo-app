import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { seedDatabase } from './db/seed';
import { useSettings } from './hooks/useSettings';
import { useTheme } from './hooks/useTheme';
import { SettingsProvider } from './contexts/SettingsContext';
import { ToastProvider } from './components/Toast/Toast';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { AppShell } from './components/Layout/AppShell';
import { LockScreen } from './components/LockScreen/LockScreen';
import { APP_ROUTES } from './config/routes';
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
            {APP_ROUTES.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
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
        <SettingsProvider>
          <PwaPrompt />
          <AppContent />
        </SettingsProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
