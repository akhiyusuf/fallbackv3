/**
 * S26 — All-time trend    route: /progress/trend
 * Additive to S25. Granularity coarsens automatically; only completed buckets plot.
 */
import { useRouter } from 'expo-router';
import { TrendingUp } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { diffDays, endOfMonth, endOfWeek, isAfter, today as todayLocal } from '@/lib/date';
import { ROUTES } from '@/navigation';
import { useTrend } from '@/queries';
import type { DateRange, LocalDate, TrendGranularity } from '@/types';
import { FONT_SIZE, SPACE, useTheme } from '@/theme';
import { Card, EmptyState, InlineRetryBanner, Screen, SectionHeading, Skeleton, TrendGraph } from '@/ui';

import { formatDate } from '@/features/progress/format';
import { S26_COPY } from '@/features/progress/copy';
import { Text } from '@/ui/AppText';

function granularityOf(range: DateRange): TrendGranularity {
  const spanDays = diffDays(range.to, range.from) + 1;
  if (spanDays <= 7) return 'weekly';
  if (spanDays <= 31) return 'monthly';
  return 'yearly';
}

function humanLabel(range: DateRange, granularity: TrendGranularity): string {
  if (granularity === 'weekly') return `Week of ${formatDate(range.from, 'MMM d')}`;
  if (granularity === 'monthly') return formatDate(range.from, 'MMMM yyyy');
  return formatDate(range.from, 'yyyy');
}

function shortLabel(range: DateRange, granularity: TrendGranularity): string {
  if (granularity === 'weekly') return formatDate(range.from, 'MMM d');
  if (granularity === 'monthly') return formatDate(range.from, 'MMM');
  return formatDate(range.from, 'yyyy');
}

/** Display-side filter only: a bucket plots once its own calendar period has ended. */
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
  const points = granularity ? rawPoints.filter((p) => bucketHasElapsed(p.range, granularity)) : rawPoints;

  const graphPoints = points.map((p) => ({
    bucketKey: p.bucketKey,
    label: humanLabel(p.range, granularity ?? 'monthly'),
    shortLabel: shortLabel(p.range, granularity ?? 'monthly'),
    percent: p.percent,
    breakdown: p.breakdown,
  }));

  return (
    <Screen title={S26_COPY.title} level="page" onBack={() => (router.canGoBack() ? router.back() : router.replace(ROUTES.progress))}>
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
        <View style={styles.section}>
          <SectionHeading>{granularity ? S26_COPY.granularityTag[granularity] : S26_COPY.title}</SectionHeading>
          <Card>
            <TrendGraph points={graphPoints} accessibilityLabel={S26_COPY.graphAccessibilityLabel} />
          </Card>
          <Text style={[styles.note, { color: t.color.textMuted }]}>{S26_COPY.dataNote}</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: FONT_SIZE.base, lineHeight: 24 },
  note: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  section: { gap: SPACE.s2 + 4 },
  skeletonBlock: { gap: SPACE.s2 },
});
