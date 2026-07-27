/** S14 — Filter & Search. F15. */
import { useMemo, useState, type ReactNode } from 'react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ChevronLeft, Search as SearchIcon } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useOriginAwareBack, withOrigin, type ScreenOrigin } from '@/navigation';
import { useTasks } from '@/queries';
import { SPACE, useTheme } from '@/theme';
import { Button, Card, EmptyState, IconButton, InlineRetryBanner, Input, Skeleton, Tag } from '@/ui';
import type { Importance, Necessity, TaskType, TaskWithSteps } from '@/types';

import { BROWSE_SHARED_COPY } from '@/features/browse/copy';
import { importanceLabel, necessityLabel, taskTypeLabel } from '@/features/browse/format';
import { resolveTaskIcon } from '@/features/browse/resolveIcon';
import { FilterChip } from './FilterChip';
import { resultsCountLabel, S14_COPY } from './copy';

const TYPE_OPTIONS: readonly { value: TaskType; label: string }[] = [
  { value: 'routine', label: S14_COPY.typeRoutine },
  { value: 'event', label: S14_COPY.typeEvent },
  { value: 'course', label: S14_COPY.typeCourse },
  { value: 'todo', label: S14_COPY.typeTodo },
];
const IMPORTANCE_OPTIONS: readonly { value: Importance; label: string }[] = [
  { value: 'high', label: S14_COPY.importanceHigh },
  { value: 'med', label: S14_COPY.importanceMed },
  { value: 'low', label: S14_COPY.importanceLow },
];
const NECESSITY_OPTIONS: readonly { value: Necessity; label: string }[] = [
  { value: 'must-do', label: S14_COPY.necessityMustDo },
  { value: 'recommended', label: S14_COPY.necessityRecommended },
  { value: 'optional', label: S14_COPY.necessityOptional },
];

