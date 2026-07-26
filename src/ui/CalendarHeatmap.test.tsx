import { fireEvent, isInaccessible, render, screen } from '@testing-library/react-native';

import { PALETTES } from '@/theme/tokens';
import type { LocalDate } from '@/types';

import { CalendarHeatmap, type CalendarHeatmapDay } from './CalendarHeatmap';

const D = (s: string) => s as LocalDate;

// Mon Jun 29 2026 .. Sun Jul 5 2026 — one full Monday-start week, one of each outcome.
const DAYS: readonly CalendarHeatmapDay[] = [
  { date: D('2026-06-29'), dayOfMonth: 29, outcome: 'ideal' },
  { date: D('2026-06-30'), dayOfMonth: 30, outcome: 'fallback' },
  { date: D('2026-07-01'), dayOfMonth: 1, outcome: 'off' },
  { date: D('2026-07-02'), dayOfMonth: 2, outcome: 'missed' },
  { date: D('2026-07-03'), dayOfMonth: 3, outcome: 'pending' },
  { date: D('2026-07-04'), dayOfMonth: 4, outcome: 'not-due' },
  { date: D('2026-07-05'), dayOfMonth: 5, outcome: 'ideal' },
];

function bgViews(bg: string) {
  return screen.container.queryAll((n) => n.type === 'View' && flattenBg(n.props.style) === bg);
}

describe('CalendarHeatmap', () => {
  it('off cells use `off-soft` (not solid `off`) so the moon glyph never sits on a saturated fill', async () => {
    await render(<CalendarHeatmap days={DAYS} monthLabel="July 2026" accessibilityLabel="Calendar" />);
    expect(bgViews(PALETTES.light.offSoft).length).toBeGreaterThan(0);
    expect(bgViews(PALETTES.light.off)).toHaveLength(0);
  });

  it('missed cells are `--surface` + `--border-strong` — distinct from a fully blank not-due cell', async () => {
    await render(<CalendarHeatmap days={DAYS} monthLabel="July 2026" accessibilityLabel="Calendar" />);
    // The Pressable (the tap target, item 7) carries the label; its own fill lives one
    // level deeper, on the inner cell View.
    const missedFill = firstViewChild(screen.getByLabelText('2026-07-02, missed'));
    const notDueFill = firstViewChild(screen.getByLabelText('2026-07-04, not due'));
    expect(flattenBg(missedFill.props.style)).toBe(PALETTES.light.surface);
    expect(flattenBorderColor(missedFill.props.style)).toBe(PALETTES.light.borderStrong);
    expect(flattenBg(notDueFill.props.style)).toBe('transparent');
    expect(flattenBorderColor(notDueFill.props.style)).toBe(PALETTES.light.border);
  });

  it('ideal and fallback cells fill with the same signal colours as StateChip', async () => {
    await render(<CalendarHeatmap days={DAYS} monthLabel="July 2026" accessibilityLabel="Calendar" />);
    expect(bgViews(PALETTES.light.ideal).length).toBeGreaterThan(0);
    expect(bgViews(PALETTES.light.fallback).length).toBeGreaterThan(0);
  });

  it('legend labels are themed, never the RN default text colour', async () => {
    await render(<CalendarHeatmap days={DAYS} monthLabel="July 2026" accessibilityLabel="Calendar" />);
    for (const label of ['Ideal', 'Fallback', 'Off', 'Missed', 'Pending today', 'Not due']) {
      const node = screen.getByText(label);
      const color = flattenColor(node.props.style);
      expect(color).toBeDefined();
      expect(color).toBe(PALETTES.light.textMuted);
    }
  });

  it('the tap target covers the cell AND its numeral caption together, and fires onCellPress', async () => {
    const onCellPress = jest.fn();
    await render(<CalendarHeatmap days={DAYS} monthLabel="July 2026" accessibilityLabel="Calendar" onCellPress={onCellPress} />);
    const cell = screen.getByLabelText('2026-06-29, ideal');
    await fireEvent.press(cell);
    expect(onCellPress).toHaveBeenCalledWith('2026-06-29');
  });

  it('cells and month nav are individually reachable — no ancestor hides or collapses them (REVIEW-M0.md pass 2 + pass 3 carried item 1)', async () => {
    const onPrevMonth = jest.fn();
    const onNextMonth = jest.fn();
    await render(
      <CalendarHeatmap days={DAYS} monthLabel="July 2026" accessibilityLabel="Calendar" onPrevMonth={onPrevMonth} onNextMonth={onNextMonth} />,
    );

    const navButton = screen.getByRole('button', { name: 'Previous month' });
    const cell = screen.getByLabelText('2026-06-29, ideal');

    // `fireEvent` drives the React prop directly and bypasses the platform accessibility
    // tree entirely — it would keep "succeeding" even if a real screen reader could never
    // reach either node, so this proves the elements are wired correctly but is NOT, on its
    // own, proof of reachability (pass 3 carried item 1).
    await fireEvent.press(navButton);
    expect(onPrevMonth).toHaveBeenCalledTimes(1);
    expect(cell.props.accessibilityLabel).not.toBe('Previous month');

    // The actual class of bugs this needs to catch — RNTL's `isInaccessible` walks the
    // ancestor chain for every mechanism that hides a subtree from a real screen reader:
    // `aria-hidden`, iOS `accessibilityElementsHidden`, and Android
    // `importantForAccessibility="no-hide-descendants"` (see
    // `@testing-library/react-native/dist/helpers/accessibility.js`'s `isSubtreeInaccessible`).
    expect(isInaccessible(navButton)).toBe(false);
    expect(isInaccessible(cell)).toBe(false);

    // `isInaccessible` does NOT model `accessible={true}` grouping (an ancestor marked
    // `accessible` isn't "hidden" — it's collapsed into one opaque element together with
    // everything beneath it, iOS-only, and is exactly what pass 1 shipped on this
    // container). That needs its own, explicit check.
    expectNoAccessibleAncestor(navButton);
    expectNoAccessibleAncestor(cell);

    // The container's own label is still announced — via the kit's one canonical sr-only
    // idiom (`@/ui/a11y`: hidden style + explicit belt-and-braces visibility props), a real
    // (host `Text`, therefore auto-accessible) sibling element outside the interactive
    // subtree rather than a wrapper of it.
    const label = screen.getByText('Calendar');
    expect(label.props.style).toEqual(expect.objectContaining({ position: 'absolute', opacity: 0 }));
    expect(label.props.accessibilityElementsHidden).toBe(false);
    expect(label.props.importantForAccessibility).toBe('yes');
  });
});

function expectNoAccessibleAncestor(node: ReturnType<typeof screen.getByLabelText>) {
  let current = node.parent;
  while (current) {
    expect(current.props.accessible).not.toBe(true);
    current = current.parent;
  }
}

function firstViewChild(node: ReturnType<typeof screen.getByLabelText>) {
  const [child] = node.queryAll((n) => n.type === 'View');
  if (!child) throw new Error('expected a nested View');
  return child;
}

function flattenBg(style: unknown): string | undefined {
  return flattenStyleProp(style, 'backgroundColor');
}

function flattenBorderColor(style: unknown): string | undefined {
  return flattenStyleProp(style, 'borderColor');
}

function flattenColor(style: unknown): string | undefined {
  return flattenStyleProp(style, 'color');
}

function flattenStyleProp(style: unknown, key: 'backgroundColor' | 'borderColor' | 'color'): string | undefined {
  const arr = Array.isArray(style) ? style : [style];
  for (const s of arr) {
    const v = (s as Record<string, string> | undefined)?.[key];
    if (v) return v;
  }
  return undefined;
}
