import type { DayLog, Instant, LocalDate, OffDayMark, TaskWithSteps, Weekday } from '@/types';
import { autoChipState, resolveOccurrence } from './dayState';

const d = (s: string) => s as LocalDate;

function makeTask(overrides: Partial<TaskWithSteps> = {}): TaskWithSteps {
  return {
    id: 't1' as TaskWithSteps['id'],
    type: 'routine',
    name: 'Test',
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
    createdAt: '2024-01-01T00:00:00.000Z' as Instant,
    updatedAt: '2024-01-01T00:00:00.000Z' as Instant,
    deletedAt: null,
    idealSteps: [{ id: 'ideal-1' as never, taskId: 't1' as never, role: 'ideal', text: 'Do it', position: 0, dueWeekdays: null }],
    fallbackSteps: [{ id: 'fallback-1' as never, taskId: 't1' as never, role: 'fallback', text: 'Min version', position: 0, dueWeekdays: null }],
    ...overrides,
  };
}

function log(overrides: Partial<DayLog>): DayLog {
  return {
    id: 'log-1' as DayLog['id'],
    taskId: 't1' as DayLog['taskId'],
    date: d('2024-06-01'),
    chipState: null,
    isManualOverride: false,
    completedStepIds: [],
    dosesCompleted: 0,
    movedToDate: null,
    createdAt: '2024-06-01T00:00:00.000Z' as Instant,
    updatedAt: '2024-06-01T00:00:00.000Z' as Instant,
    ...overrides,
  };
}

describe('resolveOccurrence — the chip -> outcome mapping (ARCHITECTURE.md §6.1)', () => {
  const task = makeTask();

  test('not due -> "not-due", regardless of log/off state', () => {
    const notDueTask = makeTask({ type: 'todo', cadence: null });
    const o = resolveOccurrence({ task: notDueTask, date: d('2024-06-01'), today: d('2024-06-01'), log: null, offMarks: [] });
    expect(o.outcome).toBe('not-due');
  });

  test('due + off (whole-day mark) -> "off", even with a manual chip present', () => {
    const offMark: OffDayMark = { id: 'off-1' as never, date: d('2024-06-01'), taskId: null, priorChipState: null, createdAt: '2024-06-01T00:00:00.000Z' as Instant };
    const o = resolveOccurrence({
      task,
      date: d('2024-06-01'),
      today: d('2024-06-01'),
      log: log({ chipState: 'done', isManualOverride: true }),
      offMarks: [offMark],
    });
    expect(o.outcome).toBe('off');
  });

  test('due + task-scoped off mark for a DIFFERENT task does not apply', () => {
    const offMark: OffDayMark = { id: 'off-1' as never, date: d('2024-06-01'), taskId: 'other-task' as never, priorChipState: null, createdAt: '2024-06-01T00:00:00.000Z' as Instant };
    const o = resolveOccurrence({ task, date: d('2024-06-01'), today: d('2024-06-01'), log: null, offMarks: [offMark] });
    expect(o.outcome).not.toBe('off');
  });

  test('Done chip -> ideal', () => {
    const o = resolveOccurrence({ task, date: d('2024-06-01'), today: d('2024-06-01'), log: log({ chipState: 'done', isManualOverride: true }), offMarks: [] });
    expect(o.outcome).toBe('ideal');
  });

  test('Fallback chip -> fallback', () => {
    const o = resolveOccurrence({ task, date: d('2024-06-01'), today: d('2024-06-01'), log: log({ chipState: 'fallback', isManualOverride: true }), offMarks: [] });
    expect(o.outcome).toBe('fallback');
  });

  test('Skip chip -> missed, on ANY day, including today', () => {
    const o = resolveOccurrence({ task, date: d('2024-06-01'), today: d('2024-06-01'), log: log({ chipState: 'skip', isManualOverride: true }), offMarks: [] });
    expect(o.outcome).toBe('missed');
  });

  test('To do / no row, date IS today -> pending', () => {
    const o = resolveOccurrence({ task, date: d('2024-06-01'), today: d('2024-06-01'), log: null, offMarks: [] });
    expect(o.outcome).toBe('pending');
  });

  test('To do / no row, date is in the past -> missed once the day has ended', () => {
    const o = resolveOccurrence({ task, date: d('2024-06-01'), today: d('2024-06-02'), log: null, offMarks: [] });
    expect(o.outcome).toBe('missed');
  });

  test('auto-log: all due ideal steps complete -> ideal, no manual chip needed', () => {
    const withLog = log({ completedStepIds: ['ideal-1' as never], isManualOverride: false });
    const o = resolveOccurrence({ task, date: d('2024-06-01'), today: d('2024-06-01'), log: withLog, offMarks: [] });
    expect(o.outcome).toBe('ideal');
    expect(o.chipState).toBe('done');
  });

  test('auto-log: a manual override wins over the auto-computed chip until changed', () => {
    const withLog = log({ completedStepIds: ['ideal-1' as never], chipState: 'fallback', isManualOverride: true });
    const o = resolveOccurrence({ task, date: d('2024-06-01'), today: d('2024-06-01'), log: withLog, offMarks: [] });
    expect(o.outcome).toBe('fallback'); // manual override, even though all ideal steps look complete
  });

  test('a multi-dose Course only auto-logs ideal when every dose AND every ideal step are done', () => {
    const course = makeTask({ type: 'course', dosesPerDay: 3, cadence: { kind: 'daily' }, startDate: d('2024-01-01'), endDate: d('2024-12-31') });
    const partialDoses = log({ completedStepIds: ['ideal-1' as never], dosesCompleted: 2 });
    const o1 = resolveOccurrence({ task: course, date: d('2024-06-01'), today: d('2024-06-01'), log: partialDoses, offMarks: [] });
    expect(o1.outcome).toBe('fallback'); // steps done, but not all doses

    const allDoses = log({ completedStepIds: ['ideal-1' as never], dosesCompleted: 3 });
    const o2 = resolveOccurrence({ task: course, date: d('2024-06-01'), today: d('2024-06-01'), log: allDoses, offMarks: [] });
    expect(o2.outcome).toBe('ideal');
  });
});

