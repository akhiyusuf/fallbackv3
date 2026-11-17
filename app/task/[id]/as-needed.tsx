/**
 * S23 — as-needed routine. Same page shape as every task screen (D5): back
 * chevron, coloured icon, name as title, "···" menu. "Log used it" is the
 * pinned action (D8); the version chooser and the editor are sheets (D3).
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MoreHorizontal, Palette, PencilLine, Trash2 } from 'lucide-react-native';

import { FONT_SIZE, SPACE, useTheme } from '@/theme';
import { Button, ButtonPair, Dialog, EmptyLine, IconButton, Input, ListGroup, ListRow, LogButtons, MenuSheet, Screen, SectionHeading, Skeleton, TaskIcon } from '@/ui';
import { ROUTES, useOriginAwareBack } from '@/navigation';
import { useLogAsNeededUse, useTask, useUpdateTask } from '@/queries';
import { useToastStore } from '@/app-shell/stores/toast';
import { today as todayFn } from '@/lib/date';
import { newId } from '@/lib/id';
import type { Id } from '@/types';
import { taskColor } from '@/features/browse/resolveIcon';
import { useAsNeededHistory } from '@/features/task/useAsNeededHistory';
import { shortDateLabel } from '@/features/task/dateLabel';
import { DeleteTaskSheet } from '@/features/task/DeleteTaskSheet';
import { SAVE_FAILED } from '@/features/task/formShared';
import { iconByName } from '@/features/task/iconCatalog';
import { MetaLine, PlanTiles, metaParts } from '@/features/task/TaskDetails';
import { Text } from '@/ui/AppText';

export default function S23AsNeededRoutineDetail() {
  const t = useTheme();
  const router = useRouter();
  const { id, from, confirmDelete } = useLocalSearchParams<{ id: string; from?: string; confirmDelete?: string }>();
  const taskId = id as Id;
  const goBack = useOriginAwareBack(ROUTES.routines);
  const taskQuery = useTask(taskId);
  const historyQuery = useAsNeededHistory(taskId);
  const updateTask = useUpdateTask();
  const logUse = useLogAsNeededUse();
  const showToast = useToastStore((s) => s.show);

  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftIdeal, setDraftIdeal] = useState('');
  const [draftFallback, setDraftFallback] = useState('');
  const [chooserOpen, setChooserOpen] = useState(false);

  useEffect(() => {
    if (confirmDelete === '1') setDeleteOpen(true);
  }, [confirmDelete]);

  const task = taskQuery.data;

  function startEdit() {
    if (!task) return;
    setDraftName(task.name);
    setDraftIdeal(task.idealSteps[0]?.text ?? '');
    setDraftFallback(task.fallbackSteps[0]?.text ?? '');
    setEditing(true);
  }

  async function saveEdit() {
    const name = draftName.trim();
    if (name.length === 0) {
      showToast('Give this routine a name to save it.', 'warning');
      return;
    }
    const result = await updateTask.mutateAsync({
      id: taskId,
      patch: { name },
      steps: [
        ...(draftIdeal.trim() ? [{ id: task?.idealSteps[0]?.id ?? newId(), taskId, role: 'ideal' as const, text: draftIdeal, position: 0, dueWeekdays: null }] : []),
        ...(draftFallback.trim()
          ? [{ id: task?.fallbackSteps[0]?.id ?? newId(), taskId, role: 'fallback' as const, text: draftFallback, position: 0, dueWeekdays: null }]
          : []),
      ],
    });
    if (result.ok) setEditing(false);
    else showToast(SAVE_FAILED, 'warning');
  }

  async function logUsedIt(marker: 'ideal' | 'fallback' | null) {
    const result = await logUse.mutateAsync({ taskId, date: todayFn(), marker });
    setChooserOpen(false);
    if (result.ok) {
      await historyQuery.refetch();
      showToast('Logged to history', 'success', { icon: marker === 'fallback' ? 'fallback' : 'ideal' });
    } else {
      showToast(SAVE_FAILED, 'warning');
    }
  }

  function onLogPress() {
    if (!task) return;
    if (task.idealSteps.length > 0 || task.fallbackSteps.length > 0) setChooserOpen(true);
    else void logUsedIt(null);
  }

  if (taskQuery.isLoading || !task) {
    return (
      <Screen onBack={goBack}>
        <Skeleton height={28} width="60%" />
        <Skeleton height={80} radius={16} />
        <Skeleton height={120} radius={16} />
      </Screen>
    );
  }

  const history = [...(historyQuery.data ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <Screen
      title={task.name}
      onBack={goBack}
      leading={<TaskIcon icon={iconByName(task.icon)} color={taskColor(task.color)} size={36} />}
      right={<IconButton icon={MoreHorizontal} onPress={() => setMenuOpen(true)} accessibilityLabel="More actions" />}
      footer={<Button label="Log used it" onPress={onLogPress} loading={logUse.isPending} accessibilityLabel="Log used it" fullWidth />}
    >
      <MetaLine parts={metaParts({ schedule: 'Routine · As-needed', importance: task.importance, necessity: task.necessity })} />
      <PlanTiles ideal={task.idealSteps[0]?.text} fallback={task.fallbackSteps[0]?.text} numberOfLines={3} />

      <View style={styles.block}>
        <SectionHeading>History</SectionHeading>
        {history.length === 0 ? (
          <EmptyLine>Not used yet. There is no schedule and no consistency score — log it whenever the situation comes up.</EmptyLine>
        ) : (
          <ListGroup>
            {history.map((u) => (
              <ListRow key={u.id} label={shortDateLabel(u.date)} value={u.marker ? (u.marker === 'ideal' ? 'Ideal' : 'Fallback') : 'Used'} />
            ))}
          </ListGroup>
        )}
      </View>

      <MenuSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={task.name}
        items={[
          { key: 'edit', icon: PencilLine, label: 'Edit', onPress: startEdit },
          { key: 'icon', icon: Palette, label: 'Change icon and colour', opensScreen: true, onPress: () => router.push(`/task/${taskId}/icon` as never) },
          { key: 'delete', icon: Trash2, label: 'Delete routine', danger: true, onPress: () => setDeleteOpen(true) },
        ]}
      />

      <Dialog visible={chooserOpen} onClose={() => setChooserOpen(false)} title="Which version did you do?" accessibilityLabel="Which version did you do?">
        <LogButtons
          value={null}
          onChange={(chip) => void logUsedIt(chip === 'fallback' ? 'fallback' : 'ideal')}
          accessibilityLabel={task.name}
          idealHint={task.idealSteps[0]?.text}
          fallbackHint={task.fallbackSteps[0]?.text}
          hideSkip
        />
      </Dialog>

      <Dialog visible={editing} onClose={() => setEditing(false)} title="Edit routine" accessibilityLabel="Edit routine">
        <Input label="Name" value={draftName} onChangeText={setDraftName} accessibilityLabel="Name" />
        <Input label="Ideal (optional)" value={draftIdeal} onChangeText={setDraftIdeal} accessibilityLabel="Ideal" />
        <Input label="Fallback (optional)" value={draftFallback} onChangeText={setDraftFallback} accessibilityLabel="Fallback" />
        <Text style={[styles.caption, { color: t.color.textMuted }]}>Ideal and fallback are a reference here. As-needed routines are never scored.</Text>
        <ButtonPair primary={{ label: 'Save', onPress: () => void saveEdit(), loading: updateTask.isPending }} secondary={{ label: 'Cancel', onPress: () => setEditing(false) }} />
      </Dialog>

      <DeleteTaskSheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} task={task} openedFrom="as-needed" origin={from ?? 'routines'} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: SPACE.s2 + 4 },
  caption: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
});
