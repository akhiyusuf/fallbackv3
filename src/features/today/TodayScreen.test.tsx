/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000000' }));

const mockUseTasks = jest.fn();
const mockUseToday = jest.fn();
const mockUseConsistency = jest.fn();
const mockUseProgress = jest.fn();
const mockLogStateMutateAsync = jest.fn();
const mockMarkOffDayMutateAsync = jest.fn();

jest.mock('@/queries', () => ({
  useTasks: () => mockUseTasks(),
  useToday: () => mockUseToday(),
  useConsistency: () => mockUseConsistency(),
  useProgress: () => mockUseProgress(),
  useLogState: () => ({ mutateAsync: mockLogStateMutateAsync }),
  useMarkOffDay: () => ({ mutateAsync: mockMarkOffDayMutateAsync }),
}));

import type { ReactElement } from 'react';
import TodayScreen from './TodayScreen';
import { Toast } from '@/ui';
import { useCelebrationStore } from '@/app-shell';
import { useToastStore } from '@/app-shell/stores/toast';
import type { ChipState } from '@/types';

// `Toast` is a separate host mounted once at the app root (`app/_layout.tsx`) — screens only
// call `useToastStore.getState().show(...)`. Rendering it alongside the screen here lets these
// toast-copy assertions exercise the real shared store instead of re-mocking it.
function withToastHost(node: ReactElement) {
  return (
    <>
      {node}
      <Toast />
    </>
  );
}

function task(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 't1',
    type: 'routine',
    name: 'Movement',
    note: null,
    icon: 'Repeat',
    color: 'forge-orange',
    isAsNeeded: false,
    cadence: { kind: 'daily' },
    eventDate: null,
    timeOfDay: null,
    startDate: null,
    endDate: null,
    dosesPerDay: 1,
    isTracked: true,
    importance: 'high',
    necessity: 'must-do',
    todoDoneAt: null,
    snoozable: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    idealSteps: [],
    fallbackSteps: [],
    ...overrides,
  };
}

function occurrence(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    taskId: 't1',
    date: '2026-07-16',
    outcome: 'pending',
    dueIdealStepIds: [],
    completedStepIds: [],
    chipState: 'todo',
    dosesRequired: 1,
    dosesCompleted: 0,
    ...overrides,
  };
}

const TODAY = '2026-07-16'; // matches @/lib/date's real `today()` only coincidentally not required — rows are date-filtered internally.

