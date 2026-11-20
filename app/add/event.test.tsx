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
import { fireEvent, userEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { fake } from '@/queries/testSupport/dbMock';
import { clock } from '@/queries/testSupport/clockMock';
import { ROUTER_CONTEXT } from '@/features/task/testSupport/routerHarness';
import { useToastStore } from '@/app-shell/stores/toast';
import { err } from '@/types';

/** Dates are chosen in the system picker (stood in for by __mocks__/@react-native-community/datetimepicker.js). */
async function pickDate(label: RegExp, date: Date) {
  await userEvent.press(await screen.findByLabelText(label));
  await fireEvent(await screen.findByTestId('date-picker'), 'change', { type: 'set' }, date);
  await userEvent.press(screen.getByText('Done'));
}

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
  it('defaults to "One-time" with no cadence control shown, and no tracking fields', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/event', wrapper });
    await screen.findByText('New event');
    expect(screen.getByRole('tab', { name: 'One-time' }).props.accessibilityState?.selected).toBe(true);
    expect(screen.queryByTestId('event-cadence-picker')).toBeNull();
    expect(screen.queryByLabelText(/Ideal step/)).toBeNull();
  });

  it('empty name blocks save with the verbatim inline error', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/event', wrapper });
    await screen.findByText('New event');
    await userEvent.press(screen.getByLabelText('Save event'));
    expect(await screen.findByText('Give this event a name to save it.')).toBeTruthy();
  });

  it('a bare one-off event (no tracking) saves and lands on Today', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/event', wrapper });
    const name = await screen.findByLabelText('Event name');
    await userEvent.type(name, 'Dentist visit');
    await userEvent.press(screen.getByLabelText('Save event'));
    expect(await screen.findByText('MARKER_TODAY')).toBeTruthy();
    expect(useToastStore.getState().toast?.message).toBe('Event saved.');
  });

  it('selecting Repeats reveals the shared CadencePicker', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/event', wrapper });
    await screen.findByText('New event');
    await userEvent.press(screen.getByRole('tab', { name: 'Repeats' }));
    expect(await screen.findByTestId('event-cadence-picker')).toBeTruthy();
  });

  it('the date is picked, never typed: the field opens the system picker and shows the chosen day', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/event', wrapper });
    await pickDate(/^Date/, new Date(2026, 6, 26));
    expect(await screen.findByLabelText('Date, Sun, Jul 26')).toBeTruthy();
  });

  it('a failed save shows the failure toast, stays on the form, and preserves the entered data (REVIEW-M4.md item 7)', async () => {
    fake.repos.tasks.insert = async () => err({ code: 'WRITE_FAILED', message: 'forced test failure' });
    useToastStore.setState({ toast: null });

    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/event', wrapper });
    const name = await screen.findByLabelText('Event name');
    await userEvent.type(name, 'Dentist visit');

    await userEvent.press(screen.getByLabelText('Save event'));

    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe("Couldn't save that. Try again."));
    expect(screen.queryByText('MARKER_TODAY')).toBeNull();
    expect(await screen.findByDisplayValue('Dentist visit')).toBeTruthy();
  });
});
