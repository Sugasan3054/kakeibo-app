import { useState } from 'react';
import { Outlet, useLocation, matchPath } from 'react-router-dom';
import { TabBar } from './TabBar';
import { FAB } from '../FAB/FAB';
import { TransactionInputModal } from '../../features/transactions/TransactionInputModal';
import { APP_ROUTES } from '../../config/routes';
import styles from './AppShell.module.css';

export function AppShell() {
  const [isInputOpen, setIsInputOpen] = useState(false);
  const location = useLocation();

  const handleSaved = () => {
    window.dispatchEvent(new CustomEvent('kakeibo:data-changed'));
  };

  // ルート定義の showFab フラグにより一元判定
  const currentRoute = APP_ROUTES.find((r) =>
    matchPath({ path: r.path, end: true }, location.pathname)
  );
  const showFab = currentRoute?.showFab ?? false;

  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <Outlet />
      </main>
      {showFab && <FAB onClick={() => setIsInputOpen(true)} />}
      <TabBar />
      <TransactionInputModal
        isOpen={isInputOpen}
        onClose={() => setIsInputOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