describe('S09 — Today', () => {
  // The occurrence the mocked read returns. Logging updates it, the way the query refetch would.
  const board: { chip: ChipState | null } = { chip: 'todo' };

  function todayRead() {
    const { today } = jest.requireActual('@/lib/date');
    mockUseToday.mockImplementation(() => ({ data: [occurrence({ date: today(), chipState: board.chip })], isLoading: false, isError: false }));
    mockUseTasks.mockReturnValue({ data: [task()], isLoading: false, isError: false });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    board.chip = 'todo';
    useToastStore.setState({ toast: null });
    useCelebrationStore.setState({ queue: [] });
    mockUseConsistency.mockReturnValue({ isLoading: false, data: { percent: 84, numerator: 26.3, denominator: 31 } });
    mockUseProgress.mockReturnValue({ isLoading: false, data: undefined });
  });

  it('loading: renders skeleton rows while chrome (toggle) renders immediately', async () => {
    mockUseTasks.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    mockUseToday.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    await render(<TodayScreen />);
    expect(screen.getByLabelText('Mark today off')).toBeTruthy();
    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(0);
  });

  it('blank slate: no tasks exist anywhere -> the first empty state, never a bare blank screen', async () => {
    mockUseTasks.mockReturnValue({ data: [], isLoading: false, isError: false });
    mockUseToday.mockReturnValue({ data: [], isLoading: false, isError: false });
    await render(<TodayScreen />);
    expect(screen.getByText('Nothing planned for today yet.')).toBeTruthy();
    expect(screen.getByText('A blank slate. Add one small thing — something beats nothing.')).toBeTruthy();
    expect(screen.getByLabelText('Add your first task')).toBeTruthy();
  });

  it('nothing due today: tasks exist elsewhere but none due -> the SECOND, distinct empty state', async () => {
    mockUseTasks.mockReturnValue({ data: [task()], isLoading: false, isError: false });
    mockUseToday.mockReturnValue({ data: [], isLoading: false, isError: false });
    await render(<TodayScreen />);
    // The headline and the subcopy are one line of text on the card.
    expect(screen.getByText('Nothing due right now. Enjoy the open day, or add something new.')).toBeTruthy();
    expect(screen.queryByText('Nothing planned for today yet.')).toBeNull();
  });

  it('error: read failure replaces only the task-list region with InlineRetryBanner', async () => {
    mockUseTasks.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    mockUseToday.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    await render(<TodayScreen />);
    expect(screen.getByText("Couldn't load today's tasks. Your data is safe on this device.")).toBeTruthy();
    // Stat chip and off-toggle still render independently.
    expect(screen.getByLabelText('Mark today off')).toBeTruthy();
  });

  it('stat chip: zero-data reads the no-data copy, never "0%"', async () => {
    // A tracked task exists (so the stat chip is shown) but nothing is due yet.
    mockUseTasks.mockReturnValue({ data: [task()], isLoading: false, isError: false });
    mockUseToday.mockReturnValue({ data: [], isLoading: false, isError: false });
    mockUseConsistency.mockReturnValue({ isLoading: false, data: { percent: null, numerator: 0, denominator: 0 } });
    await render(<TodayScreen />);
    expect(screen.getByText('No data yet')).toBeTruthy();
    expect(screen.queryByText(/0%/)).toBeNull();
  });

  it('populated: renders a due task row with its meta line and current chip state', async () => {
    todayRead();
    await render(<TodayScreen />);
    expect(screen.getByText('Movement')).toBeTruthy();
    expect(screen.getByText('Routine · Daily')).toBeTruthy();
    expect(screen.getByLabelText('Movement: Done')).toBeTruthy();
    expect(screen.getByLabelText('Movement: Fallback')).toBeTruthy();
    expect(screen.getByLabelText('Movement: Skip today')).toBeTruthy();
  });

  it('chip tap: logging Done persists via useLogState, updates the card and offers Undo', async () => {
    todayRead();
    const { today } = jest.requireActual('@/lib/date');
    mockLogStateMutateAsync.mockImplementation(async ({ chip }: { chip: ChipState }) => {
      board.chip = chip;
      return { ok: true, value: { outcome: 'ideal', xpAwarded: 10, celebrate: 'ideal', levelUp: null, badgesUnlocked: [] } };
    });
    const user = userEvent.setup();
    const view = await render(withToastHost(<TodayScreen />));
    await user.press(screen.getByLabelText('Movement: Done'));
    await waitFor(() => expect(mockLogStateMutateAsync).toHaveBeenCalledWith({ taskId: 't1', date: today(), chip: 'done' }));
    await view.rerender(withToastHost(<TodayScreen />));

    expect(screen.getByLabelText('Movement, Ideal done. Change')).toBeTruthy();
    expect(useToastStore.getState().toast).toMatchObject({ message: 'Ideal done', tone: 'success', detail: '+10 XP' });
    expect(useToastStore.getState().toast?.action?.label).toBe('Undo');
    expect(useCelebrationStore.getState().queue).toEqual([]);
  });

  it('chip tap: logging Fallback updates the card to "Fallback done" and offers Undo', async () => {
    todayRead();
    mockLogStateMutateAsync.mockImplementation(async ({ chip }: { chip: ChipState }) => {
      board.chip = chip;
      return { ok: true, value: { outcome: 'fallback', xpAwarded: 6, celebrate: 'none', levelUp: null, badgesUnlocked: [] } };
    });
    const user = userEvent.setup();
    const view = await render(withToastHost(<TodayScreen />));
    await user.press(screen.getByLabelText('Movement: Fallback'));
    await waitFor(() => expect(mockLogStateMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ chip: 'fallback' })));
    await view.rerender(withToastHost(<TodayScreen />));

    expect(screen.getByLabelText('Movement, Fallback done. Change')).toBeTruthy();
    expect(useToastStore.getState().toast).toMatchObject({ message: 'Fallback done', icon: 'fallback', detail: '+6 XP' });
    expect(useToastStore.getState().toast?.action?.label).toBe('Undo');
  });

  it('chip tap: a milestone badge unlock queues its pop-up with the badge key (so it can chain to S28)', async () => {
    todayRead();
    mockLogStateMutateAsync.mockImplementation(async ({ chip }: { chip: ChipState }) => {
      board.chip = chip;
      return { ok: true, value: { outcome: 'ideal', xpAwarded: 10, celebrate: 'ideal', levelUp: null, badgesUnlocked: ['tenure-30'] } };
    });
    const user = userEvent.setup();
    await render(withToastHost(<TodayScreen />));
    await user.press(screen.getByLabelText('Movement: Done'));
    await waitFor(() => expect(useCelebrationStore.getState().queue).toEqual([{ kind: 'badge', badgeKey: 'tenure-30' }]));
  });

  it('chip tap: a Skip commits with no celebration and offers Undo', async () => {
    todayRead();
    mockLogStateMutateAsync.mockImplementation(async ({ chip }: { chip: ChipState }) => {
      board.chip = chip;
      return { ok: true, value: { outcome: 'missed', xpAwarded: 0, celebrate: 'none', levelUp: null, badgesUnlocked: [] } };
    });
    const user = userEvent.setup();
    const view = await render(withToastHost(<TodayScreen />));
    await user.press(screen.getByLabelText('Movement: Skip today'));
    await waitFor(() => expect(mockLogStateMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ chip: 'skip' })));
    await view.rerender(withToastHost(<TodayScreen />));

    expect(screen.getByLabelText('Movement, Skipped. Change')).toBeTruthy();
    expect(useToastStore.getState().toast).toMatchObject({ message: 'Skipped for today', icon: 'skip' });
    expect(useToastStore.getState().toast?.action?.label).toBe('Undo');
    expect(useCelebrationStore.getState().queue).toEqual([]);
  });

  it('chip tap: Undo on the toast restores the previous (unlogged) state', async () => {
    todayRead();
    mockLogStateMutateAsync.mockImplementation(async ({ chip }: { chip: ChipState }) => {
      board.chip = chip;
      return { ok: true, value: { outcome: 'ideal', xpAwarded: 10, celebrate: 'ideal', levelUp: null, badgesUnlocked: [] } };
    });
    const user = userEvent.setup();
    const view = await render(withToastHost(<TodayScreen />));
    await user.press(screen.getByLabelText('Movement: Done'));
    await waitFor(() => expect(mockLogStateMutateAsync).toHaveBeenCalledTimes(1));
    await view.rerender(withToastHost(<TodayScreen />));

    await user.press(await screen.findByLabelText('Undo'));
    await waitFor(() => expect(mockLogStateMutateAsync).toHaveBeenLastCalledWith(expect.objectContaining({ chip: 'todo' })));
    await view.rerender(withToastHost(<TodayScreen />));
    expect(screen.getByLabelText('Movement: Done')).toBeTruthy();
    expect(useToastStore.getState().toast?.message).toBe('Undone');
  });

  it('chip tap: a failed persist reverts (no optimistic change survives) and shows the retry toast', async () => {
    todayRead();
    mockLogStateMutateAsync.mockResolvedValue({ ok: false, error: { code: 'WRITE_FAILED', message: 'nope' } });
    const user = userEvent.setup();
    await render(withToastHost(<TodayScreen />));
    await user.press(screen.getByLabelText('Movement: Done'));
    await waitFor(() => expect(screen.getByText("Couldn't save that — try again.")).toBeTruthy());
    expect(screen.getByLabelText('Movement: Done')).toBeTruthy();
    expect(screen.queryByText('Ideal done')).toBeNull();
  });

  it('whole-day off: toggling on disables every row\'s chip and shows the off-day toast', async () => {
    const { today } = jest.requireActual('@/lib/date');
    mockUseTasks.mockReturnValue({ data: [task()], isLoading: false, isError: false });
    mockUseToday.mockReturnValue({ data: [occurrence({ date: today(), chipState: 'todo' })], isLoading: false, isError: false });
    mockMarkOffDayMutateAsync.mockResolvedValue({ ok: true, value: undefined });
    const user = userEvent.setup();
    await render(withToastHost(<TodayScreen />));
    await user.press(screen.getByLabelText('Mark today off'));
    await waitFor(() => expect(mockMarkOffDayMutateAsync).toHaveBeenCalledWith({ date: today(), taskId: null, mark: true }));
    await waitFor(() => expect(screen.getByText('Today marked off — nothing due counts against your %.')).toBeTruthy());
  });

  it('whole-day off, currently off: every row reads "Off today" and its chip is disabled', async () => {
    const { today } = jest.requireActual('@/lib/date');
    mockUseTasks.mockReturnValue({ data: [task()], isLoading: false, isError: false });
    mockUseToday.mockReturnValue({ data: [occurrence({ date: today(), outcome: 'off', chipState: null })], isLoading: false, isError: false });
    await render(<TodayScreen />);
    expect(screen.getByText('Off today')).toBeTruthy();
    expect(screen.getByLabelText('Mark today off').props.accessibilityState.checked).toBe(true);
  });

  it('re-entry state: renders the F14 landing banner with the reworded stat line and the highlighted CTA', async () => {
    const { today } = jest.requireActual('@/lib/date');
    mockUseTasks.mockReturnValue({ data: [task()], isLoading: false, isError: false });
    mockUseToday.mockReturnValue({ data: [occurrence({ date: today(), chipState: 'todo' })], isLoading: false, isError: false });
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    await render(<TodayScreen reentryOverride reentryTaskIdOverride="t1" />);
    expect(screen.getByText("No workout yesterday — that's okay.")).toBeTruthy();
    expect(screen.getByText('Your consistency is intact — 84% · 26 of the last 30 days you showed up — ideal or fallback.')).toBeTruthy();
    const user = userEvent.setup();
    await user.press(screen.getByLabelText('Even the fallback counts'));
    expect(push).toHaveBeenCalledWith('/task/t1?from=today');
    push.mockRestore();
  });

  it('just-added banner: renders the verbatim first-habit-set copy', async () => {
    mockUseTasks.mockReturnValue({ data: [task()], isLoading: false, isError: false });
    mockUseToday.mockReturnValue({ data: [], isLoading: false, isError: false });
    await render(<TodayScreen justAddedOverride />);
    expect(screen.getByText('Your first habit is set.')).toBeTruthy();
    expect(screen.getByText('Do the ideal or the fallback today — either one counts.')).toBeTruthy();
  });

  it('tapping anywhere on the card row (not the chip) navigates to S20 with origin=today', async () => {
    todayRead();
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<TodayScreen />);
    await user.press(screen.getByLabelText('Movement, Routine, Daily. Opens the task'));
    expect(push).toHaveBeenCalledWith('/task/t1?from=today');
    push.mockRestore();
  });

  it('search icon navigates to S14 tagged with origin=today', async () => {
    mockUseTasks.mockReturnValue({ data: [], isLoading: false, isError: false });
    mockUseToday.mockReturnValue({ data: [], isLoading: false, isError: false });
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<TodayScreen />);
    await user.press(screen.getByLabelText('Search'));
    expect(push).toHaveBeenCalledWith('/search?from=today');
    push.mockRestore();
  });
});
