/**
 * Across the app, while a task is in Recently deleted and after it is restored: Today, the browse
 * tab, Search, Priorities and Progress run on the real queries over the in-memory fake repositories
 * and must leave a deleted task out (and its numbers), then show it again, unchanged, on restore.
 */
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000000' }));
jest.mock('@/db', () => require('@/queries/testSupport/dbMock'));
jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  const { clock } = require('@/queries/testSupport/clockMock');
  return { ...actual, today: () => clock.today, now: () => clock.now };
});

import React from 'react';
import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useDeleteForever, useDeleteTask, useRestoreTask } from '@/queries';
import { makeTask } from '@/features/task/testSupport/taskFixture';
import { fake } from '@/queries/testSupport/dbMock';
import { clock } from '@/queries/testSupport/clockMock';
import type { Id } from '@/types';

import TodayScreen from '@/features/today/TodayScreen';
import RoutinesBrowseScreen from '@/features/browse/RoutinesBrowseScreen';
import SearchScreen from '@/features/search/SearchScreen';
import PrioritiesScreen from './priorities/index';
import ProgressScreen from './progress/index';

let client: QueryClient;

function Providers({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The three actions a person can take, run through the app's own mutations on the same client. */
async function actions() {
  const hook = await renderHook(
    () => ({ del: useDeleteTask(), restore: useRestoreTask(), forever: useDeleteForever() }),
    { wrapper: Providers },
  );
  return {
    async remove(id: string) {
      await act(async () => {
        await hook.result.current.del.mutateAsync(id as Id);
      });
    },
    async restore(id: string) {
      await act(async () => {
        await hook.result.current.restore.mutateAsync(id as Id);
      });
    },
    async forever(id: string) {
      await act(async () => {
        await hook.result.current.forever.mutateAsync(id as Id);
      });
    },
  };
}

beforeEach(() => {
  fake.reset();
  clock.today = '2026-07-16';
  clock.now = '2026-07-16T12:00:00.000Z';
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false }, mutations: { retry: false } },
  });
  fake.seedTask(makeTask({ id: 'keep' as Id, name: 'Stays put', importance: 'high', priorityRank: 0 }));
  fake.seedTask(makeTask({ id: 'gone' as Id, name: 'Soon deleted', importance: 'high', priorityRank: 1 }));
});

describe.each([
  ['Today', () => <TodayScreen />],
  ['the Routines tab', () => <RoutinesBrowseScreen />],
  ['Search', () => <SearchScreen />],
  ['Priorities', () => <PrioritiesScreen />],
])('%s', (_name, element) => {
  it('lists the task, drops it when it is deleted (no refresh needed), and lists it again when restored', async () => {
    const view = await render(<Providers>{element()}</Providers>);
    expect(await view.findByText('Soon deleted')).toBeTruthy();
    const app = await actions();

    await app.remove('gone');
    await waitFor(() => expect(view.queryByText('Soon deleted')).toBeNull());
    expect(view.getByText('Stays put')).toBeTruthy();

    await app.restore('gone');
    expect(await view.findByText('Soon deleted')).toBeTruthy();
  });

  it('a task deleted for good does not come back, and the other task is untouched', async () => {
    const view = await render(<Providers>{element()}</Providers>);
    await view.findByText('Soon deleted');
    const app = await actions();
    await app.remove('gone');
    await app.forever('gone');
    await waitFor(() => expect(view.queryByText('Soon deleted')).toBeNull());
    expect(view.getByText('Stays put')).toBeTruthy();
  });

  it('opens with the task already in Recently deleted: it is not shown', async () => {
    const app = await actions();
    await app.remove('gone');
    const view = await render(<Providers>{element()}</Providers>);
    expect(await view.findByText('Stays put')).toBeTruthy();
    expect(view.queryByText('Soon deleted')).toBeNull();
  });
});

describe('Progress', () => {
  it('does not list a deleted task in its per-task breakdown, and lists it again once restored', async () => {
    const view = await render(
      <Providers>
        <ProgressScreen />
      </Providers>,
    );
    expect(await view.findByText('Soon deleted')).toBeTruthy();
    const app = await actions();
    await app.remove('gone');
    await waitFor(() => expect(view.queryByText('Soon deleted')).toBeNull());
    await app.restore('gone');
    expect(await view.findByText('Soon deleted')).toBeTruthy();
  });
});
