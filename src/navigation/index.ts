/**
 * M0. Route constants + the origin-aware back helper.
 *
 * Seven screens have ONE route but TWO valid back destinations (S14, S22, S23, S25,
 * S27, S29, S48). The origin travels as a `?from=` search param; NEVER hardcode a
 * back destination on those screens. See docs/ARCHITECTURE.md §4.3.
 * STUB — M0 implements.
 */
export type ScreenOrigin =
  | 'today' | 'routines' | 'events' | 'courses' | 'todos'
  | 'search' | 'settings' | 'manage' | 'as-needed' | 'data' | 'recovery' | 'achievements';

export declare function useOriginAwareBack(fallback: string): () => void;
export declare function withOrigin(href: string, origin: ScreenOrigin): string;
