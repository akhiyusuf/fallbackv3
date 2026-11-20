/**
 * Start-up repair for XP. A log and its XP award are two writes; if the app is killed between
 * them, the day reads as done but the award is missing, and nothing would ever add it. On launch
 * this gives every XP-eligible occurrence of a live habit the award it is missing. It only ever
 * ADDS what is owed (same amount and date rule as logging); it never retracts or changes an award.
 */
import { isXpEligible, xpForOccurrence } from '@/domain';
import { newId } from '@/lib/id';
import { now } from '@/lib/date';
import type { Repositories } from '@/types';

import { resolveAllOccurrences, todayLocal } from './internal';
import { serialWrite } from './writeQueue';

/** Runs in the one-write-at-a-time queue (writeQueue.ts): beside the first log it would read the XP totals mid-write. */
export const healMissingXp = serialWrite(healMissingXpNow);

async function healMissingXpNow(repos: Repositories): Promise<number> {
  const pointer = await repos.cycleState.get();
  if (!pointer) return 0; // no cycle to stamp an award with yet: nothing has been logged
  const today = todayLocal();
  const [occs, awards] = await Promise.all([resolveAllOccurrences(repos, today, today), repos.progress.listXpAwards()]);
  const have = new Set(awards.map((a) => `${a.taskId}:${a.date}`));
  let added = 0;
  for (const o of occs) {
    if (!isXpEligible(o)) continue;
    const date = o.pushedFrom ?? o.date;
    if (have.has(`${o.taskId}:${date}`)) continue;
    const result = await repos.progress.appendXpAward({
      id: newId(),
      taskId: o.taskId,
      date,
      kind: o.outcome as 'ideal' | 'fallback',
      amount: xpForOccurrence(o),
      cycleId: pointer.currentCycleId,
      createdAt: now(),
    });
    if (result.ok) {
      have.add(`${o.taskId}:${date}`);
      added += 1;
    }
  }
  return added;
}
