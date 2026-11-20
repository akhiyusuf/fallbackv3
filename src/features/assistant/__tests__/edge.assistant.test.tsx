/**
 * Edge cases for the assistant: tool calls aimed at ended and deleted habits (real mutations over
 * fake repositories), odd create input, and the BYO provider's key handling and failure paths.
 */
jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: jest.fn(() => {
      counter += 1;
      return `00000000-0000-4000-8000-${(counter + 5000).toString(16).padStart(12, '0')}`;
    }),
  };
});
jest.mock('@/db', () => require('@/queries/testSupport/dbMock'));
jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  const { clock } = require('@/queries/testSupport/clockMock');
  return { ...actual, today: () => clock.today, now: () => clock.now };
});

const mockSecure: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: jest.fn(async (k: string) => mockSecure[k] ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    mockSecure[k] = v;
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    delete mockSecure[k];
  }),
}));

import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { Instant, Step, TaskWithSteps } from '@/types';
import { fake, repos } from '@/queries/testSupport/dbMock';
import { clock } from '@/queries/testSupport/clockMock';
import { useEndTask } from '@/queries/mutations';
import { createByoAssistantProvider } from '@/services/ai/byoProvider';
import { probeByoEndpoint } from '@/services/ai/byoProbe';
import { setByoConfig } from '@/services/ai/secureKeyStore';

import { useToolExecutor } from '../toolExecutor';

function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
}
const unmounts: Array<() => void> = [];
async function rh<T>(hook: () => T) {
  const client = freshClient();
  const r = await renderHook(hook, {
    wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(QueryClientProvider, { client }, children),
  });
  unmounts.push(r.unmount);
  return r;
}

let n = 0;
function makeTask(overrides: Partial<TaskWithSteps> = {}): TaskWithSteps {
  n += 1;
  const id = (overrides.id ?? `ea-${n}`) as TaskWithSteps['id'];
  const ideal: Step = { id: `${id}-i` as Step['id'], taskId: id, role: 'ideal', text: 'Do it', position: 0, dueWeekdays: null };
  const fb: Step = { id: `${id}-f` as Step['id'], taskId: id, role: 'fallback', text: 'Small', position: 0, dueWeekdays: null };
  return {
    id, type: 'routine', name: 'Walk', note: null, icon: 'Repeat', color: 'forge-orange', isAsNeeded: false,
    cadence: { kind: 'daily' }, eventDate: null, timeOfDay: null, startDate: null, endDate: null, dosesPerDay: 1,
    isTracked: true, importance: null, necessity: null, todoDoneAt: null, priorityRank: null, isNote: false,
    snoozable: true, createdAt: '2024-05-25T08:00:00.000Z' as Instant, updatedAt: '2024-05-25T08:00:00.000Z' as Instant,
    deletedAt: null, endedOn: null, idealSteps: [ideal], fallbackSteps: [fb], ...overrides,
  } as TaskWithSteps;
}

beforeEach(() => {
  fake.reset();
  for (const k of Object.keys(mockSecure)) delete mockSecure[k];
  clock.today = '2024-06-01';
  clock.now = '2024-06-01T12:00:00.000Z';
});
afterEach(async () => {
  await act(async () => unmounts.forEach((u) => u()));
  unmounts.length = 0;
});

async function settle() {
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  }
}

async function logsFor(taskId: string) {
  return repos.logs.listForTask(taskId as never, '1900-01-01' as never, '2999-12-31' as never);
}

const logCall = (taskId: string, date: string, state: string) =>
  ({ id: 'c' as never, name: 'log_state', args: { taskId: taskId as never, date, state } }) as never;

