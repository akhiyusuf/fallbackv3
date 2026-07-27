/**
 * M1. `TaskRepository` — docs/API.md §1. The only SQL that reads/writes `task`/`step`.
 *
 * `softDelete` is deliberately a plain UPDATE, not a DELETE: SCHEMA §2.3's split cascade
 * runs on the NEXT `StoreLifecycle.open()`, not at delete time (undo window). The hard
 * sweep there is one `DELETE FROM task WHERE deleted_at IS NOT NULL`, which relies on the
 * FK actions declared in the migrations (`step`/`day_log`/`off_day_mark`/`as_needed_use`
 * CASCADE, `xp_award`/`widget_config.fixed_task_id` SET NULL) to reproduce the pinned split
 * exactly — the schema itself is the single source of truth for the cascade, not a second
 * hand-written copy of it in application code.
 */
import { newId } from '@/lib/id';
import { now } from '@/lib/date';
import { err, ok } from '@/types';
import type {
  Cadence,
  Id,
  Importance,
  Instant,
  LocalDate,
  Necessity,
  Result,
  Step,
  StepRole,
  Task,
  TaskColor,
  TaskType,
  TaskWithSteps,
  Weekday,
} from '@/types';

import type { DbClient } from '../client';
import { parseJsonArray, toJsonArray } from '../json';

interface TaskRow {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly note: string | null;
  readonly icon: string;
  readonly color: string;
  readonly is_as_needed: number;
  readonly cadence_kind: string | null;
  readonly cadence_weekdays: string | null;
  readonly cadence_weekday: number | null;
  readonly cadence_day_of_month: number | null;
  readonly cadence_month: number | null;
  readonly cadence_anchor_date: string | null;
  readonly event_date: string | null;
  readonly time_of_day: string | null;
  readonly start_date: string | null;
  readonly end_date: string | null;
  readonly doses_per_day: number;
  readonly is_tracked: number;
  readonly importance: string | null;
  readonly necessity: string | null;
  readonly todo_done_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
  readonly snoozable: number;
}

interface StepRow {
  readonly id: string;
  readonly task_id: string;
  readonly role: string;
  readonly text: string;
  readonly position: number;
  readonly due_weekdays: string | null;
}

function cadenceFromRow(row: TaskRow): Cadence | null {
  const anchorDate = (row.cadence_anchor_date ?? '') as LocalDate;
  switch (row.cadence_kind) {
    case null:
    case undefined:
      return null;
    case 'daily':
      return { kind: 'daily' };
    case 'specific-weekdays':
      return { kind: 'specific-weekdays', weekdays: parseJsonArray<Weekday>(row.cadence_weekdays) };
    case 'weekly':
      return { kind: 'weekly', weekday: (row.cadence_weekday ?? 1) as Weekday, anchorDate };
    case 'bi-weekly':
      return { kind: 'bi-weekly', weekday: (row.cadence_weekday ?? 1) as Weekday, anchorDate };
    case 'monthly':
      return { kind: 'monthly', dayOfMonth: row.cadence_day_of_month ?? 1, anchorDate };
    case 'bi-monthly':
      return { kind: 'bi-monthly', dayOfMonth: row.cadence_day_of_month ?? 1, anchorDate };
    case 'yearly':
      return {
        kind: 'yearly',
        month: row.cadence_month ?? 1,
        dayOfMonth: row.cadence_day_of_month ?? 1,
        anchorDate,
      };
    default:
      return null;
  }
}

interface CadenceRowFields {
  cadence_kind: string | null;
  cadence_weekdays: string | null;
  cadence_weekday: number | null;
  cadence_day_of_month: number | null;
  cadence_month: number | null;
  cadence_anchor_date: string | null;
}

function cadenceToRow(cadence: Cadence | null | undefined): CadenceRowFields {
  const empty: CadenceRowFields = {
    cadence_kind: null,
    cadence_weekdays: null,
    cadence_weekday: null,
    cadence_day_of_month: null,
    cadence_month: null,
    cadence_anchor_date: null,
  };
  if (!cadence) return empty;
  switch (cadence.kind) {
    case 'daily':
      return { ...empty, cadence_kind: 'daily' };
    case 'specific-weekdays':
      return { ...empty, cadence_kind: 'specific-weekdays', cadence_weekdays: toJsonArray(cadence.weekdays) };
    case 'weekly':
    case 'bi-weekly':
      return {
        ...empty,
        cadence_kind: cadence.kind,
        cadence_weekday: cadence.weekday,
        cadence_anchor_date: cadence.anchorDate,
      };
    case 'monthly':
    case 'bi-monthly':
      return {
        ...empty,
        cadence_kind: cadence.kind,
        cadence_day_of_month: cadence.dayOfMonth,
        cadence_anchor_date: cadence.anchorDate,
      };
    case 'yearly':
      return {
        ...empty,
        cadence_kind: 'yearly',
        cadence_month: cadence.month,
        cadence_day_of_month: cadence.dayOfMonth,
        cadence_anchor_date: cadence.anchorDate,
      };
    default:
      return empty;
  }
}

