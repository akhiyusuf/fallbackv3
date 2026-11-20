/** M0. Theme resolution + `useTheme()`. */

import { createContext, useContext } from 'react';

import type { AccentKey, ThemeMode } from '@/types';

import { deriveMonoTheme, deriveTheme, seedForHue, type DerivedAccent } from './engine';
import { DEFAULT_ACCENT, THEME_LABELS, THEME_SEEDS, type ColorScheme, type Palette } from './tokens';

export * from './tokens';
export { contrast, mix, seedForHue } from './engine';

export interface Theme {
  readonly scheme: ColorScheme;
  readonly accent: DerivedAccent;
  readonly color: Palette;
}

/** The hue of a person's own color, or null for a named theme. */
export function customHue(key: AccentKey): number | null {
  if (!key.startsWith('hue-')) return null;
  const n = Number(key.slice(4));
  return Number.isFinite(n) ? ((Math.round(n) % 360) + 360) % 360 : null;
}

/** The seed color behind a theme key. */
export function themeSeed(key: AccentKey): string {
  const hue = customHue(key);
  if (hue !== null) return seedForHue(hue);
  return (THEME_SEEDS as Record<string, string>)[key] ?? THEME_SEEDS[DEFAULT_ACCENT];
}

export function themeLabel(key: AccentKey): string {
  return customHue(key) !== null ? 'Your color' : ((THEME_LABELS as Record<string, string>)[key] ?? THEME_LABELS[DEFAULT_ACCENT]);
}

export function buildTheme(scheme: ColorScheme, accentKey: AccentKey = DEFAULT_ACCENT): Theme {
  const d = accentKey === 'mono' ? deriveMonoTheme(scheme) : deriveTheme(themeSeed(accentKey), scheme);
  return { scheme, accent: d.accent, color: d.color };
}

export const ThemeContext = createContext<Theme>(buildTheme('light'));

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** Resolves `auto` against the OS scheme. M0 wires this to `useColorScheme()`. */
export function resolveScheme(mode: ThemeMode, osScheme: ColorScheme | null): ColorScheme {
  if (mode === 'auto') return osScheme ?? 'light';
  return mode;
}
