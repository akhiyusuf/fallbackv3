/**
 * S25 — Consistency Dashboard    route: /progress
 * Owner: M5. Features: F5.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S25)
 *
 * Origin-aware back: opened from S09 (Today) or S41 (Settings) — never a fixed destination
 * (SITEMAP Decision 19). Renders M2's numbers only; no percentage arithmetic lives here.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { CalendarSearch } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { ROUTES, useOriginAwareBack } from '@/navigation';
import { useConsistency, useTasks } from '@/queries';
import type { ConsistencyScope, ConsistencyWindow, Id } from '@/types';
import { SPACE, useTheme } from '@/theme';
import { Button, Card, ConsistencyBreakdownBar, EmptyState, InlineRetryBanner, Select, Skeleton, Tabs } from '@/ui';

import { ProgressHeader } from '@/features/progress/ProgressHeader';
import { S25_COPY } from '@/features/progress/copy';

const SCOPE_ITEMS = [
  { value: 'per-task', label: S25_COPY.scopeTabs.perTask },
  { value: 'aggregate', label: S25_COPY.scopeTabs.aggregate },
];

const WINDOW_ITEMS = [
  { value: 'last-7', label: S25_COPY.windowTabs.last7 },
  { value: 'last-30', label: S25_COPY.windowTabs.last30 },
  { value: 'all-time', label: S25_COPY.windowTabs.allTime },
];

export default function S25ConsistencyDashboard() {
  const t = useTheme();
  const router = useRouter();
  const goBack = useOriginAwareBack(ROUTES.today);

  const [scope, setScope] = useState<ConsistencyScope>('per-task');
  const [window, setWindow] = useState<ConsistencyWindow>('last-30');
  const [selectedTaskId, setSelectedTaskId] = useState<Id | null>(null);
  const [disclosureOpen, setDisclosureOpen] = useState(false);

  const tasksQuery = useTasks();
  // Trackable == can have a due occurrence: excludes To-dos and as-needed Routines, neither
  // of which ever produces an Occurrence (src/domain/xp.ts's own eligibility note).
  const trackableTasks = (tasksQuery.data ?? []).filter((task) => task.type !== 'todo' && !task.isAsNeeded);

  useEffect(() => {
    if (!selectedTaskId && trackableTasks.length > 0) {
      setSelectedTaskId(trackableTasks[0]!.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackableTasks.length]);

  const consistencyQuery = useConsistency({
    scope,
    window,
    taskId: scope === 'per-task' ? (selectedTaskId ?? undefined) : undefined,
  });
  // Review pass 1, blocking item 4: the aggregate disclosure renders a PINNED illustrative
  // fixture (ALLSCREENS 1557-1568 / 2034-2040), never the user's live history — M2's
  // `useConsistencyDisclosure()` hook is therefore not consumed here at all. Flagging this as
  // possibly-dead surface for M2 rather than silently wiring it up against spec.
  const isLoading = consistencyQuery.isLoading || (scope === 'per-task' && tasksQuery.isLoading);
  const result = consistencyQuery.data;

  function handleHistory() {
    router.push(ROUTES.progressTrend);
  }

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <ProgressHeader title={S25_COPY.appBarTitle} onBack={goBack} />
      <View style={styles.content}>
        <Tabs items={SCOPE_ITEMS} value={scope} onChange={(v) => setScope(v as ConsistencyScope)} accessibilityLabel="Scope" />

        {scope === 'per-task' ? (
          <Select
            label={S25_COPY.taskSelectLabel}
            value={selectedTaskId}
            options={trackableTasks.map((task) => ({ value: task.id, label: task.name }))}
            onChange={(v) => setSelectedTaskId(v as Id)}
          />
        ) : null}

        <Tabs items={WINDOW_ITEMS} value={window} onChange={(v) => setWindow(v as ConsistencyWindow)} accessibilityLabel="Window" />

        {isLoading ? (
          <View style={styles.skeletonBlock}>
            <Skeleton height={48} />
            <Skeleton height={16} width="80%" />
            <Skeleton height={16} />
          </View>
        ) : consistencyQuery.isError ? (
          <InlineRetryBanner message={S25_COPY.errorMessage} onRetry={() => consistencyQuery.refetch()} tone="warning" />
        ) : result && result.percent === null ? (
          <EmptyState icon={CalendarSearch} headline={S25_COPY.emptyHeadline} subcopy={S25_COPY.emptySubcopy} />
        ) : result ? (
          <>
            <Text accessibilityRole="header" style={[styles.headline, { color: t.color.text }]}>
              {result.percent}%
            </Text>
            <Text style={[styles.subcopy, { color: t.color.textMuted }]}>
              {scope === 'per-task'
                ? S25_COPY.perTaskSubcopy(result.breakdown.ideal, result.breakdown.fallback, result.numerator, result.denominator)
                : S25_COPY.aggregateSubcopy(result.numerator, result.denominator)}
            </Text>
            <Text style={[styles.offNote, { color: t.color.textDim }]}>
              {scope === 'per-task' ? S25_COPY.offNotePerTask(result.breakdown.off) : S25_COPY.offNoteAggregate(result.breakdown.off)}
            </Text>

            <ConsistencyBreakdownBar
              breakdown={result.breakdown}
              total={result.denominator + result.breakdown.off}
              unitCaption={scope === 'aggregate' ? S25_COPY.aggregateUnitCaption : undefined}
              accessibilityLabel={`Consistency breakdown: ${result.percent} percent, ideal ${result.breakdown.ideal}, fallback ${result.breakdown.fallback}, off ${result.breakdown.off}, missed ${result.breakdown.missed}`}
            />
          </>
        ) : null}

        <Text style={[styles.explainer, { color: t.color.textMuted }]}>{S25_COPY.explainer}</Text>

        {scope === 'aggregate' ? (
          <Card onPress={() => setDisclosureOpen((v) => !v)} accessibilityLabel={S25_COPY.disclosureHeader} accessibilityRole="button">
            <Text style={[styles.disclosureHeader, { color: t.color.text }]}>{S25_COPY.disclosureHeader}</Text>
            {disclosureOpen ? (
              <View style={styles.disclosureTable}>
                <View style={styles.disclosureRow}>
                  {S25_COPY.disclosureColumns.map((c) => (
                    <Text key={c} style={[styles.disclosureHeadCell, { color: t.color.textMuted }]}>
                      {c}
                    </Text>
                  ))}
                </View>
                {(disclosureQuery.data ?? []).map((row) => (
                  <View
                    key={row.date}
                    style={styles.disclosureRow}
                    accessible
                    accessibilityLabel={`${row.date}: ${row.shownUpTaskIds.length} of ${row.resolvedTaskIds.length} shown up, ${row.fraction.toFixed(2)}`}
                  >
                    <Text style={[styles.disclosureCell, { color: t.color.text }]}>{row.date}</Text>
                    <Text style={[styles.disclosureCell, { color: t.color.text }]}>{row.resolvedTaskIds.length}</Text>
                    <Text style={[styles.disclosureCell, { color: t.color.text }]}>{row.shownUpTaskIds.length}</Text>
                    <Text style={[styles.disclosureCell, { color: t.color.text }]}>{row.fraction.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        ) : null}

        <Button label={S25_COPY.historyLink} onPress={handleHistory} variant="ghost" accessibilityLabel={S25_COPY.historyLink} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.s3, gap: SPACE.s3 },
  headline: { fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  subcopy: { fontSize: 16, lineHeight: 22 },
  offNote: { fontSize: 13 },
  explainer: { fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  skeletonBlock: { gap: SPACE.s2 },
  disclosureHeader: { fontSize: 16, fontWeight: '600' },
  disclosureTable: { gap: SPACE.s1, marginTop: SPACE.s2 },
  disclosureRow: { flexDirection: 'row', gap: SPACE.s2 },
  disclosureHeadCell: { flex: 1, fontSize: 12, fontWeight: '700' },
  disclosureCell: { flex: 1, fontSize: 13 },
});
