/**
 * M2. Save-time validation shared by S16/S17/S18/S19 (create) and S20 (edit) —
 * including F23/F24's no-empty-run-occurrence invariant. One implementation, two callers:
 * S20's spec explicitly says "replicate it, don't reinvent it". STUB — M2 implements.
 */
import type { Result, TaskDraft } from '@/types';

export declare function validateTaskDraft(draft: TaskDraft): Result<TaskDraft>;
/** Returns the weekday names of every parent occurrence left with zero due ideal steps. */
export declare function emptyRunOccurrences(draft: TaskDraft): string[];
