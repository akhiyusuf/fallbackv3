/**
 * `docs/SCHEMA.md` §4.2 (F7 one-hop snooze, PRD §3.7) — the required named case table,
 * C1/C4/C4b/C4r/C5/C6/C7/C9/C10/C11/C12/C13/C14, each driven end-to-end through the real
 * hooks + real reads (never through `src/domain` internals directly).
 *
 * Replaces the pre-rescope `useMoveOccurrence(taskId, fromDate, toDate)` arbitrary-target
 * suite. Dead per SCHEMA §4.2's case-ID mapping and deliberately NOT reintroduced: C2 (target
 * is computed — source and target can never coincide), C3 (a chain — unreachable once a
 * snoozed occurrence can't be re-snoozed), C8 (`D -> D+1` is injective, so two source dates of
 * the SAME task can never reach one target). C5 survives with INVERTED content (merge-then-
 * vacate, dormant visitor REVIVES — the old LIFO/"stays buried" reading is dead).
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
import { useLogState, useSnoozeOccurrence, useUndoSnooze } from './mutations';
import { useConsistency, useTaskOccurrences } from './reads';

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
    snoozable: true,
    createdAt: '2024-05-01T00:00:00.000Z' as Instant,
    updatedAt: '2024-05-01T00:00:00.000Z' as Instant,
    deletedAt: null,
    idealSteps: [idealStep],
    fallbackSteps: [fallbackStep],
  };
  return { ...base, ...overrides, id };
}

// D1..D5 — a small consecutive-date domain. D1 = Monday, D3 = Wednesday.
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
 * `resolveTaskOccurrences` only materialises a date that is naturally due OR has a moved-in
 * record — a genuinely off-cadence, un-visited date is simply absent from a read's result set,
 * not present with `outcome: 'not-due'`. Both are the same fact from the caller's perspective.
 */
function expectNotDue(occ: { outcome: string } | undefined): void {
  expect(occ === undefined || occ.outcome === 'not-due').toBe(true);
}

async function snooze(client: QueryClient, taskId: TaskWithSteps['id'], date: LocalDate) {
  const { result } = await rh(() => useSnoozeOccurrence(), client);
  let outcome: unknown;
  await act(async () => {
    outcome = await result.current.mutateAsync({ taskId, date });
  });
  return outcome;
}

async function undo(client: QueryClient, taskId: TaskWithSteps['id'], date: LocalDate) {
  const { result } = await rh(() => useUndoSnooze(), client);
  let outcome: unknown;
  await act(async () => {
    outcome = await result.current.mutateAsync({ taskId, date });
  });
  return outcome;
}

async function log(client: QueryClient, taskId: TaskWithSteps['id'], date: LocalDate, chip: 'done' | 'fallback' | 'skip' | 'todo') {
  const { result } = await rh(() => useLogState(), client);
  let outcome: unknown;
  await act(async () => {
    outcome = await result.current.mutateAsync({ taskId, date, chip });
  });
  return outcome;
}

describe('C1 — snooze D, then undo: exact restore', () => {
  test('D comes back with its prior chip data and re-affirmed award; D + 1 reverts; no pointer anywhere', async () => {
    const task = makeTask({ cadence: { kind: 'specific-weekdays', weekdays: [1] as Weekday[] } }); // D1 only
    fake.seedTask(task);
    const client = freshClient();

    await log(client, task.id, D1, 'done');
    expect(fake.xpAwards()).toHaveLength(1);

    const snoozeOutcome = await snooze(client, task.id, D1);
    expect((snoozeOutcome as { ok: boolean }).ok).toBe(true);
    expect((await occOn(task.id, D1, client))?.outcome).toBe('not-due');
    expect((await occOn(task.id, D2, client))?.outcome).toBe('ideal'); // D2 off-cadence, due only via the moved-in record

    const undoOutcome = await undo(client, task.id, D1);
    expect((undoOutcome as { ok: boolean }).ok).toBe(true);

    const restored = await occOn(task.id, D1, client);
    expect(restored?.outcome).toBe('ideal');
    expect(restored?.chipState).toBe('done');
    expectNotDue(await occOn(task.id, D2, client));
    expect(fake.xpAwards()).toHaveLength(1);
    expect(fake.xpAwards()[0]!.date).toBe(D1);

    const rows = fake.logsFor(task.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.movedToDate).toBeNull();
  });
});

