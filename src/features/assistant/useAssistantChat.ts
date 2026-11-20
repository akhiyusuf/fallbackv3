/**
 * M6. F16 — orchestrates one assistant conversation for S32 (and S35's "continue"): holds
 * the provider, streams turns, applies tool calls ONLY through `useToolExecutor` (M2's
 * validator + mutations — never a direct write), and persists the transcript via
 * `src/services/ai/conversationStore.ts`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAssistantSessionStore } from '@/app-shell';
import { getAssistantProvider, appendMessage, getConversation, listMessages, upsertConversation } from '@/services/ai';
import { newId } from '@/lib/id';
import { now } from '@/lib/date';
import type { AssistantConversation, AssistantMessage, AssistantModality, AssistantToolCall, Id, TaskWithSteps } from '@/types';

import { SUPPORTED_TOOL_NAMES, useToolExecutor } from './toolExecutor';

export type TranscriptItem =
  | { readonly id: string; readonly kind: 'user'; readonly text: string }
  | { readonly id: string; readonly kind: 'assistant'; readonly text: string }
  | { readonly id: string; readonly kind: 'task-card'; readonly task: TaskWithSteps }
  | { readonly id: string; readonly kind: 'edit-undo'; readonly label: string; readonly onUndo: () => void; readonly undone: boolean };

export interface ClarificationState {
  readonly question: string;
  readonly options: readonly { readonly taskId: Id; readonly label: string }[];
}

export interface UseAssistantChatOptions {
  /** B9 — when set (S35's "continue this chat"), resumes the SAME conversation thread: the
   *  prior transcript is seeded from `listMessages` and sent as history on every turn,
   *  instead of silently starting a new one. */
  readonly conversationId?: Id;
  readonly initialModality?: AssistantModality;
  /** B4 — an `error` stream event carrying ENTITLEMENT_REQUIRED/ENTITLEMENT_EXPIRED (API.md
   *  §4) must route to the paywall, never render as "you're offline". */
  readonly onEntitlementError?: (code: 'ENTITLEMENT_REQUIRED' | 'ENTITLEMENT_EXPIRED') => void;
}

export const DROPPED_CALL_LINE = "I couldn't do that one. It may have ended, been deleted, or not been something I could set up. Nothing was changed.";

export const UNSUPPORTED_CALL_LINE =
  "I can't do that one from here yet. To end a routine, push it to tomorrow or take the day off, open the routine and use End routine, Push to tomorrow or Emergency day off. Nothing was changed.";

export const DELETE_NEEDS_NAME_LINE = 'To delete a habit, say its name, like "delete Morning run". Nothing was changed.';

/** How many of the latest messages go to the model on each turn. A very long chat is trimmed, never sent whole. */
export const HISTORY_LIMIT = 40;

/** The last `HISTORY_LIMIT` messages, starting on one the person wrote (a reply with no question before it confuses a model). */
export function trimHistory(messages: readonly AssistantMessage[]): readonly AssistantMessage[] {
  if (messages.length <= HISTORY_LIMIT) return messages;
  const tail = messages.slice(messages.length - HISTORY_LIMIT);
  const firstUser = tail.findIndex((m) => m.role === 'user');
  return firstUser <= 0 ? tail : tail.slice(firstUser);
}

/** A clarification the model sent must be a question and a list of options with ids, or it is dropped (never a crash). */
function parseClarification(args: unknown): ClarificationState | null {
  if (!args || typeof args !== 'object') return null;
  const { question, options } = args as { question?: unknown; options?: unknown };
  if (typeof question !== 'string' || !Array.isArray(options)) return null;
  const valid = options.filter(
    (o): o is { taskId: Id; label: string } => !!o && typeof o === 'object' && typeof (o as { taskId?: unknown }).taskId === 'string' && typeof (o as { label?: unknown }).label === 'string',
  );
  return valid.length === 0 ? null : { question, options: valid };
}

