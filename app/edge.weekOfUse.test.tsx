/**
 * Round 4, report 43: A WEEK OF REAL USE THROUGH THE SCREENS.
 *
 * Monday 13 Jul to Sunday 19 Jul 2026, one person, the real router and root layout, fake repositories
 * and a movable clock. Each day is visited in the morning, the afternoon and late in the evening and the
 * screens are read the way the person reads them (Today, Routines, Courses, To-dos, Progress, Achievements,
 * the pop-ups, and the reminders armed for the next day).
 *
 * Every expected value below was worked out by hand from the rules (docs/DESIGN_DECISIONS.md, the PRD
 * rules the domain comments quote), BEFORE running, and is written next to the check as a comment. The
 * checks are SOFT: every one is recorded as (day, moment, what, expected, seen) and the whole table can
 * be dumped (WEEK_JSON=/path) for the report; the test fails at the end if any non-bug row differs.
 * A row that is a real app bug carries a bug id: it is left out of the main assertion and each id has an
 * `it.failing` test that asserts the correct value.
 *
 * THE PERSON
 *   Stretch    daily routine, ideal "Stretch 10 min", fallback "Touch toes"
 *   Gym        Mon-Fri routine at 07:00, two ideal steps (Warm up, Lift), fallback "Walk"
 *   Antibiotic a course 13-22 Jul, three doses a day (08:00), no ideal step, fallback "Take what you can"
 *   Team sync  a weekly repeating event, Tuesdays 09:30
 *   Meditate   an as-needed routine
 *   Buy stamps, Call dentist: two to-dos
 *
 * RULES USED (first principles)
 *   - Tap Done = ideal (10 XP), Fallback = fallback (6 XP). Ticking some but not all ideal steps, or some
 *     but not all doses, logs the day as a FALLBACK by itself; all of them = ideal (XP is topped up, never
 *     given twice). Shown up = ideal or fallback.
 *   - A day's fraction f = shown up / resolved (ideal, fallback, missed) among what was due; pending and off
 *     tasks are left out; a day with nothing resolved is not counted. Showing up = sum f / counted days,
 *     over the last 30 counted days. "x of y days" is x = round(sum f), y = counted days.
 *   - A due day that ends with nothing logged is missed. A day pushed to tomorrow leaves its day (not due
 *     there, never missed) and appears on tomorrow as a second card, "From yesterday".
 *   - Emergency day off (whole day): everything due that day is off: not counted for or against, no XP.
 *   - End routine: ended on today if it was logged today, else yesterday; nothing due afterwards, past days stay.
 *   - Level L needs 100 + 150 (L - 1) XP: level 1 to 2 at 100 XP, level 2 to 3 at 250 more.
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

const mockSchedule = jest.fn().mockResolvedValue('id');
const mockCancelAll = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-notifications', () => ({
  ...jest.requireActual('expo-notifications'),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: () => undefined })),
  getPermissionsAsync: () => Promise.resolve({ granted: true }),
  requestPermissionsAsync: () => Promise.resolve({ granted: true }),
  scheduleNotificationAsync: (req: unknown) => mockSchedule(req),
  cancelAllScheduledNotificationsAsync: () => mockCancelAll(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  setNotificationHandler: jest.fn(),
}));

import * as fs from 'fs';
import { BackHandler } from 'react-native';
import { routingQueue } from 'expo-router/build/global-state/routingQueue';
import { store as routerStore } from 'expo-router/build/global-state/router-store';
import { renderRouter, screen } from 'expo-router/testing-library';
import { act, userEvent, waitFor, within } from '@testing-library/react-native';

import { useAddMenuStore, useCelebrationStore, useToastStore } from '@/app-shell';
import { notifications } from '@/services/notifications';
import { fake } from '@/queries/testSupport/dbMock';
import { clock } from '@/queries/testSupport/clockMock';
import { makeTask } from '@/features/task/testSupport/taskFixture';
import type { Id, LocalDate, Step, TaskWithSteps } from '@/types';

const CONTEXT = {
  _layout: require('./_layout').default,
  index: require('./index').default,
  splash: require('./splash').default,
  search: require('./search').default,
  progress: require('./progress/index').default,
  'progress/trend': require('./progress/trend').default,
  achievements: require('./achievements/index').default,
  priorities: require('./priorities/index').default,
  settings: require('./settings/index').default,
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
  '(tabs)/_layout': require('./(tabs)/_layout').default,
  '(tabs)/today': require('./(tabs)/today').default,
  '(tabs)/routines': require('./(tabs)/routines').default,
  '(tabs)/events': require('./(tabs)/events').default,
  '(tabs)/courses': require('./(tabs)/courses').default,
  '(tabs)/todos': require('./(tabs)/todos').default,
};

/* ------------------------------------------------------------------ the soft table */