function taskRowToTask(row: TaskRow): Task {
  return {
    id: row.id as Id,
    type: row.type as TaskType,
    name: row.name,
    note: row.note,
    icon: row.icon,
    color: row.color as TaskColor,
    isAsNeeded: row.is_as_needed === 1,
    cadence: cadenceFromRow(row),
    eventDate: row.event_date as LocalDate | null,
    timeOfDay: row.time_of_day,
    startDate: row.start_date as LocalDate | null,
    endDate: row.end_date as LocalDate | null,
    dosesPerDay: row.doses_per_day,
    isTracked: row.is_tracked === 1,
    importance: row.importance as Importance | null,
    necessity: row.necessity as Necessity | null,
    todoDoneAt: row.todo_done_at as Instant | null,
    createdAt: row.created_at as Instant,
    updatedAt: row.updated_at as Instant,
    deletedAt: row.deleted_at as Instant | null,
    // CR-4 (PRD §3.7 / SCHEMA §2). Default-on gate, editable post-creation from S20;
    // duplicate() below inherits this via its plain `{ ...sourceTask }` spread.
    snoozable: row.snoozable === 1,
  };
}

function stepRowToStep(row: StepRow): Step {
  return {
    id: row.id as Id,
    taskId: row.task_id as Id,
    role: row.role as StepRole,
    text: row.text,
    position: row.position,
    dueWeekdays: row.due_weekdays === null ? null : parseJsonArray<Weekday>(row.due_weekdays),
  };
}

function withSteps(task: Task, steps: readonly Step[]): TaskWithSteps {
  return {
    ...task,
    idealSteps: steps.filter((s) => s.role === 'ideal').sort((a, b) => a.position - b.position),
    fallbackSteps: steps.filter((s) => s.role === 'fallback').sort((a, b) => a.position - b.position),
  };
}

const TASK_COLUMNS = `
  id, type, name, note, icon, color, is_as_needed, cadence_kind, cadence_weekdays,
  cadence_weekday, cadence_day_of_month, cadence_month, cadence_anchor_date, event_date,
  time_of_day, start_date, end_date, doses_per_day, is_tracked, importance, necessity,
  todo_done_at, created_at, updated_at, deleted_at, snoozable
`;

function taskParams(task: Task): unknown[] {
  const c = cadenceToRow(task.cadence);
  return [
    task.id,
    task.type,
    task.name,
    task.note,
    task.icon,
    task.color,
    task.isAsNeeded ? 1 : 0,
    c.cadence_kind,
    c.cadence_weekdays,
    c.cadence_weekday,
    c.cadence_day_of_month,
    c.cadence_month,
    c.cadence_anchor_date,
    task.eventDate,
    task.timeOfDay,
    task.startDate,
    task.endDate,
    task.dosesPerDay,
    task.isTracked ? 1 : 0,
    task.importance,
    task.necessity,
    task.todoDoneAt,
    task.createdAt,
    task.updatedAt,
    task.deletedAt,
    task.snoozable ? 1 : 0,
  ];
}

async function loadStepsForTasks(db: DbClient, taskIds: readonly Id[]): Promise<Map<Id, Step[]>> {
  const byTask = new Map<Id, Step[]>();
  if (taskIds.length === 0) return byTask;
  const placeholders = taskIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<StepRow>(
    `SELECT id, task_id, role, text, position, due_weekdays FROM step WHERE task_id IN (${placeholders}) ORDER BY role, position`,
    taskIds as unknown[],
  );
  for (const row of rows) {
    const step = stepRowToStep(row);
    const list = byTask.get(step.taskId) ?? [];
    list.push(step);
    byTask.set(step.taskId, list);
  }
  return byTask;
}

