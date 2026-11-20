/**
 * Screen-level accessibility (round 4, edge campaign). Every main screen is rendered through its real
 * route file with sample data (tasks of each kind, logs, an empty and a loaded history), and the
 * accessibility tree is checked for: one title header per screen (no header said twice); every
 * pressable with a role and a label that says what it does, not a bare word or an icon name, and no
 * label used by two controls on one screen; toggles that expose checked; no unlabelled control
 * outside a focus group. Then the key screens are walked: Today's reading order, the log controls and
 * their state, the toast (message first, Dismiss as its own action) and the celebration announcement.
 */
jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `00000000-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}` };
});
jest.mock('@/db', () => require('@/queries/testSupport/dbMock'));
jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  const { clock } = require('@/queries/testSupport/clockMock');
  return { ...actual, today: () => clock.today, now: () => clock.now };
});
const mockClients: { clear(): void }[] = [];
jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  class CapturingClient extends actual.QueryClient {
    constructor(...args: ConstructorParameters<typeof actual.QueryClient>) {
      super(...args);
      mockClients.push(this as never);
    }
  }
  return { ...actual, QueryClient: CapturingClient };
});

import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { renderRouter, screen } from 'expo-router/testing-library';
import { act, fireEvent, within } from '@testing-library/react-native';

import { useAddMenuStore, useCelebrationStore, useToastStore } from '@/app-shell';
import { makeTask } from '@/features/task/testSupport/taskFixture';
import { fake } from '@/queries/testSupport/dbMock';
import { clock } from '@/queries/testSupport/clockMock';
import type { DayLog, Id, Instant, LocalDate, Step, TaskWithSteps } from '@/types';

const loadErrors: string[] = [];
function safe(path: string): React.ComponentType {
  try {
    return require(path).default;
  } catch (e) {
    loadErrors.push(`${path}: ${String((e as Error).message).split('\n')[0]}`);
    return () => null;
  }
}

const CONTEXT = {
  _layout: safe('./_layout'),
  index: safe('./index'),
  splash: safe('./splash'),
  search: safe('./search'),
  recovery: safe('./recovery'),
  progress: safe('./progress/index'),
  'progress/trend': safe('./progress/trend'),
  achievements: safe('./achievements/index'),
  'achievements/celebrate': safe('./achievements/celebrate'),
  priorities: safe('./priorities/index'),
  records: safe('./records/index'),
  'records/[cycleId]': safe('./records/[cycleId]'),
  settings: safe('./settings/index'),
  'settings/agents': safe('./settings/agents'),
  'settings/help': safe('./settings/help'),
  'settings/notifications': safe('./settings/notifications'),
  'settings/subscription': safe('./settings/subscription'),
  'settings/sync': safe('./settings/sync'),
  'settings/theme': safe('./settings/theme'),
  'settings/widgets': safe('./settings/widgets'),
  'settings/data/index': safe('./settings/data/index'),
  'settings/data/deleted': safe('./settings/data/deleted'),
  'settings/data/erase': safe('./settings/data/erase'),
  'onboarding/concept': safe('./onboarding/concept'),
  'onboarding/hook': safe('./onboarding/hook'),
  'onboarding/types': safe('./onboarding/types'),
  'onboarding/consistency': safe('./onboarding/consistency'),
  'onboarding/personalize': safe('./onboarding/personalize'),
  'onboarding/notifications-primer': safe('./onboarding/notifications-primer'),
  'onboarding/first-task': safe('./onboarding/first-task'),
  'add/index': safe('./add/index'),
  'add/routine': safe('./add/routine'),
  'add/event': safe('./add/event'),
  'add/course': safe('./add/course'),
  'add/todo': safe('./add/todo'),
  'task/[id]/index': safe('./task/[id]/index'),
  'task/[id]/icon': safe('./task/[id]/icon'),
  'task/[id]/delete': safe('./task/[id]/delete'),
  'task/[id]/as-needed': safe('./task/[id]/as-needed'),
  'task/[id]/celebrate': safe('./task/[id]/celebrate'),
  'assistant/index': safe('./assistant/index'),
  'assistant/chat': safe('./assistant/chat'),
  'assistant/mic-primer': safe('./assistant/mic-primer'),
  'assistant/paywall/index': safe('./assistant/paywall/index'),
  'assistant/paywall/plan': safe('./assistant/paywall/plan'),
  'assistant/paywall/byo': safe('./assistant/paywall/byo'),
  'assistant/history/index': safe('./assistant/history/index'),
  'assistant/history/[id]': safe('./assistant/history/[id]'),
  '(tabs)/_layout': safe('./(tabs)/_layout'),
  '(tabs)/today': safe('./(tabs)/today'),
  '(tabs)/routines': safe('./(tabs)/routines'),
  '(tabs)/events': safe('./(tabs)/events'),
  '(tabs)/courses': safe('./(tabs)/courses'),
  '(tabs)/todos': safe('./(tabs)/todos'),
};


