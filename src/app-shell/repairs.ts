/**
 * Start-up repairs, also run each time the app comes back to the foreground.
 *
 * The three repairs are idempotent and never throw:
 *   - the 30-day Recently deleted sweep (what has been in Recently deleted past its time goes for good),
 *   - the cycle catch-up (cycles that ended while the app was away are archived),
 *   - the missing-XP heal (a log whose award never landed gets it).
 *
 * Before this, they ran only at cold start (`app/splash.tsx`). An app kept in the background for
 * days never ran them until it was killed, so Recently deleted kept expired habits and Progress
 * kept a cycle that had ended. Today's day, reminders and the widget already refresh on foreground
 * (their own bridges), so they are not repeated here.
 *
 * Two rules:
 *   - One pass at a time. A foreground that arrives while a pass is running queues exactly one more
 *     pass after it; it never runs alongside the first one.
 *   - Order within a pass: the sweep runs next to the cycle catch-up, but the XP heal runs only after
 *     the catch-up. The heal stamps the awards it adds with the current cycle pointer, so it must read
 *     the pointer after the catch-up has advanced it, or a repaired award lands in the old cycle.
 */
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { repos, store } from '@/db';
import { catchUpCycles, healMissingXp, sweepExpiredDeleted } from '@/queries';

let running: Promise<void> | null = null;
let passQueued = false;

/** Runs one repair pass now, or, if one is already running, one more pass straight after it. */
export function runStartupRepairs(): Promise<void> {
  if (running) {
    passQueued = true;
    return running;
  }
  running = (async () => {
    do {
      passQueued = false;
      await repairPass();
    } while (passQueued);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function repairPass(): Promise<void> {
  const sweep = Promise.resolve()
    .then(() => sweepExpiredDeleted())
    .catch(() => undefined);
  const cyclesThenXp = Promise.resolve()
    .then(() => catchUpCycles())
    .catch(() => undefined)
    .then(() => healMissingXp(repos))
    .catch(() => undefined);
  await Promise.all([sweep, cyclesThenXp]);
}

/**
 * Runs the repair pass each time the app becomes active, once the store is open. Before the store is
 * open there is nothing to repair; the splash runs the start-up pass itself.
 */
export function useForegroundRepairs(): void {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && store.status() === 'ready') void runStartupRepairs();
    });
    return () => {
      sub?.remove();
    };
  }, []);
}
