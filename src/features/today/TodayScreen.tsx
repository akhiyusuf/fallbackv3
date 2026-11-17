/**
 * M3 — S09 Today (design/DESIGN_DECISIONS.md).
 * Tab header (D4), grouped summary list (D7), task cards with the shared log
 * control (D1) and toast feedback (D2). The add button hides while the app is
 * empty (D15).
 */
import { play } from '@/services/sfx';
import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Bell, ListOrdered, Search as SearchIcon, Settings as SettingsIcon, Sprout, Trophy, X } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { roundHalfUp } from '@/lib/number';
import { useConsistency, useLogState, useMarkOffDay, useProgress } from '@/queries';
import { ROUTES, withOrigin } from '@/navigation';
import { FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import {
  Button,
  Card,
  EmptyLine,
  EmptyState,
  IconButton,
  InlineRetryBanner,
  ListGroup,
  ListRow,
  LogButtons,
  LogStateChip,
  ScreenHeader,
  SectionHeading,
  Skeleton,
  Switch,
  TaskIcon,
  isLogged,
} from '@/ui';
import { useAddMenuStore, useToastStore } from '@/app-shell';
import type { ChipState } from '@/types';

import { cadenceHintLower, formatHeaderDate, formatTimeOfDay, taskTypeLabel } from '@/features/browse/format';
import { Fab, FAB_CLEARANCE } from '@/features/browse/Fab';
import { taskIconProps } from '@/features/browse/resolveIcon';
import { MetaLine, StatusPill, planSummary } from '@/features/task/TaskDetails';
import { LOG_SAVE_FAILED, useLogFeedback } from '@/features/task/logFeedback';
import { reentryStatLine, S09_COPY, statLine } from './copy';
import { usePriorityGroups } from '@/features/priorities/order';
import { StatHero } from './StatHero';
import { TodayTaskCard } from './TodayTaskCard';
import { useTodayRows, type TodayRow } from './useTodayRows';
import { Text } from '@/ui/AppText';

const STAT_WINDOW_DAYS = 30;

export interface TodayScreenProps {
  readonly reentryOverride?: boolean;
  readonly justAddedOverride?: boolean;
  readonly reentryTaskIdOverride?: string;
}

export default function TodayScreen({ reentryOverride, justAddedOverride, reentryTaskIdOverride }: TodayScreenProps = {}) {
  const t = useTheme();
  const router = useRouter();
  const openAddMenu = useAddMenuStore((st) => st.show);
  const showToast = useToastStore((s) => s.show);
  const logFeedback = useLogFeedback();
  const params = useLocalSearchParams<{ justAdded?: string; reentry?: string; taskId?: string }>();
  const { date, rows, isLoading, isError, hasAnyTaskEver, refetch } = useTodayRows();
  const consistency = useConsistency({ scope: 'aggregate', window: 'last-30' });
  const progress = useProgress();
  const priorities = usePriorityGroups();
  const logState = useLogState();
  const markOffDay = useMarkOffDay();
  const [reopenedTaskId, setReopenedTaskId] = useState<string | null>(null);
  const [reentryDismissed, setReentryDismissed] = useState(false);
  const [justAddedDismissed, setJustAddedDismissed] = useState(false);

  const reentryTaskId = reentryTaskIdOverride ?? params.taskId;
  const isReentry = (reentryOverride ?? params.reentry === '1') && !reentryDismissed;
  const isJustAdded = (justAddedOverride ?? params.justAdded === '1') && !justAddedDismissed;
  const allDueOff = rows.length > 0 && rows.every((r) => r.occurrence.outcome === 'off');
  const doneCount = rows.filter((r) => r.occurrence.chipState === 'done' || r.occurrence.chipState === 'fallback').length;

  async function handleToggleOff(next: boolean, isUndo = false) {
    const result = await markOffDay.mutateAsync({ date, taskId: null, mark: next });
    if (!result.ok) {
      showToast(LOG_SAVE_FAILED, 'warning');
      return;
    }
    if (isUndo) return showToast('Undone', 'neutral');
    showToast(next ? S09_COPY.offOnToast : S09_COPY.offUnmarkToast, 'neutral', { action: { label: 'Undo', onPress: () => void handleToggleOff(!next, true) } });
  }

  async function handleLog(row: TodayRow, chip: ChipState, isUndo = false) {
    setReopenedTaskId(null);
    const previous: ChipState = row.occurrence.chipState ?? 'todo';
    const result = await logState.mutateAsync({ taskId: row.task.id, date, chip });
    if (!result.ok) {
      showToast(LOG_SAVE_FAILED, 'warning');
      return;
    }
    if (isUndo) {
      showToast('Undone', 'neutral');
      return;
    }
    // The last thing due today just got done: the day's own sound follows the log sound.
    const wasOpen = previous === 'todo';
    const othersLogged = rows.every((r) => r.task.id === row.task.id || isLogged(r.occurrence.chipState));
    if (wasOpen && (chip === 'done' || chip === 'fallback') && rows.length > 1 && othersLogged) play('day_complete', 650);
    logFeedback(chip, result.value, chip === 'todo' ? undefined : () => void handleLog({ ...row, occurrence: { ...row.occurrence, chipState: chip } }, previous, true));
  }

  function openTask(taskId: string) {
    router.push(withOrigin(`/task/${taskId}`, 'today') as Href);
  }

  const reentryTarget = useMemo(() => {
    if (!isReentry) return null;
    return rows.find((r) => r.task.id === reentryTaskId) ?? rows[0] ?? null;
  }, [isReentry, rows, reentryTaskId]);

  const percent = consistency.data?.percent ?? null;
  const isBlankSlate = !isLoading && !isError && rows.length === 0 && !hasAnyTaskEver;

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <ScreenHeader
        level="tab"
        title={S09_COPY.title}
        subtitle={formatHeaderDate(date)}
        right={
          <>
            <IconButton icon={SearchIcon} accessibilityLabel={S09_COPY.searchLabel} onPress={() => router.push(withOrigin(ROUTES.search, 'today') as Href)} />
            <IconButton icon={SettingsIcon} accessibilityLabel={S09_COPY.settingsLabel} onPress={() => router.push(ROUTES.settings as Href)} />
          </>
        }
      />

      <ScrollView alwaysBounceVertical={false} overScrollMode="auto" contentContainerStyle={[styles.scrollContent, isBlankSlate && styles.blank]} showsVerticalScrollIndicator={false}>
        {isJustAdded ? (
          <Card accessibilityLabel={S09_COPY.firstHabitBannerPrefix}>
            <View style={styles.bannerRow}>
              <Sprout size={20} color={t.color.idealDeep} accessibilityElementsHidden importantForAccessibility="no" />
              <View style={styles.bannerTextCol}>
                <Text style={[styles.bannerTitle, { color: t.color.text }]}>{S09_COPY.firstHabitBannerPrefix}</Text>
                <Text style={[styles.bannerBody, { color: t.color.textMuted }]}>{S09_COPY.firstHabitBody}</Text>
              </View>
              <IconButton icon={X} accessibilityLabel="Dismiss" size={18} onPress={() => setJustAddedDismissed(true)} />
            </View>
          </Card>
        ) : null}

        {isReentry ? (
          <Card accessibilityLabel={`${S09_COPY.reentryHeadline} ${S09_COPY.reentrySubcopy}`}>
            <View style={styles.bannerRow}>
              <Bell size={20} color={t.color.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
              <View style={styles.bannerTextCol}>
                <Text style={[styles.bannerTitle, { color: t.color.text }]}>{S09_COPY.reentryHeadline}</Text>
                <Text style={[styles.bannerBody, { color: t.color.textMuted }]}>{S09_COPY.reentrySubcopy}</Text>
                {percent !== null && consistency.data ? (
                  <Text style={[styles.bannerBody, { color: t.color.textMuted }]}>
                    {reentryStatLine(percent, roundHalfUp(consistency.data.numerator), STAT_WINDOW_DAYS)}
                  </Text>
                ) : null}
              </View>
              <IconButton icon={X} accessibilityLabel="Dismiss" size={18} onPress={() => setReentryDismissed(true)} />
            </View>
            {reentryTarget ? (
              <Button label={S09_COPY.reentryCta} variant="secondary" onPress={() => openTask(reentryTarget.task.id)} accessibilityLabel={S09_COPY.reentryCta} fullWidth />
            ) : null}
          </Card>
        ) : null}

        {isBlankSlate ? null : (
          <StatHero
            percent={percent}
            loading={consistency.isLoading}
            label={S09_COPY.statLabel}
            detail={percent === null || !consistency.data ? S09_COPY.noDataStat : statLine(percent, roundHalfUp(consistency.data.numerator), STAT_WINDOW_DAYS)}
            onPress={() => router.push(ROUTES.progress as Href)}
            accessibilityLabel={`${S09_COPY.statLabel}: ${percent === null ? S09_COPY.noDataStat : `${percent} percent`}. ${S09_COPY.statHelper}`}
          />
        )}
        {isBlankSlate ? null : (
          <ListGroup>
            <ListRow
              icon={Trophy}
              label={S09_COPY.achievementsTeaser}
              value={progress.data ? `Level ${progress.data.level.level}` : undefined}
              onPress={() => router.push(ROUTES.achievements as Href)}
            />
            <ListRow
              icon={ListOrdered}
              label="Priorities"
              value={priorities.groups.high.length > 0 ? `${priorities.groups.high.length} high` : undefined}
              onPress={() => router.push(ROUTES.priorities as Href)}
            />
            <ListRow
              label={S09_COPY.offToggleLabel}
              sublabel="Nothing due counts against you."
              right={<Switch value={allDueOff} onValueChange={handleToggleOff} accessibilityLabel={S09_COPY.offToggleLabel} />}
            />
          </ListGroup>
        )}

        {isLoading ? (
          <View style={styles.list}>
            <Skeleton height={120} radius={20} />
            <Skeleton height={120} radius={20} />
            <Skeleton height={120} radius={20} />
          </View>
        ) : isError ? (
          <InlineRetryBanner message={S09_COPY.readFailure} retryLabel={S09_COPY.retry} onRetry={refetch} />
        ) : isBlankSlate ? (
          <EmptyState
            icon={Sprout}
            headline={S09_COPY.blankSlateHeadline}
            subcopy={S09_COPY.blankSlateSubcopy}
            actionLabel={S09_COPY.blankSlateAction}
            onAction={openAddMenu}
          />
        ) : (
          <View style={styles.list}>
            <SectionHeading
              right={rows.length > 0 ? <Text style={[styles.count, { color: t.color.textMuted }]}>{`${doneCount} of ${rows.length} done`}</Text> : undefined}
            >
              {S09_COPY.dueSection}
            </SectionHeading>
            {rows.length === 0 ? (
              <EmptyLine>{`${S09_COPY.nothingDueHeadline} ${S09_COPY.nothingDueSubcopy}`}</EmptyLine>
            ) : (
              rows.map((row) => (
                <TaskRow
                  key={row.task.id}
                  row={row}
                  reopened={reopenedTaskId === row.task.id}
                  onToggleReopen={() => setReopenedTaskId((cur) => (cur === row.task.id ? null : row.task.id))}
                  onLog={(chip) => void handleLog(row, chip)}
                  onOpen={() => openTask(row.task.id)}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>

      {isBlankSlate ? null : <Fab accessibilityLabel={S09_COPY.addTaskLabel} onPress={openAddMenu} />}
    </View>
  );
}

function scheduleParts(row: TodayRow, logged = false): string[] {
  const { task, occurrence } = row;
  // The time leads, so the list reads as a day: 7:00 AM, then what it is.
  const parts = task.timeOfDay ? [formatTimeOfDay(task.timeOfDay), taskTypeLabel(task.type)] : [taskTypeLabel(task.type)];
  if (task.type === 'course' && task.dosesPerDay > 1) {
    if (!logged) parts.push(`Dose ${occurrence.dosesCompleted} of ${occurrence.dosesRequired}`);
  } else if (task.cadence) {
    const hint = cadenceHintLower(task.cadence);
    parts.push(hint.charAt(0).toUpperCase() + hint.slice(1));
  }
  return parts;
}

function TaskRow({
  row,
  reopened,
  onToggleReopen,
  onLog,
  onOpen,
}: {
  row: TodayRow;
  reopened: boolean;
  onToggleReopen: () => void;
  onLog: (chip: ChipState) => void;
  onOpen: () => void;
}) {
  const chip = row.occurrence.chipState;
  const icon = taskIconProps(row.task);
  return (
    <TodayTaskCard
      name={row.task.name}
      icon={icon.icon}
      color={icon.color}
      meta={scheduleParts(row, isLogged(chip))}
      chip={chip}
      reopened={reopened}
      isOff={row.occurrence.outcome === 'off'}
      offLabel={S09_COPY.offTodayMeta}
      idealHint={planSummary(row.task.idealSteps)}
      fallbackHint={planSummary(row.task.fallbackSteps)}
      onLog={onLog}
      onToggleReopen={onToggleReopen}
      onOpen={onOpen}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Nothing yet: no add button to clear, and the taller Today header is allowed for, so the message sits where it does on every other tab.
  blank: { paddingTop: 0, paddingBottom: SPACE.s2 },
  scrollContent: { flexGrow: 1, paddingHorizontal: SPACE.s3, paddingTop: SPACE.s2, gap: SPACE.s3, paddingBottom: FAB_CLEARANCE + SPACE.s4 },
  bannerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.s2 + 4 },
  bannerTextCol: { flex: 1, gap: 2 },
  bannerTitle: { fontSize: FONT_SIZE.base, fontWeight: '700' },
  bannerBody: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  statNumeral: { fontSize: FONT_SIZE.xl, fontWeight: '700', minWidth: 56, fontVariant: ['tabular-nums'] },
  count: { fontSize: FONT_SIZE.sm },
  list: { gap: SPACE.s2 + 4 },
});
