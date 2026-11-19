/** M3 — S10 Routines. Weekday circles as the day filter (D10), shared task cards (D13/D14). */
import { useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Repeat } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { format } from 'date-fns';

import { parseLocalDate, today, weekdayOf } from '@/lib/date';
import { useTasks } from '@/queries';
import { ROUTES, withOrigin } from '@/navigation';
import { SPACE, useTheme } from '@/theme';
import { EmptyLine, EmptyState, InlineRetryBanner, SectionHeading, Skeleton, TabSummary, WeekdayPicker } from '@/ui';
import type { Id, TaskWithSteps, Weekday } from '@/types';

import { TaskCard } from '@/features/task/TaskCard';
import { StatusPill, metaParts } from '@/features/task/TaskDetails';
import { BROWSE_SHARED_COPY, dueSectionLabel, S10_COPY } from './copy';
import { cadenceLabel, cadenceRunsOnWeekday, formatTimeOfDay } from './format';
import { Fab, FAB_CLEARANCE } from './Fab';
import { BrowseHeader } from './BrowseHeader';
import { EndedSection } from './EndedSection';
import { useAsNeededHistory } from './useAsNeededHistory';
import { useTodayRows } from '@/features/today/useTodayRows';
import { WEEKDAY_FULL } from './weekdayLabels';

