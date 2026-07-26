import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { PALETTES } from '@/theme/tokens';
import { useToastStore } from '@/app-shell/stores/toast';

import { Toast } from './Toast';

const DANGER_FAMILY = new Set([PALETTES.light.danger, PALETTES.light.dangerDeep, PALETTES.light.dangerSoft]);

describe('Toast', () => {
  afterEach(async () => {
    await act(async () => useToastStore.getState().hide());
  });

  it('renders nothing when the store holds no toast', async () => {
    await render(<Toast />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders the store message as an alert once shown', async () => {
    await render(<Toast />);
    await act(async () => useToastStore.getState().show('Today marked off — nothing due counts against your %.'));
    expect(screen.getByRole('alert', { name: 'Today marked off — nothing due counts against your %.' })).toBeTruthy();
  });

  it('dismisses on tap', async () => {
    await render(<Toast />);
    await act(async () => useToastStore.getState().show('Couldn’t save that — try again.'));
    await fireEvent.press(screen.getByRole('alert'));
    expect(useToastStore.getState().toast).toBeNull();
  });

  it('a `warning` toast never paints a danger-family background (ARCHITECTURE §10, REVIEW-M0.md item 5)', async () => {
    await render(<Toast />);
    await act(async () => useToastStore.getState().show('Couldn’t save that — try again.', 'warning'));
    const alert = screen.getByRole('alert');
    const bg = flattenBg(alert.props.style);
    expect(bg).toBeDefined();
    expect(DANGER_FAMILY.has(bg!)).toBe(false);
  });

  it('a `success` toast puts text on a soft tint, never a saturated ideal fill (Rule 4 intent)', async () => {
    await render(<Toast />);
    await act(async () => useToastStore.getState().show('Restored — your data is back.', 'success'));
    const alert = screen.getByRole('alert');
    expect(flattenBg(alert.props.style)).toBe(PALETTES.light.idealSoft);
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
