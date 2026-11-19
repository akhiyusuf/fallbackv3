/**
 * Overlapping writes on the one shared connection (review pass 10, data layer).
 *
 * expo-sqlite's `withTransactionAsync` is not exclusive, so two saves started in the same
 * tick used to collide ("cannot start a transaction within a transaction"), and a failed save
 * could roll back a neighbour's write. These cases run on a real SQLite file (file-backed
 * double) and check that every overlapping save either lands whole or fails alone.
 */
import { joinPath, makeTempDir, removeDir, removeFile, writeTextFile } from '../testSupport/nodeTempFiles';

const createdDirs: string[] = [];
afterAll(() => {
  for (const dir of createdDirs) removeDir(dir);
});

function newDatabaseDir(): void {
  const dir = makeTempDir('fallback-writes-');
  createdDirs.push(dir);
  (globalThis as { __fallbackWritesDir?: string }).__fallbackWritesDir = dir;
}

jest.mock('expo-sqlite', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('../testSupport/expoSqliteTestDouble') as typeof import('../testSupport/expoSqliteTestDouble')).createExpoSqliteTestDouble({
    directory: (globalThis as { __fallbackWritesDir?: string }).__fallbackWritesDir,
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

import type { Step, Task } from '@/types';
import { newId } from '@/lib/id';

type App = typeof import('@/db');

function launch(): App {
  jest.resetModules();
  return require('@/db') as App;
}

async function coldStart(): Promise<App> {
  const app = launch();
  const opened = await app.store.open();
  if (!opened.ok || opened.value !== 'ready') throw new Error(`store did not open ready: ${JSON.stringify(opened)}`);
  return app;
}

function buildTask(id: string): Task {
  const at = '2026-01-01T00:00:00.000Z';
  return {
    id,
    type: 'routine',
    name: 'Walk',
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

describe('task edits started back to back', () => {
  it('a rename and an importance change started in the same tick both land', async () => {
    newDatabaseDir();
    const app = await coldStart();
    const taskId = newId();
    await app.repos.tasks.insert(buildTask(taskId), [
      { id: newId(), taskId, role: 'ideal', text: 'Walk', position: 0, dueWeekdays: null } as Step,
    ]);

    const [rename, reimportance] = await Promise.all([
      app.repos.tasks.update(taskId, { name: 'Evening walk' }),
      app.repos.tasks.update(taskId, { importance: 'low' }),
    ]);
    expect(rename.ok && reimportance.ok).toBe(true);

    const reopened = await coldStart();
    const task = await reopened.repos.tasks.get(taskId);
    expect(task?.name).toBe('Evening walk');
    expect(task?.importance).toBe('low');
  });

  it('updating a task that does not exist still reports NOT_FOUND', async () => {
    newDatabaseDir();
    const app = await coldStart();
    const result = await app.repos.tasks.update(newId(), { name: 'Ghost' });
    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });
});

describe('a failed save does not disturb a neighbour', () => {
  it('a settings save that fails rolls back alone; a save started with it still lands', async () => {
    newDatabaseDir();
    const app = await coldStart();
    await app.repos.settings.patch({ theme: 'light', accent: 'berry' });

    const [failed, ok] = await Promise.all([
      // The widget points at a task that does not exist: the foreign key refuses the row.
      app.repos.settings.patch({
        theme: 'dark',
        widgets: [{ size: 'small-one-task', mode: 'fixed-task', fixedTaskId: newId() }],
      }),
      app.repos.settings.patch({ accent: 'plum' }),
    ]);
    expect(failed.ok).toBe(false);
    expect(ok.ok).toBe(true);

    const reopened = await coldStart();
    const read = await reopened.repos.settings.get();
    expect(read.theme).toBe('light');
    expect(read.accent).toBe('plum');
    expect(read.widgets).toEqual([]);
  });
});
