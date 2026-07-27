/**
 * M4 — S23's reference-only usage history (F27, SCHEMA.md §5's `as_needed_use` table).
 *
 * CONTRACT GAP, flagged (see this module's build report for the full writeup): `docs/API.md`
 * §1 documents `AsNeededRepository.listForTask` as "read by S23 alone", but `src/queries`
 * (M2-owned, frozen) never grew a public read hook for it — `useLogAsNeededUse` (the write
 * side) exists, its read counterpart does not. Every other screen-level read in this module
 * goes through `@/queries` only, per MODULES.md's M4 "Depends on contracts" list. This hook is
 * the one deliberate, narrow exception: a straight, logic-free passthrough of an
 * already-implemented, already-typed repository method (no reimplementation of any business
 * rule), added here only because S23 cannot function at all without it. Recommended fix:
 * promote this to `src/queries/reads.ts` as `useAsNeededHistory` with its own `QUERY_KEYS`
 * entry, and delete this file.
 */
import { useQuery } from '@tanstack/react-query';

import { repos } from '@/db';
import type { AsNeededUse, Id } from '@/types';

export function useAsNeededHistory(taskId: Id) {
  return useQuery({
    queryKey: ['asNeededHistory', taskId] as const,
    queryFn: (): Promise<readonly AsNeededUse[]> => repos.asNeeded.listForTask(taskId),
  });
}
