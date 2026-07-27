/**
 * M6. S40's save-time capability probe (docs/API.md §5): one lightweight chat-completion
 * call, plus an opportunistic transcription probe. Never persists anything itself — the
 * caller (S40) decides what to save, and only via `secureKeyStore`.
 */
export type ByoProbeResult =
  | { readonly ok: true; readonly transcription: boolean }
  | { readonly ok: false };

export async function probeByoEndpoint(baseUrl: string, apiKey: string): Promise<ByoProbeResult> {
  const chatOk = await probeChat(baseUrl, apiKey);
  if (!chatOk) return { ok: false };
  const transcription = await probeTranscription(baseUrl, apiKey);
  return { ok: true, transcription };
}

async function probeChat(baseUrl: string, apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(`${trimTrailingSlash(baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
    });
    return response.ok;
  } catch {
    return false;
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
