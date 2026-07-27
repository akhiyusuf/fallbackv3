/**
 * M6. F16 — orchestrates one assistant conversation for S32 (and S35's "continue"): holds
 * the provider, streams turns, applies tool calls ONLY through `useToolExecutor` (M2's
 * validator + mutations — never a direct write), and persists the transcript via
 * `src/services/ai/conversationStore.ts`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAssistantSessionStore } from '@/app-shell';
import { getAssistantProvider, appendMessage, listMessages, upsertConversation } from '@/services/ai';
import { newId } from '@/lib/id';
import { now } from '@/lib/date';
import type { AssistantMessage, AssistantModality, AssistantToolCall, Id, TaskWithSteps } from '@/types';

import { useToolExecutor } from './toolExecutor';

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

export function useAssistantChat(options?: UseAssistantChatOptions) {
  const { applyToolCall } = useToolExecutor();
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [offline, setOffline] = useState(false);
  const [clarification, setClarification] = useState<ClarificationState | null>(null);
  const conversationIdRef = useRef<Id>(options?.conversationId ?? (newId() as Id));
  const startedAtRef = useRef(now());
  const touchedTaskIds = useRef<Set<Id>>(new Set());
  const lastUserTextRef = useRef<string | null>(null);
  // B9 — the running turn history sent to the provider on every request. Seeded from
  // persisted messages when resuming a conversation; otherwise starts empty.
  const historyRef = useRef<AssistantMessage[]>([]);
  const session = useAssistantSessionStore();

  useEffect(() => {
    if (!options?.conversationId) return;
    let alive = true;
    void (async () => {
      const existing = await listMessages(options.conversationId as Id);
      if (!alive) return;
      historyRef.current = [...existing];
      setItems(existing.map((m) => ({ id: m.id, kind: m.role, text: m.text })));
    })();
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
      id: conversationIdRef.current,
      startedAt: startedAtRef.current,
      updatedAt: now(),
      modality: options?.initialModality ?? 'text',
      summary,
      taskIdsTouched: [...touchedTaskIds.current],
    });
  }, [options?.initialModality]);

  const handleToolCall = useCallback(
    async (call: AssistantToolCall) => {
      if (call.name === 'ask_clarification') {
        setClarification({ question: call.args.question, options: call.args.options });
        return;
      }
      const result = await applyToolCall(call);
      if (!result.applied) return; // dropped — malformed/invalid, never a half-written task
      if (result.taskId) touchedTaskIds.current.add(result.taskId);
      if (result.task && call.name === 'create_task') {
        appendItem({ id: newId(), kind: 'task-card', task: result.task });
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
            appendItem({ id: newId(), kind: 'assistant', text: 'Reverted — changes moved back to their previous state.' });
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
    setIsStreaming(true);
    session.setStreaming(true);
    try {
      const provider = await getAssistantProvider();
      let assistantText = '';
      let lastSummary = '';
      for await (const event of provider.streamChat({ conversationId: conversationIdRef.current, messages: historyRef.current, signal: undefined })) {
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
      if (assistantText) {
        appendItem({ id: newId(), kind: 'assistant', text: assistantText });
        const assistantMessage: AssistantMessage = {
          id: newId(),
          conversationId: conversationIdRef.current,
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
      lastUserTextRef.current = text;
      const userItemId = newId();
      appendItem({ id: userItemId, kind: 'user', text });
      const userMessage: AssistantMessage = {
        id: newId(),
        conversationId: conversationIdRef.current,
        role: 'user',
        text,
        toolCalls: [],
        createdAt: now(),
      };
      historyRef.current = [...historyRef.current, userMessage];
      await persistTurn(userMessage);
      await streamAndApply();
    },
    [appendItem, persistTurn, streamAndApply],
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
        conversationId: conversationIdRef.current,
        role: 'user',
        text: `Use "${option.label}" for the request that needed clarifying.`,
        toolCalls: [],
        createdAt: now(),
      };
      historyRef.current = [...historyRef.current, resolutionMessage];
      await persistTurn(resolutionMessage);
      await streamAndApply();
    },
    [clarification, persistTurn, streamAndApply],
  );

  const dismissClarification = useCallback(() => {
    setClarification(null);
    appendItem({ id: newId(), kind: 'assistant', text: "No worries — let me know which one whenever you're ready." });
  }, [appendItem]);

  const retryLast = useCallback(() => {
    if (lastUserTextRef.current) void sendMessage(lastUserTextRef.current);
  }, [sendMessage]);

  const taskCards = items.filter((i): i is Extract<TranscriptItem, { kind: 'task-card' }> => i.kind === 'task-card');
  const editBanners = items.filter((i): i is Extract<TranscriptItem, { kind: 'edit-undo' }> => i.kind === 'edit-undo');

  return {
    conversationId: conversationIdRef.current,
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
