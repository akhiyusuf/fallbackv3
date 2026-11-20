# 42. Undo everywhere (edge round 4)

Haiku agent, area: `src/queries/**` (mutations, internal, reads, healXp, writeQueue). Question: when a person taps the wrong thing and takes it back, does the data end up exactly as before?

## What was built

- `src/queries/testSupport/undoEngine.ts` (new). Runs one pair twice on the same seeded store and clock path: a **control** (seed, no action) and a **treatment** (seed, action, undo). Compares every raw table, the record (`resolveRecordOccurrences`), Today's list (`resolveAllOccurrences`), consistency, lifetime XP, cycling XP and badges. Ids are replaced by labels (H1, H2, H3, copy C, steps H1/s0 ...) and `id`/`updated_at` are ignored; nothing else is ignored.
- `src/queries/testSupport/undoScenarios.ts` (new). The 20 pairs, each with the undo the screen actually sends (for a log, the chip the day had before the tap; for a push, `undoSnooze`; and so on), plus `ALLOWED`: for each pair, the only kinds of difference it may leave, each with a reason. Any other difference fails the test.
- `src/queries/edge.undo.test.tsx` (new). The engine on FakeRepos, through the real mutation hooks.
- `src/db/__tests__/edge.undo.test.ts` (new). The same pairs on a real SQLite file. Every table is read raw, with snake_case columns renamed to the fake's names so one classifier serves both. Same hooks.

