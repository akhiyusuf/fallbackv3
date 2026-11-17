/**
 * S15 — the add menu. /add opens the "What do you want to add?" sheet (AddMenuHost) over Today;
 * each row routes to its own create screen and Close leaves the person where they were.
 */
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000000' }));
jest.mock('@/db', () => require('@/queries/testSupport/dbMock'));

import React from 'react';
import { renderRouter, screen } from 'expo-router/testing-library';
import { userEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { fake } from '@/queries/testSupport/dbMock';
import { ROUTER_CONTEXT } from '@/features/task/testSupport/routerHarness';
import { AddMenuHost } from '@/features/task/AddMenuHost';
import { useAddMenuStore } from '@/app-shell/stores/addMenu';
import { Text } from '@/ui/AppText';

let client: QueryClient;
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Today with the app-wide add menu mounted, as app/_layout.tsx mounts it. */
function TodayWithAddMenu() {
  return (
    <>
      <AddMenuHost />
      <Text>MARKER_TODAY</Text>
    </>
  );
}
const CONTEXT = { ...ROUTER_CONTEXT, today: TodayWithAddMenu };

beforeEach(() => {
  fake.reset();
  useAddMenuStore.setState({ open: false });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false }, mutations: { retry: false } },
  });
});

describe('S15 Add menu', () => {
  it('opens over Today with the four types and their copy', async () => {
    await renderRouter(CONTEXT, { initialUrl: '/add', wrapper });
    expect(await screen.findByText('What do you want to add?')).toBeTruthy();
    expect(screen.getByText('MARKER_TODAY')).toBeTruthy();
    expect(screen.getByText('Repeats day to day')).toBeTruthy();
    expect(screen.getByText('One-off, or repeats on a schedule')).toBeTruthy();
    expect(screen.getByText('A run with an end date, like medication')).toBeTruthy();
    expect(screen.getByText('A loose task, no schedule')).toBeTruthy();
    expect(screen.getByTestId('add-pick-assistant')).toBeTruthy();
  });

  it('"Routine" routes to S16 (New routine)', async () => {
    await renderRouter(CONTEXT, { initialUrl: '/add', wrapper });
    await userEvent.press(await screen.findByTestId('add-pick-type-routine'));
    expect(await screen.findByText('New routine')).toBeTruthy();
    expect(useAddMenuStore.getState().open).toBe(false);
  });

  it('"Event" routes to S17 (New event)', async () => {
    await renderRouter(CONTEXT, { initialUrl: '/add', wrapper });
    await userEvent.press(await screen.findByTestId('add-pick-type-event'));
    expect(await screen.findByText('New event')).toBeTruthy();
  });

  it('"Course" routes to S18 (New course)', async () => {
    await renderRouter(CONTEXT, { initialUrl: '/add', wrapper });
    await userEvent.press(await screen.findByTestId('add-pick-type-course'));
    expect(await screen.findByText('New course')).toBeTruthy();
  });

  it('"To-do or note" routes to S19 (New to-do)', async () => {
    await renderRouter(CONTEXT, { initialUrl: '/add', wrapper });
    await userEvent.press(await screen.findByTestId('add-pick-type-todo'));
    expect(await screen.findByText('New to-do')).toBeTruthy();
  });

  it('Close dismisses the menu and stays on Today', async () => {
    await renderRouter(CONTEXT, { initialUrl: '/add', wrapper });
    await screen.findByText('What do you want to add?');
    await userEvent.press(screen.getByLabelText('Close'));
    expect(screen.queryByText('What do you want to add?')).toBeNull();
    expect(screen.getByText('MARKER_TODAY')).toBeTruthy();
  });
});
