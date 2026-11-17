/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useEntitlementStore } from '@/app-shell';
import * as audio from 'expo-audio';
import { useSoundStore } from '@/services/sfx';
import { SOUND_FILES } from '@/services/sfx/sounds';

const mockSettingsData: { current: unknown } = { current: undefined };
const mockProgressData: { current: unknown } = { current: undefined };
const mockConsistencyData: { current: unknown; isError?: boolean } = { current: undefined };
jest.mock('@/queries', () => ({
  useSettings: () => ({ data: mockSettingsData.current, isLoading: mockSettingsData.current === undefined }),
  useProgress: () => ({ data: mockProgressData.current, isLoading: mockProgressData.current === undefined }),
  useConsistency: () => ({ data: mockConsistencyData.current, isError: !!mockConsistencyData.isError, refetch: jest.fn() }),
}));

const mockInitNotificationsBridge = jest.fn();
jest.mock('@/services/notifications', () => ({ initNotificationsBridge: () => mockInitNotificationsBridge() }));
const mockInitWidgetsBridge = jest.fn();
jest.mock('@/services/widgets', () => ({ initWidgetsBridge: () => mockInitWidgetsBridge() }));


import S41SettingsHome from './index';

const LEVEL7 = { level: 7, title: 'Consistent', xpIntoLevel: 0, xpForLevel: 100 };

describe('S41 — Settings Home', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsData.current = undefined;
    mockProgressData.current = undefined;
    mockConsistencyData.current = undefined;
    mockConsistencyData.isError = false;
    useEntitlementStore.setState({
      entitlement: { source: 'none', plan: null, status: 'none', renewsOn: null, trialEndsOn: null, hasByoKey: false, byoSupportsTranscription: false },
    });
  });

  it('default: renders the profile card and every section row', async () => {
    mockSettingsData.current = { notifications: { master: true } };
    mockProgressData.current = { lifetimeXp: 500, level: LEVEL7 };
    mockConsistencyData.current = { percent: 87 };
    await render(<S41SettingsHome />);
    expect(screen.getByLabelText(/^Your progress\. Level 7/)).toBeTruthy();
    expect(screen.getByText('Level 7 · Consistent')).toBeTruthy();
    expect(screen.getByText('87% showing up, last 30 days')).toBeTruthy();
    expect(screen.getByText('Badges')).toBeTruthy();
    expect(screen.getByText('Help and about')).toBeTruthy();
  });

  it('empty (new user): renders "Level 1 · Getting started" and "No data yet", never "0%"', async () => {
    mockSettingsData.current = { notifications: { master: false } };
    mockProgressData.current = { lifetimeXp: 0, level: { level: 1, title: 'Getting started', xpIntoLevel: 0, xpForLevel: 100 } };
    mockConsistencyData.current = { percent: null };
    await render(<S41SettingsHome />);
    expect(screen.getByText('Level 1 · Getting started')).toBeTruthy();
    expect(screen.getByText('No data yet')).toBeTruthy();
    expect(screen.queryByText(/^0%/)).toBeNull();
  });

  it('error: the stat line degrades to an inline retry, the rest of the list stays usable', async () => {
    mockSettingsData.current = { notifications: { master: true } };
    mockProgressData.current = { lifetimeXp: 500, level: LEVEL7 };
    mockConsistencyData.isError = true;
    await render(<S41SettingsHome />);
    expect(screen.getByText("Couldn't load your stats")).toBeTruthy();
    expect(screen.getByText('Notifications')).toBeTruthy();
  });

  it('the Notifications row badge reflects the F14 master toggle', async () => {
    mockSettingsData.current = { notifications: { master: true } };
    mockProgressData.current = { lifetimeXp: 500, level: LEVEL7 };
    mockConsistencyData.current = { percent: 87 };
    await render(<S41SettingsHome />);
    expect(screen.getByText('On')).toBeTruthy();
  });

  it('tapping "Theme" (the Theme & accent row) navigates to S43', async () => {
    mockSettingsData.current = { notifications: { master: true } };
    mockProgressData.current = { lifetimeXp: 500, level: LEVEL7 };
    mockConsistencyData.current = { percent: 87 };
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S41SettingsHome />);
    await user.press(screen.getByText('Theme'));
    expect(push).toHaveBeenCalledWith('/settings/theme');
    push.mockRestore();
  });

  describe('Sounds switch', () => {
    // Record every player the real sound module creates, and which of them actually started.
    const players: { src: unknown; play: jest.Mock }[] = [];
    function startedSounds(): unknown[] {
      return players.filter((p) => p.play.mock.calls.length > 0).map((p) => p.src);
    }

    beforeEach(() => {
      (audio.createAudioPlayer as unknown as jest.Mock).mockImplementation((src: unknown) => {
        const player = { src, play: jest.fn(), pause: jest.fn(), remove: jest.fn(), seekTo: jest.fn(() => Promise.resolve()), volume: 1 };
        players.push(player);
        return player;
      });
      useSoundStore.setState({ on: true });
      mockSettingsData.current = { notifications: { master: true } };
      mockProgressData.current = { lifetimeXp: 500, level: LEVEL7 };
      mockConsistencyData.current = { percent: 87 };
    });

    it('starts on, and turning it off changes the store and is silent', async () => {
      const user = userEvent.setup();
      await render(<S41SettingsHome />);
      expect(screen.getByLabelText('Sounds, on')).toBeTruthy();
      await user.press(screen.getByLabelText('Sounds, on'));
      expect(useSoundStore.getState().on).toBe(false);
      expect(startedSounds()).toEqual([]);
      expect(screen.getByLabelText('Sounds, off')).toBeTruthy();
    });

    it('turning it back on changes the store and answers with exactly one switch sound', async () => {
      useSoundStore.setState({ on: false });
      const user = userEvent.setup();
      await render(<S41SettingsHome />);
      await user.press(screen.getByLabelText('Sounds, off'));
      expect(useSoundStore.getState().on).toBe(true);
      expect(startedSounds()).toEqual([SOUND_FILES.toggle_on]);
    });
  });

  it('mounting arms both the notifications and widgets bridges (review pass 1, blocking item 1)', async () => {
    mockSettingsData.current = { notifications: { master: true } };
    mockProgressData.current = { lifetimeXp: 500, level: LEVEL7 };
    mockConsistencyData.current = { percent: 87 };
    await render(<S41SettingsHome />);
    expect(mockInitNotificationsBridge).toHaveBeenCalled();
    expect(mockInitWidgetsBridge).toHaveBeenCalled();
  });
});
