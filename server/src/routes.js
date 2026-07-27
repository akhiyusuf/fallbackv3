/**
 * M6 backend. Pure route handlers — docs/API.md §4. Kept separate from `index.js`'s raw
 * `node:http` wiring so the request/response CONTRACT (status codes, error `code` values,
 * guardrail behaviour, "never log message content") is unit-testable without a live socket.
 *
 * HARD RULE enforced throughout this file: never pass `messages`/`content` to anything that
 * logs. Only method/path/status/error-code may ever reach `console.*`.
 */
import { GUARDRAIL_SYSTEM_PROMPT, classifyGuardrail } from './guardrails.js';
import { verifyReceipt } from './receipt.js';
import { streamGroqChat, transcribeWithGroq } from './groq.js';

const TOOLS = ['create_task', 'update_task', 'delete_task', 'log_state', 'ask_clarification'];

/** @returns {{ status: number, body: object }} */
export function handleHealth() {
  return { status: 200, body: { status: 'ok' } };
}

/**
 * @param {{ headers: Record<string,string>, body: any, fetchImpl: typeof fetch }} input
 * @returns {Promise<{ status: number, body?: object, stream?: AsyncIterable<string> }>}
 */
export async function handleChat({ headers, body, fetchImpl }) {
  const platform = headers['x-fallback-platform'];
  const receipt = headers['x-fallback-receipt'];

  const entitlement = await verifyReceipt({ platform, receipt, fetchImpl });
  if (!entitlement.ok) {
    return { status: entitlement.code === 'entitlement_expired' ? 402 : 401, body: { code: entitlement.code } };
  }

  if (!body || !Array.isArray(body.messages)) {
    return { status: 400, body: { code: 'bad_request' } };
  }

  // Best-effort pre-screen so an obviously-flagged turn still fulfils its literal logging
  // half even if the upstream model is slow to comply (docs/API.md §4's four fixtures).
  const lastUser = [...body.messages].reverse().find((m) => m.role === 'user');
  const screen = lastUser ? classifyGuardrail(String(lastUser.content ?? '')) : { category: null, hasLiteralLoggingRequest: false };

  let upstream;
  try {
    upstream = await streamGroqChat({
      messages: body.messages,
      tools: Array.isArray(body.tools) ? body.tools : TOOLS,
      systemPrompt: GUARDRAIL_SYSTEM_PROMPT,
      fetchImpl,
    });
  } catch {
    return { status: 502, body: { code: 'upstream_unavailable' } };
  }

  if (!upstream.ok) {
    return { status: 502, body: { code: 'upstream_unavailable' } };
  }

  return { status: 200, screen, upstream };
}

/**
 * @param {{ headers: Record<string,string>, audio: Blob, fetchImpl: typeof fetch }} input
 */
export async function handleTranscribe({ headers, audio, fetchImpl }) {
  const platform = headers['x-fallback-platform'];
  const receipt = headers['x-fallback-receipt'];
  const entitlement = await verifyReceipt({ platform, receipt, fetchImpl });
  if (!entitlement.ok) {
    return { status: entitlement.code === 'entitlement_expired' ? 402 : 401, body: { code: entitlement.code } };
  }
  if (!audio) return { status: 400, body: { code: 'bad_request' } };

  try {
    const response = await transcribeWithGroq({ audio, fetchImpl });
    if (!response.ok) return { status: 502, body: { code: 'upstream_unavailable' } };
    const json = await response.json();
    return { status: 200, body: { text: json.text ?? '' } };
  } catch {
    return { status: 502, body: { code: 'upstream_unavailable' } };
  }
}

export { TOOLS };
