/**
 * S11 — Events Browse. F11 (browse), F26 (repeating events).
 */
import { useRouter, type Href } from 'expo-router';
import { Calendar } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { addDays, parseLocalDate, today } from '@/lib/date';
import { useTaskOccurrences, useTasks } from '@/queries';
import { ROUTES, withOrigin } from '@/navigation';
import { SPACE, useTheme } from '@/theme';
import { Badge, Card, EmptyState, InlineRetryBanner, Skeleton, Tag } from '@/ui';
import type { LocalDate, TaskWithSteps } from '@/types';

import { S11_COPY } from './copy';
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

  const noEventsAtAll = !tasksQuery.isLoading && !tasksQuery.isError && events.length === 0;

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
          <InlineRetryBanner message="Couldn’t load this list. Your data is safe on this device." retryLabel="Retry" onRetry={() => tasksQuery.refetch()} />
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
            {todayEvents.length === 0 ? (
              <EmptyState
                icon={Calendar}
                headline={S11_COPY.noEventsTodayHeadlinePrefix}
                subcopy={`${S11_COPY.noEventsTodaySubcopyPrefix}${weekdayNameOf(todayDate)}${S11_COPY.noEventsTodaySubcopySuffix}`}
              />
            ) : (
              <View style={styles.list}>
                {todayEvents.map((e) => (
                  <EventRow key={e.id} task={e} onPress={() => openTask(e.id)} />
                ))}
              </View>
            )}

            <Text accessibilityRole="header" style={[styles.sectionLabel, { color: t.color.text }]}>
              {S11_COPY.upcomingSection}
            </Text>
            <View style={styles.list}>
              {[...upcomingGroups.entries()].map(([date, list]) => (
                <View key={date} style={styles.group}>
                  <Text style={[styles.groupLabel, { color: t.color.textMuted }]}>{formatRelativeDayLabel(date as never, todayDate)}</Text>
                  {list.map((e) => (
                    <EventRow key={e.id} task={e} onPress={() => openTask(e.id)} />
                  ))}
                </View>
              ))}
              {repeating.map((e) => (
                <RepeatingEventRow key={e.id} task={e} today={todayDate} onPress={() => openTask(e.id)} />
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

function RepeatingEventRow({ task: tk, today: todayDate, onPress }: { task: TaskWithSteps; today: LocalDate; onPress: () => void }) {
  const occQuery = useTaskOccurrences(tk.id, { from: todayDate, to: addDays(todayDate, UPCOMING_WINDOW_DAYS) });
  const t = useTheme();
  const Icon = resolveTaskIcon(tk.icon);
  const next = (occQuery.data ?? []).find((o) => o.outcome !== 'not-due' && o.date > todayDate);
  if (!next) return null;
  return (
    <Card onPress={onPress} accessibilityLabel={`${tk.name}, Repeats`}>
      <View style={styles.rowHeader}>
        <Icon size={22} color={t.color.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
        <Text style={[styles.name, { color: t.color.text }]}>{tk.name}</Text>
      </View>
      <View style={styles.rowHeader}>
        <Text style={[styles.meta, { color: t.color.textMuted }]}>{formatRelativeDayLabel(next.date, todayDate)}</Text>
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
