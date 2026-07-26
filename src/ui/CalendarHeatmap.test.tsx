import { fireEvent, render, screen } from '@testing-library/react-native';

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
});

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
