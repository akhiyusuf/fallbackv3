/** House pattern (docs/MODULES.md top matter): plain jest, no RNTL needed for a non-UI service. */
import { router } from 'expo-router';

import { emit } from '@/lib/events';
import { addDays, today } from '@/lib/date';

const mockCancelAll = jest.fn().mockResolvedValue(undefined);
const mockSchedule = jest.fn().mockResolvedValue('id');
const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();

const mockAddResponseListener = jest.fn().mockReturnValue({ remove: jest.fn() });
jest.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: () => mockCancelAll(),
  scheduleNotificationAsync: (req: unknown) => mockSchedule(req),
  getPermissionsAsync: () => mockGetPermissions(),
  requestPermissionsAsync: () => mockRequestPermissions(),
  addNotificationResponseReceivedListener: (listener: unknown) => mockAddResponseListener(listener),
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const mockClearOnboardingProgress = jest.fn().mockResolvedValue(undefined);
jest.mock('@/features/onboarding/progress', () => ({ clearOnboardingProgress: () => mockClearOnboardingProgress() }));

const mockSettingsGet = jest.fn();
const mockTasksList = jest.fn();
/** Per-date log rows, keyed by exact LocalDate — tests set this to exercise movedInLog/vacated lookups. */
const logsByDate = new Map<string, unknown[]>();
const mockLogsListForDate = jest.fn((date: string) => Promise.resolve(logsByDate.get(date) ?? []));
const mockLogsListRange = jest.fn((from: string, to: string) => {
  const out: unknown[] = [];
  for (const [date, logs] of logsByDate) {
    if (date >= from && date <= to) out.push(...logs);
  }
  return Promise.resolve(out);
});
const mockOffDaysListRange = jest.fn().mockResolvedValue([]);
jest.mock('@/db', () => ({
  repos: {
    settings: { get: () => mockSettingsGet() },
    tasks: { list: () => mockTasksList() },
    logs: { listForDate: (date: string) => mockLogsListForDate(date), listRange: (from: string, to: string) => mockLogsListRange(from, to) },
    offDays: { listRange: () => mockOffDaysListRange() },
  },
}));

/** Flushes every pending microtask (safe for the multi-await chains inside `reschedule()`). */
const flushAsync = () => new Promise((resolve) => setImmediate(resolve));

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

