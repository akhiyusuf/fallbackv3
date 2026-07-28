import './testHarness';

import { newId } from '@/lib/id';
import type { Task } from '@/types';

async function freshDb() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  (require('expo-sqlite') as { __reset: () => void }).__reset();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const db = require('../index') as typeof import('../index');
  await db.store.open();
  return db;
}

function buildTask(overrides: Partial<Task> = {}): Task {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id: newId(),
    type: 'routine',
    name: 'Meditate',
    note: null,
    icon: 'Repeat',
    color: 'indigo',
    isAsNeeded: false,
    cadence: { kind: 'specific-weekdays', weekdays: [1, 3, 5] },
    eventDate: null,
    timeOfDay: null,
    startDate: null,
    endDate: null,
    dosesPerDay: 1,
    isTracked: true,
    importance: 'high',
    necessity: 'must-do',
    todoDoneAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    snoozable: true,
    ...overrides,
  } as Task;
}

describe('TaskRepository', () => {
  it('insert/get round-trips a cadence, and ideal/fallback steps come back on the right side', async () => {
    const { repos } = await freshDb();
    const task = buildTask();
    const insertResult = await repos.tasks.insert(task, [
      { id: newId(), taskId: task.id, role: 'ideal', text: 'Sit for 10 min', position: 0, dueWeekdays: null },
      { id: newId(), taskId: task.id, role: 'fallback', text: 'Take 3 deep breaths', position: 0, dueWeekdays: null },
    ]);
    expect(insertResult.ok).toBe(true);

    const fetched = await repos.tasks.get(task.id);
    expect(fetched?.name).toBe('Meditate');
    expect(fetched?.cadence).toEqual({ kind: 'specific-weekdays', weekdays: [1, 3, 5] });
    expect(fetched?.idealSteps).toHaveLength(1);
    expect(fetched?.fallbackSteps).toHaveLength(1);
    expect(fetched?.idealSteps[0]?.text).toBe('Sit for 10 min');
  });

  // CR-4 (docs/MODULES.md top matter, SCHEMA §2). Default on; editable post-creation;
  // a duplicate inherits the source task's value.
  it('snoozable defaults to true, round-trips through insert/get, is editable, and a duplicate inherits it', async () => {
    const { repos } = await freshDb();
    const task = buildTask();
    expect(task.snoozable).toBe(true);
    await repos.tasks.insert(task, []);
    expect((await repos.tasks.get(task.id))?.snoozable).toBe(true);

    const patched = await repos.tasks.update(task.id, { snoozable: false });
    expect(patched.ok).toBe(true);
    expect((await repos.tasks.get(task.id))?.snoozable).toBe(false);

    const dup = await repos.tasks.duplicate(task.id);
    expect(dup.ok).toBe(true);
    if (!dup.ok) return;
    expect((await repos.tasks.get(dup.value))?.snoozable).toBe(false);
  });

  it('update() patches fields and can replace the step set', async () => {
    const { repos } = await freshDb();
    const task = buildTask();
    await repos.tasks.insert(task, [{ id: newId(), taskId: task.id, role: 'ideal', text: 'A', position: 0, dueWeekdays: null }]);

    const patched = await repos.tasks.update(task.id, { name: 'Meditate daily' }, [
      { id: newId(), taskId: task.id, role: 'ideal', text: 'B', position: 0, dueWeekdays: null },
    ]);
    expect(patched.ok).toBe(true);

    const fetched = await repos.tasks.get(task.id);
    expect(fetched?.name).toBe('Meditate daily');
    expect(fetched?.idealSteps.map((s) => s.text)).toEqual(['B']);
  });

  it('duplicate() copies definitions but starts with EMPTY history', async () => {
    const { repos } = await freshDb();
    const task = buildTask();
    await repos.tasks.insert(task, [{ id: newId(), taskId: task.id, role: 'ideal', text: 'A', position: 0, dueWeekdays: null }]);
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

    const dup = await repos.tasks.duplicate(task.id);
    expect(dup.ok).toBe(true);
    if (!dup.ok) return;

    const copy = await repos.tasks.get(dup.value);
    expect(copy?.name).toBe('Meditate');
    expect(copy?.idealSteps).toHaveLength(1);
    expect(dup.value).not.toBe(task.id);

    const copyLogs = await repos.logs.listForTask(dup.value, '2026-01-01' as never, '2026-01-31' as never);
    expect(copyLogs).toHaveLength(0);
  });

  it('name must be non-empty after trim (DB CHECK constraint)', async () => {
    const { repos } = await freshDb();
    const task = buildTask({ name: '   ' });
    const result = await repos.tasks.insert(task, []);
    expect(result.ok).toBe(false);
  });
});

