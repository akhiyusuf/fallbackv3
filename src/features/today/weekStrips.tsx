/**
 * One read for every week strip on a list. A list of 150 routines drew 150 strips and each ran
 * its own queries (a task read, a log read, an off-mark read: 450 reads on mount, 450 more after
 * every log). Here the list reads the last seven days of every habit once (two repository reads
 * in all, through the same resolver `useTaskOccurrences` uses) and hands each card its own seven
 * days. A card outside a `WeekStripsProvider` (Search) keeps its own query, as before.
 *
 * Under the 'taskOccurrences' key, so every write that refreshes a card's own strip refreshes this.
 */
import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import { QueryClientContext, useQuery } from '@tanstack/react-query';

import { repos } from '@/db';
import { addDays, eachDay, parseLocalDate, today } from '@/lib/date';
import { resolveAllOccurrences, todayLocal } from '@/queries/internal';
import type { Id, LocalDate } from '@/types';
import type { WeekDayState, WeekStripDay } from '@/ui';

const LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

interface WeekStripsValue {
  readonly daysFor: (taskId: Id) => readonly WeekStripDay[];
}

const WeekStripsContext = createContext<WeekStripsValue | null>(null);

/** The strips handed down by the nearest provider, or null when the card should read its own. */
export function useWeekStripsContext(): WeekStripsValue | null {
  return useContext(WeekStripsContext);
}

function stateOf(outcome: string | undefined): WeekDayState {
  return outcome === 'ideal' ? 'ideal' : outcome === 'fallback' ? 'fallback' : outcome === 'off' ? 'off' : outcome === 'missed' ? 'missed' : outcome === 'pending' ? 'open' : 'none';
}

function daysFrom(dates: readonly LocalDate[], to: LocalDate, outcomes: ReadonlyMap<string, string> | undefined): WeekStripDay[] {
  return dates.map((date) => ({ key: date, label: LETTER[parseLocalDate(date).getDay()] ?? '', state: stateOf(outcomes?.get(date)), isToday: date === to }));
}

const signature = (days: readonly WeekStripDay[]) => days.map((d) => d.state).join(',');

function BatchedProvider({ children }: { readonly children: ReactNode }) {
  const to = today();
  const from = addDays(to, -6);
  const query = useQuery({
    queryKey: ['taskOccurrences', 'strips', from, to] as const,
    queryFn: async () => {
      const occs = await resolveAllOccurrences(repos, to, todayLocal(), from);
      const byTask = new Map<string, Map<string, string>>();
      for (const o of occs) {
        if (o.date < from || o.date > to) continue;
        let m = byTask.get(o.taskId);
        if (!m) byTask.set(o.taskId, (m = new Map()));
        m.set(o.date, o.outcome);
      }
      return byTask;
    },
  });
  // A card whose seven days did not change keeps the very same array, so it does not redraw.
  const kept = useRef(new Map<string, readonly WeekStripDay[]>());
  const value = useMemo<WeekStripsValue>(() => {
    const dates = eachDay(from, to);
    const data = query.data;
    const next = new Map<string, readonly WeekStripDay[]>();
    return {
      daysFor: (taskId) => {
        const cached = next.get(taskId);
        if (cached) return cached;
        const fresh = daysFrom(dates, to, data?.get(taskId));
        const old = kept.current.get(taskId);
        const days = old && signature(old) === signature(fresh) && old[0]?.key === fresh[0]?.key ? old : fresh;
        next.set(taskId, days);
        kept.current.set(taskId, days);
        return days;
      },
    };
  }, [query.data, from, to]);
  return <WeekStripsContext.Provider value={value}>{children}</WeekStripsContext.Provider>;
}

/**
 * Wrap the cards of a list. Without a query client (a bare render) it does nothing and each card
 * reads its own strip.
 */
export function WeekStripsProvider({ children }: { readonly children: ReactNode }) {
  const client = useContext(QueryClientContext);
  return client ? <BatchedProvider>{children}</BatchedProvider> : <>{children}</>;
}
