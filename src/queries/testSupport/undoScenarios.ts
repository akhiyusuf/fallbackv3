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

