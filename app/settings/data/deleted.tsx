/**
 * Recently deleted. A deleted routine, event, course or to-do waits here, with its history, for
 * DELETED_KEEP_DAYS days. From here it can be restored, deleted for good one at a time, or all at
 * once. Past its time it is removed when the app next opens (or when this screen loads).
 */
import { useRef, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { format } from 'date-fns';

import { useToastStore } from '@/app-shell';
import { DELETED_KEEP_DAYS, daysLeft } from '@/domain';
import { taskTypeLabel } from '@/features/browse/format';
import { taskIconProps } from '@/features/browse/resolveIcon';
import { ROUTES } from '@/navigation';
import { useDeleteForever, useEmptyRecentlyDeleted, useRecentlyDeleted, useRestoreTask } from '@/queries';
import { now } from '@/lib/date';
import { FONT_SIZE, SPACE, useTheme } from '@/theme';
import type { Instant, TaskWithSteps } from '@/types';
import { Button, ConfirmSheet, Dialog, EmptyLine, InlineRetryBanner, ListGroup, ListRow, Screen, TaskIcon } from '@/ui';
import { Trash2 } from 'lucide-react-native';
import { Text } from '@/ui/AppText';

export const DELETED_COPY = {
  title: 'Recently deleted',
  intro: `Things you delete stay here for ${DELETED_KEEP_DAYS} days with their history. Restore one, or delete it for good.`,
  empty: `Nothing here. Things you delete wait here for ${DELETED_KEEP_DAYS} days before they're gone.`,
  daysLeft: (n: number) => (n <= 1 ? 'Last day' : `${n} days left`),
  sheetBody: (deletedOn: string, goneOn: string) => `Deleted ${deletedOn}. Unless you restore it, it's removed for good on ${goneOn}.`,
  restore: 'Restore',
  deleteForever: 'Delete forever',
  restoredToast: (name: string) => `Restored “${name}”`,
  confirmOneTitle: (name: string) => `Delete “${name}” forever?`,
  confirmOneBody: "Its history goes with it. This can't be undone. XP you earned with it stays.",
  deleteAll: 'Delete all forever',
  confirmAllTitle: (n: number) => `Delete ${n} ${n === 1 ? 'item' : 'items'} forever?`,
  confirmAllBody: "Everything here, with its history. This can't be undone. XP you earned with them stays.",
  deletedToast: 'Deleted for good',
  failed: "Couldn't do that. Try again.",
  loadFailed: "Couldn't load Recently deleted.",
} as const;

export default function RecentlyDeletedScreen() {
  const t = useTheme();
  const router = useRouter();
  const showToast = useToastStore((s) => s.show);
  const deletedQuery = useRecentlyDeleted();
  const restore = useRestoreTask();
  const deleteForever = useDeleteForever();
  const emptyAll = useEmptyRecentlyDeleted();

  const [selected, setSelected] = useState<TaskWithSteps | null>(null);
  const [confirmOne, setConfirmOne] = useState<TaskWithSteps | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const items = deletedQuery.data ?? [];
  const nowIso = now();

  // One action at a time: a second tap before the screen shows "busy" would run it again, find the
  // item already gone, and replace the success message with "Couldn't do that".
  const busy = useRef(false);

  async function handleRestore(task: TaskWithSteps) {
    if (busy.current) return;
    busy.current = true;
    setSelected(null);
    const result = await restore.mutateAsync(task.id).catch(() => ({ ok: false as const }));
    busy.current = false;
    showToast(result.ok ? DELETED_COPY.restoredToast(task.name) : DELETED_COPY.failed, result.ok ? 'success' : 'warning');
  }

  async function handleDeleteOne(task: TaskWithSteps) {
    if (busy.current) return;
    busy.current = true;
    const result = await deleteForever.mutateAsync(task.id).catch(() => ({ ok: false as const }));
    busy.current = false;
    setConfirmOne(null);
    showToast(result.ok ? DELETED_COPY.deletedToast : DELETED_COPY.failed, result.ok ? 'neutral' : 'warning');
  }

  async function handleDeleteAll() {
    if (busy.current) return;
    busy.current = true;
    const result = await emptyAll.mutateAsync().catch(() => ({ ok: false as const }));
    busy.current = false;
    setConfirmAll(false);
    showToast(result.ok ? DELETED_COPY.deletedToast : DELETED_COPY.failed, result.ok ? 'neutral' : 'warning');
  }

  return (
    <Screen title={DELETED_COPY.title} onBack={() => router.replace(ROUTES.settingsData as Href)}>
      <Text style={[styles.intro, { color: t.color.textMuted }]}>{DELETED_COPY.intro}</Text>

      {deletedQuery.isError ? (
        <InlineRetryBanner message={DELETED_COPY.loadFailed} onRetry={() => void deletedQuery.refetch()} />
      ) : deletedQuery.isLoading ? null : items.length === 0 ? (
        <EmptyLine>{DELETED_COPY.empty}</EmptyLine>
      ) : (
        <>
          <ListGroup>
            {items.map((task) => {
              const icon = taskIconProps(task);
              const left = task.deletedAt ? daysLeft(task.deletedAt, nowIso) : DELETED_KEEP_DAYS;
              return (
                <ListRow
                  key={task.id}
                  leading={<TaskIcon icon={icon.icon} color={icon.color} muted />}
                  label={task.name}
                  sublabel={`${taskTypeLabel(task.type)} · ${DELETED_COPY.daysLeft(left)}`}
                  onPress={() => setSelected(task)}
                  accessibilityLabel={`${task.name}, ${taskTypeLabel(task.type)}, ${DELETED_COPY.daysLeft(left)}. Restore or delete forever`}
                  testID={`deleted-row-${task.id}`}
                />
              );
            })}
          </ListGroup>
          <ListGroup>
            <ListRow icon={Trash2} label={DELETED_COPY.deleteAll} danger onPress={() => setConfirmAll(true)} chevron={false} testID="deleted-delete-all" />
          </ListGroup>
        </>
      )}

      <Dialog visible={selected !== null} onClose={() => setSelected(null)} title={selected?.name} accessibilityLabel={selected?.name ?? DELETED_COPY.title} showClose testID="deleted-item-sheet">
        {selected ? (
          <View style={styles.sheet}>
            <Text style={[styles.sheetBody, { color: t.color.textMuted }]}>{sheetLine(selected.deletedAt)}</Text>
            <Button label={DELETED_COPY.restore} onPress={() => void handleRestore(selected)} fullWidth loading={restore.isPending} />
            <Button
              label={DELETED_COPY.deleteForever}
              variant="danger"
              onPress={() => {
                setConfirmOne(selected);
                setSelected(null);
              }}
              fullWidth
            />
          </View>
        ) : null}
      </Dialog>

      <ConfirmSheet
        visible={confirmOne !== null}
        onClose={() => setConfirmOne(null)}
        title={confirmOne ? DELETED_COPY.confirmOneTitle(confirmOne.name) : ''}
        message={DELETED_COPY.confirmOneBody}
        confirmLabel={DELETED_COPY.deleteForever}
        onConfirm={() => (confirmOne ? void handleDeleteOne(confirmOne) : undefined)}
        danger
        loading={deleteForever.isPending}
        testID="deleted-confirm-one"
      />
      <ConfirmSheet
        visible={confirmAll}
        onClose={() => setConfirmAll(false)}
        title={DELETED_COPY.confirmAllTitle(items.length)}
        message={DELETED_COPY.confirmAllBody}
        confirmLabel={DELETED_COPY.deleteAll}
        onConfirm={() => void handleDeleteAll()}
        danger
        loading={emptyAll.isPending}
        testID="deleted-confirm-all"
      />
    </Screen>
  );
}

function sheetLine(deletedAt: Instant | null): string {
  if (!deletedAt) return '';
  const deleted = new Date(deletedAt);
  const gone = new Date(deleted.getTime() + DELETED_KEEP_DAYS * 24 * 60 * 60 * 1000);
  return DELETED_COPY.sheetBody(format(deleted, 'MMM d'), format(gone, 'MMM d'));
}

const styles = StyleSheet.create({
  intro: { fontSize: FONT_SIZE.sm, lineHeight: 20, marginBottom: SPACE.s3 },
  sheet: { gap: SPACE.s2 + 4 },
  sheetBody: { fontSize: FONT_SIZE.sm, lineHeight: 20, marginBottom: SPACE.s1 },
});
