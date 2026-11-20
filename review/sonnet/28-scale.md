# 28 - Scale and speed of the reads (round 2)

Owner of: `src/queries/reads.ts`, `src/queries/internal.ts`. New tests: `src/queries/edge.scale.test.tsx` (fake repos, identity and query counts), `src/db/__tests__/edge.scale.test.ts` (real SQLite, timings and budgets). Test-only helpers: `src/queries/testSupport/legacyResolve.ts` (frozen copy of the old resolvers, the reference), `src/queries/testSupport/scaleData.ts` (seeded random data).

## The heavy person

60 live habits, 40 ended, 30 deleted (in Recently deleted), 200 retired days, 3 years (1095 days), 72,457 log rows, 867 off marks (whole-day and per-habit), about 3% of days pushed. Real SQLite (node:sqlite behind the expo-sqlite double), this machine, best of 3 to 5 runs. Reads are timed through the real hooks (render to data).

## Timings, before and after (ms)

| Read | Before | After |
|---|---:|---:|
| Today (`useToday`) | 1117 | 7 |
| Aggregate consistency last-7 | 1594 | 14 |
| Aggregate consistency last-30 | 1343 | 46 |
| Aggregate consistency all-time | 1453 | 613 |
| Disclosure table | 1558 | 652 |
| Trend (resolve plus every bucket) | 1651 | 581 |
| Achievements (`useAchievements`) | 1570 | 745 |
| Progress (`useProgress`) | n/a (unchanged code) | 4 |
| Task page x5 habits (a month, last-7, last-30 each) | 129 | 58 |
| Recently deleted (30 items, none expired) | n/a (unchanged code) | 3 |
| Whole-record resolve (what a log runs after) | 1451 | 571 |
| Log one day (real `useLogState`, best of 3) | n/a | 665 |

Where the whole-record time goes now (about 610 ms): about 330 ms is only fetching the 72k log rows (`logs.listRange`, row mapping and the JSON parse of `completed_step_ids` in `src/db`), about 270 ms is resolving in memory, and about 115 ms of that is the domain's date parsing (`dateMath.parse`/`epochDay` called by `isDue`/`isSameOrBefore` 3 to 4 times per occurrence). `reconcileAchievements` itself is only 27 to 40 ms.

## Budgets (asserted in the real-SQLite test)

- Today under 150 ms (measures 5 to 7).
- Last-7 and last-30 consistency under 300 ms (measure 14 and 46).
- Progress under 150, Recently deleted under 300, task page under 150 per habit (measures 3 to 12).
- Any read that needs the WHOLE history (all-time, disclosure, trend, achievements, whole-record resolve): under 1500 ms and under 0.85 times the old resolvers. The 300 ms goal for all-time consistency is not reachable at 72k log rows on this machine (the row fetch alone is 330 ms); I set the full-history budget at 1500 ms (about 2.5 times the measure, because seven other agents share the machine) and say so here rather than pretend.
- Logging one day under 2500 ms (measures 665; it is dominated by the whole-record resolve).

## Hot spots found, and what was done

