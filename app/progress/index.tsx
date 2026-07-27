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

/**
 * Review pass 1, blocking item 7(b): the fixed `last-7`/`last-30` windows truncate when a
 * task's whole history so far is shorter than the preset — the counted-day walk
 * (`src/domain/consistency.ts`'s `perTaskConsistency`) only stops early when history runs out,
 * so `denominator < cap` is exactly, and only, that truncation. Returns the preset's day count
 * when truncated, else `null`.
 */
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
        ) : scope === 'per-task' && trackableTasks.length === 0 ? (
          // Review pass 1, blocking item 2: checked BEFORE `isError` — with zero trackable
          // tasks the per-task query has no taskId to run with and would only ever error, which
          // is the wrong read for a brand-new user (ALLSCREENS' own "brand-new user" trigger).
          <EmptyState icon={CalendarSearch} headline={S25_COPY.emptyHeadline} subcopy={S25_COPY.emptySubcopy} />
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
                ? [
                    S25_COPY.perTaskSubcopy(result.breakdown.ideal, result.breakdown.fallback, result.numerator, result.denominator),
                    truncatedWindowDays(window, result.denominator) !== null
                      ? S25_COPY.truncatedWindowNote(truncatedWindowDays(window, result.denominator) as number)
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' ')
                : S25_COPY.aggregateSubcopy(result.numerator, result.denominator)}
            </Text>
            <Text style={[styles.offNote, { color: t.color.textDim }]}>
              {scope === 'per-task' ? S25_COPY.offNotePerTask(result.breakdown.off) : S25_COPY.offNoteAggregate(result.breakdown.off)}
            </Text>

            <ConsistencyBreakdownBar
              breakdown={result.breakdown}
              total={
                scope === 'aggregate'
                  ? // Aggregate scope's `denominator` is a raw counted-day count, but Ideal/Fallback
                    // are independently ROUNDED credit sums (not whole days), so
                    // `denominator + off` does not reconcile against the bar's segments here — it
                    // can render fully filled even with Missed > 0 (review pass 1, blocking item 1).
                    // The rounded-category sum is the correct total, matching S29/S30.
                    result.breakdown.ideal + result.breakdown.fallback + result.breakdown.missed + result.breakdown.off
                  : result.denominator + result.breakdown.off
              }
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
                {S25_COPY.disclosureFixtureRows.map((row) => (
                  <Text key={row} style={[styles.disclosureCell, { color: t.color.text }]}>
                    {row}
                  </Text>
                ))}
                <Text style={[styles.disclosureTotal, { color: t.color.text }]}>{S25_COPY.disclosureFixtureTotal}</Text>
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
  disclosureTotal: { fontSize: 13, fontWeight: '700' },
});
