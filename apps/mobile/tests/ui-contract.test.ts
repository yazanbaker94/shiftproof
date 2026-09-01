import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readScreen = (name: string) => readFileSync(
  new URL(`../src/screens/${name}.tsx`, import.meta.url),
  'utf8',
);

describe('employee workflow controls', () => {
  it('keeps manual synchronization and network simulation out of normal screens', () => {
    const normalWorkflow = [
      readScreen('HomeScreen'),
      readScreen('TimesheetScreen'),
      readScreen('SavedOfflineScreen'),
    ].join('\n');
    expect(normalWorkflow).not.toMatch(/Sync now/i);
    expect(normalWorkflow).not.toContain('DemoNetworkControl');
  });

  it('keeps offline simulation explicitly isolated to reviewer controls', () => {
    expect(readScreen('ProfileScreen')).toContain('DemoNetworkControl');
    expect(readScreen('ProfileScreen')).toContain('Reviewer controls');
  });
});
