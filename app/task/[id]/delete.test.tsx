/**
 * M4 — S22 Delete Confirmation. Asserts the TWO SEPARATE origin rules are actually wired
 * correctly through real navigation (not just the pure `deleteOrigin.ts` unit tests):
 * "Keep it" returns to whichever screen opened S22, and confirmed delete uses the two-level
 * origin lookup — a DIFFERENT destination computed a DIFFERENT way.
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
import { err } from '@/types';
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

describe('S22 Delete Confirmation — RULE 1 (Keep it / cancel, distinct from RULE 2)', () => {
  it('opened from S20 -> "Keep it" returns to S20 unchanged', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1', wrapper });
    await screen.findByDisplayValue('Morning workout');

    await userEvent.press(screen.getByLabelText('Delete routine'));
    await screen.findByText('Delete this routine?');

    await userEvent.press(screen.getByLabelText('Keep it'));
    expect(await screen.findByDisplayValue('Morning workout')).toBeTruthy();
  });

  it('opened from S23 -> "Keep it" returns to S23 unchanged, never falls through to S20', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id, isAsNeeded: true, cadence: null }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1/as-needed', wrapper });
    await screen.findByText('As-needed routine');

    await userEvent.press(screen.getByLabelText('Delete routine'));
    await screen.findByText('Delete this routine?');

    await userEvent.press(screen.getByLabelText('Keep it'));
    expect(await screen.findByText('As-needed routine')).toBeTruthy();
  });
});

describe('S22 Delete Confirmation — RULE 2 (confirmed delete, a DIFFERENT lookup)', () => {
  it('the most common path: S09(today) -> S20 -> S22 -> confirm -> lands back on Today, never Routines', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1?from=today', wrapper });
    await screen.findByDisplayValue('Morning workout');

    await userEvent.press(screen.getByLabelText('Delete routine'));
    await screen.findByText('Delete this routine?');
    await userEvent.press(screen.getByLabelText('Delete routine'));

    expect(await screen.findByText('MARKER_TODAY')).toBeTruthy();
  });

  it('S20 opened from an unstable origin (search) falls back to the deleted task’s type tab', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id, type: 'routine' }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1?from=search', wrapper });
    await screen.findByDisplayValue('Morning workout');

    await userEvent.press(screen.getByLabelText('Delete routine'));
    await screen.findByText('Delete this routine?');
    await userEvent.press(screen.getByLabelText('Delete routine'));

    expect(await screen.findByText('MARKER_ROUTINES')).toBeTruthy();
  });

  it('opened from S23 -> confirmed delete ALWAYS lands on Routines (S10), regardless of S23’s own origin', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id, isAsNeeded: true, cadence: null }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1/as-needed?from=search', wrapper });
    await screen.findByText('As-needed routine');

    await userEvent.press(screen.getByLabelText('Delete routine'));
    await screen.findByText('Delete this routine?');
    await userEvent.press(screen.getByLabelText('Delete routine'));

    expect(await screen.findByText('MARKER_ROUTINES')).toBeTruthy();
  });
});

describe('S22 Delete Confirmation — persist-failure state (REVIEW-M4.md item 7)', () => {
  it('a failed delete keeps the dialog open with BOTH buttons present and re-enabled, alongside the retry banner', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    fake.repos.tasks.softDelete = async () => err({ code: 'WRITE_FAILED', message: 'forced test failure' });

    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1', wrapper });
    await screen.findByDisplayValue('Morning workout');

    await userEvent.press(screen.getByLabelText('Delete routine'));
    await screen.findByText('Delete this routine?');
    await userEvent.press(screen.getByLabelText('Delete routine'));

    expect(await screen.findByText("Couldn't delete — try again.")).toBeTruthy();
    const deleteButton = await screen.findByLabelText('Delete routine');
    const keepButton = await screen.findByLabelText('Keep it');
    expect(deleteButton).toBeTruthy();
    expect(keepButton).toBeTruthy();
    expect(deleteButton.props.accessibilityState?.disabled).toBeFalsy();
    expect(keepButton.props.accessibilityState?.disabled).toBeFalsy();
  });
});
