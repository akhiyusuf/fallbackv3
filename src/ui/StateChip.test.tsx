import { fireEvent, render, screen } from '@testing-library/react-native';

import { PALETTES } from '@/theme/tokens';

import { StateChip } from './StateChip';

/**
 * The `radiogroup` wrapper deliberately does NOT set `accessible` — doing so would collapse
 * its four `Pressable` radios into one opaque VoiceOver/TalkBack element, exactly the
 * regression a real radio group must avoid. That means RNTL's `getByRole` (which only
 * treats a node as queryable once `accessible` is set — see
 * `@testing-library/react-native/dist/helpers/accessibility.js`) can't resolve the wrapper
 * itself; `queryAll` reaches the raw prop tree instead, which is the structural check this
 * file needs and not a workaround for a real accessibility gap.
 */
function findByStyleBg(bg: string) {
  return screen.container.queryAll((n) => n.type === 'View' && flattenBg(n.props.style) === bg);
}

describe('StateChip', () => {
  it('exposes a four-option radiogroup and commits a selection', async () => {
    await render(<StateChip value="todo" onChange={jest.fn()} accessibilityLabel="Movement, today's state" />);
    const group = screen.container.queryAll((n) => n.type === 'View' && n.props.accessibilityRole === 'radiogroup')[0]!;
    expect(group.props.accessibilityLabel).toBe("Movement, today's state");
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('commits the selected state on tap', async () => {
    const onChange = jest.fn();
    await render(<StateChip value="todo" onChange={onChange} accessibilityLabel="Movement" />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Done' }));
    expect(onChange).toHaveBeenCalledWith('done');
  });

  it('Skip is a filled state — approved `--off` fill with a `Minus` glyph, per the handoff chip map', async () => {
    await render(<StateChip value="skip" onChange={jest.fn()} accessibilityLabel="Antibiotics" />);
    // The selected Skip pill fills with the `off` signal colour (REVIEW-M0.md item 1) —
    // not left neutral/outlined, and never the kit's own Close (`X`) glyph.
    expect(findByStyleBg(PALETTES.light.off).length).toBeGreaterThan(0);
  });

  it('Rule 4: the signal-filled pill never contains a Text node — the label is a sibling, not on the fill', async () => {
    await render(<StateChip value="done" onChange={jest.fn()} accessibilityLabel="Movement" />);
    // Find the pill View filled with the ideal signal colour (the selected "Done" option's fill).
    const idealFillViews = findByStyleBg(PALETTES.light.ideal);
    expect(idealFillViews.length).toBeGreaterThan(0);
    for (const pill of idealFillViews) {
      expect(pill.queryAll((n) => n.type === 'Text')).toHaveLength(0);
    }
  });

  it('does not fire onChange when disabled', async () => {
    const onChange = jest.fn();
    await render(<StateChip value="todo" onChange={onChange} accessibilityLabel="Movement" disabled />);
    const options = screen.getAllByRole('radio');
    expect(options).toHaveLength(4);
    for (const option of options) {
      await fireEvent.press(option);
    }
    expect(onChange).not.toHaveBeenCalled();
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
