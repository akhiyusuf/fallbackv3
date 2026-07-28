/**
 * M6. F16 — S36's Voice & language selection (spec line 3532: "persist immediately ... with
 * a calm Toast ('Saved')").
 *
 * ARCHITECT CR-6 (wave-2 review) — RESOLVED. This module was in-process-only module state,
 * honestly disclosed as such, because `SCHEMA.md` had no column for the preference and
 * `@/queries`'s mutation surface was frozen without one. The architect has since added
 * `settings.assistant_language` / `settings.assistant_voice` (migration 4, SCHEMA §1), so the
 * setting now persists through the ordinary sanctioned path — `useSettings()` to read,
 * `useUpdateSettings()` to write — with no `@/db` import and no module-local state anywhere.
 * A force-quit no longer loses the choice, and it rides along in F19 backups for free.
 */
import { useSettings, useUpdateSettings } from '@/queries';
import type { AssistantPrefs } from '@/types';

export type VoiceLanguagePrefs = AssistantPrefs;

/** Mirrors the `settings` column defaults (migration 4) — used only while the read is in flight. */
export const DEFAULT_VOICE_LANGUAGE_PREFS: VoiceLanguagePrefs = { language: 'en-US', voice: 'warm' };

export interface UseVoiceLanguagePrefs {
  /** The persisted selection; the defaults above until the settings read resolves. */
  readonly prefs: VoiceLanguagePrefs;
  /** Persists both fields. Returns false if the write failed, so the caller can skip its "Saved" toast. */
  save(next: VoiceLanguagePrefs): Promise<boolean>;
}

export function useVoiceLanguagePrefs(): UseVoiceLanguagePrefs {
  const settings = useSettings();
  const updateSettings = useUpdateSettings();

  return {
    prefs: settings.data?.assistant ?? DEFAULT_VOICE_LANGUAGE_PREFS,
    async save(next: VoiceLanguagePrefs): Promise<boolean> {
      const result = await updateSettings.mutateAsync({ assistant: next });
      return result.ok;
    },
  };
}
