/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render } from '@testing-library/react-native';

// The root layout only wires providers and the Stack; the screens under test are not rendered.
jest.mock('expo-router', () => ({ Stack: () => null }));
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
    useThemeStore: (selector: (s: { mode: string; accent: string }) => unknown) => selector({ mode: 'auto', accent: 'forge-orange' }),
  };
});
const mockInitNotificationsBridge = jest.fn();
jest.mock('@/services/notifications', () => ({ initNotificationsBridge: () => mockInitNotificationsBridge() }));
const mockInitWidgetsBridge = jest.fn();
jest.mock('@/services/widgets', () => ({ initWidgetsBridge: () => mockInitWidgetsBridge() }));
jest.mock('@/ui/Toast', () => ({ Toast: () => null }));
jest.mock('@/features/progress/CelebrationHost', () => ({ CelebrationHost: () => null }));
jest.mock('@/features/task/AddMenuHost', () => ({ AddMenuHost: () => null }));

import RootLayout from './_layout';

describe('root layout (app/_layout.tsx)', () => {
  beforeEach(() => jest.clearAllMocks());

  // CR-5: the app-lifetime bridges are armed once here, so a session that never opens an
  // onboarding screen still arms reminders and publishes the widget snapshot.
  it('arms the notification and widget bridges at boot', async () => {
    await render(<RootLayout />);
    expect(mockInitNotificationsBridge).toHaveBeenCalled();
    expect(mockInitWidgetsBridge).toHaveBeenCalled();
  });
});
