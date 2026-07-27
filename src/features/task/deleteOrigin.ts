/**
 * M4 — S22's two SEPARATE origin rules (`docs/MODULES.md` M4 non-negotiables;
 * `ALLSCREENS_1.md` S22 lines 1155-1166 and 1202-1247). Kept as pure functions so both rules
 * are independently unit-tested and can never accidentally merge into one.
 *
 * RULE 1 — "Keep it" / scrim / hardware back: returns to whichever screen opened S22 (S20 or
 * S23). S22 is always reached by a `router.push` from S20 or S23, so the natural back stack
 * already implements this correctly with no extra param — `app/task/[id]/delete.tsx` uses
 * `router.back()` (with a same-screen `replace` fallback for a cold deep link only). This file
 * does not need to model rule 1 at all; it is called out here only so the two rules are never
 * conflated in review.
 *
 * RULE 2 — confirmed delete: a DIFFERENT, two-level lookup through the ORIGIN of whichever
 * screen opened S22 (S20's own origin, or S23's fixed S10 rule) — never S22's own opener.
 */
import { ROUTES } from '@/navigation';
import type { TaskType } from '@/types';

export type S20StableOrigin = 'today' | 'routines' | 'events' | 'courses' | 'todos';

const STABLE_ORIGINS: readonly S20StableOrigin[] = ['today', 'routines', 'events', 'courses', 'todos'];

export function isStableS20Origin(origin: string | undefined): origin is S20StableOrigin {
  return !!origin && (STABLE_ORIGINS as readonly string[]).includes(origin);
}

const STABLE_ORIGIN_ROUTE: Record<S20StableOrigin, string> = {
  today: ROUTES.today,
  routines: ROUTES.routines,
  events: ROUTES.events,
  courses: ROUTES.courses,
  todos: ROUTES.todos,
};

export function typeTabRoute(type: TaskType): string {
  switch (type) {
    case 'routine':
      return ROUTES.routines;
    case 'event':
      return ROUTES.events;
    case 'course':
      return ROUTES.courses;
    case 'todo':
      return ROUTES.todos;
  }
}

/**
 * RULE 2's own two-level lookup.
 * - Opened from S23 (`openedFrom: 'as-needed'`) -> ALWAYS S10 (Routines browse), regardless of
 *   S23's own origin (S10 or S14) — SITEMAP Decision 21. S23's task is always type Routine, so
 *   this coincides with (but is not derived from) the type-tab fallback below.
 * - Opened from S20 (`openedFrom: 'manage'`) -> S20's OWN origin, if stable (today / a type
 *   browse tab). If S20's own origin is unstable (search, or no origin at all) -> the deleted
 *   task's type browse tab. S14 (search) is never a stable destination on either path.
 */
export function confirmedDeleteDestination(input: {
  readonly openedFrom: 'manage' | 'as-needed';
  readonly s20Origin: string | undefined;
  readonly taskType: TaskType;
}): string {
  if (input.openedFrom === 'as-needed') return ROUTES.routines;
  if (isStableS20Origin(input.s20Origin)) return STABLE_ORIGIN_ROUTE[input.s20Origin];
  return typeTabRoute(input.taskType);
}
