/**
 * M2. F5 at both scopes, plus F28 buckets and F30 cycle windows — ONE implementation,
 * windowed differently. Pinned algorithm: docs/ARCHITECTURE.md §6. STUB — M2 implements.
 */
import type {
  ConsistencyResult,
  ConsistencyWindow,
  DateRange,
  DayFraction,
  Id,
  LocalDate,
  Occurrence,
} from '@/types';

export declare function perTaskConsistency(input: {
  taskId: Id;
  occurrences: readonly Occurrence[];
  window: ConsistencyWindow | DateRange;
  today: LocalDate;
}): ConsistencyResult;

export declare function aggregateConsistency(input: {
  occurrences: readonly Occurrence[];
  window: ConsistencyWindow | DateRange;
  today: LocalDate;
}): ConsistencyResult;

export declare function dayFractions(occurrences: readonly Occurrence[]): DayFraction[];