describe('resolveOccurrence — F7 snooze/move (review pass 1, blocking item 6)', () => {
  const task = makeTask();

  test('the source date vacates entirely (not-due) once its log carries movedToDate, even after rollover', () => {
    const moved = log({ movedToDate: d('2024-06-02') });
    // Even AFTER the source day has "ended" (today is later), it must never read as missed —
    // that is exactly the punitive outcome snooze exists to avoid.
    const o = resolveOccurrence({ task, date: d('2024-06-01'), today: d('2024-06-03'), log: moved, offMarks: [] });
    expect(o.outcome).toBe('not-due');
  });

  test('the target date becomes due via movedInLog, even on a date the cadence would not naturally place it', () => {
    const specificDayTask = makeTask({ cadence: { kind: 'specific-weekdays', weekdays: [1] } }); // Mondays only
    const moved = log({ date: d('2024-06-03'), movedToDate: d('2024-06-05') }); // Mon -> Wed
    // Without the move, Wednesday would be not-due for a Monday-only cadence.
    const withoutMove = resolveOccurrence({ task: specificDayTask, date: d('2024-06-05'), today: d('2024-06-05'), log: null, offMarks: [] });
    expect(withoutMove.outcome).toBe('not-due');

    const withMove = resolveOccurrence({
      task: specificDayTask,
      date: d('2024-06-05'),
      today: d('2024-06-05'),
      log: null,
      offMarks: [],
      movedInLog: moved,
    });
    expect(withMove.outcome).toBe('pending'); // due today, unlogged
  });

  test('moving today to tomorrow: today resolves not-due, tomorrow resolves pending — matches the review acceptance test', () => {
    const moved = log({ date: d('2024-06-01'), movedToDate: d('2024-06-02') });
    const today = resolveOccurrence({ task, date: d('2024-06-01'), today: d('2024-06-01'), log: moved, offMarks: [] });
    expect(today.outcome).toBe('not-due');

    const tomorrow = resolveOccurrence({ task, date: d('2024-06-02'), today: d('2024-06-01'), log: null, offMarks: [], movedInLog: moved });
    expect(tomorrow.outcome).toBe('pending');
  });

  test('with NO real log on the target date, a naturally-due-and-never-logged target keeps its OWN blank state (ADVICE-M2.md Supplement A, S1, clause (b)) — the visitor\'s chip/step data contributes nothing', () => {
    const moved = log({ date: d('2024-06-01'), movedToDate: d('2024-06-02'), chipState: 'done', isManualOverride: true });
    // `task` (top of file) is `daily` cadence, so 2024-06-02 is naturally due on its own
    // account — this is a MERGE onto a naturally-due, never-logged date, not a genuinely
    // off-cadence target. Supplement A: a merge never manufactures an outcome (or XP) from
    // imported visitor data on a date the user hasn't touched — the target's own blank state
    // wins; the visitor's data stays dormant at its source.
    const target = resolveOccurrence({ task, date: d('2024-06-02'), today: d('2024-06-02'), log: null, offMarks: [], movedInLog: moved });
    expect(target.outcome).toBe('pending'); // blank auto chip ('todo'), not the imported 'done'
  });

  test('N1 (review pass 2): a REAL log on the target date always wins over a moved-in record — the moved-then-completed flow', () => {
    // Snooze today -> tomorrow (the source log carries movedToDate, chip left at 'todo').
    const movedIn = log({ date: d('2024-06-01'), movedToDate: d('2024-06-02'), chipState: null, isManualOverride: false });
    // The next day, the user taps Done directly on the target date — a genuine new log row
    // keyed by (task, 2024-06-02), NOT the moved one.
    const targetLog = log({ date: d('2024-06-02'), movedToDate: null, chipState: 'done', isManualOverride: true });
    const resolved = resolveOccurrence({
      task,
      date: d('2024-06-02'),
      today: d('2024-06-03'),
      log: targetLog,
      offMarks: [],
      movedInLog: movedIn,
    });
    // Must read `ideal` (the user's real completion), never `pending`/`missed` (the stale
    // moved-in record) — this is what makes the mutation path (which awards XP off exactly
    // this resolution) and every read agree.
    expect(resolved.outcome).toBe('ideal');
    expect(resolved.chipState).toBe('done');
  });

  test('N1: due-ness still comes from the moved-in record even once a real (still-unlogged) target log exists', () => {
    const offCadenceTask = makeTask({ cadence: { kind: 'specific-weekdays', weekdays: [1] } }); // Mondays only
    const movedIn = log({ date: d('2024-06-03'), movedToDate: d('2024-06-05') }); // Mon -> Wed
    // A real, still-empty target row (e.g. created by a step toggle that didn't complete
    // anything) must not make the day fall back to "not-due" on an off-cadence Wednesday.
    const targetLog = log({ date: d('2024-06-05'), movedToDate: null, chipState: null, isManualOverride: false });
    const resolved = resolveOccurrence({
      task: offCadenceTask,
      date: d('2024-06-05'),
      today: d('2024-06-05'),
      log: targetLog,
      offMarks: [],
      movedInLog: movedIn,
    });
    expect(resolved.outcome).toBe('pending'); // due (via the move), unlogged
  });
});

