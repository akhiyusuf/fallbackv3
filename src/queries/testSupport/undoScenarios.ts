/**
 * Edge-case round 4: every "take it back" pair in the app, as scenarios for `undoEngine.ts`. Each
 * one is the action the person can take on a screen and the undo that screen offers (or the
 * closest thing to it). Both undo suites run this same list.
 */
import { addDays } from '@/lib/date';

import { attempt, id, logState, setDay, type Ctx, type Scenario } from './undoEngine';

const DAILY = { kind: 'daily' } as const;

async function stepId(c: Ctx, label: string, index: number) {
  const { repos } = c.env;
  const task = await repos.tasks.get(id(c, label));
  if (!task) throw new Error(`no ${label}`);
  return task.idealSteps[index]!.id;
}

/* ------------------------------------------------------------------ classifying what is left */

/**
 * The differences a pair may leave, by kind. Anything else is a bug, or a new kind of difference that
 * has to be looked at and named in `ALLOWED` with its reason.
 *  - `residue-row`: a day_log row that reads exactly like no row (no manual choice, no ticked step, no
 *    push, chip "to do" or empty). Every read is identical; only the row exists (the logs repository
 *    has no delete, so an un-logged day keeps an empty row).
 *  - `record-change`: the record or the stored history of a habit changed on purpose: a pause or a
 *    deletion that spans midnight marks days off, a habit removed for good leaves retired days behind.
 *    Each scenario that may do this says why, and `midnightOnly` ones cannot happen on the same day.
 */
export type Category = 'residue-row' | 'record-change' | 'xp-kept-unlinked';

interface Allowed {
  readonly cat: Category;
  readonly reason: string;
  readonly midnightOnly?: boolean;
}

/** Per pair: the only kinds its differences may fall into. Empty means the pair must come back exactly. */
export const ALLOWED: Record<string, readonly Allowed[]> = {
  'log ideal, then un-log': [{ cat: 'residue-row', reason: 'un-log leaves an empty row where there was none' }],
  'log fallback, then ideal, then un-log the ideal': [],
  'tick a step, then untick it': [{ cat: 'residue-row', reason: 'untick leaves an empty row where there was none' }],
  'take one dose, then take it back': [{ cat: 'residue-row', reason: 'dose back to 0 leaves an empty row' }],
  'push to tomorrow, then undo the push': [{ cat: 'residue-row', reason: 'undoing the push leaves an empty row' }],
  'emergency day off for one habit, then lift it': [],
  'emergency day off for the whole day, then lift it': [],
  'end routine (nothing logged today), then start again': [
    { cat: 'record-change', midnightOnly: true, reason: 'ended yesterday, started again today: yesterday is an away day (paused), off by design' },
  ],
  'end routine (logged today), then start again': [],
  'delete a habit, then restore it (same day)': [
    { cat: 'record-change', midnightOnly: true, reason: 'restored after midnight: the deletion day is an away day, off by design (not the toast Undo)' },
  ],
  'delete a habit logged today, then restore it (same day)': [],
  'delete a habit, then delete it for good (no undo)': [
    { cat: 'record-change', reason: 'removed for good: its settled days move to retired history; consistency must not move' },
    { cat: 'xp-kept-unlinked', reason: 'XP stays (SCHEMA 2.3): only the award rows lose their task link; lifetime XP itself must not move' },
  ],
  'duplicate a habit, then delete the copy for good': [
    { cat: 'record-change', midnightOnly: true, reason: 'copy made yesterday, unlogged, counted as a miss on the day it existed (creation-day rule)' },
  ],
  'rename, then rename back': [],
  'change the schedule, then change it back': [],
  'log done on a dose habit, un-log it, then take a dose': [{ cat: 'residue-row', reason: 'un-log leaves an empty row; the dose count is now counted' }],
  'push a habit to tomorrow, end it, then start again': [
    { cat: 'record-change', midnightOnly: true, reason: 'ended after midnight of the push day: its away day is off by design' },
  ],
  'push a habit, log the pushed day tomorrow, end it there, then start again': [],
  'tick a step, take one dose, log done, un-log to fallback, take the second dose': [],
  'log done, un-log, then tick a step': [{ cat: 'residue-row', reason: 'un-log leaves an empty row' }],
};

