/**
 * M4 — S19 Create To-do/Note. The fastest create flow: name (+optional note), no schedule,
 * no ideal/fallback.
 */
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000000' }));
jest.mock('@/db', () => require('@/queries/testSupport/dbMock'));
jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  const { clock } = require('@/queries/testSupport/clockMock');
  return { ...actual, today: () => clock.today, now: () => clock.now };
});

import React from 'react';
import { renderRouter, screen } from 'expo-router/testing-library';
import { userEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { fake } from '@/queries/testSupport/dbMock';
import { clock } from '@/queries/testSupport/clockMock';
import { ROUTER_CONTEXT } from '@/features/task/testSupport/routerHarness';

let client: QueryClient;
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  fake.reset();
  clock.today = '2026-07-16';
  clock.now = '2026-07-16T12:00:00.000Z';
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false }, mutations: { retry: false } },
  });
});

describe('S19 Create To-do/Note', () => {
  it('empty name blocks save with the verbatim inline error', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/todo', wrapper });
    await screen.findByText('New To-do / Note');
    await userEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText('Give this a name to save it.')).toBeTruthy();
  });

  it('no ideal/fallback fields and no cadence control are ever shown', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/todo', wrapper });
    await screen.findByText('New To-do / Note');
    expect(screen.queryByText(/Repeats/)).toBeNull();
    expect(screen.queryByLabelText(/Ideal/)).toBeNull();
    expect(screen.queryByLabelText(/Fallback/)).toBeNull();
  });

  it('happy path (name only) saves and lands on Today', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/todo', wrapper });
    const name = await screen.findByLabelText('What is it?');
    await userEvent.type(name, 'Call the vet about refill');
    await userEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText('MARKER_TODAY')).toBeTruthy();
  });
});
