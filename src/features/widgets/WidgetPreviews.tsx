/**
 * WidgetPreviews — the three home-screen widgets, drawn with today's real tasks, in the
 * current theme. This is the picture the native widgets must match: same layout, same colours.
 */
import { Check, CheckCheck, Minus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { taskIconProps } from '@/features/browse/resolveIcon';
import { formatTimeOfDay } from '@/features/browse/format';
import { useTodayRows, type TodayRow } from '@/features/today/useTodayRows';
import { FONT_SIZE, mix, SPACE, useTheme, type Theme } from '@/theme';
import { ProgressRing, TaskIcon } from '@/ui';
import type { ChipState, Id, WidgetConfig, WidgetSize } from '@/types';
import { Text } from '@/ui/AppText';

const WIDGET = 150;
const GAP = 14;

function isDone(state: ChipState | null): boolean {
  return state === 'done' || state === 'fallback' || state === 'skip';
}

function stateColor(t: Theme, state: ChipState | null): string | null {
  if (state === 'done') return t.color.ideal;
  if (state === 'fallback') return t.color.fallback;
  if (state === 'skip') return t.color.off;
  return null;
}

function stateWord(state: ChipState | null): string {
  if (state === 'done') return 'Ideal done';
  if (state === 'fallback') return 'Fallback done';
  if (state === 'skip') return 'Skipped';
  return 'To do';
}

/** The task a widget shows: the one the user fixed, or the next one still to do. */
function pick(rows: readonly TodayRow[], config: WidgetConfig | undefined): TodayRow | null {
  if (config?.mode === 'fixed-task' && config.fixedTaskId) {
    return rows.find((r) => r.task.id === (config.fixedTaskId as Id)) ?? null;
  }
  return rows.find((r) => !isDone(r.occurrence.chipState)) ?? rows[0] ?? null;
}

function StateMark({ state, size = 26 }: { readonly state: ChipState | null; readonly size?: number }) {
  const t = useTheme();
  const color = stateColor(t, state);
  if (!color) return <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2.5, borderColor: t.color.borderStrong }} />;
  const Icon = state === 'done' ? CheckCheck : state === 'fallback' ? Check : Minus;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={Math.round(size * 0.6)} color={t.color.textOnAccent} strokeWidth={3} />
    </View>
  );
}

function TodayWidget({ rows }: { readonly rows: readonly TodayRow[] }) {
  const t = useTheme();
  const done = rows.filter((r) => isDone(r.occurrence.chipState)).length;
  return (
    <View style={[styles.widget, styles.small, { backgroundColor: t.color.bgAlt }]}>
      <Text style={[styles.kicker, { color: t.color.textMuted }]}>Today</Text>
      <View style={styles.centre}>
        <ProgressRing
          percent={rows.length > 0 ? (done / rows.length) * 100 : 0}
          size={74}
          strokeWidth={9}
          label={rows.length > 0 ? `${done}/${rows.length}` : '0'}
          labelSize={FONT_SIZE.lg}
          trackColor={t.color.surface}
          accessibilityLabel={`${done} of ${rows.length} done`}
        />
      </View>
      {/* One dot per task due today, in the colour of how it went. */}
      <View style={styles.dots}>
        {rows.slice(0, 8).map((r) => {
          const color = stateColor(t, r.occurrence.chipState);
          return <View key={r.task.id} style={[styles.dot, color ? { backgroundColor: color } : { borderWidth: 2, borderColor: t.color.borderStrong }]} />;
        })}
      </View>
    </View>
  );
}

function OneTaskWidget({ row }: { readonly row: TodayRow | null }) {
  const t = useTheme();
  if (!row) {
    return (
      <View style={[styles.widget, styles.small, { backgroundColor: t.color.bgAlt }]}>
        <Text style={[styles.kicker, { color: t.color.textMuted }]}>Next</Text>
        <View style={styles.centre}>
          <Text style={[styles.quiet, { color: t.color.textMuted }]}>Nothing due today</Text>
        </View>
      </View>
    );
  }
  const icon = taskIconProps(row.task);
  const state = row.occurrence.chipState;
  const color = stateColor(t, state);
  return (
    <View style={[styles.widget, styles.small, { backgroundColor: t.color.bgAlt }]}>
      <View style={styles.rowBetween}>
        <TaskIcon icon={icon.icon} color={icon.color} size={38} />
        {row.task.timeOfDay ? <Text style={[styles.time, { color: t.color.textMuted }]}>{formatTimeOfDay(row.task.timeOfDay)}</Text> : null}
      </View>
      <Text numberOfLines={2} style={[styles.taskName, { color: t.color.text }]}>
        {row.task.name}
      </Text>
      <View style={styles.statusRow}>
        <StateMark state={state} size={20} />
        <Text style={[styles.status, { color: color ? t.color.text : t.color.textMuted }]}>{stateWord(state)}</Text>
      </View>
    </View>
  );
}

