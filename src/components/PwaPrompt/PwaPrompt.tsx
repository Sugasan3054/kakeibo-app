import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToast } from '../Toast/Toast';

export function PwaPrompt() {
  const { showToast } = useToast();
  const shownRef = useRef(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('PWA registration error', error);
    },
  });

  useEffect(() => {
    if (needRefresh && !shownRef.current) {
      shownRef.current = true;
      showToast('新しいバージョンがあります', {
        action: {
          label: '更新',
          onClick: () => {
            updateServiceWorker(true);
          },
        },
        duration: 0,
      });
    }
  }, [needRefresh, showToast, updateServiceWorker]);

  return null;
}
