import { useEffect, useCallback } from 'react';
import { useSettings } from './useSettings';

export function useTheme() {
  const { settings, updateSettings } = useSettings();

  const applyTheme = useCallback((theme: 'light' | 'dark' | 'system') => {
    let resolvedTheme: 'light' | 'dark';

    if (theme === 'system') {
      resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } else {
      resolvedTheme = theme;
    }

    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, []);

  useEffect(() => {
    applyTheme(settings.theme);

    if (settings.theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
  }, [settings.theme, applyTheme]);

  const setTheme = useCallback(async (theme: 'light' | 'dark' | 'system') => {
    applyTheme(theme);
    await updateSettings({ theme });
  }, [applyTheme, updateSettings]);

  return { theme: settings.theme, setTheme };
}
