/**
 * M6. Minimal `text/event-stream` line parser shared by `ManagedAssistantProvider` and
 * `ByoAssistantProvider` — both read a `fetch` streaming body of `data: {...}\n\n` frames
 * (docs/API.md §4). No SSE library is declared in ARCHITECTURE.md, so this is a small,
 * dependency-free reader over `Response.body`'s async iterator / reader.
 */

/** Parses one already-decoded SSE text chunk stream into JSON payloads, one per `data:` line. */
export async function* parseEventStream(body: ReadableStream<Uint8Array> | null): AsyncGenerator<unknown> {
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep the last (possibly partial) line in the buffer for the next chunk.
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const jsonText = trimmed.slice('data:'.length).trim();
        if (!jsonText) continue;
        try {
          yield JSON.parse(jsonText);
        } catch {
          // A malformed frame is dropped, never thrown — a network hiccup mid-stream must
          // not crash the conversation.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
