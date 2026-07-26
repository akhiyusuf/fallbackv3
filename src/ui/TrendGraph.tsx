/**
 * M0 kit — Fallback-custom `TrendGraph` (F28). Hand-rolled `react-native-svg` polyline —
 * ARCHITECTURE §1's chosen approach, no charting library. Ship-blocking a11y (ARCHITECTURE
 * §5.1 / PRD §5/§28): a screen-reader-only text summary of every bucket is present AT ALL
 * TIMES (not gated on the toggle), plus a real "View as table" alternative — a chart is
 * never the only representation. A `null` percent is a genuine gap: the line breaks, never
 * a fabricated 0%.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { SPACE, useTheme } from '@/theme';

import { SR_ONLY_PROPS, SR_ONLY_STYLE } from './a11y';
import { Button } from './Button';

export interface TrendGraphPoint {
  readonly bucketKey: string;
  readonly label: string;
  /** null == this bucket had zero qualifying days — a break in the line, never 0%. */
  readonly percent: number | null;
  readonly breakdown?: { readonly ideal: number; readonly fallback: number; readonly off: number; readonly missed: number };
}

export interface TrendGraphProps {
  readonly points: readonly TrendGraphPoint[];
  readonly accessibilityLabel: string;
  readonly height?: number;
}

export function TrendGraph({ points, accessibilityLabel, height = 160 }: TrendGraphProps) {
  const t = useTheme();
  const [showTable, setShowTable] = useState(false);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  const width = Math.max(points.length * 48, 240);
  const plottable = points.filter((p) => p.percent !== null);

  const xFor = (i: number) => (points.length <= 1 ? width / 2 : (i / (points.length - 1)) * width);
  const yFor = (percent: number) => height - (percent / 100) * height;

  // Break the polyline into contiguous non-null segments so a gap never draws a fabricated line.
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  points.forEach((p, i) => {
    if (p.percent === null) {
      if (current.length) segments.push(current);
      current = [];
      return;
    }
    current.push({ x: xFor(i), y: yFor(p.percent) });
  });
  if (current.length) segments.push(current);

  const summary = points
    .map((p) => `${p.label}: ${p.percent === null ? 'no data' : `${p.percent} percent`}`)
    .join('. ');

  return (
    <View>
      {/* Ship-blocking: present at all times, independent of the toggle below. */}
      <Text style={SR_ONLY_STYLE} {...SR_ONLY_PROPS}>
        {`${accessibilityLabel}. ${summary}.`}
      </Text>

      {!showTable ? (
        <View>
          <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {segments.map((seg, i) => (
              <Polyline key={i} points={seg.map((pt) => `${pt.x},${pt.y}`).join(' ')} fill="none" stroke={t.color.text} strokeWidth={2} />
            ))}
            {points.map((p, i) =>
              p.percent !== null ? (
                <Circle
                  key={i}
                  cx={xFor(i)}
                  cy={yFor(p.percent)}
                  r={scrubIndex === i ? 5 : 3}
                  fill={scrubIndex === i ? t.accent.base : t.color.text}
                />
              ) : null,
            )}
            {scrubIndex !== null ? <Line x1={xFor(scrubIndex)} y1={0} x2={xFor(scrubIndex)} y2={height} stroke={t.color.border} strokeWidth={1} /> : null}
          </Svg>
          <View style={styles.scrubRow} accessibilityRole="adjustable" accessibilityLabel="Scrub through buckets">
            {points.map((p, i) => (
              <View key={p.bucketKey} style={styles.scrubHit} onTouchStart={() => setScrubIndex(i)} />
            ))}
          </View>
          {scrubIndex !== null ? (
            <Text style={[styles.readout, { color: t.color.text }]}>
              {points[scrubIndex]!.label} — {points[scrubIndex]!.percent === null ? 'no data' : `${points[scrubIndex]!.percent}%`}
            </Text>
          ) : null}
        </View>
      ) : (
        <View accessibilityLabel="Trend data table">
          <View style={styles.tableHeaderRow}>
            {['Bucket', '% shown up', 'Ideal', 'Fallback', 'Off', 'Missed'].map((h) => (
              <Text key={h} style={[styles.tableHeaderCell, { color: t.color.textMuted }]}>
                {h}
              </Text>
            ))}
          </View>
          {points.map((p) => (
            <View
              key={p.bucketKey}
              style={styles.tableRow}
              accessibilityLabel={`${p.label}: ${p.percent === null ? 'no data' : `${p.percent} percent`}, ideal ${p.breakdown?.ideal ?? 0}, fallback ${p.breakdown?.fallback ?? 0}, off ${p.breakdown?.off ?? 0}, missed ${p.breakdown?.missed ?? 0}`}
            >
              <Text style={[styles.tableCell, { color: t.color.text }]}>{p.label}</Text>
              <Text style={[styles.tableCell, { color: t.color.text }]}>{p.percent === null ? '—' : `${p.percent}%`}</Text>
              <Text style={[styles.tableCell, { color: t.color.text }]}>{p.breakdown?.ideal ?? '—'}</Text>
              <Text style={[styles.tableCell, { color: t.color.text }]}>{p.breakdown?.fallback ?? '—'}</Text>
              <Text style={[styles.tableCell, { color: t.color.text }]}>{p.breakdown?.off ?? '—'}</Text>
              <Text style={[styles.tableCell, { color: t.color.text }]}>{p.breakdown?.missed ?? '—'}</Text>
            </View>
          ))}
        </View>
      )}

      <Button
        label={showTable ? 'View as chart' : 'View as table'}
        onPress={() => setShowTable((s) => !s)}
        variant="ghost"
        accessibilityLabel={showTable ? 'View as chart' : 'View as table'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scrubRow: { flexDirection: 'row', marginTop: -SPACE.s2 },
  scrubHit: { flex: 1, height: 32 },
  readout: { fontSize: 14, fontWeight: '600', marginTop: SPACE.s1 },
  tableHeaderRow: { flexDirection: 'row', paddingVertical: SPACE.s1 },
  tableHeaderCell: { flex: 1, fontSize: 12, fontWeight: '700' },
  tableRow: { flexDirection: 'row', paddingVertical: SPACE.s1 },
  tableCell: { flex: 1, fontSize: 13 },
});