describe('C4 — snooze D onto a naturally-due D + 1 that HAS its own log (PRD case 1)', () => {
  test('D + 1 keeps its own logged state; the visitor contributes nothing; D vacates', async () => {
    const task = makeTask({ cadence: { kind: 'daily' } });
    fake.seedTask(task);
    const client = freshClient();

    await log(client, task.id, D2, 'fallback');
    expect((await occOn(task.id, D2, client))?.outcome).toBe('fallback');

    const outcome = await snooze(client, task.id, D1);
    expect((outcome as { ok: boolean }).ok).toBe(true);

    expect((await occOn(task.id, D1, client))?.outcome).toBe('not-due'); // D vacated
    const target = await occOn(task.id, D2, client);
    expect(target?.outcome).toBe('fallback'); // completely unaffected by the merge
    expect(target?.chipState).toBe('fallback');
  });
});

describe('C4b — snooze D onto a naturally-due D + 1 that has NEVER been logged (PRD case 2)', () => {
  test('D + 1 keeps its own blank state; a COMPLETED visitor mints NO XP award; undo restores D with its data and re-affirmed award', async () => {
    const task = makeTask({ cadence: { kind: 'daily' } });
    fake.seedTask(task);
    const client = freshClient();

    await log(client, task.id, D1, 'done');
    expect(fake.xpAwards()).toHaveLength(1);
    expect(await fake.repos.progress.lifetimeXp()).toBe(10);

    const outcome = await snooze(client, task.id, D1);
    expect((outcome as { ok: boolean }).ok).toBe(true);

    expect((await occOn(task.id, D1, client))?.outcome).toBe('not-due');
    const target = await occOn(task.id, D2, client);
    expect(target?.outcome).not.toBe('ideal'); // NOT the visitor's completed outcome
    expect(target?.chipState).not.toBe('done'); // NOT the visitor's chip

    // The explicit no-award assertion — the entire point of C4b.
    expect(fake.xpAwards()).toHaveLength(0);
    expect(await fake.repos.progress.lifetimeXp()).toBe(0);

    // Undo restores D exactly, with its data and re-affirmed award. NOTE: this is undo from a
    // CASE-2 target (D + 1 was blank) — not C4r, which SCHEMA pins as undo from a CASE-1
    // target (a host with its OWN genuine logged data and award). See the dedicated C4r
    // describe block below for that case.
    const undoOutcome = await undo(client, task.id, D1);
    expect((undoOutcome as { ok: boolean }).ok).toBe(true);
    const restored = await occOn(task.id, D1, client);
    expect(restored?.outcome).toBe('ideal');
    expect(restored?.chipState).toBe('done');
    expect(fake.xpAwards()).toHaveLength(1);
    expect(await fake.repos.progress.lifetimeXp()).toBe(10);
    // D + 1's own occurrence is untouched throughout: still naturally due (daily), still
    // genuinely unlogged — reads its own blank state (missed, past, unlogged), never 'ideal'.
    expect((await occOn(task.id, D2, client))?.outcome).not.toBe('ideal');
  });
});

describe('C4r — undo FROM A CASE-1 TARGET: a host with its OWN genuine logged data and award must be completely untouched by the visitor\'s undo', () => {
  test('undo clears ownLog(D) only; D due again with its prior data and re-affirmed award; D + 1\'s own row and award are byte/id-identical to their pre-undo snapshot', async () => {
    // C4's exact fixture: D + 1 (D2) has its own genuine logged ('fallback') data and its own
    // earned award BEFORE the merge — this is what makes it a case-1 target, distinct from
    // C4b's blank case-2 target. The load-bearing question C4r asks: when the VISITOR (D1)
    // undoes, does undo's `reconcileOccurrence(tau, D + 1)` disturb a host it never actually
    // touched? A bug that clobbers or re-stamps the host's award would pass every other test
    // in this file.
    const task = makeTask({ cadence: { kind: 'daily' } });
    fake.seedTask(task);
    const client = freshClient();

    await log(client, task.id, D2, 'fallback'); // D + 1's OWN data and award, pre-existing
    await log(client, task.id, D1, 'done'); // D's own data, about to become the visitor
    expect(fake.xpAwards()).toHaveLength(2);
    const hostAwardBefore = fake.xpAwards().find((a) => a.date === D2)!;

    await snooze(client, task.id, D1); // C4 merge: D vacates, D2 (case 1) unaffected
    expect((await occOn(task.id, D1, client))?.outcome).toBe('not-due');
    expect((await occOn(task.id, D2, client))?.outcome).toBe('fallback');

    const hostRowBeforeUndo = fake.logsFor(task.id).find((r) => r.date === D2)!;

    await undo(client, task.id, D1); // C4r: the visitor's own undo

    // D restored exactly: due again, its own prior data, award re-affirmed.
    const restored = await occOn(task.id, D1, client);
    expect(restored?.outcome).toBe('ideal');
    expect(restored?.chipState).toBe('done');
    expect(fake.logsFor(task.id).find((r) => r.date === D1)?.movedToDate).toBeNull();

    // The host (D + 1) is completely untouched: row byte-identical, and its award survives
    // with its ORIGINAL id/kind/amount/cycle_id — not re-stamped, not re-minted.
    const hostRowAfterUndo = fake.logsFor(task.id).find((r) => r.date === D2)!;
    expect(hostRowAfterUndo).toEqual(hostRowBeforeUndo);
    expect((await occOn(task.id, D2, client))?.outcome).toBe('fallback');

    const hostAwardAfter = fake.xpAwards().find((a) => a.date === D2)!;
    expect(hostAwardAfter).toEqual(hostAwardBefore);

    // Exactly two awards total — D's re-affirmed award, and D + 1's untouched one.
    expect(fake.xpAwards()).toHaveLength(2);
    expect(fake.xpAwards().find((a) => a.date === D1)).toBeDefined();
  });
});

