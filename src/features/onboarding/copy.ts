/**
 * M7. Verbatim copy for S02–S08 — `design-input/fallback-handoff/uploads/ALLSCREENS_1.md`.
 * No paraphrasing beyond what the spec itself marks as "connective tissue."
 */

export const ONBOARDING_SHELL_COPY = {
  skip: 'Skip',
  next: 'Next',
  save: 'Save routine',
  skipFailure: "Couldn't save that. Try again",
} as const;

export const S02_COPY = {
  headline: 'Something beats nothing.',
  body: 'Build habits that survive your worst days, not just your best ones.',
  compareTitle: 'The same week, twice',
  withoutLabel: 'The full version or nothing',
  withoutCount: '3 of 7 days',
  withLabel: 'With a fallback',
  withCount: '7 of 7 days',
} as const;

export const S03_COPY = {
  headline: 'a plan A and a plan B for every habit.',
  body: 'Too tired for the full thing? Do the fallback. You still showed up.',
  exampleName: 'Morning workout',
  idealText: 'Full workout, 30 minutes',
  fallbackText: '10 pushups on a hard day',
  privacy: 'No login. Your data lives on this device. No account to create or password to lose.',
} as const;

export const S04_COPY = {
  headline: 'Four ways to plan.',
  body: "Pick whatever fits the thing you're tracking. You'll choose per task.",
  tiles: [
    { label: 'Routines', helper: 'Recurring, day to day.' },
    { label: 'Events', helper: 'One-off, at a set time.' },
    { label: 'Courses', helper: 'A run with an end date.' },
    { label: 'To-dos and notes', helper: 'Loose tasks, no schedule.' },
  ],
} as const;

export const S05_COPY = {
  headline: 'Every day counts, ideal or fallback.',
  body: 'Nothing to lose here. We count how often you show up. A fallback still counts.',
  bigNumeral: '86%',
  subLabel: '6 of 7 days you showed up',
  legend: { ideal: 'Ideal', fallback: 'Fallback', off: 'Off' },
  // The week in the banner picture: a tray of seven with four green marbles and two blue in it
  // and the seventh place still empty. (The design said 3 ideal + 2 fallback + 1 off + 1 missed;
  // the human asked for the example to match the picture.)
  sample: { ideal: 4, fallback: 2, off: 0, missed: 1, total: 7 },
} as const;

export const S06_COPY = {
  headline: 'Make it yours.',
  body: 'Pick a colour, then light or dark.',
  accentSectionLabel: 'Colour',
  accentHelper: 'Ideal green and fallback blue never change. More colours are in Settings.',
  appearanceSectionLabel: 'Light or dark',
  appearanceOptions: [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'auto', label: 'Match phone' },
  ],
  previewLabel: 'Preview',
  remindersSectionLabel: 'Reminders',
  remindersRowLabel: 'Gentle nudges for due habits',
  remindersHelper: 'You can change this anytime in Settings.',
  saveFailure: "Couldn't save that. Try again",
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
  body: "We'll start with a daily routine. Give it an ideal and a fallback. You can add events, courses and to-dos after setup.",
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
  idealPlaceholder: 'Full workout, 30 min',
  idealHelper: 'The full version, on a good day.',
  fallbackLabel: 'Fallback',
  fallbackPlaceholder: '10 pushups',
  fallbackHelper: 'The low bar. Still counts as showing up.',
  cadenceNote: 'It runs every day. You can change that anytime.',
  save: 'Save routine',
  nameError: 'Add a name to continue',
  idealError: 'Add an ideal version to continue',
  fallbackError: 'Add a fallback to continue',
  saveFailure: "Couldn't save. Try again",
} as const;
