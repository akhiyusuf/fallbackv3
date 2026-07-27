/**
 * M3. Verbatim copy for S10–S13 — `design-input/fallback-handoff/uploads/ALLSCREENS_1.md`.
 * No paraphrasing; every string here is a direct quote from that file.
 */

export const S10_COPY = {
  title: 'Routines',
  dueBadge: 'Due',
  otherSection: 'Other routines',
  logUsedIt: 'Log used it',
  emptyNoRoutinesHeadline: 'Create your first routine',
  emptyNoRoutinesSubcopy: 'Routines are the day-to-day habits you show up for — give one an ideal and a fallback.',
  emptyNoRoutinesAction: 'New routine',
  emptyNothingDueSubcopyPrefix: 'No routines on ',
  emptyNothingDueSubcopySuffix: 's — enjoy the rest day, or add one to fill it.',
  emptyNothingDueHeadline: 'Nothing scheduled.',
} as const;

export function dueSectionLabel(dayName: string): string {
  return `Due ${dayName}`;
}

export const S11_COPY = {
  title: 'Events',
  todaySection: 'Today',
  upcomingSection: 'Upcoming',
  oneTime: 'One-time',
  noEventsTodayHeadlinePrefix: 'No events today.',
  noEventsTodaySubcopyPrefix: 'Nothing on the calendar for ',
  noEventsTodaySubcopySuffix: '. Schedule a one-off whenever you need to.',
  noEventsAtAllHeadline: 'No events yet.',
  noEventsAtAllSubcopy: 'Events are one-off or repeating plans at a set time — a dentist visit, a weekly dinner.',
  newEvent: 'New event',
} as const;

export const S12_COPY = {
  title: 'Courses',
  active: 'Active',
  past: 'Past',
  daysLeftSuffix: 'days left',
  completedPrefix: 'Completed',
  noActiveHeadline: 'No active courses right now.',
  noActiveSubcopy: "Start a new one whenever you're ready.",
  noCoursesAtAllHeadline: 'Start your first course',
  noCoursesAtAllSubcopy: "Courses are habits with an end date — a medication, a 30-day challenge. Start one when you're ready.",
  newCourse: 'New course',
} as const;

export const S13_COPY = {
  title: 'To-dos & Notes',
  todosLens: 'To-dos',
  notesLens: 'Notes',
  emptyTodosHeadline: 'Nothing here yet.',
  emptyTodosSubcopy: 'Jot down a to-do or note — no schedule required.',
  emptyNotesHeadline: 'No notes yet.',
  emptyNotesSubcopy: "Loose thoughts, reminders, anything that doesn't need a schedule.",
  newTodoOrNote: 'New to-do or note',
} as const;

export const BROWSE_SHARED_COPY = {
  errorReadFailure: "Couldn't load this list. Your data is safe on this device.",
  retry: 'Retry',
} as const;
