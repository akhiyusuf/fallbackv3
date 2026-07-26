/**
 * M1. F20 — best-effort, local-authoritative cloud sync (docs/API.md §6,
 * docs/ARCHITECTURE.md §9.2). Opt-in, off by default; declining or failing changes nothing
 * else (S45's calm warning-tone banner, never `error`/red).
 *
 * CONTRACT GAP, flagged for the architect — both real transports are currently
 * unreachable from JS with the dependency set this module is allowed to use:
 *   - iOS "iCloud Documents (ubiquity container)" needs a native bridge to the
 *     `NSFileManager` ubiquity container APIs. The entitlements are already declared in
 *     `app.config.ts` (frozen, architect-owned), but nothing in `package.json` exposes that
 *     container to JS — `expo-file-system` only reaches `documentDirectory`/
 *     `cacheDirectory`, not the ubiquity container. This needs either a small native module
 *     addition (a dependency change) or a config-plugin bridge — out of M1's authority.
 *   - Android "Google Drive appDataFolder via expo-auth-session" needs an OAuth client id,
 *     which `app.config.ts`'s `extra` does not currently declare. `expo-auth-session` is
 *     present, but without a client id there is nothing to authenticate against.
 *
 * Until either is resolved, `getSyncProvider()` returns a provider whose `isAvailable()`
 * is honestly `false` and whose `push`/`pull` fail calmly with `NETWORK_UNAVAILABLE` —
 * never a crash, never a false "synced" state, and never blocking anything else in the app
 * (F20 is opt-in and off by default). The `SyncProvider` port itself, the local-always-wins
 * conflict rule, and `settings.sync_*` plumbing are fully implemented and ready for a real
 * transport to be dropped in behind this same interface.
 */
import { Platform } from 'react-native';

import { err } from '@/types';
import type { SyncProvider } from '@/types';

function unavailableProvider(id: SyncProvider['id']): SyncProvider {
  return {
    id,
    async isAvailable() {
      return false;
    },
    async push() {
      return err({ code: 'NETWORK_UNAVAILABLE', message: `${id} sync transport is not wired in this build` });
    },
    async pull() {
      return err({ code: 'NETWORK_UNAVAILABLE', message: `${id} sync transport is not wired in this build` });
    },
  };
}

const noopProvider: SyncProvider = {
  id: 'noop',
  async isAvailable() {
    return false;
  },
  async push() {
    return err({ code: 'NETWORK_UNAVAILABLE', message: 'sync is unavailable on this platform' });
  },
  async pull() {
    return err({ code: 'NETWORK_UNAVAILABLE', message: 'sync is unavailable on this platform' });
  },
};

export function getSyncProvider(): SyncProvider {
  if (Platform.OS === 'ios') return unavailableProvider('icloud-documents');
  if (Platform.OS === 'android') return unavailableProvider('google-drive-appdata');
  return noopProvider;
}