export default function SearchScreen() {
  const t = useTheme();
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const origin = (from as ScreenOrigin | undefined) ?? 'today';
  const goBack = useOriginAwareBack('/today');

  const tasksQuery = useTasks();
  const [query, setQuery] = useState('');
  const [types, setTypes] = useState<readonly TaskType[]>([]);
  const [importances, setImportances] = useState<readonly Importance[]>([]);
  const [necessities, setNecessities] = useState<readonly Necessity[]>([]);

  const all = tasksQuery.data ?? [];
  const nothingToSearchYet = !tasksQuery.isLoading && !tasksQuery.isError && all.length === 0;

  const hasActiveFilters = query.trim().length > 0 || types.length > 0 || importances.length > 0 || necessities.length > 0;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((tk) => {
      if (q && !tk.name.toLowerCase().includes(q)) return false;
      if (types.length > 0 && !types.includes(tk.type)) return false;
      if (importances.length > 0 && (!tk.importance || !importances.includes(tk.importance))) return false;
      if (necessities.length > 0 && (!tk.necessity || !necessities.includes(tk.necessity))) return false;
      return true;
    });
  }, [all, query, types, importances, necessities]);

  function toggle<T>(list: readonly T[], setList: (v: readonly T[]) => void, value: T) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function clearAll() {
    setQuery('');
    setTypes([]);
    setImportances([]);
    setNecessities([]);
  }

  function openResult(tk: TaskWithSteps) {
    if (tk.type === 'routine' && tk.isAsNeeded) {
      router.push(withOrigin(`/task/${tk.id}/as-needed`, 'search') as Href);
      return;
    }
    router.push(withOrigin(`/task/${tk.id}`, 'search') as Href);
  }

  const backLabel = S14_COPY.backLabels[origin as keyof typeof S14_COPY.backLabels] ?? S14_COPY.backLabels.today;

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} accessibilityLabel={backLabel} onPress={goBack} />
        <Text accessibilityRole="header" style={[styles.title, { color: t.color.text }]}>
          {S14_COPY.title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Input label="" accessibilityLabel={S14_COPY.searchPlaceholder} placeholder={S14_COPY.searchPlaceholder} value={query} onChangeText={setQuery} />

        <FilterGroup label={S14_COPY.typeGroupLabel}>
          {TYPE_OPTIONS.map((o) => (
            <FilterChip key={o.value} label={o.label} selected={types.includes(o.value)} onToggle={() => toggle(types, setTypes, o.value)} />
          ))}
        </FilterGroup>
        <FilterGroup label={S14_COPY.importanceGroupLabel}>
          {IMPORTANCE_OPTIONS.map((o) => (
            <FilterChip
              key={o.value}
              label={o.label}
              selected={importances.includes(o.value)}
              onToggle={() => toggle(importances, setImportances, o.value)}
            />
          ))}
        </FilterGroup>
        <FilterGroup label={S14_COPY.necessityGroupLabel}>
          {NECESSITY_OPTIONS.map((o) => (
            <FilterChip
              key={o.value}
              label={o.label}
              selected={necessities.includes(o.value)}
              onToggle={() => toggle(necessities, setNecessities, o.value)}
            />
          ))}
        </FilterGroup>

        {hasActiveFilters ? <Button label={S14_COPY.clearAll} variant="ghost" onPress={clearAll} accessibilityLabel={S14_COPY.clearAll} /> : null}

        {tasksQuery.isLoading ? (
          <View style={styles.list}>
            <Skeleton height={64} />
            <Skeleton height={64} />
          </View>
        ) : tasksQuery.isError ? (
          <InlineRetryBanner message={BROWSE_SHARED_COPY.errorReadFailure} retryLabel={BROWSE_SHARED_COPY.retry} onRetry={() => tasksQuery.refetch()} />
        ) : nothingToSearchYet ? (
          <EmptyState icon={SearchIcon} headline={S14_COPY.nothingToSearchHeadline} subcopy={S14_COPY.nothingToSearchSubcopy} />
        ) : results.length === 0 ? (
          <EmptyState
            icon={SearchIcon}
            headline={S14_COPY.noMatchesHeadline}
            subcopy={S14_COPY.noMatchesSubcopy}
            actionLabel={S14_COPY.clearAll}
            onAction={clearAll}
          />
        ) : (
          <>
            <Text style={[styles.resultsCount, { color: t.color.textMuted }]}>{resultsCountLabel(results.length)}</Text>
            <View style={styles.list}>
              {results.map((tk) => (
                <ResultRow key={tk.id} task={tk} onPress={() => openResult(tk)} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.filterGroup}>
      <Text style={[styles.filterGroupLabel, { color: t.color.text }]}>{label}</Text>
      <View style={styles.chipRow}>{children}</View>
    </View>
  );
}

function ResultRow({ task: tk, onPress }: { task: TaskWithSteps; onPress: () => void }) {
  const t = useTheme();
  const Icon = resolveTaskIcon(tk.icon);
  return (
    <Card onPress={onPress} accessibilityLabel={`${tk.name}, ${taskTypeLabel(tk.type)}`}>
      <View style={styles.rowHeader}>
        <Icon size={22} color={t.color.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
        <Text style={[styles.name, { color: t.color.text }]}>{tk.name}</Text>
      </View>
      <View style={styles.tagRow}>
        <Tag label={taskTypeLabel(tk.type)} />
        {tk.isAsNeeded ? <Tag label={S14_COPY.asNeededTag} /> : null}
        {tk.importance ? <Tag label={importanceLabel(tk.importance)} /> : null}
        {tk.necessity ? <Tag label={necessityLabel(tk.necessity)} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, paddingHorizontal: SPACE.s3, paddingTop: SPACE.s3, paddingBottom: SPACE.s2 },
  title: { fontSize: 20, fontWeight: '700' },
  scrollContent: { padding: SPACE.s3, gap: SPACE.s3 },
  filterGroup: { gap: SPACE.s1 },
  filterGroupLabel: { fontSize: 14, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s1 },
  list: { gap: SPACE.s2 },
  resultsCount: { fontSize: 13 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  name: { fontSize: 16, fontWeight: '600', flex: 1 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s1 },
});
