/** M3 — S11 Events. Sections with bold headings (D19); empty sections are one muted line (D15). */
import { useCallback, useEffect, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Calendar } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';

import { addDays, parseLocalDate, today } from '@/lib/date';
import { useTaskOccurrences, useTasks } from '@/queries';
import { ROUTES, withOrigin } from '@/navigation';
import { FONT_SIZE, SPACE, useTheme } from '@/theme';
import { EmptyLine, EmptyState, InlineRetryBanner, SectionHeading, Skeleton, TabSummary } from '@/ui';
import type { LocalDate, TaskWithSteps } from '@/types';

import { TaskCard } from '@/features/task/TaskCard';
import { StatusPill, metaParts } from '@/features/task/TaskDetails';
import { BROWSE_SHARED_COPY, S11_COPY } from './copy';
import { cadenceLabel, formatRelativeDayLabel, formatTimeOfDay } from './format';
import { Fab, FAB_CLEARANCE } from './Fab';
import { BrowseHeader } from './BrowseHeader';
import { EndedSection } from './EndedSection';
import { Text } from '@/ui/AppText';

const UPCOMING_WINDOW_DAYS = 90;

export default function EventsBrowseScreen() {
  const t = useTheme();
  const router = useRouter();
  const tasksQuery = useTasks({ type: 'event' });
  const todayDate = today();

  const events = tasksQuery.data ?? [];
  const oneOff = events.filter((e) => e.eventDate !== null);
  const repeating = events.filter((e) => e.eventDate === null && e.cadence !== null && !e.endedOn);
  const ended = events.filter((e) => !!e.endedOn);

  const todayEvents = oneOff.filter((e) => e.eventDate === todayDate);
  const upcomingOneOff = oneOff.filter((e) => e.eventDate !== null && e.eventDate > todayDate);
  const upcomingGroups = new Map<LocalDate, TaskWithSteps[]>();
  for (const e of upcomingOneOff) {
    const key = e.eventDate as LocalDate;
    const list = upcomingGroups.get(key) ?? [];
    list.push(e);
    upcomingGroups.set(key, list);
  }
  const sortedUpcomingGroupDates = [...upcomingGroups.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const [repeatingDueTodayIds, setRepeatingDueTodayIds] = useState<ReadonlySet<string>>(new Set());
  const reportDueToday = useCallback((id: string, dueToday: boolean) => {
    setRepeatingDueTodayIds((prev) => {
      const has = prev.has(id);
      if (dueToday === has) return prev;
      const next = new Set(prev);
      if (dueToday) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const noEventsAtAll = !tasksQuery.isLoading && !tasksQuery.isError && events.length === 0;
  const noEventsToday = todayEvents.length === 0 && repeatingDueTodayIds.size === 0;
  const eventsTodayCount = todayEvents.length + repeatingDueTodayIds.size;
  const firstUpcomingDate = sortedUpcomingGroupDates[0];
  const nextOneOff = firstUpcomingDate ? upcomingGroups.get(firstUpcomingDate)?.[0] : undefined;
  const hasUpcoming = sortedUpcomingGroupDates.length > 0 || repeating.some((e) => !repeatingDueTodayIds.has(e.id));

  function openTask(id: string) {
    router.push(withOrigin(`/task/${id}`, 'events') as Href);
  }

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <BrowseHeader title={S11_COPY.title} onSearch={() => router.push(withOrigin(ROUTES.search, 'events') as Href)} />
      <ScrollView alwaysBounceVertical={false} overScrollMode="auto" contentContainerStyle={[styles.scrollContent, { paddingBottom: noEventsAtAll ? SPACE.s2 : FAB_CLEARANCE + SPACE.s4 }]} showsVerticalScrollIndicator={false}>
        {tasksQuery.isLoading ? (
          <View style={styles.list}>
            <Skeleton height={76} radius={20} />
            <Skeleton height={76} radius={20} />
          </View>
        ) : tasksQuery.isError ? (
          <InlineRetryBanner message={BROWSE_SHARED_COPY.errorReadFailure} retryLabel={BROWSE_SHARED_COPY.retry} onRetry={() => tasksQuery.refetch()} />
        ) : noEventsAtAll ? (
          <EmptyState
            icon={Calendar}
            art="calendar"
            headline={S11_COPY.noEventsAtAllHeadline}
            subcopy={S11_COPY.noEventsAtAllSubcopy}
            actionLabel={S11_COPY.newEvent}
            onAction={() => router.push(ROUTES.addEvent as Href)}
          />
        ) : (
          <>
            <TabSummary
              mark={{ kind: 'date', top: parseLocalDate(todayDate).toLocaleDateString('en-US', { month: 'short' }).toUpperCase(), main: String(parseLocalDate(todayDate).getDate()) }}
              title={noEventsToday ? `Nothing on this ${weekdayNameOf(todayDate)}` : eventsTodayCount === 1 ? '1 event today' : `${eventsTodayCount} events today`}
              detail={nextOneOff ? `Next: ${nextOneOff.name}, ${formatRelativeDayLabel(nextOneOff.eventDate as LocalDate, todayDate)}` : undefined}
              testID="events-summary"
            />
            {/* The rows stay mounted when nothing is on today: repeating events report back from here. */}
            <View style={noEventsToday ? styles.hidden : styles.list}>
              <SectionHeading>{S11_COPY.todaySection}</SectionHeading>
              {todayEvents.map((e) => (
                <EventRow key={e.id} task={e} onPress={() => openTask(e.id)} />
              ))}
              {repeating.map((e) => (
                <RepeatingEventRow key={e.id} task={e} today={todayDate} section="today" onPress={() => openTask(e.id)} onDueTodayChange={(due) => reportDueToday(e.id, due)} />
              ))}
            </View>

            <View style={styles.list}>
              <SectionHeading>{S11_COPY.upcomingSection}</SectionHeading>
              {hasUpcoming ? null : <EmptyLine>Nothing coming up.</EmptyLine>}
              {sortedUpcomingGroupDates.map((date) => {
                const list = upcomingGroups.get(date) as TaskWithSteps[];
                return (
                  <View key={date} style={styles.group}>
                    <Text style={[styles.groupLabel, { color: t.color.textMuted }]}>{formatRelativeDayLabel(date, todayDate)}</Text>
                    {list.map((e) => (
                      <EventRow key={e.id} task={e} onPress={() => openTask(e.id)} />
                    ))}
                  </View>
                );
              })}
              {repeating.map((e) => (
                <RepeatingEventRow key={e.id} task={e} today={todayDate} section="upcoming" onPress={() => openTask(e.id)} />
              ))}
            </View>
            <EndedSection tasks={ended} onOpen={openTask} />
          </>
        )}
      </ScrollView>
      {noEventsAtAll ? null : <Fab accessibilityLabel="New event" onPress={() => router.push(withOrigin(ROUTES.addEvent, 'events') as Href)} />}
    </View>
  );
}

function weekdayNameOf(date: LocalDate): string {
  return parseLocalDate(date).toLocaleDateString('en-US', { weekday: 'long' });
}

function EventRow({ task: tk, onPress }: { task: TaskWithSteps; onPress: () => void }) {
  const time = tk.timeOfDay ? formatTimeOfDay(tk.timeOfDay) : 'Any time';
  return (
    <TaskCard
      task={tk}
      meta={metaParts({ schedule: time, importance: tk.importance, necessity: tk.necessity, compact: true })}
      status={<StatusPill label={S11_COPY.oneTime} />}
      onPress={onPress}
    />
  );
}

function RepeatingEventRow({
  task: tk,
  today: todayDate,
  section,
  onPress,
  onDueTodayChange,
}: {
  task: TaskWithSteps;
  today: LocalDate;
  section: 'today' | 'upcoming';
  onPress: () => void;
  onDueTodayChange?: (dueToday: boolean) => void;
}) {
  const occQuery = useTaskOccurrences(tk.id, { from: todayDate, to: addDays(todayDate, UPCOMING_WINDOW_DAYS) });
  const occs = occQuery.data ?? [];
  const dueToday = occs.some((o) => o.date === todayDate && o.outcome !== 'not-due');
  const next = occs.find((o) => o.outcome !== 'not-due' && o.date > todayDate);

  useEffect(() => {
    onDueTodayChange?.(dueToday);
  }, [dueToday, onDueTodayChange]);

  if (section === 'today' ? !dueToday : dueToday) return null;

  const timeLabel = tk.timeOfDay ? formatTimeOfDay(tk.timeOfDay) : undefined;
  const dateLabel = section === 'upcoming' && next ? formatRelativeDayLabel(next.date, todayDate) : undefined;
  return (
    <TaskCard
      task={tk}
      meta={metaParts({ schedule: [dateLabel, timeLabel, `Repeats ${cadenceLabel(tk.cadence).toLowerCase()}`].filter(Boolean).join(' · '), importance: tk.importance, necessity: tk.necessity, compact: true })}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: SPACE.s3, paddingTop: SPACE.s2, gap: SPACE.s4 },
  list: { gap: SPACE.s2 + 4 },
  hidden: { display: 'none' },
  group: { gap: SPACE.s2 },
  groupLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
});
