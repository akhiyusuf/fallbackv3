/**
 * Edge-case round 4, "undo everywhere", against a REAL SQLite file (node:sqlite behind the expo-sqlite
 * double). The same scenarios and the same method as `src/queries/edge.undo.test.tsx`, but every
 * table is read raw from the file, not through the repositories, so a column the repositories never
 * return would still show up. Mutations run through the real hooks, the same as the screens.
 *
 * One store for the file: between runs the task, step, log, off-day, XP, badge, cycle and retired
 * tables are emptied (settings stay: these scenarios never change them).
 */
import { makeTempDir, removeDir, joinPath } from '../testSupport/nodeTempFiles';

const createdDirs: string[] = [];
afterAll(() => {
  for (const dir of createdDirs) removeDir(dir);
});

jest.mock('expo-sqlite', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('../testSupport/expoSqliteTestDouble') as typeof import('../testSupport/expoSqliteTestDouble')).createExpoSqliteTestDouble({
    directory: (globalThis as { __undoDir?: string }).__undoDir,
  }),
);
jest.mock('expo-crypto', () => ({
  randomUUID: () => (globalThis as unknown as { crypto: Crypto }).crypto.randomUUID(),
}));
jest.mock('expo-file-system/legacy', () => require('../testSupport/fileSystemTestDouble'));
jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(async () => undefined),
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));
jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  const g = globalThis as { __undoDay?: string; __undoNow?: string };
  return {
    ...actual,
    today: () => (g.__undoDay as ReturnType<typeof actual.today>) ?? actual.today(),
    now: () => (g.__undoNow as ReturnType<typeof actual.now>) ?? actual.now(),
  };
});

import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DatabaseSync } from 'node:sqlite';

import type { LocalDate } from '@/types';
import { compareScenario, isBadgeLine, type Action, type UndoEnv, VARIANTS } from '@/queries/testSupport/undoEngine';
import { ALLOWED, explain, SCENARIOS } from '@/queries/testSupport/undoScenarios';

type App = typeof import('@/db');
type Mutations = typeof import('@/queries/mutations');

const KEEP_TABLES = new Set(['settings']);

/** The fake repositories' names for the tables, so the same classifier reads both. */
const TABLE_NAMES: Record<string, string> = {
  task: 'tasks',
  step: 'steps',
  day_log: 'logs',
  off_day_mark: 'offDays',
  as_needed_use: 'asNeeded',
  xp_award: 'xpAwards',
  achievement_unlock: 'unlocks',
  cycle_record: 'cycleRecords',
  cycle_state: 'cycleState',
  retired_day: 'retiredDays',
};

let directory = '';
/** The store's file name. Read after the directory is set: importing the client first would load expo-sqlite too early. */
let dbName = '';
let app: App;
let mutations: Mutations;
let client: QueryClient;
let mounted: { current: Record<string, { mutateAsync: (a: unknown) => Promise<unknown> }> } | null = null;
let unmountHook: (() => void) | null = null;

function rawConnection(): DatabaseSync {
  return new DatabaseSync(joinPath(directory, dbName));
}

function tableNames(connection: DatabaseSync): string[] {
  const rows = connection
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
    .all() as { name: string }[];
  return rows.map((r) => r.name);
}

function setClock(day: LocalDate): void {
  const g = globalThis as { __undoDay?: string; __undoNow?: string };
  g.__undoDay = day;
  g.__undoNow = `${day}T12:00:00.000Z`;
}

function useEveryMutation(m: Mutations) {
  return {
    createTask: m.useCreateTask(),
    logState: m.useLogState(),
    toggleStep: m.useToggleStep(),
    logDose: m.useLogDose(),
    markOffDay: m.useMarkOffDay(),
    snooze: m.useSnoozeOccurrence(),
    undoSnooze: m.useUndoSnooze(),
    endTask: m.useEndTask(),
    startAgain: m.useStartAgain(),
    deleteTask: m.useDeleteTask(),
    restoreTask: m.useRestoreTask(),
    deleteForever: m.useDeleteForever(),
    duplicate: m.useDuplicateTask(),
    updateTask: m.useUpdateTask(),
  };
}