const D1 = '2026-07-16';
const at = (d: string, h = 12) => `${d}T${String(h).padStart(2, '0')}:00:00.000Z`;

function seed() {
  fake.reset();
  fake.seedSettings({ tenureAnchorDate: D1 as LocalDate, onboardingCompletedAt: at('2026-01-01') as Instant });
  clock.today = D1;
  clock.now = at(D1);
  const t = (patch: Partial<TaskWithSteps>) => makeTask(patch);
  const steps = (id: string, role: 'ideal' | 'fallback', texts: string[]): Step[] =>
    texts.map((text, i) => ({ id: `${id}-${role}-${i}` as Id, taskId: id as Id, role, text, position: i, dueWeekdays: null }));
  fake.seedTask(t({ id: 'r1' as Id, name: 'Evening walk', icon: 'Footprints', idealSteps: steps('r1', 'ideal', ['Walk 30 minutes']), fallbackSteps: steps('r1', 'fallback', ['Walk to the corner']) }));
  fake.seedTask(t({ id: 'r2' as Id, name: 'Read', cadence: { kind: 'weekdays', days: [1, 3, 5] } as never, idealSteps: steps('r2', 'ideal', ['Read ten pages']), fallbackSteps: steps('r2', 'fallback', ['One page']) }));
  fake.seedTask(t({ id: 'e1' as Id, type: 'event', name: 'Dentist', cadence: null, eventDate: '2026-07-20' as never, idealSteps: steps('e1', 'ideal', ['Arrive early']), fallbackSteps: [] }));
  fake.seedTask(t({ id: 'c1' as Id, type: 'course', name: 'Spanish', cadence: null, startDate: '2026-07-01' as never, endDate: '2026-12-01' as never, idealSteps: steps('c1', 'ideal', ['Lesson']), fallbackSteps: steps('c1', 'fallback', ['Flashcards']) }));
  fake.seedTask(t({ id: 'd1' as Id, type: 'todo', name: 'Renew passport', cadence: null, todoDoneAt: null, idealSteps: steps('d1', 'ideal', ['Fill the form']), fallbackSteps: [] }));
  fake.seedTask(t({ id: 'a1' as Id, name: 'Water plants', isAsNeeded: true, cadence: null, idealSteps: steps('a1', 'ideal', ['Water them']), fallbackSteps: [] }));
}


beforeEach(() => {
  mockClients.forEach((c) => c.clear());
  seed();
  useToastStore.setState({ toast: null });
  useCelebrationStore.setState({ queue: [] });
  useAddMenuStore.setState({ open: false } as never);
});


/** The text under a rendered instance (for the live tree, after an update). */
function instanceText(inst: { children: (string | { children: unknown[] })[] }): string {
  return inst.children.map((c) => (typeof c === 'string' ? c : instanceText(c as never))).join('');
}

type Node = string | null | undefined | { type?: string; props?: Record<string, any>; children?: Node[] | null };
type Flat = { node: Exclude<Node, string | null | undefined>; hidden: boolean; grouped: boolean };

const CONTAINER_ROLES = new Set(['tablist', 'radiogroup', 'list', 'none']);
const BARE_LABEL = /^(button|icon|image|touchable|pressable|svg|chevron.*|x|plus|tap|press|view|option|item|row|card)$/i;
const ICON_NAME = /^[A-Z][a-z]+(?:[A-Z][a-z0-9]+)+$/;

function textOf(n: Node): string {
  if (n == null) return '';
  if (typeof n === 'string') return n;
  return (n.children ?? []).map(textOf).join('');
}

/** Every host node in document order, with whether it is hidden or sits inside a focus group. */
function flatten(root: Node): Flat[] {
  const out: Flat[] = [];
  const visit = (n: Node, hidden: boolean, grouped: boolean) => {
    if (n == null || typeof n === 'string') return;
    const p = n.props ?? {};
    const selfHidden = p.accessibilityElementsHidden === true || p.importantForAccessibility === 'no-hide-descendants';
    const h = hidden || selfHidden;
    out.push({ node: n, hidden: h, grouped });
    const g = grouped || p.accessible === true;
    (n.children ?? []).forEach((c) => visit(c, h, g));
  };
  visit(root, false, false);
  return out;
}

const pressHandler = (p: Record<string, any>) => typeof p.onResponderRelease === 'function' || typeof p.onClick === 'function';

