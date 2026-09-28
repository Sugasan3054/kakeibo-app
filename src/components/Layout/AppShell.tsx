import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TabBar } from './TabBar';
import { FAB } from '../FAB/FAB';
import { TransactionInputModal } from '../../features/transactions/TransactionInputModal';
import styles from './AppShell.module.css';

export function AppShell() {
  const [isInputOpen, setIsInputOpen] = useState(false);
  const location = useLocation();

  const handleSaved = () => {
    window.dispatchEvent(new CustomEvent('kakeibo:data-changed'));
  };

  const isSettings = location.pathname.startsWith('/settings');

  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <Outlet />
      </main>
      {!isSettings && <FAB onClick={() => setIsInputOpen(true)} />}
      <TabBar />
      <TransactionInputModal
        isOpen={isInputOpen}
        onClose={() => setIsInputOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
