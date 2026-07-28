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
    snoozable: true,
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

  // Review pass 1, blocking item 1 (architect CR-6): SCHEMA §9, MODULES.md CR-6 and
  // migration 004's header all promise that a backup taken BEFORE migration 4 still restores
  // — the settings row simply lacks `assistant_language` / `assistant_voice`, and SQLite
  // fills them from the migration's NOT NULL defaults because `applyBackupEnvelope` builds
  // each INSERT's column list from that row's own keys. Every other restore-success test here
  // round-trips an envelope produced by `store.backup()` at the CURRENT schema version, so
  // that promise had zero coverage: normalising restore to a fixed column list, or a
  // migration 5 that adds a column with no default, would break every pre-existing backup
  // file with this suite still green. The envelope below is therefore handcrafted and frozen
  // at the literal v3 column set — deriving it from `backup()` would silently re-acquire
  // whatever columns a future migration adds and stop being a v3 file.
  it('a pre-v4 (v3-shaped) backup whose settings row has neither assistant_* column restores cleanly, taking migration 4\'s defaults', async () => {
    const { repos, store } = await freshDb();

    // Exactly the v3 `settings` columns — no `assistant_language`, no `assistant_voice`.
    // Non-default `theme` / `accent` / `notif_digest_time` so we can prove the rest of the
    // row survived rather than the whole singleton falling back to seed defaults.
    const v3SettingsRow = {
      id: 1,
      theme: 'dark',
      accent: 'plum',
      onboarding_completed_at: '2025-12-01T09:00:00.000Z',
      tenure_anchor_date: '2025-11-15',
      cycle_cadence: 'weekly',
      notif_master: 1,
      notif_routine_due: 1,
      notif_event_starting: 0,
      notif_course_dose: 1,
      notif_course_ending_soon: 0,
      notif_gentle_reentry: 1,
      notif_milestone_reached: 0,
      notif_daily_digest: 1,
      notif_digest_time: '21:30',
      sync_enabled: 0,
      sync_last_synced_at: null,
      sync_last_error: null,
      last_backup_at: '2025-12-20T10:00:00.000Z',
      updated_at: '2025-12-20T10:00:00.000Z',
    };

    const v3Envelope = {
      format: 'fallback-backup',
      formatVersion: 1,
      schemaVersion: 3,
      createdAt: '2025-12-20T10:00:00.000Z',
      tables: {
        settings: [v3SettingsRow],
        task: [],
        step: [],
        day_log: [],
        off_day_mark: [],
        as_needed_use: [],
        xp_award: [],
        achievement_unlock: [],
        cycle_record: [],
        cycle_state: [
          {
            id: 1,
            current_cycle_id: 'cycle-v3',
            cadence: 'weekly',
            start_date: '2025-12-15',
            end_date: '2025-12-21',
          },
        ],
        widget_config: [],
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('../testSupport/fileSystemTestDouble') as typeof import('../testSupport/fileSystemTestDouble');
    await fs.writeAsStringAsync('file:///pre-v4.fallbackbak', JSON.stringify(v3Envelope));

    const restoreResult = await store.restore('file:///pre-v4.fallbackbak');
    // Not a crash, not a NOT NULL constraint failure — a clean success.
    expect(restoreResult.ok).toBe(true);

    const restored = await repos.settings.get();
    // The whole point: migration 4's defaults, materialised by SQLite for the two columns the
    // file never carried. NOT null, NOT undefined.
    expect(restored.assistant).toEqual({ language: 'en-US', voice: 'warm' });

    // ...and the v3 values the file DID carry are intact, so this is a real restore and not a
    // re-seeded singleton that would trivially satisfy the assertion above.
    expect(restored.theme).toBe('dark');
    expect(restored.accent).toBe('plum');
    expect(restored.notifications.dailyDigestTime).toBe('21:30');
    expect(restored.tenureAnchorDate).toBe('2025-11-15');

    // A patch on top of a restored pre-v4 row still merges field-wise (no half-populated
    // `assistant` object left behind by the restore).
    const patched = await repos.settings.patch({ assistant: { language: 'en-US', voice: 'calm' } });
    expect(patched.ok).toBe(true);
    const afterPatch = await repos.settings.get();
    expect(afterPatch.assistant).toEqual({ language: 'en-US', voice: 'calm' });
    expect(afterPatch.theme).toBe('dark');
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

  // Review pass 1, blocking item 1: a structurally well-formed but semantically
  // impossible envelope (every table empty — `buildBackupEnvelope` can never produce this,
  // since it always serialises exactly one `settings` row and one `cycle_state` row) must
  // be rejected BEFORE the transaction opens, not applied destructively.
  it('an envelope with all 11 tables empty (semantically impossible — a genuine backup always carries the singletons) fails validation without touching data', async () => {
    const { repos, store } = await freshDb();
    const task = buildTask();
    await repos.tasks.insert(task, []);
    const settingsBefore = await repos.settings.get();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('../testSupport/fileSystemTestDouble') as typeof import('../testSupport/fileSystemTestDouble');
    const impossibleEnvelope = {
      format: 'fallback-backup',
      formatVersion: 1,
      schemaVersion: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      tables: {
        settings: [],
        task: [],
        step: [],
        day_log: [],
        off_day_mark: [],
        as_needed_use: [],
        xp_award: [],
        achievement_unlock: [],
        cycle_record: [],
        cycle_state: [],
        widget_config: [],
      },
    };
    await fs.writeAsStringAsync('file:///empty.fallbackbak', JSON.stringify(impossibleEnvelope));

    const restoreResult = await store.restore('file:///empty.fallbackbak');
    expect(restoreResult.ok).toBe(false);
    if (!restoreResult.ok) expect(restoreResult.error.code).toBe('VALIDATION_FAILED');

    // Existing data is completely untouched — never a destructive "successful" wipe.
    const stillThere = await repos.tasks.get(task.id);
    expect(stillThere?.name).toBe('Read');
    // `repos.settings.get()` still resolves (never throws across the module boundary) and
    // the tenure anchor is unchanged — no fresh-anchor side effect from a rejected restore.
    await expect(repos.settings.get()).resolves.toEqual(settingsBefore);
  });

  it('validateBackupEnvelope also rejects an envelope missing just the cycle_state singleton, or with a newer schemaVersion', () => {
    const base = {
      format: 'fallback-backup',
      formatVersion: 1,
      schemaVersion: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      tables: {
        settings: [{ id: 1 }],
        task: [],
        step: [],
        day_log: [],
        off_day_mark: [],
        as_needed_use: [],
        xp_award: [],
        achievement_unlock: [],
        cycle_record: [],
        cycle_state: [],
        widget_config: [],
      },
    };
    expect(validateBackupEnvelope(base).ok).toBe(false);

    const futureSchema = { ...base, tables: { ...base.tables, cycle_state: [{ id: 1 }] }, schemaVersion: 999 };
    const futureResult = validateBackupEnvelope(futureSchema);
    expect(futureResult.ok).toBe(false);
    if (!futureResult.ok) expect(futureResult.error.code).toBe('VALIDATION_FAILED');
  });

  // Review pass 2, non-blocking note 1: `validateBackupColumns` (the pragma_table_info
  // allowlist hardening applied inside `applyBackupEnvelope`) had zero covering tests.
  // This drives it through the real `store.restore()` path, not just the pure validator.
  it('restore rejects an otherwise-valid envelope carrying an unrecognised column on a row, before touching data', async () => {
    const { repos, store } = await freshDb();
    const task = buildTask();
    await repos.tasks.insert(task, []);

    const backupResult = await store.backup();
    expect(backupResult.ok).toBe(true);
    if (!backupResult.ok) return;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('../testSupport/fileSystemTestDouble') as typeof import('../testSupport/fileSystemTestDouble');
    const raw = await fs.readAsStringAsync(backupResult.value.uri);
    const envelope = JSON.parse(raw) as { tables: Record<string, Record<string, unknown>[]> };
    // A genuine `buildBackupEnvelope` output can never carry this key — simulates a
    // crafted/foreign-schema file, the exact case the allowlist exists to catch.
    const taskRows = envelope.tables.task ?? [];
    envelope.tables.task = taskRows.map((row) => ({ ...row, sneaky_extra_column: 'DROP TABLE task;--' }));
    await fs.writeAsStringAsync('file:///hostile-column.fallbackbak', JSON.stringify(envelope));

    const restoreResult = await store.restore('file:///hostile-column.fallbackbak');
    expect(restoreResult.ok).toBe(false);
    if (!restoreResult.ok) expect(restoreResult.error.code).toBe('VALIDATION_FAILED');

    // Rejected before the transaction opened — the pre-existing task is untouched.
    const stillThere = await repos.tasks.get(task.id);
    expect(stillThere?.name).toBe('Read');
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