describe('C5 — merge-then-vacate: the dormant visitor REVIVES when its host leaves (INVERTED from the old LIFO reading)', () => {
  test('snooze D onto a D + 1 that has its own data (C4 merge); then D + 1\'s own occurrence snoozes onward — the visitor revives and its award re-materialises', async () => {
    // D3 deliberately OFF-cadence: once D2's own occurrence snoozes to D3, D3 must be a pure
    // visitor target (clause c) so D2's traveling data actually shows there — a `daily`
    // cadence would make D3 naturally due too, and clause (b) would intercept with D3's own
    // blank state instead (a different, already-covered case; see C4b).
    const task = makeTask({ cadence: { kind: 'specific-weekdays', weekdays: [1, 2] as Weekday[] } }); // D1 (Mon), D2 (Tue) only
    fake.seedTask(task);
    const client = freshClient();

    await log(client, task.id, D2, 'fallback'); // D + 1's own data (6 XP)
    await log(client, task.id, D1, 'done'); // D's own data, about to become the dormant visitor (10 XP)
    expect(await fake.repos.progress.lifetimeXp()).toBe(16);

    await snooze(client, task.id, D1); // D -> D+1: case-1 merge (C4). D vacates, its award retracts.
    expect((await occOn(task.id, D1, client))?.outcome).toBe('not-due');
    expect((await occOn(task.id, D2, client))?.outcome).toBe('fallback'); // unchanged
    expect(fake.xpAwards()).toHaveLength(1); // just D2's own 6 XP
    expect(await fake.repos.progress.lifetimeXp()).toBe(6);

    // Now D + 1's OWN displayed occurrence snoozes onward (D2 -> D3). Once it vacates, the
    // dormant visitor (D1's data, still pointing at D2) is no longer shadowed by a live own
    // row at D2 — it REVIVES there via R-1 clause (c), and its award re-materialises.
    const outcome = await snooze(client, task.id, D2);
    expect((outcome as { ok: boolean }).ok).toBe(true);

    const revived = await occOn(task.id, D2, client);
    expect(revived?.outcome).toBe('ideal'); // D1's 'done' data, revived
    expect(revived?.chipState).toBe('done');
    const carriedForward = await occOn(task.id, D3, client);
    expect(carriedForward?.outcome).toBe('fallback'); // D2's own data travelled with it to D3

    // Two genuinely distinct, currently-live occurrences now: D2 (D1's revived data) and D3
    // (D2's own data, carried forward) — both real, both XP-eligible, both awarded exactly
    // once, at their own dates. The D2 award RE-MATERIALISES (upserted into the same
    // (task, D2) slot the dormant fallback award occupied, not a duplicate) at the higher
    // 'ideal' amount; the D3 award is a fresh, ordinary award for D2's own carried-forward
    // occurrence.
    expect(fake.xpAwards()).toHaveLength(2);
    const atD2Award = fake.xpAwards().find((a) => a.date === D2)!;
    expect(atD2Award.amount).toBe(10);
    expect(atD2Award.kind).toBe('ideal');
    const atD3Award = fake.xpAwards().find((a) => a.date === D3)!;
    expect(atD3Award.amount).toBe(6);
    expect(atD3Award.kind).toBe('fallback');
    expect(await fake.repos.progress.lifetimeXp()).toBe(16); // the shadow dip (16 -> 6) was transient, not a loss — both occurrences' XP is intact
  });
});

