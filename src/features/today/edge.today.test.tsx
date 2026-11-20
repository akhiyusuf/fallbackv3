/**
 * Edge cases for the Today tab: none, one and 150 habits, order, due vs not due, double taps,
 * midnight passing with the screen open, long names and emoji, accessibility labels, and no em
 * dashes in anything shown. Reads are mocked (as in TodayScreen.test.tsx); the log write is a spy.
 */
import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';

jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000000' }));

const mockClock = { today: '2026-07-16' };
jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  return { ...actual, today: () => mockClock.today };
});

const mockUseTasks = jest.fn();
const mockUseToday = jest.fn();
const mockUseConsistency = jest.fn();
const mockUseProgress = jest.fn();
const mockLogStateMutateAsync = jest.fn();
const mockMarkOffDayMutateAsync = jest.fn();
const mockSnoozeMutateAsync = jest.fn();
const mockUndoSnoozeMutateAsync = jest.fn();

jest.mock('@/queries', () => ({
  useTasks: () => mockUseTasks(),
  useToday: (d: string) => mockUseToday(d),
  useConsistency: () => mockUseConsistency(),
  useProgress: () => mockUseProgress(),
  useLogState: () => ({ mutateAsync: mockLogStateMutateAsync }),
  useMarkOffDay: () => ({ mutateAsync: mockMarkOffDayMutateAsync }),
  useSnoozeOccurrence: () => ({ mutateAsync: mockSnoozeMutateAsync }),
  useUndoSnooze: () => ({ mutateAsync: mockUndoSnoozeMutateAsync }),
}));

import type { ReactElement } from 'react';
import TodayScreen from './TodayScreen';
import { S09_COPY } from './copy';
import { Toast } from '@/ui';
import { useCelebrationStore } from '@/app-shell';
import { useToastStore } from '@/app-shell/stores/toast';

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
    id: 't1', type: 'routine', name: 'Movement', note: null, icon: 'Repeat', color: 'forge-orange', isAsNeeded: false,
    cadence: { kind: 'daily' }, eventDate: null, timeOfDay: null, startDate: null, endDate: null, dosesPerDay: 1, isTracked: true,
    importance: 'high', necessity: 'must-do', todoDoneAt: null, snoozable: true, createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null, idealSteps: [], fallbackSteps: [], ...overrides,
  };
}

function occ(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    taskId: 't1', date: mockClock.today, outcome: 'pending', dueIdealStepIds: [], completedStepIds: [], chipState: 'todo',
    dosesRequired: 1, dosesCompleted: 0, ...overrides,
  };
}

function read(tasks: unknown[], occs: unknown[]) {
  mockUseTasks.mockReturnValue({ data: tasks, isLoading: false, isError: false });
  mockUseToday.mockReturnValue({ data: occs, isLoading: false, isError: false });
}

/** Every text node on screen, joined, so a dash anywhere shows up. */
function allVisibleText(): string {
  return JSON.stringify(screen.toJSON());
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const m of [mockUseTasks, mockUseToday, mockUseConsistency, mockUseProgress, mockLogStateMutateAsync, mockMarkOffDayMutateAsync, mockSnoozeMutateAsync, mockUndoSnoozeMutateAsync]) m.mockReset();
  mockClock.today = '2026-07-16';
  useToastStore.setState({ toast: null });
  useCelebrationStore.setState({ queue: [] });
  mockUseConsistency.mockReturnValue({ isLoading: false, data: { percent: 84, numerator: 26.3, denominator: 31 } });
  mockUseProgress.mockReturnValue({ isLoading: false, data: undefined });
  mockLogStateMutateAsync.mockResolvedValue({ ok: true, value: { xpAwarded: 0, levelUp: null, badgesUnlocked: [] } });
  mockMarkOffDayMutateAsync.mockResolvedValue({ ok: true });
  mockSnoozeMutateAsync.mockResolvedValue({ ok: true });
});

