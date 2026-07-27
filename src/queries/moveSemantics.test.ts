/**
 * ADVICE-M2.md Ruling 1 — the eight named test cases C1-C8, each driven end-to-end through
 * the real hooks + real reads (never through `src/domain` internals directly), per the
 * advisor's explicit requirement. Conventions (mocks, `rh`, `makeWrapper`, `makeTask`) mirror
 * `mutations.test.ts` exactly; duplicated rather than imported so this file stays a
 * self-contained, independently-mockable Jest module (jest.mock calls are file-scoped).
 */
jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: jest.fn(() => {
      counter += 1;
      return `10000000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`;
    }),
  };
});

jest.mock('@/db', () => require('./testSupport/dbMock'));

jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  const { clock } = require('./testSupport/clockMock');
  return { ...actual, today: () => clock.today, now: () => clock.now };
});

import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { on } from '@/lib/events';
import type { AppEvent, Instant, LocalDate, Step, TaskWithSteps, Weekday } from '@/types';

import { fake } from './testSupport/dbMock';
import { clock } from './testSupport/clockMock';
import { useLogState, useMoveOccurrence } from './mutations';
import { useTaskOccurrences } from './reads';

function makeWrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => React.createElement(QueryClientProvider, { client }, children);
}
function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false, refetchOnMount: true },
      mutations: { retry: false },
    },
  });
}
const activeUnmounts: Array<() => void> = [];
const activeClients: QueryClient[] = [];
async function rh<T>(hook: () => T, client: QueryClient): ReturnType<typeof renderHook<T, undefined>> {
  activeClients.push(client);
  const r = await renderHook(hook, { wrapper: makeWrapper(client) });
  activeUnmounts.push(r.unmount);
  return r;
}
afterEach(async () => {
  await act(async () => {
    activeUnmounts.forEach((fn) => fn());
  });
  activeUnmounts.length = 0;
  activeClients.forEach((c) => c.clear());
  activeClients.length = 0;
});

let idCounter = 0;
function makeTask(overrides: Partial<TaskWithSteps> = {}): TaskWithSteps {
  idCounter += 1;
  const id = (overrides.id ?? `task-${idCounter}`) as TaskWithSteps['id'];
  const idealStep: Step = { id: `${id}-ideal` as Step['id'], taskId: id, role: 'ideal', text: 'Do it', position: 0, dueWeekdays: null };
  const fallbackStep: Step = { id: `${id}-fallback` as Step['id'], taskId: id, role: 'fallback', text: 'Min version', position: 0, dueWeekdays: null };
  const base: TaskWithSteps = {
    id,
    type: 'routine',
    name: 'Test task',
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
    createdAt: '2024-05-01T00:00:00.000Z' as Instant,
    updatedAt: '2024-05-01T00:00:00.000Z' as Instant,
    deletedAt: null,
    idealSteps: [idealStep],
    fallbackSteps: [fallbackStep],
  };
  return { ...base, ...overrides, id };
}

// D1..D5 — the same 5-date domain ADVICE-M2.md's Ruling 2 harness enumerates over. D1 = Monday,
// D3 = Wednesday.
const D1 = '2024-06-03' as LocalDate; // Mon
const D2 = '2024-06-04' as LocalDate; // Tue
const D3 = '2024-06-05' as LocalDate; // Wed
const D4 = '2024-06-06' as LocalDate; // Thu
const D5 = '2024-06-07' as LocalDate; // Fri
const D6 = '2024-06-08' as LocalDate; // Sat — "today", after every date in the domain

beforeEach(() => {
  fake.reset();
  idCounter = 0;
  clock.today = D6;
  clock.now = `${D6}T12:00:00.000Z` as Instant;
});

async function occOn(taskId: TaskWithSteps['id'], date: LocalDate, client: QueryClient) {
  const { result } = await rh(() => useTaskOccurrences(taskId, { from: date, to: date }), client);
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  return (result.current.data ?? []).find((o) => o.date === date);
}

/**
 * `resolveTaskOccurrences` (`src/queries/internal.ts`) only materialises a date that is
 * naturally due OR has a moved-in record — a genuinely off-cadence, un-visited date is simply
 * absent from a read's result set (nothing to show), not present with `outcome: 'not-due'`.
 * Both are the same fact from the caller's perspective ("nothing due here"); this helper
 * asserts that fact regardless of which form it takes.
 */
function expectNotDue(occ: { outcome: string } | undefined): void {
  expect(occ === undefined || occ.outcome === 'not-due').toBe(true);
}

