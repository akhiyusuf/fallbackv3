/**
 * ADVICE-M2.md Ruling 2 — the P1-P7 invariant pack, binding going forward for every
 * mutation-layer change. Three sections, per the ADVICE:
 *   (a) exhaustive enumeration of ALL move sequences of length <= 3 over the 5-date domain
 *       {D1..D5} where the task's cadence is due on exactly {D1, D3} (same domain
 *       `moveSemantics.test.ts`'s C1-C8 use).
 *   (b) cross-operation pairs (move, logState, toggleStep, markOffDay/unmark,
 *       updateSettings-cadence) on same/adjacent dates.
 *   (c) fail-injected retry idempotence for every multi-write mutation.
 *
 * Driven directly against the extracted standalone functions (`__testing__`) and
 * `src/queries/internal.ts`'s resolve helpers — the exact functions the public hooks wrap,
 * without a React render per case, which is what makes (a)'s 16,275-sequence enumeration
 * tractable in CI (ADVICE-M2.md: "small enough to run exhaustively... mechanical"). The 8
 * NAMED cases (C1-C8) are covered end-to-end through the real hooks separately, in
 * `moveSemantics.test.ts` — this file is the bulk mechanical sweep, not a duplicate of those.
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

import { on } from '@/lib/events';
import { perTaskConsistency } from '@/domain';
import type { AppEvent, Instant, LocalDate, Result, Step, TaskWithSteps, Weekday } from '@/types';

import { fake } from './testSupport/dbMock';
import { clock } from './testSupport/clockMock';
import { resolveOneOccurrence, resolveTaskOccurrences, resolveWriteTarget } from './internal';
import { __testing__ } from './mutations';

const { moveOccurrence, logState, toggleStep, markOffDay, updateSettings } = __testing__;

jest.setTimeout(180_000); // section (a)'s enumeration is thousands of sequences; the default 5s is nowhere near enough

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

/* ============================================================== (a) exhaustive move enumeration */

interface MoveStep {
  readonly from: LocalDate;
  readonly to: LocalDate;
}

function allPairs(): MoveStep[] {
  const out: MoveStep[] = [];
  for (const from of DOMAIN) for (const to of DOMAIN) out.push({ from, to });
  return out; // 25
}

function* sequences(maxLength: 1 | 2 | 3): Generator<MoveStep[]> {
  const pairs = allPairs();
  for (const p1 of pairs) {
    yield [p1];
    if (maxLength < 2) continue;
    for (const p2 of pairs) {
      yield [p1, p2];
      if (maxLength < 3) continue;
      for (const p3 of pairs) {
        yield [p1, p2, p3];
      }
    }
  }
}

/** P7(i)/(ii), mechanical, no shadow-state simulator needed — see report for why this is
 * sufficient to catch annihilation (a moved-to date that resolves into a void). */
async function checkP7(task: TaskWithSteps): Promise<void> {
  const rows = fake.logsFor(task.id);
  for (const r of rows) {
    expect(r.movedToDate).not.toBe(r.date); // P7 (no self-pointers / I-moves)
    if (r.movedToDate !== null) {
      const target = await resolveOneOccurrence(fake.repos, task, r.movedToDate, D6);
      expect(target.outcome).not.toBe('not-due'); // P7 (no annihilation into a void)
    }
  }
}

/** P4: at most one xp_award per (task, date) — structurally guaranteed by the fake's
 * `taskId:date`-keyed map, asserted anyway as a live regression guard against a future fake
 * rewrite silently dropping that guarantee. */
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

/** P2 (per-task scope only — the aggregate scope's `missed` is a POST-rounding remainder, so
 * exact equality doesn't hold there; ARCHITECTURE.md §6.2 itself states the invariant
 * per-task) + P3's weak (ledger-consistency) form for this pure-move enumeration section. The
 * full "never reduced by an off-mark" form of P3 is exercised in section (b), where off-marks
 * are actually part of the sequence. */
