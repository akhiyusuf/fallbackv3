/**
 * Mutation-testing survivors for `healXp.ts` (review/sonnet/32-mutation-testing.md). The start-up
 * repair had no test next to it: these pin what it adds, what it leaves alone and what it stamps.
 */
jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: jest.fn(() => {
      counter += 1;
      return `00000000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`;
    }),
  };
});

jest.mock('@/db', () => require('./testSupport/dbMock'));

jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  const { clock } = require('./testSupport/clockMock');
  return { ...actual, today: () => clock.today, now: () => clock.now };
});

import type { DayLog, Id, Instant, LocalDate, Step, TaskWithSteps } from '@/types';

import { healMissingXp } from './healXp';
import { fake, repos } from './testSupport/dbMock';
import { clock } from './testSupport/clockMock';

const d = (s: string) => s as LocalDate;

beforeEach(() => {
  fake.reset();
  clock.today = '2024-06-01';
  clock.now = '2024-06-01T12:00:00.000Z';
});

function makeTask(): TaskWithSteps {
  const id = 'heal-task' as TaskWithSteps['id'];
  const ideal: Step = { id: 'heal-ideal' as Step['id'], taskId: id, role: 'ideal', text: 'Do it', position: 0, dueWeekdays: null };
  const fallback: Step = { id: 'heal-fb' as Step['id'], taskId: id, role: 'fallback', text: 'Min', position: 0, dueWeekdays: null };
  return {
    id,
    type: 'routine',
    name: 'Walk',
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
    priorityRank: null,
    isNote: false,
    snoozable: true,
    createdAt: '2024-05-25T12:00:00.000Z' as Instant,
    updatedAt: '2024-05-25T12:00:00.000Z' as Instant,
    deletedAt: null,
    endedOn: null,
    idealSteps: [ideal],
    fallbackSteps: [fallback],
  } as TaskWithSteps;
}

async function logDay(task: TaskWithSteps, date: string, chip: DayLog['chipState']) {
  await repos.logs.upsert({
    id: `${task.id}-${date}` as DayLog['id'],
    taskId: task.id,
    date: d(date),
    chipState: chip,
    isManualOverride: true,
    completedStepIds: [],
    dosesCompleted: 0,
    movedToDate: null,
    createdAt: `${date}T10:00:00.000Z` as Instant,
    updatedAt: `${date}T10:00:00.000Z` as Instant,
  });
}

const pointer = {
  currentCycleId: 'cycle:monthly:2024-06-01' as Id,
  cadence: 'monthly' as const,
  startDate: d('2024-06-01'),
  endDate: d('2024-06-30'),
};

describe('healMissingXp mutation survivors', () => {
  test('H01: with no cycle pointer yet it adds nothing and says so', async () => {
    const task = makeTask();
    fake.seedTask(task);
    await logDay(task, '2024-05-28', 'done');
    expect(await healMissingXp(repos)).toBe(0);
    expect(fake.xpAwards()).toHaveLength(0);
  });

  test('H02/H06/H07/H08/H09/H10: adds each missing award with the right kind, amount and cycle, counts them, and only those', async () => {
    fake.seedCycleState(pointer);
    const task = makeTask();
    fake.seedTask(task);
    await logDay(task, '2024-05-27', 'done'); // already has its award, from an older cycle
    await logDay(task, '2024-05-28', 'done'); // missing
    await logDay(task, '2024-05-29', 'fallback'); // missing
    await logDay(task, '2024-05-30', 'skip'); // a skip resolves missed: never XP
    // 05-31 has no log (missed); today 06-01 has none (pending).
    await repos.progress.appendXpAward({
      id: 'old-award' as Id,
      taskId: task.id,
      date: d('2024-05-27'),
      kind: 'ideal',
      amount: 10,
      cycleId: 'cycle:monthly:2024-05-01' as Id,
      createdAt: '2024-05-27T12:00:00.000Z' as Instant,
    });

    expect(await healMissingXp(repos)).toBe(2);

    const awards = [...fake.xpAwards()].sort((a, b) => a.date.localeCompare(b.date));
    expect(awards.map((a) => [a.date, a.kind, a.amount, a.cycleId])).toEqual([
      ['2024-05-27', 'ideal', 10, 'cycle:monthly:2024-05-01'], // untouched: same id, same cycle
      ['2024-05-28', 'ideal', 10, 'cycle:monthly:2024-06-01'],
      ['2024-05-29', 'fallback', 6, 'cycle:monthly:2024-06-01'],
    ]);
    expect(awards[0]?.id).toBe('old-award');

    // Nothing is owed any more: a second run adds and counts nothing.
    expect(await healMissingXp(repos)).toBe(0);
    expect(fake.xpAwards()).toHaveLength(3);
  });

  test('H04: a day that already has its award is skipped, not re-stamped', async () => {
    fake.seedCycleState(pointer);
    const task = makeTask();
    fake.seedTask(task);
    await logDay(task, '2024-05-28', 'done');
    await repos.progress.appendXpAward({
      id: 'have' as Id,
      taskId: task.id,
      date: d('2024-05-28'),
      kind: 'ideal',
      amount: 10,
      cycleId: 'cycle:monthly:2024-05-01' as Id,
      createdAt: '2024-05-28T12:00:00.000Z' as Instant,
    });
    expect(await healMissingXp(repos)).toBe(0);
    expect(fake.xpAwards()[0]?.cycleId).toBe('cycle:monthly:2024-05-01');
  });
});