describe('C1 — undo: A -> B -> A restores A exactly, B reverts to not-due', () => {
  test('a logged occurrence moved away and back round-trips its data and its XP', async () => {
    const task = makeTask({ cadence: { kind: 'specific-weekdays', weekdays: [1] as Weekday[] } }); // D1 only
    fake.seedTask(task);
    const client = freshClient();

    const { result: logResult } = await rh(() => useLogState(), client);
    await act(async () => {
      await logResult.current.mutateAsync({ taskId: task.id, date: D1, chip: 'done' });
    });
    expect(fake.xpAwards()).toHaveLength(1);

    const { result: moveResult } = await rh(() => useMoveOccurrence(), client);
    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: D1, toDate: D2 });
    });
    expect((await occOn(task.id, D1, client))?.outcome).toBe('not-due');
    expect((await occOn(task.id, D2, client))?.outcome).toBe('ideal'); // D2 is off-cadence naturally, due only via the moved-in record
    expect(fake.xpAwards()).toHaveLength(1);
    expect(fake.xpAwards()[0]!.date).toBe(D2);

    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: D2, toDate: D1 }); // undo
    });

    const restoredA = await occOn(task.id, D1, client);
    expect(restoredA?.outcome).toBe('ideal'); // the original chip data is back
    expect(restoredA?.chipState).toBe('done');
    expectNotDue(await occOn(task.id, D2, client)); // fully reverted, no residue left visible
    expect(fake.xpAwards()).toHaveLength(1);
    expect(fake.xpAwards()[0]!.date).toBe(D1); // XP followed the data back

    // Structural check: exactly one log row, own pointer cleared.
    expect(fake.logsFor(task.id)).toHaveLength(1);
    expect(fake.logsFor(task.id)[0]!.movedToDate).toBeNull();
  });
});

describe('C2 — A -> A is a true no-op (W-0)', () => {
  test('zero writes, zero events, occurrence unchanged', async () => {
    const task = makeTask({ cadence: { kind: 'daily' } });
    fake.seedTask(task);
    const client = freshClient();

    const { result: logResult } = await rh(() => useLogState(), client);
    await act(async () => {
      await logResult.current.mutateAsync({ taskId: task.id, date: D1, chip: 'fallback' });
    });
    const rowsBefore = fake.logsFor(task.id);
    const xpBefore = fake.xpAwards();

    const events: AppEvent[] = [];
    const off = on('day:logged', (e) => events.push(e));

    const { result: moveResult } = await rh(() => useMoveOccurrence(), client);
    let outcome: unknown;
    await act(async () => {
      outcome = await moveResult.current.mutateAsync({ taskId: task.id, fromDate: D1, toDate: D1 });
    });
    const res = outcome as { ok: true; value: { occurrence: { outcome: string } } };
    expect(res.ok).toBe(true);
    expect(res.value.occurrence.outcome).toBe('fallback');
    expect(events).toHaveLength(0); // no `day:logged` for a no-op move
    expect(fake.logsFor(task.id)).toEqual(rowsBefore);
    expect(fake.xpAwards()).toEqual(xpBefore);
    off();
  });
});

describe('C3 — chain collapse: A -> B, then B -> C leaves exactly one pointer A -> C', () => {
  test('the intermediate hop B never appears as a stored target', async () => {
    const task = makeTask({ cadence: { kind: 'daily' } });
    fake.seedTask(task);
    const client = freshClient();
    const { result: moveResult } = await rh(() => useMoveOccurrence(), client);

    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: D1, toDate: D2 });
    });
    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: D2, toDate: D3 });
    });

    const rows = fake.logsFor(task.id);
    expect(rows).toHaveLength(1); // ownLog(B) was never created — only F's own row ever existed
    expect(rows[0]!.date).toBe(D1);
    expect(rows[0]!.movedToDate).toBe(D3); // collapsed directly, not through B

    expect((await occOn(task.id, D1, client))?.outcome).toBe('not-due');
    // B (daily cadence) is still naturally due on its own account — the move never removes B's
    // own due-ness, it only determines what DATA resolves there. Since no visitor's row is
    // aimed at B anymore (collapsed straight through to C) and B was never itself logged, B
    // resolves via its own (empty) history — never as 'ideal' (which would mean it had
    // inherited A's data, the exact bug this case guards against).
    expect((await occOn(task.id, D2, client))?.outcome).not.toBe('ideal');
    expect((await occOn(task.id, D3, client))?.outcome).not.toBe('not-due');
  });

  test('the distance guard is measured from the pointer-carrying row (A), not from the redirect call site (B)', async () => {
    const task = makeTask({ cadence: { kind: 'daily' }, createdAt: '2023-01-01T00:00:00.000Z' as Instant });
    fake.seedTask(task);
    const client = freshClient();
    const { result: moveResult } = await rh(() => useMoveOccurrence(), client);

    const A = '2024-01-01' as LocalDate;
    const B = '2024-02-20' as LocalDate; // 50 days from A — within the 60-day pad
    const C = '2024-05-30' as LocalDate; // 50 days from B, but ~150 days from A — outside the pad from A

    clock.today = '2024-06-01' as LocalDate;
    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: A, toDate: B });
    });

    let outcome: unknown;
    await act(async () => {
      outcome = await moveResult.current.mutateAsync({ taskId: task.id, fromDate: B, toDate: C });
    });
    const res = outcome as { ok: false; error: { code: string } };
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('VALIDATION_FAILED'); // rejected — the guard measured from A, the carrier row

    // Structural confirmation: A's pointer is untouched (still points at B, the rejected move never wrote).
    expect(fake.logsFor(task.id)[0]!.movedToDate).toBe(B);
  });
});

