/**
 * Round 3 edge cases, app lifecycle: background and foreground, repeated quickly, the day tick,
 * the repair pass on foreground, the splash under a slow or corrupt store, Try again on recovery,
 * reminder taps from a cold start and while open, the root layout's providers, and what survives
 * a process kill. AppState is a controllable emitter; time is faked. The splash and the root layout
 * are the real screens (their router, store and notification seams are mocked).
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, Text, type AppStateStatus } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router as mockRouter } from 'expo-router';

// ---------- seams -------------------------------------------------------------------------------

jest.mock('expo-router', () => {
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false };
  return {
    __esModule: true,
    router,
    useRouter: () => router,
    useLocalSearchParams: () => ({}),
    useSegments: () => [],
    Stack: (props: unknown) => mockStackRender(props),
  };
});

const mockTapListeners: Array<(response: unknown) => void> = [];

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn((listener: (response: unknown) => void) => {
    mockTapListeners.push(listener);
    return { remove: jest.fn() };
  }),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  setNotificationChannelAsync: jest.fn(async () => null),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

jest.mock('@/db', () => ({
  store: { open: jest.fn(), status: jest.fn(() => 'ready') },
  repos: {
    settings: { get: jest.fn() },
    tasks: { list: jest.fn(async () => []) },
    logs: { listRange: jest.fn(async () => []), listForDate: jest.fn(async () => []) },
    offDays: { listRange: jest.fn(async () => []) },
    cycleState: { get: jest.fn(async () => null) },
    progress: { listXpAwards: jest.fn(async () => []) },
  },
}));

jest.mock('@/queries', () => ({
  sweepExpiredDeleted: jest.fn(async () => undefined),
  catchUpCycles: jest.fn(async () => undefined),
  healMissingXp: jest.fn(async () => 0),
  // The reminder bridge and the day tick do not read these in this file, but the module graph does.
  useTasks: jest.fn(),
  useToday: jest.fn(),
}));

jest.mock('@/services/billing', () => ({
  billing: { init: jest.fn(async () => ({ ok: true })), refreshEntitlement: jest.fn(async () => ({ ok: true })) },
}));
jest.mock('@/features/onboarding/progress', () => ({ clearOnboardingProgress: jest.fn(async () => undefined) }));
jest.mock('@/services/widgets', () => ({ initWidgetsBridge: jest.fn(() => () => undefined) }));
jest.mock('@/services/sfx', () => ({ play: jest.fn(), warmUpSounds: jest.fn() }));
jest.mock('expo-status-bar', () => ({ StatusBar: (props: unknown) => mockStatusBar(props) }));
jest.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: (p: { children: unknown }) => p.children }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: (p: { children: unknown }) => p.children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Read only when a rendered component calls them, i.e. after this module has finished loading.
const mockStackRender = jest.fn((_props: unknown) => null);
const mockStatusBar = jest.fn((_props: unknown) => null);

import S01Splash from '../../app/splash';
import S50Recovery from '../../app/recovery';
import RootLayout from '../../app/_layout';
import { useDayRollover, useThemeStore } from '@/app-shell';
import { useDayTick } from '@/features/today/useTodayRows';
import { runStartupRepairs } from '@/app-shell/repairs';
import { initNotificationsBridge, takePendingTapRoute } from '@/services/notifications';
import { store, repos } from '@/db';
import { catchUpCycles, healMissingXp, sweepExpiredDeleted } from '@/queries';
import { useToastStore } from '@/app-shell/stores/toast';
import { S50_COPY } from '@/features/data/copy';
import { today } from '@/lib/date';

// ---------- AppState emitter --------------------------------------------------------------------

type Handler = (state: AppStateStatus) => void;
const handlers = new Set<Handler>();

function emit(state: AppStateStatus) {
  for (const h of [...handlers]) h(state);
}
const listenerCount = () => handlers.size;

/** Lets queued promises run, without moving the clock. */
async function flush() {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/** Moves the fake clock forward once by `ms`, then lets the work it started run. */
async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flush();
}

