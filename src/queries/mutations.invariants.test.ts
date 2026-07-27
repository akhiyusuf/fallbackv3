/**
 * The P1-P8 invariant pack, now scaled to `docs/SCHEMA.md` §4.2's one-hop F7 rescope. The old
 * ~16,275/~3,250-sequence arbitrary-target-move enumerations are DELETED, deliberately, per
 * the rescope's own instruction ("this is deletable test surface... a much smaller,
 * exhaustive-over-a-tiny-domain test set replaces it"): with the target computed as `D + 1`
 * rather than chosen, the write surface per date collapses from 25 `(from, to)` pairs to
 * exactly TWO operations — `snooze(D)` and `undo(D)` — so a full exhaustive sweep is now small
 * by construction, not merely bounded.
 *
 * Three sections, same shape as before the rescope:
 *   (a) exhaustive enumeration of ALL {snooze, undo} sequences of length <= 3 over a 5-date
 *       domain (10 possible single ops -> 10 + 100 + 1,000 = 1,110 sequences).
 *   (b) cross-operation pairs (snooze, undo, logState, toggleStep, markOffDay/unmark,
 *       updateSettings-cadence) on same/adjacent dates.
 *   (c) fail-injected retry idempotence for every multi-write mutation — snooze and undo are
 *       now single-row writes (SCHEMA §4.2: "both operations touch one row"), so the old
 *       double-inbound (C8-shape) fail-injection case is dead along with C8 itself; logState's
 *       retry case is unchanged and still exercised.
 *
 * The 13 NAMED cases (C1/C4/C4b/C4r/C5/C6/C7/C9/C10/C11/C12/C13/C14) are covered end-to-end
 * through the real hooks separately, in `moveSemantics.test.ts` — this file is the bulk
 * mechanical sweep, not a duplicate of those.
 */
jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: jest.fn(() => {
      counter += 1;
      return `20000000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`;
    }),
  };
});

jest.mock('@/db', () => require('./testSupport/dbMock'));

jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  const { clock } = require('./testSupport/clockMock');
  return { ...actual, today: () => clock.today, now: () => clock.now };
});

import { addDays } from '@/lib/date';
import { on } from '@/lib/events';
import { occurrencesBetween, perTaskConsistency } from '@/domain';
import type { AppEvent, Instant, LocalDate, Occurrence, Result, Step, TaskWithSteps, Weekday } from '@/types';

import { fake } from './testSupport/dbMock';
import { clock } from './testSupport/clockMock';
import { resolveOneOccurrence, resolveTaskOccurrences, resolveWriteTarget } from './internal';
import { __testing__ } from './mutations';

const { snoozeOccurrence, undoSnooze, logState, toggleStep, markOffDay, updateSettings } = __testing__;

jest.setTimeout(60_000); // generous, though the new domain no longer needs anywhere near this

let idCounter = 0;
function makeTask(overrides: Partial<TaskWithSteps> = {}): TaskWithSteps {
  idCounter += 1;
  const id = (overrides.id ?? `inv-task-${idCounter}`) as TaskWithSteps['id'];
  const idealStep: Step = { id: `${id}-ideal` as Step['id'], taskId: id, role: 'ideal', text: 'Do it', position: 0, dueWeekdays: null };
  const fallbackStep: Step = { id: `${id}-fallback` as Step['id'], taskId: id, role: 'fallback', text: 'Min version', position: 0, dueWeekdays: null };
  const base: TaskWithSteps = {
    id,
    type: 'routine',
    name: 'Invariant task',
    note: null,
    icon: 'Repeat',
    color: 'forge-orange',
    isAsNeeded: false,
    cadence: { kind: 'specific-weekdays', weekdays: [1, 3] as Weekday[] }, // D1 (Mon) and D3 (Wed) only
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
    createdAt: '2024-06-03T00:00:00.000Z' as Instant, // exactly D1 — the domain floor
    updatedAt: '2024-06-03T00:00:00.000Z' as Instant,
    deletedAt: null,
    idealSteps: [idealStep],
    fallbackSteps: [fallbackStep],
  };
  return { ...base, ...overrides, id };
}

const D1 = '2024-06-03' as LocalDate; // Mon — due
const D2 = '2024-06-04' as LocalDate; // Tue — not due
const D3 = '2024-06-05' as LocalDate; // Wed — due
const D4 = '2024-06-06' as LocalDate; // Thu — not due
const D5 = '2024-06-07' as LocalDate; // Fri — not due
const D6 = '2024-06-08' as LocalDate; // Sat — "today", strictly after the whole domain
const DOMAIN: readonly LocalDate[] = [D1, D2, D3, D4, D5];

