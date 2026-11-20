/**
 * Round 3 spec coverage (review/EDGE-BRIEF.md). PRD F8 and ALLSCREENS_1.md S43: "Auto switches
 * live with the OS". No test covered the live switch or the explicit Light/Dark override at the
 * root, and `resolveScheme` had no unit test. House pattern: RNTL v14.
 */
import { render, screen } from '@testing-library/react-native';

const mockOs: { current: 'light' | 'dark' | null } = { current: 'light' };
const mockMode: { current: 'auto' | 'light' | 'dark' } = { current: 'auto' };

// The root Stack is replaced by a probe that prints the scheme the screens below would receive.
jest.mock('expo-router', () => ({
  Stack: () => {
    const { useTheme } = require('@/theme');
    const { Text } = require('react-native');
    const t = useTheme();
    return require('react').createElement(Text, null, `scheme:${t.scheme}`);
  },
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-gesture-handler', () => {
  const { View } = jest.requireActual('react-native');
  return { GestureHandlerRootView: View };
});
jest.mock('@/app-shell', () => {
  const { View } = jest.requireActual('react-native');
  return {
    ErrorBoundary: View,
    useAppBootstrap: () => undefined,
    useDayRollover: () => undefined,
    useThemeStore: (selector: (s: { mode: string; accent: string }) => unknown) => selector({ mode: mockMode.current, accent: 'forge-orange' }),
  };
});
jest.mock('@/app-shell/repairs', () => ({ useForegroundRepairs: () => undefined }));
jest.mock('@/services/notifications', () => ({ initNotificationsBridge: () => undefined }));
jest.mock('@/services/widgets', () => ({ initWidgetsBridge: () => undefined }));
jest.mock('@/ui/Toast', () => ({ Toast: () => null }));
jest.mock('@/features/progress/CelebrationHost', () => ({ CelebrationHost: () => null }));
jest.mock('@/features/task/AddMenuHost', () => ({ AddMenuHost: () => null }));

import RootLayout from '../app/_layout';
import { resolveScheme } from '@/theme';

describe('S43 — Auto follows the OS live; explicit modes override it (spec coverage, F8)', () => {
  beforeEach(() => {
    mockOs.current = 'light';
    mockMode.current = 'auto';
    // Swap the hook on the react-native export for this suite only; spreading the real module
    // would evaluate its native getters (DevMenu) and fail to load.
    jest.spyOn(require('react-native'), 'useColorScheme', 'get').mockReturnValue(() => mockOs.current);
  });
  afterEach(() => jest.restoreAllMocks());

  it('Auto with the OS in dark mode renders the dark scheme', async () => {
    mockOs.current = 'dark';
    await render(<RootLayout />);
    expect(screen.getByText('scheme:dark')).toBeTruthy();
  });

  it('Auto re-themes live when the OS flips while the app is open, with no relaunch', async () => {
    mockOs.current = 'light';
    const view = await render(<RootLayout />);
    expect(screen.getByText('scheme:light')).toBeTruthy();
    mockOs.current = 'dark';
    await view.rerender(<RootLayout />);
    expect(screen.getByText('scheme:dark')).toBeTruthy();
    mockOs.current = 'light';
    await view.rerender(<RootLayout />);
    expect(screen.getByText('scheme:light')).toBeTruthy();
  });

  it('an explicit Light choice stays light even when the OS is dark', async () => {
    mockMode.current = 'light';
    mockOs.current = 'dark';
    await render(<RootLayout />);
    expect(screen.getByText('scheme:light')).toBeTruthy();
  });

  it('an explicit Dark choice stays dark even when the OS is light', async () => {
    mockMode.current = 'dark';
    mockOs.current = 'light';
    await render(<RootLayout />);
    expect(screen.getByText('scheme:dark')).toBeTruthy();
  });

  it('Auto with no OS answer (unknown scheme) falls back to light, never crashes', async () => {
    mockOs.current = null;
    await render(<RootLayout />);
    expect(screen.getByText('scheme:light')).toBeTruthy();
  });

  it('resolveScheme: an explicit mode ignores the OS, Auto follows it, unknown OS reads as light', () => {
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
    expect(resolveScheme('auto', 'dark')).toBe('dark');
    expect(resolveScheme('auto', null)).toBe('light');
  });
});
