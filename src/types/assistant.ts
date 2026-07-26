/** M0. F16/F18 assistant boundary. Full contract: docs/API.md §4. */

import type { Id, Instant } from './primitives';
import type { TaskDraft } from './task';

export type AssistantModality = 'voice' | 'text' | 'voice+text';
export type AssistantRole = 'user' | 'assistant';

export interface AssistantMessage {
  readonly id: Id;
  readonly conversationId: Id;
  readonly role: AssistantRole;
  readonly text: string;
  /** Tool calls the model emitted in this turn. Applied LOCALLY by the client — never server-side. */
  readonly toolCalls: readonly AssistantToolCall[];
  readonly createdAt: Instant;
}

export interface AssistantConversation {
  readonly id: Id;
  readonly startedAt: Instant;
  readonly updatedAt: Instant;
  readonly modality: AssistantModality;
  /** The assistant's own one-line recap, shown on S34. */
  readonly summary: string;
  readonly taskIdsTouched: readonly Id[];
}

/* --------------------------------------------------------------- tool calls */

export type AssistantToolName =
  | 'create_task'
  | 'update_task'
  | 'delete_task'
  | 'log_state'
  | 'ask_clarification';

export type AssistantToolCall =
  | { readonly id: Id; readonly name: 'create_task'; readonly args: TaskDraft }
  | { readonly id: Id; readonly name: 'update_task'; readonly args: { taskId: Id; patch: Partial<TaskDraft> } }
  | { readonly id: Id; readonly name: 'delete_task'; readonly args: { taskId: Id } }
  | { readonly id: Id; readonly name: 'log_state'; readonly args: { taskId: Id; date: string; state: 'done' | 'fallback' | 'skip' | 'todo' } }
  | { readonly id: Id; readonly name: 'ask_clarification'; readonly args: { question: string; options: readonly { taskId: Id; label: string }[] } };

/** Inverse of an applied tool call, for F16's Undo. Lives in memory per conversation. */
export interface AssistantUndoEntry {
  readonly toolCallId: Id;
  readonly label: string;
  readonly revert: () => Promise<void>;
}

/* --------------------------------------------------------------- streaming */

export type AssistantEvent =
  | { readonly type: 'text-delta'; readonly delta: string }
  | { readonly type: 'tool-call'; readonly call: AssistantToolCall }
  | { readonly type: 'refusal'; readonly category: GuardrailCategory; readonly text: string }
  | { readonly type: 'done'; readonly summary: string }
  | { readonly type: 'error'; readonly code: string; readonly message: string };

/** R15 categories the assistant must decline, while still fulfilling any literal logging request. */
export type GuardrailCategory =
  | 'self-harm'
  | 'harm-to-others'
  | 'illegal-activity'
  | 'medical-advice'
  | 'disordered-eating';

export interface AssistantCapabilities {
  readonly chat: boolean;
  readonly transcription: boolean;
}
