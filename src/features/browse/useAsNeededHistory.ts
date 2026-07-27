/**
 * S10's as-needed row preview — "a one-line reference-only history preview ('Last used
 * Jul 2')" (`ALLSCREENS_1.md:426`, copy example at `:458`).
 *
 * CONTRACT GAP, flagged (same one M4 hit and bridged): `docs/API.md` documents
 * `AsNeededRepository.listForTask`, but `src/queries` (M2-owned, frozen) never grew a public
 * read hook for it — `useLogAsNeededUse` (the write side) exists, its read counterpart does
 * not. Every other screen-level read in this module goes through `@/queries` only, per
 * `docs/MODULES.md`'s M3 "Depends on contracts" list. This hook is the same narrow, flagged
 * exception M4 already established at `src/features/task/useAsNeededHistory.ts`: a straight,
 * logic-free passthrough of an already-implemented, already-typed repository method (no
 * reimplementation of any business rule). It is now needed by TWO modules — the promotion
 * signal named in review/REVIEW-M3.md item 6. Recommended fix: the architect promotes this to
 * `src/queries/reads.ts` as a shared `useAsNeededHistory` with its own `QUERY_KEYS` entry, and
 * both this file and M4's copy are deleted in favor of it. Not done here — M3 may not modify
 * `@/queries` (frozen, another module's owned path).
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
