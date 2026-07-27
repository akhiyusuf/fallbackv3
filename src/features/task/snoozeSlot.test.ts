import type { LocalDate, Occurrence } from '@/types';
import { resolveSnoozeSlot } from './snoozeSlot';

const YDAY = '2026-07-15' as LocalDate;
const TODAY = '2026-07-16' as LocalDate;

function occ(outcome: Occurrence['outcome']): Occurrence {
  return {
    taskId: 't1' as never,
    date: TODAY,
    outcome,
    dueIdealStepIds: [],
    completedStepIds: [],
    chipState: null,
    dosesRequired: 1,
    dosesCompleted: 0,
  };
}

describe('resolveSnoozeSlot', () => {
  it('renders Snooze disabled when today has no occurrence at all', () => {
    const r = resolveSnoozeSlot({ todayOccurrence: undefined, yesterdayOccurrence: undefined, isDueYesterday: false, taskSnoozable: true, yesterday: YDAY });
    expect(r).toEqual({ kind: 'snooze', enabled: false, disabledReason: expect.any(String) });
  });

  it('renders Snooze disabled when today resolves not-due', () => {
    const r = resolveSnoozeSlot({ todayOccurrence: occ('not-due'), yesterdayOccurrence: undefined, isDueYesterday: false, taskSnoozable: true, yesterday: YDAY });
    expect(r.kind).toBe('snooze');
    expect((r as { enabled: boolean }).enabled).toBe(false);
  });

  it('renders Snooze enabled for a normal pending occurrence on a snoozable task', () => {
    const r = resolveSnoozeSlot({ todayOccurrence: occ('pending'), yesterdayOccurrence: undefined, isDueYesterday: false, taskSnoozable: true, yesterday: YDAY });
    expect(r).toEqual({ kind: 'snooze', enabled: true });
  });

  it('renders Snooze disabled (not hidden), with a reason, when the task is not snoozable', () => {
    const r = resolveSnoozeSlot({ todayOccurrence: occ('ideal'), yesterdayOccurrence: undefined, isDueYesterday: false, taskSnoozable: false, yesterday: YDAY });
    expect(r).toEqual({ kind: 'snooze', enabled: false, disabledReason: expect.any(String) });
  });

  it('renders Undo snooze when yesterday was naturally due and reads not-due (vacated by a snooze)', () => {
    const r = resolveSnoozeSlot({
      todayOccurrence: occ('ideal'),
      yesterdayOccurrence: occ('not-due'),
      isDueYesterday: true,
      taskSnoozable: true,
      yesterday: YDAY,
    });
    expect(r).toEqual({ kind: 'undo', sourceDate: YDAY });
  });

  it('renders Undo snooze regardless of the task snoozable flag (W-1u: irrelevant to undo)', () => {
    const r = resolveSnoozeSlot({
      todayOccurrence: occ('fallback'),
      yesterdayOccurrence: occ('not-due'),
      isDueYesterday: true,
      taskSnoozable: false,
      yesterday: YDAY,
    });
    expect(r.kind).toBe('undo');
  });

  it('does NOT render Undo when yesterday was not naturally due (plain non-due day, no visitor)', () => {
    const r = resolveSnoozeSlot({
      todayOccurrence: occ('ideal'),
      yesterdayOccurrence: undefined,
      isDueYesterday: false,
      taskSnoozable: true,
      yesterday: YDAY,
    });
    expect(r.kind).toBe('snooze');
  });

  it('does NOT render Undo when yesterday resolves due and logged normally (no vacate)', () => {
    const r = resolveSnoozeSlot({
      todayOccurrence: occ('ideal'),
      yesterdayOccurrence: occ('ideal'),
      isDueYesterday: true,
      taskSnoozable: true,
      yesterday: YDAY,
    });
    expect(r.kind).toBe('snooze');
  });
});
