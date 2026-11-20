# 38 - Races and stale data between screens, the cache and the data layer (round 3)

Owner of: `src/queries/**`, `src/lib/events.ts`. New test file: `src/queries/edge.races.test.tsx` (46 tests; real hooks, one shared QueryClient configured like the app's, fake repos, mock clock). New source file: `src/queries/writeQueue.ts`.

## Mutation x read matrix

The test mounts every read at once on ONE client (tasks, tasks incl. deleted, routines-only filter, task page, a deleted task's page, Recently deleted, Today, aggregate all-time and last-7, per-task last-30, task occurrences, disclosure, trend, Progress, achievements, Records, settings), runs the mutation through the real hook, waits for the cache to settle, then compares EVERY read with the same read on a brand-new client. "x" = the value changed (so the cell is exercised, not vacuous); every cell, changed or not, matched the fresh read after the fixes below. Achievements and Records never change in the seeded scenarios (badges here are computed live; the Records changes are covered by the cycle tests).

| Mutation | tasks | +deleted | task page | Recently deleted | Today | agg all/7 | per-task | occurrences | disclosure | trend | Progress |
|---|---|---|---|---|---|---|---|---|---|---|---|
| create | x | x | | | x | | | | | | |
| rename | x | x | x | | | | | | | | |
| delete | x | x | x | x | x | | | | | | |
| restore | x | x | x (deleted task's page) | x | x | | | | | | |
| delete for good | | x | x | x | | | | | x | | |
| empty Recently deleted | | x | x | x | | | | | x | | |
| end routine | x | x | x | | x | | | x | | | |
| start again | x | x | x | | x | x | x | x | | x | |
| duplicate | x | x | | | x | x | | | x | x | |
| log done / step / dose | | | | | x | x | x | x | x | x | x |
| log past day, undo log | | | | | | x | x | x | x | x | x |
| day off (one habit) | | | | | x | x | x | x | | x | |
| day off (every habit) | | | | | | x | x | x | x | x | |
| lift a day off | | | | | | | x | x | x | | |
| as-needed use | (no read shows it) | | | | | | | | | | |
| push to tomorrow / undo push | | | | | x | | | x | | | |
| accent | settings only | | | | | | | | | | |
| cycle cadence | settings | | | | | | | | | | x (+Records) |

Every cell matched. Achievements and Records are in every row of the comparison; they matched too.

## Tests (46)

Matrix (22): one per mutation row above (create, rename, delete, restore, delete for good, empty, end, start again, duplicate, log today, log past day, undo log, tick step, log dose, day off one and all, lift day off, as-needed, push, undo push, accent, cadence), each asserting nothing stale AND that at least one read changed.

In flight when a write lands (3): first load still running when a rename lands; refetch running with data cached; Today still loading when the habit is logged.

Two writes at once (6): the same chip from two screens (one award, one toast total, one level-up, no badge announced twice); done and fallback at once (later tap wins, XP matches); log and undo at once; delete and log at once; Push to tomorrow twice at once (one succeeds, one pushed row); 12 racing taps over 4 days (lifetime XP equals the sum over the final rows).

After unmount (1): a slow save finishes after its screen unmounted; the other mounted Today still refreshes.

Cycles (4): Progress catch-up archives May and Records shows it; launch catch-up racing the first log of June (one record, one `cycle:finalized`, award stamped with the new cycle); midnight passing between two logs; a cadence change while Progress is loading.

Launch work vs the person (5): heal racing the first log (each day awarded once, toast only for the new log); heal twice at once; sweep vs restore of the same expired item in both orders; Recently deleted's own sweep racing a restore (outcome is one thing, no orphan off marks).

Events (5): one log emits one `day:logged` and one `xp:awarded`; a level-up crossing is announced once and the order is pinned (level:up, day:logged, xp:awarded); undoing a log announces nothing and the earned badge stays, re-logging does not re-announce; a throwing handler does not stop the write or later handlers; two off-day calls emit two `offday:changed` and end in call order.

## Bugs found and fixed (each test failed before its fix)

1. A read still on its FIRST load when a write lands keeps the old answer. TanStack gives the invalidation's refetch the running promise when the query has no data yet, so a rename (or a log, or any write) that lands while a screen is opening was never shown. Today and Progress take 5 to 600 ms on a heavy record, so this is reachable. Fix: `invalidateCommon` awaits `cancelQueries` on every affected read root first, then invalidates (`src/queries/mutations.ts`, `AFFECTED_ROOTS` and `invalidateCommon`). Tests: "first load still running" and "Today still loading".
2. Two writes at once double-report. Every reconcile reads lifetime XP before and after its own change to say what IT earned. Two taps on the same habit from two screens (or a double tap across screens, or the launch repair beside the first log) both saw 0 before and 10 after: two "+10 XP" toasts, two `level:up` events (two milestone notifications), a second Push to tomorrow passing its checks before the first was written. Fix: one write at a time. New `src/queries/writeQueue.ts` (`serialWrite`); `logState`, `toggleStep`, `logDose`, `markOffDay`, `snoozeOccurrence`, `undoSnooze`, `updateSettings`, delete, restore, delete for good, empty, end, start again, `catchUpCycles`, `sweepExpiredDeleted` and `healMissingXp` run through it (renamed `...Raw` and re-wrapped, so `__testing__` still exposes the same functions). A failure never blocks the next write.
3. `healMissingXp` run twice at once (or beside a log) could award a day twice and misreport the log's XP. Same fix (queued).
4. Records stale after Progress catches the cycle up. `useProgress` archives each elapsed cycle in its own query function; no mutation was involved, so nothing invalidated Records. Fix: `useProgress` counts `cycle:finalized` during its catch-up and invalidates Records (`src/queries/reads.ts`). The fake repository had hidden this by returning its live array; `listCycleRecords` in `src/queries/testSupport/fakeRepos.ts` now returns a copy, like a database read.
5. A cadence change while Progress or settings were still on their first load left the old cadence on screen (same cause as 1). Fix: `useUpdateSettings.onSuccess` cancels settings (and Progress and Records on a cadence change) before invalidating.

## Not bugs, checked and left

- A write after the screen unmounted: TanStack runs the hook's own `onSuccess` even then, so every mounted screen refreshes.
- Event order: `level:up` and `badge:unlocked` are emitted inside the reconcile, `day:logged` and `xp:awarded` after it. Nothing listens for `xp:awarded` or orders them (the celebration uses the mutation's return value; notifications and widgets only reschedule on `day:logged`/`level:up`/`badge:unlocked`), so I pinned the order in a test rather than change it.
- Undo never retracts a badge (upsert-only, by design); undo emits nothing; re-logging does not announce it again.
- Sweep vs restore: `deleteForever` already refuses a task that is no longer in Recently deleted, so the sweep cannot remove a restored habit. With the queue the launch sweep and a restore now also never interleave. Recently deleted's own read-time sweep is deliberately NOT queued (see below).
- Midnight mid-sequence and a launch catch-up beside the first log of a new month: one record, award in the new cycle, tested.

## Risks and notes for the main session

- The queue is a module-level promise chain. A write that never settles (a hung native call) now holds every later write, where before it only held itself. I kept reads out of it (the Recently deleted read's sweep stayed unqueued because an existing screen test swaps `listDeleted` for a never-resolving promise, which would poison the queue). Never call a serialized function from inside another one.
- Mutations now take a few extra microtasks (the queue hop and the awaited cancel). No timing-sensitive test changed.
- `useToday`'s and the other reads' refetch on window focus is untouched; a read begun before a write that is INACTIVE (no screen mounted) is also cancelled, so nothing stale is cached for the next screen.
- Not tested: two real screens mounted side by side (RNTL) beyond what the existing screen suites cover; the hooks they use are the ones tested here. Real SQLite interleaving and the native bridge (where `DbClientProxy.serial` orders statements but not whole mutations) need a phone; the queue now orders whole mutations in JS.

## Results

`src/queries/edge.races.test.tsx`: 46 passed. Also run and green after the changes: `src/queries/mutations*`, `moveSemantics`, `recentlyDeleted`, `endedAndRetired`, `settingsCache`, `edge.logging`, `edge.numbers`, `edge.simulation`, `app/settings/data/deleted`, `app/task/[id]/endRoutine`, `src/features/browse`, `src/features/today`, `src/features/task`, `src/features/progress`, `app/edge.journeys`. `tsc --noEmit`: no errors in my files.
