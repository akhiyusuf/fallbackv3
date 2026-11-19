/** M2. Read hooks. Compose M1's repositories with M2's pure domain engine. */
import { useQuery } from '@tanstack/react-query';
import { diffDays, endOfMonth, endOfWeek, now, startOfMonth, startOfWeek, addDays as libAddDays, toLocalDate } from '@/lib/date';
import { repos } from '@/db';
import { aggregateConsistency, currentCycleWindow, dayFractions, levelFor, perTaskConsistency, reconcileAchievements } from '@/domain';
import type {
  ConsistencyResult,
  ConsistencyScope,
  ConsistencyWindow,
  CycleRecord,
  DateRange,
  Id,
  LocalDate,
  Settings,
  TaskType,
  TaskWithSteps,
  TrendGranularity,
  TrendPoint,
  XpState,
} from '@/types';
import { QUERY_KEYS } from './index';
import { resolveAllOccurrences, resolveTaskOccurrences, todayLocal } from './internal';

/**
 * Review pass 1, blocking item 5: the type filter is applied client-side via `select`, on ONE
 * canonical unfiltered cache entry — two `useTasks({ type })` hooks with different filters no
 * longer clobber each other's cache slot (each `select` runs per-observer over the same
 * underlying query). `includeDeleted` genuinely changes the fetch, so it gets its own key.
 */
export function useTasks(filter?: { type?: TaskType; includeDeleted?: boolean }) {
  const includeDeleted = filter?.includeDeleted ?? false;
  return useQuery({
    queryKey: includeDeleted ? QUERY_KEYS.tasksIncludingDeleted : QUERY_KEYS.tasks,
    queryFn: () => repos.tasks.list({ includeDeleted }),
    select: (all) => (filter?.type ? all.filter((t) => t.type === filter.type) : all),
  });
}

export function useTask(id: Id) {
  return useQuery({
    queryKey: QUERY_KEYS.task(id),
    queryFn: () => repos.tasks.get(id),
  });
}

/** F6 — Today's due occurrences across every live task, for the given date. */
export function useToday(date: LocalDate) {
  return useQuery({
    queryKey: QUERY_KEYS.today(date),
    queryFn: async () => {
      const today = todayLocal();
      return resolveAllOccurrences(repos, date, today);
    },
  });
}

export function useTaskOccurrences(taskId: Id, range: DateRange) {
  return useQuery({
    queryKey: QUERY_KEYS.taskOccurrences(taskId, range.from, range.to),
    queryFn: async () => {
      const task = await repos.tasks.get(taskId);
      if (!task) return [];
      const today = todayLocal();
      const occs = await resolveTaskOccurrences(repos, task, range.to, today);
      return occs.filter((o) => o.date >= range.from && o.date <= range.to);
    },
  });
}

/** F5 — the one consistency read, both scopes, windowed per docs/ARCHITECTURE.md §6. */
export function useConsistency(input: { scope: ConsistencyScope; window: ConsistencyWindow; taskId?: Id }) {
  const { scope, window, taskId } = input;
  return useQuery({
    queryKey: QUERY_KEYS.consistency(scope, window, taskId),
    queryFn: async (): Promise<ConsistencyResult> => {
      const today = todayLocal();
      if (scope === 'per-task') {
        if (!taskId) throw new Error('taskId is required for per-task scope');
        const task = await repos.tasks.get(taskId);
        const occs = task ? await resolveTaskOccurrences(repos, task, today, today) : [];
        return perTaskConsistency({ taskId, occurrences: occs, window, today });
      }
      const occs = await resolveAllOccurrences(repos, today, today);
      return aggregateConsistency({ occurrences: occs, window, today });
    },
  });
}

/** S25's aggregate disclosure table. */
export function useConsistencyDisclosure() {
  return useQuery({
    queryKey: [...QUERY_KEYS.consistency('aggregate', 'last-30'), 'disclosure'] as const,
    queryFn: async () => {
      const today = todayLocal();
      const occs = await resolveAllOccurrences(repos, today, today);
      return dayFractions(occs);
    },
  });
}

function granularityFor(spanDays: number): TrendGranularity {
  if (spanDays < 90) return 'weekly';
  if (spanDays < 365 * 3) return 'monthly';
  return 'yearly';
}

/**
 * Real CALENDAR buckets (ARCHITECTURE §6.4's last paragraph: F28 buckets "are explicit
 * calendar `DateRange`s (a week / month / year)") — review pass 1, blocking item 8 replaced
 * the prior fixed 7/30/365-day strides, which drifted off calendar months within a year, off
 * leap years for "365-day" years, and anchored bucket edges to the first task's creation day
 * rather than the calendar. Every bucket except the last is a FULL period (e.g. every monthly
 * bucket but the last is exactly 28-31 days, never a fixed 30); the last is clamped to `to`.
 */
