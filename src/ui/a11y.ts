/**
 * M0 kit — the one canonical "screen-reader-only" idiom. Any component that needs to
 * announce a label/summary without it being visible, and without it wrapping (and thereby
 * swallowing) interactive children, uses this pair — style AND props together, always both:
 *
 *   <Text style={SR_ONLY_STYLE} {...SR_ONLY_PROPS}>…</Text>
 *
 * `SR_ONLY_STYLE` hides it visually (zero-size, transparent) without `display: 'none'`,
 * which `isSubtreeInaccessible` treats as genuinely hidden from every screen reader too.
 * `SR_ONLY_PROPS` is belt-and-braces: it force-marks the node visible to accessibility
 * tooling (`accessibilityElementsHidden: false` on iOS, `importantForAccessibility: 'yes'`
 * on Android) so an ancestor's unrelated `no-hide-descendants`/hidden setting can never
 * accidentally suppress it. Previously `TrendGraph` used both and `CalendarHeatmap` used
 * only the style half — REVIEW-M0.md (pass 3, carried item 2) asked for one spelling; this
 * is it, and every future kit component with the same need imports from here rather than
 * re-declaring its own copy.
 */
import type { AccessibilityProps, StyleProp, TextStyle } from 'react-native';

export const SR_ONLY_STYLE: StyleProp<TextStyle> = { position: 'absolute', width: 1, height: 1, opacity: 0 };

export const SR_ONLY_PROPS: Pick<AccessibilityProps, 'accessibilityElementsHidden' | 'importantForAccessibility'> = {
  accessibilityElementsHidden: false,
  importantForAccessibility: 'yes',
};
