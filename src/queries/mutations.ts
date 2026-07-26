/**
 * M2. Write hooks. Each mutation runs the fixed seven-step sequence from docs/API.md §3:
 * persist -> (on failure, return) -> reconcile XP -> reconcile achievements/tenure ->
 * reconcile cycle boundaries -> invalidate QUERY_KEYS -> emit AppEvents.
 *
 * KNOWN CONTRACT GAP (flagged in the M2 build report, not worked around silently):
 * SCHEMA.md §8 describes a `cycle_state` singleton (current_cycle_id/cadence/start/end),
 * but `docs/API.md` §1 / `src/types/ports.ts`'s `Repositories` exposes no repository for it
 * (`ProgressRepository` has `cyclingXp(cycleId)` and cycle_record CRUD, nothing for
 * cycle_state itself). Since `cycles.ts`'s `CycleWindow.id` is deterministic
 * (`cycle:<cadence>:<startDate>`, see cycles.ts's header), the LIVE view never actually
 * needs a persisted pointer — `currentCycleWindow(cadence, today)` always recomputes the
 * same id for the period we're in, and `cyclingXp(id)` naturally reads 0 for a period with
 * no awards yet, which is the "reset" (no separate zeroing write is needed for the live
 * counter). What the persisted layer genuinely needs and doesn't have a home for is a
 * cheap way to know which past windows still need archiving after a long absence; this
 * module derives that from `settings.tenureAnchorDate` forward, de-duplicating against
 * `listCycleRecords()` by (cadence, startDate, endDate) — correct, but an O(records) scan
 * on every reconciliation instead of an O(1) pointer read. Flagged as an architect change
 * request rather than added to `ports.ts`, which M2 doesn't own.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { emit } from '@/lib/events';
import { newId } from '@/lib/id';
import { now } from '@/lib/date';
import { repos } from '@/db';
import {
  autoChipState,
  currentCycleWindow,
  cyclesElapsedSince,
  dueIdealStepIds,
  isXpEligible,
  reconcileAchievements,
  resolveOccurrence,
  validateTaskDraft,
  xpForOccurrence,
} from '@/domain';
import { aggregateConsistency } from '@/domain';
import type {
  ChipState,
  Id,
  LocalDate,
  Occurrence,
  Result,
  Settings,
  Step,
  Task,
  TaskDraft,
  TaskWithSteps,
} from '@/types';
import { err, ok } from '@/types';
import { QUERY_KEYS } from './index';
import { resolveAllOccurrences, todayLocal } from './internal';

function invalidateCommon(qc: ReturnType<typeof useQueryClient>, taskId?: Id) {
  qc.invalidateQueries({ queryKey: QUERY_KEYS.tasks });
  if (taskId) qc.invalidateQueries({ queryKey: QUERY_KEYS.task(taskId) });
  qc.invalidateQueries({ queryKey: ['today'] });
  qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'consistency' });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.trend });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.progress });
  qc.invalidateQueries({ queryKey: ['achievements'] });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.records });
}

/** Steps 3-5 of the API.md §3 sequence, for ONE changed (task, date) occurrence. */
async function reconcileOccurrence(taskId: Id, date: LocalDate): Promise<{ occurrence: Occurrence | null; xpAwarded: number }> {
  const task = await repos.tasks.get(taskId);
  if (!task) return { occurrence: null, xpAwarded: 0 };
  const today = todayLocal();
  const [logs, offMarks] = await Promise.all([repos.logs.listForTask(taskId, date, date), repos.offDays.listRange(date, date)]);
  const occurrence = resolveOccurrence({ task, date, today, log: logs[0] ?? null, offMarks });

  // Step 3 — XP. `appendXpAward` is UNIQUE(task_id, date): re-logging the same occurrence
  // upserts rather than farms XP (docs/API.md §1). There is currently no repository call to
  // RETRACT an award when a live task's chip moves away from ideal/fallback back to
  // todo/skip/off — flagged above as part of the same cycle_state gap note; this mutation
  // only ever appends when newly eligible, matching the common "log forward" path exactly.
  let xpAwarded = 0;
  if (isXpEligible(occurrence)) {
    const settings = await repos.settings.get();
    const cycle = currentCycleWindow(settings.cycleCadence, today);
    xpAwarded = xpForOccurrence(occurrence);
    await repos.progress.appendXpAward({
      id: newId(),
      taskId,
      date,
      kind: occurrence.outcome as 'ideal' | 'fallback',
      amount: xpAwarded,
      cycleId: cycle.id,
      createdAt: now(),
    });
  }

  // Step 4 — achievements + tenure.
  const [unlocks, settings, allOccs] = await Promise.all([
    repos.progress.listUnlocks(),
    repos.settings.get(),
    resolveAllOccurrences(repos, today, today),
  ]);
  const newUnlocks = reconcileAchievements({
    occurrences: allOccs,
    tenureAnchor: settings.tenureAnchorDate,
    today,
    alreadyUnlocked: unlocks,
    now: now(),
  });
  for (const u of newUnlocks) {
    await repos.progress.upsertUnlock(u);
    emit({ type: 'badge:unlocked', key: u.key });
  }

  // Step 5 — cycle boundaries (archive always precedes any implicit reset).
  await reconcileCycleBoundaries();

  return { occurrence, xpAwarded };
}

