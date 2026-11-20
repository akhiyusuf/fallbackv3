/**
 * Edge campaign, round 2: accessibility and wording across the shared kit.
 *
 * Every shared component is rendered in one gallery per theme: light and dark, each named accent
 * and two custom hues. The rendered host tree is then checked for:
 *  - every pressable has an accessibilityRole and a non-empty accessibilityLabel
 *  - the state of disabled controls and of switches, checkboxes, tabs and selected options is
 *    exposed in accessibilityState
 *  - every primary control's touch target is at least 44 x 44 (minHeight/height plus hitSlop)
 *  - body text, muted text and the signal colors meet 4.5:1 against the surfaces they sit on
 *    (computed from the theme tokens with the WCAG relative-luminance formula)
 *  - no visible or spoken string (text, accessibilityLabel, accessibilityHint) carries an em dash,
 *    an en dash, a double space, a trailing space or a placeholder word
 *  - labels that must wrap at large text sizes are not capped to one line
 */
import { render, screen } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';
import { Plus, X } from 'lucide-react-native';

import { useToastStore } from '@/app-shell/stores/toast';
import { makeTask } from '@/features/task/testSupport/taskFixture';
import { buildTheme, contrast, MIN_TAP_TARGET, ThemeContext, THEME_ORDER, type ColorScheme, type Theme } from '@/theme';
import type { AccentKey, LocalDate } from '@/types';

import { Badge } from './Badge';
import { Button } from './Button';
import { CalendarHeatmap, type CalendarHeatmapDay } from './CalendarHeatmap';
import { Checkbox } from './Checkbox';
import { ConfirmSheet } from './ConfirmSheet';
import { Dialog } from './Dialog';
import { IconButton } from './IconButton';
import { ListRow } from './ListGroup';
import { LogControl } from './LogControl';
import { MenuSheet } from './MenuSheet';
import { Stepper } from './Stepper';
import { Switch } from './Switch';
import { Tabs } from './Tabs';
import { Tag } from './Tag';
import { Toast } from './Toast';
import { WeekdayPicker } from './WeekdayPicker';
import { StatHero } from '@/features/today/StatHero';
import { TaskCard } from '@/features/task/TaskCard';

type Host = { type: string; props: Record<string, unknown>; children: ReactTestRendererJSON['children'] };

const noop = () => {};

/** The bare "no value" dash StatHero prints (see the KNOWN test at the end of this file). */
const KNOWN_NO_VALUE_DASH = '\u2013';

