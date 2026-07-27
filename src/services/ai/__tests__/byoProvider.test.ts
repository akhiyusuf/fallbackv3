/**
 * B5 — the BYO provider must not silently drop tool calls. OpenAI-compatible streaming
 * fragments `tool_calls` arguments across many chunks; this proves a call fragmented across
 * 3+ chunks is assembled into exactly one complete `tool-call` event.
 * B7 — the configured/discovered model (not a hardcoded `gpt-4o-mini`) is sent to the
 * endpoint, so a valid Groq-shaped endpoint isn't rejected.
 */
const mockSecureStoreState = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStoreState.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStoreState.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStoreState.delete(key);
  }),
}));

import { createByoAssistantProvider } from '../byoProvider';
import { setByoConfig } from '../secureKeyStore';

function sseChunk(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function fakeStreamBody(chunks: readonly unknown[]): ReadableStream<Uint8Array> {
  let i = 0;
  return {
    getReader: () => ({
      read: async () => {
        if (i < chunks.length) return { done: false, value: sseChunk(chunks[i++]) };
        return { done: true, value: undefined };
      },
      releaseLock: () => {},
    }),
  } as unknown as ReadableStream<Uint8Array>;
}

describe('ByoAssistantProvider — streamChat tool-call assembly (B5) and model selection (B7)', () => {
  beforeEach(async () => {
    mockSecureStoreState.clear();
    await setByoConfig({ baseUrl: 'https://api.groq.com/openai/v1', apiKey: 'sk-test', supportsTranscription: false, model: 'llama-3.3-70b-versatile' });
  });

  it('assembles a tool call fragmented across 3+ chunks into exactly ONE tool-call event with fully-parsed args', async () => {
    const chunks = [
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'create_task', arguments: '{"name":' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"Morning run",' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"idealSteps":[],"fallbackSteps":[]}' } }] }, finish_reason: 'tool_calls' }] },
    ];
    (globalThis.fetch as unknown) = jest.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
      const body = JSON.parse(init.body as string);
      expect(body.model).toBe('llama-3.3-70b-versatile'); // B7 — configured model, never hardcoded
      return { ok: true, body: fakeStreamBody(chunks) } as unknown as Response;
    });

    const provider = createByoAssistantProvider();
    const events: unknown[] = [];
    for await (const event of provider.streamChat({ conversationId: 'c1' as never, messages: [{ id: 'm1' as never, conversationId: 'c1' as never, role: 'user', text: 'add a morning run', toolCalls: [], createdAt: 'x' as never }] })) {
      events.push(event);
    }

    const toolCallEvents = events.filter((e): e is { type: 'tool-call'; call: { args: unknown } } => (e as { type: string }).type === 'tool-call');
    expect(toolCallEvents).toHaveLength(1);
    expect(toolCallEvents[0]?.call.args).toEqual({ name: 'Morning run', idealSteps: [], fallbackSteps: [] });
  });

  it('falls back to gpt-4o-mini only when no model was discovered/saved', async () => {
    await setByoConfig({ baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-test', supportsTranscription: false });
    (globalThis.fetch as unknown) = jest.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      expect(body.model).toBe('gpt-4o-mini');
      return { ok: true, body: fakeStreamBody([]) } as unknown as Response;
    });
    const provider = createByoAssistantProvider();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _event of provider.streamChat({ conversationId: 'c1' as never, messages: [] })) {
      // drain
    }
  });
});
