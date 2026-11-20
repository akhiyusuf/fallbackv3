/**
 * Screen-level accessibility (round 4, edge campaign): every main screen rendered through the real
 * route files with sample data, and the accessibility tree checked for headers, labelled and roled
 * pressables, toggle state, log controls, decorative icons, reading order and announced changes.
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

import { writeFileSync } from 'fs';
import { renderRouter, screen } from 'expo-router/testing-library';
import { act } from '@testing-library/react-native';

import { useAddMenuStore, useCelebrationStore, useToastStore } from '@/app-shell';
import { makeTask } from '@/features/task/testSupport/taskFixture';
import { fake } from '@/queries/testSupport/dbMock';
import { clock } from '@/queries/testSupport/clockMock';
import type { DayLog, Id, Instant, LocalDate, Step, TaskWithSteps } from '@/types';

const CONTEXT = {
  _layout: require('./_layout').default,
  index: require('./index').default,
  splash: require('./splash').default,
  search: require('./search').default,
  recovery: require('./recovery').default,
  progress: require('./progress/index').default,
  'progress/trend': require('./progress/trend').default,
  achievements: require('./achievements/index').default,
  'achievements/celebrate': require('./achievements/celebrate').default,
  priorities: require('./priorities/index').default,
  records: require('./records/index').default,
  'records/[cycleId]': require('./records/[cycleId]').default,
  settings: require('./settings/index').default,
  'settings/agents': require('./settings/agents').default,
  'settings/help': require('./settings/help').default,
  'settings/notifications': require('./settings/notifications').default,
  'settings/subscription': require('./settings/subscription').default,
  'settings/sync': require('./settings/sync').default,
  'settings/theme': require('./settings/theme').default,
  'settings/widgets': require('./settings/widgets').default,
  'settings/data/index': require('./settings/data/index').default,
  'settings/data/deleted': require('./settings/data/deleted').default,
  'settings/data/erase': require('./settings/data/erase').default,
  'onboarding/concept': require('./onboarding/concept').default,
  'onboarding/hook': require('./onboarding/hook').default,
  'onboarding/types': require('./onboarding/types').default,
  'onboarding/consistency': require('./onboarding/consistency').default,
  'onboarding/personalize': require('./onboarding/personalize').default,
  'onboarding/notifications-primer': require('./onboarding/notifications-primer').default,
  'onboarding/first-task': require('./onboarding/first-task').default,
  'add/index': require('./add/index').default,
  'add/routine': require('./add/routine').default,
  'add/event': require('./add/event').default,
  'add/course': require('./add/course').default,
  'add/todo': require('./add/todo').default,
  'task/[id]/index': require('./task/[id]/index').default,
  'task/[id]/icon': require('./task/[id]/icon').default,
  'task/[id]/delete': require('./task/[id]/delete').default,
  'task/[id]/as-needed': require('./task/[id]/as-needed').default,
  'task/[id]/celebrate': require('./task/[id]/celebrate').default,
  'assistant/index': require('./assistant/index').default,
  'assistant/chat': require('./assistant/chat').default,
  'assistant/mic-primer': require('./assistant/mic-primer').default,
  'assistant/paywall/index': require('./assistant/paywall/index').default,
  'assistant/paywall/plan': require('./assistant/paywall/plan').default,
  'assistant/paywall/byo': require('./assistant/paywall/byo').default,
  'assistant/history/index': require('./assistant/history/index').default,
  'assistant/history/[id]': require('./assistant/history/[id]').default,
  '(tabs)/_layout': require('./(tabs)/_layout').default,
  '(tabs)/today': require('./(tabs)/today').default,
  '(tabs)/routines': require('./(tabs)/routines').default,
  '(tabs)/events': require('./(tabs)/events').default,
  '(tabs)/courses': require('./(tabs)/courses').default,
  '(tabs)/todos': require('./(tabs)/todos').default,
};

const D1 = '2026-07-16';
const at = (d: string, h = 12) => `${d}T${String(h).padStart(2, '0')}:00:00.000Z`;
const OUT = '/tmp/claude-0/-home-user-fallbackv3/4065cf9b-48bb-5876-bcc5-38bb70a7fbe9/scratchpad/';

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

const mockLog = (taskId: string, date: string, patch: Partial<DayLog> = {}): DayLog => ({
  id: `log-${taskId}-${date}` as Id, taskId: taskId as Id, date: date as LocalDate, chipState: null, isManualOverride: false,
  completedStepIds: [], dosesCompleted: 0, movedToDate: null, createdAt: at(date, 8) as Instant, updatedAt: at(date, 8) as Instant, ...patch,
});

beforeEach(() => {
  mockClients.forEach((c) => c.clear());
  seed();
  useToastStore.setState({ toast: null });
  useCelebrationStore.setState({ queue: [] });
  useAddMenuStore.setState({ open: false } as never);
});


type Node = string | null | undefined | { type?: string; props?: Record<string, any>; children?: Node[] | null };
type Finding = { screen: string; kind: string; detail: string };
interface Flat { node: Exclude<Node, string | null | undefined>; hidden: boolean; inButton: boolean; path: string }

const PRESS_HOST = (p: Record<string, any>) => typeof p.onResponderRelease === 'function' || typeof p.onClick === 'function';

function textOf(n: Node): string {
  if (n == null) return '';
  if (typeof n === 'string') return n;
  return (n.children ?? []).map(textOf).join('');
}

function flatten(root: Node): Flat[] {
  const out: Flat[] = [];
  const visit = (n: Node, hidden: boolean, inButton: boolean, path: string) => {
    if (n == null || typeof n === 'string') return;
    const p = n.props ?? {};
    const selfHidden = p.accessibilityElementsHidden === true || p.importantForAccessibility === 'no-hide-descendants' || p.importantForAccessibility === 'no';
    const h = hidden || selfHidden;
    out.push({ node: n, hidden: h, inButton, path });
    const btn = inButton || (PRESS_HOST(p) && p.accessible === true);
    (n.children ?? []).forEach((c, i) => visit(c, h, btn, `${path}/${n.type}[${i}]`));
  };
  visit(root, false, false, '');
  return out;
}

const BAD_LABEL = /^(button|icon|image|touchable|pressable|svg|chevron.*|close|x|plus|tap|press|view|option|item|row|card)$/i;
const ICON_NAME = /^[A-Z][a-z]+(?:[A-Z][a-z0-9]+)+$/;

function audit(screen: string, root: Node): Finding[] {
  const f: Finding[] = [];
  const flat = flatten(root);
  const headers = flat.filter((x) => x.node.props?.accessibilityRole === 'header');
  if (headers.length !== 1) f.push({ screen, kind: 'headers', detail: `${headers.length} header(s): ${headers.map((h) => textOf(h.node)).join(' | ')}` });
  const pressables = flat.filter((x) => PRESS_HOST(x.node.props ?? {}) && x.node.props?.accessible === true);
  const seen = new Map<string, number>();
  for (const x of pressables) {
    const p = x.node.props ?? {};
    const label = (p.accessibilityLabel as string | undefined) ?? '';
    const text = textOf(x.node).trim();
    if (!p.accessibilityRole || p.accessibilityRole === 'none') f.push({ screen, kind: 'pressable-role', detail: `"${label || text}"` });
    if (!label) f.push({ screen, kind: 'pressable-label', detail: `no label; text="${text.slice(0, 60)}"` });
    else if (BAD_LABEL.test(label) || ICON_NAME.test(label)) f.push({ screen, kind: 'pressable-label-bad', detail: `"${label}"` });
    if (label) seen.set(label, (seen.get(label) ?? 0) + 1);
  }
  for (const [label, n] of seen) if (n > 1) f.push({ screen, kind: 'duplicate-label', detail: `"${label}" x${n}` });
  for (const x of flat) {
    const p = x.node.props ?? {};
    if ((p.accessibilityRole === 'switch' || p.accessibilityRole === 'checkbox') && typeof p.accessibilityState?.checked !== 'boolean')
      f.push({ screen, kind: 'toggle-state', detail: `${p.accessibilityRole} "${p.accessibilityLabel ?? ''}" has no checked` });
    if (x.node.type === 'RNSVGSvgView' && !x.hidden && !x.inButton) f.push({ screen, kind: 'icon-visible', detail: `icon not hidden at ${x.path}` });
  }
  return f;
}

const ROUTES: [string, string][] = [
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

const findings: Finding[] = [];
const ok: string[] = [];

it.each(ROUTES)('screen %s', async (name, url) => {
  await renderRouter(CONTEXT as never, { initialUrl: url });
  await act(async () => undefined);
  await act(async () => new Promise((r) => setTimeout(r, 50)));
  const tree = screen.toJSON() as Node;
  writeFileSync(OUT + `screen-${name}.json`, JSON.stringify(tree, (k, v) => (typeof v === 'function' ? 'FN' : v), 1));
  const f = audit(name, tree);
  findings.push(...f);
  ok.push(name);
});

afterAll(() => {
  writeFileSync(OUT + 'findings.json', JSON.stringify({ findings, ok }, null, 1));
});