describe('OffDayRepository', () => {
  it('allows only ONE whole-day mark per date, but many task-day marks', async () => {
    const { repos } = await freshDb();
    const mark1 = await repos.offDays.mark({
      id: newId(),
      date: '2026-04-01' as never,
      taskId: null,
      priorChipState: null,
      createdAt: '2026-04-01T00:00:00.000Z' as never,
    });
    expect(mark1.ok).toBe(true);

    // Re-marking the SAME whole day is idempotent (upsert), not a second row.
    const mark2 = await repos.offDays.mark({
      id: newId(),
      date: '2026-04-01' as never,
      taskId: null,
      priorChipState: 'done' as never,
      createdAt: '2026-04-01T00:00:00.000Z' as never,
    });
    expect(mark2.ok).toBe(true);

    const marks = await repos.offDays.listRange('2026-04-01' as never, '2026-04-01' as never);
    expect(marks).toHaveLength(1);
    expect(marks[0]?.priorChipState).toBe('done');
  });

  it('unmark() removes the mark for that date/task', async () => {
    const { repos } = await freshDb();
    await repos.offDays.mark({ id: newId(), date: '2026-04-02' as never, taskId: null, priorChipState: null, createdAt: '2026-04-02T00:00:00.000Z' as never });
    const unmarked = await repos.offDays.unmark('2026-04-02' as never, null);
    expect(unmarked.ok).toBe(true);
    expect(await repos.offDays.listRange('2026-04-02' as never, '2026-04-02' as never)).toHaveLength(0);
  });
});

describe('SettingsRepository', () => {
  it('patch() rejects a malformed dailyDigestTime and leaves settings unchanged', async () => {
    const { repos } = await freshDb();
    const before = await repos.settings.get();
    const patched = await repos.settings.patch({ notifications: { ...before.notifications, dailyDigestTime: '25:99' } });
    expect(patched.ok).toBe(false);
    const after = await repos.settings.get();
    expect(after.notifications.dailyDigestTime).toBe(before.notifications.dailyDigestTime);
  });

  it('patch() persists theme/accent and a valid digest time', async () => {
    const { repos } = await freshDb();
    const before = await repos.settings.get();
    const patched = await repos.settings.patch({
      theme: 'dark',
      accent: 'plum',
      notifications: { ...before.notifications, dailyDigestTime: '21:30' },
    });
    expect(patched.ok).toBe(true);
    const after = await repos.settings.get();
    expect(after.theme).toBe('dark');
    expect(after.accent).toBe('plum');
    expect(after.notifications.dailyDigestTime).toBe('21:30');
  });

  it('CR-2 — assistant voice/language default per migration 4 and survive a re-open (durable, not in-process)', async () => {
    const db = await freshDb();
    expect((await db.repos.settings.get()).assistant).toEqual({ language: 'en-US', voice: 'warm' });

    const patched = await db.repos.settings.patch({ assistant: { language: 'en-US', voice: 'direct' } });
    expect(patched.ok).toBe(true);

    // Re-open: a new client over the same database file, migrations re-run. The pre-CR-2
    // module-level state could not have survived this; a SQLite column does.
    await db.store.open();
    expect((await db.repos.settings.get()).assistant).toEqual({ language: 'en-US', voice: 'direct' });
    // And it did not disturb its neighbours on the singleton row.
    expect((await db.repos.settings.get()).notifications.dailyDigestTime).toBe('08:00');
  });
});

