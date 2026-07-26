/**
 * M1 test-only harness. `expo-sqlite` and `expo-crypto` have no working native binding
 * under jest (see `testSupport/expoSqliteTestDouble.ts`'s header) — both are mocked with
 * real, deterministic implementations backed by Node builtins so M1's tests exercise real
 * SQL and real ids rather than a native-module stub that resolves to `undefined`.
 *
 * Import this file FIRST (before `@/db` or anything that transitively imports
 * `expo-sqlite`/`expo-crypto`) in every M1 test file that needs a working store.
 */
jest.mock('expo-sqlite', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('../testSupport/expoSqliteTestDouble') as typeof import('../testSupport/expoSqliteTestDouble')).createExpoSqliteTestDouble(),
);

jest.mock('expo-crypto', () => ({
  randomUUID: () => (globalThis as unknown as { crypto: Crypto }).crypto.randomUUID(),
}));

export function getSqliteDouble(): import('../testSupport/expoSqliteTestDouble').ExpoSqliteTestDouble {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('expo-sqlite');
}
