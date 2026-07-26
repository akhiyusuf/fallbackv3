/**
 * M2. Write hooks. Each mutation runs the fixed seven-step sequence from docs/API.md §3:
 * persist -> (on failure, return) -> reconcile XP -> reconcile achievements/tenure ->
 * reconcile cycle boundaries -> invalidate QUERY_KEYS -> emit AppEvents.
 *
 * CYCLE STATE (CR-1, docs/MODULES.md top matter, review pass 1 items 1-2). `repos.cycleState`
 * is now a first-class `Repositories` member and the AUTHORITATIVE, O(1) pointer to the
 * in-progress cycle. `cycles.ts`'s `currentCycleWindow(cadence, tenureAnchorDate)` derivation
 * is used ONLY as the `null` fallback (a fresh store, or a backup restored from before this
 * pointer existed) and the result is written straight back via `set()`, so the fallback runs
 * at most once — see `getOrInitCycleState`. Every subsequent read is the pointer, never a
 * re-derivation, which is also what makes reconciliation correct across a cadence change: the
 * pointer always reflects whichever cadence was live when it was last advanced, so walking
 * forward from it can never replay history under the wrong cadence.
 *
 * XP RETRACTION (CR-2). `repos.progress.retractXpAward(taskId, date)` is the ONLY sanctioned
 * reduction of lifetime XP: it fires from `reconcileOccurrence` exclusively, and only when a
 * LIVE task's occurrence stops carrying a showing-up state (an undone mis-tap) — never from
 * `useDeleteTask` (SCHEMA §2.3 — XP survives deletion untouched), never from cycle-boundary
 * archiving, and never for a day that was simply always missed/off/pending (a no-op delete in
 * that case, per the port's own contract: "a no-op when no row exists returns ok").
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { emit } from '@/lib/events';
import { newId } from '@/lib/id';
import { addDays, diffDays, now } from '@/lib/date';
import { repos } from '@/db';
import {
  autoChipState,
  cyclesElapsedSince,
  dueIdealStepIds,
  freshCycleWindow,
  isXpEligible,
  levelFor,
  nextCycleWindow,
  reconcileAchievements,
  validateTaskDraft,
  xpForOccurrence,
} from '@/domain';
import { aggregateConsistency } from '@/domain';
import type {
  ChipState,
  CycleCadence,
  CycleState,
  CycleWindow,
  Id,
  LevelInfo,
  LocalDate,
  Occurrence,
  Result,
  Settings,
  Step,
  Task,
  TaskDraft,
} from '@/types';
import { err, ok } from '@/types';
import { QUERY_KEYS } from './index';
import { MOVE_SEARCH_PAD_DAYS, resolveAllOccurrences, resolveOneOccurrence, todayLocal } from './internal';

function invalidateCommon(qc: ReturnType<typeof useQueryClient>, taskId?: Id) {
  // review pass 1, item 9: predicate-based so BOTH `['tasks']` and `['tasks','includeDeleted']`
  // (and every `['taskOccurrences', taskId, from, to]` variant) are covered without hardcoding
  // every parameterised key shape here.
  qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'tasks' });
  if (taskId) qc.invalidateQueries({ queryKey: QUERY_KEYS.task(taskId) });
  qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'today' });
  qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'consistency' });
  qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'taskOccurrences' });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.trend });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.progress });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.achievements });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.records });
}

/* ------------------------------------------------------------------ cycle_state (CR-1) */

function windowToState(w: CycleWindow): CycleState {
  return { currentCycleId: w.id, cadence: w.cadence, startDate: w.startDate, endDate: w.endDate };
}
function stateToWindow(s: CycleState): CycleWindow {
  return { id: s.currentCycleId, cadence: s.cadence, startDate: s.startDate, endDate: s.endDate };
}

/**
 * The `null`-fallback derivation. `persisted: false` means the pointer could not be written
 * back — the caller must NOT proceed to archive against it (review pass 2, blocking item N4):
 * archiving now would be replayed identically from the same anchor-derived window on every
 * future call, since nothing recorded that this attempt ever happened.
 */