describe('resolveOccurrence — C6 (ADVICE-M2.md Ruling 1, R-1 before R-2 — overrides the pass-3 "chained move vacates B" test, which is INVERTED here per the advisor\'s explicit instruction, not reworded)', () => {
  // A (2024-06-01, Sat) and B (2024-06-02, Sun) are BOTH natural occurrences of the SAME task
  // — the exact "task due A and B" premise C6 requires. C (2024-06-03, Mon) is deliberately
  // OFF-cadence: C6 is about a moved-in visitor landing on a date where the visitor is the
  // ONLY occurrence present (clause (c)) — using `daily` here (so C is natural too) would
  // instead exercise Supplement A's clause (b) merge-onto-naturally-due-unlogged-date rule at
  // C, which is a different, already-covered case (see the C4b test below), not this one.
  const task = makeTask({ cadence: { kind: 'specific-weekdays', weekdays: [6, 7] } }); // Sat, Sun only

  test('task due on both B and A; B->C then A->B: A resolves DUE at B via the moved-in record — B\'s own residue outbound pointer does not annihilate it', () => {
    // B's own row: B's occurrence itself already moved on to C (residue at B).
    const bLog = log({ date: d('2024-06-02'), movedToDate: d('2024-06-03'), chipState: 'done', isManualOverride: true });
    // A's row: A's occurrence moved INTO B.
    const aLog = log({ date: d('2024-06-01'), movedToDate: d('2024-06-02'), chipState: 'fallback', isManualOverride: true });

    const resolvedB = resolveOccurrence({
      task,
      date: d('2024-06-02'),
      today: d('2024-06-02'),
      log: bLog, // B's own row — residue, pointer non-null
      offMarks: [],
      movedInLog: aLog, // A's row — inbound(B) is non-empty
    });

    // DUE — not annihilated by B's own residue pointer — and resolved using A's data (the
    // moved-in record), since B's own log is residue (non-null pointer), never a data source.
    expect(resolvedB.outcome).toBe('fallback');
    expect(resolvedB.chipState).toBe('fallback');
  });

  test('B\'s own occurrence, meanwhile, stays due at C (unaffected by A arriving at B)', () => {
    const cLog: null = null; // C has no own row — B's residue is the only thing pointing at it
    const bResidue = log({ date: d('2024-06-02'), movedToDate: d('2024-06-03'), chipState: 'done', isManualOverride: true });
    const resolvedC = resolveOccurrence({
      task,
      date: d('2024-06-03'),
      today: d('2024-06-03'),
      log: cLog,
      offMarks: [],
      movedInLog: bResidue, // B's row points at C
    });
    expect(resolvedC.outcome).toBe('ideal'); // B's own ('done') data, now showing at C
  });
});

