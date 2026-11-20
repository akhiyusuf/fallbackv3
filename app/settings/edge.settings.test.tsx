/**
 * Round 2 edge pass: settings and data screens against the REAL query hooks and a REAL SQLite
 * store (node:sqlite behind the expo-sqlite double). A "cold start" here is a brand new
 * QueryClient and the in-memory stores put back to their defaults, so what is shown again can
 * only have come from the database. The picker, the share sheet and the router are mocked.
 */
jest.mock('expo-sqlite', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('@/db/testSupport/expoSqliteTestDouble') as typeof import('@/db/testSupport/expoSqliteTestDouble')).createExpoSqliteTestDouble(),
);
jest.mock('expo-crypto', () => ({ randomUUID: () => (globalThis as unknown as { crypto: Crypto }).crypto.randomUUID() }));
jest.mock('expo-file-system/legacy', () => require('@/db/testSupport/fileSystemTestDouble'));

const mockSecure = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: jest.fn(async (k: string) => mockSecure.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    mockSecure.set(k, v);
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    mockSecure.delete(k);
  }),
}));

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockDismissAll = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, dismissAll: mockDismissAll, canGoBack: () => true, back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

const mockGetDocument = jest.fn();
jest.mock('expo-document-picker', () => ({ getDocumentAsync: (...a: unknown[]) => mockGetDocument(...a) }));
const mockShare = jest.fn();
jest.mock('react-native/Libraries/Share/Share', () => ({ __esModule: true, default: { share: (...a: unknown[]) => mockShare(...a) } }));
jest.mock('@/services/notifications', () => ({ initNotificationsBridge: jest.fn() }));
jest.mock('@/services/widgets', () => ({ initWidgetsBridge: jest.fn() }));

import { act, fireEvent, render, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useThemeStore, useToastStore } from '@/app-shell';
import { repos, store } from '@/db';
import { __read, __write, __reset } from '@/db/testSupport/fileSystemTestDouble';
import { useAgentAccessStore } from '@/features/agents/store';
import { S47_COPY, S48_COPY } from '@/features/data/copy';
import { S42_COPY, S43_COPY, S46_COPY } from '@/features/settings/copy';
import { makeTask } from '@/features/task/testSupport/taskFixture';
import { useSoundStore } from '@/services/sfx';
import { DEFAULT_ACCENT } from '@/theme';
import { err, ok } from '@/types';
import type { Id, Instant, NotificationPrefs } from '@/types';

import AchievementsScreen from '../achievements/index';
import AgentAccess from './agents';
import S47Data from './data/index';
import S42Notifications from './notifications';
import S41Settings from './index';
import S43Theme from './theme';
import S46Widgets from './widgets';

let client: QueryClient;

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false }, mutations: { retry: false } },
  });
}

/** One launch of the screen: a new query cache, the screen, nothing remembered from before. */
async function mount(Screen: () => React.JSX.Element) {
  client = freshClient();
  return render(
    <QueryClientProvider client={client}>
      <Screen />
    </QueryClientProvider>,
  );
}

function coldStartMemory() {
  useThemeStore.setState({ mode: 'auto', accent: DEFAULT_ACCENT });
  useToastStore.setState({ toast: null });
}

const toast = () => useToastStore.getState().toast;

beforeAll(async () => {
  const opened = await store.open();
  expect(opened.ok).toBe(true);
});

beforeEach(async () => {
  jest.restoreAllMocks();
  mockReplace.mockReset();
  mockPush.mockReset();
  mockDismissAll.mockReset();
  mockGetDocument.mockReset();
  mockShare.mockReset().mockResolvedValue({});
  mockSecure.clear();
  __reset();
  const erased = await store.eraseAll();
  expect(erased.ok).toBe(true);
  coldStartMemory();
  useSoundStore.setState({ on: true });
  useAgentAccessStore.getState().reset();
});

afterEach(() => {
  client?.clear();
});

/* ============================================================== theme (S43) */

