/**
 * Pushes today's occurrence of a habit to tomorrow (the data model's snooze: one hop, to the next
 * day only). Used by the "Push to tomorrow" link on Today's cards; the task's own page has the
 * same action in its list. A push that cannot happen (already pushed once, or the habit is set
 * not to move) says why, calmly. Undo puts it back.
 */
import { useToastStore } from '@/app-shell';
import { useSnoozeOccurrence, useUndoSnooze } from '@/queries';
import { play } from '@/services/sfx';
import type { Id, LocalDate } from '@/types';

import { SAVE_FAILED } from './formShared';

export const PUSH_COPY = {
  toast: 'Pushed to tomorrow',
  already: 'Already pushed once. It stays on today.',
  notMovable: "This one is set not to move. Turn that on in its page if you'd like to push it.",
  undone: 'Back on today',
} as const;

export function usePushToTomorrow(): (taskId: Id, date: LocalDate) => Promise<void> {
  const snooze = useSnoozeOccurrence();
  const undoSnooze = useUndoSnooze();
  const showToast = useToastStore((s) => s.show);
  return async (taskId, date) => {
    const result = await snooze.mutateAsync({ taskId, date }).catch(() => null);
    if (!result || !result.ok) {
      const message = result && !result.ok ? result.error.message : '';
      if (/already snoozed/i.test(message)) showToast(PUSH_COPY.already, 'neutral');
      else if (/not snoozable/i.test(message)) showToast(PUSH_COPY.notMovable, 'neutral');
      else showToast(SAVE_FAILED, 'warning');
      return;
    }
    play('snooze');
    showToast(PUSH_COPY.toast, 'neutral', {
      action: {
        label: 'Undo',
        onPress: () =>
          void undoSnooze
            .mutateAsync({ taskId, date })
            .then((undone) => showToast(undone.ok ? PUSH_COPY.undone : SAVE_FAILED, undone.ok ? 'neutral' : 'warning'))
            .catch(() => showToast(SAVE_FAILED, 'warning')),
      },
    });
  };
}
