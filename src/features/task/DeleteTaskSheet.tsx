/**
 * DeleteTaskSheet — S22 delete confirmation as the shared bottom sheet (D3).
 * Names the thing being deleted by its real type (routine / event / course / to-do).
 */
import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';

import { useToastStore } from '@/app-shell';
import { DELETED_KEEP_DAYS } from '@/domain';
import { useDeleteTask, useRestoreTask } from '@/queries';
import type { Id, TaskType } from '@/types';
import { ConfirmSheet, InlineRetryBanner } from '@/ui';

import { confirmedDeleteDestination } from './deleteOrigin';

export const TYPE_NOUN: Record<TaskType, string> = { routine: 'routine', event: 'event', course: 'course', todo: 'to-do' };

export const DELETE_COPY = {
  message: (name: string) =>
    `“${name}” goes to Recently deleted, where you can restore it for ${DELETED_KEEP_DAYS} days. The days you've logged still count in your consistency.`,
  /** Said only for something that can be ended instead. */
  endInstead: (noun: string) => `Only stopping? End the ${noun} instead and it stays in your list.`,
  movedToast: 'Moved to Recently deleted',
  restoredToast: (name: string) => `Restored “${name}”`,
} as const;

export interface DeleteTaskSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly task: { readonly id: Id; readonly name: string; readonly type: TaskType };
  readonly openedFrom: 'manage' | 'as-needed';
  readonly origin?: string;
  /** Called once the delete has gone through, just before leaving the screen. */
  readonly onDeleted?: () => void;
  /** It can be ended instead (a routine, repeating event or course still running): the sheet says so. */
  readonly canEnd?: boolean;
}

export function DeleteTaskSheet({ visible, onClose, task, openedFrom, origin, onDeleted, canEnd = false }: DeleteTaskSheetProps) {
  const router = useRouter();
  const deleteTask = useDeleteTask();
  const restoreTask = useRestoreTask();
  const showToast = useToastStore((s) => s.show);
  const [failed, setFailed] = useState(false);
  const noun = TYPE_NOUN[task.type];
  // A second tap before the sheet re-renders as busy must not run the delete again (it would fail
  // as "already deleted" and show the retry banner on a task that is, in fact, deleted).
  const busy = useRef(false);

  async function confirmDelete() {
    if (busy.current) return;
    busy.current = true;
    setFailed(false);
    const result = await deleteTask.mutateAsync(task.id).catch(() => ({ ok: false as const }));
    busy.current = false;
    if (!result.ok) {
      setFailed(true);
      return;
    }
    onDeleted?.();
    onClose();
    router.replace(confirmedDeleteDestination({ openedFrom, s20Origin: origin, taskType: task.type }) as never);
    // Not final: it is in Recently deleted, and Undo brings it straight back.
    showToast(DELETE_COPY.movedToast, 'neutral', {
      action: {
        label: 'Undo',
        onPress: () =>
          void restoreTask
            .mutateAsync(task.id)
            .then((r) => showToast(r.ok ? DELETE_COPY.restoredToast(task.name) : "Couldn't restore. Try again from Settings > Data.", r.ok ? 'success' : 'warning'))
            .catch(() => showToast("Couldn't restore. Try again from Settings > Data.", 'warning')),
      },
    });
  }

  return (
    <ConfirmSheet
      visible={visible}
      onClose={onClose}
      title={`Delete this ${noun}?`}
      message={canEnd ? `${DELETE_COPY.message(task.name)} ${DELETE_COPY.endInstead(noun)}` : DELETE_COPY.message(task.name)}
      confirmLabel={`Delete ${noun}`}
      onConfirm={confirmDelete}
      danger
      loading={deleteTask.isPending}
      testID="delete-task-sheet"
    >
      {failed ? <InlineRetryBanner message="Couldn't delete. Try again." onRetry={confirmDelete} tone="warning" /> : null}
    </ConfirmSheet>
  );
}
