/**
 * S10 — Routines Browse. F2 (browse), F6, F27 (as-needed rows, never on Today, → S23).
 */
import { useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Repeat } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';

import { parseLocalDate, today, weekdayOf } from '@/lib/date';
import { useTasks } from '@/queries';
import { ROUTES, withOrigin } from '@/navigation';
import { SPACE, useTheme } from '@/theme';
import { AsNeededCard, Badge, Card, EmptyState, InlineRetryBanner, Skeleton, Tabs, Tag } from '@/ui';
import type { Id, TaskWithSteps, Weekday } from '@/types';

import { BROWSE_SHARED_COPY, dueSectionLabel, S10_COPY } from './copy';
import { cadenceLabel, cadenceRunsOnWeekday, importanceLabel, necessityLabel } from './format';
import { Fab, FAB_CLEARANCE } from './Fab';
import { BrowseHeader } from './BrowseHeader';
import { resolveTaskIcon } from './resolveIcon';
import { useAsNeededHistory } from './useAsNeededHistory';
import { WEEKDAY_FULL } from './weekdayLabels';

const WEEKDAY_TABS = ([1, 2, 3, 4, 5, 6, 7] as const).map((d) => ({ value: String(d), label: WEEKDAY_FULL[d as Weekday].slice(0, 3) }));

export default function RoutinesBrowseScreen() {
  const t = useTheme();
  const router = useRouter();
  const tasksQuery = useTasks({ type: 'routine' });
  const [selectedWeekday, setSelectedWeekday] = useState<Weekday>(weekdayOf(today()));

  const all = tasksQuery.data ?? [];
  const scheduled = all.filter((tk) => !tk.isAsNeeded);
  const asNeeded = all.filter((tk) => tk.isAsNeeded);
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
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: FAB_CLEARANCE }]}>
        <Tabs
          items={WEEKDAY_TABS}
          value={String(selectedWeekday)}
          onChange={(v) => setSelectedWeekday(Number(v) as Weekday)}
          accessibilityLabel="Select a weekday"
        />

        {tasksQuery.isLoading ? (
          <View style={styles.list}>
            <Skeleton height={80} />
            <Skeleton height={80} />
            <Skeleton height={80} />
          </View>
        ) : tasksQuery.isError ? (
          <InlineRetryBanner message={BROWSE_SHARED_COPY.errorReadFailure} retryLabel={BROWSE_SHARED_COPY.retry} onRetry={() => tasksQuery.refetch()} />
        ) : noRoutinesAtAll ? (
          <EmptyState
            icon={Repeat}
            headline={S10_COPY.emptyNoRoutinesHeadline}
            subcopy={S10_COPY.emptyNoRoutinesSubcopy}
            actionLabel={S10_COPY.emptyNoRoutinesAction}
            onAction={() => router.push(ROUTES.addPickType as Href)}
          />
        ) : (
          <>
            <Text accessibilityRole="header" style={[styles.sectionLabel, { color: t.color.text }]}>
              {dueSectionLabel(dayFull)}
            </Text>
            {due.length === 0 ? (
              <EmptyState
                icon={Repeat}
                headline={S10_COPY.emptyNothingDueHeadline}
                subcopy={`${S10_COPY.emptyNothingDueSubcopyPrefix}${dayFull}${S10_COPY.emptyNothingDueSubcopySuffix}`}
              />
            ) : (
              <View style={styles.list}>
                {due.map((tk) => (
                  <ScheduledRow key={tk.id} task={tk} showDueBadge cadenceText={cadenceLabel(tk.cadence)} onPress={() => openTask(tk.id)} />
                ))}
              </View>
            )}

            <Text accessibilityRole="header" style={[styles.sectionLabel, { color: t.color.text }]}>
              {S10_COPY.otherSection}
            </Text>
            <View style={styles.list}>
              {other.map((tk) => (
                <ScheduledRow key={tk.id} task={tk} showDueBadge={false} cadenceText={`Due ${cadenceLabel(tk.cadence)}`} onPress={() => openTask(tk.id)} />
              ))}
              {asNeeded.map((tk) => (
                <AsNeededRow key={tk.id} task={tk} onOpen={() => openAsNeeded(tk.id)} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
      <Fab onPress={() => router.push(ROUTES.addPickType as Href)} />
    </View>
  );
}

function ScheduledRow({
  task: tk,
  showDueBadge,
  cadenceText,
  onPress,
}: {
  task: TaskWithSteps;
  showDueBadge: boolean;
  cadenceText: string;
  onPress: () => void;
}) {
  const t = useTheme();
  const Icon = resolveTaskIcon(tk.icon);
  return (
    <Card onPress={onPress} accessibilityLabel={`${tk.name}, ${cadenceText}`}>
      <View style={styles.rowHeader}>
        <Icon size={22} color={t.color.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
        <Text style={[styles.name, { color: t.color.text }]}>{tk.name}</Text>
        {showDueBadge ? <Badge label={S10_COPY.dueBadge} /> : null}
      </View>
      <Text style={[styles.meta, { color: t.color.textMuted }]}>{cadenceText}</Text>
      <View style={styles.tagRow}>
        {tk.idealSteps[0] ? <Tag label={`Ideal: ${tk.idealSteps[0].text}`} /> : null}
        {tk.fallbackSteps[0] ? <Tag label={`Fallback: ${tk.fallbackSteps[0].text}`} /> : null}
        {tk.importance ? <Tag label={importanceLabel(tk.importance)} /> : null}
        {tk.necessity ? <Tag label={necessityLabel(tk.necessity)} /> : null}
      </View>
    </Card>
  );
}

/** S10's as-needed row — adds the "Last used {date}" preview via `useAsNeededHistory`. */
function AsNeededRow({ task: tk, onOpen }: { task: TaskWithSteps; onOpen: () => void }) {
  const historyQuery = useAsNeededHistory(tk.id as Id);
  const history = historyQuery.data ?? [];
  const mostRecent = [...history].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];
  const lastUsedLabel = mostRecent ? `Last used ${format(parseLocalDate(mostRecent.date), 'MMM d')}` : undefined;

  return (
    <AsNeededCard
      name={tk.name}
      icon={resolveTaskIcon(tk.icon)}
      idealLabel={tk.idealSteps[0] ? `Ideal: ${tk.idealSteps[0].text}` : undefined}
      fallbackLabel={tk.fallbackSteps[0] ? `Fallback: ${tk.fallbackSteps[0].text}` : undefined}
      lastUsedLabel={lastUsedLabel}
      onPress={onOpen}
      onLogUsedIt={onOpen}
      logButtonLabel={S10_COPY.logUsedIt}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { padding: SPACE.s3, gap: SPACE.s3 },
  list: { gap: SPACE.s2 },
  sectionLabel: { fontSize: 16, fontWeight: '700' },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  name: { fontSize: 16, fontWeight: '600', flex: 1 },
  meta: { fontSize: 13 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s1 },
});
