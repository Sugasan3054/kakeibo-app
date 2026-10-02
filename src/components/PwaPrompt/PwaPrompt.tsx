import { useEffect, useRef } from 'react';
import { usePwaUpdate } from '../../contexts/PwaUpdateContext';
import { useToast } from '../Toast/Toast';

export function PwaPrompt() {
  const { showToast } = useToast();
  const { needRefresh, updateServiceWorker, isInputting } = usePwaUpdate();
  const toastShownRef = useRef(false);

  useEffect(() => {
    // needRefresh が検知された場合
    if (needRefresh && !toastShownRef.current) {
      // 収支入力中などの場合はトースト表示を保留
      if (isInputting) {
        return;
      }

      toastShownRef.current = true;
      showToast('新しいバージョンがあります', {
        action: {
          label: '更新',
          onClick: () => {
            updateServiceWorker(true);
          },
        },
        duration: 0, // 「更新」ボタンまたは閉じるまで消えない
      });
    }
  }, [needRefresh, isInputting, showToast, updateServiceWorker]);

  // 入力完了時（isInputting が true から false に変化した際）に保留していた通知を表示
  useEffect(() => {
    if (!isInputting && needRefresh && !toastShownRef.current) {
      toastShownRef.current = true;
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
  }, [isInputting, needRefresh, showToast, updateServiceWorker]);

  return null;
}
