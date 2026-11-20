/**
 * Migration 9: the day a task was created and deleted is stored as the device saw it at that
 * moment, so reading the record later in another time zone cannot move those days.
 */
import './testHarness';
import { newId } from '@/lib/id';
import { today } from '@/lib/date';
import type { Task } from '@/types';

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

function task(overrides: Partial<Task> = {}): Task {
  const at = '2026-01-01T12:00:00.000Z';
  return {
    id: newId(), type: 'routine', name: 'Walk', note: null, icon: 'Repeat', color: 'forge-orange', isAsNeeded: false,
    cadence: { kind: 'daily' }, eventDate: null, timeOfDay: null, startDate: null, endDate: null, dosesPerDay: 1,
    isTracked: true, importance: null, necessity: null, todoDoneAt: null, priorityRank: null, isNote: false,
    createdAt: at, updatedAt: at, deletedAt: null, snoozable: true, endedOn: null, ...overrides,
  } as Task;
}

describe('task.created_on / task.deleted_on (migration 9)', () => {
  it('insert stores the local creation day; a supplied day is kept as given', async () => {
    const { repos } = await freshDb();
    const a = task();
    const b = task({ createdOn: '2025-12-31' as never });
    await repos.tasks.insert(a, []);
    await repos.tasks.insert(b, []);
    expect((await repos.tasks.get(a.id))?.createdOn).toBe('2026-01-01');
    expect((await repos.tasks.get(b.id))?.createdOn).toBe('2025-12-31');
  });

  it('soft delete stores today as the deletion day; restore clears it; update keeps it', async () => {
    const { repos } = await freshDb();
    const a = task();
    await repos.tasks.insert(a, []);
    await repos.tasks.softDelete(a.id);
    expect((await repos.tasks.listDeleted())[0]?.deletedOn).toBe(today());
    await repos.tasks.update(a.id, { name: 'Long walk' });
    expect((await repos.tasks.get(a.id))?.deletedOn).toBe(today());
    await repos.tasks.restore(a.id);
    expect((await repos.tasks.get(a.id))?.deletedOn ?? null).toBeNull();
  });

  it('changing an instant through update re-derives its day unless the day is given too', async () => {
    const { repos } = await freshDb();
    const a = task();
    await repos.tasks.insert(a, []);
    await repos.tasks.softDelete(a.id);
    await repos.tasks.update(a.id, { deletedAt: '2000-01-01T12:00:00.000Z' as never });
    expect((await repos.tasks.get(a.id))?.deletedOn).toBe('2000-01-01');
    await repos.tasks.update(a.id, { createdAt: '1999-06-01T12:00:00.000Z' as never, createdOn: '1999-05-31' as never });
    expect((await repos.tasks.get(a.id))?.createdOn).toBe('1999-05-31');
  });

  it('a duplicate gets its own creation day, not the original one', async () => {
    const { repos } = await freshDb();
    const a = task({ createdOn: '2020-01-01' as never });
    await repos.tasks.insert(a, []);
    const copy = await repos.tasks.duplicate(a.id);
    expect(copy.ok).toBe(true);
    if (!copy.ok) return;
    expect((await repos.tasks.get(copy.value))?.createdOn).toBe(today());
  });
});
