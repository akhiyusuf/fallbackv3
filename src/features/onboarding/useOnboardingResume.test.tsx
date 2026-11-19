/** The resume pointer follows the step the person is on, including when they come Back to one. */
import { render } from '@testing-library/react-native';
import { NavigationContext } from 'expo-router/build/react-navigation/core';

const mockSecureStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: (key: string) => Promise.resolve(mockSecureStore.get(key) ?? null),
  setItemAsync: (key: string, value: string) => {
    mockSecureStore.set(key, value);
    return Promise.resolve();
  },
  deleteItemAsync: (key: string) => {
    mockSecureStore.delete(key);
    return Promise.resolve();
  },
}));

import { getOnboardingProgress } from './progress';
import { useOnboardingStepMarker } from './useOnboardingResume';

function Step({ route }: { route: string }) {
  useOnboardingStepMarker(route);
  return null;
}

describe('useOnboardingStepMarker', () => {
  beforeEach(() => mockSecureStore.clear());

  it('records its step when it appears', async () => {
    await render(<Step route="/onboarding/types" />);
    expect(await getOnboardingProgress()).toBe('/onboarding/types');
  });

  it('records its step again when it comes back into view (Back to a step that stayed mounted)', async () => {
    const listeners: Record<string, () => void> = {};
    const navigation = { addListener: (name: string, fn: () => void) => ((listeners[name] = fn), () => delete listeners[name]) };
    await render(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <NavigationContext.Provider value={navigation as any}>
        <Step route="/onboarding/types" />
      </NavigationContext.Provider>,
    );
    mockSecureStore.set('fallback.onboarding.progress', '/onboarding/personalize');
    listeners.focus?.();
    expect(await getOnboardingProgress()).toBe('/onboarding/types');
  });
});
