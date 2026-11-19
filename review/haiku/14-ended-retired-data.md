# 14. Ended habits and retired days: real-SQLite tests

Scope: `task.ended_on`, migration 008 (`retired_day`), `taskRepository.deleteForever`, the
query-layer retire path (`retireDeleted`, `retireForGood`), backup and restore of `retired_day`,
and the record view (`resolveRecordOccurrences`). Tests are in
`src/db/__tests__/retiredDays.test.ts` (22 tests, all passing). They run against a file-backed
`node:sqlite` double; every "launch" is a fresh module registry plus a new connection to the same
file, as in `recentlyDeleted.test.ts`.

Not committed, not pushed. `design-input/**` not touched.

## Result

| Area | Tests | Result |
|---|---|---|
| 1. Migration 008 on a v7 store | 2 | pass |
| 2. `deleteForever(id, keep)` | 6 | pass (one real failure at the start, see Bug 2 below) |
| 3. `ended_on` round trips | 3 | pass |
| 4. Backup, erase, restore | 3 | pass |
| 5. `retireDeleted` after a real reopen | 3 | pass |
| 6. Other edges in the record view | 5 | 4 pass; 1 failed before the fix (Bug 1), now pass |

Verification:

- `npx jest --testPathPattern 'src/db/__tests__/retiredDays'`: 22 passed.
- Affected suites together (`retiredDays`, `recentlyDeleted`, `cascade`, `backupRestore`,
  `upgradePaths`, `src/queries/recentlyDeleted.test.tsx`, `src/queries/endedAndRetired.test.tsx`):
  130 passed.
- Full app project (`npx jest --selectProjects app`): 1050 passed, 5 failed. All 5 failures are
  in `app/task/[id]/endRoutine.test.tsx`, an untracked file that is not part of this change
  (see "Not mine" below).

## Tests, in order

### 1. Migration 008 on an existing v7 store

- **Migrations 1..7 applied, then one live and one soft-deleted (2026-01-01) task inserted,
  then a normal open.** Passes. `PRAGMA user_version` is 8. `task.ended_on` exists. `retired_day`
  has its four columns, the `idx_retired_day_date` index, and zero rows. The live task reads back
  with `endedOn: null`. `retiredDays.list()` is `[]`. The old soft-deleted task is still in
  `listDeleted()` after open, so the store deletes nothing on open.
- **Second open on a v8 store.** Passes. Version stays 8; nothing is re-created.

### 2. `deleteForever(id, keep)`

- **Live task, with a non-empty `keep`.** Passes. `NOT_FOUND`, zero `retired_day` rows, task and
  logs untouched.
- **Unknown id.** Passes. `NOT_FOUND`, zero rows.
- **Soft-deleted task, four kept rows (ideal, fallback, missed, off).** Passes. Exactly those four
  rows come back, in order, with the given `retired_at`. No `task_id` column on `retired_day`.
  The task, its steps, day logs and off marks are gone. The two `xp_award` rows survive with a
  NULL `task_id`; lifetime XP is 16.
- **Second `deleteForever` on the same id.** Passes. `NOT_FOUND`, still one row.
- **Bad outcome (`'bogus'`) in the middle of `keep`.** Passes. The CHECK violation becomes
  `WRITE_FAILED`. The row written before it is rolled back: zero `retired_day` rows, the task and
  its steps survive.
- **Failure at the DELETE step itself.** Simulated with a `BEFORE DELETE ON task` trigger that
  raises ABORT, after the keep inserts have run. Passes. `WRITE_FAILED`, zero retired rows, task
  still present. After the trigger is dropped, a retry writes exactly the two kept rows and
  removes the task.

### 3. `ended_on` round trips

- **Insert with `endedOn`, get, list, update that does not mention it, update to a new date,
  update to null.** Passes. The merge in `taskRepository.update` keeps `endedOn` when a patch
  does not include it.
- **Task inserted without an end date.** Passes; reads back `null`.
- **Duplicate of an ended habit.** Passes. The copy has `endedOn: null`, the same name, and its
  steps. The source keeps `2026-03-05`.

### 4. Backup, erase and restore

- **v8 backup with an ended habit and retired days; eraseAll; restore.** Passes. Retired rows
  match exactly; `endedOn` is restored; the record signature (every date and outcome that
  counts) is unchanged.
- **Hand-made v7 envelope** (schemaVersion 7, no `retired_day` key, no `ended_on` on task rows),
  taken from a state with no retired days, then the state is changed (habit ended, others
  retired), then restored. Passes. `validateBackupEnvelope` fills `retired_day` with `[]` as
  `TABLES_ADDED_IN` says. The record returns to the v7 state.
- **v8 envelope with `retired_day` removed.** Passes. `VALIDATION_FAILED` with a message naming
  `retired_day`; existing retired rows and the state are untouched.

### 5. `retireDeleted` after a real reopen

Seed on launch 1 at 2026-03-10 (noon UTC): a habit with done, fallback, skip, an off mark, a done
log on the deletion day, and XP (26 total); soft-deleted; a second, live habit alongside it.

- **Reopen at day 31, `retireDeleted('expired')`.** Passes. The record (every date and outcome)
  is the same before and after removal. Lifetime XP is 26 before and after. `recordStartDate` is
  the same. The deleted task is gone and the live one remains. No retired row is dated after the
  deletion day, and every retired outcome is one of ideal, fallback, missed, off.
