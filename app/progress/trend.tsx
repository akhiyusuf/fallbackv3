/**
 * S26 — All-time Trend Graph    route: /progress/trend
 * Owner: M5. Features: F28.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S26)
 *
 * Additive to S25 — never replaces its primary numbers, never surfaced on Today. Granularity
 * coarsens automatically; not a user control. `TrendGraph` (M0 kit) already carries the
 * ship-blocking a11y contract: a screen-reader-only summary of every bucket AT ALL TIMES,
 * plus the "View as table" toggle — this screen only has to feed it labeled points.
 */
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { diffDays, endOfMonth, endOfWeek, isAfter, today as todayLocal } from '@/lib/date';
import { ROUTES } from '@/navigation';
import { useTrend } from '@/queries';
import type { DateRange, LocalDate, TrendGranularity } from '@/types';
import { SPACE, useTheme } from '@/theme';
import { EmptyState, InlineRetryBanner, Skeleton, Tag, TrendGraph } from '@/ui';
import { TrendingUp } from 'lucide-react-native';

import { formatDate } from '@/features/progress/format';
import { ProgressHeader } from '@/features/progress/ProgressHeader';
import { S26_COPY } from '@/features/progress/copy';

function goBackToDashboard(router: ReturnType<typeof useRouter>) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(ROUTES.progress);
  }
}

/**
 * `useTrend`'s own `TrendPoint.label` is currently just `range.from` (a raw `LocalDate`),
 * not a human bucket label — a hook/display shape gap (see build report). This screen infers
 * the granularity from each bucket's own calendar span (matching `reads.ts`'s own
 * `granularityFor` thresholds) purely to FORMAT that already-computed range, never to
 * recompute which bucket a day belongs to.
 */
function granularityOf(range: DateRange): TrendGranularity {
  const spanDays = diffDays(range.to, range.from) + 1;
  if (spanDays <= 7) return 'weekly';
  if (spanDays <= 31) return 'monthly';
  return 'yearly';
}

function humanLabel(range: DateRange, granularity: TrendGranularity): string {
  if (granularity === 'weekly') return `Week of ${formatDate(range.from, 'MMM d')}`;
  if (granularity === 'monthly') return formatDate(range.from, 'MMM yyyy');
  return formatDate(range.from, 'yyyy');
}

/**
 * Review pass 1, blocking item 3: "only completed buckets plot" (MODULES.md M5 non-negotiable).
 * `useTrend`'s trailing bucket is clamped to today (`src/queries/reads.ts`'s `bucketRanges`),
 * so its `%` is still a moving target until its own calendar period actually ends. This is
 * display-side filtering only — never a recomputation of the bucket's consistency math.
 */
function bucketHasElapsed(range: DateRange, granularity: TrendGranularity): boolean {
  const naturalEnd: LocalDate =
    granularity === 'weekly' ? endOfWeek(range.from) : granularity === 'monthly' ? endOfMonth(range.from) : (`${range.from.slice(0, 4)}-12-31` as LocalDate);
  return !isAfter(naturalEnd, todayLocal());
}

export default function S26AllTimeTrendGraph() {
  const t = useTheme();
  const router = useRouter();
  const trendQuery = useTrend();

  const rawPoints = trendQuery.data ?? [];
  const granularity = rawPoints[0] ? granularityOf(rawPoints[0].range) : null;
  // Drop a trailing bucket whose own calendar period hasn't finished yet — it never plots here,
  // it "reappears here only once it finalizes" (ALLSCREENS 2164-2168).
  const points = granularity ? rawPoints.filter((p) => bucketHasElapsed(p.range, granularity)) : rawPoints;

  const graphPoints = points.map((p) => ({
    bucketKey: p.bucketKey,
    label: humanLabel(p.range, granularity ?? 'monthly'),
    percent: p.percent,
    breakdown: p.breakdown,
  }));

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <ProgressHeader title={S26_COPY.title} onBack={() => goBackToDashboard(router)} />
      <View style={styles.content}>
        <Text style={[styles.intro, { color: t.color.textMuted }]}>{S26_COPY.intro}</Text>

        {trendQuery.isLoading ? (
          <View style={styles.skeletonBlock}>
            <Skeleton height={20} width="40%" />
            <Skeleton height={160} />
          </View>
        ) : trendQuery.isError ? (
          <InlineRetryBanner message={S26_COPY.errorMessage} onRetry={() => trendQuery.refetch()} tone="warning" />
        ) : points.length === 0 ? (
          <EmptyState icon={TrendingUp} headline={S26_COPY.emptyHeadline} subcopy={S26_COPY.emptySubcopy} />
        ) : (
          <>
            {granularity ? <Tag label={S26_COPY.granularityTag[granularity]} /> : null}
            <TrendGraph points={graphPoints} accessibilityLabel={S26_COPY.graphAccessibilityLabel} />
          </>
        )}

        <Text style={[styles.dataNote, { color: t.color.textDim }]}>{S26_COPY.dataNote}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.s3, gap: SPACE.s3 },
  intro: { fontSize: 15, lineHeight: 22 },
  dataNote: { fontSize: 13, lineHeight: 18 },
  skeletonBlock: { gap: SPACE.s2 },
});