describe('Today: how many habits', () => {
  it('no habits at all: the blank slate, no list, no crash', async () => {
    read([], []);
    await render(<TodayScreen />);
    expect(screen.getByText(S09_COPY.blankSlateHeadline)).toBeTruthy();
    expect(screen.queryByText('Due today')).toBeNull();
  });

  it('habits exist but none are due: "Nothing due" line and 0 of 0 is not shown', async () => {
    read([task()], [occ({ outcome: 'not-due', chipState: null })]);
    await render(<TodayScreen />);
    expect(screen.getByText(`${S09_COPY.nothingDueHeadline} ${S09_COPY.nothingDueSubcopy}`)).toBeTruthy();
    expect(screen.queryByText(/of 0 done/)).toBeNull();
  });

  it('one habit: one card, "0 of 1 done"', async () => {
    read([task()], [occ()]);
    await render(<TodayScreen />);
    expect(screen.getByText('0 of 1 done')).toBeTruthy();
    expect(screen.getByLabelText('Movement: Done')).toBeTruthy();
  });

  it('150 habits render without a crash, with the right count and the untimed ones first, by name', async () => {
    const tasks = Array.from({ length: 150 }, (_, i) =>
      task({ id: `t${i}`, name: `Habit ${String(i).padStart(3, '0')}`, timeOfDay: i % 3 === 0 ? `${String(6 + (i % 10)).padStart(2, '0')}:00` : null }),
    );
    const occs = tasks.map((t, i) => occ({ taskId: (t as { id: string }).id, chipState: i < 20 ? 'done' : 'todo' }));
    read(tasks, occs);
    await render(<TodayScreen />);
    expect(screen.getByText('20 of 150 done')).toBeTruthy();
    expect(screen.getAllByLabelText(/: Done$/).length).toBe(130); // the 20 logged ones show a chip instead of buttons
    // Order: every untimed card before any timed one.
    const names = screen.getAllByLabelText(/Opens the task$/).map((n) => String(n.props.accessibilityLabel));
    const firstTimed = names.findIndex((n) => /AM|PM/.test(n));
    const lastUntimed = names.map((n) => !/AM|PM/.test(n)).lastIndexOf(true);
    expect(firstTimed).toBeGreaterThan(lastUntimed);
  });

  it('timed habits sort by time of day, then the untimed ones keep name order', async () => {
    read(
      [task({ id: 'a', name: 'Zed', timeOfDay: '08:00' }), task({ id: 'b', name: 'Beta', timeOfDay: '07:00' }), task({ id: 'c', name: 'Alpha' }), task({ id: 'd', name: 'Able' })],
      [occ({ taskId: 'a' }), occ({ taskId: 'b' }), occ({ taskId: 'c' }), occ({ taskId: 'd' })],
    );
    await render(<TodayScreen />);
    const names = screen.getAllByLabelText(/Opens the task$/).map((n) => String(n.props.accessibilityLabel).split(',')[0]);
    expect(names).toEqual(['Able', 'Alpha', 'Beta', 'Zed']);
  });

  it('an occurrence whose task is gone from the live list (deleted, ended elsewhere) is dropped, not a crash', async () => {
    read([task()], [occ(), occ({ taskId: 'ghost' })]);
    await render(<TodayScreen />);
    expect(screen.getByText('0 of 1 done')).toBeTruthy();
  });

  it("another day's occurrences in the same read are ignored", async () => {
    read([task()], [occ({ date: '2026-07-15', chipState: 'done' }), occ()]);
    await render(<TodayScreen />);
    expect(screen.getByText('0 of 1 done')).toBeTruthy();
  });
});

