import { useState, useRef, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Icon, type IconName } from '../Icon/Icon';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import styles from './TabBar.module.css';

interface TabConfig {
  path: string;
  label: string;
  iconName: IconName;
  isHome?: boolean;
}

const tabs: TabConfig[] = [
  { path: '/', label: 'ホーム', iconName: 'home', isHome: true },
  { path: '/transactions', label: '入出金', iconName: 'transactions' },
  { path: '/report', label: '家計簿', iconName: 'report' },
  { path: '/accounts', label: '口座', iconName: 'accounts' },
];

export function TabBar() {
  const location = useLocation();
  const pathname = location.pathname;
  const prefersReducedMotion = useReducedMotion();
  const tabListRef = useRef<HTMLDivElement>(null);
  const [scales, setScales] = useState<number[]>([1, 1, 1, 1]);
  const [touchActiveIndex, setTouchActiveIndex] = useState<number | null>(null);

  // マウス操作時の拡大アニメーション（React Bits Dock風の距離計算）
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (prefersReducedMotion || !tabListRef.current) return;
      const tabElements = tabListRef.current.querySelectorAll<HTMLElement>('[data-tab-item]');
      if (!tabElements.length) return;

      const mouseX = e.clientX;
      const maxDistance = 110;
      const maxScale = 1.25;

      const newScales = Array.from(tabElements).map((el) => {
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const distance = Math.abs(mouseX - centerX);

        if (distance < maxDistance) {
          const factor = Math.cos((distance / maxDistance) * (Math.PI / 2));
          return 1 + (maxScale - 1) * factor;
        }
        return 1;
      });

      setScales(newScales);
    },
    [prefersReducedMotion]
  );

  const handleMouseLeave = useCallback(() => {
    setScales([1, 1, 1, 1]);
  }, []);

  return (
    <div className={styles.dockWrapper}>
      <nav
        ref={tabListRef}
        className={styles.dock}
        role="tablist"
        aria-label="メインナビゲーション"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {tabs.map((tab, idx) => {
          const isActive = tab.isHome
            ? pathname === '/' || pathname.startsWith('/home')
            : pathname === tab.path || pathname.startsWith(tab.path + '/');

          const scale = prefersReducedMotion
            ? 1
            : touchActiveIndex === idx
            ? 1.18
            : scales[idx] || 1;

          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              role="tab"
              data-tab-item
              aria-selected={isActive}
              aria-current={isActive ? 'page' : undefined}
              className={`${styles.tab} ${isActive ? styles.active : ''} ${
                touchActiveIndex === idx ? styles.touchActive : ''
              }`}
              onTouchStart={() => setTouchActiveIndex(idx)}
              onTouchEnd={() => setTouchActiveIndex(null)}
              onTouchCancel={() => setTouchActiveIndex(null)}
            >
              <div
                className={`${styles.tabContent} ${isActive ? styles.activeBounce : ''}`}
                style={{
                  transform: `scale(${scale})`,
                }}
              >
                <div className={styles.iconContainer}>
                  <Icon
                    name={tab.iconName}
                    variant={isActive ? 'fill' : 'line'}
                    size={24}
                    className={styles.icon}
                    aria-hidden="true"
                  />
                </div>
                <span className={styles.label}>{tab.label}</span>
              </div>
              {isActive && <div className={styles.activeDot} aria-hidden="true" />}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
