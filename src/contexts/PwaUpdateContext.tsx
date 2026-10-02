import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export interface PwaUpdateContextType {
  needRefresh: boolean;
  isCheckingUpdate: boolean;
  updateStatusMessage: string | null;
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  checkForUpdate: () => Promise<'updated' | 'latest' | 'failed'>;
  isInputting: boolean;
  setIsInputting: (inputting: boolean) => void;
}

export const PwaUpdateContext = createContext<PwaUpdateContextType | null>(null);

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 60分

export function PwaUpdateProvider({ children }: { children: React.ReactNode }) {
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStatusMessage, setUpdateStatusMessage] = useState<string | null>(null);
  const [isInputting, setIsInputting] = useState(false);

  // virtual:pwa-register/react で SW 登録と更新検出
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swScriptUrl, r) {
      registrationRef.current = r;
      // 1. アプリ起動時の即時更新チェック
      if (r) {
        r.update().catch((err) => {
          console.warn('Initial SW update check failed:', err);
        });
      }
    },
    onRegisterError(error) {
      console.error('PWA registration error', error);
    },
  });

  // バックグラウンド等で静かに更新を確認する共通関数
  const checkUpdateSilently = useCallback(async () => {
    try {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
      const reg = registrationRef.current || (await navigator.serviceWorker.getRegistration());
      if (reg) {
        await reg.update();
      }
    } catch (err) {
      console.warn('Background SW update check failed:', err);
    }
  }, []);

  // 1. アプリ起動時（マウント時）
  useEffect(() => {
    checkUpdateSilently();
  }, [checkUpdateSilently]);

  // 2. visibilitychange イベント（バックグラウンドから復帰時）
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkUpdateSilently();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkUpdateSilently]);

  // 3. アプリを開いている間、60分ごとに定期確認
  useEffect(() => {
    const timerId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkUpdateSilently();
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(timerId);
  }, [checkUpdateSilently]);

  // 外部からの inputting 状態通知（イベント経由）
  useEffect(() => {
    const handleInputStateEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ isInputting: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.isInputting === 'boolean') {
        setIsInputting(customEvent.detail.isInputting);
      }
    };

    window.addEventListener('kakeibo:inputting-state', handleInputStateEvent);
    return () => {
      window.removeEventListener('kakeibo:inputting-state', handleInputStateEvent);
    };
  }, []);

  // 4. 手動での更新確認（設定画面の「更新を確認」ボタン用）
  const checkForUpdate = useCallback(async (): Promise<'updated' | 'latest' | 'failed'> => {
    setIsCheckingUpdate(true);
    setUpdateStatusMessage(null);

    try {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        setUpdateStatusMessage('最新版です');
        setIsCheckingUpdate(false);
        return 'latest';
      }

      const reg = registrationRef.current || (await navigator.serviceWorker.getRegistration());
      if (!reg) {
        setUpdateStatusMessage('最新版です');
        setIsCheckingUpdate(false);
        return 'latest';
      }

      // 既に waiting 状態の新しい Service Worker が検知されている場合
      if (reg.waiting || needRefresh) {
        setNeedRefresh(true);
        setUpdateStatusMessage('新しいバージョンがあります');
        setIsCheckingUpdate(false);
        return 'updated';
      }

      // SWの更新を明示的に問い合わせ
      return await new Promise<'updated' | 'latest' | 'failed'>((resolve) => {
        let finished = false;

        const onUpdateFound = () => {
          const installing = reg.installing;
          if (!installing) return;

          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              if (!finished) {
                finished = true;
                cleanup();
                setNeedRefresh(true);
                setUpdateStatusMessage('新しいバージョンがあります');
                setIsCheckingUpdate(false);
                resolve('updated');
              }
            }
          });
        };

        const cleanup = () => {
          reg.removeEventListener('updatefound', onUpdateFound);
        };

        reg.addEventListener('updatefound', onUpdateFound);

        reg.update()
          .then(() => {
            // update() 完了後、新SWが見つからなければ一定時間後に latest 判定
            setTimeout(() => {
              if (!finished) {
                finished = true;
                cleanup();
                if (reg.waiting) {
                  setNeedRefresh(true);
                  setUpdateStatusMessage('新しいバージョンがあります');
                  setIsCheckingUpdate(false);
                  resolve('updated');
                } else {
                  setUpdateStatusMessage('最新版です');
                  setIsCheckingUpdate(false);
                  resolve('latest');
                }
              }
            }, 1200);
          })
          .catch((err) => {
            if (!finished) {
              finished = true;
              cleanup();
              console.error('Manual update check error:', err);
              setUpdateStatusMessage('更新の確認に失敗しました');
              setIsCheckingUpdate(false);
              resolve('failed');
            }
          });
      });
    } catch (err) {
      console.error('Check update error:', err);
      setUpdateStatusMessage('更新の確認に失敗しました');
      setIsCheckingUpdate(false);
      return 'failed';
    }
  }, [needRefresh, setNeedRefresh]);

  const value = {
    needRefresh,
    isCheckingUpdate,
    updateStatusMessage,
    updateServiceWorker,
    checkForUpdate,
    isInputting,
    setIsInputting,
  };

  return <PwaUpdateContext.Provider value={value}>{children}</PwaUpdateContext.Provider>;
}

export function usePwaUpdate(): PwaUpdateContextType {
  const context = useContext(PwaUpdateContext);
  if (!context) {
    // コンテキスト外でもクラッシュしないフォールバック
    return {
      needRefresh: false,
      isCheckingUpdate: false,
      updateStatusMessage: null,
      updateServiceWorker: async () => {},
      checkForUpdate: async () => 'latest',
      isInputting: false,
      setIsInputting: () => {},
    };
  }
  return context;
}
