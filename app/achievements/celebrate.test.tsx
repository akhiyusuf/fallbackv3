/**
 * House pattern (docs/MODULES.md top matter): @testing-library/react-native. Never mock
 * expo-router — real cross-screen navigation and search params are exercised via
 * `expo-router/testing-library`'s `renderRouter` against `M5_ROUTER_CONTEXT` instead (review
 * pass 1, blocking item 6).
 */
import { renderRouter, screen, userEvent } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

import { M5_ROUTER_CONTEXT } from '@/features/progress/testSupport/routerHarness';

const mockProgress: { current: unknown } = { current: { lifetimeXp: 700, level: { level: 7, title: 'Consistent', xpIntoLevel: 700, xpForLevel: 1000 } } };

jest.mock('@/queries', () => ({
  useProgress: () => ({ data: mockProgress.current }),
}));

describe('S28 — Level-Up Celebration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Force the "reduce motion" (calm cross-fade) confetti path so these tests never depend
    // on the particle-timing branch — reduce-motion behaviour is covered by Confetti's own
    // unit-level intent, not re-derived here.
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  });

  it("renders the level title from levelFor(xp).title — never a hardcoded string — Level 8 / Dependable", async () => {
    renderRouter(M5_ROUTER_CONTEXT, { initialUrl: '/achievements/celebrate?kind=level-up&xp=3900' });
    // 3900 lifetime XP crosses into level 8 (xpForLevel(l) = 100 + 150*(l-1), summed): the
    // DESIGN-PINNED level-8 title "Dependable" must appear, sourced only from `levelFor`,
    // never a literal here.
    expect(await screen.findByText("You're now Level 8.")).toBeTruthy();
    expect(screen.getByText('New title: Dependable.')).toBeTruthy();
  });

  it('the tenure-milestone variant never shows a "New title" subhead (a level concept, not tenure)', async () => {
    renderRouter(M5_ROUTER_CONTEXT, { initialUrl: '/achievements/celebrate?kind=tenure&badgeKey=tenure-1-year' });
    expect(await screen.findByText("You've reached 1 Year.")).toBeTruthy();
    expect(screen.queryByText(/New title:/)).toBeNull();
  });

  it('only the 1-year tenure tier renders the pinned "A full year" body — every other tier gets non-pinned, tone-matched copy', async () => {
    renderRouter(M5_ROUTER_CONTEXT, { initialUrl: '/achievements/celebrate?kind=tenure&badgeKey=tenure-1-week' });
    expect(await screen.findByText("You've reached 1 Week.")).toBeTruthy();
    expect(screen.queryByText(/A full year/)).toBeNull();
  });

  it('never renders the banned word "streak", not even in negation', async () => {
    renderRouter(M5_ROUTER_CONTEXT, { initialUrl: '/achievements/celebrate?kind=level-up&xp=150' });
    await screen.findByText("You're now Level 2.");
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.toLowerCase()).not.toContain('streak');
  });

  it('dismissing replaces to S27 (Achievements)', async () => {
    renderRouter(M5_ROUTER_CONTEXT, { initialUrl: '/achievements/celebrate?kind=level-up&xp=150' });
    await screen.findByText("You're now Level 2.");
    const user = userEvent.setup();
    await user.press(screen.getByText('Nice!'));
    expect(await screen.findByText('MARKER_ACHIEVEMENTS')).toBeTruthy();
  });
});