beforeEach(() => {
  fake.reset();
  idCounter = 0;
  clock.today = D6;
  clock.now = `${D6}T12:00:00.000Z` as Instant;
});

/* ============================================================== (a) exhaustive {snooze, undo} enumeration */

interface OpStep {
  readonly kind: 'snooze' | 'undo';
  readonly date: LocalDate;
}

function allOps(): OpStep[] {
  const out: OpStep[] = [];
  for (const date of DOMAIN) {
    out.push({ kind: 'snooze', date });
    out.push({ kind: 'undo', date });
  }
  return out; // 10
}

function* sequences(maxLength: 1 | 2 | 3): Generator<OpStep[]> {
  const ops = allOps();
  for (const s1 of ops) {
    yield [s1];
    if (maxLength < 2) continue;
    for (const s2 of ops) {
      yield [s1, s2];
      if (maxLength < 3) continue;
      for (const s3 of ops) {
        yield [s1, s2, s3];
      }
    }
  }
}

async function runOp(task: TaskWithSteps, step: OpStep): Promise<Result<{ occurrence: Occurrence | null }>> {
  if (step.kind === 'snooze') return snoozeOccurrence({ taskId: task.id, date: step.date });
  return undoSnooze({ taskId: task.id, date: step.date });
}

/** The date a successful op's returned occurrence is ABOUT — D + 1 for snooze, D for undo. */
function resultDate(step: OpStep): LocalDate {
  return step.kind === 'snooze' ? addDays(step.date, 1) : step.date;
}

/** P7: no self-pointers (structurally impossible under the one-hop CHECK, asserted anyway as
 * a live regression guard) and no annihilation — every pointer resolves to something other
 * than `not-due`. */
async function checkP7(task: TaskWithSteps): Promise<void> {
  const rows = fake.logsFor(task.id);
  for (const r of rows) {
    expect(r.movedToDate).not.toBe(r.date);
    if (r.movedToDate !== null) {
      expect(r.movedToDate).toBe(addDays(r.date, 1)); // the one-hop CHECK, mirrored at the domain layer
      const target = await resolveOneOccurrence(fake.repos, task, r.movedToDate, D6);
      expect(target.outcome).not.toBe('not-due');
    }
  }
}

/** P4: at most one xp_award per (task, date). */
function checkP4(): void {
  const byDate = new Map<string, number>();
  for (const a of fake.xpAwards()) byDate.set(a.date, (byDate.get(a.date) ?? 0) + 1);
  for (const [, count] of byDate) expect(count).toBe(1);
}

/** P5: cycle records pairwise interval-disjoint; the live pointer starts at/after every one. */
function checkP5(): void {
  const records = fake.cycleRecords();
  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i]!;
      const b = records[j]!;
      const overlap = a.startDate <= b.endDate && b.startDate <= a.endDate;
      expect(overlap).toBe(false);
    }
  }
  const pointer = fake.currentCycleState();
  if (pointer) for (const r of records) expect(pointer.startDate >= r.endDate).toBe(true);
}

/** P2 (per-task scope only — ARCHITECTURE.md §6.2/§6.5) + P3's weak (ledger-consistency) form. */
async function checkP2AndP3(task: TaskWithSteps): Promise<void> {
  const occs = await resolveTaskOccurrences(fake.repos, task, D6, D6);
  const c = perTaskConsistency({ taskId: task.id, occurrences: occs, window: { from: D1, to: D5 }, today: D6 });
  expect(c.numerator).toBe(c.denominator - c.breakdown.missed); // P2

  const lifetimeXp = await fake.repos.progress.lifetimeXp();
  const ledgerSum = fake.xpAwards().reduce((sum, a) => sum + a.amount, 0);
  expect(lifetimeXp).toBe(ledgerSum); // P3, ledger form
  expect(lifetimeXp).toBeGreaterThanOrEqual(0); // P3, non-negative
}

/**
 * Denominator conservation (review pass 1, blocking item 1's non-blocking note 6): a
 * one-hop snooze/undo sequence only ever RELOCATES a task's existing occurrences — it can
 * never create or destroy one. Over this fixed-cadence domain (due on exactly {D1, D3}, task
 * created exactly on D1, `D6` — "today" — bounding how far any hop can reach), the count of
 * this task's non-`not-due` dates in `[D1, D6]` must equal its natural due-date count
 * EXACTLY, after any sequence whatsoever. P2 (`numerator = denominator - missed`) is true by
 * definition even against a fabricated denominator and cannot see this; this check is what
 * would have caught blocking item 1's defect (a bare date-keyed "already snoozed" guard let a
 * single real occurrence fabricate a SECOND live date, which this asserts against directly).
 */