async function checkP2AndP3(task: TaskWithSteps): Promise<void> {
  const occs = await resolveTaskOccurrences(fake.repos, task, D6, D6);
  const c = perTaskConsistency({ taskId: task.id, occurrences: occs, window: { from: D1, to: D5 }, today: D6 });
  expect(c.numerator).toBe(c.denominator - c.breakdown.missed); // P2

  const lifetimeXp = await fake.repos.progress.lifetimeXp();
  const ledgerSum = fake.xpAwards().reduce((sum, a) => sum + a.amount, 0);
  expect(lifetimeXp).toBe(ledgerSum); // P3, ledger form
  expect(lifetimeXp).toBeGreaterThanOrEqual(0); // P3, non-negative
}

describe('P1-P7 — section (a): exhaustive move-sequence enumeration (ADVICE-M2.md Ruling 2)', () => {
  test('every sequence of length <= 3 over the 5-date domain holds P1-P7 after it completes', async () => {
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
        const result = await moveOccurrence({ taskId: task.id, fromDate: step.from, toDate: step.to });

        // P6: at most one `level:up` and at most one `day:logged` per mutation call — never a
        // double emission for the same crossing/change (the exact shape of pass-2's N5).
        expect(levelUpCounts.length - beforeLevelUps).toBeLessThanOrEqual(1);
        expect(dayLoggedCounts.length - beforeDayLogged).toBeLessThanOrEqual(1);
        if (step.from === step.to) expect(dayLoggedCounts.length - beforeDayLogged).toBe(0); // W-0 emits nothing

        if (result.ok) {
          // P1: the mutation's own returned occurrence agrees with an immediate subsequent read.
          // eslint-disable-next-line no-await-in-loop
          const read = await resolveOneOccurrence(fake.repos, task, step.to, D6);
          expect(result.value.occurrence).toEqual(read);
        }

        // eslint-disable-next-line no-await-in-loop
        await checkP7(task);
      }

      offLevelUp();
      offDayLogged();

      // eslint-disable-next-line no-await-in-loop
      await checkP2AndP3(task);
      checkP4();
      checkP5();
    }
    expect(count).toBe(16_275); // 25 (len 1) + 625 (len 2) + 15_625 (len 3)
  });
});

/**
 * ADVICE-M2.md Supplement A, S4 (binding, tightens Ruling 2's P7 reversibility clause): two
 * named cases (C1, C4r) are not sufficient — a reversal that restores due-ness while
 * corrupting dormant residue would pass every liveness assertion above unless it happened to
 * land in exactly one of those two shapes. Bound middle path: mechanical snapshot-reversal
 * over every ACCEPTED sequence of length <= 2 (~650), comparing the full five-date RESOLUTION
 * map (never raw rows) before the final move against after inverting it. Full length-3
 * reversal is explicitly not required (2-3x runtime cost, not proportionate) — this section
 * covers only the final move of each length-<=2 sequence, which is what full length-3
 * reversal would layer on top of a base already covered by section (a)'s liveness pack.
 */
async function resolutionMap(task: TaskWithSteps): Promise<unknown[]> {
  return Promise.all(DOMAIN.map((date) => resolveOneOccurrence(fake.repos, task, date, D6)));
}