describe('Today: due, off, pushed', () => {
  it('a habit taken off by the whole-day switch shows "Off today" and no log buttons', async () => {
    read([task()], [occ({ outcome: 'off', chipState: null })]);
    await render(<TodayScreen />);
    expect(screen.getByText(S09_COPY.offTodayMeta)).toBeTruthy();
    expect(screen.queryByLabelText('Movement: Done')).toBeNull();
    expect(screen.getByLabelText('Emergency day off, the whole day').props.accessibilityState.checked).toBe(true);
  });

  it('the whole-day switch is off when only some habits are off', async () => {
    read([task(), task({ id: 't2', name: 'Read' })], [occ({ outcome: 'off', chipState: null }), occ({ taskId: 't2' })]);
    await render(<TodayScreen />);
    expect(screen.getByLabelText('Emergency day off, the whole day').props.accessibilityState.checked).toBe(false);
  });

  it('a pushed occurrence beside its own: two cards, and logging each sends its own pushedFrom', async () => {
    read([task()], [occ(), occ({ pushedFrom: '2026-07-15' })]);
    const user = userEvent.setup();
    await render(<TodayScreen />);
    expect(screen.getByText('0 of 2 done')).toBeTruthy();
    const dones = screen.getAllByLabelText('Movement: Done');
    expect(dones).toHaveLength(2);
    await user.press(dones[0]);
    await waitFor(() => expect(mockLogStateMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockLogStateMutateAsync.mock.calls[0][0].pushedFrom).toBeUndefined();
    await user.press(dones[1]);
    await waitFor(() => expect(mockLogStateMutateAsync).toHaveBeenCalledTimes(2));
    expect(mockLogStateMutateAsync.mock.calls[1][0].pushedFrom).toBe('2026-07-15');
  });

  it('logging one of two same-habit cards does not block the other (the busy guard is per card)', async () => {
    read([task()], [occ(), occ({ pushedFrom: '2026-07-15' })]);
    let release!: (v: unknown) => void;
    mockLogStateMutateAsync.mockImplementationOnce(() => new Promise((r) => (release = r)));
    const user = userEvent.setup();
    await render(<TodayScreen />);
    const dones = screen.getAllByLabelText('Movement: Done');
    await user.press(dones[0]);
    await user.press(dones[1]);
    expect(mockLogStateMutateAsync).toHaveBeenCalledTimes(2);
    await act(async () => release({ ok: true, value: { xpAwarded: 0, levelUp: null, badgesUnlocked: [] } }));
  });
});

describe('Today: double taps', () => {
  it('two quick taps on Done log once and show one toast', async () => {
    read([task()], [occ()]);
    let release!: (v: unknown) => void;
    mockLogStateMutateAsync.mockImplementationOnce(() => new Promise((r) => (release = r)));
    const user = userEvent.setup();
    await render(withToastHost(<TodayScreen />));
    const done = screen.getByLabelText('Movement: Done');
    await user.press(done);
    await user.press(done);
    await act(async () => release({ ok: true, value: { xpAwarded: 10, levelUp: null, badgesUnlocked: [] } }));
    expect(mockLogStateMutateAsync).toHaveBeenCalledTimes(1);
  });

  it('Done then Fallback while the first is saving: the second is ignored, never a race', async () => {
    read([task()], [occ()]);
    let release!: (v: unknown) => void;
    mockLogStateMutateAsync.mockImplementationOnce(() => new Promise((r) => (release = r)));
    const user = userEvent.setup();
    await render(<TodayScreen />);
    await user.press(screen.getByLabelText('Movement: Done'));
    await user.press(screen.getByLabelText('Movement: Fallback'));
    await act(async () => release({ ok: true, value: { xpAwarded: 0, levelUp: null, badgesUnlocked: [] } }));
    expect(mockLogStateMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockLogStateMutateAsync.mock.calls[0][0].chip).toBe('done');
  });

  it('after the first save returns, a later tap goes through', async () => {
    read([task()], [occ()]);
    const user = userEvent.setup();
    await render(<TodayScreen />);
    await user.press(screen.getByLabelText('Movement: Done'));
    await waitFor(() => expect(mockLogStateMutateAsync).toHaveBeenCalledTimes(1));
    await user.press(screen.getByLabelText('Movement: Fallback'));
    await waitFor(() => expect(mockLogStateMutateAsync).toHaveBeenCalledTimes(2));
  });

  it('two quick taps on Push to tomorrow push once (no "Already pushed once" over the Undo toast)', async () => {
    read([task()], [occ()]);
    let release!: (v: unknown) => void;
    mockSnoozeMutateAsync.mockImplementationOnce(() => new Promise((r) => (release = r)));
    const user = userEvent.setup();
    await render(withToastHost(<TodayScreen />));
    const push = screen.getByLabelText('Movement: Push to tomorrow');
    await user.press(push);
    await user.press(push);
    await act(async () => release({ ok: true }));
    expect(mockSnoozeMutateAsync).toHaveBeenCalledTimes(1);
  });

  it('two quick taps on a card\'s Emergency day off mark it once', async () => {
    read([task()], [occ()]);
    let release!: (v: unknown) => void;
    mockMarkOffDayMutateAsync.mockImplementationOnce(() => new Promise((r) => (release = r)));
    const user = userEvent.setup();
    await render(<TodayScreen />);
    const off = screen.getByLabelText("Movement: Emergency day off. Today won't count for or against you.");
    await user.press(off);
    await user.press(off);
    await act(async () => release({ ok: true }));
    expect(mockMarkOffDayMutateAsync).toHaveBeenCalledTimes(1);
  });

  it('a log write that rejects shows the save-failed toast, with no unhandled rejection, and the card can be tapped again', async () => {
    read([task()], [occ()]);
    mockLogStateMutateAsync.mockRejectedValueOnce(new Error('db gone'));
    const user = userEvent.setup();
    await render(withToastHost(<TodayScreen />));
    await user.press(screen.getByLabelText('Movement: Done'));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe("Couldn't save that. Try again."));
    await user.press(screen.getByLabelText('Movement: Done'));
    await waitFor(() => expect(mockLogStateMutateAsync).toHaveBeenCalledTimes(2));
  });

  it('a log write that comes back not-ok shows the save-failed toast', async () => {
    read([task()], [occ()]);
    mockLogStateMutateAsync.mockResolvedValueOnce({ ok: false, error: { code: 'NOT_FOUND', message: 'gone' } });
    const user = userEvent.setup();
    await render(withToastHost(<TodayScreen />));
    await user.press(screen.getByLabelText('Movement: Done'));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe("Couldn't save that. Try again."));
  });
});

