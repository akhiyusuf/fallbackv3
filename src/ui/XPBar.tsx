/**
 * M0 kit — Fallback-custom `XPBar` (F13/F31). XP keeps Verdant's own fixed "XP blue"
 * hue (`tokens.ts` `xp`), distinct from the accent — the accent is reserved for CTAs,
 * generic progress, the active tab and the add button (ARCHITECTURE §5), not this signal.
 */
import { StyleSheet, Text, View } from 'react-native';

import { RADIUS, SPACE, useTheme } from '@/theme';

export interface XPBarProps {
  readonly title: string;
  readonly valueLabel: string;
  readonly current: number;
  /** null when there is no fixed ceiling to show as a fraction (e.g. a mid-cycle running total with no cap UI). */
  readonly max: number | null;
  readonly subline?: string;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

export function XPBar({ title, valueLabel, current, max, subline, accessibilityLabel, testID }: XPBarProps) {
  const t = useTheme();
  const percent = max && max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : null;

  return (
    <View style={styles.root} testID={testID}>
      <Text style={[styles.title, { color: t.color.text }]}>{title}</Text>
      <Text
        style={[styles.value, { color: t.color.xp }]}
        accessibilityRole="text"
        accessibilityLabel={accessibilityLabel ?? `${title}, ${valueLabel}`}
      >
        {valueLabel}
      </Text>
      {percent !== null ? (
        <View style={[styles.track, { backgroundColor: t.color.surface }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }}>
          <View style={[styles.fill, { width: `${percent}%`, backgroundColor: t.color.xp }]} />
        </View>
      ) : null}
      {subline ? <Text style={[styles.subline, { color: t.color.textMuted }]}>{subline}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACE.s1 },
  title: { fontSize: 14, fontWeight: '600' },
  value: { fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  track: { height: 10, borderRadius: RADIUS.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: RADIUS.pill },
  subline: { fontSize: 13 },
});