export default function RoutinesBrowseScreen() {
  const t = useTheme();
  const router = useRouter();
  const tasksQuery = useTasks({ type: 'routine' });
  const todayWeekday = weekdayOf(today());
  const todayRows = useTodayRows().rows.filter((r) => r.task.type === 'routine' && r.occurrence.outcome !== 'off');
  const loggedToday = todayRows.filter((r) => r.occurrence.chipState === 'done' || r.occurrence.chipState === 'fallback');
  const nextUp = todayRows.find((r) => r.occurrence.chipState !== 'done' && r.occurrence.chipState !== 'fallback' && r.occurrence.chipState !== 'skip');
  const idealToday = loggedToday.filter((r) => r.occurrence.chipState === 'done').length;
  const [selectedWeekday, setSelectedWeekday] = useState<Weekday>(todayWeekday);

  const all = tasksQuery.data ?? [];
  const running = all.filter((tk) => !tk.endedOn);
  const ended = all.filter((tk) => !!tk.endedOn);
  const scheduled = running.filter((tk) => !tk.isAsNeeded);
  const asNeeded = running.filter((tk) => tk.isAsNeeded);
  const due = scheduled.filter((tk) => cadenceRunsOnWeekday(tk.cadence, selectedWeekday));
  const dueIds = new Set(due.map((tk) => tk.id));
  const other = scheduled.filter((tk) => !dueIds.has(tk.id));

  function openTask(id: string) {
    router.push(withOrigin(`/task/${id}`, 'routines') as Href);
  }
  function openAsNeeded(id: string) {
    router.push(withOrigin(`/task/${id}/as-needed`, 'routines') as Href);
  }

  const noRoutinesAtAll = !tasksQuery.isLoading && !tasksQuery.isError && all.length === 0;
  const dayFull = WEEKDAY_FULL[selectedWeekday];

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <BrowseHeader title={S10_COPY.title} onSearch={() => router.push(withOrigin(ROUTES.search, 'routines') as Href)} />
      <ScrollView alwaysBounceVertical={false} overScrollMode="auto" contentContainerStyle={[styles.scrollContent, { paddingBottom: noRoutinesAtAll ? SPACE.s2 : FAB_CLEARANCE + SPACE.s4 }]} showsVerticalScrollIndicator={false}>
        {tasksQuery.isLoading ? (
          <View style={styles.list}>
            <Skeleton height={112} radius={20} />
            <Skeleton height={112} radius={20} />
            <Skeleton height={112} radius={20} />
          </View>
        ) : tasksQuery.isError ? (
          <InlineRetryBanner message={BROWSE_SHARED_COPY.errorReadFailure} retryLabel={BROWSE_SHARED_COPY.retry} onRetry={() => tasksQuery.refetch()} />
        ) : noRoutinesAtAll ? (
          <EmptyState
            icon={Repeat}
            headline={S10_COPY.emptyNoRoutinesHeadline}
            subcopy={S10_COPY.emptyNoRoutinesSubcopy}
            actionLabel={S10_COPY.emptyNoRoutinesAction}
            onAction={() => router.push(ROUTES.addRoutine as Href)}
          />
        ) : (
          <>
            {todayRows.length > 0 ? (
              <TabSummary
                mark={{ kind: 'ring', done: loggedToday.length, total: todayRows.length }}
                title={nextUp ? `${todayRows.length - loggedToday.length} left today` : 'Done for today'}
                detail={nextUp ? `Next: ${nextUp.task.name}` : `${idealToday} ideal, ${loggedToday.length - idealToday} fallback`}
                testID="routines-summary"
              />
            ) : null}
            <WeekdayPicker
              mode="single"
              selected={[selectedWeekday]}
              onChange={(days) => setSelectedWeekday(days[0] ?? todayWeekday)}
              markedDay={todayWeekday}
              accessibilityLabel="Show routines for a weekday"
            />

            <View style={styles.list}>
              <SectionHeading>{dueSectionLabel(dayFull)}</SectionHeading>
              {due.length === 0 ? (
                <EmptyLine>{`${S10_COPY.emptyNothingDueSubcopyPrefix}${dayFull}${S10_COPY.emptyNothingDueSubcopySuffix}`}</EmptyLine>
              ) : (
                due.map((tk) => (
                  <TaskCard
                    key={tk.id}
                    task={tk}
                    meta={metaParts({ schedule: tk.timeOfDay ? `${cadenceLabel(tk.cadence)} · ${formatTimeOfDay(tk.timeOfDay)}` : cadenceLabel(tk.cadence), importance: tk.importance, necessity: tk.necessity, compact: true })}
                    status={selectedWeekday === todayWeekday ? <StatusPill label={S10_COPY.dueBadge} tone="due" /> : undefined}
                    onPress={() => openTask(tk.id)}
                  />
                ))
              )}
            </View>

            {other.length > 0 ? (
              <View style={styles.list}>
                <SectionHeading>{S10_COPY.otherSection}</SectionHeading>
                {other.map((tk) => (
                  <TaskCard
                    key={tk.id}
                    task={tk}
                    meta={metaParts({ schedule: tk.timeOfDay ? `${cadenceLabel(tk.cadence)} · ${formatTimeOfDay(tk.timeOfDay)}` : cadenceLabel(tk.cadence), importance: tk.importance, necessity: tk.necessity, compact: true })}
                    onPress={() => openTask(tk.id)}
                  />
                ))}
              </View>
            ) : null}

            {asNeeded.length > 0 ? (
              <View style={styles.list}>
                <SectionHeading>{S10_COPY.asNeededSection}</SectionHeading>
                {asNeeded.map((tk) => (
                  <AsNeededRow key={tk.id} task={tk} onOpen={() => openAsNeeded(tk.id)} />
                ))}
              </View>
            ) : null}

            <EndedSection tasks={ended} onOpen={openTask} />
          </>
        )}
      </ScrollView>
      {noRoutinesAtAll ? null : <Fab accessibilityLabel="New routine" onPress={() => router.push(withOrigin(ROUTES.addRoutine, 'routines') as Href)} />}
    </View>
  );
}

function AsNeededRow({ task: tk, onOpen }: { task: TaskWithSteps; onOpen: () => void }) {
  const historyQuery = useAsNeededHistory(tk.id as Id);
  const history = historyQuery.data ?? [];
  const mostRecent = [...history].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];
  const lastUsed = mostRecent ? `Last used ${format(parseLocalDate(mostRecent.date), 'MMM d')}` : 'Not used yet';
  return (
    <TaskCard
      task={tk}
      meta={metaParts({ schedule: lastUsed, importance: tk.importance, necessity: tk.necessity, compact: true })}
      status={<StatusPill label="As-needed" />}
      onPress={onOpen}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: SPACE.s3, paddingTop: SPACE.s2, gap: SPACE.s4 },
  list: { gap: SPACE.s2 + 4 },
});
