/**
 * Settings that must still be there after the app is closed and opened again.
 *
 * A "restart" here means: every zustand store is put back to its start-up value, the screen
 * is unmounted, and the same saved settings are read again (as a cold start would read them
 * from SQLite). The saved settings live in `mockDb`, which merges a partial update the way
 * `settingsRepository.patch` does, so a stale screen snapshot cannot undo another change.
 */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';


import { useThemeStore } from '@/app-shell';
import { S42_COPY } from '@/features/settings/copy';
import { buildTheme, DEFAULT_ACCENT, ThemeContext } from '@/theme';
import { useAgentAccessStore } from '@/features/agents/store';

type Saved = Record<string, unknown> & {
  notifications: Record<string, unknown>;
  sync: Record<string, unknown>;
  widgets: unknown[];
};

const START: Saved = {
  theme: 'auto',
  accent: DEFAULT_ACCENT,
  notifications: {
    master: false,
    routineDue: true,
    eventStarting: true,
    courseDose: true,
    courseEndingSoon: true,
    gentleReentry: true,
    milestoneReached: true,
    dailyDigest: true,
    dailyDigestTime: '08:00',
  },
  sync: { enabled: false, lastSyncedAt: null, lastError: null },
  widgets: [],
};

const mockDb: { settings: Saved } = { settings: START };
const mockUpdateSettings = jest.fn(async (patch: Partial<Saved>) => {
  // Same merge rule as settingsRepository.patch: nested objects are merged into the saved row.
  mockDb.settings = {
    ...mockDb.settings,
    ...patch,
    notifications: { ...mockDb.settings.notifications, ...(patch.notifications ?? {}) },
    sync: { ...mockDb.settings.sync, ...(patch.sync ?? {}) },
  };
  return { ok: true, value: mockDb.settings };
});
const mockTasks: { current: { id: string; name: string }[] } = { current: [] };

jest.mock('@/queries', () => ({
  useSettings: () => ({ data: mockDb.settings, isLoading: false }),
  useTasks: () => ({ data: mockTasks.current }),
  useUpdateSettings: () => ({ mutateAsync: mockUpdateSettings }),
}));
jest.mock('@/services/notifications', () => ({ initNotificationsBridge: () => undefined }));
jest.mock('@/services/widgets', () => ({ initWidgetsBridge: () => undefined }));
jest.mock('@/features/widgets/WidgetPreviews', () => ({ WidgetPreviews: () => null }));
jest.mock('@/features/today/useTodayRows', () => ({ useTodayRows: () => ({ rows: [] }) }));
jest.mock('@/app-shell', () => {
  const actual = jest.requireActual('@/app-shell');
  return { ...actual, useToastStore: (selector: (s: { show: () => void }) => unknown) => selector({ show: () => undefined }) };
});

import S42NotificationsSettings from './notifications';
import S45AccountAndSync from './sync';
import S43ThemeAndAccent from './theme';
import S46Widgets from './widgets';

/** The theme screen needs the live theme provided, as `app/_layout.tsx` does in the app. */
function renderTheme() {
  function Harness() {
    const mode = useThemeStore((s) => s.mode);
    const accent = useThemeStore((s) => s.accent);
    return <ThemeContext.Provider value={buildTheme(mode === 'dark' ? 'dark' : 'light', accent)}><S43ThemeAndAccent /></ThemeContext.Provider>;
  }
  return render(<Harness />);
}

/** What a cold start looks like: every store back at its start-up value, nothing cached. */
function restart() {
  useThemeStore.setState({ mode: 'auto', accent: DEFAULT_ACCENT });
  useAgentAccessStore.setState({ enabled: false, agents: [] });
}

