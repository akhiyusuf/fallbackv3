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
    await act(async () => useToastStore.getState().show('Today marked off. Nothing due counts against your %.'));
    expect(alertFor('Today marked off. Nothing due counts against your %.')).toBeTruthy();
  });

  it('dismisses on tap', async () => {
    await render(<Toast />);
    await act(async () => useToastStore.getState().show('Couldn’t save that — try again.'));
    await fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }));
    expect(useToastStore.getState().toast).toBeNull();
  });

  it('a `warning` toast never paints a danger-family background (ARCHITECTURE §10, REVIEW-M0.md item 5)', async () => {
    await render(<Toast />);
    await act(async () => useToastStore.getState().show('Couldn’t save that — try again.', 'warning'));
    const alert = alertFor('Couldn’t save that — try again.');
    const bg = flattenBg(alert.props.style);
    expect(bg).toBeDefined();
    expect(DANGER_FAMILY.has(bg!)).toBe(false);
  });

  it('a `success` toast sits on the inverse card surface, never a saturated ideal fill (Rule 4 intent)', async () => {
    await render(<Toast />);
    await act(async () => useToastStore.getState().show('Restored. Your data is back.', 'success'));
    const alert = alertFor('Restored. Your data is back.');
    // The toast no longer tints by tone: every toast is the inverse-scheme card (light scheme -> dark palette).
    expect(flattenBg(alert.props.style)).toBe(PALETTES.dark.bgAlt);
    expect(flattenBg(alert.props.style)).not.toBe(PALETTES.light.ideal);
  });
});

// The toast root is a plain View that carries role "alert" and its message as its label. It is not an
// accessibility element of its own (the Dismiss button is), so look it up by label and check its role.
function alertFor(message: string) {
  const el = screen.getByLabelText(message);
  expect(el.props.accessibilityRole).toBe('alert');
  return el;
}

function flattenBg(style: unknown): string | undefined {
  const arr = Array.isArray(style) ? style : [style];
  for (const s of arr) {
    const bg = (s as { backgroundColor?: string } | undefined)?.backgroundColor;
    if (bg) return bg;
  }
  return undefined;
}
