/**
 * M6 backend. Thin `node:http` wiring around `routes.js`. Zero npm dependencies — nothing
 * declared beyond what `docs/ARCHITECTURE.md` already lists for the app, which is nothing
 * for this directory; Node's built-in `http`/`fetch` are all this needs.
 *
 * The backend holds no accounts and stores no user data (docs/API.md §4): every request is
 * verified independently against the platform store, nothing is written to disk, and this
 * file's ONE logging call (`logAccess`) never receives message content — only
 * method/path/status.
 */
import { createServer } from 'node:http';
import { handleChat, handleHealth, handleTranscribe } from './routes.js';

function logAccess(method, path, status) {
  // eslint-disable-next-line no-console
  console.log(`${new Date().toISOString()} ${method} ${path} ${status}`);
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function readJsonBody(req) {
  const raw = (await readRawBody(req)).toString('utf8');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined; // signals malformed JSON to the caller
  }
}

/**
 * B11 — a minimal multipart/form-data reader (zero deps, matching this directory's
 * zero-dependency contract): extracts the binary content of the `audio`/`file` part. Not a
 * fully general multipart parser (no nested parts, no header-level decoding beyond finding
 * the field name), but sufficient for the single-file upload `managedProvider.ts` sends.
 * @returns {Buffer | null}
 */
function extractMultipartFilePart(buffer, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? '');
  const boundary = match ? match[1] || match[2] : null;
  if (!boundary) return null;
  const boundaryMarker = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = buffer.indexOf(boundaryMarker);
  while (start !== -1) {
    const next = buffer.indexOf(boundaryMarker, start + boundaryMarker.length);
    if (next === -1) break;
    parts.push(buffer.slice(start + boundaryMarker.length, next));
    start = next;
  }
  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headerText = part.slice(0, headerEnd).toString('utf8');
    if (!/name="(audio|file)"/i.test(headerText)) continue;
    let body = part.slice(headerEnd + 4);
    if (body.slice(-2).toString() === '\r\n') body = body.slice(0, -2);
    return body;
  }
  return null;
}

/** @returns {Blob | null} */
function readAudioBody(rawBody, contentType) {
  if (rawBody.length === 0) return null;
  if (/multipart\/form-data/i.test(contentType ?? '')) {
    const filePart = extractMultipartFilePart(rawBody, contentType);
    return filePart ? new Blob([filePart]) : null;
  }
  return new Blob([rawBody]);
}

function lowerHeaders(rawHeaders) {
  const out = {};
  for (const [key, value] of Object.entries(rawHeaders)) out[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
  return out;
}

async function writeSseFromGroqStream(res, upstream, screen) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });

  if (screen?.category) {
    res.write(`data: ${JSON.stringify({ type: 'refusal', category: screen.category, text: refusalTextFor(screen.category) })}\n\n`);
    if (!screen.hasLiteralLoggingRequest) {
      res.write(`data: ${JSON.stringify({ type: 'done', summary: '' })}\n\n`);
      res.end();
      return;
    }
  }

  const reader = upstream.body?.getReader();
  if (!reader) {
    res.end();
    return;
  }
  const decoder = new TextDecoder();
  let buffer = '';
  let summary = '';
  // B6 — OpenAI-compatible streaming fragments tool-call arguments across MANY chunks, keyed
  // by `index`; only the first fragment for a given index carries `id`/`function.name`. This
  // accumulates by index and flushes only once the choice actually finishes, instead of
  // emitting a `tool-call` on the first (typically empty/partial) fragment.
  const pendingToolCalls = new Map();

  function accumulateToolCallDeltas(toolCalls) {
    for (const fragment of toolCalls) {
      const index = typeof fragment?.index === 'number' ? fragment.index : 0;
      const existing = pendingToolCalls.get(index) ?? { id: fragment.id ?? `call_${index}`, name: '', args: '' };
      if (fragment.id) existing.id = fragment.id;
      if (fragment.function?.name) existing.name = fragment.function.name;
      if (fragment.function?.arguments) existing.args += fragment.function.arguments;
      pendingToolCalls.set(index, existing);
    }
  }

  function flushToolCalls() {
    for (const [, call] of pendingToolCalls) {
      if (!call.name) continue;
      res.write(`data: ${JSON.stringify({ type: 'tool-call', call: { id: call.id, name: call.name, args: safeParse(call.args) } })}\n\n`);
    }
    pendingToolCalls.clear();
  }

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice('data:'.length).trim();
        if (payload === '[DONE]') continue;
        try {
          const chunk = JSON.parse(payload);
          const choice = chunk.choices?.[0];
          const delta = choice?.delta?.content;
          if (delta) {
            summary += delta;
            res.write(`data: ${JSON.stringify({ type: 'text-delta', delta })}\n\n`);
          }
          const toolCalls = choice?.delta?.tool_calls;
          if (Array.isArray(toolCalls)) accumulateToolCallDeltas(toolCalls);
          if (choice?.finish_reason === 'tool_calls') flushToolCalls();
        } catch {
          // A malformed upstream frame is dropped, never surfaced as a crash.
        }
      }
    }
  } finally {
    // Flush any tool call still pending if the stream ended without an explicit
    // `finish_reason: 'tool_calls'` frame (some upstreams omit it).
    flushToolCalls();
    res.write(`data: ${JSON.stringify({ type: 'done', summary: summary.slice(0, 140) })}\n\n`);
    res.end();
  }
}

function safeParse(text) {
  try {
    return JSON.parse(text ?? '{}');
  } catch {
    return {};
  }
}

function refusalTextFor(category) {
  switch (category) {
    case 'medical-advice':
      return "I'm not able to give medical advice, but I'm glad to log this for you.";
    case 'disordered-eating':
      return "I can't help with that specific goal, but I can set up a neutral eating reminder instead.";
    case 'self-harm':
      return "I'm really sorry you're going through this. Please consider reaching out to someone you trust or a local crisis line.";
    default:
      return "I can't help with that.";
  }
}

export function createApp() {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const headers = lowerHeaders(req.headers);
    let status = 200;

    try {
      if (req.method === 'GET' && url.pathname === '/v1/health') {
        const result = handleHealth();
        status = result.status;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.body));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/v1/chat') {
        const body = await readJsonBody(req);
        if (body === undefined) {
          status = 400;
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 'bad_request' }));
          return;
        }
        const result = await handleChat({ headers, body, fetchImpl: fetch });
        status = result.status;
        if (result.status !== 200) {
          res.writeHead(result.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result.body));
          return;
        }
        await writeSseFromGroqStream(res, result.upstream, result.screen);
        return;
      }

      if (req.method === 'POST' && url.pathname === '/v1/transcribe') {
        const rawBody = await readRawBody(req);
        const audio = readAudioBody(rawBody, headers['content-type']);
        const result = await handleTranscribe({ headers, audio, fetchImpl: fetch });
        status = result.status;
        res.writeHead(result.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.body));
        return;
      }

      status = 404;
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 'bad_request' }));
    } catch {
      status = 502;
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 'upstream_unavailable' }));
    } finally {
      logAccess(req.method, url.pathname, status);
    }
  });
}

if (process.env.NODE_ENV !== 'test' && import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 8787);
  createApp().listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Fallback assistant backend listening on :${port}`);
  });
}

export { handleTranscribe };
