/**
 * M6. `ManagedAssistantProvider` — F16/F17, docs/API.md §4. Talks to Fallback's own
 * stateless backend (`server/`), authenticated per-request via the store receipt, never a
 * login. Implements the SAME `AssistantProvider` port as `ByoAssistantProvider` — see that
 * file's header for the parity guarantee this pair upholds.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { AppErrorCode, AssistantCapabilities, AssistantEvent, AssistantProvider, Id, Result } from '@/types';
import { err, ok } from '@/types';

import { GUARDRAIL_SYSTEM_PROMPT } from './guardrails';
import { parseEventStream } from './sse';

const TOOLS = ['create_task', 'update_task', 'delete_task', 'log_state', 'ask_clarification'] as const;

function baseUrl(): string {
  return (Constants.expoConfig?.extra?.assistantApiBaseUrl as string | undefined) ?? 'https://api.fallback.app';
}

export interface ManagedProviderDeps {
  /** Forwarded per request, never persisted server-side (docs/API.md §7). */
  readonly currentReceipt: () => Promise<string | null>;
  readonly clientVersion: string;
  /** Tasks context (names + ids only, for disambiguation) — never habit data beyond that. */
  readonly taskContext: () => Promise<readonly { id: Id; name: string; type: string }[]>;
}

export function createManagedAssistantProvider(deps: ManagedProviderDeps): AssistantProvider {
  async function authHeaders(): Promise<Record<string, string>> {
    const receipt = await deps.currentReceipt();
    return {
      'Content-Type': 'application/json',
      'X-Fallback-Platform': Platform.OS === 'ios' ? 'ios' : 'android',
      'X-Fallback-Receipt': receipt ?? '',
      'X-Fallback-Client': deps.clientVersion,
    };
  }

  return {
    id: 'managed',

    async capabilities(): Promise<AssistantCapabilities> {
      // Managed tier is Groq-backed for both (docs/API.md §4, pinned) — always both true
      // when reachable; a network failure is surfaced per-call, not cached as "unsupported".
      return { chat: true, transcription: true };
    },

    async *streamChat({ messages, signal }): AsyncIterable<AssistantEvent> {
      const headers = await authHeaders();
      const taskContext = await deps.taskContext();
      let response: Response;
      try {
        response = await fetch(`${baseUrl()}/v1/chat`, {
          method: 'POST',
          headers,
          signal,
          body: JSON.stringify({
            messages: messages.map((m) => ({ role: m.role, content: m.text })),
            tools: TOOLS,
            context: { tasks: taskContext },
            // Re-sent on every request; the server re-injects it too (defense in depth —
            // a tampered client cannot bypass server-side screening, docs/API.md §4).
            systemPrompt: GUARDRAIL_SYSTEM_PROMPT,
          }),
        });
      } catch {
        yield { type: 'error', code: 'NETWORK_UNAVAILABLE', message: 'Could not reach the assistant.' };
        return;
      }

      if (!response.ok) {
        const code = mapHttpStatus(response.status);
        yield { type: 'error', code, message: `Assistant request failed (${response.status}).` };
        return;
      }

      for await (const payload of parseEventStream(response.body)) {
        const event = payload as AssistantEvent;
        if (event && typeof event === 'object' && 'type' in event) {
          yield event;
        }
      }
    },

    async transcribe({ uri, signal }): Promise<Result<string>> {
      const headers = await authHeaders();
      delete headers['Content-Type']; // multipart sets its own boundary
      const form = new FormData();
      // React Native's FormData accepts this file-shaped object for a multipart upload.
      form.append('audio', { uri, name: 'audio.m4a', type: 'audio/m4a' } as unknown as Blob);
      try {
        const response = await fetch(`${baseUrl()}/v1/transcribe`, { method: 'POST', headers, body: form, signal });
        if (!response.ok) {
          return err({ code: mapHttpStatus(response.status), message: `Transcription failed (${response.status}).` });
        }
        const json = (await response.json()) as { text?: string };
        return ok(json.text ?? '');
      } catch (cause) {
        return err({ code: 'NETWORK_UNAVAILABLE', message: 'Could not reach the transcription service.', cause });
      }
    },
  };
}

function mapHttpStatus(status: number): AppErrorCode {
  if (status === 401) return 'ENTITLEMENT_REQUIRED';
  if (status === 402) return 'ENTITLEMENT_EXPIRED';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503) return 'GUARDRAIL_REFUSED'; // guardrail_unavailable — refuse the turn
  if (status >= 500) return 'UPSTREAM_UNAVAILABLE';
  return 'UNKNOWN';
}
