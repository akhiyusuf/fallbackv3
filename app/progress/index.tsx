/**
 * S25 — Consistency dashboard    route: /progress
 * Renders M2's numbers only; no percentage arithmetic lives here.
 */
import type React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { CalendarSearch, Check, CheckCheck, Layers, Minus } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ROUTES, useOriginAwareBack } from '@/navigation';
import { useConsistency, useTasks } from '@/queries';
import type { ConsistencyScope, ConsistencyWindow, Id } from '@/types';
import { FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import { Card, ConsistencyBreakdownBar, Dialog, EmptyState, InlineRetryBanner, ListGroup, ListRow, Screen, Skeleton, StatTile, Tabs, TaskIcon, tintedSurface } from '@/ui';

import { StatHero } from '@/features/today/StatHero';

import { taskIconProps } from '@/features/browse/resolveIcon';
import { formatOneDecimal, S25_COPY } from '@/features/progress/copy';
import { Text } from '@/ui/AppText';

const WINDOW_ITEMS = [
  { value: 'last-7', label: S25_COPY.windowTabs.last7 },
  { value: 'last-30', label: S25_COPY.windowTabs.last30 },
  { value: 'all-time', label: S25_COPY.windowTabs.allTime },
];

/** The fixed 7/30-day windows truncate when the task's history is shorter than the preset. */
function truncatedWindowDays(window: ConsistencyWindow, denominator: number): number | null {
  if (window === 'last-7' && denominator < 7) return 7;
  if (window === 'last-30' && denominator < 30) return 30;
  return null;
}

export default function S25ConsistencyDashboard() {
  const t = useTheme();
  const router = useRouter();
  const goBack = useOriginAwareBack(ROUTES.today);

  const [scope, setScope] = useState<ConsistencyScope>('per-task');
  const [window, setWindow] = useState<ConsistencyWindow>('last-30');
  const [selectedTaskId, setSelectedTaskId] = useState<Id | null>(null);
  const [howOpen, setHowOpen] = useState(false);

  const tasksQuery = useTasks();
  const trackableTasks = (tasksQuery.data ?? []).filter((task) => task.type !== 'todo' && !task.isAsNeeded);

  useEffect(() => {
    if (!selectedTaskId && trackableTasks.length > 0) setSelectedTaskId(trackableTasks[0]!.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackableTasks.length]);

  const consistencyQuery = useConsistency({ scope, window, taskId: scope === 'per-task' ? (selectedTaskId ?? undefined) : undefined });
  const isLoading = consistencyQuery.isLoading || (scope === 'per-task' && tasksQuery.isLoading);
  const result = consistencyQuery.data;
  const truncated = result ? truncatedWindowDays(window, result.denominator) : null;

  return (
    <Screen title={S25_COPY.appBarTitle} level="page" onBack={goBack}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerBleed} contentContainerStyle={styles.picker} accessibilityRole="radiogroup" accessibilityLabel="What to measure">
        <ScopeChip label={S25_COPY.scopeTabs.aggregate} selected={scope === 'aggregate'} onPress={() => setScope('aggregate')} leading={<Layers size={18} color={t.color.text} />} />
        {trackableTasks.map((task) => (
          <ScopeChip
            key={task.id}
            label={task.name}
            selected={scope === 'per-task' && selectedTaskId === task.id}
            onPress={() => {
              setScope('per-task');
              setSelectedTaskId(task.id);
            }}
            leading={<TaskIcon {...taskIconProps(task)} size={24} />}
          />
        ))}
      </ScrollView>

      <Tabs items={WINDOW_ITEMS} value={window} onChange={(v) => setWindow(v as ConsistencyWindow)} accessibilityLabel="Time window" />

      {isLoading ? (
        <View style={styles.skeletonBlock}>
          <Skeleton height={148} radius={20} />
          <Skeleton height={16} width="80%" />
          <Skeleton height={16} />
        </View>
      ) : scope === 'per-task' && trackableTasks.length === 0 ? (
        <EmptyState icon={CalendarSearch} headline={S25_COPY.emptyHeadline} subcopy={S25_COPY.emptySubcopy} />
      ) : consistencyQuery.isError ? (
        <InlineRetryBanner message={S25_COPY.errorMessage} onRetry={() => consistencyQuery.refetch()} tone="warning" />
      ) : result && result.percent === null ? (
        <EmptyState icon={CalendarSearch} headline={S25_COPY.emptyHeadline} subcopy={S25_COPY.emptySubcopy} />
      ) : result ? (
        <>
        <StatHero
          percent={result.percent}
          label="Showed up"
          detail={
            scope === 'per-task'
              ? S25_COPY.perTaskSubcopy(result.breakdown.ideal, result.breakdown.fallback, result.numerator, result.denominator)
              : S25_COPY.aggregateSubcopy(result.numerator, result.denominator)
          }
          detailLines={2}
          accessibilityLabel={`${result.percent} percent ${S25_COPY.numeralLabel}`}
        />
        <View style={styles.tiles}>
          <StatTile icon={CheckCheck} color={t.color.ideal} value={formatOneDecimal(result.breakdown.ideal)} label="Ideal" />
          <StatTile icon={Check} color={t.color.fallback} value={formatOneDecimal(result.breakdown.fallback)} label="Fallback" />
          <StatTile icon={Minus} color={t.color.surface} ink={t.color.textMuted} value={formatOneDecimal(result.breakdown.off)} label="Off" />
          <StatTile value={formatOneDecimal(result.breakdown.missed)} label="Missed" />
        </View>
        <Card style={styles.card}>
          <ConsistencyBreakdownBar
            breakdown={result.breakdown}
            total={
              scope === 'aggregate'
                ? result.breakdown.ideal + result.breakdown.fallback + result.breakdown.missed + result.breakdown.off
                : result.denominator + result.breakdown.off
            }
            unitCaption={scope === 'aggregate' ? S25_COPY.aggregateUnitCaption : undefined}
            showLegend={false}
            accessibilityLabel={`Consistency breakdown: ${result.percent} percent, ideal ${result.breakdown.ideal}, fallback ${result.breakdown.fallback}, off ${result.breakdown.off}, missed ${result.breakdown.missed}`}
          />
          <Text style={[styles.note, { color: t.color.textMuted }]}>
            {[
              scope === 'per-task' ? S25_COPY.offNotePerTask(result.breakdown.off) : S25_COPY.offNoteAggregate(result.breakdown.off),
              scope === 'per-task' && truncated !== null ? S25_COPY.truncatedWindowNote(truncated) : null,
            ]
              .filter(Boolean)
              .join(' ')}
          </Text>
        </Card>
        </>
      ) : null}

      <Text style={[styles.note, { color: t.color.textMuted }]}>{S25_COPY.explainer}</Text>

      <ListGroup>
        <ListRow label={S25_COPY.historyLink} sublabel={S25_COPY.historySub} onPress={() => router.push(ROUTES.progressTrend)} />
        <ListRow label={S25_COPY.disclosureHeader} onPress={() => setHowOpen(true)} chevron={false} />
      </ListGroup>

      <Dialog visible={howOpen} onClose={() => setHowOpen(false)} title={S25_COPY.disclosureHeader} accessibilityLabel={S25_COPY.disclosureHeader} showClose>
        <Text style={[styles.subcopy, { color: t.color.textMuted }]}>{S25_COPY.disclosureIntro}</Text>
        <View style={styles.rows}>
          {S25_COPY.disclosureFixtureRows.map((row) => (
            <Text key={row} style={[styles.subcopy, { color: t.color.text }]}>
              {row}
            </Text>
          ))}
        </View>
        <Text style={[styles.total, { color: t.color.text }]}>{S25_COPY.disclosureFixtureTotal}</Text>
      </Dialog>
    </Screen>
  );
}

function ScopeChip({ label, selected, onPress, leading }: { readonly label: string; readonly selected: boolean; readonly onPress: () => void; readonly leading: React.ReactNode }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[styles.chip, selected ? { ...tintedSurface(t, t.accent.fill), borderRadius: RADIUS.pill, borderColor: t.accent.text } : { backgroundColor: t.color.bgAlt, borderWidth: 2, borderColor: t.color.border }]}
    >
      {leading}
      <Text numberOfLines={1} style={[styles.chipLabel, { color: t.color.text, fontWeight: selected ? '800' : '600' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACE.s2 + 4 },
  tiles: { flexDirection: 'row', gap: SPACE.s2 },
  pickerBleed: { marginHorizontal: -SPACE.s3, flexGrow: 0 },
  picker: { paddingHorizontal: SPACE.s3, gap: SPACE.s2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, minHeight: 44, paddingLeft: SPACE.s2, paddingRight: SPACE.s3, borderRadius: RADIUS.pill },
  chipLabel: { fontSize: FONT_SIZE.sm, maxWidth: 180 },
  subcopy: { fontSize: FONT_SIZE.base, lineHeight: 24 },
  note: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  skeletonBlock: { gap: SPACE.s2 },
  rows: { gap: SPACE.s2 },
  total: { fontSize: FONT_SIZE.base, fontWeight: '700' },
});
