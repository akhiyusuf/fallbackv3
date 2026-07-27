/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockUpdateSettingsMutateAsync = jest.fn().mockResolvedValue({ ok: true });
jest.mock('@/queries', () => ({
  useUpdateSettings: () => ({ mutateAsync: mockUpdateSettingsMutateAsync }),
}));

// Local mock — expo-secure-store's automock behaviour is undocumented here; a deterministic
// in-memory store is what the resume-redirect tests need (same "stays local" reasoning as
// the house pattern's `expo-crypto` note).
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

import S02OnboardingHook from './hook';
import { S02_COPY } from '@/features/onboarding/copy';

describe('S02 — Onboarding: Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecureStore.clear();
  });

  it('default: renders the headline, body, Skip and Next', async () => {
    await render(<S02OnboardingHook />);
    await waitFor(() => expect(screen.getByText(S02_COPY.headline)).toBeTruthy());
    expect(screen.getByText(S02_COPY.body)).toBeTruthy();
    expect(screen.getByLabelText('Skip onboarding')).toBeTruthy();
    expect(screen.getByLabelText('Next')).toBeTruthy();
  });

  it('"Next" navigates to S03', async () => {
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S02OnboardingHook />);
    await waitFor(() => expect(screen.getByText(S02_COPY.headline)).toBeTruthy());
    await user.press(screen.getByLabelText('Next'));
    expect(push).toHaveBeenCalledWith('/onboarding/concept');
    push.mockRestore();
  });

  it('"Skip" persists onboardingCompletedAt and routes straight to Today', async () => {
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S02OnboardingHook />);
    await waitFor(() => expect(screen.getByText(S02_COPY.headline)).toBeTruthy());
    await user.press(screen.getByLabelText('Skip onboarding'));
    await waitFor(() => expect(mockUpdateSettingsMutateAsync).toHaveBeenCalledWith({ onboardingCompletedAt: expect.any(String) }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/today'));
    replace.mockRestore();
  });

  it('resume: a saved progress pointer past S02 silently redirects instead of rendering S02', async () => {
    mockSecureStore.set('fallback.onboarding.progress', '/onboarding/personalize');
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    await render(<S02OnboardingHook />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/onboarding/personalize'));
    expect(screen.queryByText(S02_COPY.headline)).toBeNull();
    replace.mockRestore();
  });
});
