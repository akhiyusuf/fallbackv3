/**
 * Cold-start durability of the `settings` singleton (review pass 10, data layer).
 *
 * Every case runs against a REAL SQLite file (node:sqlite behind the expo-sqlite test double,
 * file-backed mode). A "launch" is a fresh JS module registry plus a brand-new connection to
 * the same file. Nothing is closed first, which is what a killed app leaves behind: the WAL
 * file carries whatever was committed, and the next launch must read all of it.
 */
import { makeTempDir, removeDir } from '../testSupport/nodeTempFiles';

const createdDirs: string[] = [];
afterAll(() => {
  for (const dir of createdDirs) removeDir(dir);
});

/** Each test gets its own database file, so no connection or WAL state leaks between tests. */
function newDatabaseDir(): string {
  const dir = makeTempDir('fallback-settings-');
  createdDirs.push(dir);
  (globalThis as { __fallbackSettingsDir?: string }).__fallbackSettingsDir = dir;
  return dir;
}

jest.mock('expo-sqlite', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('../testSupport/expoSqliteTestDouble') as typeof import('../testSupport/expoSqliteTestDouble')).createExpoSqliteTestDouble({
    directory: (globalThis as { __fallbackSettingsDir?: string }).__fallbackSettingsDir,
  }),
);
jest.mock('expo-crypto', () => ({
  randomUUID: () => (globalThis as unknown as { crypto: Crypto }).crypto.randomUUID(),
}));
jest.mock('expo-file-system/legacy', () => require('../testSupport/fileSystemTestDouble'));
jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(async () => undefined),
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

import type { AccentKey, NotificationPrefs, Settings, Task, Step } from '@/types';
import { newId } from '@/lib/id';

type App = typeof import('@/db');

/** A new app launch: fresh modules, a new connection, nothing closed first (like a killed app). */
function launch(): App {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/db') as App;
}

/** Launch and run the same call S01 makes. Fails the test if the store does not come back ready. */
async function coldStart(): Promise<App> {
  const app = launch();
  const opened = await app.store.open();
  if (!opened.ok || opened.value !== 'ready') {
    throw new Error(`store did not open ready: ${JSON.stringify(opened)}`);
  }
  return app;
}

const ONBOARDED = '2026-03-01T09:00:00.000Z';
const BACKUP = '2026-03-02T10:00:00.000Z';
const ALL_OFF: NotificationPrefs = {
  master: false,
  routineDue: false,
  eventStarting: false,
  courseDose: false,
  courseEndingSoon: false,
  gentleReentry: false,
  milestoneReached: false,
  dailyDigest: false,
  dailyDigestTime: '08:00',
};
const ALL_ON: NotificationPrefs = {
  master: true,
  routineDue: true,
  eventStarting: true,
  courseDose: true,
  courseEndingSoon: true,
  gentleReentry: true,
  milestoneReached: true,
  dailyDigest: true,
  dailyDigestTime: '07:45',
};
const NOTIFICATION_KEYS = [
  'master',
  'routineDue',
  'eventStarting',
  'courseDose',
  'courseEndingSoon',
  'gentleReentry',
  'milestoneReached',
  'dailyDigest',
] as const;

function buildTask(id: string): Task {
  const at = '2026-01-01T00:00:00.000Z';
  return {
    id,
    type: 'routine',
    name: 'Stretch',
    note: null,
    icon: 'Repeat',
    color: 'indigo',
    isAsNeeded: false,
    cadence: { kind: 'daily' },
    eventDate: null,
    timeOfDay: null,
    startDate: null,
    endDate: null,
    dosesPerDay: 1,
    isTracked: true,
    importance: 'high',
    necessity: 'must-do',
    todoDoneAt: null,
    priorityRank: null,
    isNote: false,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
    snoozable: true,
  } as Task;
}

