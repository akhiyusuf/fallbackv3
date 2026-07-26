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

/**
 * Route constants — every static (non-parameterised) route in `ALLSCREENS_1.md`'s S01–S50,
 * so feature modules never hand-type a route string. Parameterised routes (`/task/:id`,
 * `/records/:cycleId`, `/assistant/history/:id`) are each one owning module's own concern
 * and stay out of this shared table on purpose — a builder constructs those with its own
 * `Id`, e.g. `` `/task/${id}` ``, typed against expo-router's generated `Href`.
 */
export const ROUTES = {
  splash: '/splash',
  onboardingHook: '/onboarding/hook',
  onboardingConcept: '/onboarding/concept',
  onboardingTypes: '/onboarding/types',
  onboardingConsistency: '/onboarding/consistency',
  onboardingPersonalize: '/onboarding/personalize',
  onboardingNotificationsPrimer: '/onboarding/notifications-primer',
  onboardingFirstTask: '/onboarding/first-task',
  today: '/today',
  routines: '/routines',
  events: '/events',
  courses: '/courses',
  todos: '/todos',
  search: '/search',
  addPickType: '/add',
  addRoutine: '/add/routine',
  addEvent: '/add/event',
  addCourse: '/add/course',
  addTodo: '/add/todo',
  progress: '/progress',
  progressTrend: '/progress/trend',
  achievements: '/achievements',
  achievementsCelebrate: '/achievements/celebrate',
  records: '/records',
  assistant: '/assistant',
  assistantChat: '/assistant/chat',
  assistantHistory: '/assistant/history',
  assistantMicPrimer: '/assistant/mic-primer',
  assistantPaywall: '/assistant/paywall',
  assistantPaywallPlan: '/assistant/paywall/plan',
  assistantPaywallByo: '/assistant/paywall/byo',
  settings: '/settings',
  settingsNotifications: '/settings/notifications',
  settingsTheme: '/settings/theme',
  settingsSubscription: '/settings/subscription',
  settingsSync: '/settings/sync',
  settingsWidgets: '/settings/widgets',
  settingsData: '/settings/data',
  settingsDataErase: '/settings/data/erase',
  settingsHelp: '/settings/help',
  recovery: '/recovery',
} as const satisfies Record<string, Href>;

/** Origins that resolve to one fixed, always-reachable top-level route. */
const ORIGIN_ROUTES: Partial<Record<ScreenOrigin, Href>> = {
  today: ROUTES.today,
  routines: ROUTES.routines,
  events: ROUTES.events,
  courses: ROUTES.courses,
  todos: ROUTES.todos,
  search: ROUTES.search,
  settings: ROUTES.settings,
  achievements: ROUTES.achievements,
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
