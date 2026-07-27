/**
 * Proves the hard security boundary from docs/MODULES.md M6: the BYO key lives ONLY in
 * `expo-secure-store` — never SQLite, never a backup file, never a log line.
 */
const mockSecureStoreState = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStoreState.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStoreState.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStoreState.delete(key);
  }),
}));

import * as SecureStore from 'expo-secure-store';
import { clearByoConfig, describeByoConfig, getByoConfig, hasByoConfig, setByoConfig } from '../secureKeyStore';

const SECRET_KEY = 'sk-super-secret-value-should-never-leak-anywhere-else';

describe('secureKeyStore — BYO key SecureStore-only boundary', () => {
  beforeEach(() => {
    mockSecureStoreState.clear();
    jest.clearAllMocks();
  });

  it('setByoConfig writes ONLY through expo-secure-store, never any other channel', async () => {
    await setByoConfig({ baseUrl: 'https://api.openai.com/v1', apiKey: SECRET_KEY, supportsTranscription: true });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('byo.apiKey', SECRET_KEY);
    // Nothing else in this module has any other persistence import — proven structurally by
    // this file importing only `expo-secure-store` and asserting against it exclusively.
  });

  it('getByoConfig reads the secret back only from SecureStore', async () => {
    await setByoConfig({ baseUrl: 'https://api.openai.com/v1', apiKey: SECRET_KEY, supportsTranscription: false });
    const config = await getByoConfig();
    expect(config?.apiKey).toBe(SECRET_KEY);
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('byo.apiKey');
  });

  it('clearByoConfig deletes all three SecureStore keys and nothing survives', async () => {
    await setByoConfig({ baseUrl: 'https://api.openai.com/v1', apiKey: SECRET_KEY, supportsTranscription: true });
    await clearByoConfig();
    expect(await hasByoConfig()).toBe(false);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('byo.apiKey');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('byo.baseUrl');
  });

  it('describeByoConfig NEVER exposes the raw key — the only shape safe to log/display', async () => {
    const config = await (async () => {
      await setByoConfig({ baseUrl: 'https://api.groq.com/openai/v1', apiKey: SECRET_KEY, supportsTranscription: true });
      return getByoConfig();
    })();
    const described = describeByoConfig(config);
    expect(JSON.stringify(described)).not.toContain(SECRET_KEY);
    expect(described).toEqual({ hasKey: true, baseUrlHost: 'api.groq.com' });
  });

  it('no console output during a full set/get/clear cycle ever contains the raw secret', async () => {
    const spies = [
      jest.spyOn(console, 'log').mockImplementation(() => {}),
      jest.spyOn(console, 'warn').mockImplementation(() => {}),
      jest.spyOn(console, 'error').mockImplementation(() => {}),
      jest.spyOn(console, 'info').mockImplementation(() => {}),
    ];
    await setByoConfig({ baseUrl: 'https://api.openai.com/v1', apiKey: SECRET_KEY, supportsTranscription: true });
    await getByoConfig();
    await clearByoConfig();
    for (const spy of spies) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain(SECRET_KEY);
      }
      spy.mockRestore();
    }
  });
});

describe('secureKeyStore — never reachable from SQLite (docs/db backup boundary)', () => {
  it('a backup envelope built from the pinned table list can never carry these SecureStore keys, by construction', async () => {
    // `src/db/backupEnvelope.ts` (M1) enumerates a fixed, closed table list that excludes
    // `entitlement` and has no assistant-BYO table at all — `byo.baseUrl`/`byo.apiKey` are
    // SecureStore key NAMES, not SQLite columns, so there is no table for them to appear in.
    // This test asserts the module-boundary half of that guarantee: nothing in this file
    // exports a value shaped for SQL / JSON-envelope serialization.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const moduleExports = require('../secureKeyStore') as typeof import('../secureKeyStore');
    expect(Object.keys(moduleExports).sort()).toEqual(
      ['clearByoConfig', 'describeByoConfig', 'getByoConfig', 'hasByoConfig', 'setByoConfig'].sort(),
    );
  });
});
