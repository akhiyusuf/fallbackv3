/**
 * Round 4 code review (report 41): bugs found by reading the round 2 and 3 changes. Each `it.failing`
 * passes today BECAUSE the bug exists; when the bug is fixed the test starts failing and must be
 * turned into a plain `it`.
 */
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

jest.mock('@/queries', () => ({
  useTasks: () => ({ data: [{ id: 'task-1', name: 'Walk' }] }),
  useCreateTask: () => ({ mutateAsync: jest.fn() }),
  useUpdateTask: () => ({ mutateAsync: jest.fn() }),
  useDeleteTask: () => ({ mutateAsync: jest.fn() }),
  useLogState: () => ({ mutateAsync: jest.fn() }),
}));
const mockProvider = jest.fn();
jest.mock('@/services/ai', () => ({
  getAssistantProvider: () => mockProvider(),
  appendMessage: jest.fn(async () => ({ ok: true })),
  upsertConversation: jest.fn(async () => ({ ok: true })),
  listMessages: jest.fn(async () => []),
  getConversation: jest.fn(async () => null),
}));

import { useAssistantChat } from './features/assistant/useAssistantChat';

const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;

beforeEach(() => jest.clearAllMocks());

describe('assistant: a reply that never finishes', () => {
  // useAssistantChat.ts:213 passes `signal: undefined`, and no provider sets a timeout (React Native's
  // fetch has none either), so one stalled connection (wifi to cellular, a tunnel) leaves the turn open
  // for good. Since round 3 every later turn waits behind it (enqueueTurn, line 91-ish): the person's
  // next message, and Try again, never reach the model. Fix: give each turn a deadline (an
  // AbortController, say 60 s) that ends it as offline so the chain moves on.
  it.failing('the next message still goes out after the first reply has stalled for five minutes', async () => {
    jest.useFakeTimers();
    try {
      let calls = 0;
      mockProvider.mockResolvedValue({
        id: 'byo',
        streamChat: () => {
          calls += 1;
          if (calls === 1) {
            return (async function* () {
              await new Promise(() => undefined); // never settles
              yield { type: 'done', summary: '' } as never;
            })();
          }
          return (async function* () {
            yield { type: 'text-delta', delta: 'Hi' } as never;
            yield { type: 'done', summary: '' } as never;
          })();
        },
      });
      const { result } = await renderHook(() => useAssistantChat(), { wrapper });
      await act(async () => {
        void result.current.sendMessage('first');
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(5 * 60_000);
      });
      await act(async () => {
        void result.current.sendMessage('second');
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(1_000);
      });
      expect(calls).toBe(2);
    } finally {
      jest.useRealTimers();
    }
  });
});
