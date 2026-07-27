/**
 * M6 backend. B6 — real OpenAI-style function-calling JSON schemas for the five tools
 * (matching `AssistantToolCall` in `src/types/assistant.ts`), so Groq has an actual contract
 * for what arguments to produce instead of a bare `{name}` with no `parameters`/`description`.
 *
 * This is the SERVER (JavaScript) copy, consumed by `groq.js`. `src/services/ai/toolSchemas.ts`
 * is the separate, byte-parallel client (TypeScript) copy — deliberately not cross-imported;
 * this backend is its own deployable with zero npm dependencies (see this directory's
 * `package.json` header) and cannot import from `src/**`.
 */

const STEP_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    dueWeekdays: { type: 'array', items: { type: 'integer', minimum: 1, maximum: 7 }, description: 'ISO weekdays (1=Mon..7=Sun) this step is due on; omit for every occurrence.' },
  },
  required: ['text'],
};

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
};

/** @type {Record<string, { description: string, parameters: object }>} */
const TOOL_SCHEMAS_BY_NAME = {
  create_task: {
    description: 'Create a new routine, event, course, or to-do, each with an ideal and a fallback set of steps.',
    parameters: TASK_DRAFT_SCHEMA,
  },
  update_task: {
    description: 'Edit an existing task by id, applying only the given fields.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        patch: { ...TASK_DRAFT_SCHEMA, required: [], description: 'Partial fields to change — only include what changes.' },
      },
      required: ['taskId', 'patch'],
    },
  },
  delete_task: {
    description: 'Delete a task by id.',
    parameters: { type: 'object', properties: { taskId: { type: 'string' } }, required: ['taskId'] },
  },
  log_state: {
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
  ask_clarification: {
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
};

/** Builds the OpenAI-style `tools` array for a list of tool names, falling back to a bare
 *  name-only definition for any (unexpected) name not in the schema map, so a request never
 *  hard-fails on an unrecognised tool name. */
export function toolDefinitionsFor(names) {
  return names.map((name) => {
    const schema = TOOL_SCHEMAS_BY_NAME[name];
    if (!schema) return { type: 'function', function: { name } };
    return { type: 'function', function: { name, description: schema.description, parameters: schema.parameters } };
  });
}

export { TOOL_SCHEMAS_BY_NAME };
