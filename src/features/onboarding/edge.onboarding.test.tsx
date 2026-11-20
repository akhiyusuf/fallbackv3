/**
 * Edge cases for the first routine saved during onboarding, run against a REAL SQLite file (the
 * node:sqlite double) with the real queries and the real FirstTaskScreen. A person saw
 * "couldn't save, try again" once on a phone; these walk the paths that can fail it: the store not
 * open yet, the settings row missing, a slow store, a double tap, odd names.
 *
 * Also: the resume pointer (junk value, unknown route).
 */
// The database folder is made when the sqlite double is first required (imports run before any
// statement here), and read back lazily through globalThis.
jest.mock('expo-sqlite', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { makeTempDir } = require('@/db/testSupport/nodeTempFiles') as typeof import('@/db/testSupport/nodeTempFiles');
  const directory = makeTempDir('fallback-onboarding-edge-');
  (globalThis as { __obDir?: string }).__obDir = directory;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('@/db/testSupport/expoSqliteTestDouble') as typeof import('@/db/testSupport/expoSqliteTestDouble')).createExpoSqliteTestDouble({ directory });
});
jest.mock('expo-crypto', () => ({ randomUUID: () => (globalThis as unknown as { crypto: Crypto }).crypto.randomUUID() }));
jest.mock('expo-file-system/legacy', () => require('@/db/testSupport/fileSystemTestDouble'));
const mockSecure = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => mockSecure.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => void mockSecure.set(k, v)),
  deleteItemAsync: jest.fn(async (k: string) => void mockSecure.delete(k)),
}));
const mockShowToast = jest.fn();
jest.mock('@/app-shell', () => ({
  useToastStore: (selector: (s: { show: typeof mockShowToast }) => unknown) => selector({ show: mockShowToast }),
}));

import React from 'react';
import { removeDir } from '@/db/testSupport/nodeTempFiles';
import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import { DatabaseSync } from 'node:sqlite';

import { repos, store } from '@/db';
import { DB_NAME } from '@/db/client';
import { FirstTaskScreen } from './FirstTaskScreen';
import { S08_COPY } from './copy';
import { clearOnboardingProgress, getOnboardingProgress, markOnboardingProgress } from './progress';
import { useOnboardingResumeRedirect } from './useOnboardingResume';

afterAll(() => {
  const d = (globalThis as { __obDir?: string }).__obDir;
  if (d) removeDir(d);
});
function rawDb() {
  return new DatabaseSync(`${(globalThis as { __obDir?: string }).__obDir}/${DB_NAME}`);
}
function taskNames(): string[] {
  const db = rawDb();
  try {
    return (db.prepare('SELECT name FROM task ORDER BY created_at').all() as { name: string }[]).map((r) => r.name);
  } finally {
    db.close();
  }
}

let client: QueryClient;
function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
async function renderFirstTask() {
  return render(<FirstTaskScreen />, { wrapper: Wrapper });
}
async function fill(user: ReturnType<typeof userEvent.setup>, name = 'Morning workout', ideal = 'Full workout', fallback = '10 pushups') {
  await user.type(screen.getByLabelText(S08_COPY.nameLabel), name);
  await user.type(screen.getByLabelText(S08_COPY.idealLabel), ideal);
  await user.type(screen.getByLabelText(S08_COPY.fallbackLabel), fallback);
}

