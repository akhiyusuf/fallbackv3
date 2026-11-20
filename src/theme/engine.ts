/**
 * Theme engine. One seed color in, a whole contrast-checked theme out.
 *
 * A theme is never a hand-picked table of shades: every shade is derived from the seed by the
 * rules below, so a named theme and a person's own color go through the same checks and no
 * theme can produce text that is hard to read. Works in OKLCH so that "darker" and "lighter"
 * keep the hue.
 */
import { INK, PALETTES, WHITE, type ColorScheme, type Palette } from './tokens';

type Rgb = readonly [number, number, number];

function hexToRgb(hex: string): Rgb {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
function rgbToHex(rgb: Rgb): string {
  return `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}
function toLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function toGamma(c: number): number {
  return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
}
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG contrast ratio between two colors. */
export function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** `share` of `b` mixed into `a`. */
export function mix(a: string, b: string, share: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * share, x[1] + (y[1] - x[1]) * share, x[2] + (y[2] - x[2]) * share]);
}

/** Lightness, chroma, hue (degrees). */
export function toLch(hex: string): readonly [number, number, number] {
  const [r8, g8, b8] = hexToRgb(hex);
  const r = toLinear(r8);
  const g = toLinear(g8);
  const b = toLinear(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}

/** Nearest displayable color: chroma is reduced until the color fits the screen. */
export function fromLch(L: number, C: number, H: number): string {
  const hr = (H * Math.PI) / 180;
  for (let c = C; c >= 0; c -= 0.004) {
    const a = c * Math.cos(hr);
    const b = c * Math.sin(hr);
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
    const rgb: Rgb = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    if (rgb.every((v) => v >= -0.001 && v <= 1.001)) {
      return rgbToHex([toGamma(Math.max(0, Math.min(1, rgb[0]))), toGamma(Math.max(0, Math.min(1, rgb[1]))), toGamma(Math.max(0, Math.min(1, rgb[2])))]);
    }
  }
  return L > 0.5 ? WHITE : INK;
}

export interface DerivedAccent {
  /** The seed itself: marks that carry no text (rings, dots, progress). */
  readonly base: string;
  /** Solid behind text: buttons, selected chips, the add button, the top card. Kept bright. */
  readonly fill: string;
  readonly fillEdge: string;
  readonly hover: string;
  /** Small text and icons on `fill`: whichever of ink or white reads at 4.5:1 or better. */
  readonly on: string;
  /** Large text and icons on `fill` (3:1 is enough): white whenever it passes. */
  readonly onLarge: string;
  /** A deeper band of the same color where small white text reads at 4.5:1. */
  readonly band: string;
  readonly onBand: string;
  /** Theme-colored text and icons on the page, a card or the tint. */
  readonly text: string;
  readonly deep: string;
  /** The tint: selected rows, pills, the active tab. */
  readonly soft: string;
}

export interface DerivedTheme {
  readonly accent: DerivedAccent;
  readonly color: Palette;
}

const cache = new Map<string, DerivedTheme>();

export function deriveTheme(seed: string, scheme: ColorScheme): DerivedTheme {
  const key = `${seed}|${scheme}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const [L, C, H] = toLch(seed);
  const dark = scheme === 'dark';
  const walk = (test: (c: string) => boolean, dir: 1 | -1, l0: number = L, c0: number = C): string => {
    let l = l0;
    let c = fromLch(l, c0, H);
    for (let n = 0; n < 90 && !test(c); n += 1) {
      l += dir * 0.01;
      c = fromLch(l, c0, H);
    }
    return c;
  };

  // The page takes a hint of the theme; cards stay the lightest surface.
  const n = PALETTES[scheme];
  const color: { -readonly [K in keyof Palette]: Palette[K] } = dark
    ? { ...n, bg: mix(n.bg, seed, 0.07), bgAlt: mix(n.bgAlt, seed, 0.08), surface: mix(n.surface, seed, 0.11), border: mix(n.border, seed, 0.13) }
    : { ...n, bg: mix(n.bg, seed, 0.05), surface: mix(n.surface, seed, 0.08), border: mix(n.border, seed, 0.09) };

  // Secondary text keeps 4.5:1 on the tinted page and cards.
  // Field and control outlines keep 3:1.
  const readable = (c: string, min: number): string => {
    let out = c;
    for (let i = 0; i < 20 && Math.min(contrast(out, color.bg), contrast(out, color.bgAlt)) < min; i += 1) out = mix(out, n.text, 0.08);
    return out;
  };
  color.textMuted = readable(n.textMuted, 4.6);
  color.textDim = readable(n.textDim, 4.6);
  color.borderStrong = readable(n.borderStrong, 3.05);

  const bestOn = contrast(INK, seed) >= contrast(WHITE, seed) ? INK : WHITE;
  // Bright fill: the seed, nudged only if neither ink nor white reads on it, and until white reads at 3:1.
  let fill = contrast(bestOn, seed) >= 4.5 ? seed : walk((c) => contrast(bestOn, c) >= 4.5, bestOn === WHITE ? -1 : 1);
  if (contrast(WHITE, fill) < 3 && bestOn === INK) fill = walk((c) => contrast(WHITE, c) >= 3 && contrast(INK, c) >= 4.5, -1, toLch(fill)[0]);
  const on = contrast(INK, fill) >= contrast(WHITE, fill) ? INK : WHITE;
  const onLarge = contrast(WHITE, fill) >= 3 ? WHITE : on;
  const [fl] = toLch(fill);
  const band = walk((c) => contrast(WHITE, c) >= 4.6, -1, fl - 0.04);
  const soft = dark ? mix(color.bgAlt, seed, 0.26) : mix(WHITE, seed, 0.13);
  const deep = walk((c) => contrast(c, PALETTES.light.bg) >= 4.6 && contrast(c, mix(WHITE, seed, 0.13)) >= 4.5, -1);
  const text = dark
    ? walk((c) => contrast(c, color.bgAlt) >= 5.2 && contrast(c, soft) >= 4.5, 1, Math.max(L, 0.7), Math.min(C, 0.17))
    : walk((c) => contrast(c, color.bg) >= 4.6 && contrast(c, soft) >= 4.5, -1);

  const out: DerivedTheme = {
    accent: { base: seed, fill, fillEdge: fromLch(fl - 0.12, C, H), hover: fromLch(fl - 0.05, C, H), on, onLarge, band, onBand: WHITE, text, deep, soft },
    color,
  };
  cache.set(key, out);
  return out;
}

/**
 * Mono — the black-and-white theme. Nothing here is derived from a seed: the page, the cards
 * and every theme-colored piece are pure neutrals, and the "theme color" is black on a light
 * page and white on a dark one. The state signals (ideal green, fallback blue, gold, danger)
 * are untouched, so they are the only color on the screen.
 */
export function deriveMonoTheme(scheme: ColorScheme): DerivedTheme {
  const key = `mono|${scheme}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const n = PALETTES[scheme];
  const dark = scheme === 'dark';
  const color: Palette = dark
    ? {
        ...n,
        bg: '#0f0f0f',
        bgAlt: '#1a1a1a',
        surface: '#262626',
        canvas: '#000000',
        text: '#f2f2f2',
        textMuted: '#b8b8b8',
        textDim: '#9c9c9c',
        border: '#333333',
        borderStrong: '#7a7a7a',
        off: '#868686',
        offDeep: '#a8a8a8',
        offSoft: '#2b2b2b',
      }
    : {
        ...n,
        bg: '#f3f3f3',
        bgAlt: '#ffffff',
        surface: '#e7e7e7',
        canvas: '#e2e2e2',
        text: '#1c1c1c',
        textMuted: '#555555',
        textDim: '#6b6b6b',
        border: '#dcdcdc',
        borderStrong: '#8a8a8a',
        off: '#a3a3a3',
        offDeep: '#626262',
        offSoft: '#ececec',
      };
  const accent: DerivedAccent = dark
    ? { base: '#f2f2f2', fill: '#f2f2f2', fillEdge: '#b4b4b4', hover: '#dedede', on: '#141414', onLarge: '#141414', band: '#d2d2d2', onBand: '#141414', text: '#f2f2f2', deep: '#1c1c1c', soft: '#2e2e2e' }
    : { base: '#1c1c1c', fill: '#1c1c1c', fillEdge: '#000000', hover: '#333333', on: WHITE, onLarge: WHITE, band: '#3a3a3a', onBand: WHITE, text: '#1c1c1c', deep: '#1c1c1c', soft: '#e6e6e6' };
  const out: DerivedTheme = { accent, color };
  cache.set(key, out);
  return out;
}

/** The seed a person's own color produces: they choose the hue, the app fixes brightness and strength. */
export function seedForHue(hue: number): string {
  return fromLch(0.63, 0.2, hue);
}
