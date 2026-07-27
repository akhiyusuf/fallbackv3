import { buildRollingSchedule, NOTIFICATION_HORIZON_DAYS } from './schedule';
import type { LocalDate, NotificationPrefs, TaskWithSteps } from '@/types';

const BASE_PREFS: NotificationPrefs = {
  master: true,
  routineDue: true,
  eventStarting: true,
  courseDose: true,
  courseEndingSoon: true,
  gentleReentry: true,
  milestoneReached: true,
  dailyDigest: false,
  dailyDigestTime: '08:00',
};

function routine(overrides: Partial<TaskWithSteps> = {}): TaskWithSteps {
  return {
    id: 'r1' as never,
    type: 'routine',
    name: 'Evening walk',
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
    importance: 'med',
    necessity: 'recommended',
    todoDoneAt: null,
    snoozable: true,
    createdAt: '2026-01-01T00:00:00.000Z' as never,
    updatedAt: '2026-01-01T00:00:00.000Z' as never,
    deletedAt: null,
    idealSteps: [],
    fallbackSteps: [],
    ...overrides,
  } as TaskWithSteps;
}

describe('buildRollingSchedule', () => {
  const today = '2026-07-27' as LocalDate;

  it('master off => zero reminders, regardless of task data', () => {
    const tasks = [routine()];
    const result = buildRollingSchedule({ tasks, prefs: { ...BASE_PREFS, master: false }, today });
    expect(result).toHaveLength(0);
  });

  it('a daily routine generates exactly one routine-due reminder per day in the 7-day horizon', () => {
    const tasks = [routine()];
    const result = buildRollingSchedule({ tasks, prefs: BASE_PREFS, today });
    expect(result).toHaveLength(NOTIFICATION_HORIZON_DAYS);
    expect(result.every((r) => r.kind === 'routine-due')).toBe(true);
  });

  it('an as-needed routine generates zero "routine due" reminders (F27 — never due)', () => {
    const tasks = [routine({ isAsNeeded: true, cadence: null })];
    const result = buildRollingSchedule({ tasks, prefs: BASE_PREFS, today });
    expect(result).toHaveLength(0);
  });

  it('routineDue off => no reminders for that task, even though the task is due', () => {
    const tasks = [routine()];
    const result = buildRollingSchedule({ tasks, prefs: { ...BASE_PREFS, routineDue: false }, today });
    expect(result).toHaveLength(0);
  });

  it('a to-do never generates a reminder (never due, by construction)', () => {
    const tasks = [routine({ type: 'todo', isAsNeeded: false, cadence: null })];
    const result = buildRollingSchedule({ tasks, prefs: BASE_PREFS, today });
    expect(result).toHaveLength(0);
  });

  it('a soft-deleted task is excluded even if it would otherwise be due', () => {
    const tasks = [routine({ deletedAt: '2026-07-01T00:00:00.000Z' as never })];
    const result = buildRollingSchedule({ tasks, prefs: BASE_PREFS, today });
    expect(result).toHaveLength(0);
  });

  it('a course ending in 2 days fires exactly one course-ending-soon reminder', () => {
    const tasks = [
      routine({
        type: 'course',
        cadence: { kind: 'daily' },
        startDate: '2026-07-01' as never,
        endDate: '2026-07-29' as never,
      }),
    ];
    const result = buildRollingSchedule({ tasks, prefs: BASE_PREFS, today });
    const endingSoon = result.filter((r) => r.kind === 'course-ending-soon');
    expect(endingSoon).toHaveLength(1);
    expect(endingSoon[0]?.date).toBe('2026-07-27' as never); // clamped to today (natural fire date already passed)
  });

  it('a course ending outside the horizon generates no course-ending-soon reminder', () => {
    const tasks = [
      routine({
        type: 'course',
        cadence: { kind: 'daily' },
        startDate: '2026-07-01' as never,
        endDate: '2026-09-01' as never,
      }),
    ];
    const result = buildRollingSchedule({ tasks, prefs: BASE_PREFS, today });
    expect(result.some((r) => r.kind === 'course-ending-soon')).toBe(false);
  });
});
