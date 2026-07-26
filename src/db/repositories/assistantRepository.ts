/** M1. `AssistantRepository` — docs/API.md §1. `assistant_conversation` / `assistant_message`. */
import { err, ok } from '@/types';
import type { AssistantConversation, AssistantMessage, AssistantModality, AssistantRole, AssistantToolCall, Id, Instant, Result } from '@/types';

import type { DbClient } from '../client';
import { parseJsonArray, toJsonArray } from '../json';

interface ConversationRow {
  readonly id: string;
  readonly started_at: string;
  readonly updated_at: string;
  readonly modality: string;
  readonly summary: string;
  readonly task_ids_touched: string;
}

function rowToConversation(row: ConversationRow): AssistantConversation {
  return {
    id: row.id as Id,
    startedAt: row.started_at as Instant,
    updatedAt: row.updated_at as Instant,
    modality: row.modality as AssistantModality,
    summary: row.summary,
    taskIdsTouched: parseJsonArray<Id>(row.task_ids_touched),
  };
}

interface MessageRow {
  readonly id: string;
  readonly conversation_id: string;
  readonly role: string;
  readonly text: string;
  readonly tool_calls: string;
  readonly created_at: string;
}

function rowToMessage(row: MessageRow): AssistantMessage {
  return {
    id: row.id as Id,
    conversationId: row.conversation_id as Id,
    role: row.role as AssistantRole,
    text: row.text,
    toolCalls: parseJsonArray<AssistantToolCall>(row.tool_calls),
    createdAt: row.created_at as Instant,
  };
}

const CONVERSATION_COLUMNS = `id, started_at, updated_at, modality, summary, task_ids_touched`;
const MESSAGE_COLUMNS = `id, conversation_id, role, text, tool_calls, created_at`;

export function createAssistantRepository(db: DbClient) {
  return {
    async listConversations(): Promise<readonly AssistantConversation[]> {
      const rows = await db.getAllAsync<ConversationRow>(`SELECT ${CONVERSATION_COLUMNS} FROM assistant_conversation ORDER BY started_at DESC`);
      return rows.map(rowToConversation);
    },

    async getConversation(id: Id): Promise<AssistantConversation | null> {
      const row = await db.getFirstAsync<ConversationRow>(`SELECT ${CONVERSATION_COLUMNS} FROM assistant_conversation WHERE id = ?`, [id]);
      return row ? rowToConversation(row) : null;
    },

    async listMessages(conversationId: Id): Promise<readonly AssistantMessage[]> {
      const rows = await db.getAllAsync<MessageRow>(`SELECT ${MESSAGE_COLUMNS} FROM assistant_message WHERE conversation_id = ? ORDER BY created_at`, [
        conversationId,
      ]);
      return rows.map(rowToMessage);
    },

    async upsertConversation(c: AssistantConversation): Promise<Result<void>> {
      try {
        await db.runAsync(
          `INSERT INTO assistant_conversation (${CONVERSATION_COLUMNS}) VALUES (?,?,?,?,?,?)
           ON CONFLICT (id) DO UPDATE SET updated_at = excluded.updated_at, summary = excluded.summary,
             task_ids_touched = excluded.task_ids_touched, modality = excluded.modality`,
          [c.id, c.startedAt, c.updatedAt, c.modality, c.summary, toJsonArray(c.taskIdsTouched)],
        );
        return ok(undefined);
      } catch (cause) {
        return err({ code: 'WRITE_FAILED', message: cause instanceof Error ? cause.message : 'upsertConversation failed', cause });
      }
    },

    async appendMessage(m: AssistantMessage): Promise<Result<void>> {
      try {
        await db.runAsync(`INSERT INTO assistant_message (${MESSAGE_COLUMNS}) VALUES (?,?,?,?,?,?)`, [
          m.id,
          m.conversationId,
          m.role,
          m.text,
          toJsonArray(m.toolCalls),
          m.createdAt,
        ]);
        return ok(undefined);
      } catch (cause) {
        return err({ code: 'WRITE_FAILED', message: cause instanceof Error ? cause.message : 'appendMessage failed', cause });
      }
    },
  };
}