const SETTINGS_ONBOARDED = { onboardingCompletedAt: '2026-01-01T00:00:00.000Z', theme: 'auto', accent: 'forge-orange', notifications: { master: false } };

/** Counts intervals this test opens and closes; unrelated timers (the renderer's own) are ignored. */
function spyIntervals() {
  return { setIntervalSpy: jest.spyOn(globalThis, 'setInterval'), clearIntervalSpy: jest.spyOn(globalThis, 'clearInterval') };
}

/** The style the layout last gave the status bar: the look it is drawn in. */
function lastStatusBarStyle(): string | undefined {
  const last = mockStatusBar.mock.calls.at(-1)?.[0] as { style?: string } | undefined;
  return last?.style;
}

function wrap(node: React.ReactNode, qc = new QueryClient()) {
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}

function DayProbe({ label = 'day' }: { label?: string }) {
  const date = useDayRollover();
  return <Text>{`${label}:${date}`}</Text>;
}

function TickProbe() {
  useDayTick();
  return <Text>{`tick:${today()}`}</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: new Date(2026, 10, 20, 12, 0) });
  handlers.clear();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type: string, handler: Handler) => {
    handlers.add(handler);
    return { remove: () => void handlers.delete(handler) };
  });
  (store.status as jest.Mock).mockReturnValue('ready');
  (store.open as jest.Mock).mockResolvedValue({ ok: true, value: 'ready' });
  (repos.settings.get as jest.Mock).mockResolvedValue(SETTINGS_ONBOARDED);
  (sweepExpiredDeleted as jest.Mock).mockImplementation(async () => undefined);
  (catchUpCycles as jest.Mock).mockImplementation(async () => undefined);
  (healMissingXp as jest.Mock).mockImplementation(async () => 0);
  useThemeStore.setState({ mode: 'auto', accent: 'forge-orange' });
  useToastStore.setState({ toasts: [] } as never);
  mockRouter.replace = jest.fn();
  mockRouter.push = jest.fn();
});

afterEach(async () => {
  // Drain any repair pass a test left running so the next test starts from an idle module.
  await advance(10000);
  jest.useRealTimers();
});

// ---------- 1. the day moves on while the app was away ------------------------------------------

describe('a day that passes while the app is in the background', () => {
  it('the next foreground moves the header date to the new day and refreshes the queries', async () => {
    const qc = new QueryClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    jest.setSystemTime(new Date(2026, 10, 20, 23, 30));
    await render(wrap(<DayProbe />, qc));
    expect(screen.getByText('day:2026-11-20')).toBeTruthy();

    // The phone slept over midnight: no timer ran, only the clock moved.
    jest.setSystemTime(new Date(2026, 10, 21, 0, 10));
    await act(async () => emit('background'));
    await act(async () => emit('active'));

    expect(screen.getByText('day:2026-11-21')).toBeTruthy();
    expect(spy).toHaveBeenCalled();
  });

  it('with no foreground at all, the minute check catches midnight once the app is awake', async () => {
    jest.setSystemTime(new Date(2026, 10, 20, 23, 59, 30));
    await render(wrap(<DayProbe />));
    jest.setSystemTime(new Date(2026, 10, 21, 0, 0, 20));
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(screen.getByText('day:2026-11-21')).toBeTruthy();
  });

  it('a screen that reads the day on render (useDayTick) moves on the foreground, not only on the 30 s timer', async () => {
    jest.setSystemTime(new Date(2026, 10, 20, 23, 59, 50));
    await render(<TickProbe />);
    expect(screen.getByText('tick:2026-11-20')).toBeTruthy();
    jest.setSystemTime(new Date(2026, 10, 21, 7, 0));
    await act(async () => emit('active'));
    expect(screen.getByText('tick:2026-11-21')).toBeTruthy();
  });

  it('a background event alone does not move the day (only active does)', async () => {
    jest.setSystemTime(new Date(2026, 10, 20, 23, 30));
    await render(wrap(<DayProbe />));
    jest.setSystemTime(new Date(2026, 10, 21, 0, 10));
    await act(async () => emit('background'));
    expect(screen.getByText('day:2026-11-20')).toBeTruthy();
  });
});

