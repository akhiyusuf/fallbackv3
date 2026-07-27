/** S12 — Courses Browse. F11 (browse), F12 (multi-dose meta). */
import { useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { ListChecks } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';

import { diffDays, parseLocalDate, today } from '@/lib/date';
import { useTasks } from '@/queries';
import { ROUTES, withOrigin } from '@/navigation';
import { SPACE, useTheme } from '@/theme';
import { Badge, Card, EmptyState, InlineRetryBanner, ProgressRing, Skeleton, Tabs, Tag } from '@/ui';
import type { LocalDate, TaskWithSteps } from '@/types';

import { BROWSE_SHARED_COPY, S12_COPY } from './copy';
import { Fab, FAB_CLEARANCE } from './Fab';
import { BrowseHeader } from './BrowseHeader';
import { resolveTaskIcon } from './resolveIcon';

type Lens = 'active' | 'past';

export default function CoursesBrowseScreen() {
  const t = useTheme();
  const router = useRouter();
  const tasksQuery = useTasks({ type: 'course' });
  const [lens, setLens] = useState<Lens>('active');
  const todayDate = today();

  const all = tasksQuery.data ?? [];
  const active = all.filter((c) => c.endDate === null || c.endDate >= todayDate);
  const past = all.filter((c) => c.endDate !== null && c.endDate < todayDate);
  const shown = lens === 'active' ? active : past;

  const noCoursesAtAll = !tasksQuery.isLoading && !tasksQuery.isError && all.length === 0;
  const noActiveButPastExist = !tasksQuery.isLoading && !tasksQuery.isError && all.length > 0 && active.length === 0 && lens === 'active';

  function openTask(id: string) {
    router.push(withOrigin(`/task/${id}`, 'courses') as Href);
  }

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <BrowseHeader title={S12_COPY.title} onSearch={() => router.push(withOrigin(ROUTES.search, 'courses') as Href)} />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: FAB_CLEARANCE }]}>
        <Tabs
          items={[
            { value: 'active', label: S12_COPY.active },
            { value: 'past', label: S12_COPY.past },
          ]}
          value={lens}
          onChange={(v) => setLens(v as Lens)}
          accessibilityLabel="Active or past courses"
        />

        {tasksQuery.isLoading ? (
          <View style={styles.list}>
            <Skeleton height={96} />
            <Skeleton height={96} />
          </View>
        ) : tasksQuery.isError ? (
          <InlineRetryBanner message={BROWSE_SHARED_COPY.errorReadFailure} retryLabel={BROWSE_SHARED_COPY.retry} onRetry={() => tasksQuery.refetch()} />
        ) : noCoursesAtAll ? (
          <EmptyState
            icon={ListChecks}
            headline={S12_COPY.noCoursesAtAllHeadline}
            subcopy={S12_COPY.noCoursesAtAllSubcopy}
            actionLabel={S12_COPY.newCourse}
            onAction={() => router.push(ROUTES.addCourse as Href)}
          />
        ) : noActiveButPastExist ? (
          <EmptyState
            icon={ListChecks}
            headline={S12_COPY.noActiveHeadline}
            subcopy={S12_COPY.noActiveSubcopy}
            actionLabel={S12_COPY.newCourse}
            actionVariant="secondary"
            onAction={() => router.push(ROUTES.addCourse as Href)}
          />
        ) : (
          <View style={styles.list}>
            {shown.map((c) => (
              <CourseRow key={c.id} task={c} today={todayDate} isPast={lens === 'past'} onPress={() => openTask(c.id)} />
            ))}
          </View>
        )}
      </ScrollView>
      <Fab onPress={() => router.push(ROUTES.addPickType as Href)} />
    </View>
  );
}

function CourseRow({ task: tk, today: todayDate, isPast, onPress }: { task: TaskWithSteps; today: LocalDate; isPast: boolean; onPress: () => void }) {
  const t = useTheme();
  const Icon = resolveTaskIcon(tk.icon);
  const start = tk.startDate ?? todayDate;
  const end = tk.endDate ?? todayDate;
  const totalDays = Math.max(1, diffDays(end, start) + 1);
  const elapsedDays = Math.min(totalDays, Math.max(0, diffDays(todayDate, start) + 1));
  const percent = isPast ? 100 : Math.round(Math.min(1, elapsedDays / totalDays) * 100);

  return (
    <Card onPress={onPress} accessibilityLabel={`${tk.name}, Day ${elapsedDays} of ${totalDays}`}>
      <View style={styles.rowHeader}>
        <Icon size={22} color={t.color.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
        <Text style={[styles.name, { color: t.color.text }]}>{tk.name}</Text>
      </View>
      <View style={styles.rowHeader}>
        <ProgressRing percent={percent} size={20} accessibilityLabel={`${percent} percent through the course`} />
        <Text style={[styles.meta, { color: t.color.textMuted }]}>{`Day ${elapsedDays} of ${totalDays}`}</Text>
      </View>
      <View style={styles.tagRow}>
        {!isPast && tk.dosesPerDay > 1 ? <Badge label={`${tk.dosesPerDay}×/day`} /> : null}
        {isPast ? (
          <Badge label={`${S12_COPY.completedPrefix} ${format(parseLocalDate(end), 'MMM d')}`} />
        ) : tk.endDate ? (
          <Badge label={`${Math.max(0, diffDays(tk.endDate, todayDate))} ${S12_COPY.daysLeftSuffix}`} />
        ) : null}
        {tk.idealSteps[0] ? <Tag label={`Ideal: ${tk.idealSteps[0].text}`} /> : null}
        {tk.fallbackSteps[0] ? <Tag label={`Fallback: ${tk.fallbackSteps[0].text}`} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { padding: SPACE.s3, gap: SPACE.s3 },
  list: { gap: SPACE.s2 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  name: { fontSize: 16, fontWeight: '600', flex: 1 },
  meta: { fontSize: 13 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s1 },
});
