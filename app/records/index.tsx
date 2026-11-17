/** S29 — Cycle records    route: /records */
import { useRouter, type Href } from 'expo-router';
import { CalendarClock } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { StatusPill } from '@/features/task/TaskDetails';
import { ROUTES, useOriginAwareBack } from '@/navigation';
import { useCycleRecords, useProgress } from '@/queries';
import type { CycleRecord } from '@/types';
import { FONT_SIZE, SPACE, useTheme } from '@/theme';
import { Card, ConsistencyBreakdownBar, EmptyState, InlineRetryBanner, Screen, SectionHeading, Skeleton } from '@/ui';
import { ChevronRight } from 'lucide-react-native';

import { S29_COPY } from '@/features/progress/copy';
import { cadenceLabel, formatCycleLabel, formatDate } from '@/features/progress/format';
import { Text } from '@/ui/AppText';

export default function S29CycleRecords() {
  const t = useTheme();
  const router = useRouter();
  const goBack = useOriginAwareBack(ROUTES.achievements);

  const progressQuery = useProgress();
  const recordsQuery = useCycleRecords();

  const isLoading = progressQuery.isLoading || recordsQuery.isLoading;
  const isError = progressQuery.isError || recordsQuery.isError;
  const records = [...(recordsQuery.data ?? [])].sort((a, b) => (a.startDate < b.startDate ? 1 : -1));

  return (
    <Screen title={S29_COPY.title} level="page" onBack={goBack}>
      {isLoading ? (
        <View style={styles.block}>
          <Skeleton height={80} />
          <Skeleton height={140} />
          <Skeleton height={140} />
        </View>
      ) : isError || !progressQuery.data ? (
        <InlineRetryBanner
          message={S29_COPY.errorMessage}
          onRetry={() => {
            progressQuery.refetch();
            recordsQuery.refetch();
          }}
          tone="warning"
        />
      ) : (
        <>
          <View style={styles.block}>
            <SectionHeading>{S29_COPY.currentHeading}</SectionHeading>
            <Card accessibilityLabel="Current cycle, in progress" style={styles.card}>
              <View style={styles.rowHeader}>
                <Text style={[styles.recordLabel, { color: t.color.text }]}>{formatCycleLabel(progressQuery.data.currentCycle)}</Text>
                <StatusPill label={S29_COPY.inProgressPrefix} tone="due" />
              </View>
              <Text style={[styles.xp, { color: t.color.xp }]}>
                {progressQuery.data.cyclingXp} {S29_COPY.xpSoFarSuffix}
              </Text>
              <Text style={[styles.note, { color: t.color.textMuted }]}>{S29_COPY.finalizesNote(formatDate(progressQuery.data.currentCycle.endDate, 'MMM d'))}</Text>
            </Card>
          </View>

          <View style={styles.block}>
            <SectionHeading>{S29_COPY.pastHeading}</SectionHeading>
            {records.length === 0 ? (
              <EmptyState icon={CalendarClock} headline={S29_COPY.emptyHeadline} subcopy={progressQuery.data.cycleCadence === 'weekly' ? S29_COPY.emptySubcopyWeekly : S29_COPY.emptySubcopyMonthly} />
            ) : (
              records.map((record) => <CycleRecordCard key={record.id} record={record} onPress={() => router.push(`/records/${record.id}` as Href)} />)
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

function CycleRecordCard({ record, onPress }: { readonly record: CycleRecord; readonly onPress: () => void }) {
  const t = useTheme();
  const label = formatCycleLabel(record);
  const meta = [cadenceLabel(record.cadence), `${record.cyclingXpFinal} XP`, record.badgeKeysUnlocked.length > 0 ? S29_COPY.badgeCount(record.badgeKeysUnlocked.length) : null, record.isShortCycle ? 'Short cycle' : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Card onPress={onPress} accessibilityLabel={`${label}. ${record.consistencyPercent === null ? 'No data' : `${record.consistencyPercent} percent`}. ${meta}`} style={styles.card}>
      <View style={styles.rowHeader}>
        <View style={styles.flex}>
          <Text style={[styles.recordLabel, { color: t.color.text }]}>{label}</Text>
          <Text style={[styles.note, { color: t.color.textMuted }]}>{meta}</Text>
        </View>
        <Text style={[styles.percent, { color: t.color.text }]}>{record.consistencyPercent === null ? '—' : `${record.consistencyPercent}%`}</Text>
        <ChevronRight size={20} color={t.color.textDim} />
      </View>
      <ConsistencyBreakdownBar
        breakdown={record.breakdown}
        total={record.breakdown.ideal + record.breakdown.fallback + record.breakdown.missed + record.breakdown.off}
        accessibilityLabel={`Breakdown for ${label}`}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  block: { gap: SPACE.s2 + 4 },
  card: { gap: SPACE.s2 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  recordLabel: { fontSize: FONT_SIZE.base, fontWeight: '600', flexShrink: 1, flex: 1 },
  percent: { fontSize: FONT_SIZE.xl, fontWeight: '700', fontVariant: ['tabular-nums'] },
  xp: { fontSize: FONT_SIZE.lg, fontWeight: '700' },
  note: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
});