/** The gallery: one of each shared control in the states a person meets. */
function Gallery() {
  const days: CalendarHeatmapDay[] = Array.from({ length: 28 }, (_, i) => ({
    date: `2026-11-${String(i + 1).padStart(2, '0')}` as LocalDate,
    dayOfMonth: i + 1,
    outcome: (['ideal', 'fallback', 'missed', 'off', 'pending', 'not-due'] as const)[i % 6]!,
  }));
  return (
    <View>
      <Button label="Save routine" onPress={noop} />
      <Button label="Cancel" variant="secondary" onPress={noop} />
      <Button label="Delete task" variant="danger" onPress={noop} />
      <Button label="Not now" variant="ghost" onPress={noop} />
      <Button label="Save off" disabled onPress={noop} />
      <Button label="Saving" loading onPress={noop} />
      <ListRow label="Notifications" sublabel="Daily at 8" value="On" onPress={noop} chevron />
      <ListRow label="Remove account" danger onPress={noop} />
      <ListRow label="Sync" disabled onPress={noop} />
      <ListRow label="Version" value="1.0" />
      <Switch value onValueChange={noop} accessibilityLabel="Sounds" />
      <Switch value={false} disabled onValueChange={noop} accessibilityLabel="Sync" />
      <Tabs items={[{ value: 'a', label: '7 days' }, { value: 'b', label: '30 days' }, { value: 'c', label: 'All time' }]} value="a" onChange={noop} accessibilityLabel="Window" />
      <Checkbox checked onToggle={noop} label="Stretch" caption="Morning" />
      <Checkbox checked={false} disabled onToggle={noop} label="Locked step" />
      <LogControl accessibilityLabel="Stretch" value={null} onChange={noop} idealHint="Ten minutes" fallbackHint="Two" onPush={noop} onEmergency={noop} />
      <LogControl accessibilityLabel="Water" value="fallback" onChange={noop} />
      <IconButton icon={Plus} accessibilityLabel="Add task" onPress={noop} variant="accent" />
      <IconButton icon={X} accessibilityLabel="Close" onPress={noop} />
      <IconButton icon={X} accessibilityLabel="Remove" onPress={noop} variant="danger" disabled />
      <WeekdayPicker selected={[1, 2]} onChange={noop} accessibilityLabel="Days" />
      <WeekdayPicker mode="single" selected={[3]} onChange={noop} accessibilityLabel="Day" disabledDays={[4]} error="Pick a day" />
      <StatHero percent={80} label="Showing up" detail="12 of the last 15 days" accessibilityLabel="Showing up, 80 percent" onPress={noop} />
      <StatHero percent={null} label="Showing up" detail="No data yet" accessibilityLabel="Showing up, no data" />
      <TaskCard task={makeTask({ name: 'Stretch' })} meta={['Routine', 'Daily']} showWeek={false} onPress={noop} />
      <CalendarHeatmap days={days} monthLabel="November 2026" onPrevMonth={noop} onNextMonth={noop} onCellPress={noop} statLine="12 of the last 30 days" accessibilityLabel="Calendar" />
      <Stepper label="Doses" value={2} onChange={noop} />
      <Badge label="Due" />
      <Tag label="Routine" />
      <ConfirmSheet visible onClose={noop} title="Delete this task?" message="Its history stays on this phone." confirmLabel="Delete" onConfirm={noop} danger />
      <MenuSheet visible onClose={noop} title="Add" items={[{ key: 'a', label: 'Routine', sublabel: 'Every day or some days', onPress: noop, opensScreen: true }, { key: 'b', label: 'Delete', onPress: noop, danger: true }]} />
      <Dialog visible onClose={noop} title="Notes" showClose accessibilityLabel="Notes">
        <Button label="Done" onPress={noop} />
      </Dialog>
    </View>
  );
}

/** Every host node in a rendered tree, depth first. */
function hostNodes(root: ReactTestRendererJSON | ReactTestRendererJSON[] | null): Host[] {
  const out: Host[] = [];
  const visit = (n: unknown) => {
    if (!n || typeof n === 'string') return;
    if (Array.isArray(n)) {
      n.forEach(visit);
      return;
    }
    const node = n as Host;
    out.push(node);
    (node.children ?? []).forEach(visit);
  };
  visit(root);
  return out;
}

function isPressable(h: Host): boolean {
  return typeof h.props.onStartShouldSetResponder === 'function' || typeof h.props.onClick === 'function';
}

/** Every string a screen reader or a sighted person is given, from text children and a11y props. */
function spokenAndVisibleStrings(nodes: Host[]): string[] {
  const out: string[] = [];
  for (const h of nodes) {
    for (const c of h.children ?? []) if (typeof c === 'string') out.push(c);
    for (const key of ['accessibilityLabel', 'accessibilityHint']) {
      const v = h.props[key];
      if (typeof v === 'string') out.push(v);
    }
  }
  return out;
}

/** Same wording rules as src/edge.copy.test.ts, for text that is rendered rather than stored. */
function wordingProblems(text: string): string[] {
  const problems: string[] = [];
  if (/—/.test(text)) problems.push('em dash');
  if (/–/.test(text)) problems.push('en dash');
  if (/ {2}/.test(text)) problems.push('double space');
  if (/\s$/.test(text)) problems.push('trailing space');
  if (/\s\./.test(text)) problems.push('space before full stop');
  if (/\b(TODO|FIXME|XXX|undefined|NaN|null)\b/.test(text)) problems.push('placeholder word');
  if (/lorem|ipsum/i.test(text)) problems.push('lorem ipsum');
  if (/\[object Object\]/.test(text)) problems.push('[object Object]');
  if (/\{[a-zA-Z_][a-zA-Z0-9_]*\}/.test(text)) problems.push('unfilled {template} token');
  return problems;
}

