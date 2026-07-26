/**
 * M2. Resolves one (task, date) into an OccurrenceOutcome. The single source of
 * truth for chip -> outcome mapping and for "missed" (docs/ARCHITECTURE.md §6.1-6.2).
 * STUB — M2 implements.
 */
import type { DayLog, LocalDate, Occurrence, OffDayMark, TaskWithSteps } from '@/types';

export declare function resolveOccurrence(input: {
  task: TaskWithSteps;
  date: LocalDate;
  today: LocalDate;
  log: DayLog | null;
  offMarks: readonly OffDayMark[];
}): Occurrence;

/** Auto-log rule (F3): all due ideal steps complete -> ideal; >=1 but not all -> fallback; 0 -> todo. */
export declare function autoChipState(occurrence: Occurrence): 'todo' | 'done' | 'fallback';