// ---------- 2. quick background and foreground: no stacked timers or listeners -------------------

describe('background and foreground, repeated quickly', () => {
  it('forty cycles leave one listener and one timer per mounted hook, and do not re-invalidate without a day change', async () => {
    const qc = new QueryClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const { setIntervalSpy, clearIntervalSpy } = spyIntervals();
    await render(
      wrap(
        <>
          <DayProbe />
          <TickProbe />
        </>,
        qc,
      ),
    );
    const listenersAfterMount = listenerCount();
    const openAfterMount = setIntervalSpy.mock.calls.length - clearIntervalSpy.mock.calls.length;
    expect(openAfterMount).toBe(2);
    for (let i = 0; i < 40; i++) {
      await act(async () => emit('background'));
      await act(async () => emit('active'));
    }
    expect(listenerCount()).toBe(listenersAfterMount);
    expect(setIntervalSpy.mock.calls.length - clearIntervalSpy.mock.calls.length).toBe(openAfterMount);
    expect(spy).not.toHaveBeenCalled();
  });

  it('unmounting removes every AppState listener and clears the interval', async () => {
    const { setIntervalSpy, clearIntervalSpy } = spyIntervals();
    const openBefore = setIntervalSpy.mock.calls.length - clearIntervalSpy.mock.calls.length;
    const listenersBefore = listenerCount();
    const tree = await render(
      wrap(
        <>
          <DayProbe />
          <TickProbe />
        </>,
      ),
    );
    expect(listenerCount()).toBeGreaterThan(listenersBefore);
    await tree.unmount();
    expect(listenerCount()).toBe(listenersBefore);
    expect(setIntervalSpy.mock.calls.length - clearIntervalSpy.mock.calls.length).toBe(openBefore);
  });

  it('an active event after unmount does nothing and logs no state-update warning', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const screenTree = await render(wrap(<DayProbe />));
    await screenTree.unmount();
    jest.setSystemTime(new Date(2026, 10, 21, 1, 0));
    await act(async () => emit('active'));
    expect(errors.mock.calls.filter((c) => String(c[0]).match(/unmounted|state update/i))).toHaveLength(0);
    errors.mockRestore();
  });
});

// ---------- 3. the repair pass on foreground ----------------------------------------------------

describe('the repair pass (sweep, cycle catch-up, XP heal) on foreground', () => {
  it('runs all three on a foreground once the store is open', async () => {
    await act(async () => runStartupRepairs());
    await flush();
    expect(sweepExpiredDeleted).toHaveBeenCalledTimes(1);
    expect(catchUpCycles).toHaveBeenCalledTimes(1);
    expect(healMissingXp).toHaveBeenCalledTimes(1);
  });

  it('the XP heal waits for the cycle catch-up, so a repaired award is stamped with the advanced pointer', async () => {
    let finishCatchUp!: () => void;
    (catchUpCycles as jest.Mock).mockImplementation(() => new Promise<void>((resolve) => (finishCatchUp = resolve)));
    void runStartupRepairs();
    await flush();
    expect(catchUpCycles).toHaveBeenCalledTimes(1);
    expect(healMissingXp).not.toHaveBeenCalled();
    await act(async () => finishCatchUp());
    await flush();
    expect(healMissingXp).toHaveBeenCalledTimes(1);
  });

  it('a failing sweep does not stop the cycle catch-up or the XP heal, and throws nothing', async () => {
    (sweepExpiredDeleted as jest.Mock).mockRejectedValue(new Error('disk gone'));
    await act(async () => runStartupRepairs());
    await flush();
    expect(catchUpCycles).toHaveBeenCalled();
    expect(healMissingXp).toHaveBeenCalled();
  });

  it('never runs two passes at once: a foreground during a running pass queues exactly one more, after it', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    (sweepExpiredDeleted as jest.Mock).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          setTimeout(() => {
            inFlight -= 1;
            resolve();
          }, 100);
        }),
    );
    void runStartupRepairs();
    for (let i = 0; i < 5; i++) void runStartupRepairs();
    await advance(100);
    await advance(100);
    expect(maxInFlight).toBe(1);
    expect(sweepExpiredDeleted).toHaveBeenCalledTimes(2);
  });

  it('a foreground through the layout hook runs the pass only once the store is open', async () => {
    await render(<RootLayout />);
    (store.status as jest.Mock).mockReturnValue('uninitialised');
    await act(async () => emit('active'));
    await flush();
    expect(sweepExpiredDeleted).not.toHaveBeenCalled();
    (store.status as jest.Mock).mockReturnValue('corrupt');
    await act(async () => emit('active'));
    await flush();
    expect(sweepExpiredDeleted).not.toHaveBeenCalled();
    (store.status as jest.Mock).mockReturnValue('ready');
    await act(async () => emit('active'));
    await flush();
    expect(sweepExpiredDeleted).toHaveBeenCalledTimes(1);
  });

  it('background does not start a pass; a foreground starts one', async () => {
    await render(<RootLayout />);
    await act(async () => emit('background'));
    await act(async () => emit('inactive' as AppStateStatus));
    await flush();
    expect(sweepExpiredDeleted).not.toHaveBeenCalled();
    await act(async () => emit('active'));
    await flush();
    expect(sweepExpiredDeleted).toHaveBeenCalledTimes(1);
  });
});

