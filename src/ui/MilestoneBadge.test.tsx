import { render, screen } from '@testing-library/react-native';
import { Sunrise } from 'lucide-react-native';

import { PALETTES } from '@/theme/tokens';

import { MilestoneBadge } from './MilestoneBadge';

describe('MilestoneBadge', () => {
  it('earned: gold-soft fill + celebration-gold border, per-badge icon, no Text inside the pill (Rule 4)', async () => {
    await render(<MilestoneBadge icon={Sunrise} earned label="7 days" />);
    const pills = screen.container.queryAll(
      (n) => n.type === 'View' && flattenBg(n.props.style) === PALETTES.light.goldSoft,
    );
    expect(pills.length).toBeGreaterThan(0);
    for (const pill of pills) {
      expect(pill.queryAll((n) => n.type === 'Text')).toHaveLength(0);
    }
    expect(screen.getByText('7 days')).toBeTruthy();
  });

  it('locked: neutral surface + border, Lock glyph, never the gold treatment', async () => {
    await render(<MilestoneBadge icon={Sunrise} earned={false} label="30 days" />);
    const goldPills = screen.container.queryAll(
      (n) => n.type === 'View' && flattenBg(n.props.style) === PALETTES.light.celebrationGold,
    );
    expect(goldPills).toHaveLength(0);
  });

  it('fires onPress when tappable and exposes an accessible name', async () => {
    const onPress = jest.fn();
    await render(<MilestoneBadge icon={Sunrise} earned label="7 days" onPress={onPress} accessibilityLabel="7 days, earned" />);
    expect(screen.getByRole('button', { name: '7 days, earned' })).toBeTruthy();
  });
});

function flattenBg(style: unknown): string | undefined {
  const arr = Array.isArray(style) ? style : [style];
  for (const s of arr) {
    const bg = (s as { backgroundColor?: string } | undefined)?.backgroundColor;
    if (bg) return bg;
  }
  return undefined;
}