describe('S43 theme and accent', () => {
  it('Dark is saved, still chosen after a cold start, and the screen shows it', async () => {
    const user = userEvent.setup();
    await mount(S43Theme);
    await user.press(await screen.findByText('Dark'));
    await waitFor(async () => expect((await repos.settings.get()).theme).toBe('dark'));
    expect(useThemeStore.getState().mode).toBe('dark');

    coldStartMemory();
    expect(useThemeStore.getState().mode).toBe('auto');
    await mount(S43Theme);
    await waitFor(() => expect(useThemeStore.getState().mode).toBe('dark'));
  });

  it('every appearance choice round-trips through the database (Light, Dark, Auto)', async () => {
    const user = userEvent.setup();
    await mount(S43Theme);
    for (const label of ['Light', 'Dark', 'Auto'] as const) {
      await user.press(await screen.findByText(label));
      await waitFor(async () => expect((await repos.settings.get()).theme).toBe(label.toLowerCase()));
    }
  });

  it('a colour swatch is saved and comes back after a cold start', async () => {
    const user = userEvent.setup();
    await mount(S43Theme);
    const swatch = (await screen.findAllByLabelText(/colour 3 of/))[0]!;
    await user.press(swatch);
    await waitFor(async () => expect((await repos.settings.get()).accent).toMatch(/^hue-/));
    const saved = (await repos.settings.get()).accent;
    coldStartMemory();
    await mount(S43Theme);
    await waitFor(() => expect(useThemeStore.getState().accent).toBe(saved));
  });

  it('a named theme is saved and shown as selected after a cold start', async () => {
    const user = userEvent.setup();
    await mount(S43Theme);
    const cards = await screen.findAllByRole('radio', { name: /^(?!.*colour)/ });
    const second = cards.find((c) => c.props.accessibilityState?.checked === false && !/colour/.test(String(c.props.accessibilityLabel)))!;
    await user.press(second);
    await waitFor(async () => expect((await repos.settings.get()).accent).not.toBe(DEFAULT_ACCENT));
    const saved = (await repos.settings.get()).accent;
    coldStartMemory();
    await mount(S43Theme);
    await waitFor(() => expect(useThemeStore.getState().accent).toBe(saved));
    expect(screen.getAllByLabelText(/, selected$/).length).toBeGreaterThan(0);
  });

  it('a failed save (the database refuses) undoes Dark and says so', async () => {
    jest.spyOn(repos.settings, 'patch').mockResolvedValue(err({ code: 'WRITE_FAILED', message: 'disk full' }));
    const user = userEvent.setup();
    await mount(S43Theme);
    await user.press(await screen.findByText('Dark'));
    await waitFor(() => expect(toast()?.message).toBe(S43_COPY.errorToast));
    expect(useThemeStore.getState().mode).toBe('auto');
    expect((await repos.settings.get()).theme).toBe('auto');
  });

  it('a save that THROWS (not just a refusal) is undone the same way, with no unhandled rejection', async () => {
    jest.spyOn(repos.settings, 'patch').mockRejectedValue(new Error('locked'));
    const user = userEvent.setup();
    await mount(S43Theme);
    await user.press(await screen.findByText('Dark'));
    await waitFor(() => expect(toast()?.message).toBe(S43_COPY.errorToast));
    expect(useThemeStore.getState().mode).toBe('auto');
  });

  it('a failed accent save puts the previous accent back', async () => {
    jest.spyOn(repos.settings, 'patch').mockResolvedValue(err({ code: 'WRITE_FAILED', message: 'x' }));
    const user = userEvent.setup();
    await mount(S43Theme);
    const before = useThemeStore.getState().accent;
    await user.press((await screen.findAllByLabelText(/colour 2 of/))[0]!);
    await waitFor(() => expect(toast()?.message).toBe(S43_COPY.errorToast));
    expect(useThemeStore.getState().accent).toBe(before);
  });

  it('a first save that fails after a second one succeeded does not undo the second', async () => {
    const real = repos.settings.patch.bind(repos.settings);
    let calls = 0;
    jest.spyOn(repos.settings, 'patch').mockImplementation(async (p) => {
      calls += 1;
      if (calls === 1) {
        await new Promise((r) => setTimeout(r, 30));
        return err({ code: 'WRITE_FAILED', message: 'slow and failed' });
      }
      return real(p);
    });
    const user = userEvent.setup();
    await mount(S43Theme);
    await user.press(await screen.findByText('Dark'));
    await user.press(await screen.findByText('Light'));
    await waitFor(() => expect(toast()?.message).toBe(S43_COPY.errorToast));
    expect(useThemeStore.getState().mode).toBe('light');
    expect((await repos.settings.get()).theme).toBe('light');
  });
});

/* ============================================================== notifications (S42) */

const TOGGLES: ReadonlyArray<[string, keyof NotificationPrefs]> = [
  [S42_COPY.reminderRows.routineDue, 'routineDue'],
  [S42_COPY.reminderRows.eventStarting, 'eventStarting'],
  [S42_COPY.reminderRows.courseDose, 'courseDose'],
  [S42_COPY.reminderRows.courseEndingSoon, 'courseEndingSoon'],
  [S42_COPY.encouragementRows.gentleReentry, 'gentleReentry'],
  [S42_COPY.encouragementRows.milestoneReached, 'milestoneReached'],
  [S42_COPY.digestRow, 'dailyDigest'],
];