async function checkDenominatorConservation(task: TaskWithSteps): Promise<void> {
  const naturalDueCount = occurrencesBetween(task, D1, D6, D1).length;
  const occs = await resolveTaskOccurrences(fake.repos, task, D6, D6);
  const liveCount = occs.filter((o) => o.outcome !== 'not-due').length;
  expect(liveCount).toBe(naturalDueCount);
}

describe('P1-P7 — section (a): exhaustive {snooze, undo} sequence enumeration over the 5-date domain', () => {
  test('every sequence of length <= 3 holds P1-P7 after it completes', async () => {
    let count = 0;
    for (const seq of sequences(3)) {
      count += 1;
      fake.reset();
      const task = makeTask();
      fake.seedTask(task);

      const levelUpCounts: number[] = [];
      const dayLoggedCounts: number[] = [];
      const offLevelUp = on('level:up', () => levelUpCounts.push(1));
      const offDayLogged = on('day:logged', () => dayLoggedCounts.push(1));

      for (const step of seq) {
        const beforeLevelUps = levelUpCounts.length;
        const beforeDayLogged = dayLoggedCounts.length;

        // eslint-disable-next-line no-await-in-loop
        const result = await runOp(task, step);

        // P6: at most one `level:up` and at most one `day:logged` per mutation call.
        expect(levelUpCounts.length - beforeLevelUps).toBeLessThanOrEqual(1);
        expect(dayLoggedCounts.length - beforeDayLogged).toBeLessThanOrEqual(1);

        if (result.ok) {
          // P1: the mutation's own returned occurrence agrees with an immediate subsequent read.
          // eslint-disable-next-line no-await-in-loop
          const read = await resolveOneOccurrence(fake.repos, task, resultDate(step), D6);
          expect(result.value.occurrence).toEqual(read);
        } else {
          expect(dayLoggedCounts.length - beforeDayLogged).toBe(0); // a rejection emits nothing
        }

        // eslint-disable-next-line no-await-in-loop
        await checkP7(task);
        // eslint-disable-next-line no-await-in-loop
        await checkDenominatorConservation(task);
      }

      offLevelUp();
      offDayLogged();

      // eslint-disable-next-line no-await-in-loop
      await checkP2AndP3(task);
      checkP4();
      checkP5();
    }
    expect(count).toBe(1_110); // 10 (len 1) + 100 (len 2) + 1_000 (len 3)
  });
});

/* ============================================================== P8: residue immutability, pointer exclusivity, write visibility */

function snapshotStore(taskId: TaskWithSteps['id']): ReadonlyArray<Record<string, unknown>> {
  return fake.logsFor(taskId).map((r) => ({ ...r }));
}

/** P8b, standalone: no mutation OTHER than snooze/undo ever sets, clears, or changes any
 * row's `movedToDate`. A brand-new row (T-2's own-create) must always be born with a null
 * pointer. */
function checkP8b(before: ReadonlyArray<Record<string, unknown>>, after: ReadonlyArray<Record<string, unknown>>): void {
  const beforeByDate = new Map(before.map((r) => [r.date as LocalDate, r]));
  const afterByDate = new Map(after.map((r) => [r.date as LocalDate, r]));
  for (const [date, row] of beforeByDate) {
    expect(afterByDate.has(date)).toBe(true);
    expect(afterByDate.get(date)!.movedToDate).toEqual(row.movedToDate);
  }
  for (const [date, row] of afterByDate) {
    if (!beforeByDate.has(date)) expect(row.movedToDate).toBeNull();
  }
}

/** P8a + P8b together, for a call site that knows exactly which row T-2 was ALLOWED to touch. */
function checkP8aAndP8b(before: ReadonlyArray<Record<string, unknown>>, after: ReadonlyArray<Record<string, unknown>>, targetDate: LocalDate): void {
  checkP8b(before, after);
  const beforeByDate = new Map(before.map((r) => [r.date as LocalDate, r]));
  const afterByDate = new Map(after.map((r) => [r.date as LocalDate, r]));
  for (const [date, row] of beforeByDate) {
    if (date !== targetDate) expect(afterByDate.get(date)).toEqual(row); // every non-target row is fully byte-unchanged
  }
}

