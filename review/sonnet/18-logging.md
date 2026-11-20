# 18 - Logging through the real mutations (edge-case campaign)

File: `src/queries/edge.logging.test.tsx` (81 tests, all pass; fake repos + clock mock). Source fixed: `src/queries/mutations.ts` (nothing needed in `internal.ts`).
Run: `npx jest src/queries/edge.logging.test.tsx --selectProjects app --maxWorkers=2 --forceExit` (path BEFORE `--selectProjects`, or jest treats the path as a project name and runs other agents' files).

## Tests (one line each)
Log / change mind / undo (7): ideal 10 -> fallback 6 -> undo 0 -> ideal 10 with one row and one award; skip retracts; celebrate/xpAwarded per step; badges stay and never duplicate after undo; two habits same day independent; nothing-due date refused; date before creation refused.
Past days (5): missed day logged later earns on that day and undoes back to missed; several past days then edit one; Feb 29 / month end; day in an already archived cycle (no double archive); future date is accepted and awarded (pinned, UI never offers it).
Multi-dose (4): partial = fallback, all = ideal, un-dose back down to retract; manual Done overrides doses, Skip then Done recovers; more doses than required = no extra XP; doses plus steps both needed.
Multi-step weekdays (3): Monday needs A+B, Saturday only A, toggling up/down exact; a step not due that day earns nothing; manual Done then a step toggle hands over to step-driven.
Push (16): push today, both occurrences logged (20 XP); pushed first then own; undo push after logging pushed; push/undo/push; pushed logged day un-logged retracts; push onto off day (habit) and whole-day off then log then lift; push yesterday's from today; cannot-push cases (not snoozable, not due, already pushed); Monday-only pushed to Tuesday cannot be pushed on; chain of pushes; last day before an END date; last day of a course; unlogged pushed reads missed after two midnights and undo; undo with nothing pushed.
Emergency day off (10): one habit after logging, lifted restores the row exactly; whole day, two habits, rows exact; logging while off then lifting (habit); logging while WHOLE day off then lifting; off then lifted with nothing logged; double tap; not-due day; whole-day off on a pushed occurrence; off never retracts pushed XP; badges re-read on lift.
End routine (10): today done; today off; logged then off; today pushed; pushed-from-yesterday logged; logged-then-pushed then End; yesterday done pushed to today then End; unlogged push then End leaves no miss; refused after end and Start again marks the pause off; End twice at once.
Delete / Restore (8): every write refused on a deleted habit (7 mutations); restore days later; restore same day; restore with today pushed; off day through delete/restore; restore twice at once; Delete forever with pushed + off days (XP and settled days unchanged); XP never taken back.
Midnight (7): 23:59 then next day; screen opened before midnight saves to yesterday; push at 23:59 undone after midnight; year end; leap day; late log for the 30th after midnight into July (one award, June archived once); clock moved back.
Double-fire (9): logState x2 (fns and real hook), two different chips, a 4-tap burst, toggleStep and logDose x2, push x2, undo x2, push+log together, log+delete together.
Random weeks (3 tests, 92 seeded weeks of 28 taps: log/step/dose/push/undo/midnight on plain, multi-dose and multi-step habits): after EVERY tap lifetime XP equals the XP of the record's occurrences (through today+3) and no duplicate award rows. All pass.

## Bugs found and fixed (all in `src/queries/mutations.ts`)
1. Lifting an Emergency day off lost XP for what was logged while it was off. `markOffDay` reconciled only `(task, date)` for a task-level mark, never for a whole-day mark (`taskId null`), and never the pushed occurrence that sits on that date. Log done while the whole day is off, lift the day: record said ideal, XP stayed 0 until some later tap on that same day. Fix: new `reconcileOffDayChange` (about line 750): reconciles every occurrence that has a log row on the date (own, and pushed in from the day before), for the one habit or for all habits, and re-reads badges once when nothing has a row. Tests: "push onto a day that is off", "push onto a whole-day-off day", "logging while the WHOLE day is off".
2. Pushing the last day of an ended habit made that day vanish. `endedOn` clips occurrences, so a day pushed past it dropped out of the record with its log (a done day became "not-due"). Fix: `snoozeOccurrence` refuses it ("This ended on that day, so it cannot be pushed.", ~line 831). The push button's toast maps unknown messages to the generic save-failed warning; a nicer copy line in `usePushToTomorrow.ts` would be a UI follow-up (not my file).
3. End routine after "done then pushed" lost the done day (same cause: the pushed occurrence lands after the last day). Fix: `useEndTask` calls new `bringBackLoggedPush` first (clears the push on today's row, and on the last day's row, only when the pushed occurrence holds a logged ideal/fallback), so ending today also keeps that day. An unlogged push is left alone on purpose (vanishes, no miss; tested).

## Observations left alone (design, not bugs; the main session may want a call)
- `toggleStep` always writes `isManualOverride: false`: a manual Fallback/Skip chip is replaced by the step-driven state on the next step tap. Pinned in a test.
- A late log for a day inside an already archived cycle awards XP under the CURRENT cycle id (cycling XP), and the archived record's percent is not recomputed. Lifetime XP is right.
- `logState` / `logDose` accept future dates and dose counts above the requirement or negative; the UI never sends them. Future date is pinned in a test.
- Concurrent `toggleStep` x2 nets one toggle (both read the same row). No duplicate rows or awards.
- The fake `offDays.mark` appends duplicates where real SQLite upserts (harmless to every read; unmark removes all). Not changed (not my file).

## Not tested / needs a real phone
Real SQLite write serialization under truly interleaved taps (fakes resolve in lockstep; the random-week invariant covers order, not timing); a real clock crossing midnight mid-mutation (a single mutation reads `today` several times; only between-mutation moves were simulated); device time zone changes; the toast/Undo wiring and copy for the new refusal.

## Other
`src/queries/edge.numbers.test.tsx` (another agent's, in progress) had 5 failing tests when I ran the whole `src/queries` folder (level-up, badge, consistency reads); they use `logState` only, which I did not change. All 7 other suites in `src/queries` pass (190 tests). `npx tsc --noEmit`: no errors in my files.
