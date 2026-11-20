/**
 * Edge-case campaign (review/EDGE-BRIEF.md, area 22): reminders for things that happen without
 * the app on screen. Same mock harness as `index.test.ts`; plain jest, no RNTL.
 */
import { addDays, today } from '@/lib/date';

const mockCancelAll = jest.fn().mockResolvedValue(undefined);
const mockSchedule = jest.fn().mockResolvedValue('id');
const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();

jest.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: () => mockCancelAll(),
  scheduleNotificationAsync: (req: unknown) => mockSchedule(req),
  getPermissionsAsync: () => mockGetPermissions(),
  requestPermissionsAsync: () => mockRequestPermissions(),
  addNotificationResponseReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

jest.mock('@/features/onboarding/progress', () => ({ clearOnboardingProgress: jest.fn().mockResolvedValue(undefined) }));

const mockSettingsGet = jest.fn();
const mockTasksList = jest.fn();
const logsByDate = new Map<string, unknown[]>();
const mockLogsListForDate = jest.fn((date: string) => Promise.resolve(logsByDate.get(date) ?? []));
const mockLogsListRange = jest.fn((from: string, to: string) => {
  const out: unknown[] = [];
  for (const [date, logs] of logsByDate) if (date >= from && date <= to) out.push(...logs);
  return Promise.resolve(out);
});
const offMarks: unknown[] = [];
const mockOffDaysListRange = jest.fn((from: string, to: string) =>
  Promise.resolve(offMarks.filter((m) => (m as { date: string }).date >= from && (m as { date: string }).date <= to)),
);
jest.mock('@/db', () => ({
  store: { status: () => 'ready' },
  repos: {
    settings: { get: () => mockSettingsGet() },
    tasks: { list: () => mockTasksList() },
    logs: { listForDate: (d: string) => mockLogsListForDate(d), listRange: (f: string, t: string) => mockLogsListRange(f, t) },
    offDays: { listRange: (f: string, t: string) => mockOffDaysListRange(f, t) },
  },
}));

const BASE_PREFS = {
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

const LONG_AGO = addDays(today(), -30);
const TODAY = today();
const YESTERDAY = addDays(TODAY, -1);

/** A tracked daily routine with the fields the services read. */
function routine(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    type: 'routine',
    name: `Habit ${id}`,
    isAsNeeded: false,
    cadence: { kind: 'daily' },
    timeOfDay: null,
    endDate: null,
    endedOn: null,
    startDate: null,
    eventDate: null,
    deletedAt: null,
    idealSteps: [],
    fallbackSteps: [],
    dosesPerDay: 1,
    createdAt: LONG_AGO,
    ...over,
  };
}

const reminders = () => mockSchedule.mock.calls.map((c) => c[0] as { identifier: string; content: { data?: { kind?: string; taskId?: string } }; trigger: { date: Date } });
const routineDueFor = (taskId: string) => reminders().filter((r) => r.content.data?.kind === 'routine-due' && r.content.data?.taskId === taskId);
const reentry = () => reminders().filter((r) => r.content.data?.kind === 'gentle-reentry');

const flush = () => new Promise<void>((resolve) => setImmediate(() => resolve()));