function isSelected(element: { props: { accessibilityState?: { selected?: boolean; checked?: boolean } } }): boolean {
  return !!(element.props.accessibilityState?.selected ?? element.props.accessibilityState?.checked);
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('settings are still there after a restart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.settings = JSON.parse(JSON.stringify(START)) as Saved;
    mockTasks.current = [];
    restart();
  });

  describe('notifications (S42)', () => {
    it('turning on "Allow notifications" is shown as on after a restart', async () => {
      const user = userEvent.setup();
      const first = await render(<S42NotificationsSettings />);
      await user.press(screen.getByLabelText('Allow notifications, off'));
      await waitFor(() => expect(mockDb.settings.notifications.master).toBe(true));
      first.unmount();
      await settle();

      restart();
      await render(<S42NotificationsSettings />);
      expect(screen.getByLabelText('Allow notifications, on')).toBeTruthy();
    });

    it('two quick toggles both stick, even though the screen has not refetched between them', async () => {
      mockDb.settings = { ...START, notifications: { ...START.notifications, master: true } };
      const user = userEvent.setup();
      const first = await render(<S42NotificationsSettings />);
      // No re-render in between: the second press still holds the snapshot from before the first.
      await user.press(screen.getByLabelText(`${S42_COPY.reminderRows.routineDue}, on`));
      await user.press(screen.getByLabelText(`${S42_COPY.reminderRows.eventStarting}, on`));
      await waitFor(() => expect(mockUpdateSettings).toHaveBeenCalledTimes(2));
      await settle();
      expect(mockDb.settings.notifications.routineDue).toBe(false);
      expect(mockDb.settings.notifications.eventStarting).toBe(false);
      first.unmount();
      await settle();

      restart();
      await render(<S42NotificationsSettings />);
      expect(screen.getByLabelText(`${S42_COPY.reminderRows.routineDue}, off`)).toBeTruthy();
      expect(screen.getByLabelText(`${S42_COPY.reminderRows.eventStarting}, off`)).toBeTruthy();
    });

    it('the digest time saved before a restart is shown again', async () => {
      mockDb.settings = { ...START, notifications: { ...START.notifications, master: true, dailyDigest: true, dailyDigestTime: '18:00' } };
      await render(<S42NotificationsSettings />);
      expect(screen.getByLabelText(/^Digest time, /)).toBeTruthy();
      expect(screen.getAllByText('6:00 PM').length).toBeGreaterThan(0);
    });
  });

  describe('account and sync (S45)', () => {
    it('sync that was turned on is shown as on after a restart', async () => {
      mockDb.settings = { ...START, sync: { enabled: true, lastSyncedAt: null, lastError: null } };
      await render(<S45AccountAndSync />);
      expect(screen.getByLabelText(/, on$/)).toBeTruthy();
    });
  });

  describe('theme and accent (S43)', () => {
    it('the saved look (dark, amber) is restored when the screen is the first one opened', async () => {
      mockDb.settings = { ...START, theme: 'dark', accent: 'hue-52' };
      await renderTheme();
      await waitFor(() => expect(useThemeStore.getState().mode).toBe('dark'));
      expect(useThemeStore.getState().accent).toBe('hue-52');
      expect(isSelected(screen.getByRole('tab', { name: 'Dark' }))).toBe(true);
      expect(screen.getByLabelText(/^Amber, colour \d+ of \d+, selected$/)).toBeTruthy();
    });

    it('a theme picked before a restart is still picked after it', async () => {
      const user = userEvent.setup();
      const first = await renderTheme();
      await user.press(screen.getByRole('tab', { name: 'Light' }));
      await waitFor(() => expect(mockDb.settings.theme).toBe('light'));
      first.unmount();
      await settle();

      restart();
      await renderTheme();
      await waitFor(() => expect(useThemeStore.getState().mode).toBe('light'));
      expect(isSelected(screen.getByRole('tab', { name: 'Light' }))).toBe(true);
    });
  });

  describe('widgets (S46)', () => {
    it('a widget set to a fixed task shows that task after a restart', async () => {
      mockTasks.current = [
        { id: 't1', name: 'Morning workout' },
        { id: 't2', name: 'Meditate' },
      ];
      mockDb.settings = { ...START, widgets: [{ size: 'small-one-task', mode: 'fixed-task', fixedTaskId: 't2' }] };
      await render(<S46Widgets />);
      expect(screen.getByText('Meditate')).toBeTruthy();
    });
  });
});