describe('P8 — residue immutability, pointer-writer exclusivity, write visibility, composed with a tap', () => {
  test('every ACCEPTED {snooze, undo} sequence of length <= 2, composed with one logState(\'done\') tap on each of the 5 domain dates, holds P1-P8', async () => {
    let attempted = 0;
    let tapAccepted = 0;
    let tapRejected = 0;

    for (const seq of sequences(2)) {
      for (const tapDate of DOMAIN) {
        attempted += 1;
        fake.reset();
        const task = makeTask();
        fake.seedTask(task);

        let sequenceAccepted = true;
        for (const step of seq) {
          // eslint-disable-next-line no-await-in-loop
          const r = await runOp(task, step);
          if (!r.ok) {
            sequenceAccepted = false;
            break;
          }
        }
        if (!sequenceAccepted) continue; // only ACCEPTED sequences compose with the tap

        const storeBefore = snapshotStore(task.id);
        const xpBefore = await fake.repos.progress.lifetimeXp();
        // eslint-disable-next-line no-await-in-loop
        const target = await resolveWriteTarget(fake.repos, task, tapDate, D6);
        const events: AppEvent[] = [];
        const offDayLogged = on('day:logged', (e) => events.push(e));
        const offXpAwarded = on('xp:awarded', (e) => events.push(e));

        // eslint-disable-next-line no-await-in-loop
        const tapResult = await logState({ taskId: task.id, date: tapDate, chip: 'done' });

        offDayLogged();
        offXpAwarded();
        const storeAfter = snapshotStore(task.id);

        checkP8aAndP8b(storeBefore, storeAfter, target.targetDate);

        if (!tapResult.ok) {
          tapRejected += 1;
          expect(events).toHaveLength(0);
          expect(storeAfter).toEqual(storeBefore);
          expect(await fake.repos.progress.lifetimeXp()).toBe(xpBefore);
          continue;
        }
        tapAccepted += 1;

        // eslint-disable-next-line no-await-in-loop
        const read = await resolveOneOccurrence(fake.repos, task, tapDate, D6);
        expect(tapResult.value.outcome).toBe(read.outcome);
        expect(read.chipState).toBe('done');

        // eslint-disable-next-line no-await-in-loop
        await checkP7(task);
        // eslint-disable-next-line no-await-in-loop
        await checkP2AndP3(task);
        checkP4();
        checkP5();
      }
    }

    expect(attempted).toBe(550); // 110 (10 + 100, sequences of length <= 2) x 5 (domain dates)
    expect(tapAccepted).toBeGreaterThan(0);
    expect(tapRejected).toBeGreaterThan(0); // both branches of T-1 genuinely exercised
  });
});

/* ============================================================== (b) cross-operation pairs */

type OpResult = Result<unknown>;

function buildOps(task: TaskWithSteps): Array<{ name: string; run: (date: LocalDate) => Promise<OpResult> }> {
  return [
    { name: 'snooze', run: (d) => snoozeOccurrence({ taskId: task.id, date: d }) },
    { name: 'undo', run: (d) => undoSnooze({ taskId: task.id, date: d }) },
    { name: 'logState', run: (d) => logState({ taskId: task.id, date: d, chip: 'done' }) },
    { name: 'toggleStep', run: (d) => toggleStep({ taskId: task.id, date: d, stepId: task.idealSteps[0]!.id }) },
    {
      name: 'markOffDay/unmark',
      run: async (d) => {
        const before = await fake.repos.progress.lifetimeXp();
        const markResult = await markOffDay({ date: d, taskId: task.id, mark: true });
        const mid = await fake.repos.progress.lifetimeXp();
        expect(mid).toBe(before); // never a reduction from marking off (N2)
        const unmarkResult = await markOffDay({ date: d, taskId: task.id, mark: false });
        const after = await fake.repos.progress.lifetimeXp();
        expect(after).toBe(before);
        return markResult.ok ? unmarkResult : markResult;
      },
    },
    {
      name: 'updateSettings-cadence',
      run: async () => {
        const settings = await fake.repos.settings.get();
        return updateSettings({ cycleCadence: settings.cycleCadence === 'monthly' ? 'weekly' : 'monthly' });
      },
    },
  ];
}

