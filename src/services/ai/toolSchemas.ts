/**
 * M6. B6 — real OpenAI-style function-calling JSON schemas for the five tools (matching
 * `AssistantToolCall` in `src/types/assistant.ts`), so the model has an actual contract for
 * what arguments to produce instead of a bare `{name}` with no `parameters`/`description`.
 *
 * This is the CLIENT (TypeScript) copy, consumed by `byoProvider.ts`. `server/src/toolSchemas.js`
 * is the separate, byte-parallel server (JavaScript) copy — deliberately not cross-imported,
 * per `docs/ARCHITECTURE.md`'s "separate deployable" rule for this backend (see that file's
 * own header, and `guardrails.ts`'s header for the same pattern already established).
 */
export interface OpenAiToolDefinition {
  readonly type: 'function';
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
  };
}

const STEP_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    dueWeekdays: { type: 'array', items: { type: 'integer', minimum: 1, maximum: 7 }, description: 'ISO weekdays (1=Mon..7=Sun) this step is due on; omit for every occurrence.' },
  },
  required: ['text'],
} as const;

const TASK_DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['routine', 'event', 'course', 'todo'] },
    name: { type: 'string' },
    note: { type: 'string' },
    icon: { type: 'string', description: 'A Lucide icon name.' },
    color: { type: 'string', enum: ['forge-orange', 'indigo', 'berry', 'plum'] },
    isAsNeeded: { type: 'boolean', description: 'Routine sub-variant only.' },
    cadence: { type: 'object', description: '{kind:"daily"|"specific-weekdays"|"weekly"|"bi-weekly"|"monthly"|"bi-monthly"|"yearly", ...kind-specific fields}. Omit for todo/as-needed.' },
    eventDate: { type: 'string', description: 'YYYY-MM-DD, event type only.' },
    timeOfDay: { type: 'string', description: 'HH:mm 24h, optional.' },
    startDate: { type: 'string', description: 'YYYY-MM-DD, course type only.' },
    endDate: { type: 'string', description: 'YYYY-MM-DD, course type only.' },
    dosesPerDay: { type: 'integer', minimum: 1 },
    isTracked: { type: 'boolean' },
    importance: { type: 'string', enum: ['high', 'med', 'low'] },
    necessity: { type: 'string', enum: ['must-do', 'recommended', 'optional'] },
    snoozable: { type: 'boolean' },
    idealSteps: { type: 'array', items: STEP_SCHEMA },
    fallbackSteps: { type: 'array', items: STEP_SCHEMA },
  },
  required: ['type', 'name', 'idealSteps', 'fallbackSteps'],
} as const;

export const TOOL_DEFINITIONS: readonly OpenAiToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new routine, event, course, or to-do, each with an ideal and a fallback set of steps.',
      parameters: TASK_DRAFT_SCHEMA,
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Edit an existing task by id, applying only the given fields.',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          patch: { ...TASK_DRAFT_SCHEMA, required: [] as string[], description: 'Partial fields to change — only include what changes.' },
        },
        required: ['taskId', 'patch'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_task',
      description: 'Delete a task by id.',
      parameters: { type: 'object', properties: { taskId: { type: 'string' } }, required: ['taskId'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'log_state',
      description: "Log a task's state for a specific date.",
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          state: { type: 'string', enum: ['done', 'fallback', 'skip', 'todo'] },
        },
        required: ['taskId', 'date', 'state'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_clarification',
      description: 'Ask the user which of several candidate tasks they meant, when a name reference is ambiguous.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: {
            type: 'array',
            items: { type: 'object', properties: { taskId: { type: 'string' }, label: { type: 'string' } }, required: ['taskId', 'label'] },
          },
        },
        required: ['question', 'options'],
      },
    },
  },
] as const;
