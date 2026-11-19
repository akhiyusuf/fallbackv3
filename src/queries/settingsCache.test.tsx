/**
 * `useUpdateSettings` against the real store (review pass 10, data layer): a saved change shows
 * on every screen that reads `useSettings` without a restart; a save that fails returns
 * `{ ok: false }` and never leaves an unsaved value in the cache; overlapping saves all show.
 */
import '../db/__tests__/testHarness';

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import { store, repos } from '@/db';
import { QUERY_KEYS, useSettings, useUpdateSettings } from '@/queries';
import type { Id, NotificationPrefs } from '@/types';

const ALL_OFF: NotificationPrefs = {
  master: false,
  routineDue: false,
  eventStarting: false,
  courseDose: false,
  courseEndingSoon: false,
  gentleReentry: false,
  milestoneReached: false,
  dailyDigest: false,
  dailyDigestTime: '08:00',
};

async function startFromNothing(): Promise<void> {
  const erased = await store.eraseAll();
  expect(erased.ok).toBe(true);
}

async function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
  const hook = await renderHook(
    () => ({
      settings: useSettings(),
      update: useUpdateSettings(),
    }),
    { wrapper },
  );
  return { client, hook };
}

describe('useUpdateSettings and the settings cache', () => {
  beforeEach(async () => {
    await startFromNothing();
  });

  it('a saved change shows on the screen without a restart', async () => {
    const { hook } = await setup();
    await waitFor(() => expect(hook.result.current.settings.data).toBeDefined());

    await act(async () => {
      const saved = await hook.result.current.update.mutateAsync({ accent: 'hue-200' });
      expect(saved.ok).toBe(true);
    });

    await waitFor(() => expect(hook.result.current.settings.data?.accent).toBe('hue-200'));
    expect((await repos.settings.get()).accent).toBe('hue-200');
  });

  it('the cache does not show a new value before the save has been confirmed', async () => {
    const { client, hook } = await setup();
    await waitFor(() => expect(hook.result.current.settings.data).toBeDefined());
    const before = client.getQueryData<{ accent: string }>(QUERY_KEYS.settings)?.accent;

    let pending!: Promise<unknown>;
    await act(async () => {
      pending = hook.result.current.update.mutateAsync({ accent: 'berry' });
      // Checked synchronously, before the save has been confirmed: the cache still shows what is saved.
      expect(client.getQueryData<{ accent: string }>(QUERY_KEYS.settings)?.accent).toBe(before);
    });

    await act(async () => {
      await pending;
    });
    await waitFor(() => expect(hook.result.current.settings.data?.accent).toBe('berry'));
  });

  it('a save that fails validation returns ok:false, and the screen keeps the value that was saved', async () => {
    const { hook } = await setup();
    await act(async () => {
      await hook.result.current.update.mutateAsync({ notifications: { ...ALL_OFF, master: true } });
    });
    await waitFor(() => expect(hook.result.current.settings.data?.notifications.master).toBe(true));

    await act(async () => {
      const refused = await hook.result.current.update.mutateAsync({ notifications: { ...ALL_OFF, dailyDigestTime: '8:00' } });
      expect(refused.ok).toBe(false);
    });

    await waitFor(() => expect(hook.result.current.settings.data?.notifications.dailyDigestTime).toBe('08:00'));
    expect(hook.result.current.settings.data?.notifications.master).toBe(true);
    expect((await repos.settings.get()).notifications.master).toBe(true);
  });

  it('a save the database refuses returns WRITE_FAILED and never shows up in the cache', async () => {
    const { hook } = await setup();
    await waitFor(() => expect(hook.result.current.settings.data).toBeDefined());
    const savedWidgets = hook.result.current.settings.data?.widgets;

    await act(async () => {
      const refused = await hook.result.current.update.mutateAsync({
        widgets: [{ size: 'small-one-task', mode: 'fixed-task', fixedTaskId: 'no-such-task' as Id }],
      });
      expect(refused).toMatchObject({ ok: false, error: { code: 'WRITE_FAILED' } });
    });

    await waitFor(() => expect(hook.result.current.settings.data?.widgets).toEqual(savedWidgets));
    expect((await repos.settings.get()).widgets).toEqual(savedWidgets);
  });

  it('two saves started together both show on the screen', async () => {
    const { hook } = await setup();
    await waitFor(() => expect(hook.result.current.settings.data).toBeDefined());

    await act(async () => {
      await Promise.all([
        hook.result.current.update.mutateAsync({ theme: 'dark' }),
        hook.result.current.update.mutateAsync({ accent: 'plum' }),
      ]);
    });

    await waitFor(() => {
      expect(hook.result.current.settings.data?.theme).toBe('dark');
      expect(hook.result.current.settings.data?.accent).toBe('plum');
    });
  });
});
