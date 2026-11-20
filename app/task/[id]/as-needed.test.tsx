/**
 * M4 — S23 As-Needed Routine Detail. F27: lean detail, no XP/confetti on "Log used it",
 * origin-aware back, empty-history EmptyState.
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
import { makeTask } from '@/features/task/testSupport/taskFixture';
import { ROUTER_CONTEXT } from '@/features/task/testSupport/routerHarness';
import { useToastStore } from '@/app-shell/stores/toast';
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

function asNeededTask() {
  return makeTask({
    id: 'task-1' as Id,
    name: 'Emergency plan',
    isAsNeeded: true,
    cadence: null,
    idealSteps: [{ id: 'ideal-1' as Id, taskId: 'task-1' as Id, role: 'ideal', text: 'Full checklist, in order', position: 0, dueWeekdays: null }],
    fallbackSteps: [
      { id: 'fallback-1' as Id, taskId: 'task-1' as Id, role: 'fallback', text: 'Call the emergency contact', position: 0, dueWeekdays: null },
    ],
  });
}

describe('S23 As-Needed Routine Detail', () => {
  it('empty history renders the EmptyState, not a heatmap', async () => {
    fake.seedTask(asNeededTask());
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1/as-needed', wrapper });
    expect(
      await screen.findByText('Not used yet. There is no schedule and no consistency score. Log it whenever the situation comes up.'),
    ).toBeTruthy();
    expect(screen.queryByTestId('as-needed-heatmap')).toBeNull();
  });

  it('"Log used it" with ideal/fallback defined opens the chooser, then logs and toasts "Logged to history"', async () => {
    fake.seedTask(asNeededTask());
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1/as-needed', wrapper });
    await screen.findByText('Emergency plan');

    await userEvent.press(screen.getByLabelText('Log used it'));
    await screen.findByText('Which version did you do?');
    await userEvent.press(screen.getByLabelText('Emergency plan: Done'));

    // The new history row reads "<date>, Ideal" and the calm toast confirms it.
    expect((await screen.findAllByText('Ideal')).length).toBeGreaterThan(0);
    expect(useToastStore.getState().toast?.message).toBe('Logged to history.');
  });

  it('back is origin-aware: from=search returns to search (S14), not the Routines default', async () => {
    fake.seedTask(asNeededTask());
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1/as-needed?from=search', wrapper });
    await screen.findByText('Emergency plan');

    await userEvent.press(screen.getByLabelText('Back'));
    expect(await screen.findByText('MARKER_SEARCH')).toBeTruthy();
  });

  it('Edit toggles inline name/reference fields; Save persists', async () => {
    fake.seedTask(asNeededTask());
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1/as-needed', wrapper });
    await screen.findByText('Emergency plan');

    await userEvent.press(screen.getByLabelText('More actions'));
    await userEvent.press(await screen.findByLabelText('Edit'));
    const nameInput = await screen.findByLabelText('Name');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Emergency plan v2');
    await userEvent.press(screen.getByLabelText('Save'));

    expect(await screen.findByText('Emergency plan v2')).toBeTruthy();
  });
  it('Edit with an empty name saves nothing, keeps the editor open and warns', async () => {
    fake.seedTask(asNeededTask());
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1/as-needed', wrapper });
    await screen.findByText('Emergency plan');

    await userEvent.press(screen.getByLabelText('More actions'));
    await userEvent.press(await screen.findByLabelText('Edit'));
    await userEvent.clear(await screen.findByLabelText('Name'));
    await userEvent.press(screen.getByLabelText('Save'));

    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe('Give this routine a name to save it.'));
    expect(screen.getByText('Edit routine')).toBeTruthy();
    expect((await fake.repos.tasks.get('task-1' as Id))?.name).toBe('Emergency plan');
  });
});