describe('ProgressRepository', () => {
  it('appendXpAward is idempotent per (task, date) — re-logging the same occurrence cannot farm XP', async () => {
    const { repos } = await freshDb();
    const task = buildTask();
    await repos.tasks.insert(task, []);
    const taskId = task.id;
    await repos.progress.appendXpAward({
      id: newId(),
      taskId,
      date: '2026-05-01' as never,
      kind: 'ideal',
      amount: 10,
      cycleId: 'cycle-1' as never,
      createdAt: '2026-05-01T00:00:00.000Z' as never,
    });
    // Downgrade to fallback on the same occurrence — updates in place, does not add a row.
    await repos.progress.appendXpAward({
      id: newId(),
      taskId,
      date: '2026-05-01' as never,
      kind: 'fallback',
      amount: 6,
      cycleId: 'cycle-1' as never,
      createdAt: '2026-05-01T00:00:00.000Z' as never,
    });
    expect(await repos.progress.lifetimeXp()).toBe(6);
    expect(await repos.progress.listXpAwards()).toHaveLength(1);
  });

  // CR-2 (docs/MODULES.md top matter, SCHEMA.md §7) — the only sanctioned reduction of
  // lifetime XP: an undone mis-tap on a live task.
  it('retractXpAward deletes the (task, date) award row and reduces lifetime XP', async () => {
    const { repos } = await freshDb();
    const task = buildTask();
    await repos.tasks.insert(task, []);
    await repos.progress.appendXpAward({
      id: newId(),
      taskId: task.id,
      date: '2026-05-02' as never,
      kind: 'ideal',
      amount: 10,
      cycleId: 'cycle-1' as never,
      createdAt: '2026-05-02T00:00:00.000Z' as never,
    });
    expect(await repos.progress.lifetimeXp()).toBe(10);

    const retracted = await repos.progress.retractXpAward(task.id, '2026-05-02' as never);
    expect(retracted.ok).toBe(true);
    expect(await repos.progress.lifetimeXp()).toBe(0);
    expect(await repos.progress.listXpAwards()).toHaveLength(0);
  });

  it('retractXpAward on a (task, date) with no award row is a no-op that still returns ok', async () => {
    const { repos } = await freshDb();
    const task = buildTask();
    await repos.tasks.insert(task, []);
    const result = await repos.progress.retractXpAward(task.id, '2026-05-03' as never);
    expect(result.ok).toBe(true);
  });

  // Review pass 2, non-blocking note 2: locks the STRUCTURAL guarantee that
  // `retractXpAward` can never match an orphaned NULL-task_id award, so a future refactor
  // cannot silently reintroduce level demotion via a deleted task's surviving XP. `WHERE
  // task_id = ? AND date = ?` never matches a NULL under SQL's own three-valued logic — the
  // guarantee holds even if a caller passes the ORIGINAL (now-stale) task id for that date.
  it('retractXpAward can never delete an orphaned (task_id = NULL) award — SQL NULL never equals a bound parameter', async () => {
    const { repos, store } = await freshDb();
    const task = buildTask();
    await repos.tasks.insert(task, []);
    await repos.progress.appendXpAward({
      id: newId(),
      taskId: task.id,
      date: '2026-05-04' as never,
      kind: 'ideal',
      amount: 10,
      cycleId: 'cycle-1' as never,
      createdAt: '2026-05-04T00:00:00.000Z' as never,
    });

    // Delete the task and let the hard sweep orphan its award (SCHEMA §2.3).
    await repos.tasks.softDelete(task.id);
    await store.open();
    const orphaned = await repos.progress.listXpAwards();
    expect(orphaned).toHaveLength(1);
    expect(orphaned[0]?.taskId).toBeNull();
    expect(await repos.progress.lifetimeXp()).toBe(10);

    // Calling retractXpAward with the STALE (pre-deletion) task id for that same date must
    // be a no-op — it cannot match a row whose task_id is now NULL.
    const retracted = await repos.progress.retractXpAward(task.id, '2026-05-04' as never);
    expect(retracted.ok).toBe(true);
    expect(await repos.progress.lifetimeXp()).toBe(10);
    expect(await repos.progress.listXpAwards()).toHaveLength(1);
  });
});
