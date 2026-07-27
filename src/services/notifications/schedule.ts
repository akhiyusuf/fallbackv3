/**
 * M7. F14 — pure computation of the rolling 7-day local-notification schedule.
 *
 * Deliberately reuses `@/domain`'s `isDue` (M2, frozen) rather than re-deriving cadence math
 * — "call the domain's implementation, don't reinvent it" is the same discipline M4 follows
 * for `validateTaskDraft`. No I/O, no `expo-notifications`, no `new Date()` — everything here
 * is a plain function of its arguments, so it is unit-testable without a device/simulator.
 */
import { isDue } from '@/domain';
import { addDays } from '@/lib/date';
import type { LocalDate, NotificationPrefs, TaskWithSteps } from '@/types';

export const NOTIFICATION_HORIZON_DAYS = 7;
const DEFAULT_TIME_OF_DAY = '09:00';

export type ReminderKind = 'routine-due' | 'event-starting' | 'course-dose' | 'course-ending-soon';

export interface ScheduledReminder {
  /** Stable across reschedules, so re-arming can cancel-and-replace idempotently. */
  readonly id: string;
  readonly kind: ReminderKind;
  readonly taskId: string;
  readonly date: LocalDate;
  readonly timeOfDay: string;
  readonly title: string;
  readonly body: string;
}

const COURSE_ENDING_SOON_WINDOW_DAYS = 3;

/**
 * The rolling 7-day horizon (`[today, today + 6]`) of every reminder a prefs-eligible task
 * generates. As-needed routines are excluded by construction — `isDue` is always `false` for
 * them (F27), so they never enter `occurrenceDates` and generate zero "routine due" reminders,
 * per MODULES.md's own non-negotiable. To-dos are likewise never due (`isDue`), so they never
 * appear here either — consistent with F11's "To-do: plain binary completion, never a
 * StateChip" (no due-based reminder concept applies to them).
 */
export function buildRollingSchedule(input: {
  readonly tasks: readonly TaskWithSteps[];
  readonly prefs: NotificationPrefs;
  readonly today: LocalDate;
  /**
   * SCHEMA §4.2's standing principle (review pass 1, blocking item 3's `schedule.ts` note):
   * `isDue` is cadence-only, so a date the user has SNOOZED AWAY (that date's own `day_log`
   * row has `movedToDate` set — carrier `none` per `designateCarrier`'s R-2) would otherwise
   * still get a "routine due" reminder despite being vacated. Keys are
   * `` `${taskId}:${date}` ``. This does NOT re-implement carrier/clause selection — it is
   * the one fact (`movedToDate != null` on D's own row) `isDue`-only cadence math cannot see;
   * the caller (a real `repos` read) supplies it since this function stays pure/no I/O.
   */
  readonly vacatedDates?: ReadonlySet<string>;
}): readonly ScheduledReminder[] {
  const { tasks, prefs, today, vacatedDates } = input;
  if (!prefs.master) return [];

  const horizon: LocalDate[] = [];
  for (let i = 0; i < NOTIFICATION_HORIZON_DAYS; i++) horizon.push(addDays(today, i));

  const isVacated = (taskId: string, date: LocalDate): boolean => vacatedDates?.has(`${taskId}:${date}`) ?? false;

  const out: ScheduledReminder[] = [];

  for (const task of tasks) {
    if (task.deletedAt) continue;

    if (task.type === 'routine' && !task.isAsNeeded && prefs.routineDue) {
      for (const date of horizon) {
        if (!isDue(task, date) || isVacated(task.id, date)) continue;
        out.push({
          id: `routine-due:${task.id}:${date}`,
          kind: 'routine-due',
          taskId: task.id,
          date,
          timeOfDay: task.timeOfDay ?? DEFAULT_TIME_OF_DAY,
          title: `Time for your ${task.name}`,
          body: 'Too tired? The fallback still counts.',
        });
      }
    }

    if (task.type === 'event' && prefs.eventStarting) {
      for (const date of horizon) {
        if (!isDue(task, date) || isVacated(task.id, date)) continue;
        out.push({
          id: `event-starting:${task.id}:${date}`,
          kind: 'event-starting',
          taskId: task.id,
          date,
          timeOfDay: task.timeOfDay ?? DEFAULT_TIME_OF_DAY,
          title: `${task.name} is coming up`,
          body: 'Starting today.',
        });
      }
    }

    if (task.type === 'course') {
      if (prefs.courseDose) {
        for (const date of horizon) {
          if (!isDue(task, date) || isVacated(task.id, date)) continue;
          out.push({
            id: `course-dose:${task.id}:${date}`,
            kind: 'course-dose',
            taskId: task.id,
            date,
            timeOfDay: task.timeOfDay ?? DEFAULT_TIME_OF_DAY,
            title: `${task.name} — today's dose`,
            body: 'Log it when you take it.',
          });
        }
      }
      if (prefs.courseEndingSoon && task.endDate) {
        // Fires exactly once, `COURSE_ENDING_SOON_WINDOW_DAYS` before the end date — clamped
        // forward to `today` so a course ending imminently (or one whose warning date has
        // already passed) still gets today's slot rather than silently never firing.
        const naturalFireDate = addDays(task.endDate, -COURSE_ENDING_SOON_WINDOW_DAYS);
        const fireDate = naturalFireDate < today ? today : naturalFireDate;
        if (fireDate <= task.endDate && horizon.includes(fireDate)) {
          out.push({
            id: `course-ending-soon:${task.id}:${task.endDate}`,
            kind: 'course-ending-soon',
            taskId: task.id,
            date: fireDate,
            timeOfDay: task.timeOfDay ?? DEFAULT_TIME_OF_DAY,
            title: `${task.name} is ending soon`,
            body: `Runs through ${task.endDate}.`,
          });
        }
      }
    }
  }

  return out;
}
