import { describe, it, expect } from 'vitest';
import { RELEASES, LATEST_RELEASE } from '../releases';
import packageJson from '../../../package.json';

describe('releases data and package.json synchronization', () => {
  it('has package.json version matching latest release version', () => {
    expect(packageJson.version).toBe(LATEST_RELEASE.version);
  });

  it('has valid semantic version format for all releases', () => {
    const semverRegex = /^\d+\.\d+\.\d+$/;
    for (const rel of RELEASES) {
      expect(rel.version).toMatch(semverRegex);
    }
  });

  it('has valid date format (YYYY-MM-DD) and real calendar date for all releases', () => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (const rel of RELEASES) {
      expect(rel.date).toMatch(dateRegex);

      const [year, month, day] = rel.date.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      expect(dateObj.getFullYear()).toBe(year);
      expect(dateObj.getMonth() + 1).toBe(month);
      expect(dateObj.getDate()).toBe(day);
    }
  });

  it('has non-empty title and items written for users', () => {
    for (const rel of RELEASES) {
      expect(rel.title.trim().length).toBeGreaterThan(0);
      expect(rel.items.length).toBeGreaterThan(0);
      for (const item of rel.items) {
        expect(item.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
