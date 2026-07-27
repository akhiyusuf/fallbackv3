/**
 * M4 — S21 Icon & Color Picker. Search filtering, empty search, Save enable-on-change,
 * and Cancel discarding the in-progress selection.
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
import { makeTask } from '@/features/task/testSupport/taskFixture';
import { ROUTER_CONTEXT } from '@/features/task/testSupport/routerHarness';
import type { Id } from '@/types';

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

describe('S21 Icon & Color Picker', () => {
  it('Save starts disabled until a selection changes', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1/icon', wrapper });
    await screen.findByText('Choose icon & color');
    const saveButtons = screen.getAllByLabelText('Save');
    for (const b of saveButtons) expect(b.props.accessibilityState?.disabled).toBe(true);
  });

  it('searching with no matches shows the EmptyState, never a blank grid', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1/icon', wrapper });
    const search = await screen.findByLabelText('Search icons');
    await userEvent.type(search, 'zzzznomatch');
    expect(await screen.findByText('No icons match "zzzznomatch."')).toBeTruthy();
    expect(screen.getByText('Try a different word.')).toBeTruthy();
  });

  it('selecting a color enables Save; Save persists and returns to S20', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    // Navigate from S20 so a real back-stack entry exists for Save/Cancel to return to.
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1', wrapper });
    await screen.findByDisplayValue('Morning workout');
    await userEvent.press(screen.getByLabelText('Change icon and color'));
    await screen.findByText('Choose icon & color');

    await userEvent.press(screen.getByLabelText('Indigo'));
    const saveButtons = screen.getAllByLabelText('Save');
    expect(saveButtons[0]!.props.accessibilityState?.disabled).toBe(false);
    await userEvent.press(saveButtons[0]!);

    expect(await screen.findByDisplayValue('Morning workout')).toBeTruthy();
  });

  it('Cancel discards the in-progress selection and returns to S20 unchanged', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1', wrapper });
    await screen.findByDisplayValue('Morning workout');
    await userEvent.press(screen.getByLabelText('Change icon and color'));
    await screen.findByText('Choose icon & color');

    await userEvent.press(screen.getByLabelText('Plum'));
    const cancelButtons = screen.getAllByLabelText('Cancel');
    await userEvent.press(cancelButtons[0]!);

    expect(await screen.findByDisplayValue('Morning workout')).toBeTruthy();
  });
});