describe('settings durability across a restart', () => {
  it('keeps every Settings field exactly as written', async () => {
    newDatabaseDir();
    const first = await coldStart();
    const taskId = newId();
    await first.repos.tasks.insert(buildTask(taskId), [
      { id: newId(), taskId, role: 'ideal', text: 'Stretch', position: 0, dueWeekdays: null } as Step,
    ]);

    const written = await first.repos.settings.patch({
      theme: 'dark',
      accent: 'hue-200',
      onboardingCompletedAt: ONBOARDED as Settings['onboardingCompletedAt'],
      cycleCadence: 'weekly',
      notifications: {
        master: true,
        routineDue: true,
        eventStarting: false,
        courseDose: true,
        courseEndingSoon: false,
        gentleReentry: true,
        milestoneReached: false,
        dailyDigest: true,
        dailyDigestTime: '19:05',
      },
      assistant: { language: 'fr-FR', voice: 'calm' },
      widgets: [
        { size: 'medium-up-next', mode: 'smart-next-due', fixedTaskId: null },
        { size: 'small-one-task', mode: 'fixed-task', fixedTaskId: taskId },
      ],
      sync: { enabled: true, lastSyncedAt: BACKUP as Settings['sync']['lastSyncedAt'], lastError: 'offline' },
      lastBackupAt: BACKUP as Settings['lastBackupAt'],
    });
    expect(written.ok).toBe(true);
    if (!written.ok) return;

    const second = await coldStart();
    const read = await second.repos.settings.get();
    expect(read).toEqual(written.value);
    expect(read.theme).toBe('dark');
    expect(read.accent).toBe('hue-200');
    expect(read.onboardingCompletedAt).toBe(ONBOARDED);
    expect(read.cycleCadence).toBe('weekly');
    expect(read.notifications.dailyDigestTime).toBe('19:05');
    expect(read.assistant).toEqual({ language: 'fr-FR', voice: 'calm' });
    expect(read.widgets).toEqual([
      { size: 'medium-up-next', mode: 'smart-next-due', fixedTaskId: null },
      { size: 'small-one-task', mode: 'fixed-task', fixedTaskId: taskId },
    ]);
    expect(read.sync).toEqual({ enabled: true, lastSyncedAt: BACKUP, lastError: 'offline' });
    expect(read.lastBackupAt).toBe(BACKUP);
  });

  it.each(['light', 'dark', 'auto'] as const)('theme mode %s survives a restart', async (mode) => {
    newDatabaseDir();
    const first = await coldStart();
    await first.repos.settings.patch({ theme: mode });
    const second = await coldStart();
    expect((await second.repos.settings.get()).theme).toBe(mode);
  });

  it.each([
    'forge-orange',
    'indigo',
    'berry',
    'plum',
    'lagoon',
    'mono',
    'hue-0',
    'hue-200',
    'hue-359',
  ] as const)('accent %s survives a restart', async (accent) => {
    newDatabaseDir();
    const first = await coldStart();
    const patched = await first.repos.settings.patch({ accent: accent as AccentKey });
    expect(patched.ok).toBe(true);
    const second = await coldStart();
    expect((await second.repos.settings.get()).accent).toBe(accent);
  });

  it('switching from a custom color back to a named one persists, and clears the custom value', async () => {
    newDatabaseDir();
    const first = await coldStart();
    await first.repos.settings.patch({ accent: 'hue-200' as AccentKey });
    await first.repos.settings.patch({ accent: 'indigo' });

    const second = await coldStart();
    expect((await second.repos.settings.get()).accent).toBe('indigo');

    // The raw row agrees: the named color is in `accent` and the custom slot is empty.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const raw = (await (require('expo-sqlite') as typeof import('expo-sqlite')).openDatabaseAsync('fallback.db')) as unknown as {
      getFirstAsync<T>(sql: string): Promise<T | null>;
      closeAsync(): Promise<void>;
    };
    const row = await raw.getFirstAsync<{ accent: string; accent_ext: string | null }>('SELECT accent, accent_ext FROM settings WHERE id = 1');
    await raw.closeAsync();
    expect(row).toEqual({ accent: 'indigo', accent_ext: null });
  });

  it('a named color outside the original four is kept in the custom slot and reads back', async () => {
    newDatabaseDir();
    const first = await coldStart();
    await first.repos.settings.patch({ accent: 'lagoon' });
    await first.repos.settings.patch({ theme: 'dark' });
    const second = await coldStart();
    const read = await second.repos.settings.get();
    expect(read.accent).toBe('lagoon');
    expect(read.theme).toBe('dark');
  });

  it.each(NOTIFICATION_KEYS)('notification switch %s survives a restart on its own', async (key) => {
    newDatabaseDir();
    const first = await coldStart();
    await first.repos.settings.patch({ notifications: { ...ALL_OFF, [key]: true, dailyDigestTime: '21:30' } });
    const second = await coldStart();
    const read = (await second.repos.settings.get()).notifications;
    expect(read[key]).toBe(true);
    for (const other of NOTIFICATION_KEYS) {
      if (other !== key) expect([other, read[other]]).toEqual([other, false]);
    }
    expect(read.dailyDigestTime).toBe('21:30');
  });

  it('every notification switch on, then off, reads back exactly', async () => {
    newDatabaseDir();
    const first = await coldStart();
    await first.repos.settings.patch({ notifications: ALL_ON });
    expect((await (await coldStart()).repos.settings.get()).notifications).toEqual(ALL_ON);

    const off = await (await coldStart()).repos.settings.patch({ notifications: ALL_OFF });
    expect(off.ok).toBe(true);
    expect((await (await coldStart()).repos.settings.get()).notifications).toEqual(ALL_OFF);
  });

  it('onboardingCompletedAt and the tenure anchor survive restarts and do not move', async () => {
    newDatabaseDir();
    const first = await coldStart();
    const anchor = (await first.repos.settings.get()).tenureAnchorDate;
    await first.repos.settings.patch({ onboardingCompletedAt: ONBOARDED as Settings['onboardingCompletedAt'] });

    const second = await coldStart();
    const read = await second.repos.settings.get();
    expect(read.onboardingCompletedAt).toBe(ONBOARDED);
    expect(read.tenureAnchorDate).toBe(anchor);

    // Opening again (another launch) must not re-seed the singleton or reset anything.
    const third = await coldStart();
    expect(await third.repos.settings.get()).toEqual(read);
  });

  it('a digest time that is not HH:mm is refused and the saved one is kept after a restart', async () => {
    newDatabaseDir();
    const first = await coldStart();
    await first.repos.settings.patch({ notifications: { ...ALL_ON, dailyDigestTime: '07:45' } });
    const refused = await first.repos.settings.patch({ notifications: { ...ALL_ON, dailyDigestTime: '8:00' } });
    expect(refused.ok).toBe(false);

    const second = await coldStart();
    expect((await second.repos.settings.get()).notifications.dailyDigestTime).toBe('07:45');
  });
});

