/**
 * M0. Design tokens, transcribed from the approved design system.
 * Source of truth (human-owned, never edited):
 *   design-input/fallback-handoff/_ds/verdant-design-system-<id>/tokens (Verdant base)
 *   design-input/fallback-handoff/fallback-theme.css                        (Fallback layer — WINS on conflict)
 *   the dark-mode override block inside design-input/Fallback Handoff (standalone).html
 *
 * RULE 1: no raw colour literal may appear anywhere outside this file.
 * RULE 2: the accent recolours CTAs, progress, the active tab and the add button — and nothing else.
 *         Signal colours (ideal / fallback / off / gold) are ACCENT-IMMUNE by construction: they are
 *         not derived from `accent` in either palette below.
 */

export type ColorScheme = 'light' | 'dark';

export const ACCENTS = {
  'forge-orange': { base: '#F2601A', hover: '#DE5310', deep: '#B4400A', softLight: '#FCEADD', softDark: '#3D2415', label: 'Forge Orange' },
  indigo: { base: '#4F46E5', hover: '#4338CA', deep: '#3730A3', softLight: '#E7E6FB', softDark: '#232048', label: 'Indigo' },
  berry: { base: '#D6336C', hover: '#C2255C', deep: '#9C1A4E', softLight: '#FBE2EC', softDark: '#3D1626', label: 'Berry' },
  plum: { base: '#9333EA', hover: '#7E22CE', deep: '#6B21A8', softLight: '#F1E4FB', softDark: '#301A44', label: 'Plum' },
} as const;

export type AccentToken = keyof typeof ACCENTS;
export const DEFAULT_ACCENT: AccentToken = 'forge-orange';

export interface Palette {
  bg: string; bgAlt: string; surface: string; canvas: string;
  text: string; textMuted: string; textDim: string;
  border: string; borderStrong: string;
  ideal: string; idealDeep: string; idealSoft: string;
  fallback: string; fallbackDeep: string; fallbackSoft: string;
  off: string; offDeep: string; offSoft: string;
  celebrationGold: string; goldDeep: string; goldSoft: string;
  danger: string; dangerSoft: string; dangerDeep: string;
  xp: string; iconOnSignal: string; textOnAccent: string;
}

const LIGHT: Palette = {
  bg: '#ffffff',
  bgAlt: '#fbfaf8',
  surface: '#f1efea',
  canvas: '#e9e5dd',
  text: '#37352f',
  textMuted: '#6f6b62',
  textDim: '#a09c92',
  border: '#e9e7e2',
  borderStrong: '#d6d3cc',

  ideal: '#8FBC6B',
  idealDeep: '#5F8A3E',
  idealSoft: '#EFF5E7',
  fallback: '#7FB2D4',
  fallbackDeep: '#4E82A8',
  fallbackSoft: '#EAF2F8',
  off: '#A8A294',
  offDeep: '#7B766C',
  offSoft: '#EEEBE5',
  celebrationGold: '#DCB863',
  goldDeep: '#A8853B',
  goldSoft: '#F7F0E0',

  danger: '#FF4B4B',
  dangerSoft: '#FFECEC',
  dangerDeep: '#D63030',

  xp: '#7FB2D4',
  iconOnSignal: '#ffffff',
  textOnAccent: '#ffffff',
};

const DARK: Palette = {
  bg: '#211f1c',
  bgAlt: '#282521',
  surface: '#33302a',
  canvas: '#141312',
  text: '#efece6',
  textMuted: '#b0aa9f',
  textDim: '#7d7870',
  border: '#3b3831',
  borderStrong: '#4d4941',

  ideal: '#7CA95F',
  idealDeep: '#A8C98D',
  idealSoft: '#2C3323',
  fallback: '#6C9DBE',
  fallbackDeep: '#9FC2D9',
  fallbackSoft: '#22303B',
  off: '#8A857A',
  offDeep: '#A9A396',
  offSoft: '#302E29',
  celebrationGold: '#CBA24C',
  goldDeep: '#DDBE79',
  goldSoft: '#332B1C',

  danger: '#FF4B4B',
  dangerSoft: '#3A2222',
  dangerDeep: '#8F2F2F',

  xp: '#6C9DBE',
  iconOnSignal: '#ffffff',
  textOnAccent: '#ffffff',
};

export const PALETTES = { light: LIGHT, dark: DARK } as const;

/** 8px base scale, per Verdant tokens/spacing.css. */
export const SPACE = { s0: 0, s1: 4, s2: 8, s3: 16, s4: 24, s5: 32, s6: 48, s7: 64, s8: 96 } as const;

export const RADIUS = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const FONT_SIZE = { xs: 12, sm: 14, base: 16, md: 18, lg: 20, xl: 24, xxl: 32, xxxl: 40, display: 56 } as const;

export const FONT_WEIGHT = { regular: '400', medium: '500', semibold: '600', bold: '700', black: '800' } as const;

export const LINE_HEIGHT = { tight: 1.15, heading: 1.25, body: 1.6, ui: 1.4 } as const;

export const MOTION = {
  durFast: 120,
  durBase: 180,
  /** Tactile spring used for the S24 reward pop. Degrades to a cross-fade under reduce-motion. */
  spring: { damping: 12, stiffness: 220, mass: 0.9 },
} as const;

/** Minimum tap target, per the design system's Rule 8. */
export const MIN_TAP_TARGET = 44;

/**
 * Modal/sheet scrim — Verdant readme.md "Transparency / blur": `rgba(55,53,47,0.30)` in
 * both palettes (not theme-dependent, so it lives beside the palettes rather than inside
 * one). The only sanctioned raw colour literal outside this file is this constant's use.
 */
export const SCRIM = 'rgba(55, 53, 47, 0.30)';
