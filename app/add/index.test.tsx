/**
 * M4 — S15 Add Task: Pick Type. Static picker, one navigation per row.
 */
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000000' }));
jest.mock('@/db', () => require('@/queries/testSupport/dbMock'));

import React from 'react';
import { renderRouter, screen } from 'expo-router/testing-library';
import { userEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { fake } from '@/queries/testSupport/dbMock';
import { ROUTER_CONTEXT } from '@/features/task/testSupport/routerHarness';

let client: QueryClient;
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  fake.reset();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false }, mutations: { retry: false } },
  });
});

describe('S15 Add Task: Pick Type', () => {
  it('renders the four rows with verbatim copy', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add', wrapper });
    expect(await screen.findByText('What do you want to add?')).toBeTruthy();
    expect(screen.getByText('Recurring, day to day')).toBeTruthy();
    expect(screen.getByText('One-off, or repeats on a schedule')).toBeTruthy();
    expect(screen.getByText('A run with an end date — meds, a challenge')).toBeTruthy();
    expect(screen.getByText('A loose task, no schedule')).toBeTruthy();
  });

  it('tapping "Routine" navigates to S16 (/add/routine)', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add', wrapper });
    await userEvent.press(await screen.findByTestId('add-pick-type-routine'));
    expect(await screen.findByText('New Routine')).toBeTruthy();
  });

  it('tapping "To-do / Note" navigates to S19 (/add/todo)', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add', wrapper });
    await userEvent.press(await screen.findByTestId('add-pick-type-todo'));
    expect(await screen.findByText('New To-do / Note')).toBeTruthy();
  });
});
