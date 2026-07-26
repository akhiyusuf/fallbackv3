/**
 * M0. Ephemeral theme/accent store — mirrors `settings.theme` / `settings.accent` once
 * M1's store is wired (ARCHITECTURE §3, tier 2). `app/_layout.tsx` derives the resolved
 * `Theme` object from this store + the OS scheme and provides it via `ThemeContext`.
 */
import { create } from 'zustand';

import type { AccentKey, ThemeMode } from '@/types';
import { DEFAULT_ACCENT } from '@/theme/tokens';

export interface ThemeStoreState {
  readonly mode: ThemeMode;
  readonly accent: AccentKey;
  setMode(mode: ThemeMode): void;
  setAccent(accent: AccentKey): void;
  /** Hydrates both fields at once, e.g. from a `Settings` read on boot. */
  hydrate(mode: ThemeMode, accent: AccentKey): void;
}

export const useThemeStore = create<ThemeStoreState>((set) => ({
  mode: 'auto',
  accent: DEFAULT_ACCENT,
  setMode: (mode) => set({ mode }),
  setAccent: (accent) => set({ accent }),
  hydrate: (mode, accent) => set({ mode, accent }),
}));
