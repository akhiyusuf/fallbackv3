/**
 * M0 kit — `TrendGraph` (F28). Hand-rolled `react-native-svg` line chart with a labelled
 * percentage axis and a label under every point, so the chart reads on its own.
 * Ship-blocking a11y: a screen-reader-only summary of every bucket is present AT ALL TIMES,
 * plus a real table alternative. A `null` percent is a genuine gap: the line breaks.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { FONT_SIZE, SPACE, useTheme } from '@/theme';

import { SR_ONLY_PROPS, SR_ONLY_STYLE } from './a11y';
import { Tabs } from './Tabs';
import { Text } from '@/ui/AppText';

export interface TrendGraphPoint {
  readonly bucketKey: string;
  readonly label: string;
  /** Short label drawn under the point (e.g. "Nov 3"). Falls back to `label`. */
  readonly shortLabel?: string;
  /** null == this bucket had zero qualifying days — a break in the line, never 0%. */
  readonly percent: number | null;
  readonly breakdown?: { readonly ideal: number; readonly fallback: number; readonly off: number; readonly missed: number };
}

export interface TrendGraphProps {
  readonly points: readonly TrendGraphPoint[];
  readonly accessibilityLabel: string;
  readonly height?: number;
}

const AXIS_WIDTH = 40;
const MIN_STEP = 56;
const PAD_TOP = 10;
const VIEW_ITEMS = [
  { value: 'chart', label: 'Chart' },
  { value: 'table', label: 'Table' },
];
const GRID = [100, 50, 0];