beforeEach(() => {
  mockShowToast.mockReset();
  mockSecure.clear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  jest.spyOn(router, 'replace').mockImplementation(() => {});
  jest.spyOn(router, 'dismissAll').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('first routine in onboarding, real store', () => {
  // Runs first on purpose: the store has not been opened yet in this module registry.
  it('store not open yet: the toast carries the reason, nothing is half-saved, and a press after the store opens works', async () => {
    const user = userEvent.setup();
    await renderFirstTask();
    await fill(user);
    await user.press(screen.getByLabelText(S08_COPY.save));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith(S08_COPY.saveFailure, 'warning', { detail: 'Database is not open yet.' }), { timeout: 3000 });
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByLabelText(S08_COPY.save).props.accessibilityState?.disabled).not.toBe(true);
    expect(screen.getByDisplayValue('Morning workout')).toBeTruthy();

    const opened = await store.open();
    expect(opened).toEqual({ ok: true, value: 'ready' });
    await user.press(screen.getByLabelText(S08_COPY.save));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/today?justAdded=1'));
    expect(taskNames()).toEqual(['Morning workout']);
    expect((await repos.settings.get()).onboardingCompletedAt).not.toBeNull();
  });

  it('whitespace-only name: error shown, nothing saved', async () => {
    const before = taskNames().length;
    const user = userEvent.setup();
    await renderFirstTask();
    await fill(user, '     ');
    await user.press(screen.getByLabelText(S08_COPY.save));
    expect(screen.getByText(S08_COPY.nameError)).toBeTruthy();
    expect(taskNames().length).toBe(before);
  });

  it('a 200 character name with emoji and padding is saved trimmed, whole', async () => {
    const long = `${'a'.repeat(190)} 🏃‍♀️💪`;
    const user = userEvent.setup();
    await renderFirstTask();
    await fill(user, `  ${long}  `, ' 🏋️ lift ', ' two reps ');
    await user.press(screen.getByLabelText(S08_COPY.save));
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    expect(taskNames()).toContain(long);
    const tasks = await repos.tasks.list();
    const t = tasks.find((x) => x.name === long);
    expect(t?.idealSteps.map((s) => s.text)).toEqual(['🏋️ lift']);
    expect(t?.fallbackSteps.map((s) => s.text)).toEqual(['two reps']);
  });

  it('three presses a moment apart with a slow store: one routine, one finish', async () => {
    const before = taskNames().length;
    const realInsert = repos.tasks.insert.bind(repos.tasks);
    jest.spyOn(repos.tasks, 'insert').mockImplementation(async (task, steps) => {
      await new Promise((r) => setTimeout(r, 300));
      return realInsert(task, steps);
    });
    const user = userEvent.setup();
    await renderFirstTask();
    await fill(user, 'Slow one');
    await fireEvent.press(screen.getByLabelText(S08_COPY.save));
    await fireEvent.press(screen.getByLabelText(S08_COPY.save));
    await fireEvent.press(screen.getByLabelText(S08_COPY.save));
    await waitFor(() => expect(router.replace).toHaveBeenCalled(), { timeout: 3000 });
    expect(taskNames().length).toBe(before + 1);
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it('settings row missing: the routine is saved once, the toast names the reason, and the retry does not duplicate it', async () => {
    const before = taskNames().length;
    const db = rawDb();
    const saved = db.prepare('SELECT * FROM settings WHERE id = 1').get() as Record<string, unknown>;
    db.exec('DELETE FROM settings WHERE id = 1');
    db.close();
    const user = userEvent.setup();
    await renderFirstTask();
    await fill(user, 'No settings');
    await user.press(screen.getByLabelText(S08_COPY.save));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith(S08_COPY.saveFailure, 'warning', { detail: 'settings singleton missing' }), { timeout: 3000 });
    expect(taskNames().length).toBe(before + 1);
    expect(router.replace).not.toHaveBeenCalled();

    // Seed it again (as a reopen would) and press once more.
    const db2 = rawDb();
    const cols = Object.keys(saved);
    db2.prepare(`INSERT INTO settings (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...(Object.values(saved) as never[]));
    db2.close();
    await user.press(screen.getByLabelText(S08_COPY.save));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/today?justAdded=1'));
    expect(taskNames().length).toBe(before + 1);
  });

  it('database busy for a moment on the first attempt: goes through with no toast', async () => {
    const before = taskNames().length;
    const realInsert = repos.tasks.insert.bind(repos.tasks);
    let calls = 0;
    jest.spyOn(repos.tasks, 'insert').mockImplementation(async (task, steps) => {
      calls += 1;
      if (calls === 1) return { ok: false, error: { code: 'WRITE_FAILED', message: 'database is locked' } } as never;
      return realInsert(task, steps);
    });
    const user = userEvent.setup();
    await renderFirstTask();
    await fill(user, 'Busy one');
    await user.press(screen.getByLabelText(S08_COPY.save));
    await waitFor(() => expect(router.replace).toHaveBeenCalled(), { timeout: 3000 });
    expect(taskNames().length).toBe(before + 1);
    expect(mockShowToast).not.toHaveBeenCalled();
  });
});

describe('onboarding resume pointer', () => {
  function Probe() {
    useOnboardingResumeRedirect('/onboarding/concept');
    return null;
  }
  it('a pointer naming a route that does not exist starts the tour clean (no redirect)', async () => {
    await markOnboardingProgress('/onboarding/removed-step');
    await render(<Probe />);
    await waitFor(async () => expect(await getOnboardingProgress()).toBe('/onboarding/concept'));
    expect(router.replace).not.toHaveBeenCalled();
  });
  it('a pointer to a real later step resumes there', async () => {
    await markOnboardingProgress('/onboarding/personalize');
    await render(<Probe />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/onboarding/personalize'));
  });
  it('nothing saved starts at the concept step and marks it', async () => {
    await clearOnboardingProgress();
    await render(<Probe />);
    await waitFor(async () => expect(await getOnboardingProgress()).toBe('/onboarding/concept'));
    expect(router.replace).not.toHaveBeenCalled();
  });
});
