/**
 * M6. S40's save-time capability probe (docs/API.md §5): one lightweight chat-completion
 * call, plus an opportunistic transcription probe. Never persists anything itself — the
 * caller (S40) decides what to save, and only via `secureKeyStore`.
 */
const FALLBACK_MODEL = 'gpt-4o-mini';

export type ByoProbeResult =
  | { readonly ok: true; readonly transcription: boolean; readonly model: string }
  | { readonly ok: false };

export async function probeByoEndpoint(baseUrl: string, apiKey: string): Promise<ByoProbeResult> {
  const model = await probeChat(baseUrl, apiKey);
  if (!model) return { ok: false };
  const transcription = await probeTranscription(baseUrl, apiKey);
  return { ok: true, transcription, model };
}

/**
 * B7 — discovers a model this endpoint actually serves (`GET {base}/models`) instead of
 * hardcoding `gpt-4o-mini`, which 404s on non-OpenAI endpoints (Groq, local model servers)
 * that the module's own shipped copy claims to support. Falls back to `gpt-4o-mini` only as
 * a last resort, for endpoints that genuinely do serve it under a different discovery shape.
 * @returns the model id to use for chat, or `null` if the endpoint rejects every candidate.
 */
async function probeChat(baseUrl: string, apiKey: string): Promise<string | null> {
  const discovered = await discoverModel(baseUrl, apiKey);
  const candidates = discovered ? [discovered, FALLBACK_MODEL] : [FALLBACK_MODEL];
  for (const model of candidates) {
    try {
      const response = await fetch(`${trimTrailingSlash(baseUrl)}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
      });
      if (response.ok) return model;
    } catch {
      return null;
    }
  }
  return null;
}

async function discoverModel(baseUrl: string, apiKey: string): Promise<string | null> {
  try {
    const response = await fetch(`${trimTrailingSlash(baseUrl)}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { data?: readonly { id?: string }[]; id?: string }[] | { data?: readonly { id?: string }[] };
    const list: readonly { id?: string }[] = Array.isArray(json) ? json : (json.data ?? []);
    const first = list.find((m): m is { id: string } => typeof m.id === 'string');
    return first?.id ?? null;
  } catch {
    return null;
  }
}

async function probeTranscription(baseUrl: string, apiKey: string): Promise<boolean> {
  try {
    // A capability probe only — a HEAD/OPTIONS-shaped low-cost call. Endpoints that don't
    // support this route (404/405) are treated as "no transcription", never as a save
    // blocker (docs/API.md §5 — "uncertain support must never block a save").
    const response = await fetch(`${trimTrailingSlash(baseUrl)}/audio/transcriptions`, {
      method: 'OPTIONS',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return response.ok || response.status === 204;
  } catch {
    return false;
  }
}

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
