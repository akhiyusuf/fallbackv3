/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

jest.mock('@/queries', () => ({ useUpdateSettings: () => ({ mutateAsync: jest.fn().mockResolvedValue({ ok: true }) }) }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

import S05OnboardingConsistencyNotPerfection from './consistency';
import { S05_COPY } from '@/features/onboarding/copy';

describe('S05 — Onboarding: Consistency, not perfection', () => {
  it('renders the sample stat block labeled EXAMPLE, never wired to real data', async () => {
    await render(<S05OnboardingConsistencyNotPerfection />);
    expect(screen.getByText(S05_COPY.eyebrow)).toBeTruthy();
    expect(screen.getByText(S05_COPY.bigNumeral)).toBeTruthy();
    expect(screen.getByText(S05_COPY.subLabel)).toBeTruthy();
  });

  it('the sample legend names only Ideal, Fallback and Off — never "Missed"', async () => {
    await render(<S05OnboardingConsistencyNotPerfection />);
    expect(screen.getByText(S05_COPY.legend.ideal)).toBeTruthy();
    expect(screen.getByText(S05_COPY.legend.fallback)).toBeTruthy();
    expect(screen.getByText(S05_COPY.legend.off)).toBeTruthy();
    expect(screen.queryByText(/missed/i)).toBeNull();
  });

  it('"Next" navigates to S06', async () => {
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S05OnboardingConsistencyNotPerfection />);
    await user.press(screen.getByLabelText('Next'));
    expect(push).toHaveBeenCalledWith('/onboarding/personalize');
    push.mockRestore();
  });
});
