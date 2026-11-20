# 17 — Numbers (consistency, XP and levels, badges, cycles)

Run: `src/domain/edge.numbers.test.ts` (domain, 56 tests) and `src/queries/edge.numbers.test.tsx`
(query layer, 21 tests, of which 3 are `test.failing` BUG markers). Both pass. `npx tsc --noEmit`
has no errors in these files or in the four owned domain files.

Source files I own and read: `src/domain/consistency.ts`, `xp.ts`, `achievements.ts`, `cycles.ts`.
No change to them was needed: every domain expectation I wrote holds against the current code.
The bugs found are in `src/queries/` (not owned by me), so each is a `test.failing` marker instead of a fix.

## Tests, grouped

### Domain: consistency (`edge.numbers.test.ts`)
Start of use
- zero history reads null (not 0%) on last-7, last-30, all-time, both scopes: pass
- one ideal day reads 100% on every window: pass
- one missed day reads 0% once resolved: pass
- a window longer than history truncates and never fabricates days: pass

Off days, pending today, every day off
- every due day off: null percent, offs tallied, nothing counted: pass
- off days do not consume a last-7 slot; the window reaches past them (counted dates 03-01..03-10, 86%): pass
- pending today is excluded, not a miss: pass
- day whose only due task is pending is absent from the aggregate denominator: pass
- one off + one pending task is neither counted nor a fully-off day: pass
- one off + one shown-up task is f = 1, not 1/2: pass

Fallback vs ideal weighting and rounding
- ideal and fallback count equally as shown up: pass
- aggregate ideal + missed on one day is f = 0.5, 50%: pass
- fallback + missed = 0.5, ideal-only day = 1.0, 75%: pass
- percent never above 100 and never NaN over mixed patterns: pass
- rounding: 1/8 -> 13, 2/3 -> 67, 5/6 -> 83: pass
- exact .5 tie from a fraction sum (12.5 -> 13), no float drift: pass
- dayFractions lists only resolved days: pass

Future dates
- an occurrence dated after today is ignored by both scopes: pass

### Domain: XP and levels
- 10 for ideal, 6 for fallback, 0 for missed/off/pending/not-due: pass
- level boundaries exact: 99 is L1, 100 is L2 with 0 into it, 349 is L2, 350 is L3: pass
- xpForLevel ladder 100, 250, 400, 550: pass
- negative lifetime XP clamps to L1 with 0 into it: pass
- titles: L1 "Getting started", L7 "Consistent", L8 "Dependable" (design-pinned), L10 and beyond "Enduring": pass
- very large XP total resolves to a whole level with remainder below its threshold: pass

### Domain: badges (conditions at exact threshold and one below)
- showing-up-7 dated the 7th shown-up day; 6 does not unlock: pass
- a day counts once for showing-up when two tasks show up that day: pass
- a day where every due task was missed does not count: pass
- showing-up-30 dated the 30th day; 29 does not unlock: pass
- showing-up-50 at 50 (not 49); showing-up-200 dated the 200th day (not 199): pass
- Safety net dated the first fallback day; no fallback, no badge: pass
- Never zero at exactly 10 (dated the 10th, not at 9); Saved 25x at exactly 25 (not 24): pass
- Comeback: same task shown up the day after a miss, dated that next day: pass
- Comeback does not fire for a two-day gap: pass
- 100 done dated the 100th shown-up occurrence (not the 99th): pass
- Course x3 needs three courses, dated the third end date: pass
- Full week dated the 7th day; six days is not enough: pass
- Full week not broken by a fully-off day (not a due-day shown up): pass
- Full week broken by one missed task on one day: pass
- Tenure: First day on the anchor only; 1 Week exactly 7 days after (not 6): pass
- Tenure: 1 Month from Jan 31 clamps to Feb 29 in a leap year: pass
- Tenure: 1 Year from Feb 29 lands Feb 28 in a non-leap year: pass
- clock moved backward never unlocks a future tier, never re-dates a stored one: pass
- already-unlocked badges are never returned again: pass
- catalogue keys unique, labels non-empty: pass

### Domain: cycles
- a monthly window ending on the last day ends that day; next day starts a new cycle: pass
- a cycle ending yesterday is elapsed; one ending today is not (boundary): pass
- several dormant monthly cycles: each appears once, in order, contiguous, unique ids: pass
- long weekly absence stays contiguous, no double-counted day: pass
- mid-cycle leading partial runs to its natural end, not the calendar start: pass
- a cycle after a partial starts the day after and is a full natural window: pass
- unsupported cadence value falls to a monthly window: pass
- cycle id is deterministic per cadence and start: pass
- Feb 2100 (non-leap) ends the 28th; Feb 2000 ends the 29th: pass
- weekly cycle straddling New Year (2024-12-30..2025-01-05), and the next one: pass
- monthly December rolls to a 31-day January: pass

### Query layer: XP (`edge.numbers.test.tsx`, real `logState`/`markOffDay`/`useDeleteTask`)
- logging ideal awards 10 once, total 10: pass
- un-log (To do) retracts; un-logging again stays at 0, never negative: pass
- ideal then fallback downgrades the one award to 6 (one row, not two): pass
- marking the day Off never retracts earned XP: pass
- soft-deleting the task never takes XP away: pass
- re-affirming the same chip does not add to the lifetime total: pass
- BUG (test.failing): re-logging the same ideal reports `xpAwarded` 10 again, not 0. See bug 1.
- level-up fires exactly when lifetime XP crosses 100 (90 + ideal 10), event emitted once with level 2: pass

