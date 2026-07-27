/**
 * M7. Verbatim copy for S02–S08 — `design-input/fallback-handoff/uploads/ALLSCREENS_1.md`.
 * No paraphrasing beyond what the spec itself marks as "connective tissue."
 */

export const ONBOARDING_SHELL_COPY = {
  skip: 'Skip',
  next: 'Next',
  save: 'Save routine',
} as const;

export const S02_COPY = {
  headline: 'Something beats nothing.',
  body: 'Build habits that survive your worst days — not just your best ones.',
} as const;

export const S03_COPY = {
  headline: 'A plan A and a plan B for every habit.',
  body: 'Too tired for the full thing? Do the fallback. You still showed up.',
  eyebrow: 'MORNING WORKOUT',
  idealLabel: 'Ideal — Full workout',
  idealHelper: '30 min, all 3 steps.',
  fallbackLabel: 'Fallback — 10 pushups',
  fallbackHelper: 'The low bar on a hard day.',
  privacy: 'No login. Your data lives on this device — no account to create or password to lose.',
} as const;

export const S04_COPY = {
  headline: 'Four ways to plan.',
  body: "Pick whatever fits the thing you're tracking — you'll choose per task.",
  tiles: [
    { label: 'Routines', helper: 'Recurring, day to day.' },
    { label: 'Events', helper: 'One-off, at a set time.' },
    { label: 'Courses', helper: 'A run with an end date.' },
    { label: 'To-dos & Notes', helper: 'Loose tasks, no schedule.', tag: 'NEW' },
  ],
} as const;

export const S05_COPY = {
  headline: 'Every day counts — ideal or fallback.',
  body: 'Nothing to lose here. We count how often you show up — a fallback still counts.',
  eyebrow: 'EXAMPLE',
  bigNumeral: '83%',
  subLabel: '5 of 6 days you showed up',
  legend: { ideal: 'Ideal', fallback: 'Fallback', off: 'Off' },
  // 7-day sample composition, spec-pinned: 3 ideal + 2 fallback + 1 off + 1 missed (unfilled).
  sample: { ideal: 3, fallback: 2, off: 1, missed: 1, total: 7 },
} as const;

export const S06_COPY = {
  headline: 'Make it yours.',
  body: 'Pick an accent color and decide if you want a gentle nudge now and then.',
  accentSectionLabel: 'Accent color',
  accentHelper: 'Only recolors buttons and progress — never the ideal, fallback, or off-day colors.',
  previewLabel: 'Preview',
  remindersSectionLabel: 'Reminders',
  remindersRowLabel: 'Gentle nudges for due habits',
  remindersHelper: 'You can change this anytime in Settings.',
  saveFailure: "Couldn't save that — try again",
} as const;

export const S07_COPY = {
  headline: 'Gentle nudges, never nagging.',
  body: "A quiet reminder when a habit is due, and one invitation back after an off day. That's it.",
  previewApp: 'Fallback',
  previewTimestamp: 'now',
  previewTitle: 'Time for your evening walk',
  previewBody: 'Too tired? The fallback still counts.',
  allow: 'Allow',
  notNow: 'Not now',
} as const;

export const S08_COPY = {
  headline: 'Add your first habit.',
  body: "We'll start with a routine — pick a type, then give it an ideal and a fallback.",
  lastStep: 'Last step',
  tiles: [
    { label: 'Routines', enabled: true },
    { label: 'Events', enabled: false, tag: 'After setup' },
    { label: 'Courses', enabled: false, tag: 'After setup' },
    { label: 'To-dos', enabled: false, tag: 'After setup' },
  ],
  nameLabel: 'Name',
  namePlaceholder: 'Morning workout',
  nameHelper: 'What do you want to build?',
  idealLabel: 'Ideal',
  idealPlaceholder: 'Full workout — 30 min',
  idealHelper: 'The full version, on a good day.',
  fallbackLabel: 'Fallback',
  fallbackPlaceholder: '10 pushups',
  fallbackHelper: 'The low bar — still counts as showing up.',
  cadenceNote: 'Runs every day — you can change that anytime.',
  save: 'Save routine',
  nameError: 'Add a name to continue',
  idealError: 'Add an ideal version to continue',
  fallbackError: 'Add a fallback to continue',
  saveFailure: "Couldn't save — try again",
} as const;