describe('reminders: edge cases without the app on screen', () => {
  beforeEach(() => {
    // Only reminders still ahead are scheduled. Pin "now" to just before today began, so every one
    // of today's times counts as ahead whatever time of day the suite runs.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    jest.spyOn(Date, 'now').mockReturnValue(startOfToday.getTime() - 1);
    jest.clearAllMocks();
    logsByDate.clear();
    offMarks.length = 0;
    mockGetPermissions.mockResolvedValue({ granted: true });
    mockRequestPermissions.mockResolvedValue({ granted: true });
    mockSettingsGet.mockResolvedValue({ notifications: BASE_PREFS });
    mockTasksList.mockResolvedValue([]);
  });

  describe('which occurrences get a reminder', () => {
    it('a habit logged done today gets no reminder for today, and still gets the other six days', async () => {
      logsByDate.set(TODAY, [{ taskId: 'r1', date: TODAY, chipState: 'done', isManualOverride: true, completedStepIds: [], dosesCompleted: 1, movedToDate: null }]);
      mockTasksList.mockResolvedValue([routine('r1')]);
      const { notifications } = require('./index') as typeof import('./index');
      await notifications.reschedule();
      const dates = routineDueFor('r1').map((r) => r.identifier.split(':').pop());
      expect(dates).not.toContain(TODAY);
      expect(dates).toHaveLength(6);
    });

    it('a habit skipped (missed) today gets no reminder for the rest of today', async () => {
      logsByDate.set(TODAY, [{ taskId: 'r1', date: TODAY, chipState: 'skip', isManualOverride: true, completedStepIds: [], dosesCompleted: 0, movedToDate: null }]);
      mockTasksList.mockResolvedValue([routine('r1')]);
      const { notifications } = require('./index') as typeof import('./index');
      await notifications.reschedule();
      expect(routineDueFor('r1').some((r) => r.identifier.endsWith(`:${TODAY}`))).toBe(false);
    });

    it('a day off for every habit silences that day only', async () => {
      offMarks.push({ id: 'o1', date: TODAY, taskId: null, priorChipState: null, createdAt: '' });
      mockTasksList.mockResolvedValue([routine('r1'), routine('r2')]);
      const { notifications } = require('./index') as typeof import('./index');
      await notifications.reschedule();
      for (const id of ['r1', 'r2']) {
        const dates = routineDueFor(id).map((r) => r.identifier.split(':').pop());
        expect(dates).not.toContain(TODAY);
        expect(dates).toHaveLength(6);
      }
    });

    it('a day off for one habit silences only that habit', async () => {
      offMarks.push({ id: 'o2', date: TODAY, taskId: 'r2', priorChipState: null, createdAt: '' });
      mockTasksList.mockResolvedValue([routine('r1'), routine('r2')]);
      const { notifications } = require('./index') as typeof import('./index');
      await notifications.reschedule();
      expect(routineDueFor('r1').some((r) => r.identifier.endsWith(`:${TODAY}`))).toBe(true);
      expect(routineDueFor('r2').some((r) => r.identifier.endsWith(`:${TODAY}`))).toBe(false);
    });

    it('a habit ended three days ago gets no reminders at all, and no re-entry nudge', async () => {
      mockTasksList.mockResolvedValue([routine('r1', { endedOn: addDays(TODAY, -3) })]);
      const { notifications } = require('./index') as typeof import('./index');
      await notifications.reschedule();
      expect(routineDueFor('r1')).toHaveLength(0);
      expect(reentry()).toHaveLength(0);
    });

    it('a habit ended yesterday does not send a "yesterday slipped by" nudge for a habit the person ended', async () => {
      mockTasksList.mockResolvedValue([routine('r1', { endedOn: YESTERDAY })]);
      const { notifications } = require('./index') as typeof import('./index');
      await notifications.reschedule();
      expect(reentry()).toHaveLength(0);
    });

    it('as-needed habits, to-dos and deleted habits get no reminders of any kind', async () => {
      mockTasksList.mockResolvedValue([
        routine('asneeded', { isAsNeeded: true, cadence: null }),
        routine('todo', { type: 'todo', cadence: null }),
        routine('deleted', { deletedAt: '2026-11-01T00:00:00.000Z' }),
      ]);
      const { notifications } = require('./index') as typeof import('./index');
      await notifications.reschedule();
      expect(reminders()).toHaveLength(0);
    });

    it('a one-off event reminds once, on its own date only', async () => {
      const eventDate = addDays(TODAY, 2);
      mockTasksList.mockResolvedValue([routine('e1', { type: 'event', cadence: null, eventDate, name: 'Dentist' })]);
      const { notifications } = require('./index') as typeof import('./index');
      await notifications.reschedule();
      const eventReminders = reminders().filter((r) => r.content.data?.kind === 'event-starting');
      expect(eventReminders).toHaveLength(1);
      expect(eventReminders[0]?.identifier).toBe(`fallback-reminder:event-starting:e1:${eventDate}`);
    });

    it('a course stops giving dose reminders after its end date', async () => {
      const endDate = addDays(TODAY, 1);
      mockTasksList.mockResolvedValue([
        routine('c1', { type: 'course', name: 'Antibiotics', startDate: TODAY, endDate, cadence: { kind: 'daily' } }),
      ]);
      const { notifications } = require('./index') as typeof import('./index');
      await notifications.reschedule();
      const doses = reminders().filter((r) => r.content.data?.kind === 'course-dose');
      expect(doses.map((r) => r.identifier.split(':').pop())).toEqual([TODAY, endDate]);
    });

    it('a snoozed-away day gets no reminder, but its snooze target still reminds only if it is naturally due', async () => {
      logsByDate.set(TODAY, [{ taskId: 'r1', date: TODAY, chipState: null, isManualOverride: false, completedStepIds: [], dosesCompleted: 0, movedToDate: addDays(TODAY, 1), createdAt: '', updatedAt: '' }]);
      mockTasksList.mockResolvedValue([routine('r1')]);
      const { notifications } = require('./index') as typeof import('./index');
      await notifications.reschedule();
      const dates = routineDueFor('r1').map((r) => r.identifier.split(':').pop());
      expect(dates).not.toContain(TODAY);
      expect(dates).toContain(addDays(TODAY, 1));
    });

    // Known gap, left for the main session (see the report). A push to tomorrow is additive: it
    // creates a second occurrence on D+1. That occurrence is real and due, but the schedule only
    // looks at cadence, so a weekly habit that is not naturally due tomorrow gets no reminder.
    it.failing('GAP: a pushed-in occurrence on a day the habit is not naturally due still gets a reminder', async () => {
      logsByDate.set(TODAY, [{ taskId: 'w1', date: TODAY, chipState: null, isManualOverride: false, completedStepIds: [], dosesCompleted: 0, movedToDate: addDays(TODAY, 1), createdAt: '', updatedAt: '' }]);
      mockTasksList.mockResolvedValue([routine('w1', { cadence: { kind: 'weekly', weekday: ((new Date(`${TODAY}T12:00:00`).getDay() + 6) % 7) + 1, anchorDate: LONG_AGO } })]);
      const { notifications } = require('./index') as typeof import('./index');
      await notifications.reschedule();
      expect(routineDueFor('w1').some((r) => r.identifier.endsWith(`:${addDays(TODAY, 1)}`))).toBe(true);
    });
  });

  describe('rescheduling after a change', () => {
    it('a time change moves the same reminder, with a stable identifier and the new clock time', async () => {
      const { notifications } = require('./index') as typeof import('./index');
      mockTasksList.mockResolvedValue([routine('r1', { timeOfDay: '07:30' })]);
      await notifications.reschedule();
      const before = routineDueFor('r1').find((r) => r.identifier.endsWith(`:${TODAY}`));
      mockSchedule.mockClear();
      mockTasksList.mockResolvedValue([routine('r1', { timeOfDay: '22:15' })]);
      await notifications.reschedule();
      const after = routineDueFor('r1').find((r) => r.identifier.endsWith(`:${TODAY}`));
      expect(after?.identifier).toBe(before?.identifier);
      expect(after?.trigger.date.getHours()).toBe(22);
      expect(after?.trigger.date.getMinutes()).toBe(15);
    });

    it('a time already passed today is not scheduled (Android would fire it at once), later ones are', async () => {
      const now = new Date();
      now.setHours(12, 0, 0, 0);
      (Date.now as jest.Mock).mockReturnValue(now.getTime());
      mockTasksList.mockResolvedValue([routine('early', { timeOfDay: '08:00' }), routine('evening', { timeOfDay: '20:00' })]);
      const { notifications } = require('./index') as typeof import('./index');
      await notifications.reschedule();
      expect(routineDueFor('early').some((r) => r.identifier.endsWith(`:${TODAY}`))).toBe(false);
      expect(routineDueFor('early').some((r) => r.identifier.endsWith(`:${addDays(TODAY, 1)}`))).toBe(true);
      expect(routineDueFor('evening').some((r) => r.identifier.endsWith(`:${TODAY}`))).toBe(true);
      expect(reminders().every((r) => r.trigger.date.getTime() > now.getTime())).toBe(true);
    });

    it('a 00:00 time and a 23:59 time both land on the exact minute of their day', async () => {
      mockTasksList.mockResolvedValue([routine('midnight', { timeOfDay: '00:00' }), routine('late', { timeOfDay: '23:59' })]);
      const { notifications } = require('./index') as typeof import('./index');
      await notifications.reschedule();
      const midnight = routineDueFor('midnight').find((r) => r.identifier.endsWith(`:${TODAY}`));
      const late = routineDueFor('late').find((r) => r.identifier.endsWith(`:${TODAY}`));
      expect([midnight?.trigger.date.getHours(), midnight?.trigger.date.getMinutes()]).toEqual([0, 0]);
      expect([late?.trigger.date.getHours(), late?.trigger.date.getMinutes()]).toEqual([23, 59]);
    });

    it('a re-arm that started before the master switch was turned off cannot re-arm after the cancel', async () => {
      mockSettingsGet
        .mockResolvedValueOnce({ notifications: BASE_PREFS })
        .mockResolvedValueOnce({ notifications: { ...BASE_PREFS, master: false } });
      mockTasksList.mockResolvedValue([routine('r1')]);
      const { notifications } = require('./index') as typeof import('./index');
      await Promise.all([notifications.reschedule(), notifications.reschedule()]);
      await flush();
      const lastSchedule = Math.max(0, ...mockSchedule.mock.invocationCallOrder);
      const lastCancel = Math.max(...mockCancelAll.mock.invocationCallOrder);
      expect(lastCancel).toBeGreaterThan(lastSchedule);
    });

    it('master off: everything is cancelled and nothing is armed', async () => {
      mockSettingsGet.mockResolvedValue({ notifications: { ...BASE_PREFS, master: false } });
      mockTasksList.mockResolvedValue([routine('r1')]);
      const { notifications } = require('./index') as typeof import('./index');
      const result = await notifications.reschedule();
      expect(result.ok).toBe(true);
      expect(mockCancelAll).toHaveBeenCalled();
      expect(mockSchedule).not.toHaveBeenCalled();
    });

    it('permission denied: nothing is armed, no error, and reschedule never asks for permission itself', async () => {
      mockGetPermissions.mockResolvedValue({ granted: false });
      mockSettingsGet.mockResolvedValue({ notifications: { ...BASE_PREFS, dailyDigest: true } });
      mockTasksList.mockResolvedValue([routine('r1')]);
      const { notifications } = require('./index') as typeof import('./index');
      const result = await notifications.reschedule();
      expect(result.ok).toBe(true);
      expect(mockSchedule).not.toHaveBeenCalled();
      expect(mockRequestPermissions).not.toHaveBeenCalled();
    });
  });

  describe('the "missed yesterday" nudge', () => {
    it('is not sent for a habit created today, even with no log at all', async () => {
      mockTasksList.mockResolvedValue([routine('r1', { createdAt: `${TODAY}T08:00:00.000Z` })]);
      const { notifications } = require('./index') as typeof import('./index');
      await notifications.reschedule();
      expect(reentry()).toHaveLength(0);
    });

    it('is not sent when the habit was logged yesterday', async () => {
      logsByDate.set(YESTERDAY, [{ taskId: 'r1', date: YESTERDAY, chipState: 'fallback', isManualOverride: true, completedStepIds: [], dosesCompleted: 1, movedToDate: null }]);
      mockTasksList.mockResolvedValue([routine('r1')]);
      const { notifications } = require('./index') as typeof import('./index');
      await notifications.reschedule();
      expect(reentry()).toHaveLength(0);
    });

    it('is not sent when yesterday was a day off', async () => {
      offMarks.push({ id: 'o3', date: YESTERDAY, taskId: null, priorChipState: null, createdAt: '' });
      mockTasksList.mockResolvedValue([routine('r1')]);
      const { notifications } = require('./index') as typeof import('./index');
      await notifications.reschedule();
      expect(reentry()).toHaveLength(0);
    });

    it('is not sent for a deleted, as-needed or to-do habit that would otherwise look missed', async () => {
      mockTasksList.mockResolvedValue([
        routine('deleted', { deletedAt: '2026-11-01T00:00:00.000Z' }),
        routine('asneeded', { isAsNeeded: true, cadence: null }),
        routine('todo', { type: 'todo', cadence: null }),
      ]);
      const { notifications } = require('./index') as typeof import('./index');
      await notifications.reschedule();
      expect(reentry()).toHaveLength(0);
    });

    it('is sent at most once, even when several habits were missed', async () => {
      mockTasksList.mockResolvedValue([routine('r1'), routine('r2'), routine('r3')]);
      const { notifications } = require('./index') as typeof import('./index');
      await notifications.reschedule();
      expect(reentry()).toHaveLength(1);
    });

    it('is fired from a stable identifier, so a second re-arm the same day replaces it rather than doubling it', async () => {
      mockTasksList.mockResolvedValue([routine('r1')]);
      const { notifications } = require('./index') as typeof import('./index');
      await notifications.reschedule();
      await notifications.reschedule();
      const ids = reentry().map((r) => r.identifier);
      expect(new Set(ids).size).toBe(1);
      expect(ids[0]).toBe(`fallback-reminder:gentle-reentry:${YESTERDAY}`);
    });

    it('is not sent when the preference is off', async () => {
      mockSettingsGet.mockResolvedValue({ notifications: { ...BASE_PREFS, gentleReentry: false } });
      mockTasksList.mockResolvedValue([routine('r1')]);
      const { notifications } = require('./index') as typeof import('./index');
      await notifications.reschedule();
      expect(reentry()).toHaveLength(0);
    });
  });

  describe('many habits and the platform limit', () => {
    it('caps the batch at 64 pending reminders (iOS), and keeps the soonest ones', async () => {
      const tasks = Array.from({ length: 30 }, (_, i) => routine(`h${i}`));
      mockTasksList.mockResolvedValue(tasks);
      const { notifications } = require('./index') as typeof import('./index');
      await notifications.reschedule();
      expect(mockSchedule).toHaveBeenCalledTimes(64);
      // 30 habits due today, 30 tomorrow, then 4 of the day after: the soonest 64, in fire order.
      const dates = reminders().map((r) => r.trigger.date.getTime());
      expect(Math.max(...dates)).toBeLessThanOrEqual(new Date(addDays(TODAY, 2) + 'T23:59:59').getTime());
      const todayCount = reminders().filter((r) => r.identifier.endsWith(`:${TODAY}`)).length;
      expect(todayCount).toBe(30);
    });

    it('under the cap, every reminder is armed (no silent drops for a normal load)', async () => {
      mockTasksList.mockResolvedValue([routine('r1'), routine('r2'), routine('r3')]);
      const { notifications } = require('./index') as typeof import('./index');
      await notifications.reschedule();
      // 3 habits x 7 days + 1 re-entry nudge
      expect(mockSchedule).toHaveBeenCalledTimes(22);
    });
  });
});
