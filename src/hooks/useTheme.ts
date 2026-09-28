import { useEffect, useCallback } from 'react';
import { useSettings } from './useSettings';
import { applyTheme, resolveInitialTheme, type ThemeMode } from '../utils/theme';

export function useTheme() {
  const { settings, updateSettings } = useSettings();

  useEffect(() => {
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolved = resolveInitialTheme(settings.theme, prefersDark);

    applyTheme(resolved);

    if ((settings.theme as string) === 'system' || settings.theme !== resolved) {
      updateSettings({ theme: resolved });
    }
  }, [settings.theme, updateSettings]);

  const setTheme = useCallback(
    async (theme: ThemeMode) => {
      applyTheme(theme);
      await updateSettings({ theme });
    },
    [updateSettings]
  );

  return { theme: settings.theme, setTheme };
}