describe('assistant tools on ended and deleted habits', () => {
  it('log_state for a day after a habit ended is refused, and writes no log row', async () => {
    const task = makeTask({ endedOn: '2024-05-30' as never });
    fake.seedTask(task);
    const { result } = await rh(() => useToolExecutor());
    await settle();
    const out = await result.current.applyToolCall(logCall(task.id, '2024-06-01', 'done'));
    expect(out.applied).toBe(false);
    expect(await logsFor(task.id)).toEqual([]);
  });

  it('control: a valid log_state for today is applied and does write one row', async () => {
    const task = makeTask();
    fake.seedTask(task);
    const { result } = await rh(() => useToolExecutor());
    await settle();
    expect((await result.current.applyToolCall(logCall(task.id, '2024-06-01', 'done'))).applied).toBe(true);
    expect(await logsFor(task.id)).toHaveLength(1);
  });

  it('log_state on a deleted habit (not in the live list) is refused', async () => {
    const task = makeTask({ deletedAt: '2024-05-31T10:00:00.000Z' as never });
    fake.seedTask(task);
    const { result } = await rh(() => useToolExecutor());
    await settle();
    expect((await result.current.applyToolCall(logCall(task.id, '2024-06-01', 'done'))).applied).toBe(false);
    expect(await logsFor(task.id)).toEqual([]);
  });

  it('update_task and delete_task on a deleted habit are refused', async () => {
    const task = makeTask({ deletedAt: '2024-05-31T10:00:00.000Z' as never });
    fake.seedTask(task);
    const { result } = await rh(() => useToolExecutor());
    await settle();
    expect((await result.current.applyToolCall({ id: 'u' as never, name: 'update_task', args: { taskId: task.id, patch: { name: 'Zombie' } } } as never)).applied).toBe(false);
    expect((await result.current.applyToolCall({ id: 'd' as never, name: 'delete_task', args: { taskId: task.id } } as never)).applied).toBe(false);
    expect((await repos.tasks.get(task.id))!.name).toBe('Walk');
  });

  it('log_state with a garbage date string never writes a log row', async () => {
    const task = makeTask();
    fake.seedTask(task);
    const { result } = await rh(() => useToolExecutor());
    await settle();
    for (const bad of ['tomorrow', '', '2024-13-45', '06/01/2024', '2024-02-30']) {
      const out = await result.current.applyToolCall(logCall(task.id, bad, 'done'));
      expect(out.applied).toBe(false);
    }
    expect(await logsFor(task.id)).toEqual([]);
  });

  it('log_state with an unknown state value is refused', async () => {
    const task = makeTask();
    fake.seedTask(task);
    const { result } = await rh(() => useToolExecutor());
    await settle();
    expect((await result.current.applyToolCall(logCall(task.id, '2024-06-01', 'banana'))).applied).toBe(false);
    expect(await logsFor(task.id)).toEqual([]);
  });

  it('delete_task on an ended habit moves it to Recently deleted (it is still live in the app)', async () => {
    const task = makeTask({ endedOn: '2024-05-30' as never });
    fake.seedTask(task);
    const { result } = await rh(() => useToolExecutor());
    await settle();
    const out = await result.current.applyToolCall({ id: 'd' as never, name: 'delete_task', args: { taskId: task.id } } as never);
    expect(out.applied).toBe(true);
    expect((await repos.tasks.get(task.id))!.deletedAt).not.toBeNull();
  });

  it('a habit ended mid-conversation: log_state for today is refused afterwards', async () => {
    const task = makeTask();
    fake.seedTask(task);
    const { result } = await rh(() => useToolExecutor());
    await settle();
    const end = await rh(() => useEndTask());
    await act(async () => {
      await end.result.current.mutateAsync(task.id);
    });
    await settle();
    expect((await result.current.applyToolCall(logCall(task.id, '2024-06-01', 'done'))).applied).toBe(false);
  });
});

describe('assistant create_task with odd input', () => {
  const create = (args: Record<string, unknown>) =>
    ({ id: 'c' as never, name: 'create_task', args: { type: 'todo', idealSteps: [], fallbackSteps: [], ...args } }) as never;

  it('emoji and non-Latin names are kept exactly', async () => {
    const { result } = await rh(() => useToolExecutor());
    await settle();
    const out = await result.current.applyToolCall(create({ name: 'Walk 🐕 café 日本語' }));
    expect(out.applied).toBe(true);
    expect((await repos.tasks.get(out.taskId!))!.name).toBe('Walk 🐕 café 日本語');
  });

  it('a whitespace-only name is refused', async () => {
    const { result } = await rh(() => useToolExecutor());
    expect((await result.current.applyToolCall(create({ name: '   ' }))).applied).toBe(false);
  });

  it('a 5000 character name is either refused or stored whole, never half-written or thrown', async () => {
    const { result } = await rh(() => useToolExecutor());
    const out = await result.current.applyToolCall(create({ name: 'x'.repeat(5000) }));
    if (out.applied) expect((await repos.tasks.get(out.taskId!))!.name.length).toBeGreaterThan(0);
    else expect((await repos.tasks.list()).length).toBe(0);
  });

  it('an unknown type, null args and an unknown tool name are refused without throwing', async () => {
    const { result } = await rh(() => useToolExecutor());
    expect((await result.current.applyToolCall(create({ type: 'quest', name: 'X' }))).applied).toBe(false);
    await expect(result.current.applyToolCall({ id: 'c' as never, name: 'create_task', args: null } as never)).resolves.toMatchObject({ applied: false });
    await expect(result.current.applyToolCall({ id: 'c' as never, name: 'nonsense', args: {} } as never)).resolves.toMatchObject({ applied: false });
    expect((await repos.tasks.list()).length).toBe(0);
  });

  it('a course whose end is before its start is refused', async () => {
    const { result } = await rh(() => useToolExecutor());
    const out = await result.current.applyToolCall(create({ type: 'course', name: 'Backwards', startDate: '2024-07-10', endDate: '2024-07-01', cadence: { kind: 'daily' } }));
    expect(out.applied).toBe(false);
  });
});

