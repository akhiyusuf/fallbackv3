# 24 - A year in the life, simulated (edge-case campaign, round 2)

File: `src/queries/edge.simulation.test.tsx` (fake repos + clock mock, real mutations). Source fixed: `src/queries/mutations.ts`.
Run: `timeout 590 npx jest src/queries/edge.simulation.test.tsx --selectProjects app --maxWorkers=1 --testTimeout=600000 --forceExit`
Env: `SIM_SEEDS` (default 50), `SIM_FROM` (first seed, default 1), `SIM_REPLAY='[...ops]'` with `-t replay` replays a printed minimal case, `SIM_KNOWN=name,name` ignores listed invariants.

## Driver
Seeded (mulberry32) list of plain-data operations, 365 days from 2024-01-15 (crosses leap day, month ends). Habits: daily, weekdays, bi-weekly, monthly on the 31st, bi-monthly, yearly, courses (multi-dose), repeating and one-off events, multi-dose, multi-step with per-weekday steps, non-snoozable. Operations: log ideal/fallback/todo/skip (today and late), step toggle, dose, push, undo push, Emergency day off (habit and whole day, mark and lift), End, Start again, Delete, Restore, Delete forever, cycle cadence change, rename, reschedule (every 5th seed only, since it rewrites the past), midnight in steps of 1 day, 2-9 days and 7-27 days, opening the app (catch-up of cycles). A failure prints seed, step, and a shrunk minimal operation list.

## Invariants checked after EVERY step
xp-drop, xp-orphan, xp-missing, xp-duplicate, consistency-range (aggregate windows and per task), past-pending, settled-lost, missed-appeared, cycle-records (disjoint, contiguous, once, in the past, percent range), cycle-pointer, log-rows, badge-lost (shown badges never disappear), today-ghost.

## Result
- Seeds 1-60 passed in full after the fix below (about 5 s per seed, 50 seeds is about 4-5 minutes).
- A larger run (seeds 31-150) was started but had NOT finished when I had to hand back; its result is unknown. Rerun with `SIM_FROM=31 SIM_SEEDS=120`.
- Tally (20 seeds): about 1800 accepted logs, 600 pushes, 70 undo pushes, 370 deletes, 180 restores, 74 deletes forever, 124 ends, 200 start-agains, 227 cadence changes.
- Teeth were checked only by the bug below (found by `missed-appeared`); I did not run deliberate-breakage mutations on other invariants.

## Bug found and fixed
1. Restore turned a pushed, unlogged day into a miss (`useRestoreTask`, `src/queries/mutations.ts`, new `markAwayPushedDayOff`, just above `useRestoreTask`). A habit pushed on its last day and deleted: the pushed occurrence lives on the day after, which is not naturally due, so `markAwayDaysOff` did not mark it off and coming back read it as missed. Fix marks that target day off when it falls in the days away and was not logged. Minimal case (seed 2): `[create course, advance 1, advance 1, push today, delete, advance 1, advance 1, restore]`. Seed 16 was the same cause.
   NOTE: I did not add the named hand-written regression test before handback; the replay line above is the repro. Add `it('restore does not turn a day pushed before the delete into a miss')` using `SIM_REPLAY`'s case.

## Observations, not fixed
- Editing a schedule (`useUpdateTask` with a new cadence) rewrites the past: awards can point at days no longer due, and badges/XP can change. The simulator exempts rescheduled tasks from xp-orphan, xp-missing, xp-drop and badge-lost (only in every 5th seed).
- Possible, unverified: a task deleted right after "log done, then push" holds an award keyed to the source day whose pushed occurrence is after the deletion day, so the deleted-task record excludes it. No seed hit it.
- Not tested: real SQLite, real time zones, truly concurrent taps.

## Unfinished
Round was cut short: larger seed run not completed, named regression test not written, `npx tsc --noEmit` showed no errors in my files after the last type fix.
