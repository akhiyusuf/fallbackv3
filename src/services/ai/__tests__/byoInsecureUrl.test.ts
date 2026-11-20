/**
 * A BYO config saved before S40 refused http:// addresses could still point at a plain http host.
 * The provider itself refuses to send the key there, for chat and transcription; a local model
 * server (this phone, the home network) is still allowed.
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
import { isSafeBaseUrl } from '../safeBaseUrl';
import { setByoConfig } from '../secureKeyStore';

const msg = [{ id: 'm1' as never, conversationId: 'c1' as never, role: 'user' as const, text: 'hi', toolCalls: [], createdAt: 'x' as never }];

async function eventsFor(baseUrl: string) {
  await setByoConfig({ baseUrl, apiKey: 'sk-secret', supportsTranscription: true, model: 'm' });
  const out: Array<{ type: string; code?: string }> = [];
  for await (const e of createByoAssistantProvider().streamChat({ conversationId: 'c1' as never, messages: msg })) out.push(e as never);
  return out;
}

describe('BYO key never sent over plain http to a remote host', () => {
  beforeEach(() => {
    mockSecureStoreState.clear();
    (globalThis.fetch as unknown) = jest.fn(async () => ({ ok: true, body: { getReader: () => ({ read: async () => ({ done: true }), releaseLock: () => {} }) } }));
  });

  it('an old http:// config to a remote host: no request is made, a calm error explains', async () => {
    const events = await eventsFor('http://api.example.com/v1');
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(events).toEqual([expect.objectContaining({ type: 'error', code: 'VALIDATION_FAILED' })]);
  });

  it('transcription is refused the same way', async () => {
    await setByoConfig({ baseUrl: 'http://api.example.com/v1', apiKey: 'sk-secret', supportsTranscription: true, model: 'm' });
    const result = await createByoAssistantProvider().transcribe({ uri: 'file:///a.m4a' } as never);
    expect(result.ok).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('https and a local http server are allowed', async () => {
    await eventsFor('https://api.example.com/v1');
    await eventsFor('http://192.168.1.20:11434/v1');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['https://api.openai.com/v1', true],
    ['http://localhost:11434', true],
    ['http://10.0.0.5', true],
    ['http://172.20.1.1', true],
    ['http://mac.local:8080', true],
    ['http://172.32.0.1', false],
    ['http://api.groq.com', false],
    ['http://user@evil.com', false],
    ['ftp://x', false],
  ])('isSafeBaseUrl(%s) is %s', (url, safe) => {
    expect(isSafeBaseUrl(url)).toBe(safe);
  });
});