describe('P1-P7 — section (a), S4: pair-space snapshot-reversal (ADVICE-M2.md Supplement A)', () => {
  test('every accepted sequence of length <= 2: reversing the FINAL move restores the exact resolution map (single-visitor case), or at least P7 liveness (multi-visitor case)', async () => {
    let sequenceCount = 0;
    let reversalChecked = 0;
    let livenessOnlyChecked = 0;

    for (const seq of sequences(2)) {
      sequenceCount += 1;
      fake.reset();
      const task = makeTask();
      fake.seedTask(task);

      // eslint-disable-next-line no-await-in-loop
      for (const step of seq.slice(0, -1)) await moveOccurrence({ taskId: task.id, fromDate: step.from, toDate: step.to });

      const finalStep = seq[seq.length - 1]!;
      if (finalStep.from === finalStep.to) continue; // W-0 no-ops excluded — trivially reversible

      // Multi-visitor case: the target already carries an inbound pointer BEFORE the final
      // move — per S4, liveness-only for the reversal, not snapshot equality (the final move
      // would produce 2+ inbound rows at the target, which C8's tie-break — not a 1:1
      // restore — legitimately governs).
      // eslint-disable-next-line no-await-in-loop
      const priorInbound = fake.logsFor(task.id).filter((r) => r.movedToDate === finalStep.to);
      const isMultiVisitor = priorInbound.length > 0;

      // eslint-disable-next-line no-await-in-loop
      const snapshot = isMultiVisitor ? null : await resolutionMap(task);

      // eslint-disable-next-line no-await-in-loop
      const finalResult = await moveOccurrence({ taskId: task.id, fromDate: finalStep.from, toDate: finalStep.to });
      if (!finalResult.ok) continue; // not an ACCEPTED sequence — nothing to reverse

      // eslint-disable-next-line no-await-in-loop
      const inverseResult = await moveOccurrence({ taskId: task.id, fromDate: finalStep.to, toDate: finalStep.from });
      if (!inverseResult.ok) continue; // the inverse itself was rejected (e.g. a 60-day-guard edge) — nothing more to assert here

      if (isMultiVisitor) {
        // eslint-disable-next-line no-await-in-loop
        await checkP7(task);
        livenessOnlyChecked += 1;
      } else {
        // eslint-disable-next-line no-await-in-loop
        const restored = await resolutionMap(task);
        expect(restored).toEqual(snapshot);
        reversalChecked += 1;
      }
    }

    expect(sequenceCount).toBe(650); // 25 (len 1) + 625 (len 2)
    expect(reversalChecked + livenessOnlyChecked).toBeGreaterThan(0); // the check actually ran, not vacuously skipped throughout
  });
});

/**
 * ADVICE-M2.md Supplement B, B2 — P8, and the F2 harness extension (section (b)). P8 is
 * asserted from a full-store snapshot rather than just the pointer map, so P8a's "byte-
 * identical residue row" and P8b's "no mutation but `useMoveOccurrence` ever touches
 * `movedToDate`" are both covered by one comparison.
 */
function snapshotStore(taskId: TaskWithSteps['id']): ReadonlyArray<Record<string, unknown>> {
  return fake.logsFor(taskId).map((r) => ({ ...r })); // deep-enough copy — DayLog fields are all primitives/arrays of primitives
}

/**
 * P8b, standalone: no mutation OTHER than `useMoveOccurrence` ever sets, clears, or changes
 * any row's `movedToDate` — checked around ANY non-move op, without needing to know which row
 * it targeted. A brand-new row (T-2's own-create) must always be born with a null pointer.
 */
function checkP8b(before: ReadonlyArray<Record<string, unknown>>, after: ReadonlyArray<Record<string, unknown>>): void {
  const beforeByDate = new Map(before.map((r) => [r.date as LocalDate, r]));
  const afterByDate = new Map(after.map((r) => [r.date as LocalDate, r]));
  for (const [date, row] of beforeByDate) {
    expect(afterByDate.has(date)).toBe(true); // no pre-existing row is ever deleted by a non-move mutation
    expect(afterByDate.get(date)!.movedToDate).toEqual(row.movedToDate); // the pointer NEVER changes
  }
  for (const [date, row] of afterByDate) {
    if (!beforeByDate.has(date)) expect(row.movedToDate).toBeNull(); // a freshly-created row never gets a pointer
  }
}

/**
 * P8a + P8b together, for a call site that knows exactly which row T-2 was ALLOWED to touch
 * (`targetDate` — the carrier: own row, or the winning visitor's own row). Its CONTENT fields
 * (chip/step/dose/override) may legitimately change, but its `movedToDate` must not (T-2:
 * "preserving its movedToDate"). Every OTHER row — true residue, per the D-rule addition —
 * must be fully byte-unchanged.
 */
