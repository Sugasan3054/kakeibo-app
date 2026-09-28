import { describe, it, expect } from 'vitest';
import { resolveInitialTheme } from '../theme';

describe('Theme migration and resolution (resolveInitialTheme)', () => {
  it('returns "dark" when storedTheme is explicitly "dark", ignoring OS preference', () => {
    expect(resolveInitialTheme('dark', false)).toBe('dark');
    expect(resolveInitialTheme('dark', true)).toBe('dark');
  });

  it('returns "light" when storedTheme is explicitly "light", ignoring OS preference', () => {
    expect(resolveInitialTheme('light', false)).toBe('light');
    expect(resolveInitialTheme('light', true)).toBe('light');
  });

  it('migrates legacy "system" theme based on OS prefersDark', () => {
    expect(resolveInitialTheme('system', true)).toBe('dark');
    expect(resolveInitialTheme('system', false)).toBe('light');
  });

  it('migrates undefined or null stored theme based on OS prefersDark', () => {
    expect(resolveInitialTheme(undefined, true)).toBe('dark');
    expect(resolveInitialTheme(undefined, false)).toBe('light');
    expect(resolveInitialTheme(null, true)).toBe('dark');
    expect(resolveInitialTheme(null, false)).toBe('light');
  });

  it('migrates invalid theme string based on OS prefersDark', () => {
    expect(resolveInitialTheme('invalid_theme', true)).toBe('dark');
    expect(resolveInitialTheme('invalid_theme', false)).toBe('light');
  });
});
