/** M3 — S13 To-dos. Segmented To-dos/Notes (D9); rows in one grouped list (D7). */
import { play } from '@/services/sfx';
import { useState } from 'react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Check, StickyNote } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { now } from '@/lib/date';
import { useToastStore } from '@/app-shell';
import { useTasks, useUpdateTask } from '@/queries';
import { ROUTES, withOrigin } from '@/navigation';
import { RADIUS, SPACE, useTheme } from '@/theme';
import { EmptyLine, EmptyState, InlineRetryBanner, ListGroup, ListRow, Skeleton, TabSummary, Tabs } from '@/ui';
import type { Id, Instant, TaskWithSteps } from '@/types';

import { BROWSE_SHARED_COPY, S13_COPY } from './copy';
import { importanceLabel } from './format';
import { Fab, FAB_CLEARANCE } from './Fab';
import { BrowseHeader } from './BrowseHeader';
import { SAVE_FAILED } from '@/features/task/formShared';

type Lens = 'todos' | 'notes';

function isNote(tk: TaskWithSteps): boolean {
  return tk.isNote;
}

export default function ToDosBrowseScreen() {
  const t = useTheme();
  const router = useRouter();
  const tasksQuery = useTasks({ type: 'todo' });
  const updateTask = useUpdateTask();
  const showToast = useToastStore((s) => s.show);
  const params = useLocalSearchParams<{ lens?: string }>();
  const [lens, setLens] = useState<Lens>(params.lens === 'notes' ? 'notes' : 'todos');

  const all = tasksQuery.data ?? [];
  const shown = lens === 'todos' ? all.filter((tk) => !isNote(tk)) : all.filter(isNote);
  const todos = all.filter((tk) => !isNote(tk));
  const todosDone = todos.filter((tk) => !!tk.todoDoneAt).length;
  const todosOpen = todos.length - todosDone;
  const highOpen = todos.filter((tk) => !tk.todoDoneAt && tk.importance === 'high').length;
  const nothingAtAll = !tasksQuery.isLoading && !tasksQuery.isError && all.length === 0;

  function openTask(id: string) {
    router.push(withOrigin(`/task/${id}`, 'todos') as Href);
  }

  async function toggleDone(tk: TaskWithSteps) {
    const wasDone = !!tk.todoDoneAt;
    // A write that throws is a failed save like any other: say so instead of leaving the box unchanged in silence.
    const write = (todoDoneAt: Instant | null) => updateTask.mutateAsync({ id: tk.id as Id, patch: { todoDoneAt } }).catch(() => ({ ok: false as const }));
    const result = await write(wasDone ? null : now());
    if (!result.ok) return showToast(SAVE_FAILED, 'warning');
    if (wasDone) return;
    play('todo_done');
    // Ticking is one tap, so a slip has to be one tap to take back.
    showToast('Done', 'success', {
      icon: 'ideal',
      action: {
        label: 'Undo',
        onPress: () =>
          void write(null).then((undone) => {
            if (!undone.ok) showToast(SAVE_FAILED, 'warning');
          }),
      },
    });
  }

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <BrowseHeader title={S13_COPY.title} onSearch={() => router.push(withOrigin(ROUTES.search, 'todos') as Href)} />
      <ScrollView alwaysBounceVertical={false} overScrollMode="auto" contentContainerStyle={[styles.scrollContent, { paddingBottom: nothingAtAll ? SPACE.s2 : FAB_CLEARANCE + SPACE.s4 }]} showsVerticalScrollIndicator={false}>
        {tasksQuery.isLoading ? (
          <Skeleton height={168} radius={20} />
        ) : tasksQuery.isError ? (
          <InlineRetryBanner message={BROWSE_SHARED_COPY.errorReadFailure} retryLabel={BROWSE_SHARED_COPY.retry} onRetry={() => tasksQuery.refetch()} />
        ) : nothingAtAll ? (
          <EmptyState
            icon={StickyNote}
            headline={S13_COPY.emptyTodosHeadline}
            subcopy={S13_COPY.emptyTodosSubcopy}
            actionLabel={S13_COPY.newTodoOrNote}
            onAction={() => router.push(ROUTES.addTodo as Href)}
          />
        ) : (
          <>
            <Tabs
              items={[
                { value: 'todos', label: S13_COPY.todosLens },
                { value: 'notes', label: S13_COPY.notesLens },
              ]}
              value={lens}
              onChange={(v) => setLens(v as Lens)}
              accessibilityLabel="To-dos or notes"
            />
            {lens === 'todos' && todos.length > 0 ? (
              <TabSummary
                mark={{ kind: 'ring', done: todosDone, total: todos.length }}
                title={todosOpen === 0 ? 'Everything ticked off' : `${todosOpen} left to do`}
                detail={highOpen > 0 ? `${highOpen} marked high importance` : undefined}
                testID="todos-summary"
              />
            ) : null}
            {shown.length === 0 ? (
              <EmptyLine>{lens === 'todos' ? 'No to-dos right now.' : `${S13_COPY.emptyNotesHeadline} ${S13_COPY.emptyNotesSubcopy}`}</EmptyLine>
            ) : (
              <ListGroup>
                {shown.map((tk) =>
                  lens === 'todos' ? (
                    <ListRow
                      key={tk.id}
                      leading={
                        <Pressable
                          onPress={() => void toggleDone(tk)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: !!tk.todoDoneAt }}
                          accessibilityLabel={tk.name}
                          hitSlop={10}
                          testID={`todo-checkbox-${tk.id}`}
                          style={[
                            styles.check,
                            { borderColor: tk.todoDoneAt ? t.color.ideal : t.color.borderStrong, backgroundColor: tk.todoDoneAt ? t.color.ideal : 'transparent' },
                          ]}
                        >
                          {tk.todoDoneAt ? <Check size={16} color={t.color.iconOnSignal} /> : null}
                        </Pressable>
                      }
                      label={tk.name}
                      sublabel={(tk.note ?? '').split('\n')[0] || undefined}
                      value={tk.importance ? `${importanceLabel(tk.importance)} importance` : undefined}
                      onPress={() => openTask(tk.id)}
                    />
                  ) : (
                    <ListRow
                      key={tk.id}
                      icon={StickyNote}
                      label={tk.name}
                      sublabel={(tk.note ?? '').split('\n')[0] || undefined}
                      onPress={() => openTask(tk.id)}
                    />
                  ),
                )}
              </ListGroup>
            )}
          </>
        )}
      </ScrollView>
      {nothingAtAll ? null : <Fab
          accessibilityLabel={lens === 'notes' ? 'New note' : 'New to-do'}
          onPress={() => router.push(withOrigin(lens === 'notes' ? `${ROUTES.addTodo}?kind=note` : ROUTES.addTodo, 'todos') as Href)}
        />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: SPACE.s3, paddingTop: SPACE.s2, gap: SPACE.s3 },
  check: { width: 28, height: 28, borderRadius: RADIUS.pill, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
});
