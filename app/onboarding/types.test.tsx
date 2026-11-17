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
  it('renders all four type tiles with their helper lines', async () => {
    await render(<S04OnboardingFourWaysToPlan />);
    for (const tile of S04_COPY.tiles) {
      expect(screen.getByText(tile.label)).toBeTruthy();
      expect(screen.getByText(tile.helper)).toBeTruthy();
    }
    expect(screen.getByLabelText('Step 3 of 7')).toBeTruthy();
  });

  // ALLSCREENS_1.md (S04) asks for a "NEW" tag on the To-dos & Notes tile; the reworked screen
  // has none. Asserted as the app does it now; whether the tag comes back is a human decision.
  it('currently has no "NEW" tag on the To-dos & Notes tile (open question, see the report)', async () => {
    await render(<S04OnboardingFourWaysToPlan />);
    expect(screen.queryByText('NEW')).toBeNull();
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
