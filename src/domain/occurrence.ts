/**
 * M2. Cadence -> occurrence set, and F23/F24 due-sub-step resolution.
 * As-needed routines (F27) have NO cadence and NO occurrence set: `isDue` is always false.
 * STUB — M2 implements.
 */
import type { Id, LocalDate, TaskWithSteps } from '@/types';

export declare function isDue(task: TaskWithSteps, date: LocalDate): boolean;
export declare function occurrencesBetween(task: TaskWithSteps, from: LocalDate, to: LocalDate): LocalDate[];
/** F23/F24: ideal steps due on THIS occurrence. Guaranteed non-empty for a due, tracked task. */
export declare function dueIdealStepIds(task: TaskWithSteps, date: LocalDate): Id[];