async function getOrInitCycleState(settings: Settings): Promise<{ state: CycleState; persisted: boolean }> {
  const existing = await repos.cycleState.get();
  if (existing) return { state: existing, persisted: true };
  // Same leading-partial shape N3 fixed for a cadence change: the very first cycle a store
  // ever has begins exactly at the anchor day, not the calendar period containing it
  // (non-blocking note — aligns with M1's genesis seed, `src/db/cycleWindowSeed.ts`).
  const derived = freshCycleWindow(settings.cycleCadence, settings.tenureAnchorDate);
  const state = windowToState(derived);
  const setResult = await repos.cycleState.set(state);
  return { state, persisted: setResult.ok };
}

/**
 * Archives ONE cycle window as a `CycleRecord`, windowed to `[w.startDate, recordEndDate]`
 * (which is `w.endDate` for a naturally-elapsed cycle, or YESTERDAY for a mid-cycle cadence
 * change's short cycle — see `finalizeCycleForCadenceChange`'s disjointness note, N3).
 * Returns the persisted record's own id — never the window id, which references no
 * `cycle_record` row (review pass 1 non-blocking note).
 *
 * Idempotency guard (review pass 2, blocking item N4): checks for an existing record at this
 * exact `(cadence, startDate, recordEndDate)` before appending. This is what keeps a retry
 * safe when a PREVIOUS attempt appended successfully but then failed to advance the pointer
 * (see `reconcileCycleBoundaries`) — without it, the retry would re-archive the same window.
 */
async function archiveCycleWindow(w: CycleWindow, recordEndDate: LocalDate, isShortCycle: boolean): Promise<Result<Id>> {
  const existingRecords = await repos.progress.listCycleRecords();
  const already = existingRecords.find((r) => r.cadence === w.cadence && r.startDate === w.startDate && r.endDate === recordEndDate);
  if (already) return ok(already.id);

  const today = todayLocal();
  const occs = await resolveAllOccurrences(repos, recordEndDate, today);
  const windowed = aggregateConsistency({ occurrences: occs, window: { from: w.startDate, to: recordEndDate }, today });
  const cyclingXpFinal = await repos.progress.cyclingXp(w.id);
  const unlocks = await repos.progress.listUnlocks();
  const recordId = newId();
  const result = await repos.progress.appendCycleRecord({
    id: recordId,
    cadence: w.cadence,
    startDate: w.startDate,
    endDate: recordEndDate,
    consistencyPercent: windowed.percent,
    breakdown: windowed.breakdown,
    cyclingXpFinal,
    badgeKeysUnlocked: unlocks.filter((u) => u.unlockedOn >= w.startDate && u.unlockedOn <= recordEndDate).map((u) => u.key),
    isShortCycle,
    finalizedAt: now(),
  });
  if (!result.ok) return err(result.error);
  emit({ type: 'cycle:finalized', recordId });
  return ok(recordId);
}

/**
 * SCHEMA §8's boundary loop, driven off the authoritative `cycle_state` pointer: while the
 * live window has fully elapsed, archive it (full-length, never short) and advance the
 * pointer.
 *
 * Advances the pointer after EACH successful archive, not once after the whole loop (review
 * pass 2, blocking item N4 — "never a double archive"): if archive N+1 fails, the pointer is
 * already past window N, so a retry resumes at N+1 instead of re-archiving N. Combined with
 * `archiveCycleWindow`'s own existence guard, a failed pointer WRITE after a successful
 * archive is also safe to retry.
 */
async function reconcileCycleBoundaries(): Promise<Result<void>> {
  const settings = await repos.settings.get();
  const today = todayLocal();
  const { state, persisted } = await getOrInitCycleState(settings);
  if (!persisted) return ok(undefined); // cannot safely archive against an unpersisted pointer

  let liveWindow = stateToWindow(state);
  const elapsed = cyclesElapsedSince(liveWindow, today);

  for (const w of elapsed) {
    const archiveResult = await archiveCycleWindow(w, w.endDate, false);
    if (!archiveResult.ok) return err(archiveResult.error); // pointer NOT advanced past w — safe retry

    const next = nextCycleWindow(w);
    const setResult = await repos.cycleState.set(windowToState(next));
    if (!setResult.ok) return err(setResult.error); // archived, but retry will find it via the guard above
    liveWindow = next;
  }
  return ok(undefined);
}