/** Problems with one screen's accessibility tree. An empty list means the screen passes. */
function screenProblems(root: Node): string[] {
  const problems: string[] = [];
  const flat = flatten(root);
  const titles = flat.filter((x) => x.node.props?.accessibilityRole === 'header').map((x) => textOf(x.node).trim());
  if (titles.length === 0) problems.push('no header');
  const repeated = titles.filter((t, i) => titles.indexOf(t) !== i);
  if (repeated.length) problems.push(`header said twice: ${[...new Set(repeated)].join(' | ')}`);

  const labels = new Map<string, number>();
  for (const { node } of flat) {
    const p = node.props ?? {};
    if (!pressHandler(p) || p.accessible !== true) continue;
    const role = p.accessibilityRole as string | undefined;
    const label = (p.accessibilityLabel as string | undefined)?.trim() ?? '';
    if (!role || role === 'none') problems.push(`pressable without a role: "${label || textOf(node).slice(0, 30)}"`);
    if (!label) problems.push(`pressable without a label: "${textOf(node).slice(0, 30)}"`);
    else if (BARE_LABEL.test(label) || ICON_NAME.test(label)) problems.push(`pressable label says nothing: "${label}"`);
    if (label) labels.set(label, (labels.get(label) ?? 0) + 1);
  }
  for (const [label, n] of labels) if (n > 1) problems.push(`label used by ${n} controls: "${label}"`);

  for (const { node } of flat) {
    const p = node.props ?? {};
    if (pressHandler(p) && p.accessible !== true && !CONTAINER_ROLES.has(p.accessibilityRole ?? 'none')) {
      problems.push(`pressable not reachable by a screen reader: "${p.accessibilityLabel ?? textOf(node).slice(0, 30)}"`);
    }
    if ((p.accessibilityRole === 'switch' || p.accessibilityRole === 'checkbox') && typeof p.accessibilityState?.checked !== 'boolean') {
      problems.push(`${p.accessibilityRole} "${p.accessibilityLabel ?? ''}" does not say checked or not`);
    }
  }
  return problems;
}

/** Accessible names in reading order: what a screen reader visits, one after another. */
function readingOrder(root: Node): string[] {
  const names: string[] = [];
  for (const { node, hidden, grouped } of flatten(root)) {
    const p = node.props ?? {};
    if (hidden) continue;
    // A focus stop, a heading, or a plain text line that no focus stop already reads.
    const isStop = p.accessible === true || p.accessibilityRole === 'header';
    const isLoose = (node as { type?: string }).type === 'Text' && !grouped;
    if (isStop || isLoose) {
      const name = (p.accessibilityLabel as string | undefined) ?? textOf(node).trim();
      if (name && (isStop || !names.includes(name))) names.push(name);
    }
  }
  return names;
}

/** Each main screen and a URL that opens it with the sample data. */
function ROUTES(): [string, string][] {
  return [

  ['today', '/today'], ['routines', '/routines'], ['events', '/events'], ['courses', '/courses'], ['todos', '/todos'],
  ['task-routine', '/task/r1'], ['task-event', '/task/e1'], ['task-course', '/task/c1'], ['task-todo', '/task/d1'], ['task-asneeded', '/task/a1'],
  ['add', '/add'], ['add-routine', '/add/routine'], ['add-event', '/add/event'], ['add-course', '/add/course'], ['add-todo', '/add/todo'],
  ['progress', '/progress'], ['progress-trend', '/progress/trend'], ['achievements', '/achievements'], ['records', '/records'],
  ['records-cycle', '/records/c1'], ['priorities', '/priorities'], ['search', '/search'],
  ['settings', '/settings'], ['settings-data', '/settings/data'], ['settings-deleted', '/settings/data/deleted'], ['settings-erase', '/settings/data/erase'],
  ['settings-notifications', '/settings/notifications'], ['settings-agents', '/settings/agents'], ['settings-subscription', '/settings/subscription'],
  ['settings-sync', '/settings/sync'], ['settings-theme', '/settings/theme'], ['settings-widgets', '/settings/widgets'], ['settings-help', '/settings/help'],
  ['assistant', '/assistant'], ['assistant-chat', '/assistant/chat'], ['assistant-history', '/assistant/history'],
  ['assistant-history-one', '/assistant/history/x1'], ['assistant-paywall', '/assistant/paywall'], ['assistant-plan', '/assistant/paywall/plan'],
  ['assistant-byo', '/assistant/paywall/byo'], ['assistant-mic', '/assistant/mic-primer'],
  ['onb-concept', '/onboarding/concept'], ['onb-hook', '/onboarding/hook'], ['onb-types', '/onboarding/types'], ['onb-consistency', '/onboarding/consistency'],
  ['onb-personalize', '/onboarding/personalize'], ['onb-notifications', '/onboarding/notifications-primer'], ['onb-first-task', '/onboarding/first-task'],
  ['recovery', '/recovery'],
  ];
}

