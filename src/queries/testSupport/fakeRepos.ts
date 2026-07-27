/**
 * M2 — test-only in-memory `Repositories` implementation for `src/queries/**` tests. Never
 * imported by production code (not re-exported from `index.ts`). Deliberately duplicates
 * none of M1's SQL — this exists purely so mutation/reconciliation LOGIC can be exercised
 * without a real SQLite connection, per MODULES.md's "House testing pattern": pure logic is
 * the preferred, fastest test surface, and react-query's hook layer is the thinnest possible
 * shell around it.
 */
import { err, ok } from '@/types';
import type {
  AchievementUnlock,
  AsNeededUse,
  CycleRecord,
  CycleState,
  DayLog,
  Id,
  Instant,
  OffDayMark,
  Repositories,
  Settings,
  Task,
  TaskWithSteps,
  XpAward,
} from '@/types';

function defaultSettings(): Settings {
  return {
    schemaVersion: 1,
    theme: 'auto',
    accent: 'forge-orange',
    onboardingCompletedAt: null,
    tenureAnchorDate: '2024-01-01' as Settings['tenureAnchorDate'],
    cycleCadence: 'monthly',
    notifications: {
      master: false,
      routineDue: false,
      eventStarting: false,
      courseDose: false,
      courseEndingSoon: false,
      gentleReentry: false,
      milestoneReached: false,
      dailyDigest: false,
      dailyDigestTime: '08:00',
    },
    widgets: [],
    sync: { enabled: false, lastSyncedAt: null, lastError: null },
    lastBackupAt: null,
    updatedAt: '2024-01-01T00:00:00.000Z' as Instant,
  };
}

export interface FakeRepos {
  readonly repos: Repositories;
  reset(): void;
  seedTask(task: TaskWithSteps): void;
  seedSettings(patch: Partial<Settings>): void;
  seedCycleState(state: CycleState | null): void;
  failNextAppendXpAward(): void;
  /** Fails only the Nth (1-based) call to `appendCycleRecord` — for N4's partial-failure tests. */
  failAppendCycleRecordOnCall(callNumber: number): void;
  /** Fails only the next call to `cycleState.set` — for N4's pointer-write-failure tests. */
  failNextCycleStateSet(): void;
  /**
   * ADVICE-M2.md Ruling 2, section (c): fail-injected retry idempotence for every multi-write
   * mutation. `useMoveOccurrence`'s visiting-occurrence branch (W-3) can issue more than one
   * `logs.upsert` call in a single mutation (one per redirected inbound row, e.g. C8's double
   * inbound). Skips `skipCalls` calls to `logs.upsert`, then fails exactly the next one
   * (one-shot) — so a specific call in a multi-write sequence can be made to fail without
   * touching the calls before it.
   */
  failLogsUpsertAfterCalls(skipCalls: number): void;
  xpAwards(): readonly XpAward[];
  cycleRecords(): readonly CycleRecord[];
  unlocks(): readonly AchievementUnlock[];
  logsFor(taskId: Id): readonly DayLog[];
  currentCycleState(): CycleState | null;
  currentSettings(): Settings;
}

