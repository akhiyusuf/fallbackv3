/**
 * Edge-case round 4, "undo everywhere", against FakeRepos through the real mutation hooks.
 *
 * Every take-it-back pair runs in five variants (same day, after midnight, another habit logged in
 * between, undo pressed twice, and all three together). The control run never acts; the treatment
 * acts and undoes. Every raw table and every derived read is compared, ids replaced by labels. Each
 * difference must fall into a kind the pair names (a residue row, or a record change with its reason);
 * a badge is never taken back. The method is in `testSupport/undoEngine.ts`, the pairs and their
 * allowed differences in `testSupport/undoScenarios.ts`. The same pairs run on real SQLite in
 * `src/db/__tests__/edge.undo.test.ts`.
 */
jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: jest.fn(() => {
      counter += 1;
      return `00000000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`;
    }),
  };
});

jest.mock('@/db', () => require('./testSupport/dbMock'));

jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  const { clock } = require('./testSupport/clockMock');
  return { ...actual, today: () => clock.today, now: () => clock.now };
});

import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { LocalDate } from '@/types';

import { fake, repos } from './testSupport/dbMock';
import { clock } from './testSupport/clockMock';
import { compareScenario, diff, id, isBadgeLine, seed, snapshot, START_DAY, type Action, type Ctx, type UndoEnv, VARIANTS } from './testSupport/undoEngine';
import { ALLOWED, explain, SCENARIOS } from './testSupport/undoScenarios';
import {
  useCreateTask,
  useDeleteForever,
  useDeleteTask,
  useDuplicateTask,
  useEndTask,
  useLogDose,
  useLogState,
  useMarkOffDay,
  useRestoreTask,
  useSnoozeOccurrence,
  useStartAgain,
  useToggleStep,
  useUndoSnooze,
  useUpdateTask,
} from './mutations';

/* ------------------------------------------------------------------ the env: fake repos through the hooks */

function useEveryMutation() {
  return {
    createTask: useCreateTask(),
    logState: useLogState(),
    toggleStep: useToggleStep(),
    logDose: useLogDose(),
    markOffDay: useMarkOffDay(),
    snooze: useSnoozeOccurrence(),
    undoSnooze: useUndoSnooze(),
    endTask: useEndTask(),
    startAgain: useStartAgain(),
    deleteTask: useDeleteTask(),
    restoreTask: useRestoreTask(),
    deleteForever: useDeleteForever(),
    duplicate: useDuplicateTask(),
    updateTask: useUpdateTask(),
  };
}

type Mutations = ReturnType<typeof useEveryMutation>;

function makeFakeEnv() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  }

  // One mounted instance for the whole file. `renderHook`'s `result.current` is replaced on every
  // render, so each call reads it fresh.
  let handle: { result: { current: Mutations }; unmount: () => void } | null = null;
  async function mountOnce() {
    if (!handle) handle = await renderHook(useEveryMutation, { wrapper: Wrapper });
    return handle;
  }

  const env: UndoEnv & { dispose(): void } = {
    repos,
    async call(action: Action, arg: unknown) {
      const h = await mountOnce();
      let out: unknown;
      await act(async () => {
        try {
          out = await (h.result.current[action] as unknown as { mutateAsync: (a: unknown) => Promise<unknown> }).mutateAsync(arg);
        } catch (e) {
          out = { thrown: e instanceof Error ? e.message : String(e) };
        }
      });
      return out;
    },
    setClock(day: LocalDate) {
      clock.today = day;
      clock.now = `${day}T12:00:00.000Z`;
    },
    async tables() {
      const from = '0000-01-01' as LocalDate;
      const to = '9999-12-31' as LocalDate;
      const cycle = fake.currentCycleState();
      const tasks = await repos.tasks.list({ includeDeleted: true });
      const live = new Set<string>(tasks.map((t) => t.id));
      return {
        tasks,
        logs: await repos.logs.listRange(from, to),
        offDays: await repos.offDays.listRange(from, to),
        // The schema's ON DELETE SET NULL on xp_award.task_id, shown here as the database shows it: an
        // award whose habit went for good keeps its XP with no task. The fake keeps the link (its own
        // recentlyDeleted assertion relies on that), so the snapshot is where the rule is mirrored.
        xpAwards: fake.xpAwards().map((a) => (a.taskId !== null && !live.has(a.taskId) ? { ...a, taskId: null } : a)),
        unlocks: fake.unlocks(),
        cycleRecords: fake.cycleRecords(),
        cycleState: cycle ? [cycle] : [],
        settings: [fake.currentSettings()],
        retiredDays: await repos.retiredDays.list(),
      } as unknown as Record<string, readonly Record<string, unknown>[]>;
    },
    async reset() {
      fake.reset();
      client.clear();
    },
    dispose() {
      handle?.unmount();
      client.clear();
    },
  };
  return env;
}

const env = makeFakeEnv();
afterAll(() => {
  env.dispose();
});

/* ------------------------------------------------------------------ the pairs */

describe.each(SCENARIOS.map((s) => [s.name, s] as const))('undo pair: %s', (_name, scenario) => {
  it('has a classification entry', () => {
    expect(ALLOWED[scenario.name]).toBeDefined();
  });

  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (_variantName, variant) => {
    const { diffs } = await compareScenario(env, scenario, variant);
    const badges = diffs.filter(isBadgeLine);
    const rest = diffs.filter((l) => !isBadgeLine(l));
    const { unknown, disallowed } = explain(scenario.name, rest, variant.midnight);
    // A badge, once earned, is never taken back (upsert-only, see edge.logging's badge test).
    expect(badges.filter((l) => l.includes(' - '))).toEqual([]);
    // Everything else must be a kind this pair names: a residue row, or a record change with its reason.
    expect(unknown).toEqual([]);
    expect(disallowed).toEqual([]);
  });
});

/* ------------------------------------------------------------------ the known rewrite-the-past */

describe('changing a schedule rewrites the past while it stands (known, documented)', () => {
  it('past done days outside the new schedule drop out of the record; changing back brings them back exactly', async () => {
    const c: Ctx = { env, day: START_DAY, actionDay: START_DAY, ids: new Map(), labels: new Map() };
    await env.reset();
    await seed(c);
    const before = await snapshot(c);
    const h1 = id(c, 'H1');

    // Tuesdays and Thursdays only: H1's done Monday, Wednesday, Friday and Sunday of the week before
    // are no longer due, so they stop counting, and their XP stays where it was.
    await env.call('updateTask', { id: h1, patch: { cadence: { kind: 'specific-weekdays', weekdays: [2, 4] } } });
    const during = await snapshot(c);
    const idealDays = (snap: typeof before) =>
      (snap.derived.record as readonly { taskId: string; outcome: string }[]).filter((o) => o.taskId === 'H1' && o.outcome === 'ideal').length;
    const doneBefore = idealDays(before);
    const doneDuring = idealDays(during);
    expect(doneDuring).toBeLessThan(doneBefore);
    expect(during.derived.lifetimeXp).toBe(before.derived.lifetimeXp);
    expect(diff(before.derived.consistencyPercent, during.derived.consistencyPercent).length).toBeGreaterThan(0);

    await env.call('updateTask', { id: h1, patch: { cadence: { kind: 'daily' } } });
    const after = await snapshot(c);
    expect(diff(before, after)).toEqual([]);
  });
});
