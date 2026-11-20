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
    expect(await screen.findByText('Set an end date. A course runs for a fixed span.')).toBeTruthy();
  });

  it('>1 doses/day shows the per-dose helper copy (stepper)', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/course', wrapper });
    // The doses control is a stepper: the helper appears once there is more than one dose.
    await userEvent.press(await screen.findByLabelText('Increase doses per day'));
    expect(await screen.findByText('Each dose is logged on its own. The day counts once every dose is handled.')).toBeTruthy();
  });

  it('happy path (Antibiotics fixture) saves, toasts "Course saved" and lands on Today', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/course', wrapper });
    const name = await screen.findByLabelText('Course name');
    await userEvent.type(name, 'Antibiotics');
    await pickDate(/^Ends/, new Date(2026, 6, 26));
    const ideal = await screen.findByLabelText('Ideal step 1');
    await userEvent.type(ideal, 'Take with food, full glass of water');
    const fallback = await screen.findByLabelText('Fallback step 1');
    await userEvent.type(fallback, 'Take the dose, skip the water reminder');

    await userEvent.press(screen.getByLabelText('Save course'));
    expect(await screen.findByText('MARKER_TODAY')).toBeTruthy();
    expect(useToastStore.getState().toast?.message).toBe('Course saved.');
  });

  it('dates are picked, never typed: the field opens the system picker and shows the chosen day', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/course', wrapper });
    await pickDate(/^Ends/, new Date(2026, 6, 26));
    expect(await screen.findByLabelText('Ends, Sun, Jul 26')).toBeTruthy();
  });

  it('an end date before the start date shows an inline error and does not save', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/course', wrapper });
    const name = await screen.findByLabelText('Course name');
    await userEvent.type(name, 'Antibiotics');
    await pickDate(/^Starts/, new Date(2026, 6, 20));
    await pickDate(/^Ends/, new Date(2026, 6, 10));
    const ideal = await screen.findByLabelText('Ideal step 1');
    await userEvent.type(ideal, 'Take with food');
    const fallback = await screen.findByLabelText('Fallback step 1');
    await userEvent.type(fallback, 'Take the dose');

    await userEvent.press(screen.getByLabelText('Save course'));
    expect(await screen.findByText('The end date is before the start date.')).toBeTruthy();
    expect(screen.queryByText('MARKER_TODAY')).toBeNull();
  });

  it('a failed save shows the failure toast, stays on the form, and preserves the entered data (REVIEW-M4.md item 7)', async () => {
    fake.repos.tasks.insert = async () => err({ code: 'WRITE_FAILED', message: 'forced test failure' });
    useToastStore.setState({ toast: null });

    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/course', wrapper });
    const name = await screen.findByLabelText('Course name');
    await userEvent.type(name, 'Antibiotics');
    await pickDate(/^Ends/, new Date(2026, 6, 26));
    const ideal = await screen.findByLabelText('Ideal step 1');
    await userEvent.type(ideal, 'Take with food');
    const fallback = await screen.findByLabelText('Fallback step 1');
    await userEvent.type(fallback, 'Take the dose');

    await userEvent.press(screen.getByLabelText('Save course'));

    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe("Couldn't save that. Try again."));
    expect(screen.queryByText('MARKER_TODAY')).toBeNull();
    expect(await screen.findByDisplayValue('Antibiotics')).toBeTruthy();
  });
});