describe('Today: midnight with the screen open', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('the header date and the list read move on when the day changes, even when nothing else re-renders', async () => {
    read([task()], [occ({ chipState: 'done' })]);
    await render(<TodayScreen />);
    expect(screen.getByText('Thu, Jul 16')).toBeTruthy();
    expect(mockUseToday).toHaveBeenLastCalledWith('2026-07-16');
    mockClock.today = '2026-07-17';
    mockUseToday.mockReturnValue({ data: [occ({ date: '2026-07-17', chipState: 'todo' })], isLoading: false, isError: false });
    await act(async () => {
      jest.advanceTimersByTime(31_000);
    });
    expect(screen.getByText('Fri, Jul 17')).toBeTruthy();
    expect(mockUseToday).toHaveBeenLastCalledWith('2026-07-17');
    expect(screen.getByLabelText('Movement: Done')).toBeTruthy();
  });

  it("yesterday's log is not shown as today's after midnight", async () => {
    read([task()], [occ({ chipState: 'done' })]);
    await render(<TodayScreen />);
    expect(screen.getByText('1 of 1 done')).toBeTruthy();
    mockClock.today = '2026-07-17';
    mockUseToday.mockReturnValue({ data: [occ({ date: '2026-07-16', chipState: 'done' }), occ({ date: '2026-07-17', chipState: 'todo' })], isLoading: false, isError: false });
    await act(async () => {
      jest.advanceTimersByTime(31_000);
    });
    expect(screen.getByText('0 of 1 done')).toBeTruthy();
  });

  it('a log made after midnight goes to the new day', async () => {
    read([task()], [occ()]);
    await render(<TodayScreen />);
    mockClock.today = '2026-07-17';
    mockUseToday.mockReturnValue({ data: [occ({ date: '2026-07-17' })], isLoading: false, isError: false });
    await act(async () => {
      jest.advanceTimersByTime(31_000);
    });
    const { fireEvent } = require('@testing-library/react-native');
    await fireEvent.press(screen.getByLabelText('Movement: Done'));
    await waitFor(() => expect(mockLogStateMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockLogStateMutateAsync.mock.calls[0][0].date).toBe('2026-07-17');
  });

  it('the day check stops when the screen goes away (no read for a new day after unmount)', async () => {
    read([task()], [occ()]);
    const view = await render(<TodayScreen />);
    await view.unmount();
    const calls = mockUseToday.mock.calls.length;
    mockClock.today = '2026-07-17';
    await act(async () => {
      jest.advanceTimersByTime(120_000);
    });
    expect(mockUseToday.mock.calls.length).toBe(calls);
  });
});

