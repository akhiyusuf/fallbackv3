/**
 * M1. Verbatim copy for S01, S45, S47, S48, S50 — `design-input/fallback-handoff/uploads/
 * ALLSCREENS_1.md`. No paraphrasing; every string here is a direct quote from that file.
 */

export const S01_COPY = {
  wordmark: 'Fallback',
  tagline: 'Something beats nothing.',
  status: 'Loading your day…',
} as const;

export const S50_COPY = {
  headline: "Let's get you back on track",
  body: "We couldn't read your data on this device. Nothing is deleted — you can try again, or reset and start fresh.",
  tryAgain: 'Try again',
  resetAppData: 'Reset app data',
} as const;

export const S45_COPY = {
  title: 'Account & sync',
  noLoginHeadline: 'No login.',
  noLoginBody: 'Your data lives on this device — no account to create or password to lose.',
  onDeviceLabel: 'On-device (default)',
  iCloudSyncLabel: 'iCloud sync',
  androidSyncLabel: 'Cloud sync',
  lastSyncedPrefix: 'Last synced',
  offHelper: 'Your data stays only on this device.',
  failure: "Couldn't sync right now. Your data is safe on this device — we'll try again automatically.",
} as const;

export const S47_COPY = {
  title: 'Data',
  backUpNow: 'Back up now',
  noBackupYet: 'No backup yet.',
  lastBackupPrefix: 'Last backup:',
  restoreFromBackup: 'Restore from backup',
  restoreSubcopy: 'Choose a backup file saved on this device.',
  restoreFailure: "We couldn't read the backup file. Your current data is untouched — nothing was overwritten.",
  tryDifferentFile: 'Try a different file',
  eraseRow: 'Erase all data',
  eraseSubcopy: 'Permanently remove everything from this device.',
  backupSuccessPrefix: 'Backed up —',
  backupFailureToast: "Couldn't back up — try again",
  restoreSuccessToast: 'Restored — your data is back.',
} as const;

export const S48_COPY = {
  headlineFromData: 'Erase all data?',
  headlineFromRecovery: 'Reset app data?',
  bodyFromData:
    "Every routine, event, course, to-do — and all your history — will be permanently removed from this device. This can't be undone.",
  bodyFromRecovery: "Your data on this device couldn't be read. Resetting clears everything and starts fresh. This can't be undone.",
  eraseButton: 'Erase everything',
  cancelButton: 'Cancel',
  midWipeFailure: 'Something went wrong erasing your data. Nothing was lost — try again.',
} as const;