/**
 * Review pass 1, blocking item 1: a mid-cycle cadence change finalises the in-progress cycle
 * IMMEDIATELY, as a possibly-short record, archive-before-reset — MODULES M2's own
 * non-negotiable. Catches up any FULLY elapsed cycles under the OLD cadence first (so a
 * cadence change after a long absence doesn't skip genuine boundaries), then archives
 * whatever's left in progress as short, and starts a fresh window under the NEW cadence
 * starting EXACTLY today.
 *
 * DISJOINTNESS (review pass 2, blocking item N3): the short record ends YESTERDAY, not
 * today — `today` belongs to the fresh cycle only. Ending the short record AT today (as pass
 * 1 did, even after switching from `currentCycleWindow` to `freshCycleWindow`) still left the
 * two records sharing that one calendar day, since `freshCycleWindow` starts ON today too;
 * `[oldStart, today]` and `[today, natural end]` are not disjoint. `[oldStart, yesterday]` and
 * `[today, natural end]` are. The degenerate case — the live window itself started today (a
 * cadence change on day one of a cycle, or two changes in one day) — has zero elapsed days
 * under the old cadence, so nothing is archived at all; only the fresh window is set.
 */
async function finalizeCycleForCadenceChange(newCadence: CycleCadence): Promise<Result<void>> {
  const settings = await repos.settings.get();
  if (settings.cycleCadence === newCadence) return ok(undefined); // no-op: not actually a change

  const caughtUp = await reconcileCycleBoundaries();
  if (!caughtUp.ok) return caughtUp;

  const today = todayLocal();
  const { state, persisted } = await getOrInitCycleState(settings); // re-read: may have just advanced above
  if (!persisted) return err({ code: 'WRITE_FAILED', message: 'Could not establish the current cycle pointer.' });
  const liveWindow = stateToWindow(state);

  const shortCycleEnd = addDays(today, -1);
  if (shortCycleEnd >= liveWindow.startDate) {
    const archiveResult = await archiveCycleWindow(liveWindow, shortCycleEnd, true);
    if (!archiveResult.ok) return err(archiveResult.error);
  }

  const fresh = freshCycleWindow(newCadence, today);
  const setResult = await repos.cycleState.set(windowToState(fresh));
  if (!setResult.ok) return err(setResult.error);
  return ok(undefined);
}

/* ------------------------------------------------------------------ per-occurrence reconcile */

interface ReconcileResult {
  readonly occurrence: Occurrence | null;
  readonly xpAwarded: number;
  readonly levelUp: LevelInfo | null;
  readonly badgesUnlocked: readonly string[];
}

/**
 * Steps 3-5 of the API.md §3 sequence, for ONE changed (task, date) occurrence.
 *
 * Resolves via `resolveOneOccurrence` — the SAME move-aware resolution `internal.ts` uses for
 * every read (review pass 2, blocking item N1). This function previously called
 * `resolveOccurrence` directly without the `movedInLog` lookup, so a moved-then-completed
 * occurrence could award XP and celebrate for an outcome that every read displayed
 * differently (a completed day the reads called `missed`). There is now exactly one place
 * that resolves a `(task, date)` occurrence from persisted data; this function and every read
 * hook both call it.
 */
