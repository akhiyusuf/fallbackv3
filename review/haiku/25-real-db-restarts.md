# 25. Real database, app closed and reopened (edge-case campaign, round 2)

Test file: `src/db/__tests__/edge.restarts.test.ts` (10 tests, real `node:sqlite` behind the file-backed
expo-sqlite double, the same cold-start pattern as `recentlyDeleted.test.ts`). Every "launch" is a fresh module
registry and a new connection to the same file. Nothing is closed first, like an app that was killed.

Result: 10 of 10 pass (one of them is `it.failing`, see the known defect below). Type check: no errors in this file.
Run: `npx jest src/db/__tests__/edge.restarts.test.ts --selectProjects app --maxWorkers=1 --testTimeout=300000 --forceExit`
(about 15 s on this machine).

No source file was changed. I found no bug inside `src/db/**` in these scenarios. One real defect sits in
`src/queries/mutations.ts` (outside my area), recorded below as `it.failing`.

## How the launches work

- `launch(at)`: sets the simulated clock (`today()` and `now()` in `@/lib/date` both follow it), resets modules,
  opens the store (must be `ready`), then runs what the splash screen runs: `sweepExpiredDeleted()` and `catchUpCycles()`.
- Mutations use the `__testing__` exports of `src/queries/mutations.ts` (the exact bodies the hooks wrap):
  `logState`, `markOffDay`, `snoozeOccurrence`, `undoSnooze`, `reconcileOccurrence`. Delete, restore, delete for good, empty
  Recently deleted, end routine and start again are hooks there, so their bodies are mirrored in the test line for
  line, on the same `@/queries/internal` helpers (`persistEarnedBadges`, `bringBackLoggedPush` are private there).
- Each step compares the whole stored state (every table, every row, as sorted JSON) and the record
  (`resolveRecordOccurrences`, evaluated at the previous step's day) and lifetime XP with what the previous launch
  wrote. Each cold start also checks two invariants: lifetime XP equals the sum of `xp_award`, and every shown-up
  occurrence (ideal or fallback, retired days included) has its award row.

## Tests

**Two-week script, a cold start before every step (1 test, 31 steps)**
- Nov 2 to Nov 14. Create three habits (two routines, one to-do). Log done, fallback, undo to to-do (the XP is
  retracted and comes back on re-log). Skip. Push a habit to tomorrow, then log the pushed occurrence (XP keyed to
  the day it came from). Emergency day off for one habit. Whole-day off (sick day). End a routine, start it again
  (the ended days are marked off). Delete, restore, delete, log. Delete a to-do, restore it, delete it for good.
  Delete for good (the record is compared before and after: counted days identical). Back up mid-script.
  Empty Recently deleted. Restore the backup. After the restore: the days logged after the backup are gone, and a new log lands.
- Result: pass. Every step reads back exactly the previous step's stored state, record and lifetime XP.

**A write cut short by a kill, then a cold start (4 tests)**
- Kill before the first repository call of a log write: old state (no log, no XP, lifetime 0). Pass.
- Write completes, then launch: the logged day and its XP together, lifetime 10. Pass.
- Kill at each of the 23 repository calls of one log write (`it.failing`, see below). Pass as `it.failing`.
- Cold start while a log write is still in flight on the old connection (launch after 0, 1, 2, 4, 8 ticks, not awaited):
  the new launch opens `ready`, the write lands, and the store is consistent. Pass. No `SQLITE_BUSY` seen.

**Old screen still open, both connections writing (1 test)**
- Two connections on one file, ten rounds of logs from both sides, then a race on one occurrence (done against
  fallback). The last writer wins and the award follows it (ideal 10 or fallback 6, never a mismatch). A fresh launch
  reads exactly what both sides see. Pass.

**30-day sweep across relaunches (2 tests)**
- Habit deleted, then relaunched at +1, +5, +10, +20, +29, +30 days (exactly 30 days: still kept, as the strict `<`
  says), then +30 days and 1 ms: removed. Afterwards launches at +31, +35, +60, +365 and +400 days: the retired-day
  count never changes, and what counts for a fixed day is identical before and after removal. Pass.
- Two launches sweeping at the same moment on two connections: exactly one removes the habit (1 in total), the
  retired-day count is the same after a later launch. Pass.

**Upgrade from a real v7 store (1 test)**
- A v7 file built with the real migration SQL 1 to 7 and seeded with three weeks of realistic data (two routines,
  a deleted habit, a whole-day off, a per-habit off, XP per shown-up day, emoji and newline in a name). Upgraded on
  launch. Its tables and record match a v8 store built from the same data, `user_version` is 8, and lifetime XP
  equals the stored awards. Then four steps on the upgraded store (log, end, delete, delete for good), each with a
  cold start. Pass.

**Backup, then the store moves on, then restore (1 test)**
- Backup taken at Nov 4. The store then logs a day and deletes the habit. Restore: the tables, the record and
  lifetime XP equal the backup exactly. The day logged after the backup is gone. A later launch changes nothing. Pass.

## Known defect (not fixed: outside `src/db/**`)

**A kill between the day-log write and the XP award leaves a logged day with no XP, and nothing repairs it.**

- Cause: `logState` (`src/queries/mutations.ts:617`) writes the log row, then `reconcileOccurrence`
  (`src/queries/mutations.ts:631`) writes the award (`appendXpAward`, `src/queries/mutations.ts:289`) in a separate
  statement. The two are not one transaction, and no launch-time step reconciles a logged day that has no award.
- Observed: a log write has 23 repository calls. A kill before call 4 or after call 13 gives a consistent store. A kill
  at calls 4 to 13 (between the log row and the award) leaves the day logged as done with no XP row, and lifetime XP
  short by 10 until that day is logged again.
- Test: `KNOWN DEFECT: a kill at any point of a log write never leaves a logged day without its XP` is `it.failing`,
  so the suite stays green. When it is fixed (one transaction across the log row and the award, or a launch-time
  reconcile of logged days without an award), change it to `it` and it should pass.
- Suggested fix for the main session: run the log write and its XP award inside one `withTransactionAsync` (the
  proxy's transaction gives `tx` to both), or reconcile on launch. Same pattern as `logState`, `toggleStep`,
  `logDose`, `snoozeOccurrence`, `undoSnooze`, `markOffDay` (all call `reconcileOccurrence` after a separate write).

## Notes (not defects, recorded because they are behaviour a reader should know)

- Marking a day off keeps the XP already earned for it (review pass 2, N2, by design). So after an off mark on a
  shown-up day, the record reads `off` but the award row and lifetime XP remain. The invariant in the test allows this.
- Deleting a habit for good drops its `not-due` days (the vacated source of a push) from the record. Days that count
  (ideal, fallback, missed, off) are unchanged, and the test compares only those.
- Restoring a backup taken while a habit was in Recently deleted brings it back in Recently deleted (checked at the
  two-week script's S31 step).

## What could not be tested here (needs a real phone)

- The real expo-sqlite on Android: WAL file handling, its busy timeout (the app's single 150 ms retry is not
  exercised against a real lock), and what a killed process leaves in the `-wal` file. The kill test here stops
  repository calls, it does not kill a process. A real kill could land in a state this simulation cannot produce.
- Two real connections in two processes (a widget or a background task next to the app): tested here as two
  connections in one process, where statements never truly overlap.
- Backup file written to and read back from the real document directory across a real restart (the file double keeps
  files per launch; the test copies the bytes into the next launch).
- Timing: the cold start cost on a phone (here, about 0.1 to 0.5 s per launch on Node).