function UpNextWidget({ rows, first }: { readonly rows: readonly TodayRow[]; readonly first: TodayRow | null }) {
  const t = useTheme();
  const open = rows.filter((r) => !isDone(r.occurrence.chipState));
  const ordered = first ? [first, ...open.filter((r) => r.task.id !== first.task.id)] : open;
  const shown = ordered.slice(0, 2);
  const done = rows.length - open.length;
  return (
    <View style={[styles.widget, styles.medium, { backgroundColor: t.color.bgAlt }]}>
      <View style={styles.rowBetween}>
        <Text style={[styles.kicker, { color: t.color.textMuted }]}>Up next</Text>
        {rows.length > 0 ? <Text style={[styles.kicker, { color: t.color.textMuted }]}>{`${done} of ${rows.length} done`}</Text> : null}
      </View>
      {shown.length === 0 ? (
        <View style={styles.centre}>
          <Text style={[styles.quiet, { color: t.color.textMuted }]}>{rows.length > 0 ? 'All done for today' : 'Nothing due today'}</Text>
        </View>
      ) : (
        <View style={styles.nextList}>
          {shown.map((r) => {
            const icon = taskIconProps(r.task);
            return (
              <View key={r.task.id} style={styles.nextRow}>
                <TaskIcon icon={icon.icon} color={icon.color} size={36} />
                <View style={styles.nextText}>
                  <Text numberOfLines={1} style={[styles.nextName, { color: t.color.text }]}>
                    {r.task.name}
                  </Text>
                  {r.task.timeOfDay ? <Text style={[styles.time, { color: t.color.textMuted }]}>{formatTimeOfDay(r.task.timeOfDay)}</Text> : null}
                </View>
                <StateMark state={r.occurrence.chipState} />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function WidgetPreviews({ widgets }: { readonly widgets: readonly WidgetConfig[] }) {
  const t = useTheme();
  const { rows } = useTodayRows();
  const configFor = (size: WidgetSize) => widgets.find((w) => w.size === size);
  // A stand-in wallpaper: the theme colour, calmed, so the widgets read as sitting on a phone.
  const wall = mix(t.color.canvas, t.accent.fill, t.scheme === 'dark' ? 0.28 : 0.4);
  const ghost = mix(wall, t.scheme === 'dark' ? '#ffffff' : '#ffffff', t.scheme === 'dark' ? 0.14 : 0.36);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Your three widgets as they look on the home screen: today's count, one task, and up next."
      style={[styles.wall, { backgroundColor: wall }]}
    >
      <View style={styles.widgetRow}>
        <TodayWidget rows={rows} />
        <OneTaskWidget row={pick(rows, configFor('small-one-task'))} />
      </View>
      <UpNextWidget rows={rows} first={configFor('medium-up-next')?.mode === 'fixed-task' ? pick(rows, configFor('medium-up-next')) : null} />
      <View style={styles.apps}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.app, { backgroundColor: ghost }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wall: { borderRadius: 28, padding: GAP, gap: GAP, alignItems: 'center' },
  widgetRow: { flexDirection: 'row', gap: GAP },
  widget: { borderRadius: 24, padding: 14, height: WIDGET },
  small: { width: WIDGET, justifyContent: 'space-between' },
  medium: { width: WIDGET * 2 + GAP, gap: SPACE.s2 },
  kicker: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 5, justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  time: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  taskName: { fontSize: FONT_SIZE.base, fontWeight: '800', lineHeight: 20 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  status: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  quiet: { fontSize: FONT_SIZE.sm, fontWeight: '700', textAlign: 'center' },
  nextList: { flex: 1, justifyContent: 'space-around' },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3 },
  nextText: { flex: 1 },
  nextName: { fontSize: FONT_SIZE.base, fontWeight: '800' },
  apps: { flexDirection: 'row', gap: GAP, width: WIDGET * 2 + GAP, justifyContent: 'space-between' },
  app: { width: 62, height: 62, borderRadius: 16 },
});