describe('notifications service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logsByDate.clear();
    mockGetPermissions.mockResolvedValue({ granted: true });
    mockRequestPermissions.mockResolvedValue({ granted: true });
    mockSettingsGet.mockResolvedValue({ notifications: BASE_PREFS });
    mockTasksList.mockResolvedValue([]);
    mockOffDaysListRange.mockResolvedValue([]);
  });

  it('requestPermission surfaces the granted flag as ok(true)', async () => {
    const { notifications } = require('./index') as typeof import('./index');
    const result = await notifications.requestPermission();
    expect(result).toEqual({ ok: true, value: true });
  });

  it('requestPermission surfaces a decline as ok(false), never an error', async () => {
    mockRequestPermissions.mockResolvedValue({ granted: false });
    const { notifications } = require('./index') as typeof import('./index');
    const result = await notifications.requestPermission();
    expect(result).toEqual({ ok: true, value: false });
  });

  it('hasPermission reflects the current OS permission state', async () => {
    mockGetPermissions.mockResolvedValue({ granted: false });
    const { notifications } = require('./index') as typeof import('./index');
    await expect(notifications.hasPermission()).resolves.toBe(false);
  });

  it('reschedule always clears first (idempotent re-arm), even when master is off', async () => {
    mockSettingsGet.mockResolvedValue({ notifications: { ...BASE_PREFS, master: false } });
    const { notifications } = require('./index') as typeof import('./index');
    await notifications.reschedule();
    expect(mockCancelAll).toHaveBeenCalledTimes(1);
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('reschedule is a silent no-op when permission is declined — never an error (F9/F14)', async () => {
    mockGetPermissions.mockResolvedValue({ granted: false });
    const { notifications } = require('./index') as typeof import('./index');
    const result = await notifications.reschedule();
    expect(result.ok).toBe(true);
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('reschedule schedules a reminder per due tracked routine when master is on and permission is granted', async () => {
    mockTasksList.mockResolvedValue([
      {
        id: 'r1',
        type: 'routine',
        name: 'Evening walk',
        isAsNeeded: false,
        cadence: { kind: 'daily' },
        timeOfDay: null,
        endDate: null,
        deletedAt: null,
        idealSteps: [],
        fallbackSteps: [],
        dosesPerDay: 1,
      },
    ]);
    const { notifications } = require('./index') as typeof import('./index');
    const result = await notifications.reschedule();
    expect(result.ok).toBe(true);
    expect(mockSchedule).toHaveBeenCalled();
    // 7 routine-due reminders (rolling horizon) + 1 gentle-reentry (no log yesterday -> missed).
    expect(mockSchedule.mock.calls.length).toBe(8);
  });

  it('cancelAll clears every scheduled notification', async () => {
    const { notifications } = require('./index') as typeof import('./index');
    const result = await notifications.cancelAll();
    expect(result.ok).toBe(true);
    expect(mockCancelAll).toHaveBeenCalledTimes(1);
  });

  it('reschedule fires a single gentle-reentry notification when a due, tracked task was missed yesterday', async () => {
    mockTasksList.mockResolvedValue([
      { id: 't1', type: 'routine', name: 'Evening walk', isAsNeeded: false, cadence: { kind: 'daily' }, timeOfDay: null, endDate: null, deletedAt: null, idealSteps: [], fallbackSteps: [], dosesPerDay: 1 },
    ]);
    const { notifications } = require('./index') as typeof import('./index');
    await notifications.reschedule();
    const reentryCall = mockSchedule.mock.calls.find((c) => c[0].content.data?.kind === 'gentle-reentry');
    expect(reentryCall).toBeTruthy();
    expect(reentryCall[0].content.data.taskId).toBe('t1');
  });

  it('reschedule sends no gentle-reentry notification when the preference is off', async () => {
    mockSettingsGet.mockResolvedValue({ notifications: { ...BASE_PREFS, gentleReentry: false } });
    mockTasksList.mockResolvedValue([
      { id: 't1', type: 'routine', name: 'Evening walk', isAsNeeded: false, cadence: { kind: 'daily' }, timeOfDay: null, endDate: null, deletedAt: null, idealSteps: [], fallbackSteps: [], dosesPerDay: 1 },
    ]);
    const { notifications } = require('./index') as typeof import('./index');
    await notifications.reschedule();
    expect(mockSchedule.mock.calls.some((c) => c[0].content.data?.kind === 'gentle-reentry')).toBe(false);
  });

  it('initNotificationsBridge registers a tap listener that deep-links a gentle-reentry tap to /today?reentry=1&taskId=<id>', async () => {
    const { initNotificationsBridge } = require('./index') as typeof import('./index');
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const dispose = initNotificationsBridge();

    expect(mockAddResponseListener).toHaveBeenCalled();
    const listener = mockAddResponseListener.mock.calls[0][0];
    listener({ notification: { request: { content: { data: { kind: 'gentle-reentry', taskId: 'abc-123' } } } } });
    expect(push).toHaveBeenCalledWith('/today?reentry=1&taskId=abc-123');

    push.mockRestore();
    dispose();
  });

  it('a tap on a plain routine-due notification opens Today with no query params', async () => {
    const { initNotificationsBridge } = require('./index') as typeof import('./index');
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const dispose = initNotificationsBridge();

    const listener = mockAddResponseListener.mock.calls[0][0];
    listener({ notification: { request: { content: { data: { kind: 'routine-due', taskId: 'abc-123' } } } } });
    expect(push).toHaveBeenCalledWith('/today');

    push.mockRestore();
    dispose();
  });

  it('store:erased cancels every armed reminder AND clears the onboarding resume pointer (review pass 1, blocking item 2)', async () => {
    const { initNotificationsBridge } = require('./index') as typeof import('./index');
    const dispose = initNotificationsBridge();
    mockCancelAll.mockClear(); // initNotificationsBridge's own mount-time reschedule() already cleared once

    emit({ type: 'store:erased' });
    await flushAsync();

    expect(mockCancelAll).toHaveBeenCalled();
    expect(mockClearOnboardingProgress).toHaveBeenCalled();
    dispose();
  });

  it('store:ready re-arms reminders (initial publish on fresh/reopened boot)', async () => {
    const { initNotificationsBridge } = require('./index') as typeof import('./index');
    const dispose = initNotificationsBridge();
    mockSchedule.mockClear();
    mockTasksList.mockResolvedValue([
      { id: 'r1', type: 'routine', name: 'Evening walk', isAsNeeded: false, cadence: { kind: 'daily' }, timeOfDay: null, endDate: null, deletedAt: null, idealSteps: [], fallbackSteps: [], dosesPerDay: 1 },
    ]);

    emit({ type: 'store:ready' });
    await flushAsync();

    expect(mockSchedule).toHaveBeenCalled();
    dispose();
  });

  it('gentle re-entry fires for a task that was MISSED yesterday only via a snoozed-in (visitor) occurrence — bare date-keyed resolution would miss this (review pass 1, blocking item 3)', async () => {
    const yesterday = addDays(today(), -1);
    const dayBeforeYesterday = addDays(yesterday, -1);
    mockTasksList.mockResolvedValue([
      { id: 't1', type: 'routine', name: 'Evening walk', isAsNeeded: false, cadence: { kind: 'weekly', days: [] }, timeOfDay: null, endDate: null, deletedAt: null, idealSteps: [], fallbackSteps: [], dosesPerDay: 1 },
    ]);
    // t1 is NOT naturally due yesterday (weekly, no days) — but its own row at
    // `dayBeforeYesterday` was snoozed forward INTO yesterday (`movedToDate === yesterday`),
    // making it a visitor occurrence there. No chip was ever set on the visitor row -> missed.
    logsByDate.set(dayBeforeYesterday, [
      { taskId: 't1', date: dayBeforeYesterday, chipState: null, isManualOverride: false, completedStepIds: [], dosesCompleted: 0, movedToDate: yesterday, createdAt: '', updatedAt: '' },
    ]);
    const { notifications } = require('./index') as typeof import('./index');
    await notifications.reschedule();
    const reentryCall = mockSchedule.mock.calls.find((c) => c[0].content.data?.kind === 'gentle-reentry');
    expect(reentryCall).toBeTruthy();
    expect(reentryCall[0].content.data.taskId).toBe('t1');
  });

  it('no routine-due reminder fires on a date the user snoozed AWAY, even though cadence still says it is due (review pass 1, blocking item 3)', async () => {
    const vacatedDate = today();
    mockTasksList.mockResolvedValue([
      { id: 't1', type: 'routine', name: 'Evening walk', isAsNeeded: false, cadence: { kind: 'daily' }, timeOfDay: null, endDate: null, deletedAt: null, idealSteps: [], fallbackSteps: [], dosesPerDay: 1 },
    ]);
    // t1's own row at today is vacated (moved forward) — cadence still says today is due, but
    // the occurrence itself was relocated, so no "routine due" reminder should fire for today.
    logsByDate.set(vacatedDate, [
      { taskId: 't1', date: vacatedDate, chipState: null, isManualOverride: false, completedStepIds: [], dosesCompleted: 0, movedToDate: addDays(vacatedDate, 1), createdAt: '', updatedAt: '' },
    ]);
    const { notifications } = require('./index') as typeof import('./index');
    await notifications.reschedule();
    const todayReminder = mockSchedule.mock.calls.find(
      (c) => c[0].content.data?.kind === 'routine-due' && c[0].identifier === `fallback-reminder:routine-due:t1:${vacatedDate}`,
    );
    expect(todayReminder).toBeUndefined();
  });
});