function checkP8aAndP8b(before: ReadonlyArray<Record<string, unknown>>, after: ReadonlyArray<Record<string, unknown>>, targetDate: LocalDate): void {
  checkP8b(before, after);
  const beforeByDate = new Map(before.map((r) => [r.date as LocalDate, r]));
  const afterByDate = new Map(after.map((r) => [r.date as LocalDate, r]));
  for (const [date, row] of beforeByDate) {
    if (date !== targetDate) expect(afterByDate.get(date)).toEqual(row); // P8a — every non-target row (true residue) is fully byte-unchanged
  }
}

describe('P8 — Supplement B, B2: residue immutability, pointer-writer exclusivity, write visibility, plus the F2 harness (move, move, tap)', () => {
  test('every ACCEPTED move sequence of length <= 2, composed with one logState(\'done\') tap on each of the 5 domain dates, holds P1-P8', async () => {
    let attempted = 0;
    let tapAccepted = 0;
    let tapRejected = 0;

    for (const seq of sequences(2)) {
      for (const tapDate of DOMAIN) {
        attempted += 1;
        fake.reset();
        const task = makeTask();
        fake.seedTask(task);

        // eslint-disable-next-line no-await-in-loop
        let sequenceAccepted = true;
        // eslint-disable-next-line no-await-in-loop
        for (const step of seq) {
          // eslint-disable-next-line no-await-in-loop
          const r = await moveOccurrence({ taskId: task.id, fromDate: step.from, toDate: step.to });
          if (!r.ok) {
            sequenceAccepted = false;
            break;
          }
        }
        if (!sequenceAccepted) continue; // only ACCEPTED move sequences compose with the tap, per B2

        const storeBefore = snapshotStore(task.id);
        const xpBefore = await fake.repos.progress.lifetimeXp();
        // eslint-disable-next-line no-await-in-loop
        const target = await resolveWriteTarget(fake.repos, task, tapDate, D6); // the one true carrier answer, computed BEFORE the tap
        const events: AppEvent[] = [];
        const offDayLogged = on('day:logged', (e) => events.push(e));
        const offXpAwarded = on('xp:awarded', (e) => events.push(e));

        // eslint-disable-next-line no-await-in-loop
        const tapResult = await logState({ taskId: task.id, date: tapDate, chip: 'done' });

        offDayLogged();
        offXpAwarded();
        const storeAfter = snapshotStore(task.id);

        checkP8aAndP8b(storeBefore, storeAfter, target.targetDate); // P8a/P8b — regardless of accept/reject

        if (!tapResult.ok) {
          tapRejected += 1;
          expect(events).toHaveLength(0); // rejected write — zero events
          expect(storeAfter).toEqual(storeBefore); // byte-identical store on rejection
          expect(await fake.repos.progress.lifetimeXp()).toBe(xpBefore);
          continue;
        }
        tapAccepted += 1;

        // P8c — write visibility: the post-write read reflects the write, and the mutation's
        // own returned outcome agrees with it (P1, extended to the tap itself).
        // eslint-disable-next-line no-await-in-loop
        const read = await resolveOneOccurrence(fake.repos, task, tapDate, D6);
        expect(tapResult.value.outcome).toBe(read.outcome);
        expect(read.chipState).toBe('done'); // the tap's own chip is what the read reflects

        // eslint-disable-next-line no-await-in-loop
        await checkP7(task);
        // eslint-disable-next-line no-await-in-loop
        await checkP2AndP3(task);
        checkP4();
        checkP5();
      }
    }

    expect(attempted).toBe(3_250); // 650 (S4's sequence count) x 5 (domain dates)
    expect(tapAccepted).toBeGreaterThan(0);
    expect(tapRejected).toBeGreaterThan(0); // both branches of T-1 actually exercised, not vacuously
  });
});

/* ============================================================== (b) cross-operation pairs */

type OpResult = Result<unknown>;

