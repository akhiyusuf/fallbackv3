import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './index.js';

process.env.GROQ_API_KEY = 'test-key-not-real';

function fakeGroqStreamResponse(chunks) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    ok: true,
    status: 200,
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

async function withServer(run) {
  const app = createApp();
  await new Promise((resolve) => app.listen(0, resolve));
  const { port } = app.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => app.close(resolve));
  }
}

test('B6 — POST /v1/chat assembles a tool call fragmented across 3+ SSE chunks into ONE complete tool-call frame', async () => {
  // Only the SERVER's outbound call (to the receipt verifier / Groq) is faked — the test's
  // own request to the local test server below must go over the real loopback fetch.
  const realFetch = globalThis.fetch;
  let call = 0;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('127.0.0.1')) return realFetch(url, opts);
    call += 1;
    if (call === 1) return { ok: true, status: 200 }; // receipt verify
    const frame1 = { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'create_task', arguments: '{"name":' } }] } }] };
    const frame2 = { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"Morning run",' } }] } }] };
    const frame3 = {
      choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"idealSteps":[],"fallbackSteps":[]}' } }] }, finish_reason: 'tool_calls' }],
    };
    return fakeGroqStreamResponse([`data: ${JSON.stringify(frame1)}\n\n`, `data: ${JSON.stringify(frame2)}\n\n`, `data: ${JSON.stringify(frame3)}\n\n`]);
  };
  try {
    await withServer(async (base) => {
      const response = await fetch(`${base}/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-fallback-platform': 'ios', 'x-fallback-receipt': 'r' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'add a morning run' }] }),
      });
      assert.equal(response.status, 200);
      const text = await response.text();
      const toolCallFrames = text
        .split('\n\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => JSON.parse(l.slice(5)))
        .filter((e) => e.type === 'tool-call');
      assert.equal(toolCallFrames.length, 1);
      assert.deepEqual(toolCallFrames[0].call.args, { name: 'Morning run', idealSteps: [], fallbackSteps: [] });
    });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('B11 — POST /v1/transcribe is wired (no longer a hardcoded 501) and rejects an unentitled request with 401', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/v1/transcribe`, { method: 'POST', body: 'raw-audio-bytes' });
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.code, 'entitlement_invalid');
  });
});
