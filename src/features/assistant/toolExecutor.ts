/**
 * M6. F16 — applies a model-proposed `AssistantToolCall` through M2's own mutations.
 * NON-NEGOTIABLE (docs/MODULES.md): "Tool calls are proposals, not actions." The model
 * never touches the database — every call here is re-validated with `validateTaskDraft`
 * (create/update) and applied through `useCreateTask`/`useUpdateTask`/`useDeleteTask`/
 * `useLogState`, the SAME hooks every form and chip tap uses. A malformed or invalid call
 * returns `{ applied: false }` so the caller can drop it and restate — never a half-written
 * task.
 */
import { useCallback } from 'react';

import { validateTaskDraft } from '@/domain';
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

  const applyToolCall = useCallback(
    async (call: AssistantToolCall): Promise<ToolApplyResult> => {
      switch (call.name) {
        case 'create_task': {
          const validated = validateTaskDraft(call.args);
          if (!validated.ok) return { applied: false, summary: '' };
          const result = await createTask.mutateAsync(validated.value);
          if (!result.ok) return { applied: false, summary: '' };
          const created = tasksQuery.data?.find((t) => t.id === result.value) ?? null;
          return {
            applied: true,
            summary: `Done — created ${call.args.name}, with a fallback for the days you're slammed 🌱`,
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
          const existing = tasksQuery.data?.find((t) => t.id === call.args.taskId);
          if (!existing) return { applied: false, summary: '' };
          const previousDraft = draftFromTask(existing);
          const merged: TaskDraft = { ...previousDraft, ...call.args.patch };
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
          const existing = tasksQuery.data?.find((t) => t.id === call.args.taskId);
          if (!existing) return { applied: false, summary: '' };
          const result = await deleteTask.mutateAsync(call.args.taskId);
          if (!result.ok) return { applied: false, summary: '' };
          return { applied: true, summary: `Deleted ${existing.name}.`, taskId: existing.id };
        }

        case 'log_state': {
          const existing = tasksQuery.data?.find((t) => t.id === call.args.taskId);
          if (!existing) return { applied: false, summary: '' };
          const result = await logState.mutateAsync({
            taskId: call.args.taskId,
            date: call.args.date as never,
            chip: call.args.state,
          });
          if (!result.ok) return { applied: false, summary: '' };
          return { applied: true, summary: `Got it — logged for ${existing.name}.`, taskId: existing.id };
        }

        case 'ask_clarification':
          // Handled entirely by the caller (S33) — never applies data itself.
          return { applied: false, summary: '' };

        default:
          return { applied: false, summary: '' };
      }
    },
    [tasksQuery.data, createTask, updateTask, deleteTask, logState],
  );

  return { applyToolCall };
}