/** Differences that are neither a residue row nor a record change: XP, consistency, the habits themselves. */
const LOG_ROW = '.tables.logs';
const RECORD_PATHS = ['.derived.record', '.derived.today', '.tables.offDays', '.tables.retiredDays', '.tables.tasks', '.tables.steps'];

function parseLine(line: string): { path: string; json: Record<string, unknown> | null } {
  const m = /^(\.[\w.]+) ([+-]) (\{.*\})$/.exec(line);
  if (!m) return { path: line.split(' ')[0] ?? line, json: null };
  try {
    return { path: m[1]!, json: JSON.parse(m[3]!) as Record<string, unknown> };
  } catch {
    return { path: m[1]!, json: null };
  }
}

const isEmptyFalse = (v: unknown) => v === false || v === 0 || v === null || v === undefined;

/** The kind one difference line is, or null when it is none of the known kinds. */
export function classify(line: string): Category | null {
  const { path, json } = parseLine(line);
  if (path === LOG_ROW && json) {
    const empty =
      isEmptyFalse(json.isManualOverride) &&
      Array.isArray(json.completedStepIds) &&
      json.completedStepIds.length === 0 &&
      isEmptyFalse(json.movedToDate) &&
      (json.chipState === null || json.chipState === 'todo');
    return empty ? 'residue-row' : 'record-change';
  }
  if (RECORD_PATHS.some((p) => path === p || path.startsWith(`${p}.`))) return 'record-change';
  // An XP award row losing its task link when the task goes for good; a retraction would also move lifetime XP.
  if (path === '.tables.xpAwards' && json && (json.taskId === null || json.taskId === 'H2')) return 'xp-kept-unlinked';
  return null;
}

export function explain(scenario: string, lines: readonly string[], midnight: boolean): { unknown: string[]; disallowed: string[] } {
  const allowed = ALLOWED[scenario];
  if (!allowed) return { unknown: [`no ALLOWED entry for ${scenario}`], disallowed: [] };
  const ok = new Set(allowed.filter((a) => midnight || !a.midnightOnly).map((a) => a.cat));
  const unknown: string[] = [];
  const disallowed: string[] = [];
  for (const line of lines) {
    const cat = classify(line);
    if (cat === null) unknown.push(line);
    else if (!ok.has(cat)) disallowed.push(`${cat}: ${line}`);
  }
  return { unknown, disallowed };
}