async function reconcileOccurrence(taskId: Id, date: LocalDate): Promise<ReconcileResult> {
  const task = await repos.tasks.get(taskId);
  if (!task) return { occurrence: null, xpAwarded: 0, levelUp: null, badgesUnlocked: [] };
  const today = todayLocal();
  const occurrence = await resolveOneOccurrence(repos, task, date, today);

  // Step 3 — XP. Every write's Result is checked (review pass 1, item 7): a failed award or
  // retraction reports as unchanged, never as a false success.
  const lifetimeXpBefore = await repos.progress.lifetimeXp();
  let xpAwarded = 0;
  let xpChanged = false;

  if (isXpEligible(occurrence)) {
    // Preserve the ORIGINAL cycle attribution when an award for this exact occurrence
    // already exists (review pass 2, N2's "original cycle id" acceptance clause): an
    // off-mark/unmark round trip, or any other re-affirmation of an already-earned
    // occurrence, must not silently re-stamp it with whatever cycle happens to be live NOW —
    // only a genuinely NEW award is stamped with the current pointer. `appendXpAward`'s
    // UNIQUE(task_id, date) makes this an upsert either way (SCHEMA §7's documented
    // ideal->fallback "downgrade... updates the row's kind/amount", not its cycle_id).
    const existingAward = (await repos.progress.listXpAwards(date, date)).find((a) => a.taskId === taskId);
    let cycleId = existingAward?.cycleId;
    if (!cycleId) {
      const settings = await repos.settings.get();
      const { state: cycleState } = await getOrInitCycleState(settings);
      cycleId = cycleState.currentCycleId;
    }
    const amount = xpForOccurrence(occurrence);
    const appendResult = await repos.progress.appendXpAward({
      id: newId(),
      taskId,
      date,
      kind: occurrence.outcome as 'ideal' | 'fallback',
      amount,
      cycleId,
      createdAt: now(),
    });
    if (appendResult.ok) {
      xpAwarded = amount;
      xpChanged = true;
    }
  } else if (occurrence.outcome !== 'off') {
    // CR-2 — see this file's header for the exact boundary: an undone mis-tap (chip -> todo,
    // reads `pending`/`missed`) or the move-vacated case (reads `not-due`). Review pass 2,
    // blocking item N2: marking a day OFF must never retract earned XP (SCHEMA §7 / PRD
    // §3.4 — "never an XP penalty"), so `off` is explicitly excluded here even though it is
    // not XP-eligible either. Safe otherwise unconditionally: a delete that finds no row
    // (this occurrence was never eligible) is a documented no-op.
    const retractResult = await repos.progress.retractXpAward(taskId, date);
    if (retractResult.ok) xpChanged = true;
  }

  const lifetimeXpAfter = xpChanged ? await repos.progress.lifetimeXp() : lifetimeXpBefore;
  const levelBefore = levelFor(lifetimeXpBefore);
  const levelAfter = levelFor(lifetimeXpAfter);
  const levelUp = xpAwarded > 0 && levelAfter.level > levelBefore.level ? levelAfter : null;

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
  const badgesUnlocked: string[] = [];
  for (const u of newUnlocks) {
    const upsertResult = await repos.progress.upsertUnlock(u);
    if (upsertResult.ok) {
      badgesUnlocked.push(u.key);
      emit({ type: 'badge:unlocked', key: u.key });
    }
  }

  // `level:up` is emitted HERE ONLY — every caller of `reconcileOccurrence` relies on this
  // single emit (review pass 2, blocking item N5). Do not re-emit it in a calling mutation.
  if (levelUp) emit({ type: 'level:up', level: levelUp.level });

  // Step 5 — cycle boundaries (archive always precedes any implicit reset). Best-effort: a
  // boundary-reconciliation failure must not undo the log/XP/badge work already committed
  // above; it retries on the next mutation or app foreground.
  await reconcileCycleBoundaries();

  return { occurrence, xpAwarded, levelUp, badgesUnlocked };
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
      // lifetime XP and level stay monotonic. Deliberately does NOT call `reconcileOccurrence`
      // or `retractXpAward` — deletion must never touch XP (this file's header, CR-2's
      // boundary).
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

      const { occurrence, xpAwarded, levelUp, badgesUnlocked } = await reconcileOccurrence(input.taskId, input.date);
      emit({ type: 'day:logged', taskId: input.taskId, date: input.date });
      if (xpAwarded > 0) emit({ type: 'xp:awarded', amount: xpAwarded, kind: occurrence!.outcome as 'ideal' | 'fallback' });

      const celebrate: 'none' | 'ideal' | 'fallback' =
        occurrence?.outcome === 'ideal' ? 'ideal' : occurrence?.outcome === 'fallback' ? 'fallback' : 'none';
      return ok({ outcome: occurrence?.outcome ?? 'not-due', xpAwarded, celebrate, levelUp, badgesUnlocked });
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

      // `level:up` is emitted once, inside `reconcileOccurrence` alone (review pass 2,
      // blocking item N5 — this hook was re-emitting it for the same crossing, producing a
      // duplicate milestone notification via M7's scheduler). Every mutation that calls
      // `reconcileOccurrence` follows this same convention: reconcile emits, callers don't.
      const { occurrence, xpAwarded, levelUp, badgesUnlocked } = await reconcileOccurrence(input.taskId, input.date);
      emit({ type: 'day:logged', taskId: input.taskId, date: input.date });
      if (xpAwarded > 0) emit({ type: 'xp:awarded', amount: xpAwarded, kind: occurrence!.outcome as 'ideal' | 'fallback' });
      return ok({ occurrence, xpAwarded, levelUp, badgesUnlocked });
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
      const { occurrence, xpAwarded, levelUp, badgesUnlocked } = await reconcileOccurrence(input.taskId, input.date);
      emit({ type: 'day:logged', taskId: input.taskId, date: input.date });
      return ok({ occurrence, xpAwarded, levelUp, badgesUnlocked });
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

/**
 * Review pass 1, blocking item 6: F7 snooze/move. Persists `movedToDate` on the SOURCE date's
 * log row (as before), then reconciles BOTH dates through the real pipeline: the source date
 * now resolves `not-due` (vacated — `resolveOccurrence`'s `log.movedToDate` check) rather than
 * being left to rot into `missed`, and the target date resolves through `movedInLog` (see
 * `dayState.ts`), becoming a genuine due occurrence even on a date the cadence wouldn't
 * naturally place it. Reconciling the source date also retracts any XP that occurrence had
 * already earned (CR-2) — moving something un-does its old date's completion, consistent with
 * "affects the occurrence, not the cadence": the occurrence itself relocated.
 *
 * A move beyond `MOVE_SEARCH_PAD_DAYS` is rejected up front (review pass 2 non-blocking
 * note): `internal.ts`'s move lookup only searches a bounded window around a resolve range,
 * so a further move would silently vanish from every future read while its source date stays
 * vacated — better to refuse it here than produce that silent data loss.
 */
export function useMoveOccurrence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: Id; fromDate: LocalDate; toDate: LocalDate }) => {
      const distance = Math.abs(diffDays(input.toDate, input.fromDate));
      if (distance > MOVE_SEARCH_PAD_DAYS) {
        return err({
          code: 'VALIDATION_FAILED' as const,
          message: `Cannot move an occurrence more than ${MOVE_SEARCH_PAD_DAYS} days from its original date.`,
        });
      }
      const existing = (await repos.logs.listForTask(input.taskId, input.fromDate, input.fromDate))[0] ?? null;
      const nowIso = now();
      const persistResult = await repos.logs.upsert({
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
      if (!persistResult.ok) return err(persistResult.error);

      await reconcileOccurrence(input.taskId, input.fromDate);
      const target = await reconcileOccurrence(input.taskId, input.toDate);
      emit({ type: 'day:logged', taskId: input.taskId, date: input.toDate });
      return ok({ occurrence: target.occurrence });
    },
    onSuccess: (_r, vars) => invalidateCommon(qc, vars.taskId),
  });
}