describe('C6 — two independent one-hop snoozes on DIFFERENT occurrences (explicitly in scope, PRD Decisions 21)', () => {
  test('snooze D+1 to D+2, then snooze D to D+1: D is DUE at D+1 via its moved-in record; D+1\'s own occurrence stays at D+2', async () => {
    const task = makeTask({ cadence: { kind: 'daily' } });
    fake.seedTask(task);
    const client = freshClient();

    await snooze(client, task.id, D2); // D+1 -> D+2 first
    await snooze(client, task.id, D1); // D -> D+1 second

    const atD2 = await occOn(task.id, D2, client);
    expect(atD2?.outcome).not.toBe('not-due'); // NOT annihilated by D2's own outbound residue
    const atD3 = await occOn(task.id, D3, client);
    expect(atD3?.outcome).not.toBe('not-due'); // D2's own occurrence is still live, now at D3
    expect((await occOn(task.id, D1, client))?.outcome).toBe('not-due'); // D itself vacated
  });
});

describe('C7 — snooze D, complete at D + 1 (off-cadence), then undo', () => {
  test('the tap writes to D\'s OWN row (the visitor), pointer preserved; undo brings the completion home, re-affirmed, not duplicated', async () => {
    const task = makeTask({ cadence: { kind: 'specific-weekdays', weekdays: [1] as Weekday[] } }); // D1 only — D2 off-cadence
    fake.seedTask(task);
    const client = freshClient();

    await snooze(client, task.id, D1);
    await log(client, task.id, D2, 'done');

    expect((await occOn(task.id, D2, client))?.outcome).toBe('ideal');
    expect(fake.xpAwards()).toHaveLength(1);
    expect(fake.xpAwards()[0]!.date).toBe(D2); // XP keys on D+1 while the occurrence shows there (T-3)

    const rows = fake.logsFor(task.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.date).toBe(D1);
    expect(rows[0]!.chipState).toBe('done');
    expect(rows[0]!.movedToDate).toBe(D2); // pointer preserved, not cleared by the write

    await undo(client, task.id, D1);

    const restored = await occOn(task.id, D1, client);
    expect(restored?.outcome).toBe('ideal');
    expect(restored?.chipState).toBe('done');
    expectNotDue(await occOn(task.id, D2, client));
    expect(fake.xpAwards()).toHaveLength(1); // re-affirmed at D, not lost, not duplicated
    expect(fake.xpAwards()[0]!.date).toBe(D1);
    expect(fake.logsFor(task.id)).toHaveLength(1);
    expect(fake.logsFor(task.id)[0]!.movedToDate).toBeNull();
  });
});

describe('C9 — C6\'s shape, then a chip/step tap on D + 1', () => {
  test('tap lands on D\'s row (the visitor); residue byte-unchanged; undoing D+1 home shadows the visitor (retraction), then the visitor\'s own undo revives it', async () => {
    const task = makeTask({ cadence: { kind: 'daily' } });
    fake.seedTask(task);
    const client = freshClient();

    await snooze(client, task.id, D2); // D+1 -> D+2
    await snooze(client, task.id, D1); // D -> D+1

    const residueBefore = fake.logsFor(task.id).find((r) => r.date === D2)!;
    expect(residueBefore.movedToDate).toBe(D3);

    await log(client, task.id, D2, 'done'); // tap on D+1

    const atD2 = await occOn(task.id, D2, client);
    expect(atD2?.outcome).toBe('ideal');
    expect(fake.xpAwards()).toHaveLength(1);
    expect(fake.xpAwards()[0]!.date).toBe(D2);

    const dRow = fake.logsFor(task.id).find((r) => r.date === D1)!;
    expect(dRow.chipState).toBe('done');
    expect(dRow.movedToDate).toBe(D2); // the visitor's pointer, intact

    const residueAfter = fake.logsFor(task.id).find((r) => r.date === D2)!;
    expect(residueAfter).toEqual(residueBefore); // byte-unchanged by the tap

    // Undo D + 1's own occurrence home (D2 -> its own date, clearing D2's own pointer): this
    // SHADOWS the visitor per clause (a) — D2's own (blank) live row now wins.
    await undo(client, task.id, D2);
    const shadowed = await occOn(task.id, D2, client);
    expect(shadowed?.outcome).not.toBe('ideal');
    expect(shadowed?.chipState).not.toBe('done');
    expect(fake.xpAwards()).toHaveLength(0); // sanctioned transient retraction (CR-2), not value loss

    // The visitor's OWN undo (D1's pointer, still -> D2) revives its data at D1.
    await undo(client, task.id, D1);
    const revived = await occOn(task.id, D1, client);
    expect(revived?.outcome).toBe('ideal');
    expect(revived?.chipState).toBe('done');
    expect(fake.xpAwards()).toHaveLength(1);
    expect(fake.xpAwards()[0]!.date).toBe(D1);
  });
});