async function prefsInDb(): Promise<NotificationPrefs> {
  return (await repos.settings.get()).notifications;
}

describe('S42 notifications', () => {
  beforeEach(async () => {
    // Master on so every row shows.
    await repos.settings.patch({ notifications: { master: true } as NotificationPrefs });
  });

  it.each(TOGGLES)('"%s" switch: saved, shown again after a cold start, and no other pref moves', async (label, key) => {
    const before = await prefsInDb();
    const user = userEvent.setup();
    await mount(S42Notifications);
    const sw = await screen.findByLabelText(new RegExp(`^${label}, (on|off)$`));
    await user.press(sw);
    await waitFor(async () => expect((await prefsInDb())[key]).toBe(!before[key]));
    const after = await prefsInDb();
    for (const k of Object.keys(before) as Array<keyof NotificationPrefs>) {
      if (k !== key) expect(after[k]).toBe(before[k]);
    }
    await mount(S42Notifications);
    await screen.findByLabelText(`${label}, ${after[key] ? 'on' : 'off'}`);
  });

  it('master off is saved; the sub-switches keep their values when master comes back on', async () => {
    await repos.settings.patch({ notifications: { routineDue: false, gentleReentry: true } as NotificationPrefs });
    const user = userEvent.setup();
    await mount(S42Notifications);
    await user.press(await screen.findByLabelText('Allow notifications, on'));
    await waitFor(async () => expect((await prefsInDb()).master).toBe(false));
    expect(screen.queryByText(S42_COPY.reminderRows.routineDue)).toBeNull();
    await user.press(await screen.findByLabelText('Allow notifications, off'));
    await waitFor(async () => expect((await prefsInDb()).master).toBe(true));
    const p = await prefsInDb();
    expect(p.routineDue).toBe(false);
    expect(p.gentleReentry).toBe(true);
  });

  it('the digest time picker saves the chosen time, shows it after a cold start, and hides when the digest is off', async () => {
    await repos.settings.patch({ notifications: { dailyDigest: true } as NotificationPrefs });
    const user = userEvent.setup();
    await mount(S42Notifications);
    await user.press(await screen.findByLabelText(/^Digest time, /));
    await user.press(await screen.findByLabelText('9:00 PM'));
    await waitFor(async () => expect((await prefsInDb()).dailyDigestTime).toBe('21:00'));
    await mount(S42Notifications);
    await screen.findByLabelText('Digest time, 9:00 PM');
    await user.press(await screen.findByLabelText('Daily digest, on'));
    await waitFor(async () => expect((await prefsInDb()).dailyDigest).toBe(false));
    expect(screen.queryByLabelText(/^Digest time, /)).toBeNull();
    // the time is kept for when it is turned on again
    expect((await prefsInDb()).dailyDigestTime).toBe('21:00');
  });

  it('a failed save leaves the switch as it was and shows the calm toast', async () => {
    jest.spyOn(repos.settings, 'patch').mockResolvedValue(err({ code: 'WRITE_FAILED', message: 'x' }));
    const user = userEvent.setup();
    await mount(S42Notifications);
    const before = (await prefsInDb()).routineDue;
    await user.press(await screen.findByLabelText(`${S42_COPY.reminderRows.routineDue}, ${before ? 'on' : 'off'}`));
    await waitFor(() => expect(toast()?.message).toBe(S42_COPY.errorToast));
    expect(screen.getByLabelText(`${S42_COPY.reminderRows.routineDue}, ${before ? 'on' : 'off'}`)).toBeTruthy();
    expect((await prefsInDb()).routineDue).toBe(before);
  });

  it('a save that throws is a toast, not an unhandled rejection', async () => {
    jest.spyOn(repos.settings, 'patch').mockRejectedValue(new Error('locked'));
    const user = userEvent.setup();
    await mount(S42Notifications);
    await user.press(await screen.findByLabelText(new RegExp(`^${S42_COPY.reminderRows.routineDue}, `)));
    await waitFor(() => expect(toast()?.message).toBe(S42_COPY.errorToast));
  });

  it('two switches pressed back to back both land (neither undoes the other with a stale copy)', async () => {
    const before = await prefsInDb();
    const user = userEvent.setup();
    await mount(S42Notifications);
    const a = await screen.findByLabelText(new RegExp(`^${S42_COPY.reminderRows.eventStarting}, `));
    const b = await screen.findByLabelText(new RegExp(`^${S42_COPY.reminderRows.courseDose}, `));
    await user.press(a);
    await user.press(b);
    await waitFor(async () => {
      const p = await prefsInDb();
      expect(p.eventStarting).toBe(!before.eventStarting);
      expect(p.courseDose).toBe(!before.courseDose);
    });
  });

  it('turning every sub-switch off shows the "nothing will arrive" line and the switches stay usable', async () => {
    await repos.settings.patch({
      notifications: { routineDue: false, eventStarting: false, courseDose: false, courseEndingSoon: false, gentleReentry: false, milestoneReached: false, dailyDigest: false } as NotificationPrefs,
    });
    await mount(S42Notifications);
    expect(await screen.findByText(`${S42_COPY.emptyHeadline}. ${S42_COPY.emptySubcopy}`)).toBeTruthy();
    expect(screen.getAllByRole('switch').length).toBeGreaterThan(5);
  });
});

