/**
 * S09 — Today. F3 (chip logging), F4 (whole-day off), F5 (stat chip), F6 (task list), F14
 * (re-entry banner landing state).
 */
import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Bell, ChevronRight, Mic, Plus, Search as SearchIcon, Settings as SettingsIcon, Sprout, Trophy, X } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { roundHalfUp } from '@/lib/number';
import { useConsistency, useLogState, useMarkOffDay } from '@/queries';
import { ROUTES, withOrigin } from '@/navigation';
import { SPACE, useTheme } from '@/theme';
import { Button, Card, EmptyState, IconButton, InlineRetryBanner, OffDayToggle, Skeleton, StateChip } from '@/ui';
import { useToastStore } from '@/app-shell';
import type { ChipState } from '@/types';

import { cadenceHintLower, formatHeaderDate, formatTimeOfDay, taskTypeLabel } from '@/features/browse/format';
import { resolveTaskIcon } from '@/features/browse/resolveIcon';
import { reentryStatLine, S09_COPY, statLine } from './copy';
import { useTodayRows, type TodayRow } from './useTodayRows';

const STAT_WINDOW_DAYS = 30;
const FAB_SIZE = 56;

/**
 * `reentryOverride`/`justAddedOverride`/`reentryTaskIdOverride` exist ONLY so a component test
 * can exercise the F14/first-task landing states without a real `expo-router` navigation
 * context to carry `?reentry=1`/`?justAdded=1`/`?taskId=` search params (the house pattern's
 * `useLocalSearchParams` returns empty params outside a navigator, by design). The real route
 * (`app/(tabs)/today.tsx`) never passes these — production behaviour is driven by the params.
 */
export interface TodayScreenProps {
  readonly reentryOverride?: boolean;
  readonly justAddedOverride?: boolean;
  readonly reentryTaskIdOverride?: string;
}

