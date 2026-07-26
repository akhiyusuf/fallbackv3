/**
 * M0. Route constants + the origin-aware back helper.
 *
 * Seven screens have ONE route but TWO valid back destinations (S14, S22, S23, S25,
 * S27, S29, S48). The origin travels as a `?from=` search param; NEVER hardcode a
 * back destination on those screens. See docs/ARCHITECTURE.md §4.3.
 *
 * `useOriginAwareBack` prefers an explicit `from` origin (when it maps to a static,
 * always-reachable route — a browse tab, search, settings, achievements) and otherwise
 * falls back to the natural navigation stack (`router.back()`), which is itself
 * origin-correct for a screen that was simply pushed from its opener (S22's "Keep it",
 * S23's cancel-equivalent paths). If neither is available (a cold deep link), it falls
 * back to the caller's own `fallback` href.
 */
import { useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

export type ScreenOrigin =
  | 'today' | 'routines' | 'events' | 'courses' | 'todos'
  | 'search' | 'settings' | 'manage' | 'as-needed' | 'data' | 'recovery' | 'achievements';

/** Origins that resolve to one fixed, always-reachable top-level route. */
const ORIGIN_ROUTES: Partial<Record<ScreenOrigin, Href>> = {
  today: '/today',
  routines: '/routines',
  events: '/events',
  courses: '/courses',
  todos: '/todos',
  search: '/search',
  settings: '/settings',
  achievements: '/achievements',
};

export function useOriginAwareBack(fallback: string): () => void {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const origin = from as ScreenOrigin | undefined;

  return useCallback(() => {
    const originHref = origin ? ORIGIN_ROUTES[origin] : undefined;
    if (originHref) {
      router.replace(originHref);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(fallback as Href);
  }, [origin, router, fallback]);
}

export function withOrigin(href: string, origin: ScreenOrigin): string {
  const separator = href.includes('?') ? '&' : '?';
  return `${href}${separator}from=${origin}`;
}