interface Row {
  day: string;
  when: string;
  what: string;
  expected: unknown;
  seen: unknown;
  ok: boolean;
  bug?: string;
}
const rows: Row[] = [];
const bugs: Record<string, Row> = {};
let curDay = '';
let curWhen = '';
const action = (day: string, when: string, what: string) => {
  curDay = day;
  curWhen = when;
  rows.push({ day, when, what: `ACTION: ${what}`, expected: '', seen: '', ok: true });
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function record(what: string, expected: unknown, seen: unknown, bug?: string) {
  const ok = same(expected, seen);
  const row: Row = { day: curDay, when: curWhen, what, expected, seen, ok, bug };
  rows.push(row);
  if (!ok && bug) bugs[bug] = row;
}
/** Reads until it matches (a few ticks for the screen to settle) and records what it last saw. */
async function expectSeen<T>(what: string, expected: T, reader: () => T, bug?: string) {
  let last: unknown;
  try {
    await waitFor(
      () => {
        try {
          last = reader();
        } catch (e) {
          last = `ERR ${(e as Error).message.split('\n')[0]}`;
          throw e;
        }
        if (!same(last, expected)) throw new Error('differs');
      },
      { timeout: 1200, interval: 50 },
    );
  } catch {
    /* recorded below */
  }
  record(what, expected, last, bug);
}

/* ------------------------------------------------------------------ the world */

const MON = '2026-07-13';
const DAYS = ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19', '2026-07-20'];
const [, TUE, WED, THU, FRI, SAT, SUN, NEXT_MON] = DAYS;

function setClock(date: string, hh: number, mm = 0) {
  const [y, m, d] = date.split('-').map(Number);
  const local = new Date(y!, m! - 1, d!, hh, mm, 0, 0);
  clock.today = date;
  clock.now = local.toISOString();
  jest.setSystemTime(local);
}

const created = new Date(2026, 6, 13, 7, 0).toISOString() as never;
function step(taskId: string, role: 'ideal' | 'fallback', text: string, position: number): Step {
  return { id: `${taskId}-${role}-${position}` as Id, taskId: taskId as Id, role, text, position, dueWeekdays: null };
}
function seedWeek() {
  const base = { createdAt: created, updatedAt: created, createdOn: MON as LocalDate };
  fake.seedTask(
    makeTask({ ...base, id: 'stretch' as Id, name: 'Stretch', cadence: { kind: 'daily' }, idealSteps: [step('stretch', 'ideal', 'Stretch 10 min', 0)], fallbackSteps: [step('stretch', 'fallback', 'Touch toes', 0)] }),
  );
  fake.seedTask(
    makeTask({
      ...base,
      id: 'gym' as Id,
      name: 'Gym',
      timeOfDay: '07:00',
      cadence: { kind: 'specific-weekdays', weekdays: [1, 2, 3, 4, 5] },
      idealSteps: [step('gym', 'ideal', 'Warm up', 0), step('gym', 'ideal', 'Lift', 1)],
      fallbackSteps: [step('gym', 'fallback', 'Walk', 0)],
    }),
  );
  fake.seedTask(
    makeTask({
      ...base,
      id: 'abx' as Id,
      type: 'course',
      name: 'Antibiotic',
      timeOfDay: '08:00',
      cadence: { kind: 'daily' },
      startDate: MON as LocalDate,
      endDate: '2026-07-22' as LocalDate,
      dosesPerDay: 3,
      idealSteps: [],
      fallbackSteps: [step('abx', 'fallback', 'Take what you can', 0)],
    }),
  );
  fake.seedTask(
    makeTask({
      ...base,
      id: 'sync' as Id,
      type: 'event',
      name: 'Team sync',
      timeOfDay: '09:30',
      cadence: { kind: 'weekly', weekday: 2, anchorDate: MON as LocalDate },
      idealSteps: [],
      fallbackSteps: [],
    }),
  );
  fake.seedTask(makeTask({ ...base, id: 'med' as Id, name: 'Meditate', isAsNeeded: true, cadence: null, idealSteps: [], fallbackSteps: [] }));
  fake.seedTask(makeTask({ ...base, id: 'stamps' as Id, type: 'todo', name: 'Buy stamps', cadence: null, isTracked: false, idealSteps: [], fallbackSteps: [], importance: 'high' }));
  fake.seedTask(makeTask({ ...base, id: 'dentist' as Id, type: 'todo', name: 'Call dentist', cadence: null, isTracked: false, idealSteps: [], fallbackSteps: [], importance: 'med' }));
}

let backListeners: (() => boolean | null | undefined)[] = [];
const celebrationsEarned: string[] = [];
let unsubscribeCelebrations: (() => void) | null = null;

beforeEach(() => {
  routingQueue.queue = [];
  backListeners = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_e: string, l: () => boolean) => {
    backListeners.push(l);
    return { remove: () => void (backListeners = backListeners.filter((x) => x !== l)) };
  }) as never);
  mockClients.forEach((c) => c.clear());
  fake.reset();
  fake.seedSettings({
    tenureAnchorDate: MON as LocalDate,
    notifications: {
      master: true,
      routineDue: true,
      eventStarting: true,
      courseDose: true,
      courseEndingSoon: true,
      gentleReentry: false,
      milestoneReached: false,
      dailyDigest: false,
      dailyDigestTime: '08:00',
    },
  });
  clock.today = MON;
  clock.now = new Date(2026, 6, 13, 8, 0).toISOString();
  useToastStore.setState({ toast: null });
  useCelebrationStore.setState({ queue: [] });
  useAddMenuStore.setState({ open: false } as never);
  mockSchedule.mockClear();
  mockCancelAll.mockClear();
});

afterEach(() => {
  if (process.env.WEEK_JSON && rows.length > 0) fs.writeFileSync(process.env.WEEK_JSON, JSON.stringify(rows, null, 1));
});

/* ------------------------------------------------------------------ driving the app */

const path = () => routerStore.getRouteInfo().pathname;
async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}
async function settle(n = 3) {
  for (let i = 0; i < n; i++) await advance(60);
}
async function press(label: string | RegExp) {
  await userEvent.press(await screen.findByLabelText(label));
  await settle();
}
async function openTab(label: 'Today' | 'Routines' | 'Events' | 'Courses' | 'To-dos') {
  await userEvent.press(await screen.findByLabelText(label));
  await settle();
}
async function backToToday() {
  await press('Back');
  await waitFor(() => expect(path()).toBe('/today'));
  await settle();
}
/** Midnight (or a morning) arrives with the app open: the shell notices within 30 s. */
async function moveTo(date: string, hh: number, mm = 0) {
  setClock(date, hh, mm);
  await advance(31_000);
  await settle();
}

/** Pop-ups the person sees (one after the other, each dismissed with "Nice"). */
async function dismissCelebrations(): Promise<string[]> {
  const shown: string[] = [];
  for (let i = 0; i < 5; i++) {
    await advance(3000);
    const nice = screen.queryByLabelText('Nice');
    if (!nice) break;
    const headline = screen.queryByText(/^(You've reached .*|Badge earned: .*|You're now Level \d+)\.$/);
    shown.push(headline ? String(headline.props.children) : '?');
    await userEvent.press(nice);
    await settle();
  }
  return shown;
}

/* ------------------------------------------------------------------ reading the screens */

const CODE: Record<string, string> = { ideal: 'I', fallback: 'F', 'off day': 'O', missed: 'X', 'not logged yet': 'o', 'not due': '-' };
function strip(scope: ReturnType<typeof within> | typeof screen): string {
  const node = scope.queryByLabelText(/^Last seven days:/);
  if (!node) return 'NO STRIP';
  const text = String(node.props.accessibilityLabel).replace('Last seven days: ', '');
  return text
    .split(', ')
    .map((p) => CODE[p.slice(p.indexOf(' ') + 1)] ?? '?')
    .join('');
}