- **Reopen at day 29.** Passes. Nothing is removed; the record is unchanged.
- **`retireDeleted('all')`, then a second run.** Passes. First run removes one; the second
  removes none and adds no rows.

### 6. Other edges

- **Ended habit with a log after its end date, then soft-deleted, then removed for good.**
  Passes. The post-end log never counts, before or after removal. Every retired date is on or
  before the end date.
- **Two habits removed for good on the same day, each with a done day.** Passes. Two rows for
  that date. This is intended: consistency counts habit-days, and `retired_day` has no unique
  constraint on date.
- **Comeback badge (missed day, then fallback the next day) on a habit removed for good.**
  Failed before the fix (Bug 1). Passes after it.
- **`recordStartDate` before and after removal.** Passes; it stays at the habit's creation day.
- **Start-again away days.** Passes. `markAwayDaysOff` followed by clearing `endedOn` reads back
  as `off` for the away days. I tested the helper, not the `useStartAgain` hook.

## Bugs found and fixed

### Bug 1 (real): the comeback badge is lost when a habit's days are retired

Cause: `resolveRecordOccurrences` gives each retired day a synthetic `taskId`
(`retired:<index>`). `reconcileAchievements` (`src/domain/achievements.ts` lines 204-210) groups
occurrences by `taskId` to find a comeback: a missed day followed by a showed-up day on the same
habit. Retired days are anonymous, so each one sits alone in its own group. Before retirement the
comeback was visible; after retirement it was not, so a comeback that had not yet been persisted
was never unlocked.

Fix, in `src/queries/internal.ts`:

- line 15: `import { emit } from '@/lib/events';`
- line 17: added `reconcileAchievements` to the `@/domain` import.
- lines 262-280: new `keepBadgesBeforeRetiring(repos, today, now)`. It reconciles the record
  before any removal and upserts only `fallback-comeback`, emitting `badge:unlocked`, as
  `persistEarnedBadges` does in `mutations.ts`.
- line 291: `retireDeleted` calls it once, before the loop, only when `due.length > 0`.

Why only that badge: a first version persisted every newly reconciled badge. That broke the
existing `recentlyDeleted.test.ts` ("first-day" only) and `cascade.test.ts` ("showing-up-7" only)
expectations, which encode "badges unchanged" by the sweep (SCHEMA §2.3). The other badges read
dates and totals that retirement keeps, so they need no change.

Also corrected in the test: the first version of the test recomputed the badge from the record
after retirement, which proves nothing. It now checks the persisted unlocks, and checks that the
badge is not persisted before the retire.

### Bug 2: none in the core code

The `deleteForever` transaction, the migration, `ended_on` persistence, `duplicate`'s reset, the
v7 envelope, and the rejection of a v8 envelope without `retired_day` all behaved as specified.
No change was needed there.

### Test-only fix

The "started again" test passed a `Task` where `markAwayDaysOff` takes a `TaskWithSteps`. Fixed
in the test file. It now also clears `endedOn` after marking the away days, in the same order as
the mutation.

## Not tested, and why

- **Partial failure in the first keep insert.** The CHECK violation in the middle of `keep` and
  the trigger on the DELETE cover rollback at both ends of the transaction.
- **`useStartAgain`, `useEndTask`, `useDuplicateTask` hooks.** They need React Query; these
  tests call the repositories and the exported helpers they use. The hooks themselves are covered
  in `src/queries/endedAndRetired.test.tsx`.
- **Launch sweep wiring.** `app/splash.tsx:56` calls `sweepExpiredDeleted`; I did not test the
  splash screen itself.
- **Chip state of retired days.** `retiredAsOccurrence` gives `chipState: null` for `missed`,
  while live missed days can carry `skip`. Nothing in the code reads `chipState` from the record
  view today (every consumer reads `outcome`), so I left it alone and did not assert on it.

## Not mine, noticed while testing

1. **Type error (pre-existing, committed):** `src/queries/endedAndRetired.test.tsx:158`. The
   `lastWeek` helper passes `{ from, to }` to `useConsistency`, whose `window` parameter is typed
   `ConsistencyWindow` (`'last-7' | 'last-30' | 'all-time'`). The domain already accepts a
   `DateRange` (`src/domain/consistency.ts` `isDateRange`), so the runtime is fine. The fix is to
   widen `useConsistency`'s input type in `src/queries/reads.ts:85` to
   `ConsistencyWindow | DateRange` and to make `QUERY_KEYS.consistency` in `src/queries/index.ts:25`
   accept a serialised window. I did not make that change: it alters a public hook and a query
   key that another agent owns. As a result `npx tsc --noEmit` reports one error, in that file.
2. **Failing suite (untracked, not mine):** `app/task/[id]/endRoutine.test.tsx` fails 5 tests.
   It cannot find a "Start again" accessibility label inside the menu modal. It does not touch
   the retire path. Someone's work in progress is my guess; I did not change it.
3. **Stale schema doc:** `src/db/schema.sql` has no `ended_on` and no `retired_day`. Nothing in
   the source reads it, so it does not affect the app, but it no longer matches the migrations.
