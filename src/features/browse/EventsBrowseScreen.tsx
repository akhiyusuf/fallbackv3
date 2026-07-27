/**
 * S11 — Events Browse. F11 (browse), F26 (repeating events).
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Calendar } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { addDays, parseLocalDate, today } from '@/lib/date';
import { useTaskOccurrences, useTasks } from '@/queries';
import { ROUTES, withOrigin } from '@/navigation';
import { SPACE, useTheme } from '@/theme';
import { Badge, Card, EmptyState, InlineRetryBanner, Skeleton, Tag } from '@/ui';
import type { LocalDate, TaskWithSteps } from '@/types';

import { BROWSE_SHARED_COPY, S11_COPY } from './copy';
import { formatRelativeDayLabel, formatTimeOfDay } from './format';
import { Fab, FAB_CLEARANCE } from './Fab';
import { BrowseHeader } from './BrowseHeader';
import { resolveTaskIcon } from './resolveIcon';

const UPCOMING_WINDOW_DAYS = 90;

export default function EventsBrowseScreen() {
  const t = useTheme();
  const router = useRouter();
  const tasksQuery = useTasks({ type: 'event' });
  const todayDate = today();

  const events = tasksQuery.data ?? [];
  const oneOff = events.filter((e) => e.eventDate !== null);
  const repeating = events.filter((e) => e.eventDate === null && e.cadence !== null);

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

  // A repeating event's "due today" status only resolves once its own occurrence query
  // (inside `RepeatingEventRow`) reports back — the Today section's own empty-state gate
  // (item 4a of review/REVIEW-M3.md) needs to know that BEFORE deciding whether to render
  // the scoped "No events today." copy, so each repeating row reports here.
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

  function openTask(id: string) {
    router.push(withOrigin(`/task/${id}`, 'events') as Href);
  }

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <BrowseHeader title={S11_COPY.title} onSearch={() => router.push(withOrigin(ROUTES.search, 'events') as Href)} />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: FAB_CLEARANCE }]}>
        {tasksQuery.isLoading ? (
          <View style={styles.list}>
            <Skeleton height={72} />
            <Skeleton height={72} />
          </View>
        ) : tasksQuery.isError ? (
          <InlineRetryBanner message={BROWSE_SHARED_COPY.errorReadFailure} retryLabel={BROWSE_SHARED_COPY.retry} onRetry={() => tasksQuery.refetch()} />
        ) : noEventsAtAll ? (
          <EmptyState
            icon={Calendar}
            headline={S11_COPY.noEventsAtAllHeadline}
            subcopy={S11_COPY.noEventsAtAllSubcopy}
            actionLabel={S11_COPY.newEvent}
            onAction={() => router.push(ROUTES.addEvent as Href)}
          />
        ) : (
          <>
            <Text accessibilityRole="header" style={[styles.sectionLabel, { color: t.color.text }]}>
              {S11_COPY.todaySection}
            </Text>
            {noEventsToday ? (
              <EmptyState
                icon={Calendar}
                headline={S11_COPY.noEventsTodayHeadlinePrefix}
                subcopy={`${S11_COPY.noEventsTodaySubcopyPrefix}${weekdayNameOf(todayDate)}${S11_COPY.noEventsTodaySubcopySuffix}`}
              />
            ) : null}
            <View style={styles.list}>
              {todayEvents.map((e) => (
                <EventRow key={e.id} task={e} onPress={() => openTask(e.id)} />
              ))}
              {repeating.map((e) => (
                <RepeatingEventRow
                  key={e.id}
                  task={e}
                  today={todayDate}
                  section="today"
                  onPress={() => openTask(e.id)}
                  onDueTodayChange={(due) => reportDueToday(e.id, due)}
                />
              ))}
            </View>

            <Text accessibilityRole="header" style={[styles.sectionLabel, { color: t.color.text }]}>
              {S11_COPY.upcomingSection}
            </Text>
            <View style={styles.list}>
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
          </>
        )}
      </ScrollView>
      <Fab onPress={() => router.push(ROUTES.addPickType as Href)} />
    </View>
  );
}

function weekdayNameOf(date: LocalDate): string {
  // Local, display-only — the actual weekday NAME for the "no events today" subcopy; not a
  // due-ness computation, so it stays presentation-layer.
  return parseLocalDate(date).toLocaleDateString('en-US', { weekday: 'long' });
}

function EventRow({ task: tk, onPress }: { task: TaskWithSteps; onPress: () => void }) {
  const t = useTheme();
  const Icon = resolveTaskIcon(tk.icon);
  const meta = tk.timeOfDay ? formatTimeOfDay(tk.timeOfDay) : undefined;
  return (
    <Card onPress={onPress} accessibilityLabel={`${tk.name}${meta ? `, ${meta}` : ''}`}>
      <View style={styles.rowHeader}>
        <Icon size={22} color={t.color.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
        <Text style={[styles.name, { color: t.color.text }]}>{tk.name}</Text>
      </View>
      <View style={styles.rowHeader}>
        {meta ? <Text style={[styles.meta, { color: t.color.textMuted }]}>{meta}</Text> : null}
        <Badge label={S11_COPY.oneTime} />
      </View>
      {tk.idealSteps[0] || tk.fallbackSteps[0] ? (
        <View style={styles.tagRow}>
          {tk.idealSteps[0] ? <Tag label={`Ideal: ${tk.idealSteps[0].text}`} /> : null}
          {tk.fallbackSteps[0] ? <Tag label={`Fallback: ${tk.fallbackSteps[0].text}`} /> : null}
        </View>
      ) : null}
    </Card>
  );
}

/**
 * Renders once per (repeating event x section). `section="today"` shows the row only when an
 * occurrence resolves due TODAY (review item 4a) and reports that status up to the parent so
 * the Today section's scoped empty state isn't shown alongside a real row (`onDueTodayChange`).
 * `section="upcoming"` shows the row for every repeating event EXCEPT one already shown under
 * Today — including one with no occurrence inside the lookahead window, so a yearly cadence
 * never vanishes from its own tab (review item 4c): the recurrence badge always renders; the
 * relative-date text is simply omitted when no occurrence resolves within the window.
 */
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
  const t = useTheme();
  const Icon = resolveTaskIcon(tk.icon);
  const occs = occQuery.data ?? [];
  const dueToday = occs.some((o) => o.date === todayDate && o.outcome !== 'not-due');
  const next = occs.find((o) => o.outcome !== 'not-due' && o.date > todayDate);

  useEffect(() => {
    onDueTodayChange?.(dueToday);
  }, [dueToday, onDueTodayChange]);

  if (section === 'today' ? !dueToday : dueToday) return null;

  const timeLabel = tk.timeOfDay ? formatTimeOfDay(tk.timeOfDay) : undefined;
  const dateLabel = section === 'upcoming' && next ? formatRelativeDayLabel(next.date, todayDate) : undefined;
  const metaParts = [dateLabel, timeLabel].filter((v): v is string => !!v);

  return (
    <Card onPress={onPress} accessibilityLabel={`${tk.name}, Repeats${timeLabel ? `, ${timeLabel}` : ''}`}>
      <View style={styles.rowHeader}>
        <Icon size={22} color={t.color.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
        <Text style={[styles.name, { color: t.color.text }]}>{tk.name}</Text>
      </View>
      <View style={styles.rowHeader}>
        {metaParts.length > 0 ? <Text style={[styles.meta, { color: t.color.textMuted }]}>{metaParts.join(' · ')}</Text> : null}
        <Badge label={`Repeats · ${repeatWord(tk)}`} />
      </View>
    </Card>
  );
}

function repeatWord(tk: TaskWithSteps): string {
  switch (tk.cadence?.kind) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'bi-weekly':
      return 'Bi-weekly';
    case 'monthly':
      return 'Monthly';
    case 'bi-monthly':
      return 'Bi-monthly';
    case 'yearly':
      return 'Yearly';
    default:
      return '';
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { padding: SPACE.s3, gap: SPACE.s3 },
  list: { gap: SPACE.s2 },
  group: { gap: SPACE.s1 },
  groupLabel: { fontSize: 13, fontWeight: '600' },
  sectionLabel: { fontSize: 16, fontWeight: '700' },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  name: { fontSize: 16, fontWeight: '600', flex: 1 },
  meta: { fontSize: 13 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s1 },
});
