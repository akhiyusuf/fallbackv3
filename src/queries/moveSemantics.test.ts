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

  test('C4b (ADVICE-M2.md Supplement A, S1): A -> B where B is naturally due and NEVER logged — B keeps its own BLANK state; a completed visitor mints NO XP award at B', async () => {
    const task = makeTask({ cadence: { kind: 'daily' } });
    fake.seedTask(task);
    const client = freshClient();

    // A is COMPLETED before the move — this is the exact shape Supplement A's rationale names:
    // moving a completed occurrence onto an unlogged natural due date must never mint an
    // outcome, and must never mint XP, off the imported chip.
    const { result: logResult } = await rh(() => useLogState(), client);
    await act(async () => {
      await logResult.current.mutateAsync({ taskId: task.id, date: D1, chip: 'done' });
    });
    expect(fake.xpAwards()).toHaveLength(1);
    expect(await fake.repos.progress.lifetimeXp()).toBe(10);

    const { result: moveResult } = await rh(() => useMoveOccurrence(), client);
    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: D1, toDate: D2 });
    });

    expect((await occOn(task.id, D1, client))?.outcome).toBe('not-due'); // A vacated

    const b = await occOn(task.id, D2, client);
    expect(b?.outcome).not.toBe('ideal'); // B never inherits the completed visitor's outcome
    expect(b?.chipState).not.toBe('done'); // and never its chip either — B's OWN blank state, per clause (b)

    // The explicit no-award assertion — this is the entire point of C4b, not decoration.
    expect(fake.xpAwards()).toHaveLength(0); // A's award was retracted (CR-2, now-vacated source); NOTHING was minted at B
    expect(await fake.repos.progress.lifetimeXp()).toBe(0);

    // B -> A afterwards restores A with its prior data and re-affirms its award, per C1/C4r
    // mechanics — the visitor's data was dormant at its source the whole time (D-rule), not
    // lost.
    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: D2, toDate: D1 });
    });
    const a = await occOn(task.id, D1, client);
    expect(a?.outcome).toBe('ideal');
    expect(a?.chipState).toBe('done');
    expect(fake.xpAwards()).toHaveLength(1);
    expect(await fake.repos.progress.lifetimeXp()).toBe(10);
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

describe('C7 — move, complete at the target, then undo: the completion travels WITH the moved occurrence (ADVICE-M2.md Supplement B, T-2)', () => {
  test('a tap on the visiting occurrence writes to A\'s OWN row (the visitor), preserving its pointer — not a fresh row fabricated at B; undo brings the completion back with it', async () => {
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
    expect(fake.xpAwards()[0]!.date).toBe(D2); // XP is about the occurrence the user tapped (T-3 keys on D)

    // Supplement B, T-2: B is a non-natural date whose only occurrence is the moved-in
    // visitor (A) — the write lands on A's OWN row, at A's own date, preserving A's pointer.
    // Exactly ONE row exists; it is NOT keyed at B.
    const rows = fake.logsFor(task.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.date).toBe(D1);
    expect(rows[0]!.chipState).toBe('done');
    expect(rows[0]!.movedToDate).toBe(D2); // the pointer is preserved, not cleared by the write

    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: D2, toDate: D1 }); // undo
    });

    // The completion travels home WITH the occurrence — this is the corrected behaviour F1
    // exists to guarantee: a tap is about the occurrence, not the date it happened to be
    // showing at.
    const a = await occOn(task.id, D1, client);
    expect(a?.outcome).toBe('ideal');
    expect(a?.chipState).toBe('done');
    expectNotDue(await occOn(task.id, D2, client)); // off-cadence, and no longer fed by a moved-in record
    expect(fake.xpAwards()).toHaveLength(1); // re-affirmed at A, not lost, not duplicated
    expect(fake.xpAwards()[0]!.date).toBe(D1);
    expect(fake.logsFor(task.id)).toHaveLength(1);
    expect(fake.logsFor(task.id)[0]!.movedToDate).toBeNull();
  });
});

