/**
 * M4 — S18 Create Course. Always trackable, always has an end date and cadence, multi-dose.
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

describe('S18 Create Course', () => {
  it('missing end date blocks save with the verbatim inline error', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/course', wrapper });
    const name = await screen.findByLabelText('Course name');
    await userEvent.type(name, 'Antibiotics');
    const ideal = await screen.findByLabelText('Ideal step 1');
    await userEvent.type(ideal, 'Take with food');
    const fallback = await screen.findByLabelText('Fallback step 1');
    await userEvent.type(fallback, 'Take the dose');

    await userEvent.press(screen.getByLabelText('Save course'));
    expect(await screen.findByText('Set an end date — a course always runs for a fixed span.')).toBeTruthy();
  });

  it('>1 doses/day shows the per-dose helper copy', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/course', wrapper });
    const doses = await screen.findByLabelText('Doses per day');
    await userEvent.clear(doses);
    await userEvent.type(doses, '2');
    expect(await screen.findByText("Each dose completes on its own — the day counts once every dose is handled.")).toBeTruthy();
  });

  it('happy path (Antibiotics fixture) saves and lands on Today', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/course', wrapper });
    const name = await screen.findByLabelText('Course name');
    await userEvent.type(name, 'Antibiotics');
    const end = await screen.findByLabelText('End date');
    await userEvent.type(end, '2026-07-26');
    const ideal = await screen.findByLabelText('Ideal step 1');
    await userEvent.type(ideal, 'Take with food, full glass of water');
    const fallback = await screen.findByLabelText('Fallback step 1');
    await userEvent.type(fallback, 'Take the dose, skip the water reminder');

    await userEvent.press(screen.getByLabelText('Save course'));
    expect(await screen.findByText('MARKER_TODAY')).toBeTruthy();
  });
});