function bucketRanges(from: LocalDate, to: LocalDate, granularity: TrendGranularity): DateRange[] {
  const out: DateRange[] = [];
  const clampEnd = (end: LocalDate): LocalDate => (end > to ? to : end);

  if (granularity === 'weekly') {
    let periodStart = startOfWeek(from);
    while (periodStart <= to) {
      const periodEnd = endOfWeek(periodStart);
      out.push({ from: periodStart, to: clampEnd(periodEnd) });
      periodStart = libAddDays(periodEnd, 1);
    }
    return out;
  }

  if (granularity === 'monthly') {
    let periodStart = startOfMonth(from);
    while (periodStart <= to) {
      const periodEnd = endOfMonth(periodStart);
      out.push({ from: periodStart, to: clampEnd(periodEnd) });
      periodStart = libAddDays(periodEnd, 1);
    }
    return out;
  }

  // yearly — plain string boundaries; no calendar arithmetic needed for Jan 1 / Dec 31.
  let year = Number(from.slice(0, 4));
  const toYear = Number(to.slice(0, 4));
  while (year <= toYear) {
    const periodStart = `${year}-01-01` as LocalDate;
    const periodEnd = `${year}-12-31` as LocalDate;
    out.push({ from: periodStart, to: clampEnd(periodEnd) });
    year++;
  }
  return out;
}

/** F28 — all-time trend, granularity coarsens automatically, never a user control. */
export function useTrend() {
  return useQuery({
    queryKey: QUERY_KEYS.trend,
    queryFn: async (): Promise<readonly TrendPoint[]> => {
      const today = todayLocal();
      const tasks = await repos.tasks.list();
      const earliest = tasks.reduce<LocalDate | null>((min, t) => {
        const created = toLocalDate(new Date(t.createdAt));
        return min === null || created < min ? created : min;
      }, null);
      if (!earliest) return [];

      const spanDays = Math.max(1, diffDays(today, earliest));
      const granularity = granularityFor(spanDays);
      const occs = await resolveAllOccurrences(repos, today, today);

      const buckets = bucketRanges(earliest, today, granularity);
      return buckets.map((range) => {
        const r = aggregateConsistency({ occurrences: occs, window: range, today });
        return {
          bucketKey: range.from,
          label: range.from,
          range,
          // A gap is a break in the line, never a fabricated 0% (MODULES.md M5).
          percent: r.denominator > 0 ? r.percent : null,
          breakdown: r.breakdown,
        };
      });
    },
  });
}

/** F13/F31 — lifetime XP + level, cycling XP, current cycle window. */
export function useProgress() {
  return useQuery({
    queryKey: QUERY_KEYS.progress,
    queryFn: async (): Promise<XpState> => {
      const settings = await repos.settings.get();
      const today = todayLocal();
      const pointer = await repos.cycleState.get();
      const currentCycle = pointer
        ? { id: pointer.currentCycleId, cadence: pointer.cadence, startDate: pointer.startDate, endDate: pointer.endDate }
        : currentCycleWindow(settings.cycleCadence, today);
      const [lifetimeXp, cyclingXp] = await Promise.all([repos.progress.lifetimeXp(), repos.progress.cyclingXp(currentCycle.id)]);
      return {
        lifetimeXp,
        level: levelFor(lifetimeXp),
        cyclingXp,
        cycleCadence: settings.cycleCadence,
        currentCycle,
      };
    },
  });
}

export function useAchievements() {
  return useQuery({
    queryKey: QUERY_KEYS.achievements,
    queryFn: async () => {
      const [unlocks, settings] = await Promise.all([repos.progress.listUnlocks(), repos.settings.get()]);
      const today = todayLocal();
      const occs = await resolveAllOccurrences(repos, today, today);
      // Recompute is idempotent and upsert-only — surfacing it here lets the achievements
      // screen show a badge the instant its condition is met, without waiting on a mutation
      // (the badge only durably PERSISTS on the next mutation's reconcile step).
      const fresh = reconcileAchievements({
        occurrences: occs,
        tenureAnchor: settings.tenureAnchorDate,
        today,
        alreadyUnlocked: unlocks,
        now: now(),
      });
      return [...unlocks, ...fresh];
    },
  });
}

export function useCycleRecords() {
  return useQuery({
    queryKey: QUERY_KEYS.records,
    queryFn: (): Promise<readonly CycleRecord[]> => repos.progress.listCycleRecords(),
  });
}

export function useCycleRecord(id: Id) {
  return useQuery({
    queryKey: [...QUERY_KEYS.records, id] as const,
    queryFn: () => repos.progress.getCycleRecord(id),
  });
}

export function useSettings() {
  return useQuery({
    queryKey: QUERY_KEYS.settings,
    queryFn: (): Promise<Settings> => repos.settings.get(),
  });
}

export function useConversations() {
  return useQuery({
    queryKey: QUERY_KEYS.conversations,
    queryFn: () => repos.assistant.listConversations(),
  });
}

export function useConversation(id: Id) {
  return useQuery({
    queryKey: [...QUERY_KEYS.conversations, id] as const,
    queryFn: () => repos.assistant.getConversation(id),
  });
}

// Re-exported so a caller building a task-detail screen can resolve a single task's own
// occurrence set without duplicating the range/log/off-day plumbing.
export type { TaskWithSteps };
