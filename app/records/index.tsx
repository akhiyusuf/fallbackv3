/**
 * S29 — Cycle Records    route: /records
 * Owner: M5. Features: F30, F31.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S29)
 *
 * Origin-aware back: opened from S27 (Achievements) or S41 (Settings) — SITEMAP Decision 19.
 * The mockup's own note that the list truncates to "the 4 most recent" is a demo-fixture
 * convenience, not a stated product rule elsewhere — this screen renders every record
 * `useCycleRecords()` returns, newest first (a presentational sort, not consistency math).
 */
import { useRouter } from 'expo-router';
import { CalendarClock } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import type { Href } from 'expo-router';

import { ACHIEVEMENTS } from '@/domain';
import { ROUTES, useOriginAwareBack } from '@/navigation';
import { useCycleRecords, useProgress } from '@/queries';
import type { CycleRecord } from '@/types';
import { SPACE, useTheme } from '@/theme';
import { Badge, Card, ConsistencyBreakdownBar, EmptyState, InlineRetryBanner, MilestoneBadge, Skeleton, Tag } from '@/ui';

import { BADGE_ICONS } from '@/features/progress/badgeIcons';
import { S29_COPY } from '@/features/progress/copy';
import { cadenceLabel, formatCycleLabel, formatDate } from '@/features/progress/format';
import { ProgressHeader } from '@/features/progress/ProgressHeader';

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
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <ProgressHeader title={S29_COPY.title} onBack={goBack} />
      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.skeletonBlock}>
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
            <Card accessibilityLabel="Current cycle, in progress">
              <Text style={[styles.inProgressTitle, { color: t.color.text }]}>
                {S29_COPY.inProgressPrefix} {formatCycleLabel(progressQuery.data.currentCycle)}
              </Text>
              <Text style={[styles.inProgressXp, { color: t.color.xp }]}>
                {progressQuery.data.cyclingXp} {S29_COPY.xpSoFarSuffix}
              </Text>
              <Text style={[styles.inProgressNote, { color: t.color.textMuted }]}>
                {S29_COPY.finalizesNote(formatDate(progressQuery.data.currentCycle.endDate, 'MMM d'))}
              </Text>
            </Card>

            {records.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                headline={S29_COPY.emptyHeadline}
                subcopy={progressQuery.data.cycleCadence === 'weekly' ? S29_COPY.emptySubcopyWeekly : S29_COPY.emptySubcopyMonthly}
              />
            ) : (
              records.map((record) => <CycleRecordRow key={record.id} record={record} onPress={() => router.push(`/records/${record.id}` as Href)} t={t} />)
            )}
          </>
        )}
      </View>
    </View>
  );
}

function CycleRecordRow({ record, onPress, t }: { readonly record: CycleRecord; readonly onPress: () => void; readonly t: ReturnType<typeof useTheme> }) {
  const label = `${formatCycleLabel(record)} · ${cadenceLabel(record.cadence)}${record.isShortCycle ? ` — ${S29_COPY.shortCycleNote}` : ''}`;
  return (
    <Card onPress={onPress} accessibilityLabel={`${label}. ${record.consistencyPercent === null ? 'No data' : `${record.consistencyPercent} percent`}`}>
      <View style={styles.rowHeader}>
        <Text style={[styles.recordLabel, { color: t.color.text }]}>{label}</Text>
        <Badge label={S29_COPY.archivedTag} />
      </View>
      <Text style={[styles.recordPercent, { color: t.color.text }]}>{record.consistencyPercent === null ? '—' : `${record.consistencyPercent}%`}</Text>

      <ConsistencyBreakdownBar
        breakdown={record.breakdown}
        total={record.breakdown.ideal + record.breakdown.fallback + record.breakdown.missed + record.breakdown.off}
        accessibilityLabel={`Breakdown for ${label}`}
      />

      <Text style={[styles.xpRow, { color: t.color.xp }]}>
        {S29_COPY.cyclingXpPrefix} {record.cyclingXpFinal}
      </Text>

      {record.badgeKeysUnlocked.length > 0 ? (
        <View style={styles.badgeRow}>
          {record.badgeKeysUnlocked.map((key) => {
            const Icon = BADGE_ICONS[key];
            const label = ACHIEVEMENTS.find((a) => a.key === key)?.label ?? key;
            return Icon ? <MilestoneBadge key={key} label={label} earned icon={Icon} /> : null;
          })}
          <Tag label={S29_COPY.badgeCount(record.badgeKeysUnlocked.length)} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.s3, gap: SPACE.s3 },
  skeletonBlock: { gap: SPACE.s2 },
  inProgressTitle: { fontSize: 16, fontWeight: '700' },
  inProgressXp: { fontSize: 20, fontWeight: '800' },
  inProgressNote: { fontSize: 13 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recordLabel: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  recordPercent: { fontSize: 28, fontWeight: '800' },
  xpRow: { fontSize: 14, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.s2 },
});