describe('C10 — snooze D, then any occurrence-data write on D', () => {
  test('VALIDATION_FAILED; ownLog(D) byte-identical; zero events, zero XP delta; undo afterwards revives D exactly as pre-snooze', async () => {
    const task = makeTask({ cadence: { kind: 'daily' } });
    fake.seedTask(task);
    const client = freshClient();

    await log(client, task.id, D1, 'fallback');
    await snooze(client, task.id, D1);

    const rowBefore = fake.logsFor(task.id).find((r) => r.date === D1)!;
    const xpBefore = await fake.repos.progress.lifetimeXp();
    const events: AppEvent[] = [];
    const off1 = on('day:logged', (e) => events.push(e));
    const off2 = on('xp:awarded', (e) => events.push(e));

    const outcome = await log(client, task.id, D1, 'done');
    const res = outcome as { ok: false; error: { code: string } };
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('VALIDATION_FAILED');
    expect(events).toHaveLength(0);

    off1();
    off2();

    const rowAfter = fake.logsFor(task.id).find((r) => r.date === D1)!;
    expect(rowAfter).toEqual(rowBefore);
    expect(await fake.repos.progress.lifetimeXp()).toBe(xpBefore);

    await undo(client, task.id, D1);
    const restored = await occOn(task.id, D1, client);
    expect(restored?.outcome).toBe('fallback');
    expect(restored?.chipState).toBe('fallback');
  });
});

describe('C11 — any occurrence-data write on a rowless not-due date', () => {
  test('VALIDATION_FAILED, zero writes; a later snooze-in finds no fabricated clause-(a) row', async () => {
    const task = makeTask({ cadence: { kind: 'specific-weekdays', weekdays: [1] as Weekday[] } }); // D1 only — D2 rowless, not due
    fake.seedTask(task);
    const client = freshClient();

    const outcome = await log(client, task.id, D2, 'done');
    const res = outcome as { ok: false; error: { code: string } };
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('VALIDATION_FAILED');
    expect(fake.logsFor(task.id)).toHaveLength(0);

    await snooze(client, task.id, D1);
    expect(fake.logsFor(task.id)).toHaveLength(1); // exactly the snooze's own write
    const d2 = await occOn(task.id, D2, client);
    expect(d2?.outcome).not.toBe('ideal'); // no phantom 'done' left by the earlier rejection
    expect(d2?.chipState).not.toBe('done');
  });
});

describe('C12 — two DIFFERENT tasks each snooze one day forward onto the same date', () => {
  test('legal and expected; each resolves independently, and both display and count', async () => {
    // D2 deliberately OFF-cadence for both tasks, so each snoozed occurrence is the only
    // occurrence present at D2 for its own task (clause c) — a `daily` cadence would make D2
    // naturally due for both and clause (b) would intercept with each task's own blank state.
    const taskA = makeTask({ cadence: { kind: 'specific-weekdays', weekdays: [1] as Weekday[] } });
    const taskB = makeTask({ cadence: { kind: 'specific-weekdays', weekdays: [1] as Weekday[] } });
    fake.seedTask(taskA);
    fake.seedTask(taskB);
    const client = freshClient();

    await log(client, taskA.id, D1, 'done');
    await log(client, taskB.id, D1, 'fallback');
    await snooze(client, taskA.id, D1);
    await snooze(client, taskB.id, D1);

    const a = await occOn(taskA.id, D2, client);
    const b = await occOn(taskB.id, D2, client);
    expect(a?.outcome).toBe('ideal');
    expect(b?.outcome).toBe('fallback');

    // F5's per-day fraction sees both, independently.
    const { result: consistencyA } = await rh(() => useConsistency({ scope: 'per-task', window: 'all-time', taskId: taskA.id }), client);
    await waitFor(() => expect(consistencyA.current.isSuccess).toBe(true));
    expect(consistencyA.current.data!.numerator).toBe(1);
    const { result: consistencyB } = await rh(() => useConsistency({ scope: 'per-task', window: 'all-time', taskId: taskB.id }), client);
    await waitFor(() => expect(consistencyB.current.isSuccess).toBe(true));
    expect(consistencyB.current.data!.numerator).toBe(1);
  });
});