describe('autoChipState — F3, reused by the mutation layer after a step toggle', () => {
  test('0 of N ideal steps complete -> todo', () => {
    expect(autoChipState({ taskId: 't' as never, date: 'x' as never, outcome: 'pending', dueIdealStepIds: ['a' as never, 'b' as never], completedStepIds: [], chipState: null, dosesRequired: 1, dosesCompleted: 0 })).toBe('todo');
  });
  test('some but not all ideal steps complete -> fallback', () => {
    expect(autoChipState({ taskId: 't' as never, date: 'x' as never, outcome: 'pending', dueIdealStepIds: ['a' as never, 'b' as never], completedStepIds: ['a' as never], chipState: null, dosesRequired: 1, dosesCompleted: 0 })).toBe('fallback');
  });
  test('all ideal steps complete -> done', () => {
    expect(autoChipState({ taskId: 't' as never, date: 'x' as never, outcome: 'pending', dueIdealStepIds: ['a' as never], completedStepIds: ['a' as never], chipState: null, dosesRequired: 1, dosesCompleted: 0 })).toBe('done');
  });
  test('an untracked/no-ideal-steps occurrence never auto-completes — manual chip only', () => {
    expect(autoChipState({ taskId: 't' as never, date: 'x' as never, outcome: 'pending', dueIdealStepIds: [], completedStepIds: [], chipState: null, dosesRequired: 1, dosesCompleted: 0 })).toBe('todo');
  });
});
