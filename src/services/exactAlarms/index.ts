/**
 * Exact reminder timing on Android (the app's own native module, `modules/exact-alarm`). Without
 * it, Android 14+ may deliver a reminder minutes late. Everywhere else, and wherever the module is
 * missing, timing is treated as exact and nothing is shown.
 */
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

interface ExactAlarmNative {
  canScheduleExactAlarms(): boolean;
  openExactAlarmSettings(): boolean;
}

function native(): ExactAlarmNative | null {
  if (Platform.OS !== 'android') return null;
  try {
    return requireOptionalNativeModule<ExactAlarmNative>('ExactAlarm');
  } catch {
    return null;
  }
}

/** True when reminders ring on the minute (or this is not a phone where it matters). */
export function exactRemindersAllowed(): boolean {
  try {
    return native()?.canScheduleExactAlarms() ?? true;
  } catch {
    return true;
  }
}

/** Opens Android's "Alarms and reminders" page for Fallback. False if it could not be opened. */
export function openExactReminderSettings(): boolean {
  try {
    return native()?.openExactAlarmSettings() ?? false;
  } catch {
    return false;
  }
}