describe('BYO provider: key handling and failures', () => {
  const KEY = 'sk-secret-KEY-123456';
  let fetchMock: jest.Mock;
  let logSpies: jest.SpyInstance[];

  beforeEach(() => {
    fetchMock = jest.fn();
    (globalThis as { fetch: unknown }).fetch = fetchMock;
    logSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
  });
  afterEach(() => logSpies.forEach((s) => s.mockRestore()));

  function sse(...frames: string[]) {
    const enc = new TextEncoder();
    return {
      ok: true,
      status: 200,
      body: new ReadableStream<Uint8Array>({
        start(c) {
          for (const f of frames) c.enqueue(enc.encode(f));
          c.close();
        },
      }),
    };
  }
  async function collect(it: AsyncIterable<unknown>) {
    const out: unknown[] = [];
    for await (const e of it) out.push(e);
    return out;
  }
  const turn = { conversationId: 'c' as never, messages: [{ id: 'm' as never, conversationId: 'c' as never, role: 'user' as const, text: 'add walk', toolCalls: [], createdAt: 'x' as never }], signal: undefined };
  const STOP = 'data: {"choices":[{"delta":{"content":"hi"},"finish_reason":"stop"}]}\n\n';

  it('sends the key only to the configured host, in the Authorization header only, never in the body or URL', async () => {
    await setByoConfig({ baseUrl: 'https://llm.example.org/v1', apiKey: KEY, supportsTranscription: false, model: 'm1' });
    fetchMock.mockResolvedValue(sse(STOP));
    await collect(createByoAssistantProvider().streamChat(turn));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url).host).toBe('llm.example.org');
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(String(init.body)).not.toContain(KEY);
    expect(url).not.toContain(KEY);
  });

  it('a base URL saved with a trailing slash does not produce a double slash', async () => {
    await setByoConfig({ baseUrl: 'https://llm.example.org/v1/', apiKey: KEY, supportsTranscription: false });
    fetchMock.mockResolvedValue(sse(STOP));
    await collect(createByoAssistantProvider().streamChat(turn));
    expect(fetchMock.mock.calls[0][0]).toBe('https://llm.example.org/v1/chat/completions');
  });

  it('the probe sends the key only to the typed host, and never logs it', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    await probeByoEndpoint('https://llm.example.org/v1', KEY);
    for (const call of fetchMock.mock.calls) expect(new URL(call[0]).host).toBe('llm.example.org');
    for (const spy of logSpies) expect(JSON.stringify(spy.mock.calls)).not.toContain(KEY);
  });

  it('a missing key yields one calm error event and no network call', async () => {
    const events = await collect(createByoAssistantProvider().streamChat(turn));
    expect(events).toEqual([{ type: 'error', code: 'VALIDATION_FAILED', message: 'No BYO key configured.' }]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a 401 (bad key) yields an error event that never contains the key, and nothing is logged', async () => {
    await setByoConfig({ baseUrl: 'https://llm.example.org/v1', apiKey: KEY, supportsTranscription: false });
    fetchMock.mockResolvedValue({ ok: false, status: 401, body: null });
    const events = await collect(createByoAssistantProvider().streamChat(turn));
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain(KEY);
    for (const spy of logSpies) expect(spy).not.toHaveBeenCalled();
  });

  it('a network failure is an error event, not a throw', async () => {
    await setByoConfig({ baseUrl: 'https://llm.example.org/v1', apiKey: KEY, supportsTranscription: false });
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const events = await collect(createByoAssistantProvider().streamChat(turn));
    expect(events).toEqual([{ type: 'error', code: 'NETWORK_UNAVAILABLE', message: 'Could not reach your AI endpoint.' }]);
  });

  it('the connection dropping mid-stream ends in an error event, not a thrown rejection', async () => {
    await setByoConfig({ baseUrl: 'https://llm.example.org/v1', apiKey: KEY, supportsTranscription: false });
    const enc = new TextEncoder();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"Sure"}}]}\n\n'));
          c.error(new TypeError('Network connection lost'));
        },
      }),
    });
    const events = await collect(createByoAssistantProvider().streamChat(turn));
    expect(events[events.length - 1]).toMatchObject({ type: 'error', code: 'NETWORK_UNAVAILABLE' });
  });

  it('garbage frames and a tool call with broken JSON arguments are survived', async () => {
    await setByoConfig({ baseUrl: 'https://llm.example.org/v1', apiKey: KEY, supportsTranscription: false });
    fetchMock.mockResolvedValue(
      sse(
        'data: not json\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"t1","function":{"name":"create_task","arguments":"{\\"na"}}]}}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n',
      ),
    );
    const events = await collect(createByoAssistantProvider().streamChat(turn));
    expect(events).toEqual([{ type: 'tool-call', call: { id: 't1', name: 'create_task', args: {} } }]);
  });

  it('transcription failing by network is an error result, not a throw', async () => {
    await setByoConfig({ baseUrl: 'https://llm.example.org/v1', apiKey: KEY, supportsTranscription: true });
    fetchMock.mockRejectedValue(new Error('boom'));
    const r = await createByoAssistantProvider().transcribe({ uri: 'file:///a.m4a', signal: undefined } as never);
    expect(r.ok).toBe(false);
  });
});
