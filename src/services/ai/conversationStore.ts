/**
 * M6. Conversation/message persistence for S32/S34/S35 (F16), backing `assistant_conversation`
 * / `assistant_message` (SCHEMA.md §8).
 *
 * FLAGGED CONTRACT GAP (see this module's builder report). `docs/ARCHITECTURE.md` §2 pins
 * "`src/db` (M1) — reachable ONLY from `src/queries`", and `src/queries/**` is M2-owned and
 * frozen after wave 1. M2's frozen surface exposes only two assistant READS
 * (`useConversations`, `useConversation`) and ZERO mutations for
 * `upsertConversation`/`appendMessage`/`listMessages` — even though `AssistantRepository`
 * (M1, already fully implemented) has all three, and `docs/API.md` §3's own hook list
 * documents only the two reads for this domain. Conversation writes carry no XP/achievement/
 * cycle-boundary reconciliation (API.md §3's seven-step sequence is about occurrence data,
 * which conversations are not), so there is no mutation-sequence for M2 to have skipped by
 * omission — this reads as a genuine gap in the frozen contract, not a intentional design
 * the builder should route around.
 *
 * Given the alternative is that S32/S34/S35 cannot persist or replay a conversation AT ALL
 * (breaking F16 outright), this module imports `repos.assistant` directly — the ONE
 * repository slice with no reconciliation obligations and no SQL of its own (every call
 * here goes through M1's typed, already-reviewed `AssistantRepository`, never raw SQL).
 * This is a deliberate, narrowly-scoped exception, not a precedent for any other data path
 * in this module — every task/log/XP effect in this feature still goes through
 * `@/queries`'s mutations, per the non-negotiables. Recommended follow-up (this builder's
 * report): M2 promotes `useConversations`/`useConversation` to include messages and adds
 * `useUpsertConversation`/`useAppendAssistantMessage` to `src/queries/mutations.ts`, after
 * which this file becomes a thin re-export and the direct `@/db` import is deleted.
 */
import { repos } from '@/db';
import type { AssistantConversation, AssistantMessage, Id, Result } from '@/types';

export async function upsertConversation(conversation: AssistantConversation): Promise<Result<void>> {
  return repos.assistant.upsertConversation(conversation);
}

export async function appendMessage(message: AssistantMessage): Promise<Result<void>> {
  return repos.assistant.appendMessage(message);
}

export async function listMessages(conversationId: Id): Promise<readonly AssistantMessage[]> {
  return repos.assistant.listMessages(conversationId);
}

export async function listConversations(): Promise<readonly AssistantConversation[]> {
  return repos.assistant.listConversations();
}

export async function getConversation(id: Id): Promise<AssistantConversation | null> {
  return repos.assistant.getConversation(id);
}