describe('Today: long names and emoji', () => {
  it('a 300-character name and an emoji name render on one line each (numberOfLines) and keep their labels', async () => {
    const long = 'Q'.repeat(300);
    read([task({ id: 'a', name: long }), task({ id: 'b', name: '🏃‍♀️ Run 5k 🌅' })], [occ({ taskId: 'a' }), occ({ taskId: 'b' })]);
    await render(<TodayScreen />);
    expect(screen.getByLabelText(`${long}: Done`)).toBeTruthy();
    expect(screen.getByLabelText('🏃‍♀️ Run 5k 🌅: Done')).toBeTruthy();
    expect(screen.getByText(long).props.numberOfLines).toBe(1);
  });

  it('a name with only spaces or a single character does not crash', async () => {
    read([task({ id: 'a', name: 'x' })], [occ({ taskId: 'a' })]);
    await render(<TodayScreen />);
    expect(screen.getByLabelText('x: Done')).toBeTruthy();
  });
});

describe('Today: accessibility and wording', () => {
  it('every button on an open card and every icon button has an accessibility label', async () => {
    read([task(), task({ id: 't2', name: 'Read', timeOfDay: '07:00' })], [occ(), occ({ taskId: 't2', chipState: 'done' })]);
    await render(<TodayScreen />);
    const unlabeled = screen.getAllByRole('button').filter((n) => !n.props.accessibilityLabel).map((n) => String(n.type));
    expect(unlabeled).toEqual([]);
  });

  it('every log control names its habit: Done, Fallback, Push, Emergency, and the logged chip', async () => {
    read([task(), task({ id: 't2', name: 'Read' })], [occ(), occ({ taskId: 't2', chipState: 'fallback' })]);
    await render(<TodayScreen />);
    for (const l of ['Movement: Done', 'Movement: Fallback', 'Movement: Push to tomorrow', "Movement: Emergency day off. Today won't count for or against you.", 'Read, Fallback done. Change']) {
      expect(screen.getByLabelText(l)).toBeTruthy();
    }
  });

  it('no em dash or en dash in anything Today shows, in each state', async () => {
    const states: Array<[unknown[], unknown[]]> = [
      [[], []],
      [[task()], [occ({ outcome: 'not-due', chipState: null })]],
      [[task({ timeOfDay: '07:00', cadence: { kind: 'specific-weekdays', weekdays: [1, 4] } })], [occ()]],
      [[task()], [occ({ outcome: 'off', chipState: null })]],
      [[task()], [occ({ chipState: 'done' }), occ({ pushedFrom: '2026-07-15' })]],
      [[task({ type: 'course', dosesPerDay: 3 })], [occ({ dosesRequired: 3, dosesCompleted: 1 })]],
    ];
    for (const [tasks, occs] of states) {
      read(tasks, occs);
      const view = await render(<TodayScreen reentryOverride justAddedOverride />);
      expect(allVisibleText()).not.toMatch(/[\u2014\u2013]/);
      await view.unmount();
    }
    for (const v of Object.values(S09_COPY)) expect(String(v)).not.toMatch(/[\u2014\u2013]/);
  });

  it('error and loading states have no dashes either', async () => {
    mockUseTasks.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    mockUseToday.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    await render(<TodayScreen />);
    expect(screen.getByText(S09_COPY.readFailure)).toBeTruthy();
    expect(allVisibleText()).not.toMatch(/[\u2014\u2013]/);
  });
});

