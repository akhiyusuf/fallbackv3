/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useEntitlementStore } from '@/app-shell';

const mockSettingsData: { current: unknown } = { current: undefined };
const mockProgressData: { current: unknown } = { current: undefined };
const mockConsistencyData: { current: unknown; isError?: boolean } = { current: undefined };
jest.mock('@/queries', () => ({
  useSettings: () => ({ data: mockSettingsData.current, isLoading: mockSettingsData.current === undefined }),
  useProgress: () => ({ data: mockProgressData.current, isLoading: mockProgressData.current === undefined }),
  useConsistency: () => ({ data: mockConsistencyData.current, isError: !!mockConsistencyData.isError, refetch: jest.fn() }),
}));

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
    expect(screen.getByText('Maya')).toBeTruthy();
    expect(screen.getByText('Level 7 · Consistent')).toBeTruthy();
    expect(screen.getByText('87% showing up')).toBeTruthy();
    expect(screen.getByText('Badges')).toBeTruthy();
    expect(screen.getByText('Help & about')).toBeTruthy();
  });

  it('empty (new user): renders "Level 1 · Getting started" and "no data yet", never "0%"', async () => {
    mockSettingsData.current = { notifications: { master: false } };
    mockProgressData.current = { lifetimeXp: 0, level: { level: 1, title: 'Getting started', xpIntoLevel: 0, xpForLevel: 100 } };
    mockConsistencyData.current = { percent: null };
    await render(<S41SettingsHome />);
    expect(screen.getByText('Level 1 · Getting started')).toBeTruthy();
    expect(screen.getByText('no data yet')).toBeTruthy();
    expect(screen.queryByText('0% showing up')).toBeNull();
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

  it('tapping "Theme & accent" navigates to S43', async () => {
    mockSettingsData.current = { notifications: { master: true } };
    mockProgressData.current = { lifetimeXp: 500, level: LEVEL7 };
    mockConsistencyData.current = { percent: 87 };
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S41SettingsHome />);
    await user.press(screen.getByText('Theme & accent'));
    expect(push).toHaveBeenCalledWith('/settings/theme');
    push.mockRestore();
  });
});
