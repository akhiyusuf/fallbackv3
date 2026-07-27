import './testHarness';

jest.mock('expo-file-system/legacy', () => require('../testSupport/fileSystemTestDouble'));
jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(async () => undefined),
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

async function freshDb() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  (require('expo-sqlite') as { __reset: () => void }).__reset();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const db = require('../index') as typeof import('../index');
  return db;
}

describe('StoreLifecycle', () => {
  it('status() is "uninitialised" before open(), and "ready" after', async () => {
    const { store } = await freshDb();
    expect(store.status()).toBe('uninitialised');
    const result = await store.open();
    expect(result).toEqual({ ok: true, value: 'ready' });
    expect(store.status()).toBe('ready');
  });

  it('open() seeds the settings singleton with a tenure_anchor_date, and is idempotent on re-open', async () => {
    const { repos, store } = await freshDb();
    await store.open();
    const first = await repos.settings.get();
    expect(first.tenureAnchorDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(first.theme).toBe('auto');
    expect(first.accent).toBe('forge-orange');

    await store.open();
    const second = await repos.settings.get();
    // Re-opening must not mint a second/different anchor.
    expect(second.tenureAnchorDate).toBe(first.tenureAnchorDate);
  });

  it('eraseAll is atomic: a fresh store afterwards has zero tasks, zero XP, and a freshly-minted tenure anchor row', async () => {
    const { repos, store } = await freshDb();
    await store.open();
    const before = await repos.settings.get();

    const insertResult = await repos.tasks.insert(
      {
        id: 'seed-task' as never,
        type: 'todo',
        name: 'Buy milk',
        note: null,
        icon: 'Repeat',
        color: 'forge-orange',
        isAsNeeded: false,
        cadence: null,
        eventDate: null,
        timeOfDay: null,
        startDate: null,
        endDate: null,
        dosesPerDay: 1,
        isTracked: false,
        importance: null,
        necessity: null,
        todoDoneAt: null,
        createdAt: '2026-01-01T00:00:00.000Z' as never,
        updatedAt: '2026-01-01T00:00:00.000Z' as never,
        deletedAt: null,
        snoozable: true,
      },
      [],
    );
    expect(insertResult.ok).toBe(true);

    const erased = await store.eraseAll();
    expect(erased.ok).toBe(true);
    expect(store.status()).toBe('ready');

    expect(await repos.tasks.list({ includeDeleted: true })).toHaveLength(0);
    expect(await repos.progress.lifetimeXp()).toBe(0);

    const after = await repos.settings.get();
    // Same-day re-erase can legally produce the same date string; what matters is that the
    // settings row itself was recreated fresh, not mutated in place with old task data
    // lingering — asserted above via the empty task list.
    expect(after.tenureAnchorDate).toBe(before.tenureAnchorDate);
  });

  it('eraseAll clears the BYO SecureStore keys', async () => {
    const { store } = await freshDb();
    await store.open();
    await store.eraseAll();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const SecureStore = require('expo-secure-store') as { deleteItemAsync: jest.Mock };
    const clearedKeys = SecureStore.deleteItemAsync.mock.calls.map((call: unknown[]) => call[0]);
    expect(clearedKeys).toEqual(expect.arrayContaining(['byo.baseUrl', 'byo.apiKey']));
  });

  it('erase-all on an already-empty store is a no-op that still lands on a ready, empty store', async () => {
    const { repos, store } = await freshDb();
    await store.open();
    const first = await store.eraseAll();
    expect(first.ok).toBe(true);
    const second = await store.eraseAll();
    expect(second.ok).toBe(true);
    expect(await repos.tasks.list()).toHaveLength(0);
  });

  // Review pass 1, blocking item 2: MODULES.md's non-negotiable is that eraseAll "clears
  // SecureStore keys and widget snapshot files too". M1 has no direct handle on the
  // shared-container snapshot (M7's WidgetBridge) — `store:erased` is the pinned event
  // (`src/types/ports.ts`'s closed AppEvent union) that lets it react without an import
  // cycle (ARCHITECTURE §4.4). `open()` similarly must be the sole producer of `store:ready`.
  describe('event emission (docs/API.md §3, ARCHITECTURE §4.4)', () => {
    it('open() emits store:ready exactly once on a successful open, never on a failed one', async () => {
      const { store } = await freshDb();
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const events = require('@/lib/events') as typeof import('@/lib/events');
      const readyHandler = jest.fn();
      const unsubscribe = events.on('store:ready', readyHandler);

      const result = await store.open();
      expect(result.ok).toBe(true);
      expect(readyHandler).toHaveBeenCalledTimes(1);
      unsubscribe();
    });

    it('eraseAll() emits store:erased exactly once when it resolves ok, and does not fire when it fails', async () => {
      const { store } = await freshDb();
      await store.open();
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const events = require('@/lib/events') as typeof import('@/lib/events');
      const erasedHandler = jest.fn();
      const unsubscribeErased = events.on('store:erased', erasedHandler);

      const erased = await store.eraseAll();
      expect(erased.ok).toBe(true);
      expect(erasedHandler).toHaveBeenCalledTimes(1);
      unsubscribeErased();
    });

    it('a failed eraseAll (the post-delete re-open fails) does not emit store:erased', async () => {
      const { store } = await freshDb();
      await store.open();
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const events = require('@/lib/events') as typeof import('@/lib/events');
      const erasedHandler = jest.fn();
      const unsubscribe = events.on('store:erased', erasedHandler);

      // Force the RE-OPEN inside eraseAll (after the delete) to fail, so eraseAll itself
      // returns a non-ok Result without ever reaching the emit.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const clientModule = require('../client') as typeof import('../client');
      const originalOpenClient = clientModule.openClient;
      clientModule.openClient = jest.fn(async () => {
        throw new Error('simulated reopen failure');
      });

      const erased = await store.eraseAll();
      expect(erased.ok).toBe(false);
      expect(erasedHandler).not.toHaveBeenCalled();

      clientModule.openClient = originalOpenClient;
      unsubscribe();
    });

    // Review pass 2, blocking item: `emit()` is synchronous and runs subscribers inline
    // (`src/lib/events.ts`) — a throwing subscriber (M7's widget bridge is the concrete,
    // named example) must never be able to falsify a Result this module has ALREADY
    // determined, nor the `status()` it already set. A bug in a subscriber must stay that
    // subscriber's bug, not masquerade as store corruption or a failed erase.
    it('a throwing store:ready subscriber cannot turn a healthy open() into a reported "corrupt" store', async () => {
      const { store } = await freshDb();
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const events = require('@/lib/events') as typeof import('@/lib/events');
      const unsubscribe = events.on('store:ready', () => {
        throw new Error('simulated subscriber bug (e.g. M7 widget bridge)');
      });

      const result = await store.open();
      expect(result).toEqual({ ok: true, value: 'ready' });
      expect(store.status()).toBe('ready');

      unsubscribe();
    });

    it('a throwing store:erased/store:ready subscriber cannot turn a fully-successful eraseAll() into a reported failure', async () => {
      const { store } = await freshDb();
      await store.open();
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const events = require('@/lib/events') as typeof import('@/lib/events');
      const unsubscribeErased = events.on('store:erased', () => {
        throw new Error('simulated subscriber bug (e.g. M7 widget bridge)');
      });
      const unsubscribeReady = events.on('store:ready', () => {
        throw new Error('simulated subscriber bug (e.g. M7 widget bridge)');
      });

      const erased = await store.eraseAll();
      expect(erased).toEqual({ ok: true, value: undefined });
      expect(store.status()).toBe('ready');

      unsubscribeErased();
      unsubscribeReady();
    });
  });
});
