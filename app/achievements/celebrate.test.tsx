/** House pattern: @testing-library/react-native, `await render`. Never mock expo-router. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { AccessibilityInfo } from 'react-native';

const mockParams: { current: Record<string, string | undefined> } = { current: {} };
const mockProgress: { current: unknown } = { current: { lifetimeXp: 700, level: { level: 7, title: 'Consistent', xpIntoLevel: 700, xpForLevel: 1000 } } };

jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router');
  return { ...actual, useLocalSearchParams: () => mockParams.current };
});

jest.mock('@/queries', () => ({
  useProgress: () => ({ data: mockProgress.current }),
}));

import S28LevelUpCelebration from './celebrate';

describe('S28 — Level-Up Celebration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams.current = {};
    // Force the "reduce motion" (calm cross-fade) confetti path so these tests never depend
    // on the particle-timing branch — reduce-motion behaviour is covered by Confetti's own
    // unit-level intent, not re-derived here.
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  });

  it("renders the level title from levelFor(xp).title — never a hardcoded string — Level 8 / Dependable", async () => {
    mockParams.current = { kind: 'level-up', xp: '3900' };
    await render(<S28LevelUpCelebration />);
    // 3900 lifetime XP crosses into level 8 (xpForLevel(l) = 100 + 150*(l-1), summed): the
    // DESIGN-PINNED level-8 title "Dependable" must appear, sourced only from `levelFor`,
    // never a literal here.
    expect(screen.getByText("You're now Level 8.")).toBeTruthy();
    expect(screen.getByText('New title: Dependable.')).toBeTruthy();
  });

  it('the tenure-milestone variant never shows a "New title" subhead (a level concept, not tenure)', async () => {
    mockParams.current = { kind: 'tenure', badgeKey: 'tenure-1-year' };
    await render(<S28LevelUpCelebration />);
    expect(screen.getByText("You've reached 1 Year.")).toBeTruthy();
    expect(screen.queryByText(/New title:/)).toBeNull();
  });

  it('never renders the banned word "streak", not even in negation', async () => {
    mockParams.current = { kind: 'level-up', xp: '150' };
    await render(<S28LevelUpCelebration />);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.toLowerCase()).not.toContain('streak');
  });

  it('dismissing replaces to S27 (Achievements)', async () => {
    const replaceSpy = jest.spyOn(router, 'replace').mockImplementation(() => undefined as never);
    mockParams.current = { kind: 'level-up', xp: '150' };
    const user = userEvent.setup();
    await render(<S28LevelUpCelebration />);
    await user.press(screen.getByText('Nice!'));
    expect(replaceSpy).toHaveBeenCalledWith('/achievements');
    replaceSpy.mockRestore();
  });
});
