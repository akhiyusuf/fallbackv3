/**
 * M0. The one place an in-flight assistant conversation lives before it is persisted
 * (ARCHITECTURE §3, tier 2). M6 owns the read/write behaviour; M0 owns the store shape.
 */
import { create } from 'zustand';

import type { AssistantModality, AssistantMessage, AssistantUndoEntry } from '@/types';
import type { Id } from '@/types';

export interface AssistantSessionState {
  readonly conversationId: Id | null;
  readonly modality: AssistantModality;
  readonly messages: readonly AssistantMessage[];
  readonly undoStack: readonly AssistantUndoEntry[];
  readonly isStreaming: boolean;
  start(conversationId: Id, modality: AssistantModality): void;
  appendMessage(message: AssistantMessage): void;
  setStreaming(isStreaming: boolean): void;
  pushUndo(entry: AssistantUndoEntry): void;
  popUndo(): AssistantUndoEntry | undefined;
  reset(): void;
}

const initial = {
  conversationId: null as Id | null,
  modality: 'text' as AssistantModality,
  messages: [] as readonly AssistantMessage[],
  undoStack: [] as readonly AssistantUndoEntry[],
  isStreaming: false,
};

export const useAssistantSessionStore = create<AssistantSessionState>((set, get) => ({
  ...initial,
  start: (conversationId, modality) => set({ conversationId, modality, messages: [], undoStack: [], isStreaming: false }),
  appendMessage: (message) => set({ messages: [...get().messages, message] }),
  setStreaming: (isStreaming) => set({ isStreaming }),
  pushUndo: (entry) => set({ undoStack: [...get().undoStack, entry] }),
  popUndo: () => {
    const stack = get().undoStack;
    const last = stack[stack.length - 1];
    if (last) set({ undoStack: stack.slice(0, -1) });
    return last;
  },
  reset: () => set({ ...initial }),
}));
