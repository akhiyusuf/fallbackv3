/**
 * M4 — S16 Create Routine. The most complex create screen: as-needed branching, cadence,
 * sub-step schedule grid, and the F23 no-empty-run-occurrence save-time validation.
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

describe('S16 Create Routine', () => {
  it('empty name blocks save with the verbatim inline error', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/routine', wrapper });
    await screen.findByText('New Routine');
    await userEvent.press(screen.getByLabelText('Save routine'));
    expect(await screen.findByText('Give this routine a name to save it.')).toBeTruthy();
  });

  it('as-needed toggle hides the cadence + sub-step regions and relabels Ideal/Fallback as optional', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/routine', wrapper });
    await screen.findByText('New Routine');
    expect(screen.getByLabelText('Repeats')).toBeTruthy();

    await userEvent.press(screen.getByTestId('as-needed-switch'));

    expect(screen.queryByLabelText('Repeats')).toBeNull();
    expect(await screen.findByText('Ideal (optional)')).toBeTruthy();
    expect(screen.getByText('Fallback (optional)')).toBeTruthy();
    expect(
      screen.getByText("As-needed routines skip Today entirely — you'll log them from the Routines list whenever the situation comes up."),
    ).toBeTruthy();
  });

  it('toggling as-needed back off does not lose the name already typed', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/routine', wrapper });
    const nameInput = await screen.findByLabelText('Routine name');
    await userEvent.type(nameInput, 'Studying');
    await userEvent.press(screen.getByTestId('as-needed-switch'));
    await userEvent.press(screen.getByTestId('as-needed-switch'));
    expect(await screen.findByDisplayValue('Studying')).toBeTruthy();
  });

  it('an empty ideal-step run-occurrence day blocks save with the offending-day banner', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/routine', wrapper });
    const nameInput = await screen.findByLabelText('Routine name');
    await userEvent.type(nameInput, 'Studying');

    // Specific weekdays: select Monday and Tuesday.
    await userEvent.press(screen.getByLabelText('Mon'));
    await userEvent.press(screen.getByLabelText('Tue'));

    const idealInput = await screen.findByLabelText('Ideal step 1');
    await userEvent.type(idealInput, 'Review notes');
    // Turn the step off for Tuesday, leaving Tuesday with zero due ideal steps.
    await userEvent.press(screen.getByLabelText('Review notes, T'));

    const fallbackInput = await screen.findByLabelText('Fallback step 1');
    await userEvent.type(fallbackInput, 'Skim notes');

    await userEvent.press(screen.getByLabelText('Save routine'));
    expect(await screen.findByText(/Tuesday has no ideal step due/)).toBeTruthy();
  });

  it('happy path saves and navigates to Today', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/routine', wrapper });
    const nameInput = await screen.findByLabelText('Routine name');
    await userEvent.type(nameInput, 'Studying');
    await userEvent.press(screen.getByLabelText('Mon'));

    const idealInput = await screen.findByLabelText('Ideal step 1');
    await userEvent.type(idealInput, 'Review notes');
    const fallbackInput = await screen.findByLabelText('Fallback step 1');
    await userEvent.type(fallbackInput, 'Skim notes');

    await userEvent.press(screen.getByLabelText('Save routine'));
    expect(await screen.findByText('MARKER_TODAY')).toBeTruthy();
  });

  it('a failed save shows the failure toast, stays on the form, and preserves the entered data (REVIEW-M4.md item 7)', async () => {
    fake.repos.tasks.insert = async () => err({ code: 'WRITE_FAILED', message: 'forced test failure' });
    useToastStore.setState({ toast: null });

    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/routine', wrapper });
    const nameInput = await screen.findByLabelText('Routine name');
    await userEvent.type(nameInput, 'Studying');
    await userEvent.press(screen.getByLabelText('Mon'));
    const idealInput = await screen.findByLabelText('Ideal step 1');
    await userEvent.type(idealInput, 'Review notes');
    const fallbackInput = await screen.findByLabelText('Fallback step 1');
    await userEvent.type(fallbackInput, 'Skim notes');

    await userEvent.press(screen.getByLabelText('Save routine'));

    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe("Couldn't save that — try again."));
    expect(screen.queryByText('MARKER_TODAY')).toBeNull();
    expect(await screen.findByDisplayValue('Studying')).toBeTruthy();
    expect(await screen.findByDisplayValue('Review notes')).toBeTruthy();
  });
});