async function reconcileCycleBoundaries(): Promise<void> {
  const settings = await repos.settings.get();
  const today = todayLocal();
  const anchorCycle = currentCycleWindow(settings.cycleCadence, settings.tenureAnchorDate);
  const elapsed = cyclesElapsedSince(anchorCycle, today);
  if (elapsed.length === 0) return;

  const existing = await repos.progress.listCycleRecords();
  const already = new Set(existing.map((r) => `${r.cadence}:${r.startDate}:${r.endDate}`));

  for (const w of elapsed) {
    const key = `${w.cadence}:${w.startDate}:${w.endDate}`;
    if (already.has(key)) continue; // already archived — reconciliation is idempotent
    const occs = await resolveAllOccurrences(repos, w.endDate, today);
    const windowed = aggregateConsistency({ occurrences: occs, window: { from: w.startDate, to: w.endDate }, today });
    const cyclingXpFinal = await repos.progress.cyclingXp(w.id);
    const unlocks = await repos.progress.listUnlocks();
    await repos.progress.appendCycleRecord({
      id: newId(),
      cadence: w.cadence,
      startDate: w.startDate,
      endDate: w.endDate,
      consistencyPercent: windowed.percent,
      breakdown: windowed.breakdown,
      cyclingXpFinal,
      badgeKeysUnlocked: unlocks.filter((u) => u.unlockedOn >= w.startDate && u.unlockedOn <= w.endDate).map((u) => u.key),
      isShortCycle: false,
      finalizedAt: now(),
    });
    emit({ type: 'cycle:finalized', recordId: w.id });
  }
}

/* ------------------------------------------------------------------ task CRUD */

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: TaskDraft): Promise<Result<Id>> => {
      const validated = validateTaskDraft(draft);
      if (!validated.ok) return validated;
      const nowIso = now();
      const id = newId();
      const task: Task = {
        id,
        type: draft.type,
        name: draft.name,
        note: draft.note ?? null,
        icon: draft.icon ?? 'Repeat',
        color: draft.color ?? 'forge-orange',
        isAsNeeded: draft.isAsNeeded ?? false,
        cadence: draft.cadence ?? null,
        eventDate: draft.eventDate ?? null,
        timeOfDay: draft.timeOfDay ?? null,
        startDate: draft.startDate ?? null,
        endDate: draft.endDate ?? null,
        dosesPerDay: draft.dosesPerDay ?? 1,
        isTracked: draft.isTracked ?? true,
        importance: draft.importance ?? null,
        necessity: draft.necessity ?? null,
        todoDoneAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
        deletedAt: null,
      };
      const steps: Step[] = [
        ...draft.idealSteps.map((s, i): Step => ({ id: s.id ?? newId(), taskId: id, role: 'ideal', text: s.text, position: i, dueWeekdays: s.dueWeekdays })),
        ...draft.fallbackSteps.map((s, i): Step => ({ id: s.id ?? newId(), taskId: id, role: 'fallback', text: s.text, position: i, dueWeekdays: s.dueWeekdays })),
      ];
      const result = await repos.tasks.insert(task, steps);
      if (!result.ok) return result;
      emit({ type: 'task:changed', taskId: id });
      return ok(id);
    },
    onSuccess: () => invalidateCommon(qc),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: Id; patch: Partial<Task>; steps?: readonly Step[] }): Promise<Result<void>> => {
      const result = await repos.tasks.update(input.id, { ...input.patch, updatedAt: now() }, input.steps);
      if (!result.ok) return result;
      emit({ type: 'task:changed', taskId: input.id });
      return ok(undefined);
    },
    onSuccess: (_r, vars) => invalidateCommon(qc, vars.id),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: Id): Promise<Result<void>> => {
      // SCHEMA.md §2.3 — split cascade: repos.tasks.softDelete removes step/day_log/
      // off_day_mark/as_needed_use but NEVER xp_award/achievement_unlock/cycle_record, so
      // lifetime XP and level stay monotonic. Nothing further to reconcile here.
      const result = await repos.tasks.softDelete(id);
      if (!result.ok) return result;
      emit({ type: 'task:changed', taskId: id });
      return ok(undefined);
    },
    onSuccess: (_r, id) => invalidateCommon(qc, id),
  });
}

