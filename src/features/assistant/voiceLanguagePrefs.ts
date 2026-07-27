/**
 * M6. F16 — S36's Voice & language selection (spec line 3532: "persist immediately ... with
 * a calm Toast ('Saved')"). SCHEMA.md has no column for this preference and `@/queries`'s
 * mutation surface is frozen without one (the same class of gap `conversationStore.ts`
 * documents for conversations) — there is no sanctioned durable-storage path this module is
 * allowed to reach for without either a schema change (M1-owned) or a new dependency
 * (architect-owned), neither of which is this builder's call to make unilaterally.
 *
 * Resolution taken here: persist for the lifetime of the app process (module-level state,
 * survives navigation and remounts of S36/S32, lost on force-quit) so the setting genuinely
 * takes effect immediately and the Saved toast is honest — while flagging the durable-storage
 * gap as a follow-up for the architect/M2, exactly as `conversationStore.ts` does for its own
 * frozen-contract gap.
 */
export interface VoiceLanguagePrefs {
  readonly language: string;
  readonly voice: string;
}

const DEFAULT_PREFS: VoiceLanguagePrefs = { language: 'en-US', voice: 'warm' };

let current: VoiceLanguagePrefs = DEFAULT_PREFS;

export function getVoiceLanguagePrefs(): VoiceLanguagePrefs {
  return current;
}

export function setVoiceLanguagePrefs(prefs: VoiceLanguagePrefs): void {
  current = prefs;
}