beforeEach(() => {
  mockClients.forEach((c) => c.clear());
  seed();
  useToastStore.setState({ toast: null });
  useCelebrationStore.setState({ queue: [] });
  useAddMenuStore.setState({ open: false } as never);
});

async function settle() {
  for (let i = 0; i < 30; i++) await act(async () => { jest.advanceTimersByTime(100); });
}

async function open(url: string) {
  await renderRouter(CONTEXT as never, { initialUrl: url });
  await settle();
  return screen.toJSON() as unknown as Node;
}

describe('every main screen', () => {
  it.each(ROUTES())('%s: one title, labelled controls, correct toggles', async (_name, url) => {
    const tree = await open(url);
    expect(loadErrors).toEqual([]);
    expect(screenProblems(tree)).toEqual([]);
    // A real screen, not an empty shell: it shows some words (guards against a silent render failure).
    expect(readingOrder(tree).length).toBeGreaterThan(1);
  });
});

describe('the key screens', () => {
  it('Today reads header, then the consistency ring, the summary, the cards, then the add button', async () => {
    const order = readingOrder(await open('/today'));
    const at = (pattern: RegExp) => order.findIndex((n) => pattern.test(n));
    const header = at(/^Today$/);
    const ring = at(/^Showing up: /);
    const achievements = at(/^Achievements/);
    const emergency = at(/^Emergency day off, the whole day$/);
    const due = at(/^Due today$/);
    const card = at(/^Evening walk, Routine, Daily/);
    const add = at(/^Add task$/);
    for (const i of [header, ring, achievements, emergency, due, card, add]) expect(i).toBeGreaterThanOrEqual(0);
    expect(header).toBeLessThan(ring);
    expect(ring).toBeLessThan(achievements);
    expect(achievements).toBeLessThan(emergency);
    expect(emergency).toBeLessThan(due);
    expect(due).toBeLessThan(card);
    expect(card).toBeLessThan(add);
  });

  it('a logged habit says its name and its state, and the change is announced', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    await open('/today');
    expect(screen.getByLabelText('Evening walk: Done').props.accessibilityState.selected).toBe(false);
    await act(async () => fireEvent.press(screen.getByLabelText('Evening walk: Done')));
    await settle();
    // Once logged, the control says the habit and the state it is in, and offers to change it.
    expect(screen.queryByLabelText('Evening walk: Done')).toBeNull();
    const logged = screen.getByLabelText(/^Evening walk, Ideal done\. Change$/);
    expect(logged.props.accessibilityRole).toBe('button');
    // The toast is the one live message: it is announced, and focus lands on its text, not on Dismiss.
    const alert = screen.getByRole('alert', { name: 'Ideal done. +10 XP' });
    expect(alert.props.accessible).toBe(true);
    expect(announce).toHaveBeenCalledWith('Ideal done. +10 XP');
    announce.mockRestore();
  });

  it('the toast offers Dismiss as its own named action (not the focus target)', async () => {
    await open('/today');
    await act(async () => useToastStore.getState().show('Saved.'));
    await settle();
    const alert = screen.getByLabelText('Saved.');
    expect(alert.props.accessibilityActions).toEqual([{ name: 'dismiss', label: 'Dismiss' }]);
    expect(within(alert).queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });

  it('a milestone is announced with its headline when it arrives', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    await open('/today');
    await act(async () => useCelebrationStore.getState().push({ kind: 'level-up', lifetimeXp: 0 }));
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await settle();
    const headlines = screen.getAllByRole('header').map((h) => instanceText(h).trim());
    const announced = announce.mock.calls.map((c) => c[0]);
    expect(announced.length).toBeGreaterThan(0);
    expect(headlines).toContain(announced[announced.length - 1]);
    announce.mockRestore();
  });

  it('the add-routine form names each step list, so its two Add step buttons are told apart', async () => {
    const tree = await open('/add/routine');
    const names = flatten(tree).map((x) => x.node.props?.accessibilityLabel).filter((l) => typeof l === 'string' && l.startsWith('Add step'));
    expect(names).toEqual(['Add step: Ideal step', 'Add step: Fallback step']);
  });

  it('the theme screen has one title header and a plain section label', async () => {
    const tree = await open('/settings/theme');
    const headers = flatten(tree).filter((x) => x.node.props?.accessibilityRole === 'header').map((x) => textOf(x.node).trim());
    expect(headers.filter((h) => h === 'Theme')).toHaveLength(1);
  });
});
