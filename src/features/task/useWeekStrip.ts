/** The last seven days of one task, shaped for <WeekStrip>. */
import { useMemo } from 'react';

import { addDays, eachDay, parseLocalDate, today } from '@/lib/date';
import { useTaskOccurrences } from '@/queries';
import type { Id } from '@/types';
import type { WeekStripDay, WeekDayState } from '@/ui';

const LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export function useWeekStrip(taskId: Id): readonly WeekStripDay[] {
  const to = today();
  const from = addDays(to, -6);
  const query = useTaskOccurrences(taskId, { from, to });
  return useMemo(() => {
    const byDate = new Map((query.data ?? []).map((o) => [o.date, o.outcome]));
    return eachDay(from, to).map((date) => {
      const outcome = byDate.get(date);
      const state: WeekDayState =
        outcome === 'ideal' ? 'ideal' : outcome === 'fallback' ? 'fallback' : outcome === 'off' ? 'off' : outcome === 'missed' ? 'missed' : outcome === 'pending' ? 'open' : 'none';
      return { key: date, label: LETTER[parseLocalDate(date).getDay()] ?? '', state, isToday: date === to };
    });
  }, [query.data, from, to]);
}
