/**
 * M7. F9 — onboarding resume-after-kill.
 *
 * `Settings.onboardingCompletedAt` (M0-owned, frozen) is the ONLY completion flag, and it is
 * enough to satisfy "does not recur" (S01 checks it and never returns to onboarding once set).
 * It says nothing about WHERE in the five-step pitch tour an interrupted user was, though —
 * and MODULES.md's own non-negotiable is explicit: "don't restart from S02 if the user was on
 * S06 when they closed the app." `Settings` has no field for that (extending it is a frozen-
 * surface change, M0's call, not ours), so this is a small local pointer of our own, scoped to
 * onboarding only and cleared the moment onboarding completes.
 *
 * `expo-secure-store` is already an app-wide dependency (declared in app.config.ts, used
 * elsewhere for the BYO key) — this reuses it rather than adding a new one. Every onboarding
 * screen calls `markOnboardingProgress(ownRoute)` on mount; S02 (the screen S01 always lands on
 * when onboarding isn't complete) is the one screen that also READS it, and silently redirects
 * onward if the user had gotten further before being killed.
 */
import * as SecureStore from 'expo-secure-store';

const PROGRESS_KEY = 'fallback.onboarding.progress';

/** The route the user was last on, mid-tour — or `null` if never started / already resumed. */
export async function getOnboardingProgress(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PROGRESS_KEY);
  } catch {
    // A read failure here must never trap the user in onboarding — worst case, they restart
    // the tour from S02, which is still a valid (if not ideal) onboarding experience, never a
    // crash or a blocked flow.
    return null;
  }
}

export async function markOnboardingProgress(route: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(PROGRESS_KEY, route);
  } catch {
    // Same reasoning as the read: a failed write silently degrades to "resume from S02 if
    // killed here," never a blocking error mid-tour (S02's own spec: no error state exists
    // for this screen beyond a silent retry-on-next-launch).
  }
}

export async function clearOnboardingProgress(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PROGRESS_KEY);
  } catch {
    // Stale leftover progress after completion is harmless — S01 never routes a completed
    // user back into onboarding regardless of this value.
  }
}