export function TrendGraph({ points, accessibilityLabel, height = 180 }: TrendGraphProps) {
  const t = useTheme();
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [selected, setSelected] = useState<number | null>(null);
  const [available, setAvailable] = useState(0);

  const plotWidth = Math.max(available - AXIS_WIDTH, 0);
  const step = points.length > 0 ? Math.max(MIN_STEP, plotWidth / points.length) : MIN_STEP;
  const width = Math.max(step * points.length, plotWidth);
  const xFor = (i: number) => step / 2 + i * step;
  const yFor = (percent: number) => PAD_TOP + (1 - percent / 100) * (height - PAD_TOP * 2);

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

  const summary = points.map((p) => `${p.label}: ${p.percent === null ? 'no data' : `${p.percent} percent`}`).join('. ');
  const active = selected ?? (points.length > 0 ? points.length - 1 : null);
  const activePoint = active !== null ? points[active] : undefined;

  return (
    <View style={styles.root} onLayout={(e) => setAvailable(e.nativeEvent.layout.width)}>
      <Text style={SR_ONLY_STYLE} {...SR_ONLY_PROPS}>
        {`${accessibilityLabel}. ${summary}.`}
      </Text>

      <Tabs items={VIEW_ITEMS} value={view} onChange={(v) => setView(v as 'chart' | 'table')} accessibilityLabel="Show as chart or table" />

      {view === 'chart' ? (
        <View style={styles.chartBlock}>
          {activePoint ? (
            <View style={styles.readout}>
              <Text style={[styles.readoutValue, { color: t.color.text }]}>{activePoint.percent === null ? 'No data' : `${activePoint.percent}%`}</Text>
              <Text style={[styles.readoutLabel, { color: t.color.textMuted }]}>{activePoint.label}</Text>
            </View>
          ) : null}
          <View style={styles.chartRow}>
            <View style={[styles.axis, { height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {GRID.map((g) => (
                <Text key={g} style={[styles.axisLabel, { color: t.color.textMuted, top: yFor(g) - 8 }]}>
                  {g}%
                </Text>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ width }}>
              <View>
                <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  {GRID.map((g) => (
                    <Line key={g} x1={0} y1={yFor(g)} x2={width} y2={yFor(g)} stroke={t.color.border} strokeWidth={1} strokeDasharray={g === 0 ? undefined : '4 4'} />
                  ))}
                  {active !== null ? <Line x1={xFor(active)} y1={PAD_TOP} x2={xFor(active)} y2={height - PAD_TOP} stroke={t.color.borderStrong} strokeWidth={1} /> : null}
                  {segments.map((seg, i) => (
                    <Polyline key={i} points={seg.map((pt) => `${pt.x},${pt.y}`).join(' ')} fill="none" stroke={t.accent.base} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
                  ))}
                  {points.map((p, i) =>
                    p.percent !== null ? (
                      <Circle key={i} cx={xFor(i)} cy={yFor(p.percent)} r={active === i ? 6 : 4} fill={active === i ? t.accent.base : t.color.bgAlt} stroke={t.accent.base} strokeWidth={2} />
                    ) : null,
                  )}
                </Svg>
                <View style={[styles.hitRow, { height }]}>
                  {points.map((p, i) => (
                    <Pressable key={p.bucketKey} style={{ width: step, height }} onPress={() => setSelected(i)} accessibilityRole="button" accessibilityLabel={`${p.label}: ${p.percent === null ? 'no data' : `${p.percent} percent`}`} />
                  ))}
                </View>
                <View style={styles.xRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  {points.map((p, i) => (
                    <Text key={p.bucketKey} numberOfLines={1} style={[styles.xLabel, { width: step, color: active === i ? t.color.text : t.color.textMuted, fontWeight: active === i ? '600' : '400' }]}>
                      {p.shortLabel ?? p.label}
                    </Text>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      ) : (
        <View accessibilityLabel="Trend data table">
          <View style={[styles.tableRow, { borderBottomColor: t.color.border }]}>
            {['Period', 'Rate', 'Ideal', 'Fallback', 'Off', 'Missed'].map((h, i) => (
              <Text key={h} numberOfLines={1} style={[i === 0 ? styles.tableFirst : i === 3 ? styles.tableWide : styles.tableCell, styles.tableHead, { color: t.color.textMuted }]}>
                {h}
              </Text>
            ))}
          </View>
          {points.map((p) => (
            <View
              key={p.bucketKey}
              style={[styles.tableRow, { borderBottomColor: t.color.border }]}
              accessibilityLabel={`${p.label}: ${p.percent === null ? 'no data' : `${p.percent} percent`}, ideal ${p.breakdown?.ideal ?? 0}, fallback ${p.breakdown?.fallback ?? 0}, off ${p.breakdown?.off ?? 0}, missed ${p.breakdown?.missed ?? 0}`}
            >
              <Text style={[styles.tableFirst, { color: t.color.text }]}>{p.shortLabel ?? p.label}</Text>
              <Text style={[styles.tableCell, { color: t.color.text, fontWeight: '600' }]}>{p.percent === null ? '-' : `${p.percent}%`}</Text>
              <Text style={[styles.tableCell, { color: t.color.text }]}>{p.breakdown?.ideal ?? '-'}</Text>
              <Text style={[styles.tableWide, { color: t.color.text }]}>{p.breakdown?.fallback ?? '-'}</Text>
              <Text style={[styles.tableCell, { color: t.color.text }]}>{p.breakdown?.off ?? '-'}</Text>
              <Text style={[styles.tableCell, { color: t.color.text }]}>{p.breakdown?.missed ?? '-'}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACE.s3 },
  chartBlock: { gap: SPACE.s2 },
  readout: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE.s2 },
  readoutValue: { fontSize: FONT_SIZE.xl, fontWeight: '700', fontVariant: ['tabular-nums'] },
  readoutLabel: { fontSize: FONT_SIZE.sm },
  chartRow: { flexDirection: 'row' },
  axis: { width: AXIS_WIDTH },
  axisLabel: { position: 'absolute', left: 0, fontSize: FONT_SIZE.xs, fontVariant: ['tabular-nums'] },
  hitRow: { position: 'absolute', top: 0, left: 0, flexDirection: 'row' },
  xRow: { flexDirection: 'row', marginTop: SPACE.s1 },
  xLabel: { fontSize: FONT_SIZE.xs, textAlign: 'center' },
  tableRow: { flexDirection: 'row', paddingVertical: SPACE.s2, borderBottomWidth: 1, alignItems: 'center' },
  tableHead: { fontWeight: '600' },
  tableFirst: { flex: 1.3, fontSize: FONT_SIZE.xs },
  tableWide: { flex: 1.35, fontSize: FONT_SIZE.xs, textAlign: 'right', fontVariant: ['tabular-nums'] },
  tableCell: { flex: 1, fontSize: FONT_SIZE.xs, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