describe('C8 — double inbound merge: two sources land on the same target; the display tie-breaks to the LATER source date', () => {
  test('both A1 and A2 vacate; B shows A2\'s data (A2 > A1); a further move on B redirects BOTH inbound rows', async () => {
    // B (D4) is deliberately OFF-cadence here, so the visitor is the only occurrence present
    // and the tie-break (Supplement A's reworded C8 data clause, third arm: "else
    // latest-source moved-in") is actually what's under test — B being naturally due would
    // instead exercise clause (b)'s merge-keeps-blank-state rule, which is a different case
    // (see C4b).
    const task = makeTask({ cadence: { kind: 'specific-weekdays', weekdays: [1, 2] as Weekday[] } }); // D1, D2 only
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

describe('C9 (ADVICE-M2.md Supplement B, the discovered shape): due {A,B}; B->C; A->B; tap on B lands on the visitor (A), residue (B) byte-unchanged', () => {
  test('the tap is visible at B, its data lives on A\'s row with A\'s pointer intact, and B\'s residue is untouched — then the un-move shadow retracts and revives correctly', async () => {
    const task = makeTask({ cadence: { kind: 'specific-weekdays', weekdays: [1, 2] as Weekday[] } }); // A (D1), B (D2) both due; C (D3) not due
    fake.seedTask(task);
    const client = freshClient();
    const { result: moveResult } = await rh(() => useMoveOccurrence(), client);

    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: D2, toDate: D3 }); // B -> C
    });
    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: D1, toDate: D2 }); // A -> B
    });

    const bResidueBefore = fake.logsFor(task.id).find((r) => r.date === D2)!;
    expect(bResidueBefore.movedToDate).toBe(D3); // B is residue, pointing onward to C

    const { result: logResult } = await rh(() => useLogState(), client);
    await act(async () => {
      await logResult.current.mutateAsync({ taskId: task.id, date: D2, chip: 'done' }); // tap on B
    });

    // Tap VISIBLE at B — outcome per the tap, XP keyed on (task, B) (T-3: reconcile/emit key on
    // D, the tapped date, regardless of where the data physically lives).
    const b = await occOn(task.id, D2, client);
    expect(b?.outcome).toBe('ideal');
    expect(fake.xpAwards()).toHaveLength(1);
    expect(fake.xpAwards()[0]!.date).toBe(D2);

    // The write landed on A's row (the visitor) — its pointer is INTACT (still -> B), not
    // cleared or redirected by the tap.
    const aRow = fake.logsFor(task.id).find((r) => r.date === D1)!;
    expect(aRow.chipState).toBe('done');
    expect(aRow.movedToDate).toBe(D2);

    // Residue ownLog(B) is byte-unchanged by the tap.
    const bResidueAfter = fake.logsFor(task.id).find((r) => r.date === D2)!;
    expect(bResidueAfter).toEqual(bResidueBefore);

    // C -> B: B's own occurrence returns (un-move). It resolves by its own UNCORRUPTED
    // dormant data (never touched by the tap) — blank auto chip, pending/missed, no award. No
    // phantom completion leaks in from the visitor that was shadowing it.
    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: D3, toDate: D2 });
    });
    const bReturned = await occOn(task.id, D2, client);
    expect(bReturned?.outcome).not.toBe('ideal');
    expect(bReturned?.chipState).not.toBe('done');

    // Semantic note (Supplement A/B, pinned so a later reviewer doesn't mistake this for a
    // bug): the visitor's award at B is retracted here — the resolved occurrence at B stopped
    // carrying a showing-up state the moment B's own (blank) occurrence shadowed it. This is
    // the merge doctrine's SANCTIONED transient retraction (CR-2), not value loss — the data
    // is still on A's row and fully recoverable by A's own un-move, asserted next.
    expect(fake.xpAwards()).toHaveLength(0);

    // B -> A afterwards: the visitor's tapped data revives at A, award re-affirmed.
    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: D2, toDate: D1 });
    });
    const a = await occOn(task.id, D1, client);
    expect(a?.outcome).toBe('ideal');
    expect(a?.chipState).toBe('done');
    expect(fake.xpAwards()).toHaveLength(1);
    expect(fake.xpAwards()[0]!.date).toBe(D1);
  });
});

