import './testHarness';

jest.mock('expo-file-system/legacy', () => require('../testSupport/fileSystemTestDouble'));
jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(async () => undefined),
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

import { newId } from '@/lib/id';
import type { Task } from '@/types';

import { validateBackupEnvelope } from '../backupEnvelope';

async function freshDb() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  (require('expo-sqlite') as { __reset: () => void }).__reset();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  (require('../testSupport/fileSystemTestDouble') as { __reset: () => void }).__reset();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const db = require('../index') as typeof import('../index');
  const opened = await db.store.open();
  expect(opened.ok).toBe(true);
  return db;
}

function buildTask(): Task {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id: newId(),
    type: 'routine',
    name: 'Read',
    note: null,
    icon: 'Repeat',
    color: 'forge-orange',
    isAsNeeded: false,
    cadence: { kind: 'daily' },
    eventDate: null,
    timeOfDay: null,
    startDate: null,
    endDate: null,
    dosesPerDay: 1,
    isTracked: true,
    importance: null,
    necessity: null,
    todoDoneAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  } as Task;
}

describe('backup / restore (F19, SCHEMA §9)', () => {
  it('validateBackupEnvelope rejects a malformed file', () => {
    expect(validateBackupEnvelope(null).ok).toBe(false);
    expect(validateBackupEnvelope({ format: 'something-else' }).ok).toBe(false);
    expect(validateBackupEnvelope({ format: 'fallback-backup', formatVersion: 1, schemaVersion: 1, createdAt: 'x', tables: {} }).ok).toBe(
      false,
    );
  });

  it('the written backup file contains exactly the pinned 11 tables — never entitlement, never a raw secret', async () => {
    const { store } = await freshDb();
    const backupResult = await store.backup();
    expect(backupResult.ok).toBe(true);
    if (!backupResult.ok) return;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('../testSupport/fileSystemTestDouble') as typeof import('../testSupport/fileSystemTestDouble');
    const raw = await fs.readAsStringAsync(backupResult.value.uri);
    const envelope = JSON.parse(raw) as { format: string; tables: Record<string, unknown> };

    expect(envelope.format).toBe('fallback-backup');
    expect(Object.keys(envelope.tables).sort()).toEqual(
      ['settings', 'task', 'step', 'day_log', 'off_day_mark', 'as_needed_use', 'xp_award', 'achievement_unlock', 'cycle_record', 'cycle_state', 'widget_config'].sort(),
    );
    expect(raw).not.toContain('entitlement');
    expect(raw).not.toContain('byo.apiKey');
  });

  it('a round trip (backup, then restore the SAME file back in) preserves task/step/day_log data', async () => {
    const { repos, store } = await freshDb();
    const task = buildTask();
    await repos.tasks.insert(task, [
      { id: newId(), taskId: task.id, role: 'ideal', text: 'Read 10 pages', position: 0, dueWeekdays: null },
    ]);
    await repos.logs.upsert({
      id: newId(),
      taskId: task.id,
      date: '2026-01-01' as never,
      chipState: 'done',
      isManualOverride: true,
      completedStepIds: [],
      dosesCompleted: 0,
      movedToDate: null,
      createdAt: '2026-01-01T00:00:00.000Z' as never,
      updatedAt: '2026-01-01T00:00:00.000Z' as never,
    });

    const backupResult = await store.backup();
    expect(backupResult.ok).toBe(true);
    if (!backupResult.ok) return;

    const restoreResult = await store.restore(backupResult.value.uri);
    expect(restoreResult.ok).toBe(true);

    const restoredTask = await repos.tasks.get(task.id);
    expect(restoredTask?.name).toBe('Read');
    expect(restoredTask?.idealSteps).toHaveLength(1);
    const logs = await repos.logs.listForTask(task.id, '2026-01-01' as never, '2026-01-01' as never);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.chipState).toBe('done');
  });

  // Mandatory (SCHEMA §2.3 / §9): orphaned NULL-task xp_award rows survive a full
  // delete -> hard sweep -> backup -> ERASE-ALL (a genuinely fresh store) -> restore round
  // trip, and lifetime XP is unchanged throughout, including a null task_id never being
  // treated as a broken reference and "repaired" away.
  it('orphaned xp_award rows (task_id = NULL after a delete) survive backup -> erase-all -> restore into a fresh store, intact', async () => {
    const { repos, store } = await freshDb();
    const task = buildTask();
    await repos.tasks.insert(task, []);

    for (let day = 1; day <= 10; day += 1) {
      await repos.progress.appendXpAward({
        id: newId(),
        taskId: task.id,
        date: `2026-01-${String(day).padStart(2, '0')}` as never,
        kind: 'ideal',
        amount: 10,
        cycleId: 'cycle-1' as never,
        createdAt: '2026-01-01T00:00:00.000Z' as never,
      });
    }
    expect(await repos.progress.lifetimeXp()).toBe(100);

    await repos.tasks.softDelete(task.id);
    // Hard sweep — xp_award.task_id becomes NULL, row survives (SCHEMA §2.3).
    await store.open();
    const orphaned = await repos.progress.listXpAwards();
    expect(orphaned).toHaveLength(10);
    expect(orphaned.every((a) => a.taskId === null)).toBe(true);
    expect(await repos.progress.lifetimeXp()).toBe(100);

    const backupResult = await store.backup();
    expect(backupResult.ok).toBe(true);
    if (!backupResult.ok) return;

    // Genuinely fresh store — F25 erase-all.
    const erased = await store.eraseAll();
    expect(erased.ok).toBe(true);
    expect(await repos.progress.lifetimeXp()).toBe(0);
    expect(await repos.progress.listXpAwards()).toHaveLength(0);

    // Restore from the backup taken BEFORE the erase.
    const restoreResult = await store.restore(backupResult.value.uri);
    expect(restoreResult.ok).toBe(true);

    const restoredAwards = await repos.progress.listXpAwards();
    expect(restoredAwards).toHaveLength(10);
    expect(restoredAwards.every((a) => a.taskId === null)).toBe(true);
    expect(restoredAwards.every((a) => a.amount === 10)).toBe(true);
    expect(await repos.progress.lifetimeXp()).toBe(100);
  });

  it('a failed restore (malformed file) leaves existing data completely untouched', async () => {
    const { repos, store } = await freshDb();
    const task = buildTask();
    await repos.tasks.insert(task, []);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('../testSupport/fileSystemTestDouble') as typeof import('../testSupport/fileSystemTestDouble');
    await fs.writeAsStringAsync('file:///bad.fallbackbak', '{ not valid json');

    const restoreResult = await store.restore('file:///bad.fallbackbak');
    expect(restoreResult.ok).toBe(false);
    if (!restoreResult.ok) expect(restoreResult.error.code).toBe('VALIDATION_FAILED');

    const stillThere = await repos.tasks.get(task.id);
    expect(stillThere?.name).toBe('Read');
  });
});
