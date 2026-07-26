/**
 * M0 kit — Fallback-custom `CalendarHeatmap` (F7). Rule 4 fixed defect, do not regress:
 * the fill is icon-only; the day-of-month numeral renders as a caption BELOW the cell, never
 * inside the fill (MODULES.md's M0 brief; the rendered mockup places the numeral above —
 * flagged for visual-qa in REVIEW-M0.md, not changed here per that review's own call).
 *
 * Cell treatments are transcribed from the approved S20 calendar grid in
 * `design-input/Fallback Handoff (standalone).html` (~byte offset 836200), not re-derived
 * from ARCHITECTURE prose: ideal/fallback are the same `check-check`/`check` glyphs as
 * `StateChip`; off is `--off-soft` + border + `moon` in `--text-dim` (the same moon motif as
 * the S09/S20 off state, not a solid fill); missed is `--surface` + `--border-strong`, no
 * icon (still colour-free — ARCHITECTURE §5 — just not literally transparent); not-due is
 * transparent with a faint 1px `--border` rather than no border at all.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, CheckCheck, ChevronLeft, ChevronRight, Moon } from 'lucide-react-native';

import { MIN_TAP_TARGET, SPACE, useTheme, type Theme } from '@/theme';
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

interface CellVisual {
  readonly bg: string;
  readonly border: string;
  readonly icon: typeof Check | null;
  readonly iconColor: string;
  readonly dashed: boolean;
}

function cellVisual(t: Theme, outcome: OccurrenceOutcome): CellVisual {
  switch (outcome) {
    case 'ideal':
      return { bg: t.color.ideal, border: t.color.ideal, icon: CheckCheck, iconColor: t.color.iconOnSignal, dashed: false };
    case 'fallback':
      return { bg: t.color.fallback, border: t.color.fallback, icon: Check, iconColor: t.color.iconOnSignal, dashed: false };
    case 'off':
      return { bg: t.color.offSoft, border: t.color.border, icon: Moon, iconColor: t.color.textDim, dashed: false };
    case 'missed':
      return { bg: t.color.surface, border: t.color.borderStrong, icon: null, iconColor: 'transparent', dashed: false };
    case 'pending':
      return { bg: 'transparent', border: t.color.textDim, icon: null, iconColor: 'transparent', dashed: true };
    case 'not-due':
    default:
      return { bg: 'transparent', border: t.color.border, icon: null, iconColor: 'transparent', dashed: false };
  }
}

export function CalendarHeatmap({ days, monthLabel, onPrevMonth, onNextMonth, onCellPress, statLine, emptyHistoryCaption, accessibilityLabel }: CalendarHeatmapProps) {
  const t = useTheme();
  const rows = toWeekRows(days);

  return (
    <View>
      {/*
        Pass 2 fix (REVIEW-M0.md): `accessible` on this container was pass-1's fix for the
        label never being announced — but this container wraps the month-nav IconButtons
        and every per-cell Pressable, and `accessible={true}` groups an entire subtree into
        ONE VoiceOver/TalkBack element, making the cells and month nav unreachable. Same
        rule this file's own tests apply to StateChip/InlineRetryBanner/BottomTabs: never
        set `accessible` on a wrapper of interactive children. The label is announced
        instead via this visually-hidden sibling `Text` — a real accessibility element
        (auto-accessible, per RN host `Text` semantics) that sits OUTSIDE the interactive
        subtree rather than wrapping it, so it adds context without swallowing anything.
      */}
      <Text style={styles.srOnly}>{accessibilityLabel}</Text>
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
              // Rule 8 / REVIEW-M0.md item 7: the tap target covers the cell AND its numeral
              // caption together, not just the coloured square — so the Pressable wraps both.
              <Pressable
                key={ci}
                onPress={onCellPress ? () => onCellPress(cell.date) : undefined}
                disabled={!onCellPress}
                accessibilityRole={onCellPress ? 'button' : 'text'}
                accessibilityLabel={label}
                style={styles.cellSlot}
              >
                <View
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
                  {Icon ? <Icon size={14} color={visual.iconColor} /> : null}
                </View>
                <Text style={[styles.dayNumeral, { color: t.color.textDim }]}>{cell.dayOfMonth}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={styles.legend}>
        <LegendEntry bg={t.color.ideal} border={t.color.ideal} label="Ideal" textColor={t.color.textMuted} />
        <LegendEntry bg={t.color.fallback} border={t.color.fallback} label="Fallback" textColor={t.color.textMuted} />
        <LegendEntry bg={t.color.offSoft} border={t.color.border} label="Off" textColor={t.color.textMuted} />
        <LegendEntry bg={t.color.surface} border={t.color.borderStrong} label="Missed" textColor={t.color.textMuted} />
        <LegendEntry bg="transparent" border={t.color.textDim} dashed label="Pending today" textColor={t.color.textMuted} />
        <LegendEntry bg="transparent" border={t.color.border} label="Not due" textColor={t.color.textMuted} />
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

function LegendEntry({ bg, border, dashed, label, textColor }: { bg: string; border: string; dashed?: boolean; label: string; textColor: string }) {
  return (
    <View style={styles.legendItem} accessible accessibilityLabel={label}>
      <View style={[styles.legendSwatch, { backgroundColor: bg, borderColor: border, borderStyle: dashed ? 'dashed' : 'solid' }]} />
      <Text style={[styles.legendLabel, { color: textColor }]}>{label}</Text>
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
  srOnly: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navSpacer: { width: 44, height: 44 },
  monthLabel: { fontSize: 16, fontWeight: '600' },
  headerRow: { flexDirection: 'row' },
  headerCell: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row' },
  cellSlot: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACE.s1 / 2, gap: 2, minHeight: MIN_TAP_TARGET },
  cell: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  dayNumeral: { fontSize: 10 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2, marginTop: SPACE.s2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSwatch: { width: 10, height: 10, borderRadius: 3, borderWidth: 1 },
  legendLabel: { fontSize: 12 },
  caption: { fontSize: 12, marginTop: SPACE.s1, lineHeight: 18 },
  statLine: { fontSize: 14, fontWeight: '600', marginTop: SPACE.s2 },
});