describe('C10 (ADVICE-M2.md Supplement B): a write on a vacated source date is rejected, and the source\'s data survives uncorrupted', () => {
  test('A->B, then any occurrence-data write on A -> VALIDATION_FAILED, zero writes, zero events, zero XP delta; a later un-move revives A exactly as pre-move', async () => {
    const task = makeTask({ cadence: { kind: 'daily' } });
    fake.seedTask(task);
    const client = freshClient();

    const { result: logResult } = await rh(() => useLogState(), client);
    await act(async () => {
      await logResult.current.mutateAsync({ taskId: task.id, date: D1, chip: 'fallback' }); // A has prior data
    });
    const { result: moveResult } = await rh(() => useMoveOccurrence(), client);
    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: D1, toDate: D2 });
    });

    const aRowBefore = fake.logsFor(task.id).find((r) => r.date === D1)!;
    const xpBefore = await fake.repos.progress.lifetimeXp();

    const events: AppEvent[] = [];
    const offDayLogged = on('day:logged', (e) => events.push(e));
    const offXpAwarded = on('xp:awarded', (e) => events.push(e));

    let outcome: unknown;
    await act(async () => {
      outcome = await logResult.current.mutateAsync({ taskId: task.id, date: D1, chip: 'done' }); // T-1: A is a vacated source
    });
    const res = outcome as { ok: false; error: { code: string } };
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('VALIDATION_FAILED');
    expect(events).toHaveLength(0); // zero events

    const aRowAfter = fake.logsFor(task.id).find((r) => r.date === D1)!;
    expect(aRowAfter).toEqual(aRowBefore); // byte-identical — the rejected write touched nothing
    expect(await fake.repos.progress.lifetimeXp()).toBe(xpBefore); // zero XP delta

    offDayLogged();
    offXpAwarded();

    // A later un-move revives A exactly as pre-move (its ORIGINAL 'fallback' data, never the
    // rejected 'done' tap, which never wrote anywhere).
    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: D2, toDate: D1 });
    });
    const a = await occOn(task.id, D1, client);
    expect(a?.outcome).toBe('fallback');
    expect(a?.chipState).toBe('fallback');
  });
});

describe('C11 (ADVICE-M2.md Supplement B): a write on a rowless not-due date is rejected, and no row is fabricated for a later move-in to adopt', () => {
  test('VALIDATION_FAILED, zero writes; a subsequent move-in to that same date is NOT hijacked by a fabricated row', async () => {
    const task = makeTask({ cadence: { kind: 'specific-weekdays', weekdays: [1] as Weekday[] } }); // D1 only — D2 is rowless and not due
    fake.seedTask(task);
    const client = freshClient();
    const { result: logResult } = await rh(() => useLogState(), client);

    let outcome: unknown;
    await act(async () => {
      outcome = await logResult.current.mutateAsync({ taskId: task.id, date: D2, chip: 'done' });
    });
    const res = outcome as { ok: false; error: { code: string } };
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('VALIDATION_FAILED');
    expect(fake.logsFor(task.id)).toHaveLength(0); // no row fabricated

    // A later move-in to D2 must resolve via the VISITOR clause (c), not a phantom clause-(a)
    // own-live row the rejected write might otherwise have left behind.
    const { result: moveResult } = await rh(() => useMoveOccurrence(), client);
    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: D1, toDate: D2 });
    });
    expect(fake.logsFor(task.id)).toHaveLength(1); // exactly the move's own write — nothing left over from the rejection
    const d2 = await occOn(task.id, D2, client);
    expect(d2?.outcome).not.toBe('ideal'); // no phantom 'done' from the earlier rejected write
    expect(d2?.chipState).not.toBe('done');
  });
});