async function mountOnce(): Promise<void> {
  if (mounted) return;
  const Wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(QueryClientProvider, { client }, children);
  const hook = () => useEveryMutation(mutations);
  const r = await renderHook(hook, { wrapper: Wrapper });
  mounted = r.result as unknown as typeof mounted;
  unmountHook = r.unmount;
}

beforeAll(async () => {
  directory = makeTempDir('fallback-undo-real-');
  createdDirs.push(directory);
  (globalThis as { __undoDir?: string }).__undoDir = directory;
  setClock('2024-06-01');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  dbName = (require('../client') as typeof import('../client')).DB_NAME;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  app = require('@/db') as App;
  const opened = await app.store.open();
  if (!opened.ok || opened.value !== 'ready') throw new Error(`store did not open: ${JSON.stringify(opened)}`);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mutations = require('@/queries/mutations') as Mutations;
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});

afterAll(async () => {
  unmountHook?.();
  client.clear();
});

const env: UndoEnv = {
  get repos() {
    return app.repos;
  },
  async call(action: Action, arg: unknown) {
    await mountOnce();
    let out: unknown;
    await act(async () => {
      try {
        out = await mounted!.current[action]!.mutateAsync(arg);
      } catch (e) {
        out = { thrown: e instanceof Error ? e.message : String(e) };
      }
    });
    return out;
  },
  setClock,
  async tables() {
    // Raw rows, under the same table and column names the fake repositories use, so one classifier
    // reads both. Columns are only renamed (snake_case to camelCase); every value is what SQLite holds.
    const connection = rawConnection();
    try {
      const out: Record<string, Record<string, unknown>[]> = {};
      for (const name of tableNames(connection)) {
        const rows = connection.prepare(`SELECT * FROM "${name}"`).all() as Record<string, unknown>[];
        out[TABLE_NAMES[name] ?? name] = rows.map((row) =>
          Object.fromEntries(Object.entries(row).map(([k, v]) => [k.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase()), v])),
        );
      }
      return out;
    } finally {
      connection.close();
    }
  },
  async reset() {
    const connection = rawConnection();
    try {
      connection.exec('PRAGMA foreign_keys = OFF');
      for (const name of tableNames(connection)) {
        if (KEEP_TABLES.has(name)) continue;
        connection.exec(`DELETE FROM "${name}"`);
      }
      connection.exec('PRAGMA foreign_keys = ON');
    } finally {
      connection.close();
    }
    client.clear();
  },
};

const dumps: Array<{ scenario: string; variant: string; diffs: string[]; badges: string[] }> = [];
afterAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as typeof import('fs');
  const out = process.env.UNDO_DUMP_REAL;
  if (out) fs.writeFileSync(out, JSON.stringify(dumps, null, 2));
});

describe.each(SCENARIOS.map((s) => [s.name, s] as const))('real SQLite undo pair: %s', (_name, scenario) => {
  it('has a classification entry', () => {
    expect(ALLOWED[scenario.name]).toBeDefined();
  });
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (_variantName, variant) => {
    const { diffs } = await compareScenario(env, scenario, variant);
    const badges = diffs.filter(isBadgeLine);
    const rest = diffs.filter((l) => !isBadgeLine(l));
    const { unknown, disallowed } = explain(scenario.name, rest, variant.midnight);
    dumps.push({ scenario: scenario.name, variant: variant.name, diffs: rest, badges });
    // A badge, once earned, is never taken back (upsert-only, see edge.logging's badge test).
    expect(badges.filter((l) => l.includes(' - '))).toEqual([]);
    // Everything else must be a known kind for this pair: a residue row or a named record change.
    expect(unknown).toEqual([]);
    expect(disallowed).toEqual([]);
  });
});
