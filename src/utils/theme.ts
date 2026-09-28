export type ThemeMode = 'light' | 'dark';

export function resolveInitialTheme(
  storedTheme: string | null | undefined,
  prefersDark: boolean
): ThemeMode {
  if (storedTheme === 'dark') return 'dark';
  if (storedTheme === 'light') return 'light';
  return prefersDark ? 'dark' : 'light';
}

export function applyTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem('kakeibo_theme', theme);
  } catch {
    // ignore localStorage error if in restricted environment
  }
  document.documentElement.setAttribute('data-theme', theme);
}