export default function TodayScreen({ reentryOverride, justAddedOverride, reentryTaskIdOverride }: TodayScreenProps = {}) {
  const t = useTheme();
  const router = useRouter();
  const showToast = useToastStore((s) => s.show);
  const params = useLocalSearchParams<{ justAdded?: string; reentry?: string; taskId?: string }>();

  const { date, rows, isLoading, isError, hasAnyTaskEver, refetch } = useTodayRows();
  const consistency = useConsistency({ scope: 'aggregate', window: 'last-30' });
  const logState = useLogState();
  const markOffDay = useMarkOffDay();

  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [reentryDismissed, setReentryDismissed] = useState(false);

  const reentryTaskId = reentryTaskIdOverride ?? params.taskId;
  const isReentry = (reentryOverride ?? params.reentry === '1') && !reentryDismissed;
  const isJustAdded = justAddedOverride ?? params.justAdded === '1';

  const allDueOff = rows.length > 0 && rows.every((r) => r.occurrence.outcome === 'off');

  async function handleToggleOff(next: boolean) {
    const result = await markOffDay.mutateAsync({ date, taskId: null, mark: next });
    if (!result.ok) {
      showToast(S09_COPY.chipRevertToast, 'warning');
      return;
    }
    showToast(next ? S09_COPY.offOnToast : S09_COPY.offUnmarkToast, 'success');
  }

  async function handleLogChip(row: TodayRow, chip: ChipState) {
    setExpandedTaskId(null);
    const result = await logState.mutateAsync({ taskId: row.task.id, date, chip });
    if (!result.ok) {
      showToast(S09_COPY.chipRevertToast, 'warning');
      return;
    }
    if (result.value.celebrate !== 'none') {
      // S24's route contract (M4-owned, `app/task/[id]/celebrate.tsx`): `variant`, `xp`,
      // `levelUp`, `from` — the caller supplies these; `from=today` lets S24 (and, on a
      // level-up, S28) return here afterward via `useOriginAwareBack`.
      const q = new URLSearchParams({
        variant: result.value.celebrate,
        xp: String(result.value.xpAwarded),
        levelUp: result.value.levelUp ? '1' : '0',
        from: 'today',
      });
      router.push(`/task/${row.task.id}/celebrate?${q.toString()}` as Href);
    }
  }

  function openTask(taskId: string) {
    router.push(withOrigin(`/task/${taskId}`, 'today') as Href);
  }

  const reentryTarget = useMemo(() => {
    if (!isReentry) return null;
    return rows.find((r) => r.task.id === reentryTaskId) ?? rows[0] ?? null;
  }, [isReentry, rows, reentryTaskId]);

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <View style={styles.header}>
        <View>
          <Text accessibilityRole="header" style={[styles.title, { color: t.color.text }]}>
            {S09_COPY.title}
          </Text>
          <Text style={[styles.dateSubline, { color: t.color.textMuted }]}>{formatHeaderDate(date)}</Text>
        </View>
        <View style={styles.headerIcons}>
          <IconButton icon={Mic} accessibilityLabel={S09_COPY.assistantLabel} onPress={() => router.push(ROUTES.assistant as Href)} />
          <IconButton
            icon={SearchIcon}
            accessibilityLabel={S09_COPY.searchLabel}
            onPress={() => router.push(withOrigin(ROUTES.search, 'today') as Href)}
          />
          <IconButton icon={SettingsIcon} accessibilityLabel={S09_COPY.settingsLabel} onPress={() => router.push(ROUTES.settings as Href)} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <OffDayToggle value={allDueOff} onValueChange={handleToggleOff} label={S09_COPY.offToggleLabel} />

        {isJustAdded ? (
          <Card accessibilityLabel="First habit set">
            <Text style={[styles.bannerText, { color: t.color.text }]}>
              {`${S09_COPY.firstHabitBannerPrefix}${formatHeaderDate(date)}${S09_COPY.firstHabitBannerSuffix}`}
            </Text>
          </Card>
        ) : null}

        {isReentry ? (
          <Card accessibilityLabel={`${S09_COPY.reentryHeadline} ${S09_COPY.reentrySubcopy}`}>
            <View style={styles.reentryHeaderRow}>
              <Bell size={18} color={t.color.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
              <View style={styles.reentryTextCol}>
                <Text style={[styles.reentryHeadline, { color: t.color.text }]}>{S09_COPY.reentryHeadline}</Text>
                <Text style={[styles.reentrySubcopy, { color: t.color.textMuted }]}>{S09_COPY.reentrySubcopy}</Text>
              </View>
              <IconButton icon={X} accessibilityLabel="Dismiss" variant="ghost" size={16} onPress={() => setReentryDismissed(true)} />
            </View>
            {consistency.data?.percent !== null && consistency.data !== undefined ? (
              <Text style={[styles.reentryStat, { color: t.color.textMuted }]}>
                {reentryStatLine(consistency.data.percent as number, roundHalfUp(consistency.data.numerator), STAT_WINDOW_DAYS)}
              </Text>
            ) : null}
            {reentryTarget ? (
              <Button
                label={S09_COPY.reentryCta}
                variant="ghost"
                onPress={() => setExpandedTaskId(reentryTarget.task.id)}
                accessibilityLabel={S09_COPY.reentryCta}
              />
            ) : null}
          </Card>
        ) : null}

        <Card onPress={() => router.push(ROUTES.progress as Href)} accessibilityLabel="See your consistency">
          {consistency.isLoading ? (
            <Skeleton width="60%" height={28} />
          ) : (
            <View style={styles.statRow}>
              <Text style={[styles.statNumeral, { color: t.color.text }]}>
                {consistency.data?.percent === null || consistency.data === undefined
                  ? S09_COPY.noDataStat
                  : statLine(consistency.data.percent as number, roundHalfUp(consistency.data.numerator), STAT_WINDOW_DAYS)}
              </Text>
              <ChevronRight size={20} color={t.color.textDim} accessibilityElementsHidden importantForAccessibility="no" />
            </View>
          )}
        </Card>

        <Card onPress={() => router.push(ROUTES.achievements as Href)} accessibilityLabel={S09_COPY.achievementsTeaser}>
          <View style={styles.statRow}>
            <Trophy size={18} color={t.color.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
            <Text style={[styles.achievementsLabel, { color: t.color.text }]}>{S09_COPY.achievementsTeaser}</Text>
            <ChevronRight size={20} color={t.color.textDim} accessibilityElementsHidden importantForAccessibility="no" />
          </View>
        </Card>

        {isLoading ? (
          <View style={styles.list}>
            <Skeleton height={72} />
            <Skeleton height={72} />
            <Skeleton height={72} />
          </View>
        ) : isError ? (
          <InlineRetryBanner message={S09_COPY.readFailure} retryLabel={S09_COPY.retry} onRetry={refetch} />
        ) : rows.length === 0 ? (
          !hasAnyTaskEver ? (
            <EmptyState
              icon={Sprout}
              headline={S09_COPY.blankSlateHeadline}
              subcopy={S09_COPY.blankSlateSubcopy}
              actionLabel={S09_COPY.blankSlateAction}
              onAction={() => router.push(ROUTES.addPickType as Href)}
            />
          ) : (
            <EmptyState
              icon={Sprout}
              headline={S09_COPY.nothingDueHeadline}
              subcopy={S09_COPY.nothingDueSubcopy}
              actionLabel={S09_COPY.nothingDueAction}
              actionVariant="secondary"
              onAction={() => router.push(ROUTES.addPickType as Href)}
            />
          )
        ) : (
          <View style={styles.list}>
            {rows.map((row) => (
              <TaskRow
                key={row.task.id}
                row={row}
                expanded={expandedTaskId === row.task.id}
                onToggleExpand={() => setExpandedTaskId((cur) => (cur === row.task.id ? null : row.task.id))}
                onSelectChip={(chip) => handleLogChip(row, chip)}
                onOpen={() => openTask(row.task.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[styles.fabWrap, { backgroundColor: t.accent.deep }]}>
        <IconButton
          icon={Plus}
          variant="accent"
          size={FAB_SIZE * 0.4}
          accessibilityLabel={S09_COPY.addTaskLabel}
          onPress={() => router.push(ROUTES.addPickType as Href)}
        />
      </View>
    </View>
  );
}

function metaLine(row: TodayRow): string {
  const { task, occurrence } = row;
  if (occurrence.outcome === 'off') return S09_COPY.offTodayMeta;
  const parts = [taskTypeLabel(task.type)];
  if (task.timeOfDay) parts.push(formatTimeOfDay(task.timeOfDay));
  if (task.type === 'course' && task.dosesPerDay > 1) {
    parts.push(`dose ${occurrence.dosesCompleted}/${occurrence.dosesRequired} today`);
  } else if (task.cadence) {
    parts.push(cadenceHintLower(task.cadence));
  }
  return parts.join(' · ');
}

function TaskRow({
  row,
  expanded,
  onToggleExpand,
  onSelectChip,
  onOpen,
}: {
  row: TodayRow;
  expanded: boolean;
  onToggleExpand: () => void;
  onSelectChip: (chip: ChipState) => void;
  onOpen: () => void;
}) {
  const t = useTheme();
  const Icon = resolveTaskIcon(row.task.icon);
  const isOff = row.occurrence.outcome === 'off';

  return (
    <Card accessibilityLabel={`${row.task.name}, ${metaLine(row)}`}>
      <View style={styles.taskRow}>
        <Icon size={22} color={t.color.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
        <View style={styles.taskTextCol}>
          <Text onPress={onOpen} style={[styles.taskName, { color: t.color.text }]}>
            {row.task.name}
          </Text>
          <Text style={[styles.taskMeta, { color: t.color.textMuted }]}>{metaLine(row)}</Text>
        </View>
        <StateChip
          variant="compact"
          value={row.occurrence.chipState}
          disabled={isOff}
          accessibilityLabel={`${row.task.name} state`}
          onChange={() => undefined}
          onPressCompact={onToggleExpand}
        />
      </View>
      {expanded ? (
        <StateChip value={row.occurrence.chipState} accessibilityLabel={`Set state for ${row.task.name}`} onChange={onSelectChip} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACE.s3,
    paddingTop: SPACE.s3,
    paddingBottom: SPACE.s2,
  },
  title: { fontSize: 24, fontWeight: '700' },
  dateSubline: { fontSize: 14 },
  headerIcons: { flexDirection: 'row', gap: SPACE.s1 },
  scrollContent: { padding: SPACE.s3, gap: SPACE.s3, paddingBottom: SPACE.s8 + FAB_SIZE },
  bannerText: { fontSize: 16, fontWeight: '600' },
  reentryHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.s2 },
  reentryTextCol: { flex: 1, gap: 2 },
  reentryHeadline: { fontSize: 16, fontWeight: '600' },
  reentrySubcopy: { fontSize: 14, lineHeight: 20 },
  reentryStat: { fontSize: 14, lineHeight: 20 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  statNumeral: { fontSize: 20, fontWeight: '700', flexShrink: 1 },
  achievementsLabel: { fontSize: 16, fontWeight: '600', flex: 1 },
  list: { gap: SPACE.s2 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  taskTextCol: { flex: 1, gap: 2 },
  taskName: { fontSize: 16, fontWeight: '600' },
  taskMeta: { fontSize: 13 },
  fabWrap: { position: 'absolute', right: SPACE.s3, bottom: SPACE.s4, borderRadius: 999 },
});
