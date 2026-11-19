/**
 * Cold start on a real store (review pass 10, data layer). `app/index.tsx` sends the app to the
 * splash, and the splash opens the store, restores the saved look and picks the first screen.
 *
 * The database is a real SQLite file (file-backed expo-sqlite double). A relaunch is modelled
 * as the splash's own `store.open()` on a brand-new connection to that file, with the in-memory
 * look store back at its launch defaults, which is what a killed and reopened app starts from.
 */
import { joinPath, makeTempDir, removeDir, removeFile, writeTextFile } from '../src/db/testSupport/nodeTempFiles';

import { render, screen, waitFor } from '@testing-library/react-native';
import { createElement } from 'react';

jest.mock('expo-sqlite', () => {
  const g = globalThis as { __fallbackColdStartDir?: string };
  if (!g.__fallbackColdStartDir) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    g.__fallbackColdStartDir = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'fallback-coldstart-'));
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('../src/db/testSupport/expoSqliteTestDouble') as typeof import('../src/db/testSupport/expoSqliteTestDouble')).createExpoSqliteTestDouble({
    directory: g.__fallbackColdStartDir,
  });
});
jest.mock('expo-crypto', () => ({
  randomUUID: () => (globalThis as unknown as { crypto: Crypto }).crypto.randomUUID(),
}));
jest.mock('expo-file-system/legacy', () => require('../src/db/testSupport/fileSystemTestDouble'));
jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(async () => undefined),
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), canGoBack: () => false, back: jest.fn() }),
  Redirect: () => null,
}));

import S01Splash from './splash';
import Index from './index';
import { Redirect } from 'expo-router';
import { useThemeStore } from '@/app-shell';
import { repos, store } from '@/db';
import { DEFAULT_ACCENT } from '@/theme/tokens';

const ONBOARDED = '2026-03-01T09:00:00.000Z';

/** The state a freshly launched app's in-memory look store starts from. */
function launchLookDefaults() {
  useThemeStore.setState({ mode: 'auto', accent: DEFAULT_ACCENT });
}

/** Clears the saved store, the same way "erase all" does, so a case starts from nothing. */
async function startFromNothing(): Promise<void> {
  const erased = await store.eraseAll();
  expect(erased.ok).toBe(true);
  launchLookDefaults();
}

/** The app's own launch path: the splash opens the store, restores the look and routes. */
function relaunchSplash() {
  launchLookDefaults();
  return render(createElement(S01Splash));
}

describe('cold start', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await startFromNothing();
  });

  afterAll(() => {
    const dir = (globalThis as { __fallbackColdStartDir?: string }).__fallbackColdStartDir;
    if (dir) removeDir(dir);
  });

  it('the app opens on the splash route', () => {
    // The route decision itself: the index screen returns a redirect to /splash (the splash then
    // opens the store and chooses /today or onboarding).
    const element = Index() as unknown as { type: unknown; props: { href: string } };
    expect(element.type).toBe(Redirect);
    expect(element.props.href).toBe('/splash');
  });

  it('a returning, onboarded person lands on /today with their saved theme and colour already in place', async () => {
    const saved = await repos.settings.patch({
      theme: 'dark',
      accent: 'hue-200',
      onboardingCompletedAt: ONBOARDED as never,
    });
    expect(saved.ok).toBe(true);

    launchLookDefaults();
    expect(useThemeStore.getState().mode).toBe('auto');

    relaunchSplash();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/today'));
    expect(useThemeStore.getState().mode).toBe('dark');
    expect(useThemeStore.getState().accent).toBe('hue-200');
  });

  it('a person who saved a look but did not finish onboarding goes to the first onboarding step, still in their colours', async () => {
    const saved = await repos.settings.patch({ theme: 'light', accent: 'mono' });
    expect(saved.ok).toBe(true);

    relaunchSplash();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/onboarding/concept'));
    expect(useThemeStore.getState().mode).toBe('light');
    expect(useThemeStore.getState().accent).toBe('mono');
  });

  it('a first launch with nothing saved opens onboarding on the default look', async () => {
    relaunchSplash();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/onboarding/concept'));
    expect(useThemeStore.getState().mode).toBe('auto');
    expect(useThemeStore.getState().accent).toBe(DEFAULT_ACCENT);
  });

  it('a store file that cannot be read sends the person to recovery, not a blank or looping splash', async () => {
    const dir = (globalThis as { __fallbackColdStartDir?: string }).__fallbackColdStartDir as string;
    // Drop the WAL and shared-memory files too: a leftover WAL holds valid pages and would mask the damage.
    for (const suffix of ['-wal', '-shm']) removeFile(joinPath(dir, `fallback.db${suffix}`));
    writeTextFile(joinPath(dir, 'fallback.db'), 'this is not a database, only text');

    relaunchSplash();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/recovery'));
  });
});