### Query layer: badges through real logging
- seven shown-up days unlock showing-up-7 dated the 7th day and it is persisted (6th does not): pass
- first fallback unlocks Safety net dated that day, not the later persist day: pass
- a badge survives deleting the task that earned it: pass
- the achievements read shows the true date and counts only live history: pass

### Query layer: consistency read at start of use
- brand-new user (task created today, no logs) reads null, not 0%: pass
- one day logged reads 100% on aggregate last-7: pass

### Query layer: cycles
- app not opened for three monthly cycles: one log archives Jan, Feb, Mar once each, in order; pointer moves to April: pass
- retrying the boundary sweep archives nothing new (idempotent): pass
- record includes days of a deleted habit (30 done days) and a retired-for-good day (missed): breakdown ideal 30, missed 1, 97%: pass
- cadence change on the first day of a cycle archives no zero-length record; fresh 2-day weekly window: pass
- mid-month cadence change archives a short record ending yesterday (disjoint from the fresh window): pass
- BUG (test.failing): first log after a boundary credits the closed cycle's record. See bug 2.
- BUG (test.failing): progress read names the stale cycle when the app was not opened for months. See bug 3.

## Bugs found (none fixed here: all in files outside my ownership)

### Bug 1 — re-logging the same chip reports XP again (`src/queries/mutations.ts:291`)
- Cause: `reconcileOccurrence` sets `xpAwarded = amount` after a successful `appendXpAward`, even when the
  upsert changed nothing (same chip, same amount). The lifetime total is correct (10, not 20), but
  `logState` returns `xpAwarded: 10` again, so `xp:awarded` is emitted again and the toast/celebration
  says "+10 XP" for a day already earned.
- Fix: compare with `existingAward` before writing. Report `xpAwarded` as the delta in lifetime XP
  (new amount minus previous amount, or 0 when the kind and amount are unchanged).
- Test: `src/queries/edge.numbers.test.tsx`, "BUG: re-logging the same ideal reports xpAwarded 0 the second time".
  Observed: `Expected: 0, Received: 10`.

### Bug 2 — first log after a cycle boundary is credited to the closed cycle (`src/queries/mutations.ts:277-278`, `:344`)
- Cause: `reconcileOccurrence` stamps a new XP award with `getOrInitCycleState(...).currentCycleId`, which
  is still the old cycle, because `reconcileCycleBoundaries()` only runs at step 5 (`:344`), after the
  award is written. The cycle is then archived with the new XP in its `cyclingXpFinal`, and the new
  cycle starts at 0.
- Fix: call `reconcileCycleBoundaries()` before the award (at the start of `reconcileOccurrence`, or
  before `getOrInitCycleState` at `:277`). Keep the archive-before-reset order.
- Test: "BUG: the first log after a cycle boundary is credited to the NEW cycle". Observed: January
  record `cyclingXpFinal` is 10, expected 0.

### Bug 3 — progress read shows a stale cycle until the next log (`src/queries/reads.ts:201`)
- Cause: `useProgress` reads the `cycle_state` pointer as-is. Nothing advances it on app open or on
  focus (`reconcileCycleBoundaries` is called only from mutations and is exported only for tests), so
  after several cycles the Progress screen names the old window and its cycling XP, and the archived
  records appear only after the next log.
- Fix: run the boundary catch-up on app foreground (a guarded mutation or query), and/or have
  `useProgress` derive `currentCycle` from `today` when the pointer is behind.
- Test: "BUG: the progress read names the cycle containing today even when the app was not opened for months".
  Observed: `Expected "2024-04-01", Received "2024-01-01"`.

### Observation (not a bug by the spec)
- `ARCHITECTURE.md` 6.5 makes the aggregate breakdown a per-field display rounding, so
  `ideal + fallback + missed` need not equal the denominator (for example one day with one ideal and
  one fallback task shows 1 / 1 / 0 over a denominator of 1). The spec says this is deliberate. Left as is.

## Not tested, or not fully tested
- Pushed occurrences (XP keyed to the source date, the additive second occurrence): covered by other
  suites, not re-tested here.
- Real SQLite behaviour (`UNIQUE (task_id, date)`, `ON DELETE SET NULL` on XP after delete-forever):
  not run against a real database in this campaign.
- Time zone and clock changes (device zone change, midnight with the app open, leap-day logging on a
  real device): the domain takes explicit dates, so only the query tests use the mocked clock.
- Badge `createdAt` stamping and the celebration pop-ups: UI, needs a phone.
- The `persistEarnedBadges` path runs inside `useDeleteTask`; I tested only the outcome (badge kept).

## Run notes
- The `--selectProjects ... <path>` form from the brief ran the whole project; I used
  `--testPathPattern` to run only my files.
- Other suites in the domain project failed intermittently while other agents edited their files
  (timezone, validation, dateMath). None of those failures are in my files, and my domain file passed on each run.