// ---------- 4. the splash under a slow, corrupt or failing store -------------------------------

describe('the splash (S01) under a slow or failing store', () => {
  it('a slow store holds the splash and navigates exactly once when it answers', async () => {
    let answer!: (v: unknown) => void;
    (store.open as jest.Mock).mockReturnValue(new Promise((resolve) => (answer = resolve)));
    await render(<S01Splash />);
    await advance(5000);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await act(async () => answer({ ok: true, value: 'ready' }));
    await advance(1000);
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/today');
  });

  it('holds the wordmark for the minimum display even when the store answers at once', async () => {
    await render(<S01Splash />);
    await advance(0);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(399);
      await Promise.resolve();
    });
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await advance(1);
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  });

  it('leaving the splash before the store answers means no navigation when it does', async () => {
    let answer!: (v: unknown) => void;
    (store.open as jest.Mock).mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const tree = await render(<S01Splash />);
    await advance(100);
    await tree.unmount();
    await act(async () => answer({ ok: true, value: 'ready' }));
    await advance(1000);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('leaving during the minimum-display wait means no navigation after it', async () => {
    const tree = await render(<S01Splash />);
    await advance(100);
    await tree.unmount();
    await advance(1000);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('a corrupt store goes to recovery once, never to Today', async () => {
    (store.open as jest.Mock).mockResolvedValue({ ok: true, value: 'corrupt' });
    await render(<S01Splash />);
    await advance(1000);
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/recovery');
  });

  it('an uninitialised store also goes to recovery', async () => {
    (store.open as jest.Mock).mockResolvedValue({ ok: true, value: 'uninitialised' });
    await render(<S01Splash />);
    await advance(1000);
    expect(mockRouter.replace).toHaveBeenCalledWith('/recovery');
  });

  it('a store open that throws goes to recovery rather than hanging the splash', async () => {
    (store.open as jest.Mock).mockRejectedValue(new Error('boom'));
    await render(<S01Splash />);
    await advance(1000);
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/recovery');
  });

  it('a missing settings singleton after a ready open goes to recovery, once', async () => {
    (repos.settings.get as jest.Mock).mockRejectedValue(new Error('no singleton'));
    await render(<S01Splash />);
    await advance(1000);
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/recovery');
  });
});

// ---------- 5. corrupt store, then Try again ----------------------------------------------------

describe('recovery (S50) and Try again', () => {
  it('Try again on a store that is now readable returns to the splash, which then reaches Today', async () => {
    (store.open as jest.Mock).mockResolvedValueOnce({ ok: true, value: 'corrupt' });
    const splash = await render(<S01Splash />);
    await advance(1000);
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/recovery');
    await splash.unmount();

    mockRouter.replace = jest.fn();
    (store.open as jest.Mock).mockResolvedValue({ ok: true, value: 'ready' });
    await render(<S50Recovery />);
    await fireEvent.press(screen.getByText(S50_COPY.tryAgain));
    await flush();
    expect(mockRouter.replace).toHaveBeenCalledWith('/splash');
  });

  it('Try again on a store that is still corrupt stays on recovery and can be tried again', async () => {
    (store.open as jest.Mock).mockResolvedValue({ ok: true, value: 'corrupt' });
    await render(<S50Recovery />);
    await fireEvent.press(screen.getByText(S50_COPY.tryAgain));
    await flush();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText(S50_COPY.tryAgain));
    await flush();
    expect((store.open as jest.Mock).mock.calls.length).toBe(2);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('two presses before the first answer open the store once', async () => {
    let answer!: (v: unknown) => void;
    (store.open as jest.Mock).mockReturnValue(new Promise((resolve) => (answer = resolve)));
    await render(<S50Recovery />);
    const tryAgain = screen.getByText(S50_COPY.tryAgain);
    await fireEvent.press(tryAgain);
    await fireEvent.press(tryAgain);
    expect((store.open as jest.Mock).mock.calls.length).toBe(1);
    await act(async () => answer({ ok: true, value: 'corrupt' }));
    await flush();
  });

  it('a Try again whose open throws stays calm on recovery', async () => {
    (store.open as jest.Mock).mockRejectedValue(new Error('still broken'));
    await render(<S50Recovery />);
    await fireEvent.press(screen.getByText(S50_COPY.tryAgain));
    await flush();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(screen.getByText(S50_COPY.tryAgain)).toBeTruthy();
  });
});

// ---------- 6. reminder taps: from a cold start, and while the app is open ----------------------

describe('a reminder tap', () => {
  let tapListener!: (response: unknown) => void;

  beforeAll(() => {
    // The bridge arms the tap listener once per app session; the listener it registered is kept here,
    // so clearing mock calls between tests does not lose it.
    (repos.settings.get as jest.Mock).mockResolvedValue(SETTINGS_ONBOARDED);
    initNotificationsBridge(); // idempotent: a no-op when an earlier test already armed it
    expect(mockTapListeners.length).toBeGreaterThan(0);
    tapListener = mockTapListeners[mockTapListeners.length - 1] as (response: unknown) => void;
  });

  const response = (data: Record<string, unknown>) => ({ notification: { request: { content: { data } } } });

  it('from a cold start: the tap is held until the splash opens, then the splash goes to the tapped screen', async () => {
    (store.status as jest.Mock).mockReturnValue('uninitialised');
    await act(() => tapListener(response({ kind: 'gentle-reentry', taskId: 't1' })));
    expect(mockRouter.push).not.toHaveBeenCalled();

    (store.status as jest.Mock).mockReturnValue('ready');
    await render(<S01Splash />);
    await advance(1000);
    expect(mockRouter.replace).toHaveBeenCalledWith('/today?reentry=1&taskId=t1');
  });

  it('while the app is open: the tap pushes the tapped screen straight away', async () => {
    (store.status as jest.Mock).mockReturnValue('ready');
    await act(() => tapListener(response({ kind: 'gentle-reentry', taskId: 't2' })));
    expect(mockRouter.push).toHaveBeenCalledWith('/today?reentry=1&taskId=t2');
  });

  it('a routine reminder opens plain Today', async () => {
    (store.status as jest.Mock).mockReturnValue('ready');
    await act(() => tapListener(response({ kind: 'routine-due', taskId: 't3' })));
    expect(mockRouter.push).toHaveBeenCalledWith('/today');
  });

  it('a held cold-start tap is taken once: a second take returns nothing', async () => {
    (store.status as jest.Mock).mockReturnValue('uninitialised');
    await act(() => tapListener(response({ kind: 'gentle-reentry', taskId: 't4' })));
    expect(takePendingTapRoute()).toBe('/today?reentry=1&taskId=t4');
    expect(takePendingTapRoute()).toBeNull();
  });

  it('a cold-start tap is dropped when onboarding is not finished, and does not wait for a later launch', async () => {
    (store.status as jest.Mock).mockReturnValue('uninitialised');
    await act(() => tapListener(response({ kind: 'gentle-reentry', taskId: 't5' })));
    (store.status as jest.Mock).mockReturnValue('ready');
    (repos.settings.get as jest.Mock).mockResolvedValueOnce({ ...SETTINGS_ONBOARDED, onboardingCompletedAt: null });
    await render(<S01Splash />);
    await advance(1000);
    expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding/concept');
    expect(takePendingTapRoute()).toBeNull();
  });

  it.failing(
    'BUG (src/services/notifications/index.ts, tap listener): a tap that lands while the splash is still in its minimum-display wait is overwritten by Today',
    async () => {
      (store.status as jest.Mock).mockReturnValue('ready');
      await render(<S01Splash />); // store answers; the 400 ms minimum has not passed yet
      await advance(0);
      await act(() => tapListener(response({ kind: 'gentle-reentry', taskId: 't6' })));
      await advance(1000);
      expect(mockRouter.replace).toHaveBeenLastCalledWith('/today?reentry=1&taskId=t6');
    },
  );
});

// ---------- 7. the root layout's providers, in order -------------------------------------------

describe('the root layout (app/_layout.tsx)', () => {
  it('arms the notification and widget bridges once per mount, not once per render', async () => {
    const { initWidgetsBridge } = jest.requireMock('@/services/widgets') as { initWidgetsBridge: jest.Mock };
    const { warmUpSounds } = jest.requireMock('@/services/sfx') as { warmUpSounds: jest.Mock };
    const tree = await render(<RootLayout />);
    await tree.rerender(<RootLayout />);
    await tree.rerender(<RootLayout />);
    expect(initWidgetsBridge).toHaveBeenCalledTimes(1);
    expect(warmUpSounds).toHaveBeenCalledTimes(1);
  });

  it('the toast host renders beside the screens, so a message shows on any route', async () => {
    await render(<RootLayout />);
    await act(async () => useToastStore.getState().show('Saved', 'success'));
    expect(screen.getByLabelText(/^Saved/)).toBeTruthy();
  });

  it('a crash inside the screens shows the calm fallback, and the toast host is still mounted', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockStackRender.mockImplementation(() => {
      throw new Error('screen invariant');
    });
    try {
      await render(<RootLayout />);
      expect(screen.getByText('Something went wrong.')).toBeTruthy();
      await act(() => useToastStore.getState().show('Still here', 'neutral'));
      expect(screen.getByText('Still here')).toBeTruthy();
    } finally {
      mockStackRender.mockImplementation(() => null);
      errors.mockRestore();
    }
  });

  it('the status bar follows the saved look once the splash hydrates it (characterisation of the first-paint gap)', async () => {
    await render(<RootLayout />);
    expect(lastStatusBarStyle()).toBeDefined();
    await act(() => useThemeStore.getState().hydrate('dark', 'plum'));
    expect(lastStatusBarStyle()).toBe('light');
  });

});

// ---------- 8. what survives the process being killed ------------------------------------------

describe('a process kill and restore', () => {
  it('a relaunch with the same database reads back the saved look and lands on Today', async () => {
    (repos.settings.get as jest.Mock).mockResolvedValue({ ...SETTINGS_ONBOARDED, theme: 'dark', accent: 'plum' });
    useThemeStore.setState({ mode: 'auto', accent: 'forge-orange' }); // a fresh process: memory is empty
    await render(<S01Splash />);
    await advance(1000);
    expect(useThemeStore.getState().mode).toBe('dark');
    expect(useThemeStore.getState().accent).toBe('plum');
    expect(mockRouter.replace).toHaveBeenCalledWith('/today');
  });

  it('the repair pass runs again on the relaunch (nothing about it was kept in memory)', async () => {
    await render(<S01Splash />);
    await advance(1000);
    expect(sweepExpiredDeleted).toHaveBeenCalledTimes(1);
    expect(catchUpCycles).toHaveBeenCalledTimes(1);
    expect(healMissingXp).toHaveBeenCalledTimes(1);
  });
});
