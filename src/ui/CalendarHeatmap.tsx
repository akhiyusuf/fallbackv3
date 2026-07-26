/**
 * M0 kit — Fallback-custom `CalendarHeatmap` (F7). Rule 4 fixed defect, do not regress:
 * the fill is icon-only; the day-of-month numeral renders as a caption BELOW the cell, never
 * inside the fill. `missed` carries no colour of its own (ARCHITECTURE §5) — it renders as
 * an outlined, unfilled cell, distinct from a fully blank `not-due`/future cell (no border
 * at all) and from the hollow-dashed `pending` cell.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronLeft, ChevronRight, CircleDashed, Pause } from 'lucide-react-native';

import { SPACE, useTheme, type Theme } from '@/theme';
import { weekdayOf } from '@/lib/date';
import type { LocalDate, OccurrenceOutcome } from '@/types';

import { IconButton } from './IconButton';

export interface CalendarHeatmapDay {
  readonly date: LocalDate;
  readonly dayOfMonth: number;
  readonly outcome: OccurrenceOutcome;
}

export interface CalendarHeatmapProps {
  readonly days: readonly CalendarHeatmapDay[];
  readonly monthLabel: string;
  readonly onPrevMonth?: () => void;
  readonly onNextMonth?: () => void;
  readonly onCellPress?: (date: LocalDate) => void;
  readonly statLine?: string;
  readonly emptyHistoryCaption?: string;
  readonly accessibilityLabel: string;
}

const WEEKDAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function cellVisual(t: Theme, outcome: OccurrenceOutcome) {
  switch (outcome) {
    case 'ideal':
      return { bg: t.color.ideal, icon: Check, border: t.color.ideal, dashed: false };
    case 'fallback':
      return { bg: t.color.fallback, icon: CircleDashed, border: t.color.fallback, dashed: false };
    case 'off':
      return { bg: t.color.off, icon: Pause, border: t.color.off, dashed: false };
    case 'missed':
      return { bg: 'transparent', icon: null, border: t.color.borderStrong, dashed: false };
    case 'pending':
      return { bg: 'transparent', icon: null, border: t.color.textDim, dashed: true };
    case 'not-due':
    default:
      return { bg: 'transparent', icon: null, border: 'transparent', dashed: false };
  }
}

export function CalendarHeatmap({ days, monthLabel, onPrevMonth, onNextMonth, onCellPress, statLine, emptyHistoryCaption, accessibilityLabel }: CalendarHeatmapProps) {
  const t = useTheme();
  const rows = toWeekRows(days);

  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="none">
      <View style={styles.nav}>
        {onPrevMonth ? <IconButton icon={ChevronLeft} onPress={onPrevMonth} accessibilityLabel="Previous month" /> : <View style={styles.navSpacer} />}
        <Text accessibilityRole="header" style={[styles.monthLabel, { color: t.color.text }]}>
          {monthLabel}
        </Text>
        {onNextMonth ? <IconButton icon={ChevronRight} onPress={onNextMonth} accessibilityLabel="Next month" /> : <View style={styles.navSpacer} />}
      </View>

      <View style={styles.headerRow}>
        {WEEKDAY_HEADERS.map((label, i) => (
          <Text key={i} style={[styles.headerCell, { color: t.color.textDim }]}>
            {label}
          </Text>
        ))}
      </View>

      {rows.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((cell, ci) => {
            if (!cell) return <View key={ci} style={styles.cellSlot} />;
            const visual = cellVisual(t, cell.outcome);
            const Icon = visual.icon;
            const label = `${cell.date}, ${cell.outcome.replace('-', ' ')}`;
            return (
              <View key={ci} style={styles.cellSlot}>
                <Pressable
                  onPress={onCellPress ? () => onCellPress(cell.date) : undefined}
                  disabled={!onCellPress}
                  accessibilityRole={onCellPress ? 'button' : 'text'}
                  accessibilityLabel={label}
                  hitSlop={4}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: visual.bg,
                      borderColor: visual.border,
                      borderWidth: visual.border === 'transparent' ? 0 : 1,
                      borderStyle: visual.dashed ? 'dashed' : 'solid',
                    },
                  ]}
                >
                  {Icon ? <Icon size={14} color={t.color.iconOnSignal} /> : null}
                </Pressable>
                <Text style={[styles.dayNumeral, { color: t.color.textDim }]}>{cell.dayOfMonth}</Text>
              </View>
            );
          })}
        </View>
      ))}

      <View style={styles.legend}>
        <LegendEntry color={t.color.ideal} label="Ideal" />
        <LegendEntry color={t.color.fallback} label="Fallback" />
        <LegendEntry color={t.color.off} label="Off" />
        <LegendEntry outline={t.color.borderStrong} label="Missed" />
        <LegendEntry outline={t.color.textDim} dashed label="Pending today" />
        <LegendEntry outline="transparent" label="Not due" />
      </View>

      {emptyHistoryCaption ? <Text style={[styles.caption, { color: t.color.textDim }]}>{emptyHistoryCaption}</Text> : null}
      {statLine ? (
        <Text style={[styles.statLine, { color: t.color.text }]} accessibilityRole="text">
          {statLine}
        </Text>
      ) : null}
    </View>
  );
}

function LegendEntry({ color, outline, dashed, label }: { color?: string; outline?: string; dashed?: boolean; label: string }) {
  return (
    <View style={styles.legendItem} accessible accessibilityLabel={label}>
      <View
        style={[
          styles.legendSwatch,
          { backgroundColor: color ?? 'transparent', borderColor: outline ?? color, borderWidth: color ? 0 : 1, borderStyle: dashed ? 'dashed' : 'solid' },
        ]}
      />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function toWeekRows(days: readonly CalendarHeatmapDay[]): (CalendarHeatmapDay | null)[][] {
  if (days.length === 0) return [];
  const leading = weekdayOf(days[0]!.date) - 1; // Monday=1 -> 0 leading blanks
  const padded: (CalendarHeatmapDay | null)[] = [...Array(leading).fill(null), ...days];
  while (padded.length % 7 !== 0) padded.push(null);
  const rows: (CalendarHeatmapDay | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) rows.push(padded.slice(i, i + 7));
  return rows;
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navSpacer: { width: 44, height: 44 },
  monthLabel: { fontSize: 16, fontWeight: '600' },
  headerRow: { flexDirection: 'row' },
  headerCell: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row' },
  cellSlot: { flex: 1, alignItems: 'center', paddingVertical: SPACE.s1 / 2, gap: 2 },
  cell: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  dayNumeral: { fontSize: 10 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2, marginTop: SPACE.s2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSwatch: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { fontSize: 12 },
  caption: { fontSize: 12, marginTop: SPACE.s1, lineHeight: 18 },
  statLine: { fontSize: 14, fontWeight: '600', marginTop: SPACE.s2 },
});