describe('sound timing: rewards wait for a playing sound and never stack', () => {
  // The timing helper has no audio of its own; these use its public schedule() with fake time.
  const { schedule, resetSoundTiming, REWARD_GAP_MS, SOUND_MS } = require('@/services/sfx/timing');
  beforeEach(() => {
    jest.useFakeTimers();
    resetSoundTiming();
  });
  afterEach(() => {
    resetSoundTiming();
    jest.useRealTimers();
  });

  it('four badges and a level-up earned by one press start one after another, each after the last has finished', () => {
    const started: Array<[string, number]> = [];
    const t0 = Date.now();
    schedule('log_ideal', 0, () => started.push(['log_ideal', Date.now() - t0]));
    for (const n of ['badge_earned', 'badge_earned', 'badge_earned', 'level_up']) schedule(n, 300, () => started.push([n, Date.now() - t0]));
    jest.advanceTimersByTime(30_000);
    expect(started.map((s) => s[0])).toEqual(['log_ideal', 'badge_earned', 'badge_earned', 'badge_earned', 'level_up']);
    expect(started[1][1]).toBeGreaterThanOrEqual(SOUND_MS.log_ideal + REWARD_GAP_MS);
    for (let i = 2; i < started.length; i++) {
      expect(started[i][1] - started[i - 1][1]).toBeGreaterThanOrEqual(SOUND_MS[started[i - 1][0]] + REWARD_GAP_MS);
    }
  });

  it('calling one reward off while others wait leaves the others to play', () => {
    const started: string[] = [];
    schedule('log_ideal', 0, () => {});
    schedule('badge_earned', 300, () => started.push('a'));
    const off = schedule('badge_earned', 300, () => started.push('b'));
    schedule('level_up', 300, () => started.push('c'));
    jest.advanceTimersByTime(400);
    off();
    jest.advanceTimersByTime(30_000);
    expect(started).toEqual(['a', 'c']);
  });

  it('a reward called off after it began does nothing and does not throw', () => {
    const begin = jest.fn();
    const off = schedule('badge_earned', 0, begin);
    expect(begin).toHaveBeenCalledTimes(1);
    expect(() => off()).not.toThrow();
  });

  it('the day-complete sound also waits for the log sound that finished the day', () => {
    const started: Array<[string, number]> = [];
    const t0 = Date.now();
    schedule('log_ideal', 0, () => started.push(['log_ideal', Date.now() - t0]));
    schedule('day_complete', 650, () => started.push(['day_complete', Date.now() - t0]));
    jest.advanceTimersByTime(10_000);
    expect(started[1][1]).toBeGreaterThanOrEqual(SOUND_MS.log_ideal + REWARD_GAP_MS);
  });

  it('a tap during the gap pushes a waiting reward back, and rewards are still in order', () => {
    const started: string[] = [];
    schedule('badge_earned', 0, () => started.push('first'));
    schedule('level_up', 0, () => started.push('second'));
    jest.advanceTimersByTime(SOUND_MS.badge_earned + 100);
    schedule('log_fallback', 0, () => started.push('tap'));
    jest.advanceTimersByTime(60_000);
    expect(started).toEqual(['first', 'tap', 'second']);
  });
});

describe('celebration host: several unlocks at once show one at a time', () => {
  it('three badges and a level-up queue up and the pop-up shows exactly one, then the next on dismiss', async () => {
    jest.useFakeTimers();
    const { CelebrationHost } = require('@/features/progress/CelebrationHost');
    const { resetSoundTiming } = require('@/services/sfx/timing');
    resetSoundTiming();
    const { fireEvent } = require('@testing-library/react-native');
    await render(<CelebrationHost />);
    const push = useCelebrationStore.getState().push;
    await act(async () => {
      push({ kind: 'badge', badgeKey: 'tenure-first-day' });
      push({ kind: 'badge', badgeKey: 'tenure-1-year' });
      push({ kind: 'level-up', lifetimeXp: 5000 });
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    let seen = 0;
    for (let i = 0; i < 12 && useCelebrationStore.getState().queue.length > 0; i++) {
      await act(async () => {
        jest.advanceTimersByTime(6000);
      });
      const nice = screen.queryAllByLabelText('Nice');
      expect(nice.length).toBeLessThanOrEqual(1);
      if (nice[0]) {
        seen++;
        await fireEvent.press(nice[0]);
      }
    }
    expect(seen).toBe(3);
    expect(useCelebrationStore.getState().queue).toHaveLength(0);
    jest.useRealTimers();
  });
});
