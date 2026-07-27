/**
 * M6. `ByoAssistantProvider` — F18, docs/API.md §5. Implements the IDENTICAL
 * `AssistantProvider` port `ManagedAssistantProvider` does, so no screen component can
 * tell which path it is talking to (docs/MODULES.md non-negotiable) — the only place that
 * branches is `getAssistantProvider()` in `./index.ts`, the one sanctioned seam.
 *
 * Calls go DIRECTLY to the user's own `baseUrl`, authenticated with THEIR key, and never
 * touch Fallback's backend — no `assistantApiBaseUrl`, no `X-Fallback-*` headers, nothing
 * server-bound appears anywhere in this file. The key itself is read fresh from
 * `secureKeyStore` for each call and is never cached in a module-level variable, a zustand
 * store, or anything else that could be inadvertently serialized or logged.
 */
import type { AssistantCapabilities, AssistantEvent, AssistantProvider, Result } from '@/types';
import { err, ok } from '@/types';

import { GUARDRAIL_SYSTEM_PROMPT, classifyGuardrail } from './guardrails';
import { getByoConfig, type ByoConfig } from './secureKeyStore';
import { parseEventStream } from './sse';

const TOOLS = ['create_task', 'update_task', 'delete_task', 'log_state', 'ask_clarification'] as const;

function authedHeaders(config: ByoConfig): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` };
}

export function createByoAssistantProvider(): AssistantProvider {
  return {
    id: 'byo',

    async capabilities(): Promise<AssistantCapabilities> {
      const config = await getByoConfig();
      if (!config) return { chat: false, transcription: false };
      return { chat: true, transcription: config.supportsTranscription };
    },

    async *streamChat({ messages, signal }): AsyncIterable<AssistantEvent> {
      const config = await getByoConfig();
      if (!config) {
        yield { type: 'error', code: 'VALIDATION_FAILED', message: 'No BYO key configured.' };
        return;
      }

      // Best-effort guardrail — client-side only, on a key we never see server-side
      // (docs/API.md §5). The literal logging task must still be fulfilled even when a
      // category is flagged, so this only ANNOTATES the outgoing turn; it never blocks it.
      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
      const screen = lastUser ? classifyGuardrail(lastUser.text) : { category: null, hasLiteralLoggingRequest: false };

      let response: Response;
      try {
        response = await fetch(`${config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: authedHeaders(config),
          signal,
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            stream: true,
            messages: [
              { role: 'system', content: GUARDRAIL_SYSTEM_PROMPT },
              ...messages.map((m) => ({ role: m.role, content: m.text })),
            ],
            tools: TOOLS.map((name) => ({ type: 'function', function: { name } })),
          }),
        });
      } catch {
        yield { type: 'error', code: 'NETWORK_UNAVAILABLE', message: 'Could not reach your AI endpoint.' };
        return;
      }

      if (!response.ok) {
        yield { type: 'error', code: 'UPSTREAM_UNAVAILABLE', message: `Endpoint request failed (${response.status}).` };
        return;
      }

      if (screen.category) {
        yield { type: 'refusal', category: screen.category, text: refusalText(screen.category) };
        if (!screen.hasLiteralLoggingRequest) return;
      }

      for await (const chunk of parseEventStream(response.body)) {
        const event = mapOpenAiChunkToEvent(chunk);
        if (event) yield event;
      }
    },

    async transcribe({ uri, signal }): Promise<Result<string>> {
      const config = await getByoConfig();
      if (!config) return err({ code: 'VALIDATION_FAILED', message: 'No BYO key configured.' });
      if (!config.supportsTranscription) {
        // Uncertain/unsupported transcription must never block a BYO save or a text
        // conversation — degrade gracefully; the caller falls back to text-only input.
        return err({ code: 'UNKNOWN', message: 'This endpoint does not support transcription.' });
      }
      try {
        const form = new FormData();
        form.append('file', { uri, name: 'audio.m4a', type: 'audio/m4a' } as unknown as Blob);
        form.append('model', 'whisper-1');
        const response = await fetch(`${config.baseUrl}/audio/transcriptions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${config.apiKey}` },
          body: form,
          signal,
        });
        if (!response.ok) return err({ code: 'UPSTREAM_UNAVAILABLE', message: `Transcription failed (${response.status}).` });
        const json = (await response.json()) as { text?: string };
        return ok(json.text ?? '');
      } catch (cause) {
        return err({ code: 'NETWORK_UNAVAILABLE', message: 'Could not reach your AI endpoint.', cause });
      }
    },
  };
}

function refusalText(category: ReturnType<typeof classifyGuardrail>['category']): string {
  switch (category) {
    case 'medical-advice':
      return "I'm not able to give medical advice, but I'm glad to log this for you.";
    case 'disordered-eating':
      return "I can't help with that specific goal, but I can set up a neutral eating reminder instead.";
    case 'self-harm':
      return "I'm really sorry you're going through this. Please consider reaching out to someone you trust or a local crisis line.";
    case 'harm-to-others':
      return "I can't help with that.";
    case 'illegal-activity':
      return "I can't help with that.";
    default:
      return "I can't help with that part, but happy to help with the rest.";
  }
}

/** Best-effort mapping of an OpenAI-compatible chat-completion stream chunk onto `AssistantEvent`. */
function mapOpenAiChunkToEvent(chunk: unknown): AssistantEvent | null {
  if (!chunk || typeof chunk !== 'object') return null;
  const c = chunk as { choices?: readonly { delta?: { content?: string; tool_calls?: unknown[] }; finish_reason?: string | null }[] };
  const choice = c.choices?.[0];
  if (!choice) return null;
  if (choice.delta?.content) return { type: 'text-delta', delta: choice.delta.content };
  if (choice.finish_reason === 'stop') return { type: 'done', summary: '' };
  return null;
}
