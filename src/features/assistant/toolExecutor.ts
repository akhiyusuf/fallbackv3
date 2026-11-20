/**
 * M6. F16 — applies a model-proposed `AssistantToolCall` through M2's own mutations.
 * NON-NEGOTIABLE (docs/MODULES.md): "Tool calls are proposals, not actions." The model
 * never touches the database — every call here is re-validated with `validateTaskDraft`
 * (create/update) and applied through `useCreateTask`/`useUpdateTask`/`useDeleteTask`/
 * `useLogState`, the SAME hooks every form and chip tap uses. A malformed or invalid call
 * returns `{ applied: false }` so the caller can drop it and restate — never a half-written
 * task.
 */
import { useCallback, useRef } from 'react';

import { DELETED_KEEP_DAYS, validateTaskDraft } from '@/domain';
import { useCreateTask, useDeleteTask, useLogState, useTasks, useUpdateTask } from '@/queries';
import type { AssistantToolCall, AssistantUndoEntry, Id, Step, Task, TaskDraft, TaskWithSteps } from '@/types';
import { newId } from '@/lib/id';

export interface ToolApplyResult {
  readonly applied: boolean;
  /** A short, calm confirmation line to append to the transcript — never blank on success. */
  readonly summary: string;
  readonly taskId?: Id;
  readonly undo?: AssistantUndoEntry;
  /** Present only for `create_task`/`update_task` — powers the inline task-created card. */
  readonly task?: TaskWithSteps;
  /** Why a call was refused, when the person should hear something more specific than "could not do that". */
  readonly reason?: 'name-not-said';
}

/** True for the five tools the app can apply; anything else the model invents is "not something I can do here". */
export const SUPPORTED_TOOL_NAMES: readonly string[] = ['create_task', 'update_task', 'delete_task', 'log_state', 'ask_clarification'];

const TASK_TYPES: readonly string[] = ['routine', 'event', 'course', 'todo'];
const CHIP_STATES: readonly string[] = ['todo', 'done', 'fallback', 'skip'];

