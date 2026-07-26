/**
 * `lucide-react-native`'s package `exports` map resolves the `react-native` condition to
 * its `.mjs` ESM build, but `jest.config.js` (frozen) only widens `transformIgnorePatterns`
 * for it — there is no `transform` entry matching `.mjs`, so the file reaches Jest
 * untranspiled and throws `Unexpected token 'export'`. Every module that renders an icon
 * will hit this identically; mocked locally here rather than touching the frozen config.
 * Flagged as a contract-change request in the M0 build report.
 */
jest.mock('lucide-react-native', () => {
  const stub = () => null;
  return new Proxy({}, { get: () => stub, has: () => true });
});

import { act, create } from 'react-test-renderer';
import { Text, View } from 'react-native';

import { PALETTES } from '@/theme/tokens';

import { StateChip } from './StateChip';

/** `Pressable` forwards `accessibilityRole` down to its underlying host node(s) too, so a
 * plain prop match over-counts each option 2-3x. Scoping to the composite (non-host) node
 * gives exactly one match per rendered `<Pressable>`. */
function radioOptions(renderer: ReturnType<typeof create>) {
  return renderer.root.findAll(
    (n) => n.props.accessibilityRole === 'radio' && typeof n.type !== 'string' && (n.type as { name?: string }).name === 'Pressable',
  );
}

describe('StateChip', () => {
  it('exposes a four-option radiogroup and commits a selection', () => {
    const onChange = jest.fn();
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<StateChip value="todo" onChange={onChange} accessibilityLabel="Movement, today's state" />);
    });
    const group = renderer!.root.findByProps({ accessibilityRole: 'radiogroup' });
    expect(group.props.accessibilityLabel).toBe("Movement, today's state");

    const options = radioOptions(renderer!);
    expect(options).toHaveLength(4);

    const doneOption = options.find((o) => o.props.accessibilityLabel === 'Done')!;
    act(() => {
      doneOption.props.onPress();
    });
    expect(onChange).toHaveBeenCalledWith('done');
  });

  it('Rule 4: the signal-filled pill never contains a Text node — the label is a sibling, not on the fill', () => {
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<StateChip value="done" onChange={() => {}} accessibilityLabel="Movement" />);
    });
    // Find the pill View filled with the ideal signal colour (the selected "Done" option's fill).
    const idealFillViews = renderer!.root.findAll((node) => node.type === View && flattenBg(node.props.style) === PALETTES.light.ideal);
    expect(idealFillViews.length).toBeGreaterThan(0);
    for (const pill of idealFillViews) {
      expect(pill.findAllByType(Text)).toHaveLength(0);
    }
  });

  it('does not fire onChange when disabled', () => {
    const onChange = jest.fn();
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<StateChip value="todo" onChange={onChange} accessibilityLabel="Movement" disabled />);
    });
    const options = radioOptions(renderer!);
    expect(options).toHaveLength(4);
    for (const option of options) {
      expect(option.props.onPress).toBeUndefined();
    }
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
