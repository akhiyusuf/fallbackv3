/**
 * Hook-level coverage for B8 (clarification resolution must actually apply, never claim a
 * write that never happened) and B9 (conversation continuity — `conversationId` seeds the
 * transcript and the FULL running history is sent on every turn, not just the latest turn).
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const mockCreateTaskMutateAsync = jest.fn();
const mockUpdateTaskMutateAsync = jest.fn();
const mockDeleteTaskMutateAsync = jest.fn();
const mockLogStateMutateAsync = jest.fn();
const mockTasksData: { current: unknown[] } = { current: [{ id: 'task-1', name: 'Morning workout' }] };

jest.mock('@/queries', () => ({
  useTasks: () => ({ data: mockTasksData.current }),
  useCreateTask: () => ({ mutateAsync: mockCreateTaskMutateAsync }),
  useUpdateTask: () => ({ mutateAsync: mockUpdateTaskMutateAsync }),
  useDeleteTask: () => ({ mutateAsync: mockDeleteTaskMutateAsync }),
  useLogState: () => ({ mutateAsync: mockLogStateMutateAsync }),
}));

const mockAppendMessage = jest.fn(async () => ({ ok: true, value: undefined }));
const mockUpsertConversation = jest.fn(async () => ({ ok: true, value: undefined }));
const mockListMessages = jest.fn(async () => [] as unknown[]);
const mockGetAssistantProvider = jest.fn();
jest.mock('@/services/ai', () => ({
  getAssistantProvider: () => mockGetAssistantProvider(),
  appendMessage: (m: unknown) => mockAppendMessage(m),
  upsertConversation: (c: unknown) => mockUpsertConversation(c),
  listMessages: (id: unknown) => mockListMessages(id),
}));

import { useAssistantChat } from '../useAssistantChat';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

async function* stream(events: readonly unknown[]) {
  for (const e of events) yield e as never;
}

describe('useAssistantChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListMessages.mockResolvedValue([]);
  });

  it('B8 — resolving a clarification actually applies the resolved log_state via useLogState, and only THEN shows a confirmation turn', async () => {
    mockLogStateMutateAsync.mockResolvedValue({ ok: true, value: undefined });
    let call = 0;
    mockGetAssistantProvider.mockResolvedValue({
      id: 'managed',
      streamChat: () => {
        call += 1;
        if (call === 1) {
          // First turn: the model can't tell which task, asks for clarification.
          return stream([
            { type: 'tool-call', call: { id: 'c1', name: 'ask_clarification', args: { question: 'Which one?', options: [{ taskId: 'task-1', label: 'Morning workout — routine' }] } } },
            { type: 'done', summary: '' },
          ]);
        }
        // Second turn (after resolution): model re-proposes the concrete tool call.
        return stream([
          { type: 'tool-call', call: { id: 'c2', name: 'log_state', args: { taskId: 'task-1', date: '2026-01-01', state: 'done' } } },
          { type: 'done', summary: '' },
        ]);
      },
    });

    const { result } = await renderHook(() => useAssistantChat(), { wrapper });
    await act(async () => {
      await result.current.sendMessage('log my workout');
    });
    await waitFor(() => expect(result.current.clarification).not.toBeNull());

    expect(mockLogStateMutateAsync).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.resolveClarification('task-1' as never);
    });
    await waitFor(() => expect(mockLogStateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'task-1' }),
    ));

    // The confirmation line reflects the REAL applied result, not a hand-written string.
    await waitFor(() => expect(result.current.items.some((i) => i.kind === 'assistant' && /logged for Morning workout/i.test(i.text))).toBe(true));
  });

  it('B9 — a conversationId seeds the transcript from listMessages and resumes the SAME thread', async () => {
    mockListMessages.mockResolvedValue([
      { id: 'm1', conversationId: 'conv-1', role: 'user', text: 'earlier turn', toolCalls: [], createdAt: 'x' },
      { id: 'm2', conversationId: 'conv-1', role: 'assistant', text: 'earlier reply', toolCalls: [], createdAt: 'x' },
    ]);
    mockGetAssistantProvider.mockResolvedValue({ id: 'managed', streamChat: () => stream([{ type: 'done', summary: '' }]) });

    const { result } = await renderHook(() => useAssistantChat({ conversationId: 'conv-1' as never }), { wrapper });
    await waitFor(() => expect(result.current.items.length).toBe(2));
    expect(result.current.conversationId).toBe('conv-1');
  });

  it('B9 — the running message history (not just the latest turn) is sent to the provider on the second send', async () => {
    const seenMessageCounts: number[] = [];
    mockGetAssistantProvider.mockResolvedValue({
      id: 'managed',
      streamChat: ({ messages }: { messages: readonly unknown[] }) => {
        seenMessageCounts.push(messages.length);
        return stream([{ type: 'text-delta', delta: 'ok' }, { type: 'done', summary: '' }]);
      },
    });
    const { result } = await renderHook(() => useAssistantChat(), { wrapper });
    await act(async () => {
      await result.current.sendMessage('first turn');
    });
    await waitFor(() => expect(seenMessageCounts.length).toBe(1));
    await act(async () => {
      await result.current.sendMessage('second turn');
    });
    await waitFor(() => expect(seenMessageCounts.length).toBe(2));

    // Second call's history includes the first user turn + first assistant reply + the new
    // user turn — never just `[latest]`.
    expect(seenMessageCounts[1]).toBeGreaterThan(seenMessageCounts[0]);
    expect(seenMessageCounts[1]).toBe(3);
  });
});
