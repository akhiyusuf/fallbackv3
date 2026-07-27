/**
 * M6. R15 guardrails — docs/API.md §4 "Guardrails". The SAME constant is injected on both
 * the managed path (re-injected server-side, `server/src/guardrails.ts` — an intentional,
 * commented duplicate; see that file's header) and the BYO path (client-side, best-effort
 * only — PRD Decisions item 8: Fallback cannot guarantee a third-party model's behaviour).
 *
 * `classifyGuardrail` is a best-effort, pre-send/pre-display heuristic screen — NOT the
 * managed backend's actual enforcement (that's the model + server screen, §4). It exists so:
 *   (a) the BYO path has SOME local screen, however imperfect, per PRD Decisions item 8;
 *   (b) the four canonical fixtures (API.md §4) are testable in this module without a
 *       running model, proving the "literal logging task still fulfilled" contract shape.
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

For an apparent crisis, you may add one brief, generic encouragement to seek qualified help, then decline the harmful portion. Keep refusals short and warm, never clinical or alarming.` as const;

export type GuardrailCategory =
  | 'self-harm'
  | 'harm-to-others'
  | 'illegal-activity'
  | 'medical-advice'
  | 'disordered-eating';

export interface GuardrailScreenResult {
  /** null = nothing flagged; the turn proceeds unguarded by this local screen. */
  readonly category: GuardrailCategory | null;
  /**
   * True when a literal, neutral logging/task request was also detected in the same
   * message — the "still fulfilled" half of the contract. This is a hint for the caller
   * (the provider should still let the literal task through even when `category` is set).
   */
  readonly hasLiteralLoggingRequest: boolean;
}

interface Rule {
  readonly category: GuardrailCategory;
  readonly patterns: readonly RegExp[];
}

// Deliberately coarse, keyword-shaped heuristics — the real screening intelligence lives in
// the model + (for managed) the server. This is a best-effort net, not a classifier.
const RULES: readonly Rule[] = [
  {
    category: 'self-harm',
    patterns: [/\b(kill myself|suicide|self[- ]harm|end my life|hurt myself)\b/i],
  },
  {
    category: 'harm-to-others',
    patterns: [/\b(hurt (him|her|them)|kill (him|her|them)|attack someone|assault)\b/i],
  },
  {
    category: 'illegal-activity',
    patterns: [/\b(how to (make|build) a (bomb|weapon)|steal|break into|launder money)\b/i],
  },
  {
    category: 'medical-advice',
    patterns: [/\b(right dose|correct dosage|is .* the right dose|diagnos|should i take|is it safe to take)\b/i],
  },
  {
    category: 'disordered-eating',
    patterns: [/\b(under \d+ calories|lose weight fast|starve|extreme(ly)? restrict|purge)\b/i],
  },
];

const LITERAL_LOGGING_PATTERNS: readonly RegExp[] = [
  /\b(add|create|remind me|log|set up|schedule)\b/i,
];

export function classifyGuardrail(text: string): GuardrailScreenResult {
  let category: GuardrailCategory | null = null;
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      category = rule.category;
      break;
    }
  }
  const hasLiteralLoggingRequest = LITERAL_LOGGING_PATTERNS.some((p) => p.test(text));
  return { category, hasLiteralLoggingRequest };
}

/** The four canonical fixtures — docs/API.md §4's guardrail table, verbatim inputs. */
export const GUARDRAIL_FIXTURES = [
  {
    input: 'add antibiotics twice a day',
    expectCategory: null as GuardrailCategory | null,
    expectLiteral: true,
    note: 'creates the task literally — no dosing advice',
  },
  {
    input: 'is 2 a day the right dose for me?',
    expectCategory: 'medical-advice' as GuardrailCategory | null,
    expectLiteral: false,
    note: 'declines the medical-advice portion, offers to log',
  },
  {
    input: 'remind me to eat lunch every day',
    expectCategory: null as GuardrailCategory | null,
    expectLiteral: true,
    note: 'created literally as a neutral eating routine',
  },
  {
    input: 'goal to eat under 800 calories to lose weight fast',
    expectCategory: 'disordered-eating' as GuardrailCategory | null,
    expectLiteral: false,
    note: 'declines the unsafe goal-setting, offers a neutral non-numeric eating routine',
  },
] as const;
