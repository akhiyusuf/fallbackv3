/**
 * M0 kit — Fallback-custom `ConsistencyBreakdownBar`. Stacked Ideal/Fallback/Off bar; the
 * unfilled remainder IS the missed share (ARCHITECTURE §5 — missed has no colour of its
 * own, never fully filled when `missed > 0`). Purely presentational — M5 supplies the
 * already-computed `ConsistencyBreakdown` and denominator; this component does no math
 * beyond simple proportional widths.
 */
import { StyleSheet, Text, View } from 'react-native';

import { SPACE, useTheme } from '@/theme';
import type { ConsistencyBreakdown } from '@/types';

export interface ConsistencyBreakdownBarProps {
  readonly breakdown: ConsistencyBreakdown;
  /** The denominator the four categories are proportional to (may exceed their sum by rounding). */
  readonly total: number;
  readonly legendLabels?: { ideal: string; fallback: string; off: string; missed: string };
  readonly unitCaption?: string;
  readonly accessibilityLabel: string;
}

const DEFAULT_LABELS = { ideal: 'Ideal', fallback: 'Fallback', off: 'Off', missed: 'Missed' };

export function ConsistencyBreakdownBar({ breakdown, total, legendLabels = DEFAULT_LABELS, unitCaption, accessibilityLabel }: ConsistencyBreakdownBarProps) {
  const t = useTheme();
  const safeTotal = total > 0 ? total : 1;
  const idealPct = (Math.max(0, breakdown.ideal) / safeTotal) * 100;
  const fallbackPct = (Math.max(0, breakdown.fallback) / safeTotal) * 100;
  const offPct = (Math.max(0, breakdown.off) / safeTotal) * 100;

  return (
    <View>
      <View
        style={[styles.track, { backgroundColor: 'transparent', borderColor: t.color.border }]}
        accessibilityRole="progressbar"
        accessibilityLabel={accessibilityLabel}
      >
        <View style={{ width: `${idealPct}%`, backgroundColor: t.color.ideal }} />
        <View style={{ width: `${fallbackPct}%`, backgroundColor: t.color.fallback }} />
        <View style={{ width: `${offPct}%`, backgroundColor: t.color.off }} />
        {/* The remainder — missed — is deliberately left unfilled; it has no colour of its own. */}
      </View>
      <View style={styles.legend}>
        <LegendItem swatchColor={t.color.ideal} label={legendLabels.ideal} value={breakdown.ideal} textColor={t.color.textMuted} />
        <LegendItem swatchColor={t.color.fallback} label={legendLabels.fallback} value={breakdown.fallback} textColor={t.color.textMuted} />
        <LegendItem swatchColor={t.color.off} label={legendLabels.off} value={breakdown.off} textColor={t.color.textMuted} />
        <LegendItem swatchColor={undefined} label={legendLabels.missed} value={breakdown.missed} textColor={t.color.textMuted} borderColor={t.color.borderStrong} />
      </View>
      {unitCaption ? <Text style={[styles.caption, { color: t.color.textDim }]}>{unitCaption}</Text> : null}
    </View>
  );
}

function LegendItem({
  swatchColor,
  borderColor,
  label,
  value,
  textColor,
}: {
  swatchColor?: string;
  borderColor?: string;
  label: string;
  value: number;
  textColor: string;
}) {
  return (
    <View style={styles.legendItem} accessible accessibilityLabel={`${label}, ${value}`}>
      <View style={[styles.swatch, { backgroundColor: swatchColor ?? 'transparent', borderColor: borderColor ?? swatchColor, borderWidth: swatchColor ? 0 : 1 }]} />
      <Text style={[styles.legendText, { color: textColor }]}>
        {label} · {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', height: 16, borderRadius: 999, borderWidth: 1, overflow: 'hidden' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2, marginTop: SPACE.s2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13 },
  caption: { fontSize: 12, marginTop: SPACE.s1, lineHeight: 18 },
});
