/**
 * The one card surface. Everything card-like (Card, list groups, task cards) is a chunky
 * piece: a 2px outline, rounder corners and a thicker bottom edge. A pressable piece is
 * pushed down by the thickness of that edge while pressed.
 */
import type { ViewStyle } from 'react-native';

import { EDGE, mix, RADIUS, type Theme } from '@/theme';

export function cardSurface(t: Theme): ViewStyle {
  return {
    backgroundColor: t.color.bgAlt,
    borderColor: t.color.border,
    borderWidth: EDGE.outline,
    borderBottomWidth: EDGE.bottom,
    borderRadius: RADIUS.xl,
  };
}

/**
 * A piece that has taken a state colour (a logged task). It sits flat: no raised edge, as if
 * it has been pressed in. Never give it a contrasting bar underneath.
 */
export function settledSurface(fill: string): ViewStyle {
  return { backgroundColor: fill, borderColor: fill, borderWidth: EDGE.outline, borderRadius: RADIUS.xl, marginTop: EDGE.bottom - EDGE.outline };
}

/**
 * A piece washed in one colour (the theme colour, or a task's own). The wash is strong enough
 * to stand off the tinted page, and it is closed by an outline in a deeper tone of the same
 * colour. Flat: no thicker bottom edge.
 */
export function tintedSurface(t: Theme, color: string): ViewStyle {
  const dark = t.scheme === 'dark';
  return {
    backgroundColor: mix(t.color.bgAlt, color, dark ? 0.3 : 0.2),
    borderColor: mix(t.color.bgAlt, color, dark ? 0.62 : 0.5),
    borderWidth: EDGE.outline,
    borderRadius: RADIUS.xl,
  };
}

/** Applied while a pressable piece is held: the bottom edge collapses and the piece moves down. */
export const pressedSurface: ViewStyle = { borderBottomWidth: EDGE.outline, marginTop: EDGE.bottom - EDGE.outline };
