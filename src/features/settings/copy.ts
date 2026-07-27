/**
 * M7. Verbatim copy for S41, S42, S43, S46, S49 —
 * `design-input/fallback-handoff/uploads/ALLSCREENS_1.md`.
 */

export const S41_COPY = {
  title: 'Settings',
  profileName: 'Maya',
  levelPrefix: 'Level',
  statSuffix: '% showing up',
  statLoadError: "Couldn't load your stats",
  retry: 'Retry',
  sections: [
    { label: 'Progress & Achievements', rows: ['Badges', 'Records'] },
    { label: 'Preferences', rows: ['Notifications', 'Theme & accent', 'Widgets'] },
    { label: 'Fallback AI', rows: ['Fallback AI subscription', 'Conversation history'] },
    { label: 'Account & Data', rows: ['Account & sync', 'Data'] },
    { label: 'Support', rows: ['Help & about'] },
  ],
  rowSubcopy: { Records: 'Weekly & monthly recaps' } as Record<string, string>,
} as const;

export const S42_COPY = {
  title: 'Notifications',
  masterLabel: 'Notifications',
  masterOnSubcopy: 'Reminders and encouragement, on your terms.',
  remindersSection: 'Reminders',
  reminderRows: { routineDue: 'Routine due', eventStarting: 'Event starting', courseDose: 'Course dose', courseEndingSoon: 'Course ending soon' },
  encouragementSection: 'Encouragement',
  encouragementRows: { gentleReentry: 'Gentle re-entry', milestoneReached: 'Milestone reached' },
  digestRow: 'Daily digest',
  emptyHeadline: 'No notifications set',
  emptySubcopy: "You won't get reminders or nudges. You can turn on just the ones you want, anytime.",
  errorToast: "Couldn't save — try again.",
} as const;

export const S43_COPY = {
  title: 'Theme & accent',
  appearanceLabel: 'Appearance',
  appearanceOptions: [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'auto', label: 'Auto' },
  ],
  accentLabel: 'Accent color',
  accentHelper: 'Accent only recolors CTAs & progress — never the signal colors.',
  previewTaskName: 'Morning workout',
  previewTaskMeta: 'Full workout · 7:00 AM',
  previewCta: 'Log fallback',
  previewStat: '3 of 5 done today',
  previewCaption: 'Signal colors (ideal, fallback, off, missed) never change with your accent.',
  stateChipLabels: { done: 'Done/Ideal', fallback: 'Fallback', skip: 'Skip', off: 'Off' },
  errorToast: "Couldn't save — try again.",
} as const;

export const S46_COPY = {
  title: 'Widgets',
  gallery: [
    { size: 'small-today' as const, label: 'Small · Today', preview: '3/5 done' },
    { size: 'small-one-task' as const, label: 'Small · One task', preview: 'Morning workout' },
    { size: 'medium-up-next' as const, label: 'Medium · Up next', preview: 'Next 2 tasks' },
  ],
  fixedTask: 'Fixed task',
  smartNextDue: 'Smart — next due',
  smartHelper: 'Always shows whichever task is due soonest.',
  save: 'Save',
  footer: 'Widgets refresh automatically and always match your current theme and accent.',
  savedToast: 'Widget updated.',
  errorToast: "Couldn't save — try again.",
} as const;

export const S49_COPY = {
  title: 'Help & about',
  // `a11yDestination` — review pass 1, blocking item 7: each row must announce its OWN
  // destination type ("Contact support, opens email"), not one blanket "opens email" label
  // copied across all three Support rows.
  supportSection: [
    { label: 'Contact support', toast: 'Opening your email app…', a11yDestination: 'opens email' },
    { label: 'FAQ & guides', toast: 'Opening FAQ & guides…', a11yDestination: 'opens an external help center' },
    { label: 'Rate Fallback', toast: 'Opening the App Store…', a11yDestination: 'opens the app store' },
  ],
  legalSection: [
    { label: 'Privacy policy', toast: 'Opening…' },
    { label: 'Terms of service', toast: 'Opening…' },
  ],
  privacy: 'No login. Your data lives on this device — no account to create or password to lose.',
  version: 'Fallback · version 1.0.0 (build 128)',
  tagline: 'Made with care · Something beats nothing.',
} as const;