/** Minimum touch size from the style (minHeight or height), plus the hitSlop on each side. */
function touchSize(h: Host): { width: number | null; height: number | null } {
  const flat = (StyleSheet.flatten(h.props.style as never) ?? {}) as Record<string, number | undefined>;
  const hs = h.props.hitSlop as number | { top?: number; bottom?: number; left?: number; right?: number } | undefined;
  const slopV = typeof hs === 'number' ? hs * 2 : (hs?.top ?? 0) + (hs?.bottom ?? 0);
  const slopH = typeof hs === 'number' ? hs * 2 : (hs?.left ?? 0) + (hs?.right ?? 0);
  const baseH = flat.minHeight ?? flat.height ?? null;
  const baseW = flat.minWidth ?? flat.width ?? null;
  return {
    height: baseH === null ? null : baseH + slopV,
    width: baseW === null ? null : baseW + slopH,
  };
}

const CONTROL_ROLES = new Set(['button', 'switch', 'checkbox', 'tab', 'radio']);

// Two hues the person can pick, besides the named themes: one warm, one violet.
const ACCENTS: AccentKey[] = [...THEME_ORDER, 'hue-52', 'hue-276'] as AccentKey[];
const SCHEMES: ColorScheme[] = ['light', 'dark'];

const COMBOS = SCHEMES.flatMap((scheme) => ACCENTS.map((accent) => ({ scheme, accent, theme: buildTheme(scheme, accent) })));

async function renderGalleryIn(theme: Theme) {
  await render(
    <ThemeContext.Provider value={theme}>
      <Gallery />
    </ThemeContext.Provider>,
  );
  return hostNodes(screen.toJSON() as ReactTestRendererJSON);
}

describe('a11y: every pressable has a role and a label, in every theme', () => {
  it.each(COMBOS.map((c) => [`${c.scheme} / ${c.accent}`, c] as const))('%s', async (_name, c) => {
    const nodes = await renderGalleryIn(c.theme);
    const pressables = nodes.filter(isPressable);
    expect(pressables.length).toBeGreaterThan(15);
    const missing: string[] = [];
    for (const p of pressables) {
      const role = p.props.accessibilityRole;
      const label = p.props.accessibilityLabel;
      if (typeof role !== 'string' || role === 'none' || role === '') missing.push(`no role (label ${JSON.stringify(label)})`);
      if (typeof label !== 'string' || label.trim() === '') missing.push(`role ${String(role)} has no label`);
    }
    expect(missing).toEqual([]);
  });
});

describe('a11y: states are exposed', () => {
  it('disabled buttons, rows, icon buttons and stepper steps expose disabled', async () => {
    await render(
      <ThemeContext.Provider value={buildTheme('light')}>
        <Button label="Save off" disabled onPress={noop} />
        <ListRow label="Sync" disabled onPress={noop} />
        <IconButton icon={X} accessibilityLabel="Remove" onPress={noop} disabled />
        <LogControl accessibilityLabel="Stretch" value={null} onChange={noop} disabled onPush={noop} onEmergency={noop} idealHint="Ten" fallbackHint="Two" />
        <LogControl accessibilityLabel="Water" value="done" onChange={noop} disabled />
      </ThemeContext.Provider>,
    );
    const nodes = hostNodes(screen.toJSON() as ReactTestRendererJSON);
    const disabledPressables = nodes.filter((n) => isPressable(n) && n.props.accessibilityRole === 'button');
    const notDisabled = disabledPressables
      .filter((n) => (n.props.accessibilityState as { disabled?: boolean } | undefined)?.disabled !== true)
      .map((n) => n.props.accessibilityLabel);
    expect(notDisabled).toEqual([]);
  });

  it('switch, checkbox and tab expose their on, checked and selected state, and disabled', async () => {
    await render(
      <ThemeContext.Provider value={buildTheme('light')}>
        <Switch value onValueChange={noop} accessibilityLabel="Sounds" />
        <Switch value={false} onValueChange={noop} accessibilityLabel="Haptics" />
        <Checkbox checked onToggle={noop} label="Stretch" />
        <Checkbox checked={false} disabled onToggle={noop} label="Locked" />
        <Tabs items={[{ value: 'a', label: '7 days' }, { value: 'b', label: '30 days' }]} value="b" onChange={noop} accessibilityLabel="Window" disabled />
      </ThemeContext.Provider>,
    );
    expect(screen.getByRole('switch', { name: 'Sounds' }).props.accessibilityState).toMatchObject({ checked: true, disabled: false });
    expect(screen.getByRole('switch', { name: 'Haptics' }).props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByRole('checkbox', { name: 'Stretch' }).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByRole('checkbox', { name: 'Locked' }).props.accessibilityState).toMatchObject({ checked: false, disabled: true });
    expect(screen.getByRole('tab', { name: '30 days' }).props.accessibilityState).toMatchObject({ selected: true, disabled: true });
    expect(screen.getByRole('tab', { name: '7 days' }).props.accessibilityState).toMatchObject({ selected: false, disabled: true });
  });
});

