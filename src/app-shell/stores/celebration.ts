/**
 * Celebration queue — milestone pop-ups (D2). Daily logs never land here; only
 * a level-up, a badge or a tenure mark does. The host in app/_layout.tsx shows
 * one at a time over the dimmed current screen.
 */
import { create } from 'zustand';

export type Celebration =
  | { readonly kind: 'level-up'; readonly lifetimeXp: number }
  | { readonly kind: 'badge'; readonly badgeKey: string };

export interface CelebrationStoreState {
  readonly queue: readonly Celebration[];
  push(celebration: Celebration): void;
  shift(): void;
}

export const useCelebrationStore = create<CelebrationStoreState>((set) => ({
  queue: [],
  push: (celebration) => set((s) => ({ queue: [...s.queue, celebration] })),
  shift: () => set((s) => ({ queue: s.queue.slice(1) })),
}));