/* ============================================================== sounds (S41 home) */

describe('Settings home: sounds', () => {
  it('the Sounds switch turns sounds off and writes the choice; it shows as off after a cold start', async () => {
    const user = userEvent.setup();
    await mount(S41Settings);
    await user.press(await screen.findByLabelText('Sounds, on'));
    expect(useSoundStore.getState().on).toBe(false);
    await waitFor(() => expect(mockSecure.get('fallback.sounds')).toBe('off'));
    await mount(S41Settings);
    expect(await screen.findByLabelText('Sounds, off')).toBeTruthy();
  });

  it('turning it back on is remembered too', async () => {
    useSoundStore.getState().setOn(false);
    const user = userEvent.setup();
    await mount(S41Settings);
    await user.press(await screen.findByLabelText('Sounds, off'));
    expect(useSoundStore.getState().on).toBe(true);
    expect(mockSecure.get('fallback.sounds')).not.toBe('off');
  });
});

/* ============================================================== agent access */

describe('AI agent access', () => {
  it('the master switch and a permission are written to the device and reset by an erase', async () => {
    const user = userEvent.setup();
    await mount(AgentAccess);
    await user.press(await screen.findByLabelText('Let AI agents connect'));
    expect(useAgentAccessStore.getState().enabled).toBe(true);
    await waitFor(() => expect(JSON.parse(mockSecure.get('fallback.agentAccess') ?? '{}').enabled).toBe(true));
    useAgentAccessStore.getState().setPermission('log', 'allow');
    await waitFor(() => expect(JSON.parse(mockSecure.get('fallback.agentAccess') ?? '{}').permissions.log).toBe('allow'));
    const erased = await store.eraseAll();
    expect(erased.ok).toBe(true);
    expect(mockSecure.has('fallback.agentAccess')).toBe(false);
  });

  it('turning the switch off disconnects every agent and hides the rest of the screen', async () => {
    const user = userEvent.setup();
    useAgentAccessStore.setState({ enabled: true, agents: [{ id: 'a', name: 'Claude' }] });
    await mount(AgentAccess);
    expect(await screen.findByText('Claude')).toBeTruthy();
    await user.press(screen.getByLabelText('Let AI agents connect'));
    expect(useAgentAccessStore.getState().agents).toHaveLength(0);
    expect(screen.queryByText('What an agent may do')).toBeNull();
  });

  it('a saved choice that is not one the screen offers falls back to the default on the next start', async () => {
    mockSecure.set('fallback.agentAccess', JSON.stringify({ enabled: true, permissions: { delete: 'allow', read: 'banana' } }));
    let fresh!: typeof import('@/features/agents/store');
    await jest.isolateModulesAsync(async () => {
      fresh = require('@/features/agents/store');
      await new Promise((r) => setTimeout(r, 10));
    });
    const s = fresh.useAgentAccessStore.getState();
    expect(s.enabled).toBe(true);
    expect(s.permissions.delete).toBe('ask');
    expect(s.permissions.read).toBe('allow');
  });
});

/* ============================================================== widgets (S46) */