describe('C4 / C4r — merge (A -> B where B is naturally due) and un-merge (B -> A)', () => {
  test('C4: B is unaffected by A merging in — B\'s own live log wins, A becomes residue', async () => {
    const task = makeTask({ cadence: { kind: 'daily' } });
    fake.seedTask(task);
    const client = freshClient();

    // B already has genuine, non-moved data of its own.
    const { result: logResult } = await rh(() => useLogState(), client);
    await act(async () => {
      await logResult.current.mutateAsync({ taskId: task.id, date: D2, chip: 'fallback' });
    });
    expect((await occOn(task.id, D2, client))?.outcome).toBe('fallback');

    const { result: moveResult } = await rh(() => useMoveOccurrence(), client);
    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: D1, toDate: D2 });
    });

    expect((await occOn(task.id, D1, client))?.outcome).toBe('not-due'); // A vacated
    const b = await occOn(task.id, D2, client);
    expect(b?.outcome).toBe('fallback'); // B's own data, completely unchanged by the merge
    expect(b?.chipState).toBe('fallback');
  });

  test('C4r: B -> A afterwards is an exact restore — A comes back, B still untouched', async () => {
    const task = makeTask({ cadence: { kind: 'daily' } });
    fake.seedTask(task);
    const client = freshClient();
    const { result: logResult } = await rh(() => useLogState(), client);
    await act(async () => {
      await logResult.current.mutateAsync({ taskId: task.id, date: D2, chip: 'fallback' });
    });
    const { result: moveResult } = await rh(() => useMoveOccurrence(), client);
    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: D1, toDate: D2 });
    });

    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: D2, toDate: D1 }); // un-merge
    });

    const a = await occOn(task.id, D1, client);
    expect(a?.outcome).not.toBe('not-due'); // A is due again (daily cadence, never logged -> pending/missed, but never vacated)
    const b = await occOn(task.id, D2, client);
    expect(b?.outcome).toBe('fallback'); // still exactly B's own data, never touched by either move
    expect(fake.logsFor(task.id).find((r) => r.date === D1)?.movedToDate).toBeNull();
  });
});

describe('C5 — merge then move the visitor away (B -> C): B keeps its own identity (LIFO)', () => {
  test('after A merges into B, moving "B" again redirects the VISITOR (A), not B\'s own occurrence', async () => {
    const task = makeTask({ cadence: { kind: 'daily' } });
    fake.seedTask(task);
    const client = freshClient();
    const { result: logResult } = await rh(() => useLogState(), client);
    await act(async () => {
      await logResult.current.mutateAsync({ taskId: task.id, date: D2, chip: 'fallback' });
    });
    const { result: moveResult } = await rh(() => useMoveOccurrence(), client);
    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: D1, toDate: D2 }); // A merges into B
    });

    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: D2, toDate: D3 }); // "move B" — LIFO: redirects A's visit
    });

    const b = await occOn(task.id, D2, client);
    expect(b?.outcome).toBe('fallback'); // B's own occurrence NEVER moved — still due, right here
    const aRow = fake.logsFor(task.id).find((r) => r.date === D1)!;
    expect(aRow.movedToDate).toBe(D3); // the visitor (A) is what got redirected
    const c = await occOn(task.id, D3, client);
    expect(c?.outcome).not.toBe('not-due'); // C now carries A's data
  });
});