export function createTaskRepository(db: DbClient) {
  return {
    async list(opts?: { includeDeleted?: boolean }): Promise<readonly TaskWithSteps[]> {
      const where = opts?.includeDeleted ? '' : 'WHERE deleted_at IS NULL';
      const rows = await db.getAllAsync<TaskRow>(`SELECT ${TASK_COLUMNS} FROM task ${where} ORDER BY created_at`);
      const stepsByTask = await loadStepsForTasks(
        db,
        rows.map((r) => r.id as Id),
      );
      return rows.map((row) => {
        const task = taskRowToTask(row);
        return withSteps(task, stepsByTask.get(task.id) ?? []);
      });
    },

    async get(id: Id): Promise<TaskWithSteps | null> {
      const row = await db.getFirstAsync<TaskRow>(`SELECT ${TASK_COLUMNS} FROM task WHERE id = ?`, [id]);
      if (!row) return null;
      const task = taskRowToTask(row);
      const stepsByTask = await loadStepsForTasks(db, [task.id]);
      return withSteps(task, stepsByTask.get(task.id) ?? []);
    },

    async insert(task: Task, steps: readonly Step[]): Promise<Result<Id>> {
      try {
        await db.withTransactionAsync(async () => {
          await db.runAsync(
            `INSERT INTO task (${TASK_COLUMNS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            taskParams(task),
          );
          for (const step of steps) {
            await db.runAsync(
              `INSERT INTO step (id, task_id, role, text, position, due_weekdays) VALUES (?,?,?,?,?,?)`,
              [step.id, task.id, step.role, step.text, step.position, step.dueWeekdays === null ? null : toJsonArray(step.dueWeekdays)],
            );
          }
        });
        return ok(task.id);
      } catch (cause) {
        return err({ code: 'WRITE_FAILED', message: cause instanceof Error ? cause.message : 'insert failed', cause });
      }
    },

    async update(id: Id, patch: Partial<Task>, steps?: readonly Step[]): Promise<Result<void>> {
      try {
        const existing = await db.getFirstAsync<TaskRow>(`SELECT ${TASK_COLUMNS} FROM task WHERE id = ?`, [id]);
        if (!existing) return err({ code: 'NOT_FOUND', message: `task ${id} not found` });
        const merged: Task = { ...taskRowToTask(existing), ...patch, id };
        await db.withTransactionAsync(async () => {
          await db.runAsync(
            `UPDATE task SET type=?, name=?, note=?, icon=?, color=?, is_as_needed=?, cadence_kind=?,
             cadence_weekdays=?, cadence_weekday=?, cadence_day_of_month=?, cadence_month=?,
             cadence_anchor_date=?, event_date=?, time_of_day=?, start_date=?, end_date=?,
             doses_per_day=?, is_tracked=?, importance=?, necessity=?, todo_done_at=?,
             created_at=?, updated_at=?, deleted_at=?, snoozable=? WHERE id=?`,
            [...taskParams(merged).slice(1), id],
          );
          if (steps) {
            await db.runAsync(`DELETE FROM step WHERE task_id = ?`, [id]);
            for (const step of steps) {
              await db.runAsync(
                `INSERT INTO step (id, task_id, role, text, position, due_weekdays) VALUES (?,?,?,?,?,?)`,
                [step.id, id, step.role, step.text, step.position, step.dueWeekdays === null ? null : toJsonArray(step.dueWeekdays)],
              );
            }
          }
        });
        return ok(undefined);
      } catch (cause) {
        return err({ code: 'WRITE_FAILED', message: cause instanceof Error ? cause.message : 'update failed', cause });
      }
    },

    // Split cascade — SCHEMA.md §2.3. Soft delete only; the hard sweep (which reproduces
    // the pinned split via FK actions) runs on the next StoreLifecycle.open().
    async softDelete(id: Id): Promise<Result<void>> {
      try {
        const result = await db.runAsync(`UPDATE task SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`, [
          now(),
          now(),
          id,
        ]);
        if (result.changes === 0) return err({ code: 'NOT_FOUND', message: `task ${id} not found or already deleted` });
        return ok(undefined);
      } catch (cause) {
        return err({ code: 'WRITE_FAILED', message: cause instanceof Error ? cause.message : 'delete failed', cause });
      }
    },

    // Copies definitions + metadata + toggle state; EMPTY history (no day_log/xp_award/etc).
    async duplicate(id: Id): Promise<Result<Id>> {
      try {
        const source = await db.getFirstAsync<TaskRow>(`SELECT ${TASK_COLUMNS} FROM task WHERE id = ?`, [id]);
        if (!source) return err({ code: 'NOT_FOUND', message: `task ${id} not found` });
        const stepsByTask = await loadStepsForTasks(db, [id as Id]);
        const sourceTask = taskRowToTask(source);
        const timestamp = now();
        const newTaskId = newId();
        const copy: Task = { ...sourceTask, id: newTaskId, createdAt: timestamp, updatedAt: timestamp, deletedAt: null };
        const newSteps: Step[] = (stepsByTask.get(id) ?? []).map((s) => ({ ...s, id: newId(), taskId: newTaskId }));
        await db.withTransactionAsync(async () => {
          await db.runAsync(
            `INSERT INTO task (${TASK_COLUMNS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            taskParams(copy),
          );
          for (const step of newSteps) {
            await db.runAsync(
              `INSERT INTO step (id, task_id, role, text, position, due_weekdays) VALUES (?,?,?,?,?,?)`,
              [step.id, newTaskId, step.role, step.text, step.position, step.dueWeekdays === null ? null : toJsonArray(step.dueWeekdays)],
            );
          }
        });
        return ok(newTaskId);
      } catch (cause) {
        return err({ code: 'WRITE_FAILED', message: cause instanceof Error ? cause.message : 'duplicate failed', cause });
      }
    },
  };
}
