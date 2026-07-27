/**
 * M6. F18 — the BYO key's ONLY storage location. HARD SECURITY BOUNDARY (docs/MODULES.md,
 * docs/API.md §5): the base URL + API key live in `expo-secure-store` (Keychain / Keystore)
 * ONLY.
 *
 *   - Never SQLite — no repository, no table, no column anywhere touches these values.
 *   - Never a backup file — `src/db/backupEnvelope.ts` (M1) enumerates a fixed table list
 *     that does not include this data by construction; this module never hands the key to
 *     anything that could serialize it into a backup.
 *   - Never a log — nothing in this file (or any caller) may pass the key to `console.*`.
 *     `describeByoConfig` below exists SPECIFICALLY so a caller that wants to log/display
 *     connection state has a redacted shape to reach for instead of the raw config.
 *   - Never a request to Fallback's own backend — `ByoAssistantProvider` (this directory)
 *     only ever puts it in the `Authorization` header of a request whose URL is the user's
 *     OWN `baseUrl`, never `extra.assistantApiBaseUrl`.
 *
 * `SCHEMA.md` §8's `entitlement.has_byo_key` / `.byo_supports_transcription` cache only the
 * DERIVED booleans, never the secret itself — this module is the only reader/writer of the
 * secret, and it is the only file in the app allowed to import `expo-secure-store` for this
 * purpose.
 */
import * as SecureStore from 'expo-secure-store';

const BASE_URL_KEY = 'byo.baseUrl';
const API_KEY_KEY = 'byo.apiKey';
const SUPPORTS_TRANSCRIPTION_KEY = 'byo.supportsTranscription';

export interface ByoConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly supportsTranscription: boolean;
}

export async function getByoConfig(): Promise<ByoConfig | null> {
  const [baseUrl, apiKey, supportsTranscription] = await Promise.all([
    SecureStore.getItemAsync(BASE_URL_KEY),
    SecureStore.getItemAsync(API_KEY_KEY),
    SecureStore.getItemAsync(SUPPORTS_TRANSCRIPTION_KEY),
  ]);
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey, supportsTranscription: supportsTranscription === '1' };
}

export async function setByoConfig(config: ByoConfig): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(BASE_URL_KEY, config.baseUrl),
    SecureStore.setItemAsync(API_KEY_KEY, config.apiKey),
    SecureStore.setItemAsync(SUPPORTS_TRANSCRIPTION_KEY, config.supportsTranscription ? '1' : '0'),
  ]);
}

export async function clearByoConfig(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(BASE_URL_KEY),
    SecureStore.deleteItemAsync(API_KEY_KEY),
    SecureStore.deleteItemAsync(SUPPORTS_TRANSCRIPTION_KEY),
  ]);
}

export async function hasByoConfig(): Promise<boolean> {
  return (await getByoConfig()) !== null;
}

/**
 * A redacted view safe to log, display in dev tools, or hand to any diagnostic surface —
 * the key itself never appears, not even partially.
 */
export function describeByoConfig(config: ByoConfig | null): { readonly hasKey: boolean; readonly baseUrlHost: string | null } {
  if (!config) return { hasKey: false, baseUrlHost: null };
  try {
    return { hasKey: true, baseUrlHost: new URL(config.baseUrl).host };
  } catch {
    return { hasKey: true, baseUrlHost: null };
  }
}
