/**
 * S30 — Cycle Record Detail    route: /records/:cycleId
 * Owner: M5. Features: F30.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S30)
 *
 * Back always → S29 (not origin-aware — this screen has exactly one origin). Read-only: no
 * other interactive element exists here (SITEMAP).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ACHIEVEMENTS } from '@/domain';
import { ROUTES } from '@/navigation';
import { useCycleRecord } from '@/queries';
import type { Id } from '@/types';
import { SPACE, useTheme } from '@/theme';
import { Badge, ConsistencyBreakdownBar, InlineRetryBanner, MilestoneBadge, Skeleton } from '@/ui';

import { BADGE_ICONS } from '@/features/progress/badgeIcons';
import { S30_COPY } from '@/features/progress/copy';
import { cadenceLabel, formatCycleLabel } from '@/features/progress/format';
import { ProgressHeader } from '@/features/progress/ProgressHeader';

export default function S30CycleRecordDetail() {
  const t = useTheme();
  const router = useRouter();
  const { cycleId } = useLocalSearchParams<{ cycleId: string }>();
  const recordQuery = useCycleRecord(cycleId as Id);

  function goBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(ROUTES.records);
    }
  }

  const record = recordQuery.data;
  const denominator = record ? record.breakdown.ideal + record.breakdown.fallback + record.breakdown.missed : 0;
  const shownUp = record ? record.breakdown.ideal + record.breakdown.fallback : 0;

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <ProgressHeader title={S30_COPY.title} onBack={goBack} />
      <View style={styles.content}>
        {recordQuery.isLoading ? (
          <View style={styles.skeletonBlock}>
            <Skeleton height={24} width="60%" />
            <Skeleton height={48} />
            <Skeleton height={16} />
            <Skeleton height={80} />
          </View>
        ) : recordQuery.isError || !record ? (
          <InlineRetryBanner message={S30_COPY.errorMessage} onRetry={() => recordQuery.refetch()} tone="warning" />
        ) : (
          <>
            <View style={styles.headerRow}>
              <Text style={[styles.header, { color: t.color.text }]}>
                {formatCycleLabel(record)} · {cadenceLabel(record.cadence)}
              </Text>
              <Badge label={S30_COPY.archivedSuffix} />
            </View>

            {record.isShortCycle ? <Text style={[styles.shortCycle, { color: t.color.textDim }]}>{S30_COPY.shortCycleNote}</Text> : null}

            <Text accessibilityRole="header" style={[styles.percent, { color: t.color.text }]}>
              {record.consistencyPercent === null ? '—' : `${record.consistencyPercent}%`}
            </Text>
            <Text style={[styles.subline, { color: t.color.textMuted }]}>{S30_COPY.subline(shownUp, denominator)}</Text>

            <ConsistencyBreakdownBar
              breakdown={record.breakdown}
              total={record.breakdown.ideal + record.breakdown.fallback + record.breakdown.missed + record.breakdown.off}
              accessibilityLabel={`Cycle breakdown: ${record.consistencyPercent === null ? 'no data' : `${record.consistencyPercent} percent`}`}
            />

            <Text style={[styles.xpRow, { color: t.color.xp }]}>
              {S30_COPY.cyclingXpRowPrefix} {record.cyclingXpFinal}
            </Text>

            <Text accessibilityRole="header" style={[styles.badgesHeader, { color: t.color.text }]}>
              {S30_COPY.badgesHeader}
            </Text>
            {record.badgeKeysUnlocked.length === 0 ? (
              <Text style={[styles.noBadges, { color: t.color.textMuted }]}>{S30_COPY.noBadges}</Text>
            ) : (
              <View style={styles.badgeRow}>
                {record.badgeKeysUnlocked.map((key) => {
                  const Icon = BADGE_ICONS[key];
                  const label = ACHIEVEMENTS.find((a) => a.key === key)?.label ?? key;
                  return Icon ? <MilestoneBadge key={key} label={label} earned icon={Icon} /> : null;
                })}
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.s3, gap: SPACE.s3 },
  skeletonBlock: { gap: SPACE.s2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  header: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  shortCycle: { fontSize: 13 },
  percent: { fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  subline: { fontSize: 15, lineHeight: 22 },
  xpRow: { fontSize: 16, fontWeight: '700' },
  badgesHeader: { fontSize: 16, fontWeight: '700', marginTop: SPACE.s2 },
  noBadges: { fontSize: 14 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s3 },
});
