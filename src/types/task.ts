/** M0. Task model — the four types, the as-needed sub-variant, cadences, steps. */

import type { Id, LocalDate, Instant, Weekday } from './primitives';

/** PRD §3.2 / F11. Exactly four top-level types. As-needed is a Routine SUB-VARIANT, never a fifth type. */
export type TaskType = 'routine' | 'event' | 'course' | 'todo';

/** PRD §6 fixed vocabulary. No free-form tags anywhere (PRD §4). */
export type Importance = 'high' | 'med' | 'low';
export type Necessity = 'must-do' | 'recommended' | 'optional';

/** PRD §6 / R23 closed cadence set. No custom/cron rules (PRD §4). */
export type CadenceKind =
  | 'daily'
  | 'specific-weekdays'
  | 'weekly'
  | 'bi-weekly'
  | 'monthly'
  | 'bi-monthly'
  | 'yearly';

export type Cadence =
  | { readonly kind: 'daily' }
  | { readonly kind: 'specific-weekdays'; readonly weekdays: readonly Weekday[] }
  | { readonly kind: 'weekly'; readonly weekday: Weekday; readonly anchorDate: LocalDate }
  | { readonly kind: 'bi-weekly'; readonly weekday: Weekday; readonly anchorDate: LocalDate }
  | { readonly kind: 'monthly'; readonly dayOfMonth: number; readonly anchorDate: LocalDate }
  | { readonly kind: 'bi-monthly'; readonly dayOfMonth: number; readonly anchorDate: LocalDate }
  | { readonly kind: 'yearly'; readonly month: number; readonly dayOfMonth: number; readonly anchorDate: LocalDate };

/** F8 / S21. Closed four-colour set, shared with the accent palette. */
export type TaskColor = 'forge-orange' | 'indigo' | 'berry' | 'plum';

/** Lucide icon name, validated against the S21 catalogue at save time. */
export type IconName = string;

export type StepRole = 'ideal' | 'fallback';

/**
 * F23/F24 per-occurrence sub-step scheduling.
 * `dueWeekdays === null` means "due on every parent occurrence" (the default for a new step).
 * A non-null set is always a SUBSET of the parent's own occurrence weekdays — a step can never
 * be due on a day the parent does not run. Only `ideal` steps carry this; `fallback` steps are
 * whole-task and available on every run-occurrence.
 */
export interface Step {
  readonly id: Id;
  readonly taskId: Id;
  readonly role: StepRole;
  readonly text: string;
  readonly position: number;
  readonly dueWeekdays: readonly Weekday[] | null;
}

export interface Task {
  readonly id: Id;
  readonly type: TaskType;
  readonly name: string;
  readonly note: string | null;
  readonly icon: IconName;
  readonly color: TaskColor;

  /**
   * F27. `true` => as-needed Routine sub-variant: no cadence, no occurrence set,
   * optional ideal/fallback, never due, zero XP, excluded from consistency at both scopes.
   * Only ever `true` when `type === 'routine'`.
   */
  readonly isAsNeeded: boolean;

  /** null for todo, and for as-needed routines. Non-null for every occurrence-bearing scheduled task. */
  readonly cadence: Cadence | null;

  /** F11 Event: the single due date of a one-off Event. null when the Event repeats. */
  readonly eventDate: LocalDate | null;
  /** F11 Event: local time `HH:mm`, optional (all-day allowed). */
  readonly timeOfDay: string | null;

  /** F11 Course: the fixed run span. */
  readonly startDate: LocalDate | null;
  readonly endDate: LocalDate | null;
  /** F12 multi-dose Course. 1 for every other task. */
  readonly dosesPerDay: number;

  /** F11: optional on Events and To-dos, required on trackable Routines and Courses. */
  readonly isTracked: boolean;

  readonly importance: Importance | null;
  readonly necessity: Necessity | null;

  /** F11 To-do: plain binary completion. Never a StateChip, never XP-eligible. */
  readonly todoDoneAt: Instant | null;

  /**
   * CR-4 (MODULES.md), PRD §3.7. Per-task gate on whether F7 Snooze is offered at all —
   * default `true` at create time (M2's `validateTaskDraft`). Turning it off never retracts
   * an already-snoozed occurrence (SCHEMA.md §4.2 W-1s/W-1u).
   */
  readonly snoozable: boolean;

  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly deletedAt: Instant | null;
}

export interface TaskWithSteps extends Task {
  readonly idealSteps: readonly Step[];
  readonly fallbackSteps: readonly Step[];
}

/** Input shapes for the create/edit forms (M4). Validated by M2's `validateTaskDraft`. */
export interface TaskDraft {
  readonly type: TaskType;
  readonly name: string;
  readonly note?: string | null;
  readonly icon?: IconName;
  readonly color?: TaskColor;
  readonly isAsNeeded?: boolean;
  readonly cadence?: Cadence | null;
  readonly eventDate?: LocalDate | null;
  readonly timeOfDay?: string | null;
  readonly startDate?: LocalDate | null;
  readonly endDate?: LocalDate | null;
  readonly dosesPerDay?: number;
  readonly isTracked?: boolean;
  readonly importance?: Importance | null;
  readonly necessity?: Necessity | null;
  /** CR-4. Defaults to `true` when omitted (M2's `validateTaskDraft`). */
  readonly snoozable?: boolean;
  readonly idealSteps: readonly StepDraft[];
  readonly fallbackSteps: readonly StepDraft[];
}

export interface StepDraft {
  readonly id?: Id;
  readonly text: string;
  readonly dueWeekdays: readonly Weekday[] | null;
}
