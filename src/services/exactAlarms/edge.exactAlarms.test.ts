/** Round 4: the native wrapper is silent everywhere but an Android phone that has the module. */
const mockNative = { canScheduleExactAlarms: jest.fn(() => false), openExactAlarmSettings: jest.fn(() => true) };
let mockModule: unknown = mockNative;
let mockThrow = false;
jest.mock('expo', () => ({
  requireOptionalNativeModule: () => {
    if (mockThrow) throw new Error('boom');
    return mockModule;
  },
}));

import { Platform } from 'react-native';

import { exactRemindersAllowed, openExactReminderSettings } from './index';

const original = Platform.OS;
afterEach(() => {
  Platform.OS = original;
});
beforeEach(() => {
  mockModule = mockNative;
  mockThrow = false;
  mockNative.canScheduleExactAlarms.mockReset().mockReturnValue(false);
  mockNative.openExactAlarmSettings.mockReset().mockReturnValue(true);
});

describe('exact alarms wrapper', () => {
  it('Android with the module: reports and opens', () => {
    Platform.OS = 'android';
    expect(exactRemindersAllowed()).toBe(false);
    mockNative.canScheduleExactAlarms.mockReturnValue(true);
    expect(exactRemindersAllowed()).toBe(true);
    expect(openExactReminderSettings()).toBe(true);
    mockNative.openExactAlarmSettings.mockReturnValue(false);
    expect(openExactReminderSettings()).toBe(false);
  });

  it('iOS and web: exact (nothing shown), opening reports false, the module is never touched', () => {
    for (const os of ['ios', 'web'] as const) {
      Platform.OS = os;
      expect(exactRemindersAllowed()).toBe(true);
      expect(openExactReminderSettings()).toBe(false);
    }
    expect(mockNative.canScheduleExactAlarms).not.toHaveBeenCalled();
    expect(mockNative.openExactAlarmSettings).not.toHaveBeenCalled();
  });

  it('Android without the native module (null): treated as exact, open reports false', () => {
    Platform.OS = 'android';
    mockModule = null;
    expect(exactRemindersAllowed()).toBe(true);
    expect(openExactReminderSettings()).toBe(false);
  });

  it('a module that throws, or a lookup that throws, never escapes', () => {
    Platform.OS = 'android';
    mockNative.canScheduleExactAlarms.mockImplementation(() => {
      throw new Error('x');
    });
    mockNative.openExactAlarmSettings.mockImplementation(() => {
      throw new Error('y');
    });
    expect(exactRemindersAllowed()).toBe(true);
    expect(openExactReminderSettings()).toBe(false);
    mockThrow = true;
    expect(exactRemindersAllowed()).toBe(true);
    expect(openExactReminderSettings()).toBe(false);
  });
});