describe('C6 — a task due on both A and B: B -> C, then A -> B. A resolves DUE at B via the moved-in record.', () => {
  test('B\'s own outbound residue pointer does not annihilate A\'s arrival', async () => {
    const task = makeTask({ cadence: { kind: 'specific-weekdays', weekdays: [1, 2] as Weekday[] } }); // D1 (Mon) and D2 (Tue)
    fake.seedTask(task);
    const client = freshClient();
    const { result: moveResult } = await rh(() => useMoveOccurrence(), client);

    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: D2, toDate: D3 }); // B -> C first
    });
    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: D1, toDate: D2 }); // A -> B second
    });

    const b = await occOn(task.id, D2, client);
    expect(b?.outcome).not.toBe('not-due'); // NOT annihilated by B's own outbound residue
    const c = await occOn(task.id, D3, client);
    expect(c?.outcome).not.toBe('not-due'); // B's own occurrence is still live, now landed at C
    expect((await occOn(task.id, D1, client))?.outcome).toBe('not-due'); // A itself vacated
  });
});

describe('C7 — move, complete at the target, then undo: the completed data stays with the target as dormant residue (D-rule)', () => {
  test('undo restores A to its pre-move (unlogged) state; the target\'s completed data is not deleted, just no longer due', async () => {
    const task = makeTask({ cadence: { kind: 'specific-weekdays', weekdays: [1] as Weekday[] } }); // D1 only — D2 off-cadence
    fake.seedTask(task);
    const client = freshClient();
    const { result: moveResult } = await rh(() => useMoveOccurrence(), client);
    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: D1, toDate: D2 });
    });

    const { result: logResult } = await rh(() => useLogState(), client);
    await act(async () => {
      await logResult.current.mutateAsync({ taskId: task.id, date: D2, chip: 'done' });
    });
    expect((await occOn(task.id, D2, client))?.outcome).toBe('ideal');
    expect(fake.xpAwards()).toHaveLength(1);

    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: D2, toDate: D1 }); // undo
    });

    const a = await occOn(task.id, D1, client);
    expect(a?.outcome).not.toBe('ideal'); // A did NOT inherit B's completed state — it's restored to its own (unlogged) history
    expectNotDue(await occOn(task.id, D2, client)); // off-cadence, and no longer fed by a moved-in record
    expect(fake.xpAwards()).toHaveLength(0); // the now-not-due B is not XP-eligible; the award was retracted (CR-2)

    // D-rule: B's own row (with its completed data) still physically exists — dormant, not deleted.
    const bRow = fake.logsFor(task.id).find((r) => r.date === D2);
    expect(bRow).toBeDefined();
    expect(bRow!.chipState).toBe('done');
    expect(bRow!.movedToDate).toBeNull();
  });
});

describe('C8 — double inbound merge: two sources land on the same target; the display tie-breaks to the LATER source date', () => {
  test('both A1 and A2 vacate; B shows A2\'s data (A2 > A1); a further move on B redirects BOTH inbound rows', async () => {
    const task = makeTask({ cadence: { kind: 'daily' } });
    fake.seedTask(task);
    const client = freshClient();
    const A1 = D1;
    const A2 = D2;
    const B = D4;

    const { result: logResult } = await rh(() => useLogState(), client);
    await act(async () => {
      await logResult.current.mutateAsync({ taskId: task.id, date: A1, chip: 'fallback' });
    });
    await act(async () => {
      await logResult.current.mutateAsync({ taskId: task.id, date: A2, chip: 'done' });
    });

    const { result: moveResult } = await rh(() => useMoveOccurrence(), client);
    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: A1, toDate: B });
    });
    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: A2, toDate: B });
    });

    expect((await occOn(task.id, A1, client))?.outcome).toBe('not-due');
    expect((await occOn(task.id, A2, client))?.outcome).toBe('not-due');
    const b = await occOn(task.id, B, client);
    expect(b?.outcome).toBe('ideal'); // A2 ('done') is the later source date — it wins the display tie-break, not A1 ('fallback')

    // The WRITE side is not tie-broken: redirecting B moves BOTH inbound rows, not just the displayed one.
    const C = D5;
    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: B, toDate: C });
    });
    const rows = fake.logsFor(task.id);
    expect(rows.find((r) => r.date === A1)?.movedToDate).toBe(C);
    expect(rows.find((r) => r.date === A2)?.movedToDate).toBe(C);
  });
});
