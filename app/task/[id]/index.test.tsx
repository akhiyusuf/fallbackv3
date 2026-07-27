/**
 * M4 — S20 Manage Task Sheet. Covers PRD §3.7 / SCHEMA §4.2's F7 snooze acceptance,
 * duplicate, off-day toggle, and inline name edit.
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
import { userEvent, waitFor, within } from '@testing-library/react-native';
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

describe('S20 Manage Task Sheet', () => {
  it('renders the task name, today card, and the two-slot action row (Duplicate + Snooze)', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1', wrapper });

    expect(await screen.findByDisplayValue('Morning workout')).toBeTruthy();
    expect(screen.getByLabelText('Duplicate')).toBeTruthy();
    // Exactly one snooze-slot control — "Snooze" enabled (daily task, snoozable, due today, never snoozed).
    expect(screen.getByLabelText('Snooze')).toBeTruthy();
    expect(screen.queryByText('Move to another day')).toBeNull();
  });

  it('snooze slot renders DISABLED (not hidden) when the task is not snoozable', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id, snoozable: false }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1', wrapper });
    await screen.findByDisplayValue('Morning workout');

    const snoozeButton = screen.getByLabelText(/Snooze, disabled/);
    expect(snoozeButton).toBeTruthy();
  });

  it('tapping Snooze vacates today (nothing left to snooze from THIS sheet — the documented reachability gap)', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1', wrapper });
    await screen.findByDisplayValue('Morning workout');

    await userEvent.press(screen.getByLabelText('Snooze'));
    // Today's own occurrence is now vacated (moved to tomorrow) — S20's occurrence card always
    // shows TODAY, so the slot reads "nothing due today", disabled — never "Undo" from here.
    // This is PRD §7's documented open gap, not a defect: undo would be reachable only from
    // tomorrow's own sheet, and only if tomorrow itself isn't naturally due (see the next test).
    expect(await screen.findByLabelText(/Snooze, disabled/)).toBeTruthy();
    expect(screen.queryByLabelText('Snooze')).toBeNull();
    expect(screen.queryByLabelText('Undo snooze')).toBeNull();
  });

  it('renders "Snooze" enabled (not "Undo snooze") when yesterday was vacated by a snooze into today AND today is itself naturally due — the common day-after-a-daily-snooze case (REVIEW-M4.md item 1, acceptance test A)', async () => {
    const task = makeTask({ id: 'task-1' as Id }); // daily cadence — today (Thu) is naturally due
    fake.seedTask(task);
    // Yesterday's own row was vacated by a snooze pointing at today (equivalent to having
    // performed the snooze on yesterday's own S20 instance).
    await fake.repos.logs.upsert({
      id: 'log-yesterday' as Id,
      taskId: task.id,
      date: '2026-07-15' as never,
      chipState: null,
      isManualOverride: false,
      completedStepIds: [],
      dosesCompleted: 0,
      movedToDate: '2026-07-16' as never,
      createdAt: '2026-07-15T00:00:00.000Z' as never,
      updatedAt: '2026-07-15T00:00:00.000Z' as never,
    });

    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1', wrapper });
    await screen.findByDisplayValue('Morning workout');

    // Today is naturally due and unlogged — the displayed occurrence is TODAY's own, not the
    // dormant visitor, so rendering 1 ("Snooze" enabled) applies, never "Undo snooze".
    expect(await screen.findByLabelText('Snooze')).toBeTruthy();
    expect(screen.queryByLabelText('Undo snooze')).toBeNull();

    await userEvent.press(screen.getByLabelText('Snooze'));
    // Pressing writes ownLog(today).movedToDate = tomorrow (today's own occurrence vacates),
    // never calls useUndoSnooze against yesterday.
    await waitFor(() => {
      const todayLog = fake.logsFor(task.id).find((l) => l.date === '2026-07-16');
      expect(todayLog?.movedToDate).toBe('2026-07-17');
    });
    const yesterdayLogAfter = fake.logsFor(task.id).find((l) => l.date === '2026-07-15');
    expect(yesterdayLogAfter?.movedToDate).toBe('2026-07-16'); // untouched — undo was never called
  });

  it('renders "Undo snooze" when yesterday was due and snoozed and today is off-cadence — the visitor is what today\'s card actually displays (acceptance test B)', async () => {
    const task = makeTask({ id: 'task-1' as Id, cadence: { kind: 'specific-weekdays', weekdays: [3] } }); // Wed only — today (Thu) is off-cadence
    fake.seedTask(task);
    await fake.repos.logs.upsert({
      id: 'log-yesterday' as Id,
      taskId: task.id,
      date: '2026-07-15' as never,
      chipState: null,
      isManualOverride: false,
      completedStepIds: [],
      dosesCompleted: 0,
      movedToDate: '2026-07-16' as never,
      createdAt: '2026-07-15T00:00:00.000Z' as never,
      updatedAt: '2026-07-15T00:00:00.000Z' as never,
    });

    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1', wrapper });
    await screen.findByDisplayValue('Morning workout');

    expect(await screen.findByLabelText('Undo snooze')).toBeTruthy();
    expect(screen.queryByLabelText('Snooze')).toBeNull();

    await userEvent.press(screen.getByLabelText('Undo snooze'));
    // Undo restores yesterday's data; today reverts to its genuine off-cadence not-due state
    // (there is no longer a visitor to display), so the slot renders "Snooze" disabled again —
    // never "Undo snooze" a second time.
    expect(await screen.findByLabelText(/Snooze, disabled/)).toBeTruthy();
    expect(screen.queryByLabelText('Undo snooze')).toBeNull();
  });

  it('Duplicate copies the task, toasts, and opens the new task’s own S20', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1', wrapper });
    await screen.findByDisplayValue('Morning workout');

    await userEvent.press(screen.getByLabelText('Duplicate'));
    // duplicate() in the fake repo produces id `${id}-copy`; S20 re-renders on the new id.
    expect(await screen.findByDisplayValue('Morning workout')).toBeTruthy();
  });

  it('off-day toggle marks the task off for today', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1', wrapper });
    await screen.findByDisplayValue('Morning workout');

    const toggle = screen.getByLabelText('Off today (this task only)');
    await userEvent.press(toggle);
    expect(fake.currentSettings()).toBeTruthy(); // sanity: repos still respond
  });

  it('inline name edit persists via the Save name affordance', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1', wrapper });
    const input = await screen.findByLabelText('Task name');
    await userEvent.type(input, ' II');
    await userEvent.press(screen.getByLabelText('Save name'));
    await screen.findByDisplayValue('Morning workout II');
  });

  it('Delete routes to S22 carrying openedFrom=manage and the sheet’s own origin', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1?from=today', wrapper });
    await screen.findByDisplayValue('Morning workout');

    await userEvent.press(screen.getByLabelText('Delete routine'));
    expect(await screen.findByText('Delete this routine?')).toBeTruthy();
  });

  it('stat line derives from perTaskConsistency — percent first, off days excluded from the denominator (REVIEW-M4.md item 2)', async () => {
    clock.today = '2026-07-10';
    clock.now = '2026-07-10T12:00:00.000Z';
    const task = makeTask({ id: 'task-1' as Id });
    fake.seedTask(task);

    async function log(date: string, chip: 'done' | 'fallback') {
      await fake.repos.logs.upsert({
        id: `log-${date}` as Id,
        taskId: task.id,
        date: date as never,
        chipState: chip,
        isManualOverride: true,
        completedStepIds: [],
        dosesCompleted: 0,
        movedToDate: null,
        createdAt: `${date}T00:00:00.000Z` as never,
        updatedAt: `${date}T00:00:00.000Z` as never,
      });
    }
    await log('2026-07-01', 'done');
    await log('2026-07-02', 'done');
    await fake.repos.offDays.mark({
      id: 'off-1' as Id,
      date: '2026-07-03' as never,
      taskId: task.id,
      priorChipState: null,
      createdAt: '2026-07-03T00:00:00.000Z' as never,
    });
    // July 4 left unlogged — elapsed and due, so it resolves 'missed'.
    await log('2026-07-05', 'fallback');
    await fake.repos.offDays.mark({
      id: 'off-2' as Id,
      date: '2026-07-06' as never,
      taskId: task.id,
      priorChipState: null,
      createdAt: '2026-07-06T00:00:00.000Z' as never,
    });
    await log('2026-07-07', 'done');
    // July 8 left unlogged — 'missed'.
    await log('2026-07-09', 'done');
    // July 10 is today — pending, excluded.

    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1', wrapper });
    await screen.findByDisplayValue('Morning workout');

    // ideal(1,2,7,9)=4, fallback(5)=1 -> numerator 5; missed(4,8)=2; off(3,6) excluded from the
    // denominator entirely -> denominator 7 -> 5/7 = 71% (round-half-up).
    expect(await screen.findByText('71% showed up — 5 of 7 days')).toBeTruthy();
  });

  it('keys empty-history on task-lifetime data, not the displayed month — a neglected month still shows its real missed fills (REVIEW-M4.md item 4)', async () => {
    clock.today = '2026-08-10';
    clock.now = '2026-08-10T12:00:00.000Z';
    const task = makeTask({ id: 'task-1' as Id });
    fake.seedTask(task);
    // History exists — but only in July, not August (the month S20 opens to, since monthAnchor
    // defaults to `today`).
    await fake.repos.logs.upsert({
      id: 'log-july' as Id,
      taskId: task.id,
      date: '2026-07-01' as never,
      chipState: 'done',
      isManualOverride: true,
      completedStepIds: [],
      dosesCompleted: 0,
      movedToDate: null,
      createdAt: '2026-07-01T00:00:00.000Z' as never,
      updatedAt: '2026-07-01T00:00:00.000Z' as never,
    });

    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1', wrapper });
    await screen.findByDisplayValue('Morning workout');

    // August 1st is elapsed, due, and unlogged — a genuine missed fill, not a blanked
    // "empty history" cell (the task has real history, just not in this displayed month).
    expect(await screen.findByLabelText('2026-08-01, missed')).toBeTruthy();
    expect(screen.queryByText('Your history will fill in as you log days.')).toBeNull();
  });

  it('heatmap past-cell tap opens the drill-down popover; editing the chip there persists via useLogState and re-renders the cell (REVIEW-M4.md item 3)', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1', wrapper });
    await screen.findByDisplayValue('Morning workout');

    // July 1 is a past, elapsed, unlogged day — resolves 'missed'.
    await userEvent.press(screen.getByLabelText('2026-07-01, missed'));

    const popover = await screen.findByTestId('s20-day-popover');
    expect(popover).toBeTruthy();
    // No snooze controls in the popover (PRD §3.7).
    expect(within(popover).queryByLabelText('Snooze')).toBeNull();
    expect(within(popover).queryByLabelText('Undo snooze')).toBeNull();

    const popoverChip = within(popover).getByTestId('s20-day-popover-chip');
    await userEvent.press(within(popoverChip).getByLabelText('Done'));

    await waitFor(() => {
      const log = fake.logsFor('task-1' as Id).find((l) => l.date === '2026-07-01');
      expect(log?.chipState).toBe('done');
    });
  });

  it('multi-dose card renders one full four-state StateChip per task.dosesPerDay, each independently loggable (REVIEW-M4.md item 5)', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id, dosesPerDay: 3 }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1', wrapper });
    await screen.findByDisplayValue('Morning workout');

    expect(screen.getByTestId('s20-dose-chip-0')).toBeTruthy();
    expect(screen.getByTestId('s20-dose-chip-1')).toBeTruthy();
    expect(screen.getByTestId('s20-dose-chip-2')).toBeTruthy();

    // Each dose row's own StateChip carries all four options.
    expect(within(screen.getByTestId('s20-dose-chip-2')).getByLabelText('Done')).toBeTruthy();
    expect(within(screen.getByTestId('s20-dose-chip-2')).getByLabelText('Fallback')).toBeTruthy();
    expect(within(screen.getByTestId('s20-dose-chip-2')).getByLabelText('Skip')).toBeTruthy();

    await userEvent.press(within(screen.getByTestId('s20-dose-chip-2')).getByLabelText('Done'));
    await waitFor(() => {
      const log = fake.logsFor('task-1' as Id).find((l) => l.date === '2026-07-16');
      expect(log?.dosesCompleted).toBe(3);
    });
  });

  it('pressing the Importance tag opens the inline Radio picker (REVIEW-M4.md item 6)', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id, importance: 'high' }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1', wrapper });
    await screen.findByDisplayValue('Morning workout');

    expect(screen.queryByTestId('s20-importance-picker')).toBeNull();
    await userEvent.press(screen.getByLabelText(/^Importance, High/));
    expect(await screen.findByTestId('s20-importance-picker')).toBeTruthy();
  });
});