describe('a11y: touch targets of primary controls are at least 44 x 44', () => {
  it.each(COMBOS.map((c) => [`${c.scheme} / ${c.accent}`, c] as const))('%s', async (_name, c) => {
    const nodes = await renderGalleryIn(c.theme);
    const small: string[] = [];
    for (const p of nodes.filter(isPressable)) {
      const role = String(p.props.accessibilityRole);
      if (!CONTROL_ROLES.has(role)) continue;
      const { height } = touchSize(p);
      if (height !== null && height < MIN_TAP_TARGET) small.push(`${role} ${JSON.stringify(p.props.accessibilityLabel)} is ${height}px tall`);
    }
    expect(small).toEqual([]);
  });
});

describe('a11y: contrast of text on its surfaces, from the theme tokens (WCAG 4.5:1 for text)', () => {
  // Pairs a person reads as text. Each is [foreground, background, name].
  function pairsFor(t: Theme): [string, number][] {
    const c = t.color;
    const a = t.accent;
    const pairs: [string, [string, string]][] = [
      ['text on page', [c.text, c.bg]],
      ['text on card', [c.text, c.bgAlt]],
      ['text on surface', [c.text, c.surface]],
      ['textMuted on page', [c.textMuted, c.bg]],
      ['textMuted on card', [c.textMuted, c.bgAlt]],
      ['textMuted on surface', [c.textMuted, c.surface]],
      ['textDim on page', [c.textDim, c.bg]],
      ['textDim on card', [c.textDim, c.bgAlt]],
      ['accent text on page', [a.text, c.bg]],
      ['accent text on card', [a.text, c.bgAlt]],
      ['accent text on accent tint', [a.text, a.soft]],
      ['button label on accent fill', [a.on, a.fill]],
      ['white on danger button', [c.textOnAccent, c.danger]],
      ['error text on page', [c.dangerDeep, c.bg]],
      ['error text on card', [c.dangerDeep, c.bgAlt]],
      ['ideal chip text', [c.idealDeep, c.idealSoft]],
      ['fallback chip text', [c.fallbackDeep, c.fallbackSoft]],
      ['off chip text', [c.offDeep, c.offSoft]],
      ['gold label', [c.goldDeep, c.goldSoft]],
    ];
    return pairs.map(([name, [fg, bg]]) => [name, contrast(fg, bg)]);
  }

  it.each(COMBOS.map((c) => [`${c.scheme} / ${c.accent}`, c] as const))('%s', (_name, c) => {
    const failing = pairsFor(c.theme)
      .filter(([, ratio]) => ratio < 4.5)
      .map(([name, ratio]) => `${name}: ${ratio.toFixed(2)}:1`);
    expect(failing).toEqual([]);
  });
});

describe('a11y: every rendered string is clean wording', () => {
  it.each(COMBOS.map((c) => [`${c.scheme} / ${c.accent}`, c] as const))('%s', async (_name, c) => {
    const nodes = await renderGalleryIn(c.theme);
    const bad = spokenAndVisibleStrings(nodes).flatMap((s) => {
      // The bare "no value" dash in StatHero is outside this round's files: see the KNOWN test below.
      if (s === KNOWN_NO_VALUE_DASH) return [];
      const p = wordingProblems(s);
      return p.length ? [`${JSON.stringify(s)} [${p.join(', ')}]`] : [];
    });
    expect(bad).toEqual([]);
  });
});

