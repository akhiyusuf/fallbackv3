/**
 * DeleteTaskSheet — S22 delete confirmation as the shared bottom sheet (D3).
 * Names the thing being deleted by its real type (routine / event / course / to-do).
 */
import { useState } from 'react';
import { useRouter } from 'expo-router';

import { useDeleteTask } from '@/queries';
import type { Id, TaskType } from '@/types';
import { ConfirmSheet, InlineRetryBanner } from '@/ui';

import { confirmedDeleteDestination } from './deleteOrigin';

export const TYPE_NOUN: Record<TaskType, string> = { routine: 'routine', event: 'event', course: 'course', todo: 'to-do' };

export interface DeleteTaskSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly task: { readonly id: Id; readonly name: string; readonly type: TaskType };
  readonly openedFrom: 'manage' | 'as-needed';
  readonly origin?: string;
}

export function DeleteTaskSheet({ visible, onClose, task, openedFrom, origin }: DeleteTaskSheetProps) {
  const router = useRouter();
  const deleteTask = useDeleteTask();
  const [failed, setFailed] = useState(false);
  const noun = TYPE_NOUN[task.type];

  async function confirmDelete() {
    setFailed(false);
    const result = await deleteTask.mutateAsync(task.id);
    if (!result.ok) {
      setFailed(true);
      return;
    }
    onClose();
    router.replace(confirmedDeleteDestination({ openedFrom, s20Origin: origin, taskType: task.type }) as never);
  }

  return (
    <ConfirmSheet
      visible={visible}
      onClose={onClose}
      title={`Delete this ${noun}?`}
      message={`“${task.name}” and its history will be removed. This can't be undone.`}
      confirmLabel={`Delete ${noun}`}
      onConfirm={confirmDelete}
      danger
      loading={deleteTask.isPending}
      testID="delete-task-sheet"
    >
      {failed ? <InlineRetryBanner message="Couldn't delete — try again." onRetry={confirmDelete} tone="warning" /> : null}
    </ConfirmSheet>
  );
}