function todayRows(): string[] {
  const cards = screen.queryAllByLabelText(/\. Opens the task$/);
  const out = cards.map((c) => {
    const label = String(c.props.accessibilityLabel);
    const name = label.split(', ')[0]!;
    const pushed = /From yesterday/.test(label);
    const status = within(c).queryByText(/^(Ideal done|Fallback done|Skipped)$/);
    const code = status ? (String(status.props.children) === 'Ideal done' ? 'I' : String(status.props.children) === 'Fallback done' ? 'F' : 'S') : 'open';
    return { name, pushed, text: `${name}${pushed ? ' (from yesterday)' : ''}: ${code}` };
  });
  // Two cards of one habit (its own and the pushed one): the order between them is not part of the contract.
  for (let i = 0; i + 1 < out.length; i++) {
    if (out[i]!.name === out[i + 1]!.name && out[i]!.pushed && !out[i + 1]!.pushed) [out[i], out[i + 1]] = [out[i + 1]!, out[i]!];
  }
  return out.map((o) => o.text);
}
const doneCount = () => String(screen.getByText(/^\d+ of \d+ done$/).props.children).replace(/,/g, '');
const offPills = () => screen.queryAllByText('Off today').length;
function ring(): string {
  const label = String(screen.getAllByLabelText(/^Consistency:/)[0]!.props.accessibilityLabel);
  const m = /^Consistency: (\d+) percent/.exec(label);
  return m ? `${m[1]}%` : 'No data yet';
}
function xOfY(): string {
  const n = screen.getByText(/(days? in the last 30|of the last 30 days|^No data yet$)/);
  return String(n.props.children);
}
const levelOnToday = () => String(screen.getByText(/^Level \d+$/).props.children);

/** Does "x of y days" agree with the percent beside it, to within the rounding of x? */
function agrees(ringText: string, line: string): boolean {
  const pct = /^(\d+)%$/.exec(ringText);
  const m = /^(\d+) of (\d+) days?/.exec(line);
  if (!pct || !m) return ringText === 'No data yet' && line === 'No data yet';
  const x = Number(m[1]);
  const y = Number(m[2]);
  // x is the weighted sum rounded to a whole day, so it can be off by half a day.
  return Math.abs((x / y) * 100 - Number(pct[1])) <= 50 / y + 0.5;
}

async function todaySnapshot(expected: { rows: string[]; done: string; ring: string; line: string; off?: number; level?: string }, bug?: Record<string, string>) {
  await openTab('Today');
  await expectSeen('Today list and order', expected.rows, todayRows, bug?.rows);
  await expectSeen('Today done count', expected.done, doneCount, bug?.done);
  await expectSeen('Showing up ring', expected.ring, ring, bug?.ring);
  await expectSeen('"x of y days in the last 30" line', expected.line, xOfY, bug?.line);
  await expectSeen('ring and line agree (to the rounding of x)', true, () => agrees(ring(), xOfY()), bug?.agree);
  if (expected.off !== undefined) await expectSeen('cards showing "Off today"', expected.off, offPills);
  if (expected.level) await expectSeen('Level row on Today', expected.level, levelOnToday);
}

/** Routines tab: the sections and which cards sit in each, read in screen order. */
function flatten(node: unknown, out: { label?: string; text?: string }[]) {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) return node.forEach((n) => flatten(n, out));
  if (typeof node === 'string') return void out.push({ text: node });
  const n = node as { props?: Record<string, unknown>; children?: unknown };
  if (typeof n.props?.accessibilityLabel === 'string') out.push({ label: n.props.accessibilityLabel as string });
  flatten(n.children, out);
}
function routineSections(): string {
  const items: { label?: string; text?: string }[] = [];
  flatten(screen.toJSON(), items);
  const heads = /^(Due \w+|Other routines|As needed|Ended)$/;
  const names = ['Stretch', 'Gym', 'Meditate'];
  const sections: { head: string; names: string[] }[] = [];
  for (const it of items) {
    if (it.text && heads.test(it.text)) {
      if (!sections.some((s) => s.head === it.text)) sections.push({ head: it.text, names: [] });
      continue;
    }
    if (it.label && !/Opens the task/.test(it.label)) {
      const name = names.find((nm) => it.label!.startsWith(`${nm}, `));
      if (name && sections.length > 0) {
        const cur = sections[sections.length - 1]!;
        if (!cur.names.includes(name)) cur.names.push(name);
      }
    }
  }
  return sections.map((s) => `${s.head}: ${[...s.names].sort().join(', ') || '(none)'}`).join(' | ');
}

function progressRead(): string {
  const pct = screen.queryAllByLabelText(/ percent showed up$/)[0];
  if (!pct) return 'NO RING';
  const p = String(pct.props.accessibilityLabel).replace(' showed up', '');
  const tile = (l: string) => String(screen.getByLabelText(new RegExp(`^${l}: `)).props.accessibilityLabel).replace(`${l}: `, '');
  const counted = screen.queryByText(/counted days/);
  return `${p}; ${counted ? String(counted.props.children) : '?'}; Ideal ${tile('Ideal')}, Fallback ${tile('Fallback')}, Off ${tile('Off')}, Missed ${tile('Missed')}`;
}
async function openProgress(scope?: 'All tasks' | string) {
  await userEvent.press((await screen.findAllByLabelText(/^Consistency/))[0]!);
  await waitFor(() => expect(path()).toBe('/progress'));
  await settle();
  if (scope) await press(scope);
}
async function closeProgress() {
  await backToToday();
}

function achievementsRead() {
  const level = String(screen.getByLabelText(/^Level \d+, /).props.accessibilityLabel);
  const earned = screen
    .queryAllByLabelText(/, earned$/)
    .map((n) => String(n.props.accessibilityLabel).replace(', earned', ''))
    .sort();
  return { level, earned };
}
async function openAchievements() {
  await userEvent.press(await screen.findByText('Achievements'));
  await waitFor(() => expect(path()).toBe('/achievements'));
  await settle();
}

