/**
 * M7. Verbatim copy for S41, S42, S43, S46, S49 —
 * `design-input/fallback-handoff/uploads/ALLSCREENS_1.md`.
 */

export const S41_COPY = {
  title: 'Settings',
  profileName: 'Your progress',
  levelPrefix: 'Level',
  statSuffix: '% showing up, last 30 days',
  statLoadError: "Couldn't load your stats",
  retry: 'Try again',
  sections: [
    { label: 'Progress and achievements', rows: ['Badges', 'Records'] },
    { label: 'Preferences', rows: ['Notifications', 'Theme and accent', 'Widgets'] },
    { label: 'Fallback AI', rows: ['Fallback AI subscription', 'Conversation history', 'AI agent access'] },
    { label: 'Account and data', rows: ['Account and sync', 'Data'] },
    { label: 'Support', rows: ['Help and about'] },
  ],
  rowSubcopy: { Records: 'Weekly and monthly recaps', 'AI agent access': 'Let an AI app you use help, with your permission' } as Record<string, string>,
} as const;

export const S42_COPY = {
  exactTimingLabel: 'Ring reminders on time',
  /** Android's page would not open: calm, and says where to try again. */
  exactTimingCannotOpen: 'That page would not open. You can try again in Settings, under Notifications.',
  exactTimingOff: 'Off: Android may hold them back a few minutes. Tap to allow.',
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
  errorToast: "Couldn't save. Try again.",
} as const;

export const S43_COPY = {
  title: 'Theme and accent',
  appearanceLabel: 'Appearance',
  appearanceOptions: [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'auto', label: 'Auto' },
  ],
  accentLabel: 'Accent color',
  accentHelper: 'A theme recolors the whole app. Ideal green and fallback blue never change.',
  moreColoursLabel: 'More colors',
  moreColoursHelper: "Greens, sky blues, golds and reds aren't offered. Those colors already mean ideal, fallback, XP and errors.",
  previewTaskName: 'Morning workout',
  previewIdeal: 'Full workout',
  previewFallback: '10 push-ups',
  previewNote: 'This is the same card you see on Today. Tap it to try the colors.',
  previewTaskMeta: 'Full workout · 7:00 AM',
  previewCta: 'Log fallback',
  previewStat: '3 of 5 done today',
  previewCaption: 'Ideal, fallback and off-day colors never change with your accent.',
  stateChipLabels: { done: 'Done', fallback: 'Fallback', skip: 'Skip', off: 'Off' },
  errorToast: "Couldn't save. Try again.",
} as const;

export const S46_COPY = {
  title: 'Widgets',
  gallery: [
    { size: 'small-today' as const, label: 'Small: today', preview: '3/5 done' },
    { size: 'small-one-task' as const, label: 'Small: one task', preview: 'Morning workout' },
    { size: 'medium-up-next' as const, label: 'Medium: up next', preview: 'Next 2 tasks' },
  ],
  fixedTask: 'Fixed task',
  smartNextDue: 'Next due',
  smartHelper: 'Always shows whichever task is due soonest.',
  save: 'Save',
  footer: 'Widgets refresh automatically and always match your current theme and accent.',
  savedToast: 'Widget updated.',
  errorToast: "Couldn't save. Try again.",
} as const;

export const S49_COPY = {
  title: 'Help and about',
  // `a11yDestination` — review pass 1, blocking item 7: each row must announce its OWN
  // destination type ("Contact support, opens email"), not one blanket "opens email" label
  // copied across all three Support rows.
  supportSection: [
    { label: 'Contact support', toast: 'Opening your email app…', a11yDestination: 'opens email' },
    { label: 'FAQ and guides', toast: 'Opening FAQ and guides…', a11yDestination: 'opens an external help center' },
    { label: 'Rate Fallback', toast: 'Opening the App Store…', a11yDestination: 'opens the app store' },
  ],
  legalSection: [
    { label: 'Privacy policy', toast: 'Opening…' },
    { label: 'Terms of service', toast: 'Opening…' },
  ],
  privacy: 'No login. Your data lives on this device. No account to create or password to lose.',
  version: 'Fallback 1.0.0 (128)',
  tagline: 'Something beats nothing.',
} as const;
