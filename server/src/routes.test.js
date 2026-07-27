import test from 'node:test';
import assert from 'node:assert/strict';
import { handleChat, handleHealth, handleTranscribe } from './routes.js';

process.env.GROQ_API_KEY = 'test-key-not-real';

function fakeStreamResponse(chunks) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    ok: true,
    body: {
      getReader() {
        return {
          async read() {
            if (i < chunks.length) return { done: false, value: encoder.encode(chunks[i++]) };
            return { done: true, value: undefined };
          },
          releaseLock() {},
        };
      },
    },
  };
}

test('handleHealth returns {status:"ok"}', () => {
  const result = handleHealth();
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { status: 'ok' });
});

test('handleChat rejects a request with no receipt: 401 entitlement_invalid', async () => {
  const result = await handleChat({ headers: { 'x-fallback-platform': 'ios' }, body: { messages: [] }, fetchImpl: async () => fakeStreamResponse([]) });
  assert.equal(result.status, 401);
  assert.equal(result.body.code, 'entitlement_invalid');
});

test('handleChat rejects a malformed body: 400 bad_request', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200 }); // receipt verify succeeds
  const result = await handleChat({ headers: { 'x-fallback-platform': 'ios', 'x-fallback-receipt': 'r' }, body: {}, fetchImpl });
  assert.equal(result.status, 400);
});

test('handleChat surfaces an upstream failure as 502 upstream_unavailable', async () => {
  let call = 0;
  const fetchImpl = async () => {
    call += 1;
    if (call === 1) return { ok: true, status: 200 }; // receipt verify
    return { ok: false, status: 500 }; // groq call
  };
  const result = await handleChat({
    headers: { 'x-fallback-platform': 'ios', 'x-fallback-receipt': 'r' },
    body: { messages: [{ role: 'user', content: 'hi' }] },
    fetchImpl,
  });
  assert.equal(result.status, 502);
  assert.equal(result.body.code, 'upstream_unavailable');
});

test('handleChat, valid request: 200 with a screen result and the upstream stream attached', async () => {
  let call = 0;
  const fetchImpl = async () => {
    call += 1;
    if (call === 1) return { ok: true, status: 200 };
    return fakeStreamResponse(['data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n']);
  };
  const result = await handleChat({
    headers: { 'x-fallback-platform': 'ios', 'x-fallback-receipt': 'r' },
    body: { messages: [{ role: 'user', content: 'add a morning run' }] },
    fetchImpl,
  });
  assert.equal(result.status, 200);
  assert.ok(result.upstream);
});

test('handleChat, a guardrail-flagged literal request still reaches the upstream call (fulfilled, not blocked)', async () => {
  let call = 0;
  let reachedUpstream = false;
  const fetchImpl = async () => {
    call += 1;
    if (call === 1) return { ok: true, status: 200 };
    reachedUpstream = true;
    return fakeStreamResponse([]);
  };
  const result = await handleChat({
    headers: { 'x-fallback-platform': 'ios', 'x-fallback-receipt': 'r' },
    body: { messages: [{ role: 'user', content: 'add antibiotics twice a day' }] },
    fetchImpl,
  });
  assert.equal(result.status, 200);
  assert.equal(result.screen.category, null);
  assert.equal(result.screen.hasLiteralLoggingRequest, true);
  assert.equal(reachedUpstream, true);
});

test('handleChat, a pure medical-advice ask still flags a category for the client to refuse on', async () => {
  let call = 0;
  const fetchImpl = async () => {
    call += 1;
    if (call === 1) return { ok: true, status: 200 };
    return fakeStreamResponse([]);
  };
  const result = await handleChat({
    headers: { 'x-fallback-platform': 'ios', 'x-fallback-receipt': 'r' },
    body: { messages: [{ role: 'user', content: 'is 2 a day the right dose for me?' }] },
    fetchImpl,
  });
  assert.equal(result.screen.category, 'medical-advice');
});

test('handleTranscribe with no receipt -> 401', async () => {
  const result = await handleTranscribe({ headers: {}, audio: new Blob(['x']), fetchImpl: async () => ({ ok: true, status: 200 }) });
  assert.equal(result.status, 401);
});

test('handleTranscribe with no audio -> 400 bad_request', async () => {
  const result = await handleTranscribe({
    headers: { 'x-fallback-platform': 'ios', 'x-fallback-receipt': 'r' },
    audio: null,
    fetchImpl: async () => ({ ok: true, status: 200 }),
  });
  assert.equal(result.status, 400);
});

test('the backend never logs message content — handleChat only ever receives it as a function argument, never a console call', async () => {
  const originalLog = console.log;
  const seen = [];
  console.log = (...args) => seen.push(args.join(' '));
  try {
    let call = 0;
    const fetchImpl = async () => {
      call += 1;
      if (call === 1) return { ok: true, status: 200 };
      return fakeStreamResponse([]);
    };
    const secretMessage = 'a very private habit detail nobody else should see';
    await handleChat({
      headers: { 'x-fallback-platform': 'ios', 'x-fallback-receipt': 'r' },
      body: { messages: [{ role: 'user', content: secretMessage }] },
      fetchImpl,
    });
    for (const line of seen) assert.ok(!line.includes(secretMessage));
  } finally {
    console.log = originalLog;
  }
});
