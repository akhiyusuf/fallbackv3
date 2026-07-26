/**
 * M1. F19 backup/restore + F25 erase-all. Thin, feature-facing pass-throughs to
 * `StoreLifecycle` (`src/db`) — the dependency rule (ARCHITECTURE §2) is that a feature
 * module never imports `@/db` directly, only `@/services/**`, so S45/S47/S48 (and any
 * future consumer) call through here.
 */
import { store } from '@/db';
import type { Instant, Result } from '@/types';

export function createBackup(): Promise<Result<{ uri: string; createdAt: Instant }>> {
  return store.backup();
}

export function restoreBackup(uri: string): Promise<Result<void>> {
  return store.restore(uri);
}

/** F25: atomic. Fully erased or fully intact — never half-wiped. */
export function eraseAllData(): Promise<Result<void>> {
  return store.eraseAll();
}
