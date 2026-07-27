/**
 * M6. F16 — orchestrates one assistant conversation for S32 (and S35's "continue"): holds
 * the provider, streams turns, applies tool calls ONLY through `useToolExecutor` (M2's
 * validator + mutations — never a direct write), and persists the transcript via
 * `src/services/ai/conversationStore.ts`.
 */
import { useCallback, useRef, useState } from 'react';

import { useAssistantSessionStore } from '@/app-shell';
import { getAssistantProvider, appendMessage, upsertConversation } from '@/services/ai';
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
  readonly conversationId?: Id;
  readonly initialModality?: AssistantModality;
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
  const session = useAssistantSessionStore();

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
      await persistTurn(userMessage);

      setIsStreaming(true);
      session.setStreaming(true);
      try {
        const provider = await getAssistantProvider();
        let assistantText = '';
        let lastSummary = '';
        for await (const event of provider.streamChat({ conversationId: conversationIdRef.current, messages: [userMessage], signal: undefined })) {
          if (event.type === 'text-delta') {
            assistantText += event.delta;
          } else if (event.type === 'tool-call') {
            await handleToolCall(event.call);
          } else if (event.type === 'refusal') {
            assistantText += (assistantText ? '\n' : '') + event.text;
          } else if (event.type === 'error') {
            setOffline(true);
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
          await persistTurn(assistantMessage);
        }
        await finalizeConversation(lastSummary || assistantText.slice(0, 140));
      } finally {
        setIsStreaming(false);
        session.setStreaming(false);
      }

      async function handleToolCall(call: AssistantToolCall) {
        if (call.name === 'ask_clarification') {
          setClarification({ question: call.args.question, options: call.args.options });
          return;
        }
        const result = await applyToolCall(call);
        if (!result.applied) return; // dropped — malformed/invalid, never a half-written task
        if (result.taskId) touchedTaskIds.current.add(result.taskId);
        if (result.task && call.name === 'create_task') {
          appendItem({ id: newId(), kind: 'task-card', task: result.task });
        }
        if (call.name === 'update_task' && result.undo) {
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
        }
      }
    },
    [appendItem, applyToolCall, finalizeConversation, persistTurn, session],
  );

  const resolveClarification = useCallback(
    (taskId: Id) => {
      const option = clarification?.options.find((o) => o.taskId === taskId);
      setClarification(null);
      if (option) {
        appendItem({ id: newId(), kind: 'assistant', text: `Got it — logged for ${option.label.split(' — ')[0]}.` });
      }
    },
    [appendItem, clarification],
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
