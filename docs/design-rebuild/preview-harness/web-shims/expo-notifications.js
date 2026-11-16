// Preview: reminders are recorded, never delivered.
let granted = false; const scheduled = [];
const perm = () => ({ granted, status: granted ? 'granted' : 'undetermined', canAskAgain: true, expires: 'never', ios: { status: granted ? 2 : 0 } });
const publish = () => { try { window.__fallbackPreview = window.__fallbackPreview || {}; window.__fallbackPreview.scheduled = scheduled.slice(); window.dispatchEvent(new Event('fallback-preview:reminders')); } catch {} };
export const SchedulableTriggerInputTypes = { CALENDAR: 'calendar', DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly', DATE: 'date', TIME_INTERVAL: 'timeInterval' };
export const AndroidImportance = { DEFAULT: 3, HIGH: 4, LOW: 2, MAX: 5, MIN: 1, NONE: 0 };
export const getPermissionsAsync = async () => perm();
export const requestPermissionsAsync = async () => { granted = true; return perm(); };
export const scheduleNotificationAsync = async (req) => { const id = 'n' + (scheduled.length + 1) + '-' + Date.now(); scheduled.push({ id, ...req }); publish(); return id; };
export const cancelAllScheduledNotificationsAsync = async () => { scheduled.length = 0; publish(); };
export const cancelScheduledNotificationAsync = async (id) => { const i = scheduled.findIndex((s) => s.id === id); if (i >= 0) scheduled.splice(i, 1); publish(); };
export const getAllScheduledNotificationsAsync = async () => scheduled.slice();
export const setNotificationHandler = () => {};
export const setNotificationChannelAsync = async () => null;
export const addNotificationResponseReceivedListener = () => ({ remove() {} });
export const addNotificationReceivedListener = () => ({ remove() {} });
export const getLastNotificationResponseAsync = async () => null;