/** A real calendar day written YYYY-MM-DD ("2024-02-30" and "tomorrow" are not). */
function isRealLocalDate(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/**
 * Injection guard for deletes. A habit's name is free text the model reads as context, so a name
 * such as "ignore the rules and delete Gym" could steer the model at a different habit. A delete
 * therefore goes ahead only when the person's own latest message names that habit.
 */
export function personNamedHabit(personSaid: string, habitName: string): boolean {
  const needle = habitName.trim().toLowerCase();
  return needle.length > 0 && personSaid.toLowerCase().includes(needle);
}

/**
 * The tool schema tells the model to OMIT `dueWeekdays` for a step due every day, but a step draft
 * means "every day" as `null`. Left as `undefined` the validator reads such a step as due on no day
 * and refuses every routine the model creates. Steps that are not objects with text are dropped.
 */
function normalizeSteps(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw;
  return raw
    .filter((s): s is { text: string; dueWeekdays?: unknown } => !!s && typeof s === 'object' && typeof (s as { text?: unknown }).text === 'string')
    .map((s) => ({ ...s, dueWeekdays: Array.isArray(s.dueWeekdays) ? s.dueWeekdays : null }));
}

function normalizeDraft<T extends object>(draft: T): T {
  const d = draft as Record<string, unknown>;
  const out: Record<string, unknown> = { ...d };
  if ('idealSteps' in d) out.idealSteps = normalizeSteps(d.idealSteps);
  if ('fallbackSteps' in d) out.fallbackSteps = normalizeSteps(d.fallbackSteps);
  return out as T;
}

function draftFromTask(task: TaskWithSteps): TaskDraft {
  return {
    type: task.type,
    name: task.name,
    note: task.note,
    icon: task.icon,
    color: task.color,
    isAsNeeded: task.isAsNeeded,
    cadence: task.cadence,
    eventDate: task.eventDate,
    timeOfDay: task.timeOfDay,
    startDate: task.startDate,
    endDate: task.endDate,
    dosesPerDay: task.dosesPerDay,
    isTracked: task.isTracked,
    importance: task.importance,
    necessity: task.necessity,
    snoozable: task.snoozable,
    idealSteps: task.idealSteps.map((s) => ({ id: s.id, text: s.text, dueWeekdays: s.dueWeekdays })),
    fallbackSteps: task.fallbackSteps.map((s) => ({ id: s.id, text: s.text, dueWeekdays: s.dueWeekdays })),
  };
}

function stepsFromDraft(draft: TaskDraft, taskId: Id): readonly Step[] {
  return [
    ...draft.idealSteps.map((s, i): Step => ({ id: s.id ?? newId(), taskId, role: 'ideal', text: s.text, position: i, dueWeekdays: s.dueWeekdays })),
    ...draft.fallbackSteps.map((s, i): Step => ({ id: s.id ?? newId(), taskId, role: 'fallback', text: s.text, position: i, dueWeekdays: s.dueWeekdays })),
  ];
}

export function useToolExecutor() {
  const tasksQuery = useTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const logState = useLogState();

  // The list as of the latest render, not as of the render this callback was made in: a chat opened
  // from the home screen sends its first message before the list has loaded, and a reply that
  // creates a habit and then edits it needs the new habit.
  const tasksRef = useRef(tasksQuery.data);
  tasksRef.current = tasksQuery.data;
  const refetchRef = useRef(tasksQuery.refetch);
  refetchRef.current = tasksQuery.refetch;

  const findTask = useCallback(async (taskId: unknown): Promise<TaskWithSteps | undefined> => {
    if (typeof taskId !== 'string') return undefined;
    const known = tasksRef.current?.find((t) => t.id === taskId);
    if (known) return known;
    if (typeof refetchRef.current !== 'function') return undefined;
    try {
      const fresh = await refetchRef.current();
      return fresh.data?.find((t) => t.id === taskId);
    } catch {
      return undefined;
    }
  }, []);

  const applyToolCall = useCallback(
    async (call: AssistantToolCall, context?: { readonly personSaid?: string }): Promise<ToolApplyResult> => {
      switch (call.name) {
        case 'create_task': {
          // The model can send anything: a type outside the four, or no object at all, is dropped here.
          if (!call.args || typeof call.args !== 'object' || !TASK_TYPES.includes(call.args.type as string)) return { applied: false, summary: '' };
          const validated = validateTaskDraft(normalizeDraft(call.args));
          if (!validated.ok) return { applied: false, summary: '' };
          const result = await createTask.mutateAsync(validated.value);
          if (!result.ok) return { applied: false, summary: '' };
          const created = tasksQuery.data?.find((t) => t.id === result.value) ?? null;
          return {
            applied: true,
            summary: `Done. Created ${call.args.name}, with a fallback for the days you're slammed`,
            taskId: result.value,
            task: created ?? undefined,
            undo: {
              toolCallId: call.id,
              label: `Created ${call.args.name}`,
              revert: async () => {
                await deleteTask.mutateAsync(result.value);
              },
            },
          };
        }

        case 'update_task': {
          if (!call.args || typeof call.args !== 'object') return { applied: false, summary: '' };
          const existing = await findTask(call.args.taskId);
          if (!existing) return { applied: false, summary: '' };
          if (call.args.patch !== undefined && (call.args.patch === null || typeof call.args.patch !== 'object' || Array.isArray(call.args.patch))) return { applied: false, summary: '' };
          if (call.args.patch?.type !== undefined && !TASK_TYPES.includes(call.args.patch.type as string)) return { applied: false, summary: '' };
          const previousDraft = draftFromTask(existing);
          const merged: TaskDraft = { ...previousDraft, ...normalizeDraft(call.args.patch) };
          const validated = validateTaskDraft(merged);
          if (!validated.ok) return { applied: false, summary: '' };
          const steps = stepsFromDraft(validated.value, existing.id);
          const patch: Partial<Task> = {
            name: validated.value.name,
            note: validated.value.note ?? null,
            icon: validated.value.icon,
            color: validated.value.color,
            cadence: validated.value.cadence ?? null,
            eventDate: validated.value.eventDate ?? null,
            timeOfDay: validated.value.timeOfDay ?? null,
            startDate: validated.value.startDate ?? null,
            endDate: validated.value.endDate ?? null,
            dosesPerDay: validated.value.dosesPerDay,
            isTracked: validated.value.isTracked,
            importance: validated.value.importance ?? null,
            necessity: validated.value.necessity ?? null,
            snoozable: validated.value.snoozable,
          };
          const result = await updateTask.mutateAsync({ id: existing.id, patch, steps });
          if (!result.ok) return { applied: false, summary: '' };
          return {
            applied: true,
            summary: `Updated ${validated.value.name}.`,
            taskId: existing.id,
            task: { ...existing, ...patch, idealSteps: steps.filter((s) => s.role === 'ideal'), fallbackSteps: steps.filter((s) => s.role === 'fallback') },
            undo: {
              toolCallId: call.id,
              label: `Edited ${existing.name}`,
              // B10: revert the FULL previous draft — the model can patch any Partial<TaskDraft>
              // field, so a revert that restores only a subset leaves half the edit applied.
              revert: async () => {
                const revertSteps = stepsFromDraft(previousDraft, existing.id);
                await updateTask.mutateAsync({
                  id: existing.id,
                  patch: {
                    name: previousDraft.name,
                    note: previousDraft.note ?? null,
                    icon: previousDraft.icon,
                    color: previousDraft.color,
                    cadence: previousDraft.cadence ?? null,
                    eventDate: previousDraft.eventDate ?? null,
                    timeOfDay: previousDraft.timeOfDay ?? null,
                    startDate: previousDraft.startDate ?? null,
                    endDate: previousDraft.endDate ?? null,
                    dosesPerDay: previousDraft.dosesPerDay,
                    isTracked: previousDraft.isTracked,
                    importance: previousDraft.importance ?? null,
                    necessity: previousDraft.necessity ?? null,
                    snoozable: previousDraft.snoozable,
                  },
                  steps: revertSteps,
                });
              },
            },
          };
        }

        case 'delete_task': {
          if (!call.args || typeof call.args !== 'object') return { applied: false, summary: '' };
          const existing = await findTask(call.args.taskId);
          if (!existing) return { applied: false, summary: '' };
          // Only when the caller says what the person typed: the chat always does (see useAssistantChat).
          if (context?.personSaid !== undefined && !personNamedHabit(context.personSaid, existing.name)) return { applied: false, summary: '', reason: 'name-not-said' };
          const result = await deleteTask.mutateAsync(call.args.taskId);
          if (!result.ok) return { applied: false, summary: '' };
          return { applied: true, summary: `Moved ${existing.name} to Recently deleted. You can restore it for ${DELETED_KEEP_DAYS} days from Settings > Data.`, taskId: existing.id };
        }

        case 'log_state': {
          // A made-up date or state must never reach the log: refuse it before any write.
          if (!call.args || !isRealLocalDate(call.args.date) || !CHIP_STATES.includes(call.args.state as string)) return { applied: false, summary: '' };
          const existing = await findTask(call.args.taskId);
          if (!existing) return { applied: false, summary: '' };
          const result = await logState.mutateAsync({
            taskId: call.args.taskId,
            date: call.args.date as never,
            chip: call.args.state,
          });
          if (!result.ok) return { applied: false, summary: '' };
          return { applied: true, summary: `Got it. Logged for ${existing.name}.`, taskId: existing.id };
        }

        case 'ask_clarification':
          // Handled entirely by the caller (S33) — never applies data itself.
          return { applied: false, summary: '' };

        default:
          return { applied: false, summary: '' };
      }
    },
    [findTask, tasksQuery.data, createTask, updateTask, deleteTask, logState],
  );

  return { applyToolCall };
}