describe('S46 widgets', () => {
  async function seedTask(name: string) {
    const task = makeTask({ id: `00000000-0000-4000-8000-${Math.floor(Math.random() * 1e12).toString().padStart(12, '0')}` as Id, name });
    await repos.tasks.insert(task, [...task.idealSteps, ...task.fallbackSteps]);
    return task;
  }

  it('a fixed task is saved for a widget, shown after a cold start, and "Next due" turns it back', async () => {
    const task = await seedTask('Stretch');
    const user = userEvent.setup();
    await mount(S46Widgets);
    await user.press(await screen.findByLabelText('Small: one task widget. Opens its settings'));
    await user.press(await screen.findByText(S46_COPY.fixedTask));
    await user.press(await screen.findByLabelText(/^Task, /));
    await user.press((await screen.findAllByLabelText('Stretch')).at(-1)!);
    await user.press(await screen.findByText(S46_COPY.save));
    await waitFor(async () => expect((await repos.settings.get()).widgets.find((w) => w.size === 'small-one-task')?.fixedTaskId).toBe(task.id));
    await mount(S46Widgets);
    expect((await screen.findAllByText('Stretch')).length).toBeGreaterThan(0);
  });

  it('a failed save keeps the sheet open (nothing is thrown away) and shows the toast', async () => {
    jest.spyOn(repos.settings, 'patch').mockRejectedValue(new Error('x'));
    const user = userEvent.setup();
    await mount(S46Widgets);
    await user.press(await screen.findByLabelText('Medium: up next widget. Opens its settings'));
    await user.press(await screen.findByText(S46_COPY.save));
    await waitFor(() => expect(toast()?.message).toBe(S46_COPY.errorToast));
    expect(screen.getByText(S46_COPY.save)).toBeTruthy();
  });
});

/* ============================================================== cycle cadence (from the Achievements screen) */

describe('changing the cycle cadence mid-cycle', () => {
  function ymd(offsetDays: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  async function seedWeeklyCycleStartedDaysAgo(days: number) {
    await repos.settings.patch({ tenureAnchorDate: ymd(-20) as never, cycleCadence: 'weekly' });
    await repos.cycleState.set({ currentCycleId: `cycle:weekly:${ymd(-days)}`, cadence: 'weekly', startDate: ymd(-days) as never, endDate: ymd(6 - days) as never } as never);
  }

  it('the short record ends yesterday, the new cycle starts today, and the choice survives a cold start', async () => {
    await seedWeeklyCycleStartedDaysAgo(3);
    const user = userEvent.setup();
    await mount(AchievementsScreen);
    await user.press(await screen.findByText('Monthly'));
    await waitFor(async () => expect((await repos.settings.get()).cycleCadence).toBe('monthly'));
    const records = await repos.progress.listCycleRecords();
    const weekly = records.filter((r) => r.cadence === 'weekly');
    expect(weekly.length).toBeGreaterThan(0);
    const last = weekly.sort((a, b) => a.endDate.localeCompare(b.endDate)).at(-1)!;
        expect(last.startDate).toBe(ymd(-3));
    expect(last.endDate).toBe(ymd(-1));
    const state = await repos.cycleState.get();
    expect(state?.cadence).toBe('monthly');
    expect(state?.startDate).toBe(ymd(0));

    await mount(AchievementsScreen);
    await screen.findByText('Monthly XP');
  });

  it('changing it twice in one day adds no empty record', async () => {
    await seedWeeklyCycleStartedDaysAgo(3);
    const user = userEvent.setup();
    await mount(AchievementsScreen);
    await user.press(await screen.findByText('Monthly'));
    await waitFor(async () => expect((await repos.settings.get()).cycleCadence).toBe('monthly'));
    const afterFirst = (await repos.progress.listCycleRecords()).length;
    await user.press(await screen.findByText('Weekly'));
    await waitFor(async () => expect((await repos.settings.get()).cycleCadence).toBe('weekly'));
    expect((await repos.progress.listCycleRecords()).length).toBe(afterFirst);
  });

  it('a failed save shows the calm toast and the cadence stays what it was', async () => {
    await repos.settings.patch({ cycleCadence: 'weekly' });
    jest.spyOn(repos.settings, 'patch').mockResolvedValue(err({ code: 'WRITE_FAILED', message: 'x' }));
    const user = userEvent.setup();
    await mount(AchievementsScreen);
    await user.press(await screen.findByText('Monthly'));
    await waitFor(() => expect(toast()?.tone ?? toast()?.message).toBeTruthy());
    expect((await repos.settings.get()).cycleCadence).toBe('weekly');
  });
});

/* ============================================================== data (S47): backup, restore, erase */

describe('S47 backup', () => {
  it('backs up, shows the last-backup line, opens the share sheet with the file, and the file is real JSON', async () => {
    const user = userEvent.setup();
    await mount(S47Data);
    expect(await screen.findByText(S47_COPY.noBackupYet)).toBeTruthy();
    await user.press(screen.getByText(S47_COPY.backUpNow));
    await waitFor(() => expect(mockShare).toHaveBeenCalledTimes(1), { timeout: 5000 });
    const arg = mockShare.mock.calls[0]![0] as { url: string };
    expect(JSON.parse(__read(arg.url)).format).toBe('fallback-backup');
    expect(toast()?.message).toMatch(/^Backed up /);
    expect(await screen.findByText(/^Last backup /)).toBeTruthy();
  });

  it('a share sheet that throws (or is dismissed) does not undo the backup', async () => {
    mockShare.mockRejectedValue(new Error('no share target'));
    const user = userEvent.setup();
    await mount(S47Data);
    await user.press(await screen.findByText(S47_COPY.backUpNow));
    await waitFor(() => expect(toast()?.message).toMatch(/^Backed up /));
    expect((await repos.settings.get()).lastBackupAt).not.toBeNull();
  });

  it('a backup that fails shows the calm toast and the share sheet is not opened', async () => {
    jest.spyOn(store, 'backup').mockResolvedValue(err({ code: 'WRITE_FAILED', message: 'disk full' }));
    const user = userEvent.setup();
    await mount(S47Data);
    await user.press(await screen.findByText(S47_COPY.backUpNow));
    await waitFor(() => expect(toast()?.message).toBe(S47_COPY.backupFailureToast));
    expect(mockShare).not.toHaveBeenCalled();
  });

  it('a backup that THROWS is the same toast, not a crash', async () => {
    jest.spyOn(store, 'backup').mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    await mount(S47Data);
    await user.press(await screen.findByText(S47_COPY.backUpNow));
    await waitFor(() => expect(toast()?.message).toBe(S47_COPY.backupFailureToast));
  });

  it('a double tap makes one backup and one share sheet', async () => {
    const realBackup = store.backup.bind(store);
    const spy = jest.spyOn(store, 'backup').mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 40));
      return realBackup();
    });
    await mount(S47Data);
    const row = await screen.findByText(S47_COPY.backUpNow);
    await fireEvent.press(row);
    await fireEvent.press(row);
    await waitFor(() => expect(mockShare).toHaveBeenCalled(), { timeout: 5000 });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(mockShare).toHaveBeenCalledTimes(1);
  });
});