describe('partial updates', () => {
  it('a partial notifications patch keeps the other notification fields', async () => {
    newDatabaseDir();
    const first = await coldStart();
    await first.repos.settings.patch({ notifications: ALL_ON });
    // The shape a caller that only flips the master switch sends at runtime.
    await first.repos.settings.patch({ notifications: { master: false } as NotificationPrefs });

    const second = await coldStart();
    const read = (await second.repos.settings.get()).notifications;
    expect(read.master).toBe(false);
    expect(read).toEqual({ ...ALL_ON, master: false });
  });

  it('a partial accent patch keeps the theme, widgets and assistant prefs', async () => {
    newDatabaseDir();
    const first = await coldStart();
    await first.repos.settings.patch({
      theme: 'light',
      assistant: { language: 'de-DE', voice: 'brisk' },
      widgets: [{ size: 'small-today', mode: 'smart-next-due', fixedTaskId: null }],
    });
    await first.repos.settings.patch({ accent: 'berry' });

    const second = await coldStart();
    const read = await second.repos.settings.get();
    expect(read.accent).toBe('berry');
    expect(read.theme).toBe('light');
    expect(read.assistant).toEqual({ language: 'de-DE', voice: 'brisk' });
    expect(read.widgets).toEqual([{ size: 'small-today', mode: 'smart-next-due', fixedTaskId: null }]);
  });

  it('a key set to undefined is not part of the change: the other fields still save', async () => {
    newDatabaseDir();
    const first = await coldStart();
    await first.repos.settings.patch({ theme: 'dark', onboardingCompletedAt: ONBOARDED as Settings['onboardingCompletedAt'] });
    const saved = await first.repos.settings.patch({
      theme: undefined,
      accent: 'plum',
      onboardingCompletedAt: undefined,
      notifications: { ...ALL_OFF, master: undefined, dailyDigest: true } as unknown as NotificationPrefs,
    } as Partial<Settings>);
    expect(saved.ok).toBe(true);

    const second = await coldStart();
    const read = await second.repos.settings.get();
    expect(read.theme).toBe('dark');
    expect(read.onboardingCompletedAt).toBe(ONBOARDED);
    expect(read.accent).toBe('plum');
    expect(read.notifications.master).toBe(false);
    expect(read.notifications.dailyDigest).toBe(true);
  });

  it('a patch that does not mention widgets leaves the saved widgets alone', async () => {
    newDatabaseDir();
    const first = await coldStart();
    await first.repos.settings.patch({ widgets: [{ size: 'medium-up-next', mode: 'smart-next-due', fixedTaskId: null }] });
    await first.repos.settings.patch({ theme: 'dark' });
    const second = await coldStart();
    expect((await second.repos.settings.get()).widgets).toHaveLength(1);
  });
});

