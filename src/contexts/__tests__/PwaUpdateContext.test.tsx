import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PwaUpdateProvider, usePwaUpdate } from '../PwaUpdateContext';
import { PwaPrompt } from '../../components/PwaPrompt/PwaPrompt';
import { ToastProvider } from '../../components/Toast/Toast';

// Mock virtual:pwa-register/react
let mockNeedRefresh = false;
const mockSetNeedRefresh = vi.fn((val: boolean) => {
  mockNeedRefresh = val;
});
const mockUpdateServiceWorker = vi.fn();
let capturedOnRegisteredSW: ((url: string, reg: any) => void) | undefined;

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options: any) => {
    capturedOnRegisteredSW = options?.onRegisteredSW;
    return {
      needRefresh: [mockNeedRefresh, mockSetNeedRefresh],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: mockUpdateServiceWorker,
    };
  },
}));

describe('PwaUpdateContext and PwaPrompt', () => {
  let mockRegistration: {
    update: ReturnType<typeof vi.fn>;
    installing: any;
    waiting: any;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    mockNeedRefresh = false;

    mockRegistration = {
      update: vi.fn().mockResolvedValue(undefined),
      installing: null,
      waiting: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: vi.fn().mockResolvedValue(mockRegistration),
        ready: Promise.resolve(mockRegistration),
        controller: {},
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function TestConsumer() {
    const { isInputting, setIsInputting, checkForUpdate, isCheckingUpdate, updateStatusMessage } = usePwaUpdate();
    return (
      <div>
        <button data-testid="toggle-input" onClick={() => setIsInputting(!isInputting)}>
          Toggle Input ({isInputting ? 'inputting' : 'idle'})
        </button>
        <button data-testid="check-update" onClick={() => checkForUpdate()} disabled={isCheckingUpdate}>
          Check Update
        </button>
        <span data-testid="update-status">{updateStatusMessage || 'none'}</span>
      </div>
    );
  }

  it('triggers registration.update on startup and on visibilitychange to visible', async () => {
    render(
      <ToastProvider>
        <PwaUpdateProvider>
          <TestConsumer />
        </PwaUpdateProvider>
      </ToastProvider>
    );

    // Initial check on mount
    await act(async () => {
      if (capturedOnRegisteredSW) {
        capturedOnRegisteredSW('/sw.js', mockRegistration);
      }
    });
    expect(mockRegistration.update).toHaveBeenCalled();

    mockRegistration.update.mockClear();

    // visibilitychange event when returning from background
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(mockRegistration.update).toHaveBeenCalled();
  });

  it('triggers registration.update periodically every 60 minutes', async () => {
    render(
      <ToastProvider>
        <PwaUpdateProvider>
          <TestConsumer />
        </PwaUpdateProvider>
      </ToastProvider>
    );

    mockRegistration.update.mockClear();

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });

    // Advance timers by 60 minutes
    await act(async () => {
      vi.advanceTimersByTime(60 * 60 * 1000);
    });

    expect(mockRegistration.update).toHaveBeenCalled();
  });

  it('postpones update toast while isInputting is true, then shows toast when input completes', async () => {
    const { rerender } = render(
      <ToastProvider>
        <PwaUpdateProvider>
          <PwaPrompt />
          <TestConsumer />
        </PwaUpdateProvider>
      </ToastProvider>
    );

    // 1. User starts inputting a transaction
    const toggleBtn = screen.getByTestId('toggle-input');
    await act(async () => {
      fireEvent.click(toggleBtn);
    });
    expect(screen.getByText(/inputting/)).toBeDefined();

    // 2. New SW detected while inputting
    mockNeedRefresh = true;
    rerender(
      <ToastProvider>
        <PwaUpdateProvider>
          <PwaPrompt />
          <TestConsumer />
        </PwaUpdateProvider>
      </ToastProvider>
    );

    // Toast should NOT appear yet because user is inputting!
    expect(screen.queryByText('新しいバージョンがあります')).toBeNull();

    // 3. User finishes inputting (e.g. saves or closes modal)
    await act(async () => {
      fireEvent.click(toggleBtn);
    });
    expect(screen.getByText(/idle/)).toBeDefined();

    // Now the postponed toast should appear with '更新' button!
    expect(screen.getByText('新しいバージョンがあります')).toBeDefined();
    const updateBtn = screen.getByRole('button', { name: '更新' });
    expect(updateBtn).toBeDefined();

    // 4. Clicking '更新' invokes updateServiceWorker(true)
    await act(async () => {
      fireEvent.click(updateBtn);
    });
    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('handles manual checkForUpdate button reporting latest when no update exists', async () => {
    render(
      <ToastProvider>
        <PwaUpdateProvider>
          <TestConsumer />
        </PwaUpdateProvider>
      </ToastProvider>
    );

    const checkBtn = screen.getByTestId('check-update');
    await act(async () => {
      fireEvent.click(checkBtn);
    });

    // Advance 1200ms timer inside checkForUpdate
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByTestId('update-status').textContent).toBe('最新版です');
  });

  it('handles manual checkForUpdate button reporting update available when waiting worker exists', async () => {
    mockRegistration.waiting = { state: 'installed' };

    render(
      <ToastProvider>
        <PwaUpdateProvider>
          <TestConsumer />
        </PwaUpdateProvider>
      </ToastProvider>
    );

    const checkBtn = screen.getByTestId('check-update');
    await act(async () => {
      fireEvent.click(checkBtn);
    });

    expect(screen.getByTestId('update-status').textContent).toBe('新しいバージョンがあります');
  });
});
