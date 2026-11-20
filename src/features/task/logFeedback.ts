/**
 * useLogFeedback — what happens after a log, everywhere (D2).
 * A daily log shows a toast (state icon, "Ideal done" / "Fallback done", XP,
 * Undo) and the user stays where they are. Only a level-up or a badge opens
 * the milestone pop-up.
 */
import { play } from '@/services/sfx';
import { useCallback } from 'react';

import { useCelebrationStore, useToastStore } from '@/app-shell';
import { repos } from '@/db';
import type { ChipState } from '@/types';

export interface LogResultLike {
  readonly xpAwarded: number;
  readonly levelUp: unknown;
  readonly badgesUnlocked: readonly string[];
}

export const LOG_SAVE_FAILED = "Couldn't save that. Try again.";

type PushCelebration = ReturnType<typeof useCelebrationStore.getState>['push'];

function queueMilestones(result: Pick<LogResultLike, 'levelUp' | 'badgesUnlocked'>, push: PushCelebration): void {
  if (result.levelUp) {
    void repos.progress
      .lifetimeXp()
      .then((lifetimeXp) => push({ kind: 'level-up', lifetimeXp }))
      .catch(() => undefined);
  }
  for (const badgeKey of result.badgesUnlocked) push({ kind: 'badge', badgeKey });
}

/**
 * The milestone pop-ups alone, for a log that shows its own (or no) toast: a course dose, a past day
 * set from the history. A badge or a level reached that way is celebrated like any other.
 */
export function useMilestoneFeedback() {
  const pushCelebration = useCelebrationStore((s) => s.push);
  return useCallback((result: Pick<LogResultLike, 'levelUp' | 'badgesUnlocked'>) => queueMilestones(result, pushCelebration), [pushCelebration]);
}

export function useLogFeedback() {
  const showToast = useToastStore((s) => s.show);
  const pushCelebration = useCelebrationStore((s) => s.push);

  return useCallback(
    (chip: ChipState, result: LogResultLike, undo?: () => void) => {
      const action = undo ? { label: 'Undo', onPress: undo } : undefined;
      if (chip === 'done') play('log_ideal');
      else if (chip === 'fallback') play('log_fallback');
      else if (chip === 'skip') play('log_skip');
      const detail = result.xpAwarded > 0 ? `+${result.xpAwarded} XP` : undefined;
      if (chip === 'done') showToast('Ideal done.', 'success', { icon: 'ideal', detail, action });
      else if (chip === 'fallback') showToast('Fallback done.', 'success', { icon: 'fallback', detail, action });
      else if (chip === 'skip') showToast('Skipped for today.', 'neutral', { icon: 'skip', action });
      else showToast('Log cleared.', 'neutral');

      queueMilestones(result, pushCelebration);
    },
    [showToast, pushCelebration],
  );
}
