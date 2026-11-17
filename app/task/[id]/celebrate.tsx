/**
 * S24 — a daily log no longer opens a screen: it shows a toast (D2), and only a
 * level-up or badge opens the milestone pop-up. This route replays that
 * feedback for old links, then returns to the task.
 */
import { useEffect } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { useLogFeedback } from '@/features/task/logFeedback';

export default function S24CompletionCelebration() {
  const { id, variant, xp, levelUp, badgeKey } = useLocalSearchParams<{ id: string; variant?: string; xp?: string; levelUp?: string; badgeKey?: string }>();
  const feedback = useLogFeedback();
  useEffect(() => {
    feedback(variant === 'fallback' ? 'fallback' : 'done', { xpAwarded: Number(xp ?? 0), levelUp: levelUp === '1', badgesUnlocked: badgeKey ? [badgeKey] : [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Redirect href={`/task/${id}` as never} />;
}
