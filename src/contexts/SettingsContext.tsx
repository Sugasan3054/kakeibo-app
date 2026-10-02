import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { db } from '../db/database';
import type { Settings } from '../db/models';
import { hashPasscode, deriveCryptoKey } from '../utils/crypto';
import {
  decryptAndRemovePasscode,
  changePasscodeWithReEncryption,
} from '../utils/passcode';

export const DEFAULT_SETTINGS: Settings = {
  id: 'app-settings',
  theme: 'light',
  passcodeEnabled: false,
  passcodeHash: null,
  passcodeSalt: null,
  passcodeIv: null,
  expectedMonthlyIncome: null,
  initialLaunchDone: false,
  passcodeFailedAttempts: 0,
  passcodeLockedUntil: null,
};

export interface SettingsContextType {
  settings: Settings;
  loading: boolean;
  inMemoryKey: CryptoKey | null;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  setPasscode: (passcode: string) => Promise<void>;
  changePasscode: (currentPasscode: string, newPasscode: string) => Promise<void>;
  removePasscode: (currentPasscode: string) => Promise<void>;
  reloadSettings: () => Promise<void>;
}

export const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [inMemoryKey, setInMemoryKey] = useState<CryptoKey | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const s = await db.settings.get('app-settings');
      if (s) {
        // レガシーテーマ設定の移行
        if ((s.theme as string) === 'system' || !s.theme) {
          const prefersDark =
            typeof window !== 'undefined' &&
            window.matchMedia &&
            window.matchMedia('(prefers-color-scheme: dark)').matches;
          s.theme = prefersDark ? 'dark' : 'light';
          await db.settings.put(s);
        }
        setSettings(s);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();

    const handleSettingsChanged = () => {
      loadSettings();
    };

    window.addEventListener('kakeibo:settings-changed', handleSettingsChanged);
    return () => {
      window.removeEventListener('kakeibo:settings-changed', handleSettingsChanged);
    };
  }, [loadSettings]);

  const updateSettings = useCallback(
    async (updates: Partial<Settings>) => {
      const newSettings = { ...settings, ...updates };
      await db.settings.put(newSettings);
      setSettings(newSettings);
      window.dispatchEvent(new CustomEvent('kakeibo:settings-changed'));
    },
    [settings]
  );

  /**
   * パスコードを新規設定
   */
  const setPasscode = useCallback(
    async (passcode: string) => {
      const { hash, salt } = await hashPasscode(passcode);
      const key = await deriveCryptoKey(passcode, salt);
      setInMemoryKey(key);

      const newSettings: Settings = {
        ...settings,
        passcodeEnabled: true,
        passcodeHash: hash,
        passcodeSalt: salt,
        passcodeFailedAttempts: 0,
        passcodeLockedUntil: null,
      };

      await db.settings.put(newSettings);
      setSettings(newSettings);
      window.dispatchEvent(new CustomEvent('kakeibo:settings-changed'));
    },
    [settings]
  );

  /**
   * パスコードを変更
   */
  const changePasscode = useCallback(
    async (currentPasscode: string, newPasscode: string) => {
      const { hash, salt } = await changePasscodeWithReEncryption(
        db,
        currentPasscode,
        newPasscode
      );
      const key = await deriveCryptoKey(newPasscode, salt);
      setInMemoryKey(key);

      const newSettings: Settings = {
        ...settings,
        passcodeEnabled: true,
        passcodeHash: hash,
        passcodeSalt: salt,
        passcodeFailedAttempts: 0,
        passcodeLockedUntil: null,
      };

      setSettings(newSettings);
      window.dispatchEvent(new CustomEvent('kakeibo:settings-changed'));
    },
    [settings]
  );

  /**
   * パスコードを設定解除
   */
  const removePasscode = useCallback(
    async (currentPasscode: string) => {
      // 復号とDB更新をアトミックに実行
      await decryptAndRemovePasscode(db, currentPasscode);

      // メモリ上の暗号鍵を破棄
      setInMemoryKey(null);

      // 設定状態を即時更新
      const newSettings: Settings = {
        ...settings,
        passcodeEnabled: false,
        passcodeHash: null,
        passcodeSalt: null,
        passcodeIv: null,
        passcodeFailedAttempts: 0,
        passcodeLockedUntil: null,
      };
      setSettings(newSettings);
      window.dispatchEvent(new CustomEvent('kakeibo:settings-changed'));
    },
    [settings]
  );

  const value = useMemo(
    () => ({
      settings,
      loading,
      inMemoryKey,
      updateSettings,
      setPasscode,
      changePasscode,
      removePasscode,
      reloadSettings: loadSettings,
    }),
    [
      settings,
      loading,
      inMemoryKey,
      updateSettings,
      setPasscode,
      changePasscode,
      removePasscode,
      loadSettings,
    ]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettingsContext() {
  const context = useContext(SettingsContext);
  return context;
}