export const SCENARIOS: readonly Scenario[] = [
  {
    name: 'log ideal, then un-log',
    subject: 'H1',
    act: async (c) => {
      await logState(c, 'H1', c.day, 'done');
    },
    // The screen's Undo sends the chip the day had before the tap: auto "to do" (nothing ticked).
    undo: async (c) => {
      await logState(c, 'H1', c.actionDay, 'todo');
    },
    note: 'un-log writes a manual "to do" row where there was no row before',
  },
  {
    name: 'log fallback, then ideal, then un-log the ideal',
    subject: 'H1',
    setup: async (c) => {
      await logState(c, 'H1', c.day, 'fallback');
    },
    act: async (c) => {
      await logState(c, 'H1', c.day, 'done');
    },
    // Undo sends the chip the day had before the tap: fallback.
    undo: async (c) => {
      await logState(c, 'H1', c.actionDay, 'fallback');
    },
    note: 'the day goes back to fallback (manual override kept)',
  },
  {
    name: 'tick a step, then untick it',
    subject: 'H1',
    act: async (c) => {
      await attempt(c, 'toggleStep', { taskId: id(c, 'H1'), date: c.day, stepId: await stepId(c, 'H1', 0) });
    },
    undo: async (c) => {
      await attempt(c, 'toggleStep', { taskId: id(c, 'H1'), date: c.actionDay, stepId: await stepId(c, 'H1', 0) });
    },
    repeatUndo: false,
    note: 'a tick has no Undo: untick is the action\'s own inverse, a second press is another tap',
  },
  {
    name: 'take one dose, then take it back',
    subject: 'H3',
    act: async (c) => {
      await attempt(c, 'logDose', { taskId: id(c, 'H3'), date: c.day, dosesCompleted: 1 });
    },
    undo: async (c) => {
      await attempt(c, 'logDose', { taskId: id(c, 'H3'), date: c.actionDay, dosesCompleted: 0 });
    },
  },
  {
    name: 'push to tomorrow, then undo the push',
    subject: 'H1',
    act: async (c) => {
      await attempt(c, 'snooze', { taskId: id(c, 'H1'), date: c.day });
    },
    undo: async (c) => {
      await attempt(c, 'undoSnooze', { taskId: id(c, 'H1'), date: c.actionDay });
    },
  },
  {
    name: 'emergency day off for one habit, then lift it',
    subject: 'H1',
    act: async (c) => {
      await attempt(c, 'markOffDay', { date: c.day, taskId: id(c, 'H1'), mark: true });
    },
    undo: async (c) => {
      await attempt(c, 'markOffDay', { date: c.actionDay, taskId: id(c, 'H1'), mark: false });
    },
  },
  {
    name: 'emergency day off for the whole day, then lift it',
    subject: 'H1',
    act: async (c) => {
      await attempt(c, 'markOffDay', { date: c.day, taskId: null, mark: true });
    },
    undo: async (c) => {
      await attempt(c, 'markOffDay', { date: c.actionDay, taskId: null, mark: false });
    },
  },
  {
    name: 'end routine (nothing logged today), then start again',
    subject: 'H1',
    act: async (c) => {
      await attempt(c, 'endTask', id(c, 'H1'));
    },
    undo: async (c) => {
      await attempt(c, 'startAgain', id(c, 'H1'));
    },
    note: 'ending on yesterday, starting again from today marks yesterday off (the pause)',
  },
  {
    name: 'end routine (logged today), then start again',
    subject: 'H1',
    setup: async (c) => {
      await logState(c, 'H1', c.day, 'done');
    },
    act: async (c) => {
      await attempt(c, 'endTask', id(c, 'H1'));
    },
    undo: async (c) => {
      await attempt(c, 'startAgain', id(c, 'H1'));
    },
  },
  {
    name: 'delete a habit, then restore it (same day)',
    subject: 'H2',
    act: async (c) => {
      await attempt(c, 'deleteTask', id(c, 'H2'));
    },
    undo: async (c) => {
      await attempt(c, 'restoreTask', id(c, 'H2'));
    },
  },
  {
    name: 'delete a habit logged today, then restore it (same day)',
    subject: 'H2',
    setup: async (c) => {
      await logState(c, 'H2', c.day, 'done');
    },
    act: async (c) => {
      await attempt(c, 'deleteTask', id(c, 'H2'));
    },
    undo: async (c) => {
      await attempt(c, 'restoreTask', id(c, 'H2'));
    },
  },
  {
    name: 'delete a habit, then delete it for good (no undo)',
    subject: 'H2',
    act: async (c) => {
      await attempt(c, 'deleteTask', id(c, 'H2'));
      await attempt(c, 'deleteForever', id(c, 'H2'));
    },
    // The only "undo" a person could try: a restore of the removed habit. It must do nothing.
    undo: async (c) => {
      await attempt(c, 'restoreTask', id(c, 'H2'));
    },
    undoInBoth: true,
    note: 'cannot be undone: the check is that the record stays the same',
  },
  {
    name: 'duplicate a habit, then delete the copy for good',
    subject: 'H1',
    act: async (c) => {
      const result = (await attempt(c, 'duplicate', id(c, 'H1'))) as { ok: boolean; value: string };
      if (!result.ok) throw new Error('duplicate failed');
      c.ids.set('C', result.value);
      c.labels.set(result.value, 'C');
    },
    undo: async (c) => {
      await attempt(c, 'deleteTask', id(c, 'C'));
      await attempt(c, 'deleteForever', id(c, 'C'));
    },
  },
  {
    name: 'rename, then rename back',
    subject: 'H1',
    act: async (c) => {
      await attempt(c, 'updateTask', { id: id(c, 'H1'), patch: { name: 'Stroll' } });
    },
    undo: async (c) => {
      await attempt(c, 'updateTask', { id: id(c, 'H1'), patch: { name: 'Walk' } });
    },
  },
  {
    name: 'change the schedule, then change it back',
    subject: 'H1',
    act: async (c) => {
      await attempt(c, 'updateTask', { id: id(c, 'H1'), patch: { cadence: { kind: 'specific-weekdays', weekdays: [2, 4] } } });
    },
    undo: async (c) => {
      await attempt(c, 'updateTask', { id: id(c, 'H1'), patch: { cadence: DAILY } });
    },
    note: 'the record of past days changes while the schedule is changed; it comes back when changed back',
  },
  {
    name: 'log done on a dose habit, un-log it, then take a dose',
    subject: 'H3',
    act: async (c) => {
      await logState(c, 'H3', c.day, 'done');
    },
    undo: async (c) => {
      await logState(c, 'H3', c.actionDay, 'todo');
    },
    after: async (c) => {
      await attempt(c, 'logDose', { taskId: id(c, 'H3'), date: c.day, dosesCompleted: 1 });
    },
    note: 'follow-up: a manual "to do" must not hide the dose count the day has now',
  },
  {
    name: 'push a habit to tomorrow, end it, then start again',
    subject: 'H1',
    setup: async (c) => {
      await attempt(c, 'snooze', { taskId: id(c, 'H1'), date: c.day });
    },
    act: async (c) => {
      await attempt(c, 'endTask', id(c, 'H1'));
    },
    undo: async (c) => {
      await attempt(c, 'startAgain', id(c, 'H1'));
    },
    note: 'a pending push that is still pending when the habit ends: start again must leave it as it was',
  },
  {
    name: 'push a habit, log the pushed day tomorrow, end it there, then start again',
    subject: 'H1',
    setup: async (c) => {
      const today = c.day;
      await attempt(c, 'snooze', { taskId: id(c, 'H1'), date: today });
      const tomorrow = addDays(today, 1);
      setDay(c, tomorrow);
      await attempt(c, 'logState', { taskId: id(c, 'H1'), date: tomorrow, chip: 'done', pushedFrom: today });
    },
    act: async (c) => {
      await attempt(c, 'endTask', id(c, 'H1'));
    },
    undo: async (c) => {
      await attempt(c, 'startAgain', id(c, 'H1'));
    },
  },
  {
    name: 'tick a step, take one dose, log done, un-log to fallback, take the second dose',
    subject: 'H3',
    setup: async (c) => {
      await attempt(c, 'toggleStep', { taskId: id(c, 'H3'), date: c.day, stepId: await stepId(c, 'H3', 0) });
      await attempt(c, 'logDose', { taskId: id(c, 'H3'), date: c.day, dosesCompleted: 1 });
    },
    act: async (c) => {
      await logState(c, 'H3', c.day, 'done');
    },
    undo: async (c) => {
      await logState(c, 'H3', c.actionDay, 'fallback');
    },
    after: async (c) => {
      await attempt(c, 'logDose', { taskId: id(c, 'H3'), date: c.day, dosesCompleted: 2 });
    },
    note: 'regression: the un-logged day must go back to automatic, so the second dose and the ticked step make it done',
  },
  {
    name: 'log done, un-log, then tick a step',
    subject: 'H1',
    act: async (c) => {
      await logState(c, 'H1', c.day, 'done');
    },
    undo: async (c) => {
      await logState(c, 'H1', c.actionDay, 'todo');
    },
    after: async (c) => {
      await attempt(c, 'toggleStep', { taskId: id(c, 'H1'), date: c.day, stepId: await stepId(c, 'H1', 0) });
    },
  },
];

