/** M0. Theme resolution + `useTheme()`. */

import { createContext, useContext } from 'react';

import type { AccentKey, ThemeMode } from '@/types';

import { ACCENTS, DEFAULT_ACCENT, PALETTES, type ColorScheme, type Palette } from './tokens';

export * from './tokens';

export interface Theme {
  readonly scheme: ColorScheme;
  readonly accent: {
    readonly base: string;
    readonly hover: string;
    readonly deep: string;
    readonly soft: string;
  };
  readonly color: Palette;
}

export function buildTheme(scheme: ColorScheme, accentKey: AccentKey = DEFAULT_ACCENT): Theme {
  const a = ACCENTS[accentKey];
  return {
    scheme,
    accent: { base: a.base, hover: a.hover, deep: a.deep, soft: scheme === 'dark' ? a.softDark : a.softLight },
    color: PALETTES[scheme],
  };
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
