/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

jest.mock('@/queries', () => ({ useUpdateSettings: () => ({ mutateAsync: jest.fn().mockResolvedValue({ ok: true }) }) }));

// In-memory secure store: the concept step both writes the resume pointer and reads it back.
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

import S03OnboardingConcept from './concept';
import { S03_COPY } from '@/features/onboarding/copy';

const PROGRESS_KEY = 'fallback.onboarding.progress';

describe('S03 — Onboarding: Concept', () => {
  beforeEach(() => mockSecureStore.clear());

  it('renders the ideal/fallback worked example and the privacy promise verbatim', async () => {
    await render(<S03OnboardingConcept />);
    expect(screen.getByText(S03_COPY.headline)).toBeTruthy();
    expect(screen.getByText(S03_COPY.idealText)).toBeTruthy();
    expect(screen.getByText(S03_COPY.fallbackText)).toBeTruthy();
    expect(screen.getByText(S03_COPY.privacy)).toBeTruthy();
  });

  it('is the first step: it shows "Step 1 of 7" and has no Back control', async () => {
    await render(<S03OnboardingConcept />);
    expect(screen.getByLabelText('Step 1 of 7')).toBeTruthy();
    expect(screen.queryByLabelText('Back')).toBeNull();
  });

  it('"Next" navigates to S02 (the hook), the second step', async () => {
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S03OnboardingConcept />);
    await user.press(screen.getByLabelText('Next'));
    expect(push).toHaveBeenCalledWith('/onboarding/hook');
    push.mockRestore();
  });

  it('records itself as the saved place on mount', async () => {
    await render(<S03OnboardingConcept />);
    await waitFor(() => expect(mockSecureStore.get(PROGRESS_KEY)).toBe('/onboarding/concept'));
  });

  it('resume: a saved place further on silently redirects instead of showing the concept step', async () => {
    mockSecureStore.set(PROGRESS_KEY, '/onboarding/types');
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    await render(<S03OnboardingConcept />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/onboarding/types'));
    expect(screen.queryByText(S03_COPY.headline)).toBeNull();
    replace.mockRestore();
  });
});