describe('S47 restore', () => {
  async function addTask(name: string) {
    const task = makeTask({ id: `00000000-0000-4000-8000-${Math.floor(Math.random() * 1e12).toString().padStart(12, '0')}` as Id, name });
    await repos.tasks.insert(task, [...task.idealSteps, ...task.fallbackSteps]);
    return task;
  }
  async function takeBackup(): Promise<string> {
    const r = await store.backup();
    if (!r.ok) throw new Error('backup failed');
    return r.value.uri;
  }
  const names = async () => (await repos.tasks.list()).map((t) => t.name).sort();

  it('a good file brings the data back, refreshes the screen state, applies the saved look, and tells the bridges to rebuild', async () => {
    await addTask('Alpha');
    await repos.settings.patch({ theme: 'dark', accent: 'berry' });
    const uri = await takeBackup();
    await addTask('Beta');
    await repos.settings.patch({ theme: 'light', accent: 'indigo' });
    coldStartMemory();

    const { on } = require('@/lib/events') as typeof import('@/lib/events');
    const ready = jest.fn();
    const off = on('store:ready', ready);
    mockGetDocument.mockResolvedValue({ canceled: false, assets: [{ uri }] });
    const user = userEvent.setup();
    await mount(S47Data);
    await user.press(await screen.findByText(S47_COPY.restoreFromBackup));
    await waitFor(() => expect(toast()?.message).toBe(S47_COPY.restoreSuccessToast));
    off();
    expect(await names()).toEqual(['Alpha']);
    expect(useThemeStore.getState().mode).toBe('dark');
    expect(useThemeStore.getState().accent).toBe('berry');
    expect(ready).toHaveBeenCalled();
    expect(screen.queryByText(S47_COPY.restoreFailure)).toBeNull();
  });

  it('a damaged file (cut off) is refused with the calm banner and the current data is untouched', async () => {
    await addTask('Keep me');
    const uri = await takeBackup();
    __write(uri, __read(uri).slice(0, 200));
    mockGetDocument.mockResolvedValue({ canceled: false, assets: [{ uri }] });
    const user = userEvent.setup();
    await mount(S47Data);
    await user.press(await screen.findByText(S47_COPY.restoreFromBackup));
    expect(await screen.findByText(S47_COPY.restoreFailure)).toBeTruthy();
    expect(await names()).toEqual(['Keep me']);
    expect(toast()).toBeNull();
  });

  it('a file that is not a backup at all, and a file that is empty, are refused', async () => {
    await addTask('Keep me');
    __write('file:///x/photo.json', '{"hello":"world"}');
    __write('file:///x/empty.json', '');
    const user = userEvent.setup();
    for (const uri of ['file:///x/photo.json', 'file:///x/empty.json']) {
      mockGetDocument.mockResolvedValue({ canceled: false, assets: [{ uri }] });
      await mount(S47Data);
      await user.press(await screen.findByText(S47_COPY.restoreFromBackup));
      expect(await screen.findByText(S47_COPY.restoreFailure)).toBeTruthy();
    }
    expect(await names()).toEqual(['Keep me']);
  });

  it('a file the picker returned but that is gone is refused calmly', async () => {
    mockGetDocument.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///x/missing.fallbackbak' }] });
    const user = userEvent.setup();
    await mount(S47Data);
    await user.press(await screen.findByText(S47_COPY.restoreFromBackup));
    expect(await screen.findByText(S47_COPY.restoreFailure)).toBeTruthy();
  });

  it('a backup from a NEWER app version is refused and nothing changes', async () => {
    await addTask('Keep me');
    const uri = await takeBackup();
    const file = JSON.parse(__read(uri));
    file.schemaVersion = 999;
    __write(uri, JSON.stringify(file));
    mockGetDocument.mockResolvedValue({ canceled: false, assets: [{ uri }] });
    const user = userEvent.setup();
    await mount(S47Data);
    await user.press(await screen.findByText(S47_COPY.restoreFromBackup));
    expect(await screen.findByText(S47_COPY.restoreFailure)).toBeTruthy();
    expect(await names()).toEqual(['Keep me']);
  });

  it('a backup from an OLDER version (no retired_day table) restores', async () => {
    await addTask('Old one');
    const uri = await takeBackup();
    const file = JSON.parse(__read(uri));
    delete file.tables.retired_day;
    file.schemaVersion = 7;
    __write(uri, JSON.stringify(file));
    await addTask('Newer one');
    mockGetDocument.mockResolvedValue({ canceled: false, assets: [{ uri }] });
    const user = userEvent.setup();
    await mount(S47Data);
    await user.press(await screen.findByText(S47_COPY.restoreFromBackup));
    await waitFor(() => expect(toast()?.message).toBe(S47_COPY.restoreSuccessToast));
    expect(await names()).toEqual(['Old one']);
  });

  it('cancelling the picker changes nothing: no banner, no toast, no restore', async () => {
    const spy = jest.spyOn(store, 'restore');
    mockGetDocument.mockResolvedValue({ canceled: true, assets: null });
    const user = userEvent.setup();
    await mount(S47Data);
    await user.press(await screen.findByText(S47_COPY.restoreFromBackup));
    await waitFor(() => expect(mockGetDocument).toHaveBeenCalled());
    expect(spy).not.toHaveBeenCalled();
    expect(screen.queryByText(S47_COPY.restoreFailure)).toBeNull();
    expect(toast()).toBeNull();
  });

  it('a picker that throws shows the calm banner, and "Try a different file" works afterwards', async () => {
    await addTask('A');
    const uri = await takeBackup();
    mockGetDocument.mockRejectedValueOnce(new Error('no document provider'));
    mockGetDocument.mockResolvedValueOnce({ canceled: false, assets: [{ uri }] });
    const user = userEvent.setup();
    await mount(S47Data);
    await user.press(await screen.findByText(S47_COPY.restoreFromBackup));
    await user.press(await screen.findByText(S47_COPY.tryDifferentFile));
    await waitFor(() => expect(toast()?.message).toBe(S47_COPY.restoreSuccessToast));
    expect(screen.queryByText(S47_COPY.restoreFailure)).toBeNull();
  });

  it('a restore that throws (not just refuses) is the calm banner', async () => {
    jest.spyOn(store, 'restore').mockRejectedValue(new Error('boom'));
    mockGetDocument.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///x/a' }] });
    const user = userEvent.setup();
    await mount(S47Data);
    await user.press(await screen.findByText(S47_COPY.restoreFromBackup));
    expect(await screen.findByText(S47_COPY.restoreFailure)).toBeTruthy();
  });

  it('a double tap on Restore opens one picker', async () => {
    mockGetDocument.mockImplementation(() => new Promise((r) => setTimeout(() => r({ canceled: true }), 30)));
    await mount(S47Data);
    const row = await screen.findByText(S47_COPY.restoreFromBackup);
    await fireEvent.press(row);
    await fireEvent.press(row);
    await waitFor(() => expect(mockGetDocument).toHaveBeenCalled());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(mockGetDocument).toHaveBeenCalledTimes(1);
  });

  it('after a failed restore the banner clears when a later restore works', async () => {
    await addTask('A');
    const good = await takeBackup();
    __write('file:///x/bad', 'nope');
    const user = userEvent.setup();
    await mount(S47Data);
    mockGetDocument.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///x/bad' }] });
    await user.press(await screen.findByText(S47_COPY.restoreFromBackup));
    await screen.findByText(S47_COPY.restoreFailure);
    mockGetDocument.mockResolvedValueOnce({ canceled: false, assets: [{ uri: good }] });
    await user.press(screen.getByText(S47_COPY.tryDifferentFile));
    await waitFor(() => expect(screen.queryByText(S47_COPY.restoreFailure)).toBeNull());
  });
});

