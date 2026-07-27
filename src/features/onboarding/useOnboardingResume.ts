/** M7. F9 resume-after-kill — see `progress.ts`'s header for the full rationale. */
import { useEffect, useState } from 'react';
import { useRouter, type Href } from 'expo-router';

import { clearOnboardingProgress, getOnboardingProgress, markOnboardingProgress } from './progress';

/**
 * Every non-S02 onboarding screen just marks itself as "the furthest reached" on mount —
 * S01 (frozen, M1-owned) always lands a not-yet-completed user on `/onboarding/hook`
 * regardless of where they left off, so ONLY S02 needs to read this pointer back and
 * silently forward the user past it (see `useOnboardingResumeRedirect` below).
 */
export function useOnboardingStepMarker(ownRoute: string): void {
  useEffect(() => {
    void markOnboardingProgress(ownRoute);
  }, [ownRoute]);
}

/**
 * S02-only. Resolves the saved progress pointer before rendering S02's own content: if the
 * user had gotten further before the app was killed, silently forwards them there instead —
 * "don't restart from S02 if the user was on S06" (MODULES.md M7 non-negotiable). Returns
 * `resuming: true` while this check is in flight (and forever, if a redirect is under way),
 * so the caller can render nothing rather than flash S02's content first.
 */
export function useOnboardingResumeRedirect(ownRoute: string): { resuming: boolean } {
  const router = useRouter();
  const [resuming, setResuming] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await getOnboardingProgress();
      if (cancelled) return;
      if (saved && saved !== ownRoute) {
        router.replace(saved as Href);
        return; // stays `resuming: true` — S02 never paints before the redirect takes over.
      }
      setResuming(false);
      void markOnboardingProgress(ownRoute);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownRoute]);

  return { resuming };
}

/** Called on Skip (any screen) or S08's successful save — the two ways the tour ends. */
export async function finishOnboardingProgress(): Promise<void> {
  await clearOnboardingProgress();
}