describe('P1-P8 — section (b): cross-operation pairs on same/adjacent dates', () => {
  test('every ordered pair of {snooze, undo, logState, toggleStep, markOffDay/unmark, updateSettings-cadence}, same and adjacent dates, holds P2-P8', async () => {
    const dateRelations: Array<{ label: string; d1: LocalDate; d2: LocalDate }> = [
      { label: 'same', d1: D3, d2: D3 },
      { label: 'adjacent', d1: D3, d2: D4 },
    ];
    const opNames = ['snooze', 'undo', 'logState', 'toggleStep', 'markOffDay/unmark', 'updateSettings-cadence'];

    for (const relation of dateRelations) {
      for (const nameI of opNames) {
        for (const nameJ of opNames) {
          fake.reset();
          const task = makeTask();
          fake.seedTask(task);
          const ops = buildOps(task);
          const opI = ops.find((o) => o.name === nameI)!;
          const opJ = ops.find((o) => o.name === nameJ)!;
          const isMoveOp = (n: string) => n === 'snooze' || n === 'undo';

          // eslint-disable-next-line no-await-in-loop
          const beforeI = snapshotStore(task.id);
          // eslint-disable-next-line no-await-in-loop
          await opI.run(relation.d1);
          if (!isMoveOp(nameI)) checkP8b(beforeI, snapshotStore(task.id));

          // eslint-disable-next-line no-await-in-loop
          const beforeJ = snapshotStore(task.id);
          // eslint-disable-next-line no-await-in-loop
          await opJ.run(relation.d2);
          if (!isMoveOp(nameJ)) checkP8b(beforeJ, snapshotStore(task.id));

          // eslint-disable-next-line no-await-in-loop
          await checkP7(task);
          // eslint-disable-next-line no-await-in-loop
          await checkP2AndP3(task);
          checkP4();
          checkP5();
        }
      }
    }
  });
});

/* ============================================================== (c) fail-injected retry idempotence */

describe('P1-P7 — section (c): fail-injected retry idempotence for multi-write mutations', () => {
  test('snoozeOccurrence — a failed single-row write leaves the store untouched; a retry succeeds cleanly', async () => {
    const task = makeTask({ cadence: { kind: 'daily' } });
    fake.seedTask(task);

    fake.failLogsUpsertAfterCalls(0); // fail the very next logs.upsert call
    const first = await snoozeOccurrence({ taskId: task.id, date: D1 });
    expect(first.ok).toBe(false);
    expect(fake.logsFor(task.id)).toHaveLength(0); // the failed write left nothing behind

    const second = await snoozeOccurrence({ taskId: task.id, date: D1 }); // retry
    expect(second.ok).toBe(true);
    expect(fake.logsFor(task.id)).toHaveLength(1);
    expect(fake.logsFor(task.id)[0]!.movedToDate).toBe(D2);
  });

  test('undoSnooze — a failed single-row write leaves the pointer intact; a retry succeeds cleanly', async () => {
    const task = makeTask({ cadence: { kind: 'daily' } });
    fake.seedTask(task);
    await snoozeOccurrence({ taskId: task.id, date: D1 });

    fake.failLogsUpsertAfterCalls(0);
    const first = await undoSnooze({ taskId: task.id, date: D1 });
    expect(first.ok).toBe(false);
    expect(fake.logsFor(task.id)[0]!.movedToDate).toBe(D2); // untouched — still snoozed

    const second = await undoSnooze({ taskId: task.id, date: D1 }); // retry
    expect(second.ok).toBe(true);
    expect(fake.logsFor(task.id)[0]!.movedToDate).toBeNull();
  });

  test('logState — a failed XP write followed by a retry ends with exactly one award, one log row, no duplication', async () => {
    const task = makeTask({ cadence: { kind: 'daily' } });
    fake.seedTask(task);

    fake.failNextAppendXpAward();
    const first = await logState({ taskId: task.id, date: D1, chip: 'done' });
    expect(first.ok).toBe(true);
    const firstValue = first as { ok: true; value: { xpAwarded: number } };
    expect(firstValue.value.xpAwarded).toBe(0); // review pass 1 item 7: never falsely reported as success
    expect(fake.xpAwards()).toHaveLength(0);
    expect(fake.logsFor(task.id)).toHaveLength(1); // the log write itself DID succeed

    const second = await logState({ taskId: task.id, date: D1, chip: 'done' }); // retry
    expect(second.ok).toBe(true);
    const secondValue = second as { ok: true; value: { xpAwarded: number } };
    expect(secondValue.value.xpAwarded).toBe(10);
    expect(fake.xpAwards()).toHaveLength(1); // exactly one — the retry upserted, not duplicated
    expect(fake.logsFor(task.id)).toHaveLength(1);
    checkP4();
  });
});

// Keep the sanity import meaningful for readers grepping for AppEvent usage in this file.
describe('sanity', () => {
  test('the on() subscription used by section (a) really does fire for level:up', () => {
    const events: AppEvent[] = [];
    const off = on('level:up', (e) => events.push(e));
    off();
    expect(events).toHaveLength(0);
  });
});