describe('S47 erase all data', () => {
  async function seedLife() {
    const task = makeTask({ id: '00000000-0000-4000-8000-0000000000aa' as Id, name: 'Run' });
    await repos.tasks.insert(task, [...task.idealSteps, ...task.fallbackSteps]);
    await repos.settings.patch({ theme: 'dark', accent: 'berry', onboardingCompletedAt: '2026-01-01T00:00:00.000Z' as Instant, notifications: { master: true, dailyDigest: true } as NotificationPrefs });
    mockSecure.set('byo.apiKey', 'sk-secret');
    mockSecure.set('byo.baseUrl', 'https://x');
    mockSecure.set('fallback.sounds', 'off');
  }

  it('cancel: the sheet closes and nothing is touched', async () => {
    await seedLife();
    const user = userEvent.setup();
    await mount(S47Data);
    await user.press(await screen.findByText(S47_COPY.eraseRow));
    await user.press(await screen.findByText(S48_COPY.cancelButton));
    expect((await repos.tasks.list()).length).toBe(1);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockSecure.get('byo.apiKey')).toBe('sk-secret');
  });

  it('confirm: tasks, settings, key and saved choices are gone, onboarding is due again, and the splash is shown with nothing behind it', async () => {
    await seedLife();
    useSoundStore.setState({ on: false });
    const user = userEvent.setup();
    await mount(S47Data);
    await user.press(await screen.findByText(S47_COPY.eraseRow));
    await user.press(await screen.findByText(S48_COPY.eraseButton));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/splash'));
    expect(mockDismissAll).toHaveBeenCalled();
    expect(await repos.tasks.list({ includeDeleted: true })).toHaveLength(0);
    const s = await repos.settings.get();
    expect(s.onboardingCompletedAt).toBeNull();
    expect(s.theme).toBe('auto');
    expect(s.notifications.master).toBe(false);
    expect(mockSecure.has('byo.apiKey')).toBe(false);
    expect(mockSecure.has('fallback.sounds')).toBe(false);
    expect(useSoundStore.getState().on).toBe(true);
    expect(useAgentAccessStore.getState().enabled).toBe(false);
  });

  it('after an erase the store is usable at once: a new task can be added and read back', async () => {
    await seedLife();
    const user = userEvent.setup();
    await mount(S47Data);
    await user.press(await screen.findByText(S47_COPY.eraseRow));
    await user.press(await screen.findByText(S48_COPY.eraseButton));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/splash'));
    const t = makeTask({ id: '00000000-0000-4000-8000-0000000000bb' as Id, name: 'Fresh' });
    expect((await repos.tasks.insert(t, [...t.idealSteps, ...t.fallbackSteps])).ok).toBe(true);
    expect((await repos.tasks.list()).map((x) => x.name)).toEqual(['Fresh']);
  });

  it('a failed erase shows the calm retry banner, leaves the data alone, and Retry works', async () => {
    await seedLife();
    const spy = jest.spyOn(store, 'eraseAll').mockResolvedValueOnce(err({ code: 'WRITE_FAILED', message: 'x' }));
    const user = userEvent.setup();
    await mount(S47Data);
    await user.press(await screen.findByText(S47_COPY.eraseRow));
    await user.press(await screen.findByText(S48_COPY.eraseButton));
    expect(await screen.findByText(S48_COPY.midWipeFailure)).toBeTruthy();
    expect((await repos.tasks.list()).length).toBe(1);
    expect(mockReplace).not.toHaveBeenCalled();
    spy.mockImplementation(() => Promise.resolve(ok(undefined)));
    await user.press(within(screen.getByTestId('erase-data-sheet')).getByText('Retry'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/splash'));
  });
});
