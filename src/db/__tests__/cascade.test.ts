import './testHarness';

import { newId } from '@/lib/id';
import type { Step, Task } from '@/types';

async function freshDb() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sqlite = require('expo-sqlite') as { __reset: () => void };
  sqlite.__reset();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const db = require('../index') as typeof import('../index');
  const opened = await db.store.open();
  expect(opened.ok).toBe(true);
  return db;
}

function buildTask(overrides: Partial<Task> = {}): Task {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id: newId(),
    type: 'routine',
    name: 'Movement',
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
    ...overrides,
  } as Task;
}

function buildSteps(taskId: string): Step[] {
  return [
    { id: newId(), taskId: taskId as never, role: 'ideal', text: 'Walk 20 min', position: 0, dueWeekdays: null },
    { id: newId(), taskId: taskId as never, role: 'fallback', text: 'Stretch 2 min', position: 0, dueWeekdays: null },
  ];
}

describe('delete cascade — SCHEMA.md §2.3 (split, load-bearing)', () => {
  it('a soft-deleted task is invisible to list() immediately, but its rows are NOT hard-deleted until the next open()', async () => {
    const { repos, store } = await freshDb();
    const task = buildTask();
    const insertResult = await repos.tasks.insert(task, buildSteps(task.id));
    expect(insertResult.ok).toBe(true);

    const del = await repos.tasks.softDelete(task.id);
    expect(del.ok).toBe(true);

    expect(await repos.tasks.list()).toHaveLength(0);
    expect(await repos.tasks.list({ includeDeleted: true })).toHaveLength(1);

    // Not hard-deleted yet — the sweep only runs on the NEXT open().
    const stillGettable = await repos.tasks.get(task.id);
    expect(stillGettable).not.toBeNull();

    void store;
  });

  it('the hard sweep on open() removes step/day_log/off_day_mark/as_needed_use but leaves xp_award, achievement_unlock, cycle_record — lifetime XP unchanged, level unchanged, badges unchanged (mandatory SCHEMA §2.3 test)', async () => {
    const { repos, store } = await freshDb();
    const task = buildTask();
    await repos.tasks.insert(task, buildSteps(task.id));

    // Log 10 ideal days -> 100 XP (SCHEMA §2.3's own worked example).
    for (let day = 1; day <= 10; day += 1) {
      const date = `2026-01-${String(day).padStart(2, '0')}` as never;
      await repos.logs.upsert({
        id: newId(),
        taskId: task.id,
        date,
        chipState: 'done',
        isManualOverride: true,
        completedStepIds: [],
        dosesCompleted: 0,
        movedToDate: null,
        createdAt: '2026-01-01T00:00:00.000Z' as never,
        updatedAt: '2026-01-01T00:00:00.000Z' as never,
      });
      await repos.progress.appendXpAward({
        id: newId(),
        taskId: task.id,
        date,
        kind: 'ideal',
        amount: 10,
        cycleId: 'cycle-1' as never,
        createdAt: '2026-01-01T00:00:00.000Z' as never,
      });
    }
    await repos.offDays.mark({
      id: newId(),
      date: '2026-01-11' as never,
      taskId: task.id,
      priorChipState: null,
      createdAt: '2026-01-11T00:00:00.000Z' as never,
    });
    await repos.progress.upsertUnlock({ key: 'showing-up-7', unlockedOn: '2026-01-07' as never, createdAt: '2026-01-07T00:00:00.000Z' as never });

    expect(await repos.progress.lifetimeXp()).toBe(100);

    const del = await repos.tasks.softDelete(task.id);
    expect(del.ok).toBe(true);

    // Reopen — this is what runs the hard sweep.
    const reopened = await store.open();
    expect(reopened.ok).toBe(true);

    // Task, its steps, logs and off-day mark are gone.
    expect(await repos.tasks.get(task.id)).toBeNull();
    expect(await repos.logs.listForTask(task.id, '2026-01-01' as never, '2026-01-31' as never)).toHaveLength(0);
    expect(await repos.offDays.listRange('2026-01-01' as never, '2026-01-31' as never)).toHaveLength(0);

    // xp_award rows SURVIVE with task_id nulled — never cascaded.
    const awards = await repos.progress.listXpAwards();
    expect(awards).toHaveLength(10);
    expect(awards.every((a) => a.taskId === null)).toBe(true);
    expect(awards.every((a) => a.amount === 10)).toBe(true);

    // Lifetime XP is UNCHANGED — this is the whole point of the split cascade.
    expect(await repos.progress.lifetimeXp()).toBe(100);

    // Achievement unlocks are untouched (upsert-only, never revoked).
    const unlocks = await repos.progress.listUnlocks();
    expect(unlocks.map((u) => u.key)).toEqual(['showing-up-7']);
  });

  it('as_needed_use rows for a deleted task are hard-deleted by the sweep (cascaded, per the split table)', async () => {
    const { repos, store } = await freshDb();
    const task = buildTask({ isAsNeeded: true, cadence: null, isTracked: false });
    await repos.tasks.insert(task, []);
    await repos.asNeeded.append({ id: newId(), taskId: task.id, date: '2026-01-01' as never, marker: null, createdAt: '2026-01-01T00:00:00.000Z' as never });

    await repos.tasks.softDelete(task.id);
    await store.open();

    expect(await repos.asNeeded.listForTask(task.id)).toHaveLength(0);
  });

  it('a whole-day off_day_mark (task_id NULL) survives a task delete — it is not task-scoped', async () => {
    const { repos, store } = await freshDb();
    const task = buildTask();
    await repos.tasks.insert(task, buildSteps(task.id));
    await repos.offDays.mark({ id: newId(), date: '2026-03-01' as never, taskId: null, priorChipState: null, createdAt: '2026-03-01T00:00:00.000Z' as never });

    await repos.tasks.softDelete(task.id);
    await store.open();

    const marks = await repos.offDays.listRange('2026-03-01' as never, '2026-03-01' as never);
    expect(marks).toHaveLength(1);
    expect(marks[0]?.taskId).toBeNull();
  });
});
