/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

jest.mock('@/queries', () => ({ useUpdateSettings: () => ({ mutateAsync: jest.fn().mockResolvedValue({ ok: true }) }) }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

import S03OnboardingConcept from './concept';
import { S03_COPY } from '@/features/onboarding/copy';

describe('S03 — Onboarding: Concept', () => {
  it('renders the ideal/fallback worked example and the privacy promise verbatim', async () => {
    await render(<S03OnboardingConcept />);
    expect(screen.getByText(S03_COPY.headline)).toBeTruthy();
    expect(screen.getByText(S03_COPY.idealLabel)).toBeTruthy();
    expect(screen.getByText(S03_COPY.fallbackLabel)).toBeTruthy();
    expect(screen.getByText(S03_COPY.privacy)).toBeTruthy();
  });

  it('"Next" navigates to S04', async () => {
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S03OnboardingConcept />);
    await user.press(screen.getByLabelText('Next'));
    expect(push).toHaveBeenCalledWith('/onboarding/types');
    push.mockRestore();
  });
});