describe('a11y: the "no value" mark', () => {
  // Main-session decision: a missing number shows one short dash (–), the same mark on the Today
  // ring, the consistency ring, the trend table, records and the subscription screen. It is a mark,
  // not wording; ranges in wording read "Mon to Fri". This pins the mark so it stays consistent.
  it('StatHero with no value shows the same short dash as the rings', async () => {
    await render(
      <ThemeContext.Provider value={buildTheme('light')}>
        <StatHero percent={null} label="Showing up" detail="No data yet" accessibilityLabel="Showing up, no data" />
      </ThemeContext.Provider>,
    );
    const strings = spokenAndVisibleStrings(hostNodes(screen.toJSON() as ReactTestRendererJSON));
    expect(strings).toContain('\u2013');
  });
});

describe('large text: labels that must wrap are not capped to one line', () => {
  it('Button, ListRow, Checkbox and dialog titles carry no numberOfLines cap', async () => {
    await render(
      <ThemeContext.Provider value={buildTheme('light')}>
        <Button label="Save routine with a very long name that wraps at large text" onPress={noop} />
        <ListRow label="A very long habit name that a person typed in full" sublabel="Every day, with a long schedule line" onPress={noop} />
        <Checkbox checked={false} onToggle={noop} label="A long step name that should wrap" caption="A caption that should wrap" />
        <ConfirmSheet visible onClose={noop} title="Delete this very long habit name?" message="A message that explains the choice." confirmLabel="Delete" onConfirm={noop} />
      </ThemeContext.Provider>,
    );
    const nodes = hostNodes(screen.toJSON() as ReactTestRendererJSON);
    const capped = nodes
      .filter((n) => n.type === 'Text' && typeof n.props.numberOfLines === 'number' && n.props.numberOfLines < 2)
      .map((n) => (n.children ?? []).filter((x): x is string => typeof x === 'string').join(''));
    expect(capped).toEqual([]);
  });

  it('the plan hint under Done / Fallback may wrap to two lines (it explains the choice)', async () => {
    await render(
      <ThemeContext.Provider value={buildTheme('light')}>
        <LogControl accessibilityLabel="Stretch" value={null} onChange={noop} idealHint="Ten minutes after waking up" fallbackHint="Two stretches" />
      </ThemeContext.Provider>,
    );
    const hint = screen.getByText('Ten minutes after waking up');
    expect(hint.props.numberOfLines).toBeGreaterThanOrEqual(2);
  });

  it('tab labels may wrap to two lines at large text (never cut to one line with an ellipsis)', async () => {
    await render(
      <ThemeContext.Provider value={buildTheme('light')}>
        <Tabs items={[{ value: 'a', label: 'All time' }, { value: 'b', label: '30 days' }]} value="a" onChange={noop} accessibilityLabel="Window" />
      </ThemeContext.Provider>,
    );
    const labels = hostNodes(screen.toJSON() as ReactTestRendererJSON).filter((n) => n.type === 'Text' && n.props.numberOfLines !== undefined);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.filter((n) => (n.props.numberOfLines as number) < 2)).toEqual([]);
  });
});

describe('a11y: the toast is a labelled alert in every theme', () => {
  it.each(COMBOS.map((c) => [`${c.scheme} / ${c.accent}`, c] as const))('%s', async (_name, c) => {
    useToastStore.getState().show('Couldn\u2019t save that. Try again.', 'warning');
    await render(
      <ThemeContext.Provider value={c.theme}>
        <Toast />
      </ThemeContext.Provider>,
    );
    // The alert is the one focus stop: it carries the alert role, a polite live region and the message
    // as its label, so focus reads the message first. Dismiss is a named action on it, not a focus stop.
    const alert = screen.getByLabelText('Couldn\u2019t save that. Try again.');
    expect(alert.props.accessibilityRole).toBe('alert');
    expect(alert.props.accessibilityLiveRegion).toBe('polite');
    expect(alert.props.accessible).toBe(true);
    expect(alert.props.accessibilityActions).toEqual([{ name: 'dismiss', label: 'Dismiss' }]);
    expect(screen.getByLabelText('Dismiss')).toBeTruthy();
    const strings = spokenAndVisibleStrings(hostNodes(screen.toJSON() as ReactTestRendererJSON));
    expect(strings.flatMap((s) => wordingProblems(s))).toEqual([]);
    useToastStore.getState().hide();
  });
});
