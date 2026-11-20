/** M3 — S12 Courses. Segmented Active/Past (D9), shared task cards. */
import { useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { ListChecks } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { format } from 'date-fns';

import { diffDays, parseLocalDate, today } from '@/lib/date';
import { useTasks } from '@/queries';
import { ROUTES, withOrigin } from '@/navigation';
import { SPACE, useTheme } from '@/theme';
import { EmptyLine, EmptyState, InlineRetryBanner, ProgressRing, Skeleton, TabSummary, Tabs } from '@/ui';
import type { LocalDate, TaskWithSteps } from '@/types';

import { WeekStripsProvider } from '@/features/today/weekStrips';
import { TaskCard } from '@/features/task/TaskCard';
import { StatusPill, metaParts } from '@/features/task/TaskDetails';
import { BROWSE_SHARED_COPY, S12_COPY } from './copy';
import { Fab, FAB_CLEARANCE } from './Fab';
import { BrowseHeader } from './BrowseHeader';

type Lens = 'active' | 'past';

export default function CoursesBrowseScreen() {
  const t = useTheme();
  const router = useRouter();
  const tasksQuery = useTasks({ type: 'course' });
  const [lens, setLens] = useState<Lens>('active');
  const todayDate = today();

  const all = tasksQuery.data ?? [];
  // A course stopped early with "End course" is finished, the same as one past its end date.
  const isOver = (c: (typeof all)[number]) => !!c.endedOn || (c.endDate !== null && c.endDate < todayDate);
  const active = all.filter((c) => !isOver(c));
  const past = all.filter(isOver);
  const shown = lens === 'active' ? active : past;
  const nextToFinish = [...active].filter((c) => c.endDate !== null).sort((a, b) => ((a.endDate as LocalDate) < (b.endDate as LocalDate) ? -1 : 1))[0];

  const noCoursesAtAll = !tasksQuery.isLoading && !tasksQuery.isError && all.length === 0;

  function openTask(id: string) {
    router.push(withOrigin(`/task/${id}`, 'courses') as Href);
  }

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <BrowseHeader title={S12_COPY.title} onSearch={() => router.push(withOrigin(ROUTES.search, 'courses') as Href)} />
      <ScrollView alwaysBounceVertical={false} overScrollMode="auto" contentContainerStyle={[styles.scrollContent, { paddingBottom: noCoursesAtAll ? SPACE.s2 : FAB_CLEARANCE + SPACE.s4 }]} showsVerticalScrollIndicator={false}>
        {tasksQuery.isLoading ? (
          <View style={styles.list}>
            <Skeleton height={112} radius={20} />
            <Skeleton height={112} radius={20} />
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
        ) : (
          <WeekStripsProvider>
            {active.length > 0 ? (
              <TabSummary
                mark={{ kind: 'count', value: active.length }}
                title={active.length === 1 ? 'Course running' : 'Courses running'}
                detail={nextToFinish ? `${nextToFinish.name} finishes ${format(parseLocalDate(nextToFinish.endDate as LocalDate), 'EEE, MMM d')}` : undefined}
                testID="courses-summary"
              />
            ) : null}
            <Tabs
              items={[
                { value: 'active', label: S12_COPY.active },
                { value: 'past', label: S12_COPY.past },
              ]}
              value={lens}
              onChange={(v) => setLens(v as Lens)}
              accessibilityLabel="Active or past courses"
            />
            <View style={styles.list}>
              {shown.length === 0 ? (
                <EmptyLine>{lens === 'active' ? `${S12_COPY.noActiveHeadline} ${S12_COPY.noActiveSubcopy}` : 'No finished courses yet.'}</EmptyLine>
              ) : (
                shown.map((c) => <CourseRow key={c.id} task={c} today={todayDate} isPast={lens === 'past'} onPress={() => openTask(c.id)} />)
              )}
            </View>
          </WeekStripsProvider>
        )}
      </ScrollView>
      {noCoursesAtAll ? null : <Fab accessibilityLabel="New course" onPress={() => router.push(withOrigin(ROUTES.addCourse, 'courses') as Href)} />}
    </View>
  );
}

function CourseRow({ task: tk, today: todayDate, isPast, onPress }: { task: TaskWithSteps; today: LocalDate; isPast: boolean; onPress: () => void }) {
  const start = tk.startDate ?? todayDate;
  // A course stopped early finished on the day it was ended, not on its planned last day.
  const plannedEnd = tk.endDate ?? todayDate;
  const end = tk.endedOn && tk.endedOn < plannedEnd ? tk.endedOn : plannedEnd;
  const totalDays = Math.max(1, diffDays(end, start) + 1);
  const elapsedDays = Math.min(totalDays, Math.max(0, diffDays(todayDate, start) + 1));
  const percent = isPast ? 100 : Math.round(Math.min(1, elapsedDays / totalDays) * 100);
  const extra = [
    !isPast && tk.dosesPerDay > 1 ? `${tk.dosesPerDay} doses a day` : null,
  ];
  return (
    <TaskCard
      task={tk}
      meta={metaParts({ schedule: isPast ? `${totalDays} ${totalDays === 1 ? 'day' : 'days'}` : elapsedDays === 0 ? `Starts ${format(parseLocalDate(start), 'MMM d')}` : `Day ${elapsedDays} of ${totalDays}`, extra, importance: tk.importance, necessity: tk.necessity, compact: true })}
      metaLeading={isPast ? undefined : <ProgressRing percent={percent} size={18} strokeWidth={4} accessibilityLabel={`${percent} percent through the course`} />}
      status={isPast ? <StatusPill label={`${S12_COPY.completedPrefix} ${format(parseLocalDate(end), 'MMM d')}`} tone="done" /> : undefined}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: SPACE.s3, paddingTop: SPACE.s2, gap: SPACE.s3 },
  list: { gap: SPACE.s2 + 4 },
});