export function useAssistantChat(options?: UseAssistantChatOptions) {
  const { applyToolCall } = useToolExecutor();
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [offline, setOffline] = useState(false);
  const [clarification, setClarification] = useState<ClarificationState | null>(null);
  // Fixed for the life of this hook instance; state rather than a ref so it can be returned.
  const [conversationId] = useState<Id>(() => options?.conversationId ?? (newId() as Id));
  const startedAtRef = useRef(now());
  const touchedTaskIds = useRef<Set<Id>>(new Set());
  const lastUserTextRef = useRef<string | null>(null);
  // B9 — the running turn history sent to the provider on every request. Seeded from
  // persisted messages when resuming a conversation; otherwise starts empty.
  const historyRef = useRef<AssistantMessage[]>([]);
  // A resumed conversation keeps its first start time, its modality and the habits it touched earlier.
  const resumedRef = useRef<{ startedAt: AssistantConversation['startedAt']; modality: AssistantModality } | null>(null);
  // One model turn at a time: a second message sent while the first reply is still streaming waits its turn.
  const turnChainRef = useRef<Promise<unknown>>(Promise.resolve());
  // A resumed chat loads its earlier messages first; a turn never starts (or sends history) before that lands.
  const seedRef = useRef<Promise<void>>(Promise.resolve());
  const enqueueTurn = useCallback(<T,>(job: () => Promise<T>): Promise<T> => {
    const guarded = async () => {
      await seedRef.current;
      return job();
    };
    const run = turnChainRef.current.then(guarded, guarded);
    turnChainRef.current = run.catch(() => undefined);
    return run;
  }, []);
  const session = useAssistantSessionStore();

  useEffect(() => {
    if (!options?.conversationId) return;
    let alive = true;
    seedRef.current = (async () => {
      const existing = await listMessages(options.conversationId as Id);
      let prior: Awaited<ReturnType<typeof getConversation>> = null;
      try {
        prior = await getConversation(options.conversationId as Id);
      } catch {
        prior = null;
      }
      if (!alive) return;
      if (prior) {
        resumedRef.current = { startedAt: prior.startedAt, modality: prior.modality };
        for (const id of prior.taskIdsTouched) touchedTaskIds.current.add(id);
      }
      historyRef.current = [...existing];
      // Anything the person already typed (an opening message) stays below the earlier lines.
      setItems((prev) => [...existing.map((m): TranscriptItem => ({ id: m.id, kind: m.role, text: m.text })), ...prev]);
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
    // Only ever seeds once, for the conversation this hook instance was created with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const appendItem = useCallback((item: TranscriptItem) => setItems((prev) => [...prev, item]), []);

  const persistTurn = useCallback(async (message: AssistantMessage) => {
    session.appendMessage(message);
    await appendMessage(message);
  }, [session]);

  const finalizeConversation = useCallback(async (summary: string) => {
    await upsertConversation({
      id: conversationId,
      startedAt: resumedRef.current?.startedAt ?? startedAtRef.current,
      updatedAt: now(),
      modality: resumedRef.current?.modality ?? options?.initialModality ?? 'text',
      summary,
      taskIdsTouched: [...touchedTaskIds.current],
    });
  }, [conversationId, options?.initialModality]);

  const handleToolCall = useCallback(
    async (call: AssistantToolCall) => {
      if (call.name === 'ask_clarification') {
        const parsed = parseClarification(call.args);
        if (parsed) setClarification(parsed);
        else appendItem({ id: newId(), kind: 'assistant', text: DROPPED_CALL_LINE });
        return;
      }
      if (!SUPPORTED_TOOL_NAMES.includes(call.name as string)) {
        appendItem({ id: newId(), kind: 'assistant', text: UNSUPPORTED_CALL_LINE });
        return;
      }
      // The person's own latest words, so a delete can be checked against what they named (see toolExecutor).
      const result = await applyToolCall(call, { personSaid: lastUserTextRef.current ?? '' });
      if (!result.applied) {
        // Dropped: malformed, invalid, or aimed at something that is gone or ended. Never a
        // half-written task, and never silence either: say so, calmly.
        appendItem({ id: newId(), kind: 'assistant', text: result.reason === 'name-not-said' ? DELETE_NEEDS_NAME_LINE : DROPPED_CALL_LINE });
        return;
      }
      if (result.taskId) touchedTaskIds.current.add(result.taskId);
      if (result.task && call.name === 'create_task') {
        appendItem({ id: newId(), kind: 'task-card', task: result.task });
      } else if (call.name === 'create_task') {
        // The created task is not in this turn's task list yet, so no card can be built;
        // the applied write still gets its calm confirmation line, never silence.
        appendItem({ id: newId(), kind: 'assistant', text: result.summary });
      } else if (call.name === 'update_task' && result.undo) {
        const entry = result.undo;
        session.pushUndo(entry);
        appendItem({
          id: entry.toolCallId,
          kind: 'edit-undo',
          label: result.summary,
          undone: false,
          onUndo: async () => {
            await entry.revert();
            setItems((prev) =>
              prev.map((it) => (it.id === entry.toolCallId && it.kind === 'edit-undo' ? { ...it, undone: true } : it)),
            );
            appendItem({ id: newId(), kind: 'assistant', text: 'Reverted. Changes moved back to their previous state.' });
          },
        });
      } else if (call.name === 'log_state' || call.name === 'delete_task') {
        // B8 — surface the REAL applied result, not a fabricated confirmation string. This
        // is the only place `log_state`/`delete_task` get a transcript line, and it only
        // fires once the mutation has actually succeeded above.
        appendItem({ id: newId(), kind: 'assistant', text: result.summary });
      }
    },
    [applyToolCall, appendItem, session],
  );

  // B9 — runs one model turn over the FULL running history (not just the latest message),
  // applying any tool calls and appending the assistant's reply. Shared by `sendMessage` and
  // `resolveClarification` (B8) so a clarification resolution goes through the exact same
  // real application path as a normal turn — never a hand-rolled "logged" string.
  const streamAndApply = useCallback(async () => {
    // A later turn that starts clears a banner left by an earlier failed one.
    setOffline(false);
    setIsStreaming(true);
    session.setStreaming(true);
    try {
      let assistantText = '';
      let lastSummary = '';
      // A provider that cannot even start, or a stream that throws part way, is "offline" to the
      // person: the same calm banner and Try again, never an unhandled rejection out of a tap.
      try {
        const provider = await getAssistantProvider();
        for await (const event of provider.streamChat({ conversationId: conversationId, messages: trimHistory(historyRef.current), signal: undefined })) {
          if (event.type === 'text-delta') {
            assistantText += event.delta;
          } else if (event.type === 'tool-call') {
            await handleToolCall(event.call);
          } else if (event.type === 'refusal') {
            assistantText += (assistantText ? '\n' : '') + event.text;
          } else if (event.type === 'error') {
            // B4 — an entitlement error mid-chat is NOT "offline": route to the paywall per
            // API.md §4's client-behaviour table instead of rendering the offline footer.
            if (event.code === 'ENTITLEMENT_REQUIRED' || event.code === 'ENTITLEMENT_EXPIRED') {
              options?.onEntitlementError?.(event.code);
            } else {
              setOffline(true);
            }
          } else if (event.type === 'done') {
            lastSummary = event.summary;
          }
        }
      } catch {
        setOffline(true);
      }
      if (assistantText) {
        appendItem({ id: newId(), kind: 'assistant', text: assistantText });
        const assistantMessage: AssistantMessage = {
          id: newId(),
          conversationId: conversationId,
          role: 'assistant',
          text: assistantText,
          toolCalls: [],
          createdAt: now(),
        };
        historyRef.current = [...historyRef.current, assistantMessage];
        await persistTurn(assistantMessage);
      }
      await finalizeConversation(lastSummary || assistantText.slice(0, 140));
    } finally {
      setIsStreaming(false);
      session.setStreaming(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appendItem, finalizeConversation, handleToolCall, options, persistTurn, session]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setOffline(false);
      // The person's words show at once; the model turn itself waits for any reply still streaming.
      appendItem({ id: newId(), kind: 'user', text });
      await enqueueTurn(async () => {
        lastUserTextRef.current = text;
        const userMessage: AssistantMessage = {
          id: newId(),
          conversationId: conversationId,
          role: 'user',
          text,
          toolCalls: [],
          createdAt: now(),
        };
        historyRef.current = [...historyRef.current, userMessage];
        await persistTurn(userMessage);
        await streamAndApply();
      });
    },
    [appendItem, enqueueTurn, persistTurn, streamAndApply],
  );

  const resolveClarification = useCallback(
    async (taskId: Id) => {
      const option = clarification?.options.find((o) => o.taskId === taskId);
      setClarification(null);
      if (!option) return;
      // B8 — the clarification itself never applies a write; it re-sends the user's choice
      // to the model (same history + a resolution turn) so the model can re-propose the
      // actual tool call, which is then applied through the SAME `handleToolCall` path as
      // any other turn — never a hand-written "logged" claim with no mutation behind it.
      const resolutionMessage: AssistantMessage = {
        id: newId(),
        conversationId: conversationId,
        role: 'user',
        text: `Use "${option.label}" for the request that needed clarifying.`,
        toolCalls: [],
        createdAt: now(),
      };
      await enqueueTurn(async () => {
        lastUserTextRef.current = resolutionMessage.text;
        // Two habits can share a name, so the model is told WHICH one by id; the saved transcript keeps the plain words.
        historyRef.current = [...historyRef.current, { ...resolutionMessage, text: `${resolutionMessage.text} (task id: ${option.taskId})` }];
        await persistTurn(resolutionMessage);
        await streamAndApply();
      });
    },
    [clarification, enqueueTurn, persistTurn, streamAndApply],
  );

  const dismissClarification = useCallback(() => {
    setClarification(null);
    appendItem({ id: newId(), kind: 'assistant', text: "No worries. Let me know which one whenever you're ready." });
  }, [appendItem]);

  // The failed turn's user message is already in the transcript and in `historyRef`, so a retry
  // re-runs the model over that history instead of appending the same text a second time.
  const retryLast = useCallback(() => {
    if (!lastUserTextRef.current) return;
    setOffline(false);
    void enqueueTurn(streamAndApply);
  }, [enqueueTurn, streamAndApply]);

  const taskCards = items.filter((i): i is Extract<TranscriptItem, { kind: 'task-card' }> => i.kind === 'task-card');
  const editBanners = items.filter((i): i is Extract<TranscriptItem, { kind: 'edit-undo' }> => i.kind === 'edit-undo');

  return {
    conversationId: conversationId,
    items,
    isStreaming,
    offline,
    clarification,
    sendMessage,
    resolveClarification,
    dismissClarification,
    retryLast,
    recap: { taskCards, editBanners },
  };
}
