import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { PasscodeSheet } from '../PasscodeSheet';
import { SettingsContext, DEFAULT_SETTINGS } from '../../../contexts/SettingsContext';
import { ToastProvider } from '../../../components/Toast/Toast';

describe('PasscodeSheet Component UI and Interactions', () => {
  const mockSetPasscode = vi.fn();
  const mockChangePasscode = vi.fn();
  const mockRemovePasscode = vi.fn();
  const mockOnClose = vi.fn();
  const mockOnForgotPassword = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // HTMLDialogElement.prototype.showModal mock for jsdom
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function () {
        this.setAttribute('open', '');
      };
    }
    if (!HTMLDialogElement.prototype.close) {
      HTMLDialogElement.prototype.close = function () {
        this.removeAttribute('open');
      };
    }
  });

  const renderWithContext = (settingsOverride = {}, initialTab: 'change' | 'remove' = 'change') => {
    const settings = { ...DEFAULT_SETTINGS, ...settingsOverride };
    return render(
      <ToastProvider>
        <SettingsContext.Provider
          value={{
            settings,
            loading: false,
            inMemoryKey: null,
            updateSettings: vi.fn(),
            setPasscode: mockSetPasscode,
            changePasscode: mockChangePasscode,
            removePasscode: mockRemovePasscode,
            reloadSettings: vi.fn(),
          }}
        >
          <PasscodeSheet
            isOpen={true}
            onClose={mockOnClose}
            initialTab={initialTab}
            onForgotPassword={mockOnForgotPassword}
          />
        </SettingsContext.Provider>
      </ToastProvider>
    );
  };

  it('renders single tab/heading and setting inputs when passcode is unset', () => {
    renderWithContext({ passcodeEnabled: false });

    // Single heading / tab
    expect(screen.getAllByText('パスコードを設定').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText(/新しいパスコード/)).toBeDefined();
    expect(screen.getByLabelText(/確認用の再入力/)).toBeDefined();
    expect(screen.getByRole('button', { name: '設定する' })).toBeDefined();

    // Segment control should not exist when unset
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('shows error if new passcode and confirm do not match when setting', async () => {
    renderWithContext({ passcodeEnabled: false });

    const newPassInput = screen.getByLabelText(/新しいパスコード/);
    const confirmInput = screen.getByLabelText(/確認用の再入力/);
    const submitBtn = screen.getByRole('button', { name: '設定する' });

    fireEvent.change(newPassInput, { target: { value: '1234' } });
    fireEvent.change(confirmInput, { target: { value: '5678' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('パスコードが一致しません')).toBeDefined();
    });
    expect(mockSetPasscode).not.toHaveBeenCalled();
  });

  it('calls setPasscode when valid passcode is submitted', async () => {
    mockSetPasscode.mockResolvedValueOnce(undefined);
    renderWithContext({ passcodeEnabled: false });

    const newPassInput = screen.getByLabelText(/新しいパスコード/);
    const confirmInput = screen.getByLabelText(/確認用の再入力/);
    const submitBtn = screen.getByRole('button', { name: '設定する' });

    fireEvent.change(newPassInput, { target: { value: '1234' } });
    fireEvent.change(confirmInput, { target: { value: '1234' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSetPasscode).toHaveBeenCalledWith('1234');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('renders segment tabs for 変更 and 設定解除 when passcode is enabled', () => {
    renderWithContext({
      passcodeEnabled: true,
      passcodeHash: 'hash',
      passcodeSalt: 'salt',
    }, 'change');

    expect(screen.getByRole('radiogroup')).toBeDefined();
    expect(screen.getByRole('radio', { name: '変更' })).toBeDefined();
    expect(screen.getByRole('radio', { name: '設定解除' })).toBeDefined();

    // 変更 tab inputs
    expect(screen.getByLabelText(/現在のパスコード/)).toBeDefined();
    expect(screen.getByLabelText(/新しいパスコード/)).toBeDefined();
    expect(screen.getByLabelText(/確認用の再入力/)).toBeDefined();
    expect(screen.getByRole('button', { name: '変更する' })).toBeDefined();

    // パスコードを忘れた場合 link
    expect(screen.getByText('パスコードを忘れた場合')).toBeDefined();
  });

  it('switches to 設定解除 tab, clears inputs and displays unencrypted warning', () => {
    renderWithContext({
      passcodeEnabled: true,
      passcodeHash: 'hash',
      passcodeSalt: 'salt',
    }, 'change');

    const currentPassInput = screen.getByLabelText(/現在のパスコード/) as HTMLInputElement;
    fireEvent.change(currentPassInput, { target: { value: '1234' } });
    expect(currentPassInput.value).toBe('1234');

    // Switch to 設定解除
    const removeTab = screen.getByRole('radio', { name: '設定解除' });
    fireEvent.click(removeTab);

    // Warning note should be displayed
    expect(
      screen.getByText('パスコードを解除すると、データは暗号化されずに保存されます。')
    ).toBeDefined();

    // Current passcode input is cleared
    const clearedInput = screen.getByLabelText(/現在のパスコード/) as HTMLInputElement;
    expect(clearedInput.value).toBe('');

    // Remove button should be present
    expect(screen.getByRole('button', { name: '解除する' })).toBeDefined();

    // パスコードを忘れた場合 should be present in remove tab too
    expect(screen.getByText('パスコードを忘れた場合')).toBeDefined();
  });

  it('triggers onForgotPassword when clicking reset in forgot box', () => {
    renderWithContext({
      passcodeEnabled: true,
      passcodeHash: 'hash',
      passcodeSalt: 'salt',
    }, 'remove');

    const forgotResetBtn = screen.getByRole('button', {
      name: 'すべてのデータを削除して初期化...',
    });
    fireEvent.click(forgotResetBtn);

    expect(mockOnClose).toHaveBeenCalled();
    expect(mockOnForgotPassword).toHaveBeenCalled();
  });
});
