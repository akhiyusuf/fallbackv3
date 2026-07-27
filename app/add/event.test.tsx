/**
 * M4 — S17 Create Event. One-off by default, optional recurrence + optional ideal/fallback
 * tracking.
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
import { userEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { fake } from '@/queries/testSupport/dbMock';
import { clock } from '@/queries/testSupport/clockMock';
import { ROUTER_CONTEXT } from '@/features/task/testSupport/routerHarness';
import { useToastStore } from '@/app-shell/stores/toast';
import { err } from '@/types';

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

describe('S17 Create Event', () => {
  it('defaults to "Does not repeat" with no cadence control shown, and no tracking fields', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/event', wrapper });
    await screen.findByText('New Event');
    // Only the Recurrence radio's own "Repeats" option exists yet — the CadencePicker's own
    // "Repeats" Select (a second element with the same label) only appears once "Repeats" is
    // selected.
    expect(screen.getAllByLabelText('Repeats')).toHaveLength(1);
    expect(screen.queryByLabelText(/Ideal step/)).toBeNull();
  });

  it('empty name blocks save with the verbatim inline error', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/event', wrapper });
    await screen.findByText('New Event');
    await userEvent.press(screen.getByLabelText('Save event'));
    expect(await screen.findByText('Give this event a name to save it.')).toBeTruthy();
  });

  it('a bare one-off event (no tracking) saves and lands on Today', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/event', wrapper });
    const name = await screen.findByLabelText('Event name');
    await userEvent.type(name, 'Dentist visit');
    await userEvent.press(screen.getByLabelText('Save event'));
    expect(await screen.findByText('MARKER_TODAY')).toBeTruthy();
  });

  it('selecting Repeats reveals the shared CadencePicker', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/event', wrapper });
    await screen.findByText('New Event');
    await userEvent.press(screen.getByLabelText('Repeats'));
    expect(await screen.findByText('Still an Event — just one that repeats.')).toBeTruthy();
  });
});
