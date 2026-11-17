/**
 * House pattern (docs/MODULES.md top matter): @testing-library/react-native. Never mock
 * expo-router — real cross-screen navigation and search params are exercised via
 * `expo-router/testing-library`'s `renderRouter` against `M5_ROUTER_CONTEXT` instead (review
 * pass 1, blocking item 6).
 *
 * This route only QUEUES a celebration and sends the person back to Achievements. What the
 * pop-up looks like is covered by src/features/progress/CelebrationHost.test.tsx.
 */
import { renderRouter, screen } from 'expo-router/testing-library';

import { useCelebrationStore } from '@/app-shell/stores/celebration';
import { M5_ROUTER_CONTEXT } from '@/features/progress/testSupport/routerHarness';

const mockProgress: { current: unknown } = { current: { lifetimeXp: 700, level: { level: 7, title: 'Consistent', xpIntoLevel: 700, xpForLevel: 1000 } } };

jest.mock('@/queries', () => ({
  useProgress: () => ({ data: mockProgress.current, isLoading: false }),
}));

describe('S28 — Level-Up Celebration (route)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCelebrationStore.setState({ queue: [] });
  });

  it('a level-up queues a level-up celebration with the XP in the URL, then returns to Achievements', async () => {
    await renderRouter(M5_ROUTER_CONTEXT, { initialUrl: '/achievements/celebrate?kind=level-up&xp=3900' });
    expect(await screen.findByText('MARKER_ACHIEVEMENTS')).toBeTruthy();
    expect(useCelebrationStore.getState().queue).toEqual([{ kind: 'level-up', lifetimeXp: 3900 }]);
  });

  it('a level-up without an XP param falls back to the lifetime XP from progress', async () => {
    await renderRouter(M5_ROUTER_CONTEXT, { initialUrl: '/achievements/celebrate?kind=level-up' });
    expect(await screen.findByText('MARKER_ACHIEVEMENTS')).toBeTruthy();
    expect(useCelebrationStore.getState().queue).toEqual([{ kind: 'level-up', lifetimeXp: 700 }]);
  });

  it('a tenure milestone queues a badge celebration for its badge key, then returns to Achievements', async () => {
    await renderRouter(M5_ROUTER_CONTEXT, { initialUrl: '/achievements/celebrate?kind=tenure&badgeKey=tenure-1-year' });
    expect(await screen.findByText('MARKER_ACHIEVEMENTS')).toBeTruthy();
    expect(useCelebrationStore.getState().queue).toEqual([{ kind: 'badge', badgeKey: 'tenure-1-year' }]);
  });
});