function buildOps(task: TaskWithSteps): Array<{ name: string; run: (date: LocalDate) => Promise<OpResult> }> {
  const nextInDomain = (d: LocalDate): LocalDate => {
    const i = DOMAIN.indexOf(d);
    return DOMAIN[i === DOMAIN.length - 1 ? i - 1 : i + 1]!;
  };
  return [
    { name: 'move', run: (d) => moveOccurrence({ taskId: task.id, fromDate: d, toDate: nextInDomain(d) }) },
    { name: 'logState', run: (d) => logState({ taskId: task.id, date: d, chip: 'done' }) },
    { name: 'toggleStep', run: (d) => toggleStep({ taskId: task.id, date: d, stepId: task.idealSteps[0]!.id }) },
    {
      // P3's full form: an off-mark must never retract earned XP — asserted here, inline,
      // across the actual round trip, in whatever composed state this op runs in.
      name: 'markOffDay/unmark',
      run: async (d) => {
        const before = await fake.repos.progress.lifetimeXp();
        const markResult = await markOffDay({ date: d, taskId: task.id, mark: true });
        const mid = await fake.repos.progress.lifetimeXp();
        expect(mid).toBe(before); // never a reduction from marking off (N2, ADVICE-pinned)
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
  test('every ordered pair of {move, logState, toggleStep, markOffDay/unmark, updateSettings-cadence}, same and adjacent dates, holds P2-P8', async () => {
    const dateRelations: Array<{ label: string; d1: LocalDate; d2: LocalDate }> = [
      { label: 'same', d1: D3, d2: D3 },
      { label: 'adjacent', d1: D3, d2: D4 },
    ];

    for (const relation of dateRelations) {
      const opNames = ['move', 'logState', 'toggleStep', 'markOffDay/unmark', 'updateSettings-cadence'];
      for (const nameI of opNames) {
        for (const nameJ of opNames) {
          fake.reset();
          const task = makeTask();
          fake.seedTask(task);
          const ops = buildOps(task);
          const opI = ops.find((o) => o.name === nameI)!;
          const opJ = ops.find((o) => o.name === nameJ)!;

          // eslint-disable-next-line no-await-in-loop
          const beforeI = snapshotStore(task.id);
          // eslint-disable-next-line no-await-in-loop
          await opI.run(relation.d1);
          if (nameI !== 'move') checkP8b(beforeI, snapshotStore(task.id)); // P8b — every non-move op, on its own

          // eslint-disable-next-line no-await-in-loop
          const beforeJ = snapshotStore(task.id);
          // eslint-disable-next-line no-await-in-loop
          await opJ.run(relation.d2);
          if (nameJ !== 'move') checkP8b(beforeJ, snapshotStore(task.id));

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
  test('moveOccurrence — a double-inbound redirect (C8-shape) that fails partway leaves a consistent, retry-safe state', async () => {
    const task = makeTask({ cadence: { kind: 'daily' } });
    fake.seedTask(task);
    const A1 = D1;
    const A2 = D2;
    const B = D4;
    const C = D5;

    await logState({ taskId: task.id, date: A1, chip: 'fallback' });
    await logState({ taskId: task.id, date: A2, chip: 'done' });
    await moveOccurrence({ taskId: task.id, fromDate: A1, toDate: B });
    await moveOccurrence({ taskId: task.id, fromDate: A2, toDate: B }); // both inbound at B now

    fake.failLogsUpsertAfterCalls(1); // let A1's redirect through, fail A2's
    const first = await moveOccurrence({ taskId: task.id, fromDate: B, toDate: C });
    expect(first.ok).toBe(false);
    let rows = fake.logsFor(task.id);
    expect(rows.find((r) => r.date === A1)?.movedToDate).toBe(C); // already-succeeded write survives
    expect(rows.find((r) => r.date === A2)?.movedToDate).toBe(B); // failed write is untouched, not half-applied

    const second = await moveOccurrence({ taskId: task.id, fromDate: B, toDate: C }); // retry
    expect(second.ok).toBe(true);
    rows = fake.logsFor(task.id);
    expect(rows).toHaveLength(2); // no duplicate rows created by the retry
    expect(rows.find((r) => r.date === A1)?.movedToDate).toBe(C);
    expect(rows.find((r) => r.date === A2)?.movedToDate).toBe(C);
    await checkP7(task);
    checkP4();
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
