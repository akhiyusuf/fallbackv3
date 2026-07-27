/**
 * Proves docs/MODULES.md's core non-negotiable: "Tool calls are proposals, not actions."
 * Every call is re-validated with M2's `validateTaskDraft` and applied ONLY through M2's
 * mutations. A malformed/invalid call is dropped — never a half-written task.
 */
import { renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const mockCreateTaskMutateAsync = jest.fn();
const mockUpdateTaskMutateAsync = jest.fn();
const mockDeleteTaskMutateAsync = jest.fn();
const mockLogStateMutateAsync = jest.fn();
const mockTasksData: { current: unknown[] } = { current: [] };

jest.mock('@/queries', () => ({
  useTasks: () => ({ data: mockTasksData.current }),
  useCreateTask: () => ({ mutateAsync: mockCreateTaskMutateAsync }),
  useUpdateTask: () => ({ mutateAsync: mockUpdateTaskMutateAsync }),
  useDeleteTask: () => ({ mutateAsync: mockDeleteTaskMutateAsync }),
  useLogState: () => ({ mutateAsync: mockLogStateMutateAsync }),
}));

import { useToolExecutor } from '../toolExecutor';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useToolExecutor — tool calls are proposals, never actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTasksData.current = [];
  });

  it('a create_task call with an empty name is DROPPED — validateTaskDraft rejects it, useCreateTask is never called', async () => {
    const { result } = await renderHook(() => useToolExecutor(), { wrapper });
    const outcome = await result.current.applyToolCall({
      id: 'c1' as never,
      name: 'create_task',
      args: { type: 'todo', name: '', idealSteps: [], fallbackSteps: [] } as never,
    });
    expect(outcome.applied).toBe(false);
    expect(mockCreateTaskMutateAsync).not.toHaveBeenCalled();
  });

  it('a valid create_task call is applied through useCreateTask, never a direct write', async () => {
    mockCreateTaskMutateAsync.mockResolvedValue({ ok: true, value: 'new-id' });
    const { result } = await renderHook(() => useToolExecutor(), { wrapper });
    const outcome = await result.current.applyToolCall({
      id: 'c2' as never,
      name: 'create_task',
      args: { type: 'todo', name: 'Call mom', idealSteps: [], fallbackSteps: [] } as never,
    });
    expect(outcome.applied).toBe(true);
    expect(mockCreateTaskMutateAsync).toHaveBeenCalledTimes(1);
    // The validated draft, not the raw call args, is what's forwarded.
    expect(mockCreateTaskMutateAsync.mock.calls[0][0]).toMatchObject({ name: 'Call mom' });
  });

  it('update_task on an unknown taskId is DROPPED — never calls useUpdateTask', async () => {
    mockTasksData.current = [];
    const { result } = await renderHook(() => useToolExecutor(), { wrapper });
    const outcome = await result.current.applyToolCall({
      id: 'c3' as never,
      name: 'update_task',
      args: { taskId: 'ghost' as never, patch: { name: 'x' } },
    });
    expect(outcome.applied).toBe(false);
    expect(mockUpdateTaskMutateAsync).not.toHaveBeenCalled();
  });

  it('delete_task on an unknown taskId is DROPPED — never calls useDeleteTask', async () => {
    const { result } = await renderHook(() => useToolExecutor(), { wrapper });
    const outcome = await result.current.applyToolCall({ id: 'c4' as never, name: 'delete_task', args: { taskId: 'ghost' as never } });
    expect(outcome.applied).toBe(false);
    expect(mockDeleteTaskMutateAsync).not.toHaveBeenCalled();
  });

  it('log_state on an unknown taskId is DROPPED — never calls useLogState', async () => {
    const { result } = await renderHook(() => useToolExecutor(), { wrapper });
    const outcome = await result.current.applyToolCall({
      id: 'c5' as never,
      name: 'log_state',
      args: { taskId: 'ghost' as never, date: '2026-01-01', state: 'done' },
    });
    expect(outcome.applied).toBe(false);
    expect(mockLogStateMutateAsync).not.toHaveBeenCalled();
  });

  it('ask_clarification never applies data itself', async () => {
    const { result } = await renderHook(() => useToolExecutor(), { wrapper });
    const outcome = await result.current.applyToolCall({
      id: 'c6' as never,
      name: 'ask_clarification',
      args: { question: 'q', options: [] },
    });
    expect(outcome.applied).toBe(false);
    expect(mockCreateTaskMutateAsync).not.toHaveBeenCalled();
    expect(mockUpdateTaskMutateAsync).not.toHaveBeenCalled();
    expect(mockDeleteTaskMutateAsync).not.toHaveBeenCalled();
    expect(mockLogStateMutateAsync).not.toHaveBeenCalled();
  });

  it('a failed persist (repository Result.err) is reported as not applied, never a false success', async () => {
    mockCreateTaskMutateAsync.mockResolvedValue({ ok: false, error: { code: 'WRITE_FAILED', message: 'x' } });
    const { result } = await renderHook(() => useToolExecutor(), { wrapper });
    const outcome = await result.current.applyToolCall({
      id: 'c7' as never,
      name: 'create_task',
      args: { type: 'todo', name: 'Call mom', idealSteps: [], fallbackSteps: [] } as never,
    });
    expect(outcome.applied).toBe(false);
  });
});
