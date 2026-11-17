/**
 * S28 — the milestone pop-up. It is a pop-up over the current screen (D2), not a
 * page: this route only queues the celebration and returns to Achievements.
 */
import { useEffect } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { useCelebrationStore } from '@/app-shell';
import { ROUTES } from '@/navigation';
import { useProgress } from '@/queries';

export default function S28LevelUpCelebration() {
  const params = useLocalSearchParams<{ kind?: string; xp?: string; badgeKey?: string }>();
  const push = useCelebrationStore((s) => s.push);
  const progressQuery = useProgress();
  const ready = params.kind === 'tenure' || params.xp !== undefined || !progressQuery.isLoading;

  useEffect(() => {
    if (!ready) return;
    if (params.kind === 'tenure' && params.badgeKey) {
      push({ kind: 'badge', badgeKey: params.badgeKey });
      return;
    }
    const xpParam = params.xp ? Number(params.xp) : NaN;
    push({ kind: 'level-up', lifetimeXp: Number.isFinite(xpParam) ? xpParam : (progressQuery.data?.lifetimeXp ?? 0) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return ready ? <Redirect href={ROUTES.achievements} /> : null;
}