/** The reminders armed for one date, as the OS would be told, read after a re-arm at this moment. */
async function remindersFor(date: string): Promise<{ onDate: string[]; today: string[] }> {
  mockSchedule.mockClear();
  await act(async () => {
    await notifications.reschedule();
  });
  const calls = mockSchedule.mock.calls.map((c) => c[0] as { identifier: string; trigger: { date: Date } });
  const local = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const idOf = (c: { identifier: string }) => c.identifier.replace('fallback-reminder:', '');
  return {
    onDate: calls.filter((c) => local(c.trigger.date) === date).map(idOf).sort(),
    today: calls.filter((c) => local(c.trigger.date) === clock.today).map(idOf).sort(),
  };
}
const ids = (kind: string, taskIds: string[], date: string) => taskIds.map((t) => `${kind}:${t}:${date}`);

/* ------------------------------------------------------------------ the week */

describe('a week of real use, Monday to Sunday', () => {
  it('Mon 13 to Sun 19 Jul: every screen agrees with the rules at every moment', async () => {
    seedWeek();
    celebrationsEarned.length = 0;
    unsubscribeCelebrations?.();
    let seenQueue = 0;
    unsubscribeCelebrations = useCelebrationStore.subscribe((s) => {
      if (s.queue.length > seenQueue) {
        for (const c of s.queue.slice(seenQueue)) celebrationsEarned.push(c.kind === 'badge' ? c.badgeKey : `level-up`);
      }
      seenQueue = s.queue.length;
    });

    await renderRouter(CONTEXT, { initialUrl: '/today' });
    setClock(MON, 8, 0);
    await screen.findByText('Stretch');
    await settle();

    /* ================================================================ MONDAY 13 */
    action('Mon', '08:00', 'open the app, nothing logged yet');
    // Due: Stretch (daily), Gym (Mon-Fri), Antibiotic (day 1 of the course). Team sync is Tuesdays. Order: no time first,
    // then by time: Stretch, Gym 07:00, Antibiotic 08:00. Nothing resolved yet, so no percent.
    await todaySnapshot({ rows: ['Stretch: open', 'Gym: open', 'Antibiotic: open'], done: '0 of 3', ring: 'No data yet', line: 'No data yet', level: 'Level 1' });

    action('Mon', '08:10', 'Stretch: Done');
    await press('Stretch: Done');
    // Ideal = 10 XP. First log of the first day: the First day badge.
    const popM1 = await dismissCelebrations();
    await expectSeen('pop-ups after the first log', ["You've reached First day."], () => popM1);
    // Only Stretch resolved: day fraction 1/1 -> 100 percent, "1 of 1 day".
    await todaySnapshot({ rows: ['Stretch: I', 'Gym: open', 'Antibiotic: open'], done: '1 of 3', ring: '100%', line: '1 of 1 day in the last 30' });

    action('Mon', '08:20', 'Gym: tick Warm up, then Lift (task page)');
    await userEvent.press(await screen.findByLabelText(/^Gym, .*Opens the task/));
    await waitFor(() => expect(path()).toMatch(/^\/task\//));
    await press('Warm up');
    // One of two steps = a fallback by the auto rule: +6 XP, and it is the first fallback: Safety net.
    const popM2 = await dismissCelebrations();
    await expectSeen('pop-ups after the first step (a fallback by rule)', ['Badge earned: Safety net.'], () => popM2);
    await press('Lift');
    await dismissCelebrations();
    await backToToday();
    await todaySnapshot({ rows: ['Stretch: I', 'Gym: I', 'Antibiotic: open'], done: '2 of 3', ring: '100%', line: '1 of 1 day in the last 30' });
    await expectSeen('lifetime XP after Stretch 10 + Gym 6 + 4', 20, () => fake.xpAwards().reduce((s, a) => s + a.amount, 0));

    action('Mon', '14:00', 'Antibiotic: dose 1 of 3 (task page), then Routines and Courses tabs');
    setClock(MON, 14, 0);
    await userEvent.press(await screen.findByLabelText(/^Antibiotic, .*Opens the task/));
    await waitFor(() => expect(path()).toMatch(/^\/task\//));
    await press('Dose 1 of 3: Done');
    await dismissCelebrations();
    await backToToday();
    // Some but not all doses = a fallback by rule (6 XP). 3 of 3 handled.
    await todaySnapshot({ rows: ['Stretch: I', 'Gym: I', 'Antibiotic: F'], done: '3 of 3', ring: '100%', line: '1 of 1 day in the last 30' });
    await openTab('Routines');
    await expectSeen('Routines sections on Monday', 'Due Monday: Gym, Stretch | As needed: Meditate', routineSections);
    await expectSeen('Routines: Stretch week strip (Jul 7..13)', '------I', () => strip(within(screen.getByLabelText(/^Stretch, /))));
    await expectSeen('Routines: Gym week strip', '------I', () => strip(within(screen.getByLabelText(/^Gym, /))));
    await openTab('Courses');
    await expectSeen('Courses: Antibiotic week strip (dose 1 only: fallback)', '------F', () => strip(within(screen.getByLabelText(/^Antibiotic, /))));

    action('Mon', '22:00', 'Antibiotic: dose 3 (it jumps to all three taken)');
    setClock(MON, 22, 0);
    await openTab('Today');
    await userEvent.press(await screen.findByLabelText(/^Antibiotic, .*Opens the task/));
    await waitFor(() => expect(path()).toMatch(/^\/task\//));
    await press('Dose 3 of 3: Done');
    await dismissCelebrations();
    await backToToday();
    action('Mon', '22:30', 'late evening check');
    setClock(MON, 22, 30);
    await todaySnapshot({ rows: ['Stretch: I', 'Gym: I', 'Antibiotic: I'], done: '3 of 3', ring: '100%', line: '1 of 1 day in the last 30' });
    await expectSeen('lifetime XP Monday: three ideals', 30, () => fake.xpAwards().reduce((s, a) => s + a.amount, 0));
    await openTab('Courses');
    await expectSeen('Courses: Antibiotic week strip after all doses', '------I', () => strip(within(screen.getByLabelText(/^Antibiotic, /))));
    await openTab('Today');
    await openAchievements();
    await expectSeen('Achievements Monday: level card', 'Level 1, Getting started. 30 of 100 XP', () => achievementsRead().level);
    await expectSeen('Achievements Monday: earned', ['First day', 'Safety net'], () => achievementsRead().earned);
    await backToToday();
    // Tomorrow (Tue 14): Stretch 09:00 default, Gym 07:00, Antibiotic dose 08:00, Team sync 09:30 (weekly, Tuesdays).
    const remMon = await remindersFor(TUE!);
    await expectSeen(
      'reminders armed for Tuesday',
      [...ids('routine-due', ['stretch', 'gym'], TUE!), ...ids('course-dose', ['abx'], TUE!), ...ids('event-starting', ['sync'], TUE!)].sort(),
      () => remMon.onDate,
    );
    await expectSeen('reminders still armed for the rest of Monday (all times are past)', [], () => remMon.today);

    /* ================================================================ TUESDAY 14 */
    await moveTo(TUE!, 8, 30);
    action('Tue', '08:30', 'midnight passed with the app open');
    // Team sync joins (09:30). Monday is the only counted day so far: 100 percent, 1 of 1.
    await todaySnapshot({
      rows: ['Stretch: open', 'Gym: open', 'Antibiotic: open', 'Team sync: open'],
      done: '0 of 4',
      ring: '100%',
      line: '1 of 1 day in the last 30',
    });

    action('Tue', '08:40', 'Stretch: Fallback; Gym: Push to tomorrow');
    await press('Stretch: Fallback');
    await dismissCelebrations();
    await press('Gym: Push to tomorrow');
    await dismissCelebrations();
    // Gym leaves Tuesday (not due, not missed). 6 XP for the fallback.
    await todaySnapshot({ rows: ['Stretch: F', 'Antibiotic: open', 'Team sync: open'], done: '1 of 3', ring: '100%', line: '2 of 2 days in the last 30' });

    action('Tue', '15:00', 'Antibiotic: doses 1 and 2 only (forgets the third); Team sync is forgotten');
    setClock(TUE!, 15, 0);
    await userEvent.press(await screen.findByLabelText(/^Antibiotic, .*Opens the task/));
    await waitFor(() => expect(path()).toMatch(/^\/task\//));
    await press('Dose 1 of 3: Done');
    await press('Dose 2 of 3: Done');
    await dismissCelebrations();
    await backToToday();
    await todaySnapshot({ rows: ['Stretch: F', 'Antibiotic: F', 'Team sync: open'], done: '2 of 3', ring: '100%', line: '2 of 2 days in the last 30' });

    action('Tue', '22:30', 'late evening check');
    setClock(TUE!, 22, 30);
    await expectSeen('lifetime XP Tuesday (30 + 6 + 6)', 42, () => fake.xpAwards().reduce((s, a) => s + a.amount, 0));
    await openTab('Routines');
    await expectSeen('Gym week strip: Tuesday is empty (pushed away, not missed)', '-----I-', () => strip(within(screen.getByLabelText(/^Gym, /))));
    await expectSeen('Stretch week strip', '-----IF', () => strip(within(screen.getByLabelText(/^Stretch, /))));
    await openTab('Courses');
    await expectSeen('Antibiotic week strip (two doses of three: fallback)', '-----IF', () => strip(within(screen.getByLabelText(/^Antibiotic, /))));
    await openTab('Today');
    // Wednesday: Stretch, Gym (own), Antibiotic; the pushed Gym is also on Wednesday but its card is not a reminder.
    const remTue = await remindersFor(WED!);
    await expectSeen(
      'reminders armed for Wednesday',
      [...ids('routine-due', ['stretch', 'gym'], WED!), ...ids('course-dose', ['abx'], WED!)].sort(),
      () => remTue.onDate,
    );

    /* ================================================================ WEDNESDAY 15 */
    await moveTo(WED!, 8, 0);
    action('Wed', '08:00', 'midnight passed with the app open; Tuesday has settled');
    // Tuesday settles: Stretch F, Antibiotic F, Team sync missed = 2/3 (Gym was pushed away). Monday 1.
    // sum = 1.667 over 2 days = 83 percent; x = round(1.667) = 2: "2 of 2 days".
    await todaySnapshot({
      rows: ['Stretch: open', 'Gym: open', 'Gym (from yesterday): open', 'Antibiotic: open'],
      done: '0 of 4',
      ring: '83%',
      line: '2 of 2 days in the last 30',
    });
    await expectSeen('Gym (pushed from yesterday) is labelled', true, () => screen.queryAllByLabelText(/^Gym, .*From yesterday/).length === 1);

    action('Wed', '08:05', 'Emergency day off, the whole day');
    await press('Emergency day off, the whole day');
    // Everything off: not counted for or against. The percent and the line do not move.
    await todaySnapshot(
      { rows: ['Stretch: open', 'Gym: open', 'Gym (from yesterday): open', 'Antibiotic: open'], done: '0 of 4', ring: '83%', line: '2 of 2 days in the last 30', off: 4 },
    );

    action('Wed', '12:00', 'Meditate (as-needed): Log used it');
    setClock(WED!, 12, 0);
    await openTab('Routines');
    await userEvent.press(await screen.findByLabelText(/^Meditate, /));
    await waitFor(() => expect(path()).toMatch(/^\/task\/.*as-needed/));
    await press('Log used it');
    await expectSeen('as-needed use is in the history', true, () => screen.queryAllByText('Jul 15').length > 0);
    await press('Back');
    await waitFor(() => expect(path()).toBe('/routines'));
    // No XP, nothing due, no consistency: the totals stay.
    await expectSeen('lifetime XP unchanged by an as-needed use', 42, () => fake.xpAwards().reduce((s, a) => s + a.amount, 0));

    action('Wed', '15:00', 'Routines tab');
    setClock(WED!, 15, 0);
    // The person opened Routines on Monday and left the tab alone: the day picker must now start on Wednesday.
    await expectSeen('Routines sections on Wednesday', 'Due Wednesday: Gym, Stretch | As needed: Meditate', routineSections, 'B1-stale-weekday');
    await expectSeen('Stretch week strip (Jul 9..15, Wed is off)', '----IFO', () => strip(within(screen.getByLabelText(/^Stretch, /))));
    await expectSeen('Gym week strip (Wed off)', '----I-O', () => strip(within(screen.getByLabelText(/^Gym, /))));
    await openTab('Courses');
    await expectSeen('Antibiotic week strip (Wed off)', '----IFO', () => strip(within(screen.getByLabelText(/^Antibiotic, /))));
    await openTab('Today');

    action('Wed', '22:30', 'late evening check');
    setClock(WED!, 22, 30);
    await openAchievements();
    await expectSeen('Achievements Wednesday: level card (XP unchanged by a day off)', 'Level 1, Getting started. 42 of 100 XP', () => achievementsRead().level);
    await backToToday();
    const remWed = await remindersFor(THU!);
    await expectSeen(
      'reminders armed for Thursday',
      [...ids('routine-due', ['stretch', 'gym'], THU!), ...ids('course-dose', ['abx'], THU!)].sort(),
      () => remWed.onDate,
    );

    /* ================================================================ THURSDAY 16: the app is never opened */
    // (the clock simply moves; the person does nothing)

    /* ================================================================ FRIDAY 17 */
    await moveTo(FRI!, 8, 30);
    action('Fri', '08:30', 'opens the app after the forgotten Thursday');
    // Counted days: Mon 1, Tue 2/3, Thu 0 (all three missed); Wed was off. sum 1.667 over 3 = 56 percent; x = 2: "2 of 3 days".
    await todaySnapshot({ rows: ['Stretch: open', 'Gym: open', 'Antibiotic: open'], done: '0 of 3', ring: '56%', line: '2 of 3 days in the last 30', level: 'Level 1' });
    await openTab('Routines');
    await expectSeen('Stretch week strip with Thursday missed (Jul 11..17)', '--IFOXo', () => strip(within(screen.getByLabelText(/^Stretch, /))));
    await expectSeen('Gym week strip with Thursday missed', '--I-OXo', () => strip(within(screen.getByLabelText(/^Gym, /))));
    await expectSeen('Routines sections on Friday', 'Due Friday: Gym, Stretch | As needed: Meditate', routineSections, 'B1-stale-weekday');

    action('Fri', '08:40', 'Stretch page: History > Thu Jul 16 > Done; Gym page: Thu Jul 16 > Fallback (log Thursday late)');
    await userEvent.press(await screen.findByLabelText(/^Stretch, /));
    await waitFor(() => expect(path()).toMatch(/^\/task\//));
    await press('2026-07-16, missed');
    await userEvent.press(await within(await screen.findByTestId('s20-day-popover')).findByLabelText('Thu Jul 16: Done'));
    await settle();
    await dismissCelebrations();
    await expectSeen('Stretch history: Thursday now ideal', true, () => screen.queryAllByLabelText('2026-07-16, ideal').length > 0);
    await press('Back');
    await waitFor(() => expect(path()).toBe('/routines'));
    await userEvent.press(await screen.findByLabelText(/^Gym, /));
    await waitFor(() => expect(path()).toMatch(/^\/task\//));
    await press('2026-07-16, missed');
    await userEvent.press(await within(await screen.findByTestId('s20-day-popover')).findByLabelText('Thu Jul 16: Fallback'));
    await settle();
    await dismissCelebrations();
    await press('Back');
    await waitFor(() => expect(path()).toBe('/routines'));
    await expectSeen('lifetime XP after late logs (42 + 10 + 6)', 58, () => fake.xpAwards().reduce((s, a) => s + a.amount, 0));
    await expectSeen('Stretch week strip after the late log', '--IFOIo', () => strip(within(screen.getByLabelText(/^Stretch, /))));
    await expectSeen('Gym week strip after the late log', '--I-OFo', () => strip(within(screen.getByLabelText(/^Gym, /))));
    await openTab('Today');
    // Thursday: Stretch I, Gym F, Antibiotic missed = 2/3. Days: Mon 1, Tue .667, Thu .667: 2.333 / 3 = 78 percent; x = 2.
    await todaySnapshot({ rows: ['Stretch: open', 'Gym: open', 'Antibiotic: open'], done: '0 of 3', ring: '78%', line: '2 of 3 days in the last 30' });

    action('Fri', '09:00', 'Stretch Done; Gym tick Warm up and Lift; Antibiotic dose 3 at once');
    await press('Stretch: Done');
    await dismissCelebrations();
    await userEvent.press(await screen.findByLabelText(/^Gym, .*Opens the task/));
    await waitFor(() => expect(path()).toMatch(/^\/task\//));
    await press('Warm up');
    await press('Lift');
    await dismissCelebrations();
    await backToToday();
    await userEvent.press(await screen.findByLabelText(/^Antibiotic, .*Opens the task/));
    await waitFor(() => expect(path()).toMatch(/^\/task\//));
    await press('Dose 3 of 3: Done');
    // Antibiotic was missed on Thursday and shows up on Friday: the Comeback badge, once.
    const popF = await dismissCelebrations();
    await expectSeen('pop-ups on Friday (Comeback, once)', ['Badge earned: Comeback.'], () => popF);
    await backToToday();
    // Friday all ideal = 1. Days: Mon 1, Tue .667, Thu .667, Fri 1 = 3.333 / 4 = 83 percent; x = 3.
    await todaySnapshot({ rows: ['Stretch: I', 'Gym: I', 'Antibiotic: I'], done: '3 of 3', ring: '83%', line: '3 of 4 days in the last 30' });
    await expectSeen('lifetime XP Friday (58 + 10 + 10 + 10)', 88, () => fake.xpAwards().reduce((s, a) => s + a.amount, 0));

    action('Fri', '15:00', 'tick Buy stamps on To-dos; Progress (All tasks)');
    setClock(FRI!, 15, 0);
    await openTab('To-dos');
    await expectSeen('To-dos summary before', '2 left to do', () => String(screen.getByText(/left to do$|^Everything ticked off$/).props.children));
    await userEvent.press(await screen.findByTestId('todo-checkbox-stamps'));
    await settle();
    await expectSeen('To-dos summary after ticking Buy stamps', '1 left to do', () => String(screen.getByText(/left to do$|^Everything ticked off$/).props.children));
    await openTab('Today');
    await expectSeen('to-dos are not on Today', ['Stretch: I', 'Gym: I', 'Antibiotic: I'], todayRows);
    await openProgress('All tasks');
    // ideal credit 1 + 0 + 1/3 + 1 = 2.33, fallback 0 + 2/3 + 1/3 = 1, missed 4 - 3.33 = .67: shared out 2 / 1 / 1; Wed was the one off day.
    await expectSeen('Progress, all tasks, 30 days (Fri)', '83 percent; ≈3.3 of 4 counted days (weighted by that day\'s tasks); Ideal 2, Fallback 1, Off 1, Missed 1', progressRead);
    await closeProgress();

    action('Fri', '22:30', 'late evening check');
    setClock(FRI!, 22, 30);
    await openAchievements();
    await expectSeen('Achievements Friday: level card', 'Level 1, Getting started. 88 of 100 XP', () => achievementsRead().level);
    await expectSeen('Achievements Friday: earned', ['Comeback', 'First day', 'Safety net'], () => achievementsRead().earned);
    await backToToday();
    // Saturday: Stretch (daily) and Antibiotic. Gym is Mon-Fri.
    const remFri = await remindersFor(SAT!);
    await expectSeen('reminders armed for Saturday', [...ids('routine-due', ['stretch'], SAT!), ...ids('course-dose', ['abx'], SAT!)].sort(), () => remFri.onDate);

    /* ================================================================ SATURDAY 18 */
    await moveTo(SAT!, 8, 30);
    action('Sat', '08:30', 'midnight passed');
    await todaySnapshot({ rows: ['Stretch: open', 'Antibiotic: open'], done: '0 of 2', ring: '83%', line: '3 of 4 days in the last 30' });

    action('Sat', '08:40', 'Stretch: Done; Antibiotic dose 1');
    await press('Stretch: Done');
    await dismissCelebrations();
    await userEvent.press(await screen.findByLabelText(/^Antibiotic, .*Opens the task/));
    await waitFor(() => expect(path()).toMatch(/^\/task\//));
    await press('Dose 1 of 3: Done');
    // 98 XP + 6 = 104 crosses 100: level 2, one pop-up.
    const popS = await dismissCelebrations();
    await expectSeen('pop-ups Saturday (level 2, once)', ["You're now Level 2."], () => popS);
    await backToToday();
    // Saturday: Stretch I, Antibiotic F (dose 1) = 1. Days 5: 4.333 / 5 = 87 percent; x = 4.
    await todaySnapshot({ rows: ['Stretch: I', 'Antibiotic: F'], done: '2 of 2', ring: '87%', line: '4 of 5 days in the last 30', level: 'Level 2' });

    action('Sat', '14:00', 'End routine Stretch (it is logged today, so it ends today)');
    setClock(SAT!, 14, 0);
    await userEvent.press(await screen.findByLabelText(/^Stretch, .*Opens the task/));
    await waitFor(() => expect(path()).toMatch(/^\/task\//));
    await userEvent.press(await screen.findByTestId('s20-more'));
    await userEvent.press(await screen.findByLabelText('End routine'));
    await userEvent.press(within(await screen.findByTestId('s20-end-confirm')).getByLabelText('End routine'));
    await settle();
    await expectSeen('Stretch ended on the day it was last logged', 'Ended Jul 18', () => String(screen.getByText(/^Ended Jul \d+$/).props.children), 'B2-end-label');
    record('stored endedOn', SAT, (await fake.repos.tasks.get('stretch' as Id))?.endedOn);
    await press('Back');
    await settle();
    await openTab('Routines');
    // Saturday: Stretch is ended, Gym is Mon-Fri, so nothing is due; Gym sits under Other routines.
    await expectSeen('Routines sections on Saturday after ending Stretch', 'Due Saturday: (none) | Other routines: Gym | As needed: Meditate | Ended: Stretch', routineSections, 'B1-stale-weekday');
    await expectSeen('Ended card meta', true, () => screen.queryAllByText('Ended Jul 18').length > 0);
    await openTab('Today');
    // Ending does not take today's logged Stretch away: it is still ideal on Today.
    await expectSeen('Today after ending Stretch (its logged day stays)', ['Stretch: I', 'Antibiotic: F'], todayRows);

    action('Sat', '20:00', 'Antibiotic dose 3');
    setClock(SAT!, 20, 0);
    await userEvent.press(await screen.findByLabelText(/^Antibiotic, .*Opens the task/));
    await waitFor(() => expect(path()).toMatch(/^\/task\//));
    await press('Dose 3 of 3: Done');
    await dismissCelebrations();
    await backToToday();

    action('Sat', '22:30', 'late evening check');
    setClock(SAT!, 22, 30);
    await todaySnapshot({ rows: ['Stretch: I', 'Antibiotic: I'], done: '2 of 2', ring: '87%', line: '4 of 5 days in the last 30' });
    await openAchievements();
    await expectSeen('Achievements Saturday: level card (108 XP)', 'Level 2, Warming up. 8 of 250 XP', () => achievementsRead().level);
    await backToToday();
    // Sunday: Antibiotic dose + "ending soon" (3 days before Jul 22 = Jul 19). Stretch is ended, Gym is not a Sunday habit.
    const remSat = await remindersFor(SUN!);
    await expectSeen(
      'reminders armed for Sunday',
      [...ids('course-dose', ['abx'], SUN!), 'course-ending-soon:abx:2026-07-22'].sort(),
      () => remSat.onDate,
    );

    /* ================================================================ SUNDAY 19 */
    await moveTo(SUN!, 9, 0);
    action('Sun', '09:00', 'midnight passed');
    await todaySnapshot({ rows: ['Antibiotic: open'], done: '0 of 1', ring: '87%', line: '4 of 5 days in the last 30', level: 'Level 2' });

    action('Sun', '09:10', 'Antibiotic: dose 1, then dose 3');
    await userEvent.press(await screen.findByLabelText(/^Antibiotic, .*Opens the task/));
    await waitFor(() => expect(path()).toMatch(/^\/task\//));
    await press('Dose 1 of 3: Done');
    await press('Dose 3 of 3: Done');
    await dismissCelebrations();
    await backToToday();
    // Sunday 1: 5.333 / 6 = 89 percent; x = 5.
    await todaySnapshot({ rows: ['Antibiotic: I'], done: '1 of 1', ring: '89%', line: '5 of 6 days in the last 30' });
    await expectSeen('lifetime XP Sunday (108 + 10)', 118, () => fake.xpAwards().reduce((s, a) => s + a.amount, 0));

    action('Sun', '15:00', 'Routines tab; Progress (All tasks and Stretch alone)');
    setClock(SUN!, 15, 0);
    await openTab('Routines');
    await expectSeen('Routines sections on Sunday', 'Due Sunday: (none) | Other routines: Gym | As needed: Meditate | Ended: Stretch', routineSections, 'B1-stale-weekday');
    await expectSeen('Ended Stretch week strip (Jul 13..19; Sunday is after its end)', 'IFOIII-', () => strip(within(screen.getByLabelText(/^Stretch, /))));
    await expectSeen('Gym week strip', 'I-OFI--', () => strip(within(screen.getByLabelText(/^Gym, /))));
    await openTab('Today');
    await openProgress('All tasks');
    // ideal 1 + 0 + 1/3 + 1 + 1 + 1 = 4.33, fallback 1, missed 6 - 5.33 = .67 -> 4 / 1 / 1; one fully-off day.
    const progSun = "89 percent; ≈5.3 of 6 counted days (weighted by that day's tasks); Ideal 4, Fallback 1, Off 1, Missed 1";
    await expectSeen('Progress, all tasks, 30 days (Sun)', progSun, progressRead);
    await press('Stretch');
    // Stretch alone: Mon I, Tue F, Wed off, Thu I (late), Fri I, Sat I: 4 ideal + 1 fallback = 5 of 5; one off day.
    await expectSeen('Progress, Stretch only', '100 percent; 4 ideal + 1 fallback = 5 of 5 counted days; Ideal 4, Fallback 1, Off 1, Missed 0', progressRead);
    await closeProgress();

    action('Sun', '15:30', 'delete Gym from its page (Routines > Other routines), look, then restore from Recently deleted');
    await openTab('Routines');
    await userEvent.press(await screen.findByLabelText(/^Gym, /));
    await waitFor(() => expect(path()).toMatch(/^\/task\//));
    const gymId = String(routerStore.getRouteInfo().params.id);
    await userEvent.press(await screen.findByTestId('s20-more'));
    await userEvent.press(await screen.findByLabelText('Delete routine'));
    await userEvent.press(within(await screen.findByTestId('delete-task-sheet')).getByLabelText('Delete routine'));
    await settle();
    await waitFor(() => expect(path()).toBe('/routines'));
    await expectSeen('Routines without Gym', 'Due Sunday: (none) | As needed: Meditate | Ended: Stretch', routineSections, 'B1-stale-weekday');
    await expectSeen('Gym is in Recently deleted, not gone', true, () => fake.logsFor(gymId as Id).length >= 3);
    await openTab('Today');
    await openProgress('All tasks');
    // The record keeps a deleted habit's days up to its deletion day: nothing moves.
    await expectSeen('Progress while Gym is deleted: unchanged', progSun, progressRead);
    await closeProgress();
    await expectSeen('lifetime XP while Gym is deleted (XP is never taken away)', 118, () => fake.xpAwards().reduce((s, a) => s + a.amount, 0));
    const remDel = await remindersFor(NEXT_MON!);
    await expectSeen('reminders for Monday while Gym is deleted', ids('course-dose', ['abx'], NEXT_MON!), () => remDel.onDate);

    // Restore from Settings > Data > Recently deleted.
    await userEvent.press(await screen.findByLabelText('Settings'));
    await waitFor(() => expect(path()).toBe('/settings'));
    await userEvent.press(await screen.findByLabelText('Data'));
    await waitFor(() => expect(path()).toBe('/settings/data'));
    await userEvent.press(await screen.findByTestId('s47-recently-deleted'));
    await waitFor(() => expect(path()).toBe('/settings/data/deleted'));
    await userEvent.press(await screen.findByTestId(`deleted-row-${gymId}`));
    await userEvent.press(await screen.findByLabelText('Restore'));
    await settle();
    await expectSeen('restored toast', 'Restored "Gym".', () => useToastStore.getState().toast?.message);
    await press('Back');
    await press('Back');
    await waitFor(() => expect(path()).toBe('/today'));
    await settle();
    await openTab('Routines');
    await expectSeen('Routines with Gym restored', 'Due Sunday: (none) | Other routines: Gym | As needed: Meditate | Ended: Stretch', routineSections, 'B1-stale-weekday');
    await expectSeen('restored Gym keeps its week (Jul 13..19)', 'I-OFI--', () => strip(within(screen.getByLabelText(/^Gym, /))));
    await openTab('Today');

    action('Sun', '22:30', 'late evening check');
    setClock(SUN!, 22, 30);
    await todaySnapshot({ rows: ['Antibiotic: I'], done: '1 of 1', ring: '89%', line: '5 of 6 days in the last 30', level: 'Level 2' });
    await openProgress('All tasks');
    await expectSeen('Progress after the restore: unchanged', progSun, progressRead);
    await closeProgress();
    await openAchievements();
    await expectSeen('Achievements Sunday: level card (118 XP)', 'Level 2, Warming up. 18 of 250 XP', () => achievementsRead().level);
    // Six days showed up (Mon, Tue, Thu, Fri, Sat, Sun): "7 days" is one day away; "1 Week" is on Monday 20 Jul.
    await expectSeen('Achievements Sunday: earned (no 7 days yet)', ['Comeback', 'First day', 'Safety net'], () => achievementsRead().earned);
    await backToToday();
    // Monday 20: Gym is back, Antibiotic still runs (to Jul 22); Stretch ended; Team sync is Tuesdays.
    const remSun = await remindersFor(NEXT_MON!);
    await expectSeen('reminders armed for Monday 20 (Gym restored)', [...ids('routine-due', ['gym'], NEXT_MON!), ...ids('course-dose', ['abx'], NEXT_MON!)].sort(), () => remSun.onDate);

    /* ================================================================ the whole week */
    action('Week', '', 'pop-ups over the whole week');
    // Each milestone appeared exactly once, in the order earned: First day and Safety net on Monday, Comeback on Friday, level 2 on Saturday.
    record('milestones queued over the week, in order', ['tenure-first-day', 'fallback-safety-net', 'fallback-comeback', 'level-up'], celebrationsEarned);
    record('unlocked badges stored', ['fallback-comeback', 'fallback-safety-net', 'tenure-first-day'], fake.unlocks().map((u) => u.key).sort());

    const bad = rows.filter((r) => !r.ok && !r.bug);
    expect(bad).toEqual([]);
  }, 600_000);

  it.failing('B1: the Routines day picker starts on today after midnight, not on the day the tab was first opened', () => {
    const row = bugs['B1-stale-weekday'];
    expect(row).toBeDefined();
    expect(row!.seen).toEqual(row!.expected);
  });
  it.failing('B2: the Ended label matches the day it ended', () => {
    const row = bugs['B2-end-label'];
    expect(row).toBeDefined();
    expect(row!.seen).toEqual(row!.expected);
  });
});
