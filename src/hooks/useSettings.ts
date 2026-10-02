import { useEffect, useState, useCallback, useContext } from 'react';
import { db } from '../db/database';
import type { Settings } from '../db/models';
import { SettingsContext } from '../contexts/SettingsContext';

const DEFAULT_SETTINGS: Settings = {
  id: 'app-settings',
  theme: 'light',
  passcodeEnabled: false,
  passcodeHash: null,
  passcodeSalt: null,
  passcodeIv: null,
  expectedMonthlyIncome: null,
  initialLaunchDone: false,
};

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context) {
    return {
      settings: context.settings,
      loading: context.loading,
      inMemoryKey: context.inMemoryKey,
      updateSettings: context.updateSettings,
      setPasscode: context.setPasscode,
      changePasscode: context.changePasscode,
      removePasscode: context.removePasscode,
      reload: context.reloadSettings,
    };
  }

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      const s = await db.settings.get('app-settings');
      if (s) {
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
  }, [loadSettings]);

  const updateSettings = useCallback(async (updates: Partial<Settings>) => {
    const newSettings = { ...settings, ...updates };
    await db.settings.put(newSettings);
    setSettings(newSettings);
  }, [settings]);

  return {
    settings,
    loading,
    inMemoryKey: null,
    updateSettings,
    setPasscode: async () => {},
    changePasscode: async () => {},
    removePasscode: async () => {},
    reload: loadSettings,
  };
}