describe('C13 — snooze an already-snoozed occurrence', () => {
  test('VALIDATION_FAILED, zero writes; no occurrence is ever more than one day from its own date', async () => {
    const task = makeTask({ cadence: { kind: 'daily' } });
    fake.seedTask(task);
    const client = freshClient();

    await snooze(client, task.id, D1);
    const rowBefore = fake.logsFor(task.id).find((r) => r.date === D1)!;

    const outcome = await snooze(client, task.id, D1);
    const res = outcome as { ok: false; error: { code: string } };
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('VALIDATION_FAILED');

    const rowAfter = fake.logsFor(task.id).find((r) => r.date === D1)!;
    expect(rowAfter).toEqual(rowBefore);
  });

  test('regression (review pass 1, blocking item 1): snoozing an already-snoozed occurrence THROUGH THE VIEWED DATE — not its own date — is rejected, not fabricated', async () => {
    // The C13 shape reached a different way: the task is due only on D3. snooze(D3) succeeds,
    // relocating the occurrence to D4. D4 is now DISPLAYING that already-snoozed occurrence
    // (a visitor, clause c) — attempting to snooze "the occurrence at D4" must be rejected
    // exactly like C13, not treated as a fresh, snoozable occurrence of its own. Before the
    // fix, `snoozeOccurrence`'s "already snoozed" guard read ONLY `ownLog(D4)` (absent, since
    // D4 has no row of its own) and let the write through, fabricating a SECOND row
    // (`ownLog(D4).movedToDate = D5`) for an occurrence that does not exist — one real
    // occurrence then displayed as `missed` on two separate dates (D4 and D5) simultaneously,
    // inflating the F5 denominator.
    const task = makeTask({ cadence: { kind: 'specific-weekdays', weekdays: [3] as Weekday[] } }); // D3 only
    fake.seedTask(task);
    const client = freshClient();

    const first = await snooze(client, task.id, D3);
    expect((first as { ok: boolean }).ok).toBe(true);
    expect((await occOn(task.id, D4, client))?.outcome).not.toBe('not-due'); // the visitor, displaying at D4

    const second = await snooze(client, task.id, D4); // snoozing the VIEWED date, not the occurrence's own date (D3)
    const res = second as { ok: false; error: { code: string } };
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('VALIDATION_FAILED');

    // Zero writes: exactly the one row from the first (legitimate) snooze — no fabricated
    // second pointer, and no second `missed` occurrence for this one task.
    const rows = fake.logsFor(task.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.date).toBe(D3);
    expect(rows[0]!.movedToDate).toBe(D4);
    expectNotDue(await occOn(task.id, D5, client)); // no phantom occurrence ever displays here
  });
});

describe('C14 — snooze on a task with snoozable = 0', () => {
  test('activating writes nothing; turning snoozable off after an existing snooze does not retract it, and undo still works', async () => {
    const client = freshClient();

    const notSnoozable = makeTask({ cadence: { kind: 'daily' }, snoozable: false });
    fake.seedTask(notSnoozable);
    const rejected = await snooze(client, notSnoozable.id, D1);
    const res = rejected as { ok: false; error: { code: string } };
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('VALIDATION_FAILED');
    expect(fake.logsFor(notSnoozable.id)).toHaveLength(0);

    const snoozableTask = makeTask({ cadence: { kind: 'daily' }, snoozable: true });
    fake.seedTask(snoozableTask);
    await snooze(client, snoozableTask.id, D1);
    expect((await occOn(snoozableTask.id, D2, client))?.outcome).not.toBe('not-due');

    // Turn snoozable off on the ALREADY-snoozed task — the existing snooze is untouched, and
    // undo ignores `snoozable` entirely (W-1u).
    fake.seedTask({ ...snoozableTask, snoozable: false });
    expect((await occOn(snoozableTask.id, D2, client))?.outcome).not.toBe('not-due'); // still snoozed

    const undoOutcome = await undo(client, snoozableTask.id, D1);
    expect((undoOutcome as { ok: boolean }).ok).toBe(true);
    const restored = await occOn(snoozableTask.id, D1, client);
    expect(restored?.outcome).not.toBe('not-due');
  });
});