describe('two updates started back to back', () => {
  it('two patches started in the same tick, touching different fields, both land', async () => {
    newDatabaseDir();
    const app = await coldStart();
    const [a, b] = await Promise.all([
      app.repos.settings.patch({ theme: 'light' }),
      app.repos.settings.patch({ accent: 'plum' }),
    ]);
    expect(a.ok && b.ok).toBe(true);

    const second = await coldStart();
    const read = await second.repos.settings.get();
    expect(read.theme).toBe('light');
    expect(read.accent).toBe('plum');
  });

  it('a notifications patch and an assistant patch started together both survive', async () => {
    newDatabaseDir();
    const app = await coldStart();
    await Promise.all([
      app.repos.settings.patch({ notifications: { ...ALL_ON, master: false } }),
      app.repos.settings.patch({ assistant: { language: 'es-ES', voice: 'warm' } }),
    ]);

    const second = await coldStart();
    const read = await second.repos.settings.get();
    expect(read.notifications.master).toBe(false);
    expect(read.assistant.language).toBe('es-ES');
  });
});

describe('settings through a backup file', () => {
  it('a custom color, assistant prefs, notifications and widgets come back exactly after backup, erase and restore', async () => {
    newDatabaseDir();
    const app = await coldStart();
    await app.repos.settings.patch({
      theme: 'dark',
      accent: 'hue-200',
      assistant: { language: 'ja-JP', voice: 'brisk' },
      notifications: { ...ALL_ON, dailyDigestTime: '18:20' },
      widgets: [{ size: 'medium-up-next', mode: 'smart-next-due', fixedTaskId: null }],
    });
    const before = await app.repos.settings.get();

    const backup = await app.store.backup();
    expect(backup.ok).toBe(true);
    if (!backup.ok) return;
    expect(await app.store.eraseAll()).toMatchObject({ ok: true });
    expect((await app.repos.settings.get()).accent).toBe('forge-orange');

    const restored = await app.store.restore(backup.value.uri);
    expect(restored.ok).toBe(true);

    const after = await app.repos.settings.get();
    expect(after).toMatchObject({
      theme: before.theme,
      accent: 'hue-200',
      assistant: { language: 'ja-JP', voice: 'brisk' },
      notifications: { ...ALL_ON, dailyDigestTime: '18:20' },
      widgets: before.widgets,
    });
  });
});

describe('a save interrupted before it commits', () => {
  it('a killed app leaves the previously saved settings, not the half-written change', async () => {
    newDatabaseDir();
    const first = await coldStart();
    await first.repos.settings.patch({ theme: 'light', accent: 'berry', notifications: ALL_ON });

    // The process dies in the middle of a save: BEGIN and an UPDATE have run, COMMIT never does.
    // Closing the connection without a commit is what the OS leaves behind for a killed app.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sqlite = require('expo-sqlite') as typeof import('expo-sqlite');
    const interrupted = (await sqlite.openDatabaseAsync('fallback.db')) as unknown as {
      execAsync(sql: string): Promise<void>;
      runAsync(sql: string, params?: unknown[]): Promise<unknown>;
      closeAsync(): Promise<void>;
    };
    await interrupted.execAsync('BEGIN');
    await interrupted.runAsync(`UPDATE settings SET theme = 'dark', accent = 'plum' WHERE id = 1`);
    await interrupted.closeAsync();

    const relaunched = await coldStart();
    const read = await relaunched.repos.settings.get();
    expect(read.theme).toBe('light');
    expect(read.accent).toBe('berry');
    expect(read.notifications).toEqual(ALL_ON);
  });
});
