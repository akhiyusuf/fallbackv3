/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

jest.mock('@/queries', () => ({ useUpdateSettings: () => ({ mutateAsync: jest.fn().mockResolvedValue({ ok: true }) }) }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

import S04OnboardingFourWaysToPlan from './types';
import { S04_COPY } from '@/features/onboarding/copy';

describe('S04 — Onboarding: Four ways to plan', () => {
  it('renders all four type tiles, including the To-dos & Notes "NEW" tag', async () => {
    await render(<S04OnboardingFourWaysToPlan />);
    for (const tile of S04_COPY.tiles) {
      expect(screen.getByText(tile.label)).toBeTruthy();
    }
    expect(screen.getByText('NEW')).toBeTruthy();
  });

  it('"Next" navigates to S05', async () => {
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S04OnboardingFourWaysToPlan />);
    await user.press(screen.getByLabelText('Next'));
    expect(push).toHaveBeenCalledWith('/onboarding/consistency');
    push.mockRestore();
  });
});
