/** Edge cases for the chat hook: a dropped tool call is explained, and a failing provider is "offline", never a crash. */
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const mockLog = jest.fn();
jest.mock('@/queries', () => ({
  useTasks: () => ({ data: [{ id: 'task-1', name: 'Walk' }] }),
  useCreateTask: () => ({ mutateAsync: jest.fn() }),
  useUpdateTask: () => ({ mutateAsync: jest.fn() }),
  useDeleteTask: () => ({ mutateAsync: jest.fn() }),
  useLogState: () => ({ mutateAsync: mockLog }),
}));
const mockProvider = jest.fn();
jest.mock('@/services/ai', () => ({
  getAssistantProvider: () => mockProvider(),
  appendMessage: jest.fn(async () => ({ ok: true })),
  upsertConversation: jest.fn(async () => ({ ok: true })),
  listMessages: jest.fn(async () => []),
}));

import { DROPPED_CALL_LINE, useAssistantChat } from '../useAssistantChat';

const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
async function* stream(events: readonly unknown[]) {
  for (const e of events) yield e as never;
}

beforeEach(() => jest.clearAllMocks());

it('a tool call that cannot be applied (task gone) is explained in the transcript, with nothing written', async () => {
  mockProvider.mockResolvedValue({
    id: 'byo',
    streamChat: () => stream([{ type: 'tool-call', call: { id: 'c', name: 'log_state', args: { taskId: 'ghost', date: '2026-01-01', state: 'done' } } }, { type: 'done', summary: '' }]),
  });
  const { result } = await renderHook(() => useAssistantChat(), { wrapper });
  await act(async () => {
    await result.current.sendMessage('log ghost');
  });
  expect(mockLog).not.toHaveBeenCalled();
  expect(result.current.items.some((i) => i.kind === 'assistant' && i.text === DROPPED_CALL_LINE)).toBe(true);
  expect(DROPPED_CALL_LINE).not.toMatch(/—/);
});

it('a provider that throws while streaming shows the offline banner state, not an unhandled rejection', async () => {
  mockProvider.mockResolvedValue({
    id: 'byo',
    // eslint-disable-next-line require-yield
    streamChat: async function* () {
      throw new TypeError('Network connection lost');
    },
  });
  const { result } = await renderHook(() => useAssistantChat(), { wrapper });
  await act(async () => {
    await result.current.sendMessage('hello');
  });
  expect(result.current.offline).toBe(true);
  expect(result.current.isStreaming).toBe(false);
});

it('a provider that cannot even be created is offline too, and Try again works afterwards', async () => {
  mockProvider.mockRejectedValueOnce(new Error('secure store locked'));
  mockProvider.mockResolvedValue({ id: 'byo', streamChat: () => stream([{ type: 'text-delta', delta: 'Hi there' }, { type: 'done', summary: '' }]) });
  const { result } = await renderHook(() => useAssistantChat(), { wrapper });
  await act(async () => {
    await result.current.sendMessage('hello');
  });
  expect(result.current.offline).toBe(true);
  await act(async () => {
    result.current.retryLast();
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
  expect(result.current.offline).toBe(false);
  expect(result.current.items.some((i) => i.kind === 'assistant' && i.text === 'Hi there')).toBe(true);
});

it('a whitespace-only message is never sent', async () => {
  const { result } = await renderHook(() => useAssistantChat(), { wrapper });
  await act(async () => {
    await result.current.sendMessage('   ');
  });
  expect(mockProvider).not.toHaveBeenCalled();
  expect(result.current.items).toEqual([]);
});
