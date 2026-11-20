/** M7. F9 resume-after-kill — see `progress.ts`'s header for the full rationale. */
import { useContext, useEffect, useState } from 'react';
// The screen's own navigation, read without throwing when there is none (a test renders a step alone).
import { NavigationContext } from 'expo-router/build/react-navigation/core';
import { useRouter, type Href } from 'expo-router';

import { clearOnboardingProgress, getOnboardingProgress, markOnboardingProgress } from './progress';

/**
 * Every non-S02 onboarding screen just marks itself as "the furthest reached" on mount —
 * S01 (frozen, M1-owned) always lands a not-yet-completed user on `/onboarding/hook`
 * regardless of where they left off, so ONLY S02 needs to read this pointer back and
 * silently forward the user past it (see `useOnboardingResumeRedirect` below).
 */
export function useOnboardingStepMarker(ownRoute: string): void {
  const navigation = useContext(NavigationContext);
  useEffect(() => {
    void markOnboardingProgress(ownRoute);
    // Steps stay mounted underneath the next one, so Back to a step does not mount it again:
    // record it whenever it comes back into view, or a kill would resume on the step left behind.
    return navigation?.addListener('focus', () => void markOnboardingProgress(ownRoute));
  }, [ownRoute, navigation]);
}

/** The steps a saved pointer may name. Anything else (a leftover from another build, a damaged value) starts the tour clean. */
const STEP_ROUTES: ReadonlySet<string> = new Set([
  '/onboarding/concept',
  '/onboarding/hook',
  '/onboarding/types',
  '/onboarding/consistency',
  '/onboarding/personalize',
  '/onboarding/notifications-primer',
  '/onboarding/first-task',
]);

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
      if (saved && saved !== ownRoute && STEP_ROUTES.has(saved)) {
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

/**
 * Leave the tour for good (Skip, or the first routine saved). The steps the person walked through
 * are still in the stack under the screen they are leaving, so a plain replace would let the phone's
 * back button (or gesture) from Today step back into onboarding. Clear the stack first.
 */
export function leaveOnboarding(router: { dismissAll?: () => void; replace: (href: Href) => void }, href: Href): void {
  try {
    router.dismissAll?.();
  } catch {
    // Nothing to dismiss (the tour is the only screen): fine.
  }
  router.replace(href);
}
