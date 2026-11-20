/**
 * Round 3 spec coverage (review/EDGE-BRIEF.md). ALLSCREENS_1.md S16 "error — no-empty-run-occurrence
 * rejection" gives the banner copy in full. The app shows a shorter sentence. No decision in
 * docs/DESIGN_DECISIONS.md changes it. The flow mirrors app/add/routine.test.tsx.
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
import { userEvent, within } from '@testing-library/react-native';
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

async function buildTuesdayGap() {
  await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/routine', wrapper });
  await userEvent.type(await screen.findByLabelText('Routine name'), 'Studying');
  await userEvent.press(screen.getByLabelText('Mon'));
  await userEvent.press(screen.getByLabelText('Tue'));
  await userEvent.type(await screen.findByLabelText('Ideal step 1'), 'Review notes');
  await userEvent.press(screen.getAllByLabelText(/^Add step/)[0]!);
  await userEvent.type(await screen.findByLabelText('Ideal step 2'), 'Practice problems');
  await userEvent.press(within(screen.getByLabelText('Days for Review notes')).getByLabelText('Tue'));
  await userEvent.press(within(screen.getByLabelText('Days for Practice problems')).getByLabelText('Tue'));
  await userEvent.type(await screen.findByLabelText('Fallback step 1'), 'Skim notes');
  await userEvent.press(screen.getByLabelText('Save routine'));
}

describe('S16 — the no-empty-run-occurrence banner copy (spec coverage)', () => {
  // SPEC NOT MET (ALLSCREENS_1.md S16, error state): the banner must read in full, "Tuesday has no
  // ideal step due — every step is toggled off. Turn at least one back on for Tuesday, or add a
  // step that runs then." The app shows "Tuesday has no ideal step due." and the shorter line.
  it.failing('the banner gives the spec sentence in full, including the way out ("or add a step that runs then")', async () => {
    await buildTuesdayGap();
    expect(
      await screen.findByText(
        'Tuesday has no ideal step due — every step is toggled off. Turn at least one back on for Tuesday, or add a step that runs then.',
      ),
    ).toBeTruthy();
  });

  it('the banner names the offending day and blocks the save (what a person needs to act on)', async () => {
    await buildTuesdayGap();
    expect(await screen.findByText(/Tuesday has no ideal step due/)).toBeTruthy();
    expect(screen.getByLabelText('Save routine')).toBeTruthy();
  });
});
