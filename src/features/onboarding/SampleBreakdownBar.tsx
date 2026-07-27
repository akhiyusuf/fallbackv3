/**
 * M7. S05's illustrative 7-day sample bar.
 *
 * NOT a reuse of `@/ui`'s `ConsistencyBreakdownBar` (`src/ui`, frozen M0 kit) — that
 * component always renders a fourth "Missed, <n>" legend entry, unconditionally. S05's own
 * spec is explicit that this sample's legend carries exactly three swatch+label pairs
 * ("Ideal", "Fallback", "Off") and that missed "stays unnamed... never announced or
 * labeled" (ALLSCREENS_1.md S05, Interactions). Building a second `ConsistencyBreakdownBar`
 * would violate "no module defines its own button/card/chip" in spirit — but this is a
 * one-off illustrative sample, not a live consistency surface, and no owned path lets M7 add
 * a `legendLabels`-hiding prop to the frozen kit component. Composed from theme tokens only
 * (Rule 1: no raw colour literal), same signal hues the kit component itself uses.
 */
import { StyleSheet, Text, View } from 'react-native';

import { SPACE, useTheme } from '@/theme';

import { S05_COPY } from './copy';

export function SampleBreakdownBar() {
  const t = useTheme();
  const { ideal, fallback, off, total } = S05_COPY.sample;
  const pct = (n: number) => `${(n / total) * 100}%` as `${number}%`;

  return (
    <View style={styles.root}>
      <View
        style={[styles.track, { borderColor: t.color.border }]}
        accessibilityRole="progressbar"
        accessibilityLabel="Example breakdown: ideal, fallback, off"
      >
        <View style={{ width: pct(ideal), backgroundColor: t.color.ideal }} />
        <View style={{ width: pct(fallback), backgroundColor: t.color.fallback }} />
        <View style={{ width: pct(off), backgroundColor: t.color.off }} />
        {/* The remainder — 1 of 7, the sample's missed day — is deliberately unfilled and unnamed. */}
      </View>
      <View style={styles.legend}>
        <LegendItem swatchColor={t.color.ideal} label={S05_COPY.legend.ideal} textColor={t.color.textMuted} />
        <LegendItem swatchColor={t.color.fallback} label={S05_COPY.legend.fallback} textColor={t.color.textMuted} />
        <LegendItem swatchColor={t.color.off} label={S05_COPY.legend.off} textColor={t.color.textMuted} />
      </View>
    </View>
  );
}

function LegendItem({ swatchColor, label, textColor }: { swatchColor: string; label: string; textColor: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: swatchColor }]} />
      <Text style={[styles.legendText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACE.s2 },
  track: { flexDirection: 'row', height: 16, borderRadius: 999, borderWidth: 1, overflow: 'hidden' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13 },
});
