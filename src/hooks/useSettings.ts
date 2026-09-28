import { useEffect, useState, useCallback } from 'react';
import { db } from '../db/database';
import type { Settings } from '../db/models';

const DEFAULT_SETTINGS: Settings = {
  id: 'app-settings',
  theme: 'system',
  passcodeEnabled: false,
  passcodeHash: null,
  passcodeSalt: null,
  passcodeIv: null,
  expectedMonthlyIncome: null,
  initialLaunchDone: false,
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      const s = await db.settings.get('app-settings');
      if (s) setSettings(s);
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

  return { settings, loading, updateSettings, reload: loadSettings };
}
