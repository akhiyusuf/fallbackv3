/**
 * M6 backend. R15 guardrails — docs/API.md §4.
 *
 * Deliberately duplicated from `src/services/ai/guardrails.ts` rather than imported: the
 * backend is a SEPARATE deployable (plain Node, no RN/Metro/babel toolchain, no path
 * aliases), and a cross-runtime import across that boundary would be more fragile than a
 * clearly-labeled, small, literal duplicate. If you change the prose here, change it there
 * too — `GUARDRAIL_SYSTEM_PROMPT`'s CONTENT must match; the app's own copy is re-sent by the
 * client on every request and this file re-injects it server-side regardless (defense in
 * depth against a tampered client, per docs/API.md §4).
 */

export const GUARDRAIL_SYSTEM_PROMPT = `You are Fallback AI, a calm, non-judgmental assistant that helps the user set up and manage habits, routines, events, courses and to-dos inside the Fallback app.

You are not a doctor, therapist, lawyer or emergency service, and must never claim to be one.

You must decline, calmly and without preaching, any request that falls into one of these five categories:
1. self-harm
2. harm to others
3. instructions to carry out illegal activity
4. medical, dosing or clinical advice
5. eating-disorder or extreme-restriction facilitation

Declining a category does NOT mean declining the whole turn. If the user's message also contains a literal, neutral logging/task-creation request (e.g. "add antibiotics twice a day", "remind me to eat lunch every day"), you must still fulfill that literal request — create the task exactly as asked, with no advice, dosing guidance, or numeric goal attached to the declined portion. Never refuse the entire turn merely because part of it touched a guardrail category.

For an apparent crisis, you may add one brief, generic encouragement to seek qualified help, then decline the harmful portion. Keep refusals short and warm, never clinical or alarming.`;

/** @typedef {'self-harm'|'harm-to-others'|'illegal-activity'|'medical-advice'|'disordered-eating'} GuardrailCategory */

const RULES = [
  { category: 'self-harm', patterns: [/\b(kill myself|suicide|self[- ]harm|end my life|hurt myself)\b/i] },
  { category: 'harm-to-others', patterns: [/\b(hurt (him|her|them)|kill (him|her|them)|attack someone|assault)\b/i] },
  { category: 'illegal-activity', patterns: [/\b(how to (make|build) a (bomb|weapon)|steal|break into|launder money)\b/i] },
  { category: 'medical-advice', patterns: [/\b(right dose|correct dosage|is .* the right dose|diagnos|should i take|is it safe to take)\b/i] },
  { category: 'disordered-eating', patterns: [/\b(under \d+ calories|lose weight fast|starve|extreme(ly)? restrict|purge)\b/i] },
];

const LITERAL_LOGGING_PATTERNS = [/\b(add|create|remind me|log|set up|schedule)\b/i];

/**
 * @param {string} text
 * @returns {{category: GuardrailCategory|null, hasLiteralLoggingRequest: boolean}}
 */
export function classifyGuardrail(text) {
  let category = null;
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      category = rule.category;
      break;
    }
  }
  const hasLiteralLoggingRequest = LITERAL_LOGGING_PATTERNS.some((p) => p.test(text));
  return { category, hasLiteralLoggingRequest };
}

export const GUARDRAIL_FIXTURES = [
  { input: 'add antibiotics twice a day', expectCategory: null, expectLiteral: true },
  { input: 'is 2 a day the right dose for me?', expectCategory: 'medical-advice', expectLiteral: false },
  { input: 'remind me to eat lunch every day', expectCategory: null, expectLiteral: true },
  { input: 'goal to eat under 800 calories to lose weight fast', expectCategory: 'disordered-eating', expectLiteral: false },
];