export function createFakeRepos(): FakeRepos {
  const tasks = new Map<Id, TaskWithSteps>();
  const logs = new Map<string, DayLog>();
  let offMarks: OffDayMark[] = [];
  let asNeeded: AsNeededUse[] = [];
  const xpAwards = new Map<string, XpAward>();
  const unlocks = new Map<string, AchievementUnlock>();
  let cycleRecords: CycleRecord[] = [];
  let cycleState: CycleState | null = null;
  let settings: Settings = defaultSettings();
  let failAppendOnce = false;
  let failAppendCycleRecordAtCall: number | null = null;
  let appendCycleRecordCallCount = 0;
  let failCycleStateSetOnce = false;
  let skipUpsertCalls: number | null = null;

  const repos: Repositories = {
    tasks: {
      list: async (opts) => [...tasks.values()].filter((t) => opts?.includeDeleted || t.deletedAt === null),
      get: async (id) => tasks.get(id) ?? null,
      insert: async (task: Task, steps) => {
        tasks.set(task.id, { ...task, idealSteps: steps.filter((s) => s.role === 'ideal'), fallbackSteps: steps.filter((s) => s.role === 'fallback') });
        return ok(task.id);
      },
      update: async (id, patch, steps) => {
        const existing = tasks.get(id);
        if (!existing) return err({ code: 'NOT_FOUND', message: 'not found' });
        tasks.set(id, {
          ...existing,
          ...patch,
          ...(steps ? { idealSteps: steps.filter((s) => s.role === 'ideal'), fallbackSteps: steps.filter((s) => s.role === 'fallback') } : {}),
        });
        return ok(undefined);
      },
      softDelete: async (id) => {
        const t = tasks.get(id);
        if (t) tasks.set(id, { ...t, deletedAt: '2024-01-01T00:00:00.000Z' as Instant });
        return ok(undefined);
      },
      duplicate: async (id) => {
        const t = tasks.get(id);
        if (!t) return err({ code: 'NOT_FOUND', message: 'not found' });
        const copyId = `${id}-copy` as Id;
        tasks.set(copyId, { ...t, id: copyId });
        return ok(copyId);
      },
    },
    logs: {
      listForDate: async (date) => [...logs.values()].filter((l) => l.date === date),
      listForTask: async (taskId, from, to) => [...logs.values()].filter((l) => l.taskId === taskId && l.date >= from && l.date <= to),
      listRange: async (from, to) => [...logs.values()].filter((l) => l.date >= from && l.date <= to),
      upsert: async (log) => {
        if (skipUpsertCalls !== null) {
          if (skipUpsertCalls > 0) {
            skipUpsertCalls -= 1;
          } else {
            skipUpsertCalls = null;
            return err({ code: 'WRITE_FAILED', message: 'forced test failure' });
          }
        }
        logs.set(`${log.taskId}:${log.date}`, log);
        return ok(undefined);
      },
      deleteForTask: async (taskId) => {
        for (const k of [...logs.keys()]) if (k.startsWith(`${taskId}:`)) logs.delete(k);
        return ok(undefined);
      },
    },
    offDays: {
      listRange: async (from, to) => offMarks.filter((m) => m.date >= from && m.date <= to),
      mark: async (m) => {
        offMarks.push(m);
        return ok(undefined);
      },
      unmark: async (date, taskId) => {
        offMarks = offMarks.filter((m) => !(m.date === date && m.taskId === taskId));
        return ok(undefined);
      },
    },
    asNeeded: {
      listForTask: async (taskId) => asNeeded.filter((u) => u.taskId === taskId),
      append: async (u) => {
        asNeeded.push(u);
        return ok(undefined);
      },
    },
    progress: {
      listXpAwards: async (from, to) => [...xpAwards.values()].filter((a) => (!from || a.date >= from) && (!to || a.date <= to)),
      appendXpAward: async (award) => {
        if (failAppendOnce) {
          failAppendOnce = false;
          return err({ code: 'WRITE_FAILED', message: 'forced test failure' });
        }
        const key = `${award.taskId ?? 'null'}:${award.date}`;
        const existing = xpAwards.get(key);
        // Mirrors `progressRepository.ts`'s real SQL exactly: `ON CONFLICT (task_id, date) DO
        // UPDATE SET kind = excluded.kind, amount = excluded.amount, cycle_id =
        // excluded.cycle_id` — `id` and `created_at` are NOT in that SET clause, so a
        // re-affirmation (reconcile touching an occurrence whose award already exists)
        // preserves the original row's identity. A blind `.set(key, award)` here previously
        // replaced the whole object on every call, silently re-stamping `id`/`created_at` on
        // every touch and diverging from production — caught by C4r's award-identity
        // assertion (review pass 1, blocking item 2).
        xpAwards.set(key, existing ? { ...existing, kind: award.kind, amount: award.amount, cycleId: award.cycleId } : award);
        return ok(undefined);
      },
      retractXpAward: async (taskId, date) => {
        xpAwards.delete(`${taskId}:${date}`);
        return ok(undefined);
      },
      lifetimeXp: async () => [...xpAwards.values()].reduce((sum, a) => sum + a.amount, 0),
      cyclingXp: async (cycleId) => [...xpAwards.values()].filter((a) => a.cycleId === cycleId).reduce((sum, a) => sum + a.amount, 0),
      listUnlocks: async () => [...unlocks.values()],
      upsertUnlock: async (u) => {
        unlocks.set(u.key, u);
        return ok(undefined);
      },
      listCycleRecords: async () => cycleRecords,
      getCycleRecord: async (id) => cycleRecords.find((r) => r.id === id) ?? null,
      appendCycleRecord: async (r) => {
        appendCycleRecordCallCount += 1;
        if (failAppendCycleRecordAtCall === appendCycleRecordCallCount) {
          return err({ code: 'WRITE_FAILED', message: 'forced test failure' });
        }
        cycleRecords.push(r);
        return ok(undefined);
      },
    },
    settings: {
      get: async () => settings,
      patch: async (patch) => {
        settings = { ...settings, ...patch };
        return ok(settings);
      },
    },
    assistant: {
      listConversations: async () => [],
      getConversation: async () => null,
      listMessages: async () => [],
      upsertConversation: async () => ok(undefined),
      appendMessage: async () => ok(undefined),
    },
    cycleState: {
      get: async () => cycleState,
      set: async (s) => {
        if (failCycleStateSetOnce) {
          failCycleStateSetOnce = false;
          return err({ code: 'WRITE_FAILED', message: 'forced test failure' });
        }
        cycleState = s;
        return ok(undefined);
      },
    },
  };

  return {
    repos,
    reset() {
      tasks.clear();
      logs.clear();
      offMarks = [];
      asNeeded = [];
      xpAwards.clear();
      unlocks.clear();
      cycleRecords = [];
      cycleState = null;
      settings = defaultSettings();
      failAppendOnce = false;
      failAppendCycleRecordAtCall = null;
      appendCycleRecordCallCount = 0;
      failCycleStateSetOnce = false;
      skipUpsertCalls = null;
    },
    seedTask(t) {
      tasks.set(t.id, t);
    },
    seedSettings(patch) {
      settings = { ...settings, ...patch };
    },
    seedCycleState(s) {
      cycleState = s;
    },
    failNextAppendXpAward() {
      failAppendOnce = true;
    },
    failAppendCycleRecordOnCall(callNumber) {
      failAppendCycleRecordAtCall = callNumber;
    },
    failNextCycleStateSet() {
      failCycleStateSetOnce = true;
    },
    failLogsUpsertAfterCalls(skipCalls) {
      skipUpsertCalls = skipCalls;
    },
    xpAwards: () => [...xpAwards.values()],
    cycleRecords: () => cycleRecords,
    unlocks: () => [...unlocks.values()],
    logsFor: (taskId) => [...logs.values()].filter((l) => l.taskId === taskId),
    currentCycleState: () => cycleState,
    currentSettings: () => settings,
  };
}