Five variants per pair: **same day**; **after midnight** (the action is on day D, the clock rolls to D+1 and the undo runs there, still undoing day D, as the screen's Undo does, because it closes over the day it was offered for); **another habit logged in between**; **undo pressed twice**; **all three together**.

Result: 20 pairs x 5 variants = 100 cases per suite, plus one "has a classification entry" check per pair, plus one explicit test. Fake suite: 121 tests. Real SQLite suite: 120 tests. Both pass (241 total with the explicit test).

## Bug fixed

**B1. A day taken back to "to do" or to its earlier chip stayed pinned as a manual choice, so later doses and ticked steps were ignored.**

- Cause: `logStateRaw` always stored `isManualOverride: true`, so a chip the day already showed automatically (what an Undo sends, or "to do" on an untouched day) became an override. `logDoseRaw` keeps that flag, so the day never recounted doses.
- Repro (dose habit, two doses, one ideal step): log Done, Undo, take the second dose with the step ticked. Before the fix the day shows Fallback; the control shows Done. Un-log to "to do", take one dose: before the fix the day shows "to do" and the 6 XP is lost; the control shows Fallback with 6 XP.
- Fix: `src/queries/mutations.ts:657-678`. The manual flag is set only when the chip differs from what the day would show automatically (computed from the same ticked steps and doses). Same chip, same outcome today; later doses and steps count again.
- Checked: reverting the one line makes exactly the two dose scenarios fail (5 variants each). The `src/queries` folder (485 tests, run with the fix) passes except one older assertion that a later edit of mine broke and I then restored (see below). `app/task`, `src/features/task` and `src/features/today` pass except one failure that is not mine (see "Left for the main session").
- Tests: scenarios "log done on a dose habit, un-log it, then take a dose" and "tick a step, take one dose, log done, un-log to fallback, take the second dose" (the second is the regression for the sticky Fallback case), both in both suites.

## Test list, grouped (100 cases per suite; "same day / midnight / other habit / twice / all three")

Undo of a log and of steps and doses
- log ideal, then un-log: residue row / residue / residue / residue / residue (reads identical; see A1)
- log fallback, then ideal, then un-log the ideal: exact x5 (the day goes back to Fallback, manual, as before)
- tick a step, then untick it: residue / residue / residue / residue / residue (undo twice is not run: see A6)
- take one dose, then take it back: residue x5 (dose back to 0 leaves an empty row)
- log done on a dose habit, un-log it, then take a dose: residue x5 (after the fix the dose counts; before, B1)
- log done, un-log, then tick a step: exact / residue / exact / exact / residue (the tick rewrites the row)
- tick a step, take one dose, log done, un-log to fallback, take the second dose: exact x5 (regression for B1)

Push to tomorrow
- push to tomorrow, then undo the push: residue x5
- push a habit to tomorrow, end it, then start again: exact / away day / exact / exact / away day (A2)
- push a habit, log the pushed day tomorrow, end it there, then start again: exact x5

Emergency day off
- emergency day off for one habit, then lift it: exact x5
- emergency day off for the whole day, then lift it: exact x5

End routine and Start again
- end routine (nothing logged today), then start again: exact / away day / exact / exact / away day (A2)
- end routine (logged today), then start again: exact x5

Delete, restore, delete for good
- delete a habit, then restore it (same day): exact / away day / exact / exact / away day (A2)
- delete a habit logged today, then restore it (same day): exact x5
- delete a habit, then delete it for good (no undo): record change x5 (A3; consistency and lifetime XP unchanged in all five)
- duplicate a habit, then delete the copy for good: exact / copy's creation day / exact / exact / copy's creation day (A4)

Rename and schedule
- rename, then rename back: exact x5
- change the schedule, then change it back: exact x5

Explicit (both suites where it applies)
- changing a schedule rewrites the past while it stands: past done days outside the new days leave the record; XP unchanged; changing back restores everything exactly (known issue, documented, not fixed; see K1)
- every test also asserts: no badge is ever taken back (no removed unlock, in any case)

## Differences left in place, and why

- **A1. Residue rows (residue-row).** An undo that returns a day to "nothing" leaves an empty `day_log` row (no chip, not manual, no steps, no dose, no push). Every read is identical (outcome, record, Today, XP, consistency). It is left because the logs repository has no delete. A real fix is a `logs.delete(taskId, date)` in `src/db/repositories/logRepository.ts` (outside this area), called by the write path when the day is left empty. Recommended for the main session.
- **A2. Away days across midnight (away-day-marked).** End and Start again, and Delete and Restore, after midnight mark the day they were ended or deleted on as off. This is the design (`useStartAgain`, `useRestoreTask`: "the days it was away are marked off"). It is not an undo: the toast's Undo does not outlive the toast, and restoring later is a separate act. Same-day undo is exact. **Decision for the human:** keep this (current) or make a later restore leave the day as it would have been.
- **A3. Delete for good cannot be undone (record change).** The record keeps the settled days of the removed habit as anonymous retired days (ideal, fallback, missed, off); today's unsettled entry drops out. Consistency, lifetime XP and cycling XP are identical in every case. The XP award rows lose their task link (`xp_award.task_id` set NULL, SCHEMA 2.3), which is the design. The restore that a person might try afterwards fails with NOT_FOUND and changes nothing (checked: `undoInBoth`).
- **A4. Duplicate, then delete the copy for good, after midnight (record change).** The copy is due on the day it was made; unlogged, that day counts as a miss in the record. This is the rule for any new habit (a habit created and deleted a day later leaves the same miss). Same-day undo is exact. **Decision for the human:** should a copy removed for good leave no record at all? That would need a rule that treats a duplicate's creation day differently; I did not change the rule.
- **A5. Badges earned by the tapped log stay (accepted; counted as "+" only).** Example: a tick that earns "fallback-safety-net" keeps it after the untick. Badges are upsert-only by design (the existing test in `src/queries/edge.logging.test.tsx`, "badges earned stay earned when the log that earned them is undone", encodes it). Badge rows are never removed in any case here.
- **A6. "Undo pressed twice" on a tick.** A tick has no Undo on screen (`onToggleStep` shows no toast); its inverse is the action itself. A second press is a new tap. The scenario sets `repeatUndo: false` and runs one press in that variant. Accepted as not an undo.

## Known issue documented, not fixed (K1)

Changing a habit's schedule rewrites the past while it stands: done days outside the new days leave the record (consistency falls), XP is unchanged, and changing back restores the record exactly. Covered by the explicit test in `src/queries/edge.undo.test.tsx`. Not changed: it is how the record is defined (a day counts by its cadence today). The human should decide whether a schedule change should be dated (for example, "from tomorrow").

## Other fixes made along the way (test doubles, no product behaviour)

- `src/queries/testSupport/fakeRepos.ts`, `duplicate`: the copy now takes its own creation time (the real repository does; the fake copied the source's, so a copy looked due before it existed), copy steps get new ids pointing at the copy, and the copy is not ended. This was already in HEAD when I checked (see "Left for the main session").
- `src/queries/testSupport/undoEngine.ts`: the undo targets the day of the action (the screen's Undo is a closure over the day it was offered for). My first draft read the clock at undo time and reported 30 to 40 false differences after midnight; those were harness errors, now fixed.
- I briefly changed the fake's XP award rows to mirror the schema's NULL task link on delete for good. That broke an older assertion in `src/queries/recentlyDeleted.test.tsx` ("XP is never retracted by delete, restore or delete for good"), which encodes the fake's behaviour. I reverted the fake and mirrored the link in the undo snapshot instead. I did not change that assertion.
- The real SQLite suite originally imported `DB_NAME` at the top of the file, which loaded expo-sqlite before the directory was set, so the app ran on the in-memory registry while the raw reads hit an empty file. Fixed by reading the name in `beforeAll`.

## Left for the main session

1. Residue rows (A1): `logs.delete` in `src/db/repositories/logRepository.ts`, used when a write leaves a day empty. Not in my area.
2. Decisions for the human: A2 (away days across midnight), A4 (a copy removed for good: should it leave a record?), K1 (schedule changes rewrite the past).
3. `src/features/today/TodayScreen.test.tsx:342` expects "Your first task is set." but `src/features/today/copy.ts:53` now says "Your first habit is set." (`src/edge.wording.test.ts:144` expects the new copy). Another agent's wording change, seen in the Today screen run. Not mine, left as is.
4. Git: HEAD moved to `7362262` during my run (not by me). It already contains my `mutations.ts` flag fix, my `fakeRepos.ts` duplicate fix, and the undo engine, scenarios and fake suite as they were at that moment. Later edits (the XP revert in `fakeRepos.ts`, the rewrite-the-past test, the type fixes, `src/db/__tests__/edge.undo.test.ts`, this report) are uncommitted. I did not commit or push.

## Checks run

- `npx tsc --noEmit`: exit 0 (after the last edit).
- `src/queries/edge.undo.test.tsx` and `src/db/__tests__/edge.undo.test.ts`: 241 passed.
- `src/queries` (whole folder, before the final XP revert): 484 passed, 1 failed (the recentlyDeleted XP assertion, fixed by the revert; rerun of that file: passes).
- `app/task`, `src/features/task`, `src/features/today`: 196 passed, 1 failed (the Today banner copy in item 3 above, not from this area).
- Not run: the rest of `src/db` and `app/` outside those folders (the flag change could in principle touch them; they read outcomes, not the flag).

## What I could not test (needs a real phone)

- Whether the Undo toast is still on screen after a long pause, after the app is backgrounded or killed, and whether a killed app loses the undo entirely (it does in the model: no toast after restart).
- The device's real time zone changing mid-day, and real midnight in the device's zone (the clock is mocked: day D at noon UTC, then D+1).
- Touch timing: a second tap while a save is still running (the in-flight guard is in `app/task/[id]/index.tsx`, not modelled here).
- Haptics and sounds on undo.
