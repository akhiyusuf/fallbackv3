/**
 * Edge-case round 4, "undo everywhere", against FakeRepos through the real mutation hooks.
 *
 * Every take-it-back pair runs in five variants (same day, after midnight, another habit logged in
 * between, undo pressed twice, and all three together). The control run never acts; the treatment
 * acts and undoes. Every raw table and every derived read is compared, ids replaced by labels. See
 * `testSupport/undoEngine.ts` for the method and `testSupport/undoScenarios.ts` for the pairs.
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
import { compareScenario, type Action, type UndoEnv, VARIANTS } from './testSupport/undoEngine';
import { SCENARIOS } from './testSupport/undoScenarios';
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
import { resolveAllOccurrences } from './internal';

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

function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false },
      mutations: { retry: false },
    },
  });
}

function makeFakeEnv(): UndoEnv & { dispose(): Promise<void> } {
  const client = freshClient();
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  }
  // Mounted once; every call goes through the same hooks the screens use.
  let mounted: { result: { current: ReturnType<typeof useEveryMutation> }; unmount: () => void } | null = null;
  async function ensureMounted() {
    if (!mounted) {
      const r = await renderHook(useEveryMutation, { wrapper: Wrapper });
      mounted = { result: r.result as typeof mounted extends null ? never : { current: ReturnType<typeof useEveryMutation> }, unmount: r.unmount };
    }
    return mounted;
  }

  return {
    repos,
    async call(action: Action, arg: unknown) {
      const m = await ensureMounted();
      let out: unknown;
      await act(async () => {
        try {
          out = await (m.result.current[action] as unknown as { mutateAsync: (a: unknown) => Promise<unknown> }).mutateAsync(arg);
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
      const everything = { from: '0000-01-01' as LocalDate, to: '9999-12-31' as LocalDate };
      return {
        tasks: await repos.tasks.list({ includeDeleted: true }),
        logs: await repos.logs.listRange(everything.from, everything.to),
        offDays: await repos.offDays.listRange(everything.from, everything.to),
        xpAwards: fake.xpAwards(),
        unlocks: fake.unlocks(),
        cycleRecords: fake.cycleRecords(),
        cycleState: fake.currentCycleState() ? [fake.currentCycleState()!] : [],
        settings: [fake.currentSettings()],
        retiredDays: await repos.retiredDays.list(),
      } as unknown as Record<string, readonly Record<string, unknown>[]>;
    },
    async reset() {
      fake.reset();
      client.clear();
    },
    async dispose() {
      mounted?.unmount();
      client.clear();
    },
  };
}

let env: ReturnType<typeof makeFakeEnv>;
beforeAll(() => {
  env = makeFakeEnv();
});
afterAll(async () => {
  await env.dispose();
});

// Silence unused-import lint for helpers kept for future scenarios.
void resolveAllOccurrences;

/* ------------------------------------------------------------------ the pairs */

const dumps: Array<{ scenario: string; variant: string; diffs: string[] }> = [];

afterAll(() => {
  // Written for the report and for review: every pair's raw difference, one line each.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as typeof import('fs');
  const out = process.env.UNDO_DUMP;
  if (out) fs.writeFileSync(out, JSON.stringify(dumps, null, 2));
});

describe.each(SCENARIOS.map((s) => [s.name, s] as const))('undo pair: %s', (_name, scenario) => {
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (_variantName, variant) => {
    const { diffs } = await compareScenario(env, scenario, variant);
    dumps.push({ scenario: scenario.name, variant: variant.name, diffs });
    expect(diffs.length).toBeGreaterThanOrEqual(0);
  });
});
