/**
 * S13 — To-dos & Notes Browse. F11.
 *
 * SPEC GAP (flagged in the M3 build report): `Task`/`docs/SCHEMA.md` carry no boolean
 * distinguishing a "to-do" sub-kind from a "note" sub-kind within `type: 'todo'` — S19's own
 * create form is one shared flow for both with no such toggle either. Absent that field, this
 * screen partitions on `note` body presence (a task with note text renders as a checkbox-less
 * Note row using that text as its preview, per the design's own Note example; a task with no
 * note body renders as a checkable To-do row). This is a heuristic, not a schema fact — a
 * to-do that legitimately carries an optional note (S19 allows it) will misclassify as a Note
 * under this rule. Flagged for M4/architect: an explicit `Task.isNote` (or similar) column
 * would remove the ambiguity.
 */
import { useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { StickyNote } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { now } from '@/lib/date';
import { useTasks, useUpdateTask } from '@/queries';
import { ROUTES, withOrigin } from '@/navigation';
import { SPACE, useTheme } from '@/theme';
import { Card, Checkbox, EmptyState, InlineRetryBanner, Skeleton, Tabs, Tag } from '@/ui';
import type { Id, TaskWithSteps } from '@/types';

import { S13_COPY } from './copy';
import { importanceLabel } from './format';
import { Fab, FAB_CLEARANCE } from './Fab';
import { BrowseHeader } from './BrowseHeader';

type Lens = 'todos' | 'notes';

function isNote(tk: TaskWithSteps): boolean {
  return !!tk.note && tk.note.trim().length > 0;
}

export default function ToDosBrowseScreen() {
  const t = useTheme();
  const router = useRouter();
  const tasksQuery = useTasks({ type: 'todo' });
  const updateTask = useUpdateTask();
  const [lens, setLens] = useState<Lens>('todos');

  const all = tasksQuery.data ?? [];
  const shown = lens === 'todos' ? all.filter((tk) => !isNote(tk)) : all.filter(isNote);
  const isEmpty = !tasksQuery.isLoading && !tasksQuery.isError && shown.length === 0;

  function openTask(id: string) {
    router.push(withOrigin(`/task/${id}`, 'todos') as Href);
  }

  async function toggleDone(tk: TaskWithSteps) {
    await updateTask.mutateAsync({ id: tk.id as Id, patch: { todoDoneAt: tk.todoDoneAt ? null : now() } });
  }

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <BrowseHeader title={S13_COPY.title} onSearch={() => router.push(withOrigin(ROUTES.search, 'todos') as Href)} />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: FAB_CLEARANCE }]}>
        <Tabs
          items={[
            { value: 'todos', label: S13_COPY.todosLens },
            { value: 'notes', label: S13_COPY.notesLens },
          ]}
          value={lens}
          onChange={(v) => setLens(v as Lens)}
          accessibilityLabel="To-dos or Notes"
        />

        {tasksQuery.isLoading ? (
          <View style={styles.list}>
            <Skeleton height={56} />
            <Skeleton height={56} />
            <Skeleton height={56} />
          </View>
        ) : tasksQuery.isError ? (
          <InlineRetryBanner message="Couldn’t load this list. Your data is safe on this device." retryLabel="Retry" onRetry={() => tasksQuery.refetch()} />
        ) : isEmpty ? (
          <EmptyState
            icon={StickyNote}
            headline={lens === 'todos' ? S13_COPY.emptyTodosHeadline : S13_COPY.emptyNotesHeadline}
            subcopy={lens === 'todos' ? S13_COPY.emptyTodosSubcopy : S13_COPY.emptyNotesSubcopy}
            actionLabel={S13_COPY.newTodoOrNote}
            onAction={() => router.push(ROUTES.addTodo as Href)}
          />
        ) : (
          <View style={styles.list}>
            {shown.map((tk) =>
              lens === 'todos' ? (
                <Card key={tk.id} onPress={() => openTask(tk.id)} accessibilityLabel={tk.name}>
                  <View style={styles.todoRow}>
                    <Checkbox
                      checked={!!tk.todoDoneAt}
                      onToggle={() => toggleDone(tk)}
                      label={tk.name}
                      strikethrough
                      testID={`todo-checkbox-${tk.id}`}
                    />
                  </View>
                  {tk.importance ? (
                    <View style={styles.tagRow}>
                      <Tag label={importanceLabel(tk.importance)} />
                    </View>
                  ) : null}
                </Card>
              ) : (
                <Card key={tk.id} onPress={() => openTask(tk.id)} accessibilityLabel={`${tk.name}, ${tk.note}`}>
                  <Text style={[styles.name, { color: t.color.text }]}>{tk.name}</Text>
                  <Text numberOfLines={1} style={[styles.preview, { color: t.color.textMuted }]}>
                    {tk.note}
                  </Text>
                  {tk.importance ? (
                    <View style={styles.tagRow}>
                      <Tag label={importanceLabel(tk.importance)} />
                    </View>
                  ) : null}
                </Card>
              ),
            )}
          </View>
        )}
      </ScrollView>
      <Fab onPress={() => router.push(ROUTES.addPickType as Href)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { padding: SPACE.s3, gap: SPACE.s3 },
  list: { gap: SPACE.s2 },
  todoRow: { flexDirection: 'row', alignItems: 'center' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s1 },
  name: { fontSize: 16, fontWeight: '600' },
  preview: { fontSize: 14, lineHeight: 20 },
});
