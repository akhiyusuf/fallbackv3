/** House pattern (docs/MODULES.md top matter): plain jest, no RNTL needed for a non-UI service. */
import { router } from 'expo-router';

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

const mockSettingsGet = jest.fn();
const mockTasksList = jest.fn();
const mockLogsListForDate = jest.fn().mockResolvedValue([]);
const mockOffDaysListRange = jest.fn().mockResolvedValue([]);
jest.mock('@/db', () => ({
  repos: {
    settings: { get: () => mockSettingsGet() },
    tasks: { list: () => mockTasksList() },
    logs: { listForDate: () => mockLogsListForDate() },
    offDays: { listRange: () => mockOffDaysListRange() },
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

describe('notifications service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPermissions.mockResolvedValue({ granted: true });
    mockRequestPermissions.mockResolvedValue({ granted: true });
    mockSettingsGet.mockResolvedValue({ notifications: BASE_PREFS });
    mockTasksList.mockResolvedValue([]);
    mockLogsListForDate.mockResolvedValue([]);
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
    mockLogsListForDate.mockResolvedValue([]); // no chip ever set -> missed once the day has ended
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
});
