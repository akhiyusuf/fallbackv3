/**
 * Takes one habit off for one day: the emergency choice. That day does not count for or against
 * the person, however often they need it (no limit, on purpose: some lives are rough). Shared by
 * the Skip sheet and the "Emergency day off" link on Today's cards, so both behave the same:
 * the same sound, the same toast, and Undo straight away.
 */
import { useToastStore } from '@/app-shell';
import { useMarkOffDay } from '@/queries';
import { play } from '@/services/sfx';
import type { Id, LocalDate } from '@/types';

import { SAVE_FAILED } from './formShared';

export const DAY_OFF_COPY = {
  toast: 'Emergency day off.',
  toastDetail: "Won't count",
} as const;

export function useTakeDayOff(): (taskId: Id, date: LocalDate) => Promise<void> {
  const markOffDay = useMarkOffDay();
  const showToast = useToastStore((s) => s.show);
  return async (taskId, date) => {
    const result = await markOffDay.mutateAsync({ date, taskId, mark: true }).catch(() => ({ ok: false as const }));
    if (!result.ok) {
      showToast(SAVE_FAILED, 'warning');
      return;
    }
    play('log_skip');
    showToast(DAY_OFF_COPY.toast, 'neutral', {
      icon: 'skip',
      detail: DAY_OFF_COPY.toastDetail,
      action: {
        label: 'Undo',
        onPress: () =>
          void markOffDay
            .mutateAsync({ date, taskId, mark: false })
            .then((undone) => showToast(undone.ok ? 'Undone.' : SAVE_FAILED, undone.ok ? 'neutral' : 'warning'))
            .catch(() => showToast(SAVE_FAILED, 'warning')),
      },
    });
  };
}