/* ------------------------------------------------------------------ settings */

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Settings>): Promise<Result<Settings>> => {
      // Review pass 1, blocking item 1: a cadence change finalises the in-progress cycle
      // BEFORE the patch takes effect — archive always precedes the switch.
      if (patch.cycleCadence) {
        const cadenceResult = await finalizeCycleForCadenceChange(patch.cycleCadence);
        if (!cadenceResult.ok) return err(cadenceResult.error);
      }
      const result = await repos.settings.patch(patch);
      if (!result.ok) return result;
      emit({ type: 'settings:changed' });
      return result;
    },
    onSuccess: (result, patch) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.settings });
      // `Settings.cycleCadence` is always present on `result` (it's non-optional) — check the
      // MUTATION'S INPUT for whether this call actually touched it, not the always-populated
      // output, or these would fire on every settings change.
      if (result.ok && patch.cycleCadence) {
        qc.invalidateQueries({ queryKey: QUERY_KEYS.records });
        qc.invalidateQueries({ queryKey: QUERY_KEYS.progress });
      }
    },
  });
}

/**
 * Exported for `mutations.test.ts` ONLY (review pass 1, blocking item 10 — "the buggiest code
 * in this module... have zero coverage"). Not part of the documented `@/queries` surface
 * (docs/API.md §3 lists the hooks only); a feature module has no reason to import these
 * directly — call the hooks above instead.
 */
export const __testing__ = { reconcileCycleBoundaries, finalizeCycleForCadenceChange, archiveCycleWindow, getOrInitCycleState, reconcileOccurrence };
