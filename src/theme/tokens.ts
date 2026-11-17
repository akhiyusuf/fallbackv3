/**
 * M0. Design tokens, transcribed from the approved design system.
 * Source of truth (human-owned, never edited):
 *   design-input/fallback-handoff/_ds/verdant-design-system-<id>/tokens (Verdant base)
 *   design-input/fallback-handoff/fallback-theme.css                        (Fallback layer — WINS on conflict)
 *   the dark-mode override block inside design-input/Fallback Handoff (standalone).html
 *
 * RULE 1: no raw colour literal may appear anywhere outside this file.
 * RULE 2: a theme is one seed colour. `engine.ts` derives the solid, its text colour, the tint, the
 *         coloured text and the page tone from it, and checks every pair for contrast.
 *         Signal colours (ideal / fallback / off / gold) are THEME-IMMUNE by construction: they are
 *         never derived from the seed, and theme hues are kept away from them (see THEME_HUES).
 */

export type ColorScheme = 'light' | 'dark';

export const ACCENTS = {
  // base  = the vivid brand colour, for marks that carry no text (progress, dots, icon circles, the add button).
  // fill  = behind white text (buttons, selected chips): at least 4.5:1 with white. fillEdge = its pressed/3D edge.
  // deep  = accent-coloured text and icons on light surfaces. textDark = the same on dark surfaces.
  'forge-orange': { base: '#F2601A', hover: '#DE5310', deep: '#B4400A', fill: '#C8490C', fillEdge: '#98380A', textDark: '#FF8A4F', softLight: '#FCEADD', softDark: '#3D2415', label: 'Forge Orange' },
  indigo: { base: '#4F46E5', hover: '#4338CA', deep: '#3730A3', fill: '#4F46E5', fillEdge: '#3730A3', textDark: '#A9A5FF', softLight: '#E7E6FB', softDark: '#232048', label: 'Indigo' },
  berry: { base: '#D6336C', hover: '#C2255C', deep: '#9C1A4E', fill: '#CE2C65', fillEdge: '#9C1A4E', textDark: '#FF85AD', softLight: '#FBE2EC', softDark: '#3D1626', label: 'Berry' },
  plum: { base: '#9333EA', hover: '#7E22CE', deep: '#6B21A8', fill: '#9333EA', fillEdge: '#6B21A8', textDark: '#CBA1FF', softLight: '#F1E4FB', softDark: '#301A44', label: 'Plum' },
} as const;

/** Near-black and white: the only two colours text on a solid is ever drawn in. */
export const INK = '#26241f';
export const WHITE = '#ffffff';

/** Named themes: one seed colour each. Everything else is derived (see engine.ts). */
export const THEME_SEEDS = {
  'forge-orange': '#F2601A',
  indigo: '#4F46E5',
  berry: '#D6336C',
  plum: '#9333EA',
  lagoon: '#0D9488',
  /** Black and white. Not a seed for the engine: it has its own hand-set palette (see `deriveMonoTheme`). */
  mono: '#1C1C1C',
} as const;
export const THEME_LABELS = { 'forge-orange': 'Forge', indigo: 'Indigo', berry: 'Berry', plum: 'Plum', lagoon: 'Lagoon', mono: 'Mono' } as const;
export const THEME_ORDER = ['forge-orange', 'indigo', 'berry', 'plum', 'lagoon', 'mono'] as const;

/**
 * The only hues (OKLCH degrees) a person may choose for their own colour. Three families:
 * warm oranges, teals, and indigo through pink. Greens, sky blues, golds and reds are left out
 * because those hues mean ideal, fallback, XP and error. Brightness and strength are fixed.
 */
export const THEME_HUES = [52, 62, 180, 192, 204, 216, 276, 288, 300, 312, 324, 336, 348, 0, 10] as const;

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
  xp: string; xpFill: string; iconOnSignal: string; textOnAccent: string;
}

// Every text colour below is at least 4.5:1 on bg, bgAlt and its own "soft" tint; borderStrong is at
// least 3:1 so a field or control is visible by its outline. Cards (bgAlt) sit lighter than the page (bg).
const LIGHT: Palette = {
  bg: '#f6f4f0',
  bgAlt: '#ffffff',
  surface: '#ebe8e1',
  canvas: '#e9e5dd',
  text: '#33312b',
  textMuted: '#5f5b52',
  textDim: '#716d64',
  border: '#e2dfd8',
  borderStrong: '#8f8a80',

  ideal: '#22A94E',
  idealDeep: '#17743A',
  idealSoft: '#DFF5E5',
  fallback: '#2B93EE',
  fallbackDeep: '#1560AB',
  fallbackSoft: '#DDEEFD',
  off: '#A8A294',
  offDeep: '#676258',
  offSoft: '#EEEBE5',
  celebrationGold: '#DCB863',
  goldDeep: '#7D5F14',
  goldSoft: '#F7F0E0',

  danger: '#D93636',
  dangerSoft: '#FFECEC',
  dangerDeep: '#C42727',

  xp: '#7D5F14',
  xpFill: '#DCB863',
  iconOnSignal: '#26241f',
  textOnAccent: '#ffffff',
};

const DARK: Palette = {
  bg: '#211f1c',
  bgAlt: '#282521',
  surface: '#33302a',
  canvas: '#141312',
  text: '#efece6',
  textMuted: '#bdb7ac',
  textDim: '#a09a90',
  border: '#3b3831',
  borderStrong: '#7a7469',

  ideal: '#2DBE5E',
  idealDeep: '#6BDD90',
  idealSoft: '#173623',
  fallback: '#3D9DF2',
  fallbackDeep: '#82C3FF',
  fallbackSoft: '#152D46',
  off: '#8A857A',
  offDeep: '#A9A396',
  offSoft: '#302E29',
  celebrationGold: '#CBA24C',
  goldDeep: '#DDBE79',
  goldSoft: '#332B1C',

  danger: '#D93636',
  dangerSoft: '#3A2222',
  dangerDeep: '#FF7A7A',

  xp: '#DDBE79',
  xpFill: '#CBA24C',
  iconOnSignal: '#1c1a17',
  textOnAccent: '#ffffff',
};

export const PALETTES = { light: LIGHT, dark: DARK } as const;

/** 8px base scale, per Verdant tokens/spacing.css. */
export const SPACE = { s0: 0, s1: 4, s2: 8, s3: 16, s4: 24, s5: 32, s6: 48, s7: 64, s8: 96 } as const;

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

/**
 * Depth. Anything you can press is a chunky piece: a 2px outline and a thicker bottom edge.
 * Pressing it pushes it down by the difference (see `cardSurface` in `@/ui/surface`).
 */
export const EDGE = { outline: 2, bottom: 5 } as const;

/**
 * Typeface: Nunito, a rounded face. Headings and numbers use 800, labels 700, body 500/600.
 * On device each weight is its own font file, so text must go through the kit's weight map
 * rather than `fontWeight` alone.
 */
export const FONT_FAMILY = 'Nunito';

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
export const SCRIM = 'rgba(30, 28, 24, 0.45)';
/** Fixed header height shared by every screen (D4). */
export const HEADER_HEIGHT = 56;
/** Hairline used for dividers inside grouped lists (D7). */
export const HAIRLINE = 1;
