/** S30 — Cycle detail    route: /records/[cycleId] */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ACHIEVEMENTS } from '@/domain';
import { ROUTES } from '@/navigation';
import { useCycleRecord } from '@/queries';
import type { Id } from '@/types';
import { FONT_SIZE, SPACE, useTheme } from '@/theme';
import { Card, ConsistencyBreakdownBar, EmptyLine, InlineRetryBanner, ListGroup, ListRow, MilestoneBadge, Screen, SectionHeading, Skeleton } from '@/ui';

import { BADGE_ICONS } from '@/features/progress/badgeIcons';
import { S30_COPY } from '@/features/progress/copy';
import { cadenceLabel, formatCycleLabel } from '@/features/progress/format';
import { Text } from '@/ui/AppText';

export default function S30CycleRecordDetail() {
  const t = useTheme();
  const router = useRouter();
  const { cycleId } = useLocalSearchParams<{ cycleId: string }>();
  const recordQuery = useCycleRecord(cycleId as Id);

  const record = recordQuery.data;
  const denominator = record ? record.breakdown.ideal + record.breakdown.fallback + record.breakdown.missed : 0;
  const shownUp = record ? record.breakdown.ideal + record.breakdown.fallback : 0;

  return (
    <Screen
      title={record ? formatCycleLabel(record) : S30_COPY.title}
      subtitle={record ? `${cadenceLabel(record.cadence)} cycle · ${S30_COPY.archivedSuffix}` : undefined}
      level="page"
      onBack={() => (router.canGoBack() ? router.back() : router.replace(ROUTES.records))}
    >
      {recordQuery.isLoading ? (
        <View style={styles.block}>
          <Skeleton height={24} width="60%" />
          <Skeleton height={48} />
          <Skeleton height={80} />
        </View>
      ) : recordQuery.isError || !record ? (
        <InlineRetryBanner message={S30_COPY.errorMessage} onRetry={() => recordQuery.refetch()} tone="warning" />
      ) : (
        <>
          <Card style={styles.card}>
            <View style={styles.numeralRow}>
              <Text accessibilityRole="header" style={[styles.percent, { color: t.color.text }]}>
                {record.consistencyPercent === null ? '—' : `${record.consistencyPercent}%`}
              </Text>
              <Text style={[styles.numeralLabel, { color: t.color.textMuted }]}>showed up</Text>
            </View>
            <Text style={[styles.subline, { color: t.color.text }]}>{S30_COPY.subline(shownUp, denominator)}</Text>
            <ConsistencyBreakdownBar
              breakdown={record.breakdown}
              total={record.breakdown.ideal + record.breakdown.fallback + record.breakdown.missed + record.breakdown.off}
              accessibilityLabel={`Cycle breakdown: ${record.consistencyPercent === null ? 'no data' : `${record.consistencyPercent} percent`}`}
            />
            {record.isShortCycle ? <Text style={[styles.note, { color: t.color.textMuted }]}>{S30_COPY.shortCycleNote}</Text> : null}
          </Card>

          <ListGroup>
            <ListRow label={S30_COPY.cyclingXpRowPrefix} right={<Text style={[styles.xp, { color: t.color.xp }]}>{record.cyclingXpFinal} XP</Text>} />
          </ListGroup>

          <View style={styles.block}>
            <SectionHeading>{S30_COPY.badgesHeader}</SectionHeading>
            {record.badgeKeysUnlocked.length === 0 ? (
              <EmptyLine>{S30_COPY.noBadges}</EmptyLine>
            ) : (
              <View style={styles.badgeGrid}>
                {record.badgeKeysUnlocked.map((key) => {
                  const Icon = BADGE_ICONS[key];
                  const label = ACHIEVEMENTS.find((a) => a.key === key)?.label ?? key;
                  return Icon ? (
                    <View key={key} style={styles.badgeCell}>
                      <MilestoneBadge label={label} earned icon={Icon} />
                    </View>
                  ) : null;
                })}
              </View>
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: SPACE.s2 + 4 },
  card: { gap: SPACE.s2 + 4 },
  numeralRow: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE.s2 },
  percent: { fontSize: FONT_SIZE.xxxl, fontWeight: '700', fontVariant: ['tabular-nums'] },
  numeralLabel: { fontSize: FONT_SIZE.base },
  subline: { fontSize: FONT_SIZE.base, lineHeight: 24 },
  note: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  xp: { fontSize: FONT_SIZE.base, fontWeight: '700' },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: SPACE.s3 },
  badgeCell: { width: '25%', alignItems: 'center', paddingHorizontal: 2 },
});
