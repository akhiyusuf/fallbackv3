/**
 * End-to-end proof of the BYO key boundary (docs/MODULES.md M6 non-negotiable), exercised
 * through M1's OWN public db API (`@/db`'s `store`/`repos`) exactly the way
 * `src/db/__tests__/backupRestore.test.ts` does — this file only READS that public surface,
 * it does not modify `src/db/**`. Seeds a real secret into the mocked SecureStore, drives a
 * real backup through `store.backup()`, and asserts the on-disk envelope — real SQLite rows,
 * real JSON serialization — never contains it, no matter what table data exists alongside it.
 */
import '../../../db/__tests__/testHarness';

const mockSecureStoreState = new Map<string, string>();
const REAL_SECRET = 'sk-do-not-leak-1234567890abcdef';

jest.mock('expo-file-system/legacy', () => require('../../../db/testSupport/fileSystemTestDouble'));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStoreState.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStoreState.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStoreState.delete(key);
  }),
}));

import { newId } from '@/lib/id';
import type { Task } from '@/types';
import { setByoConfig } from '../secureKeyStore';

async function freshDb() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  (require('expo-sqlite') as { __reset: () => void }).__reset();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  (require('../../../db/testSupport/fileSystemTestDouble') as { __reset: () => void }).__reset();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const db = require('../../../db/index') as typeof import('@/db');
  const opened = await db.store.open();
  expect(opened.ok).toBe(true);
  return db;
}

function buildTask(): Task {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id: newId(),
    type: 'routine',
    name: 'Read',
    note: null,
    icon: 'Repeat',
    color: 'forge-orange',
    isAsNeeded: false,
    cadence: { kind: 'daily' },
    eventDate: null,
    timeOfDay: null,
    startDate: null,
    endDate: null,
    dosesPerDay: 1,
    isTracked: true,
    importance: null,
    necessity: null,
    todoDoneAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    snoozable: true,
  } as Task;
}

describe('BYO key boundary — never appears in a backup file (SecureStore vs. SQLite)', () => {
  beforeEach(() => mockSecureStoreState.clear());

  it('a real secret in SecureStore is absent from a real backup envelope, even with app data present', async () => {
    // Seed the BYO key into (mocked) SecureStore — never through @/db.
    await setByoConfig({ baseUrl: 'https://api.groq.com/openai/v1', apiKey: REAL_SECRET, supportsTranscription: true });

    const { store, repos } = await freshDb();
    const task = buildTask();
    await repos.tasks.insert(task, []);

    const backupResult = await store.backup();
    expect(backupResult.ok).toBe(true);
    if (!backupResult.ok) return;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('../../../db/testSupport/fileSystemTestDouble') as typeof import('@/db/testSupport/fileSystemTestDouble');
    const raw = await fs.readAsStringAsync(backupResult.value.uri);

    expect(raw).not.toContain(REAL_SECRET);
    expect(raw).not.toContain('byo.apiKey');
    expect(raw).not.toContain('entitlement');
  });
});
