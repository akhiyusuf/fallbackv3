/**
 * M0. Boot sequence + provider composition consumed by app/_layout.tsx.
 *
 * `useAppBootstrap` is deliberately store-agnostic: M1's S01 (app/splash.tsx) performs the
 * real `StoreLifecycle.open()` and owns the corrupt→S50 routing decision (docs/MODULES.md
 * M1). This hook only guarantees the provider tree has mounted before the first paint of
 * whatever route the router lands on, so `app/_layout.tsx` never renders a bare white frame.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { today } from '@/lib/date';
import type { LocalDate } from '@/types';

export { ErrorBoundary } from './ErrorBoundary';
export { useThemeStore } from './stores/theme';
export { useToastStore, type ToastEntry, type ToastTone } from './stores/toast';
export { useEntitlementStore } from './stores/entitlement';
export { useAssistantSessionStore } from './stores/assistantSession';

export function useAppBootstrap(): {
  ready: boolean;
  storeStatus: 'ready' | 'corrupt' | 'uninitialised';
} {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Mount is synchronous today; the `useEffect` boundary is what lets this hook grow a
    // real async precondition later (e.g. font loading) without changing its call sites.
    setReady(true);
  }, []);

  return { ready, storeStatus: 'ready' };
}

/**
 * ARCHITECTURE §7: re-evaluates `today()` on app foreground and on an interval, and
 * invalidates every date-scoped query so a pending occurrence that has crossed midnight
 * is re-read as missed on the next render — never via a background job.
 */
export function useDayRollover(intervalMs = 60_000): LocalDate {
  const [date, setDate] = useState<LocalDate>(today());
  const queryClient = useQueryClient();
  const lastRef = useRef(date);

  useEffect(() => {
    const check = () => {
      const next = today();
      if (next !== lastRef.current) {
        lastRef.current = next;
        setDate(next);
        // M2 owns QUERY_KEYS; app-shell only knows a rollover happened, not the key shape,
        // so it invalidates broadly. Cheap on a local-first store (ARCHITECTURE §3).
        void queryClient.invalidateQueries();
      }
    };

    const interval = setInterval(check, intervalMs);
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') check();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [intervalMs, queryClient]);

  return date;
}
