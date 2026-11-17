/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { ACHIEVEMENTS } from '@/domain';
import { useCelebrationStore } from '@/app-shell/stores/celebration';
import { play } from '@/services/sfx';

import { CelebrationHost } from './CelebrationHost';

jest.mock('@/services/sfx', () => ({ play: jest.fn() }));

function labelOf(key: string): string {
  const def = ACHIEVEMENTS.find((a) => a.key === key);
  if (!def) throw new Error(`no achievement ${key}`);
  return def.label;
}

describe('CelebrationHost (milestone pop-up)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCelebrationStore.setState({ queue: [] });
    // Calm cross-fade confetti path, so the particle timers never run in these tests.
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  });

  it('shows nothing when the queue is empty', async () => {
    await render(<CelebrationHost />);
    expect(screen.queryByText('Nice')).toBeNull();
  });

  it('shows a queued badge, then the next queued badge after dismissing the first', async () => {
    useCelebrationStore.setState({
      queue: [
        { kind: 'badge', badgeKey: 'tenure-1-year' },
        { kind: 'badge', badgeKey: 'showing-up-7' },
      ],
    });
    const user = userEvent.setup();
    await render(<CelebrationHost />);

    expect(screen.getByText("You've reached 1 Year.")).toBeTruthy();
    expect(screen.queryByText(`Badge earned: ${labelOf('showing-up-7')}.`)).toBeNull();
    expect(play).toHaveBeenCalledWith('badge_earned', 600);

    await user.press(screen.getByLabelText('Nice'));

    await waitFor(() => expect(screen.getByText(`Badge earned: ${labelOf('showing-up-7')}.`)).toBeTruthy());
    expect(screen.queryByText("You've reached 1 Year.")).toBeNull();
    expect(useCelebrationStore.getState().queue).toEqual([{ kind: 'badge', badgeKey: 'showing-up-7' }]);

    await user.press(screen.getByLabelText('Nice'));
    expect(useCelebrationStore.getState().queue).toEqual([]);
    expect(screen.queryByLabelText('Nice')).toBeNull();
  });

  it('a level-up shows the level title from levelFor(xp), never a hardcoded title', async () => {
    useCelebrationStore.setState({ queue: [{ kind: 'level-up', lifetimeXp: 3900 }] });
    await render(<CelebrationHost />);
    expect(screen.getByText("You're now Level 8.")).toBeTruthy();
    expect(screen.getByText('New title: Dependable.')).toBeTruthy();
  });

  it('the tenure-milestone variant never shows a "New title" subhead (a level concept, not tenure)', async () => {
    useCelebrationStore.setState({ queue: [{ kind: 'badge', badgeKey: 'tenure-1-year' }] });
    await render(<CelebrationHost />);
    expect(screen.getByText("You've reached 1 Year.")).toBeTruthy();
    expect(screen.queryByText(/New title:/)).toBeNull();
  });

  it('only the 1-year tenure tier renders the pinned "A full year" body; other tiers get non-pinned copy', async () => {
    useCelebrationStore.setState({ queue: [{ kind: 'badge', badgeKey: 'tenure-1-week' }] });
    await render(<CelebrationHost />);
    expect(screen.getByText("You've reached 1 Week.")).toBeTruthy();
    expect(screen.queryByText(/A full year/)).toBeNull();
  });

  it('the 1-year tier shows its pinned body', async () => {
    useCelebrationStore.setState({ queue: [{ kind: 'badge', badgeKey: 'tenure-1-year' }] });
    await render(<CelebrationHost />);
    expect(screen.getByText(/A full year with Fallback/)).toBeTruthy();
  });

  it('never fabricates the pinned "100 tasks done" claim for a level-up', async () => {
    useCelebrationStore.setState({ queue: [{ kind: 'level-up', lifetimeXp: 150 }] });
    await render(<CelebrationHost />);
    expect(screen.getByText("You're now Level 2.")).toBeTruthy();
    expect(screen.queryByText(/100 tasks done/)).toBeNull();
  });

  it('never renders the banned word "streak", not even in negation', async () => {
    useCelebrationStore.setState({ queue: [{ kind: 'level-up', lifetimeXp: 150 }] });
    await render(<CelebrationHost />);
    await screen.findByText("You're now Level 2.");
    expect(JSON.stringify(screen.toJSON()).toLowerCase()).not.toContain('streak');
  });
});