export function useDuplicateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: Id): Promise<Result<Id>> => {
      const result = await repos.tasks.duplicate(id);
      if (result.ok) emit({ type: 'task:changed', taskId: result.value });
      return result;
    },
    onSuccess: () => invalidateCommon(qc),
  });
}

/* ------------------------------------------------------------------ logging */

export function useLogState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: Id; date: LocalDate; chip: ChipState }) => {
      const existing = (await repos.logs.listForTask(input.taskId, input.date, input.date))[0] ?? null;
      const nowIso = now();
      const persistResult = await repos.logs.upsert({
        id: existing?.id ?? newId(),
        taskId: input.taskId,
        date: input.date,
        chipState: input.chip,
        isManualOverride: true,
        completedStepIds: existing?.completedStepIds ?? [],
        dosesCompleted: existing?.dosesCompleted ?? 0,
        movedToDate: existing?.movedToDate ?? null,
        createdAt: existing?.createdAt ?? nowIso,
        updatedAt: nowIso,
      });
      if (!persistResult.ok) return err(persistResult.error);

      const { occurrence, xpAwarded } = await reconcileOccurrence(input.taskId, input.date);
      emit({ type: 'day:logged', taskId: input.taskId, date: input.date });
      if (xpAwarded > 0) emit({ type: 'xp:awarded', amount: xpAwarded, kind: occurrence!.outcome as 'ideal' | 'fallback' });

      const celebrate: 'none' | 'ideal' | 'fallback' = occurrence?.outcome === 'ideal' ? 'ideal' : occurrence?.outcome === 'fallback' ? 'fallback' : 'none';
      return ok({ outcome: occurrence?.outcome ?? 'not-due', xpAwarded, celebrate, levelUp: null, badgesUnlocked: [] as readonly string[] });
    },
    onSuccess: (_r, vars) => invalidateCommon(qc, vars.taskId),
  });
}

export function useToggleStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: Id; date: LocalDate; stepId: Id }) => {
      const task = await repos.tasks.get(input.taskId);
      if (!task) return err({ code: 'NOT_FOUND' as const, message: 'Task not found.' });
      const existing = (await repos.logs.listForTask(input.taskId, input.date, input.date))[0] ?? null;
      const dueIds = dueIdealStepIds(task, input.date);
      const completed = new Set(existing?.completedStepIds ?? []);
      if (completed.has(input.stepId)) completed.delete(input.stepId);
      else completed.add(input.stepId);
      const completedStepIds = [...completed];

      const chip = autoChipState({
        taskId: input.taskId,
        date: input.date,
        outcome: 'pending',
        dueIdealStepIds: dueIds,
        completedStepIds,
        chipState: null,
        dosesRequired: task.dosesPerDay,
        dosesCompleted: existing?.dosesCompleted ?? 0,
      });

      const nowIso = now();
      const persistResult = await repos.logs.upsert({
        id: existing?.id ?? newId(),
        taskId: input.taskId,
        date: input.date,
        chipState: chip,
        isManualOverride: false, // step-driven auto-log, not a manual chip tap
        completedStepIds,
        dosesCompleted: existing?.dosesCompleted ?? 0,
        movedToDate: existing?.movedToDate ?? null,
        createdAt: existing?.createdAt ?? nowIso,
        updatedAt: nowIso,
      });
      if (!persistResult.ok) return err(persistResult.error);

      const { occurrence, xpAwarded } = await reconcileOccurrence(input.taskId, input.date);
      emit({ type: 'day:logged', taskId: input.taskId, date: input.date });
      return ok({ occurrence, xpAwarded });
    },
    onSuccess: (_r, vars) => invalidateCommon(qc, vars.taskId),
  });
}

