/**
 * S23 — As-Needed Routine Detail    route: /task/:id/as-needed
 * Owner: M4. Features: F27.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S23)
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Inbox } from 'lucide-react-native';

import { SPACE, useTheme } from '@/theme';
import { Button, Card, EmptyState, IconButton, Input, Skeleton, Tag, Textarea } from '@/ui';
import { ROUTES, useOriginAwareBack } from '@/navigation';
import { useLogAsNeededUse, useTask, useUpdateTask } from '@/queries';
import { useToastStore } from '@/app-shell/stores/toast';
import { today as todayFn } from '@/lib/date';
import { newId } from '@/lib/id';
import type { Id } from '@/types';
import { useAsNeededHistory } from '@/features/task/useAsNeededHistory';
import { shortDateLabel } from '@/features/task/dateLabel';
import { iconByName } from '@/features/task/iconCatalog';

export default function S23AsNeededRoutineDetail() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const taskId = id as Id;
  const goBack = useOriginAwareBack(ROUTES.routines);
  const { from } = useLocalSearchParams<{ from?: string }>();

  const taskQuery = useTask(taskId);
  const historyQuery = useAsNeededHistory(taskId);
  const updateTask = useUpdateTask();
  const logUse = useLogAsNeededUse();
  const showToast = useToastStore((s) => s.show);

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftIdeal, setDraftIdeal] = useState('');
  const [draftFallback, setDraftFallback] = useState('');
  const [chooserOpen, setChooserOpen] = useState(false);

  const task = taskQuery.data;

  function startEdit() {
    if (!task) return;
    setDraftName(task.name);
    setDraftIdeal(task.idealSteps[0]?.text ?? '');
    setDraftFallback(task.fallbackSteps[0]?.text ?? '');
    setEditing(true);
  }

  async function saveEdit() {
    const result = await updateTask.mutateAsync({
      id: taskId,
      patch: { name: draftName },
      steps: [
        ...(draftIdeal.trim()
          ? [{ id: task?.idealSteps[0]?.id ?? newId(), taskId, role: 'ideal' as const, text: draftIdeal, position: 0, dueWeekdays: null }]
          : []),
        ...(draftFallback.trim()
          ? [{ id: task?.fallbackSteps[0]?.id ?? newId(), taskId, role: 'fallback' as const, text: draftFallback, position: 0, dueWeekdays: null }]
          : []),
      ],
    });
    if (result.ok) {
      setEditing(false);
    } else {
      showToast("Couldn't save that — try again.", 'warning');
    }
  }

  async function logUsedIt(marker: 'ideal' | 'fallback' | null) {
    const result = await logUse.mutateAsync({ taskId, date: todayFn(), marker });
    setChooserOpen(false);
    if (result.ok) {
      // `useLogAsNeededUse`'s own invalidation only covers `QUERY_KEYS.task` — this screen's
      // history read is the local `useAsNeededHistory` stop-gap (see that file's header), not
      // yet wired into the shared invalidation map, so it refetches itself here.
      await historyQuery.refetch();
      showToast('Logged to history');
    } else {
      showToast("Couldn't save that — try again.", 'warning');
    }
  }

  function onLogPress() {
    if (!task) return;
    const hasReference = task.idealSteps.length > 0 || task.fallbackSteps.length > 0;
    if (hasReference) {
      setChooserOpen(true);
    } else {
      logUsedIt(null);
    }
  }

  function onDelete() {
    router.push(`/task/${taskId}/delete?openedFrom=as-needed&origin=${from ?? 'routines'}` as never);
  }

  if (taskQuery.isLoading || !task) {
    return (
      <ScrollView style={[styles.root, { backgroundColor: t.color.bg }]} contentContainerStyle={styles.content}>
        <Skeleton height={28} width="60%" />
        <Skeleton height={80} />
        <Skeleton height={120} />
      </ScrollView>
    );
  }

  const Icon = iconByName(task.icon);
  const history = historyQuery.data ?? [];

  return (
    <ScrollView style={[styles.root, { backgroundColor: t.color.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={goBack} accessibilityLabel="Back" />
        <View style={[styles.avatar, { backgroundColor: t.color.surface }]}>
          <Icon size={22} color={t.color.text} />
        </View>
        {editing ? (
          <Input label="Name" value={draftName} onChangeText={setDraftName} accessibilityLabel="Name" />
        ) : (
          <Text accessibilityRole="header" style={[styles.title, { color: t.color.text }]}>
            {task.name}
          </Text>
        )}
      </View>
      <Tag label="As-needed routine" />

      {editing ? (
        <View style={styles.editFields}>
          <Input label="Ideal (optional)" value={draftIdeal} onChangeText={setDraftIdeal} accessibilityLabel="Ideal" />
          <Textarea label="Fallback (optional)" value={draftFallback} onChangeText={setDraftFallback} accessibilityLabel="Fallback" />
        </View>
      ) : task.idealSteps.length > 0 || task.fallbackSteps.length > 0 ? (
        <Card accessibilityLabel="Reference">
          {task.idealSteps[0] ? (
            <Text style={{ color: t.color.text }}>Ideal — {task.idealSteps[0].text}</Text>
          ) : null}
          {task.fallbackSteps[0] ? (
            <Text style={{ color: t.color.text }}>Fallback — {task.fallbackSteps[0].text}</Text>
          ) : null}
        </Card>
      ) : null}

      {chooserOpen ? (
        <Card accessibilityLabel="Which version did you do?">
          <Text style={{ color: t.color.text, fontWeight: '600' }}>Which version did you do?</Text>
          <View style={styles.chooserRow}>
            <Button label="Ideal" onPress={() => logUsedIt('ideal')} variant="secondary" accessibilityLabel="Ideal" />
            <Button label="Fallback" onPress={() => logUsedIt('fallback')} variant="secondary" accessibilityLabel="Fallback" />
          </View>
        </Card>
      ) : (
        <Button label="Log used it" onPress={onLogPress} accessibilityLabel="Log used it" fullWidth />
      )}

      <Text accessibilityRole="header" style={[styles.sectionHeading, { color: t.color.text }]}>
        History
      </Text>
      {history.length === 0 ? (
        <EmptyState
          icon={Inbox}
          headline="Not used yet"
          subcopy="This routine has no schedule and no consistency score — log it whenever the situation comes up."
        />
      ) : (
        <View style={styles.historyList}>
          {[...history]
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .map((u) => (
              <View key={u.id} style={styles.historyRow}>
                <Text style={{ color: t.color.text }}>
                  Used · {shortDateLabel(u.date)}
                  {u.marker ? ` · ${u.marker === 'ideal' ? 'Ideal' : 'Fallback'}` : ''}
                </Text>
              </View>
            ))}
        </View>
      )}

      <View style={styles.footer}>
        {editing ? (
          <>
            <Button label="Save" onPress={saveEdit} accessibilityLabel="Save" />
            <Button label="Cancel" onPress={() => setEditing(false)} variant="ghost" accessibilityLabel="Cancel" />
          </>
        ) : (
          <>
            <Button label="Edit" onPress={startEdit} variant="secondary" accessibilityLabel="Edit" />
            <Button label="Delete routine" onPress={onDelete} variant="danger" accessibilityLabel="Delete routine" />
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.s3, gap: SPACE.s3 },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', flexShrink: 1 },
  editFields: { gap: SPACE.s2 },
  chooserRow: { flexDirection: 'row', gap: SPACE.s2 },
  sectionHeading: { fontSize: 16, fontWeight: '700' },
  historyList: { gap: SPACE.s1 },
  historyRow: { paddingVertical: SPACE.s1 },
  footer: { flexDirection: 'row', gap: SPACE.s2, marginTop: SPACE.s3 },
});
