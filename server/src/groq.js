/**
 * M6 backend. Thin Groq client — docs/API.md §4 "Managed STT source — PINNED". Model ids
 * are server-side configuration (env vars), never client constants; the vendor stays
 * invisible to the app (user-facing name: "Fallback AI").
 */
import { toolDefinitionsFor } from './toolSchemas.js';

const GROQ_BASE_URL = process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1';
const CHAT_MODEL = process.env.GROQ_CHAT_MODEL ?? 'llama-3.3-70b-versatile';
const STT_MODEL = process.env.GROQ_STT_MODEL ?? 'whisper-large-v3-turbo';

function apiKey() {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY is not configured.');
  return key;
}

/**
 * @param {{ messages: unknown[], tools: string[], systemPrompt: string, fetchImpl: typeof fetch }} input
 * @returns {Promise<Response>}
 */
export async function streamGroqChat({ messages, tools, systemPrompt, fetchImpl }) {
  return fetchImpl(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify({
      model: CHAT_MODEL,
      stream: true,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      tools: toolDefinitionsFor(tools),
    }),
  });
}

/**
 * @param {{ audio: Blob, fetchImpl: typeof fetch }} input
 * @returns {Promise<Response>}
 */
export async function transcribeWithGroq({ audio, fetchImpl }) {
  const form = new FormData();
  form.append('file', audio, 'audio.m4a');
  form.append('model', STT_MODEL);
  return fetchImpl(`${GROQ_BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
  });
}