1. N+1 reads: `resolveTaskOccurrences` ran `logs.listForTask` and `offDays.listRange` once per habit (200 queries for the whole record: 100 habits plus 30 deleted, two each; every off mark re-read per habit). Now ONE `logs.listRange` and ONE `offDays.listRange` serve every habit (`resolveMany`), each habit getting exactly the rows its own query would have returned (filtered to its `[from - 1, to]`). Query counts are asserted: Today with 60 habits = 0 per-habit log reads, 1 logs range read of `[date - 1, date]`, 1 off read; the whole record of 130 habits = 1 and 1.
2. Today re-resolved every habit's whole history to show one day (the screen only keeps `date === today`). `useToday` now resolves from `date` (a bounded `floor`); a push from yesterday onto today is still found because the day before is read as the pointer. The hook returned the full history before; the only consumer (`useTodayRows`) filters to the date, so behaviour for the app is identical (see the note below on the changed contract).
3. A 7-day or 30-day window re-resolved all history. `withGrowingFloor` reads 3x the window first (21 or 90 days), widens to 30x (210 or 900 days), and only then the whole history. It accepts the short read only when the walk found N counted days (`denominator >= N`), which means every date the walk looked at is inside the stretch read, so the answer is exactly the full one. For aggregate and per-task. A habit due once a month (needing about 7 months) is a test: it widens correctly.
4. Task page: `useTaskOccurrences` read the habit from creation to `range.to`; it now floors at `range.from`.
5. Off marks: `resolveOccurrence` scans the whole off-mark array for every day (`offMarks.some(date === ...)`), 100 habits x 1000 days x 800 marks. Marks are now grouped by date and each day is handed only its own date's marks (the domain only ever compares `m.date === date`, so the answer is identical).
6. Date stepping: every day of every history went through `@/lib/date`'s `addDays` (a local `Date` through date-fns, two calls per day) and the domain's `occurrencesBetween` (parses the date each step). `internal.ts` now steps through a lazily built calendar table (1990 to 2070, pure data, cannot go stale; falls back to UTC arithmetic outside it, and to the domain's own walk for the due dates outside it) and calls the same `isDue` per day. Proved identical by the random comparison.
7. Trend ran `aggregateConsistency` once per bucket over EVERY occurrence (36 buckets x 60k occurrences, each call filtering and grouping all of them). Occurrences are now partitioned by bucket once (binary search), each bucket aggregates only its own. Same results (aggregate reads nothing outside its window).
8. Retired days keep the id they would have had in the whole record when trimmed by a floor (`retired:<index among days up to to>`), so floor reads are exactly a filter of the full record.

No caching was added that could go stale across writes. The only cache is the calendar table (pure data).

## Tests added

`src/queries/edge.scale.test.tsx` (fake repos, 40 tests):
- 12 seeds: per habit, all live, and the whole record equal the frozen old resolvers over the whole history, for three `to` dates (today, 40 days back, 9 days ahead). Random data: every cadence, events, courses, as-needed, two-dose habits, ended, deleted, pushed days (up to 15% of days), whole-day and per-habit off marks, 15 retired days.
- 12 seeds: a `floor` gives exactly the full answer filtered from the floor, per habit, all live and record, at 12 random floors, and with the floor sitting on the day a push lands.
- 12 seeds: every read hook equals the old answer: aggregate last-7, last-30, all-time; per-habit all three windows for 4 habits; task page; disclosure; trend (every bucket's percent and breakdown); achievements; Today's date slice.
- A set of monthly habits (7 counted days take 7 months) forces last-7 and last-30 to widen past the first stretch, and still equals the old answer.
- Query counts: Today with 60 habits; the whole record of 60 + 40 + 30 habits; last-7 reads from within 30 days.

`src/db/__tests__/edge.scale.test.ts` (real SQLite, 14 tests): seed check; Today; aggregate last-7, last-30, all-time; disclosure; trend; achievements; progress; task page x5; Recently deleted; a diagnostic breakdown of the whole-record read; the whole-record resolve (and `reconcileAchievements` on top); a real `useLogState`. Each timed against the old resolvers on the same file with the answers compared for equality, and asserted against the budgets above. It prints the table (the numbers above).

## Results

`npx jest src/queries src/db ...`: all existing tests still pass (195 in `src/queries` before and after my change; see the final run line in my summary). `tsc --noEmit` has no errors in my files (errors that exist are in other agents' files: `app/edge.journeys.test.tsx`, `src/edge.copy.test.ts`, `src/queries/edge.simulation.test.tsx`). ESLint: warnings only (import order in the jest-mock style files, same as the existing tests).

## Behaviour changes to be aware of

- `useToday(date)` now returns occurrences dated `date` (including a day pushed onto it), not each habit's whole history up to `date`. `useTodayRows` already filtered to `date`; the doc comment there describing the old contract is now stale (not mine to edit). Three existing tests that read `useToday` filter by date and pass unchanged.
- `resolveTaskOccurrences`, `resolveAllOccurrences`, `resolveRecordOccurrences` take an optional trailing `floor` (existing callers in mutations.ts are unchanged).
- Mock repositories used by other tests must now provide `logs.listRange` and `offDays.listRange` (the fake repos already do; no test broke).

## Not done, for the main session

- The remaining cost of every full-history read is the fetch of 72k log rows (330 ms here, likely worse on a phone through the native bridge) plus about 115 ms of date parsing inside the domain's `isDue`/`isSameOrBefore` (string comparison would be enough; `src/domain` is not mine). Options: compare `LocalDate`s as strings in `isSameOrBefore`/`isAfter`, and have `logRepository` skip `JSON.parse` for `'[]'`. Both are outside my files.
- The reconcile step after every log runs the whole-record resolve (570 ms here) because achievements need the whole history. A log-time reconcile could keep the record in memory, but that would be a cache across writes, which I was told not to add. Cheaper without caching: only recompute badges that a log can change, or run reconcile off the tap's critical path. In `mutations.ts` (logging agent).
- Progress screens that mount the all-time ring, the trend and achievements at once each do their own full read (about 600 ms each, in parallel). Sharing one read between them would need coalescing in-flight reads; I left it because a read started before a write could then answer a screen opened after it.
- Not testable here: real phone speed. The double is in-process and synchronous underneath; expo-sqlite crosses a native bridge per query, so the removed per-habit queries (200 to 260 round trips per record read) save more on device than the timings show, and 72k row mapping will cost more.