export function useLogDose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: Id; date: LocalDate; dosesCompleted: number }) => {
      const existing = (await repos.logs.listForTask(input.taskId, input.date, input.date))[0] ?? null;
      const nowIso = now();
      const persistResult = await repos.logs.upsert({
        id: existing?.id ?? newId(),
        taskId: input.taskId,
        date: input.date,
        chipState: existing?.chipState ?? null,
        isManualOverride: existing?.isManualOverride ?? false,
        completedStepIds: existing?.completedStepIds ?? [],
        dosesCompleted: input.dosesCompleted,
        movedToDate: existing?.movedToDate ?? null,
        createdAt: existing?.createdAt ?? nowIso,
        updatedAt: nowIso,
      });
      if (!persistResult.ok) return err(persistResult.error);
      const { occurrence, xpAwarded } = await reconcileOccurrence(input.taskId, input.date);
      emit({ type: 'day:logged', taskId: input.taskId, date: input.date });
      return ok({ occurrence, xpAwarded });
    },
    onSuccess: (_r, vars) => invalidateCommon(qc, vars.taskId),
  });
}

/* ------------------------------------------------------------------ off days (F4) */

export function useMarkOffDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { date: LocalDate; taskId: Id | null; mark: boolean }) => {
      if (input.mark) {
        const priorChipState = input.taskId
          ? ((await repos.logs.listForTask(input.taskId, input.date, input.date))[0]?.chipState ?? null)
          : null;
        const result = await repos.offDays.mark({ id: newId(), date: input.date, taskId: input.taskId, priorChipState, createdAt: now() });
        if (!result.ok) return err(result.error);
      } else {
        const result = await repos.offDays.unmark(input.date, input.taskId);
        if (!result.ok) return err(result.error);
      }
      emit({ type: 'offday:changed', date: input.date });
      if (input.taskId) await reconcileOccurrence(input.taskId, input.date);
      return ok(undefined);
    },
    onSuccess: () => invalidateCommon(qc),
  });
}

/* ------------------------------------------------------------------ as-needed (F27) — reference-only */

export function useLogAsNeededUse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: Id; date: LocalDate; marker: 'ideal' | 'fallback' | null }) => {
      // Reference-only, by construction (SCHEMA.md §5): zero effect on XP of either kind,
      // zero effect on consistency at either scope, no achievement, no celebration — no
      // matter how many times it's logged. NOT routed through `reconcileOccurrence`.
      return repos.asNeeded.append({ id: newId(), taskId: input.taskId, date: input.date, marker: input.marker, createdAt: now() });
    },
    onSuccess: (_r, vars) => qc.invalidateQueries({ queryKey: QUERY_KEYS.task(vars.taskId) }),
  });
}

/* ------------------------------------------------------------------ snooze/move (F7) */

export function useMoveOccurrence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: Id; fromDate: LocalDate; toDate: LocalDate }) => {
      const existing = (await repos.logs.listForTask(input.taskId, input.fromDate, input.fromDate))[0] ?? null;
      const nowIso = now();
      return repos.logs.upsert({
        id: existing?.id ?? newId(),
        taskId: input.taskId,
        date: input.fromDate,
        chipState: existing?.chipState ?? null,
        isManualOverride: existing?.isManualOverride ?? false,
        completedStepIds: existing?.completedStepIds ?? [],
        dosesCompleted: existing?.dosesCompleted ?? 0,
        movedToDate: input.toDate,
        createdAt: existing?.createdAt ?? nowIso,
        updatedAt: nowIso,
      });
    },
    onSuccess: (_r, vars) => invalidateCommon(qc, vars.taskId),
  });
}

/* ------------------------------------------------------------------ settings */

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Settings>): Promise<Result<Settings>> => {
      const result = await repos.settings.patch(patch);
      if (result.ok) emit({ type: 'settings:changed' });
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.settings }),
  });
}
