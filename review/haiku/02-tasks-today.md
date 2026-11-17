# 02 — Tasks (add, view, log) and Today: test and bug report

Area: `app/add/**`, `app/task/**`, `app/(tabs)/today.tsx`, `src/features/task/**`, `src/features/today/**`.
Run: `npx jest app/add app/task src/features/task src/features/today --maxWorkers=2`.

## 1. Summary

| Check | Before | After |
|---|---|---|
| Suites in area | 14 total: **11 failing**, 3 passing | **14 of 14 pass** |
| Tests in area | 94 total: **67 failing**, 27 passing | **101 of 101 pass** (7 added, see section 5) |
| `npx eslint <area> --quiet` | 3 errors (`as-needed.tsx:49`, `index.tsx:114`, `index.tsx:482`) | **2 errors**, both `react-hooks/set-state-in-effect`, left on purpose (section 8) |
| `npx tsc --noEmit` | Area clean | Area clean. **Not clean repo-wide**: 3 errors in other agents' priorities tests (`app/priorities/index.test.tsx:22`, `src/features/priorities/PriorityPlaceRow.test.tsx:16`, `src/features/priorities/order.test.ts:9`, `string` not assignable to `Id`). Not in my area, not touched. |

The three suites that passed before (`snoozeSlot`, `cadenceLabel`, `deleteOrigin`) were not changed.

Note on repo state: while I worked, other agents' checkpoint commits (`83be9d9`, `ab94e75`) landed on HEAD, so some of my edited test files now show as committed rather than modified. The working tree content is what I describe here. I also accidentally overwrote and then deleted the tracked file `.jest-before.log` in the repo root; I restored it from HEAD with `git show HEAD:.jest-before.log` (read-only git). Its original working-tree content before my first overwrite is not recoverable beyond that, but git status is clean for it now.

## 2. Every file I changed

App code (non-test):
- `app/task/[id]/as-needed.tsx` (`saveEdit`, ~line 62): empty or whitespace-only name is now refused with the existing warning copy "Give this routine a name to save it." and nothing is saved. The name is also trimmed before saving. This fixes a real bug (section 4).
- `app/task/[id]/index.tsx` line 482: `doesn't` changed to `doesn&apos;t` (lint `react/no-unescaped-entities`). Visible text identical.

Tests:
- `app/task/[id]/index.test.tsx`: name lookups now use text (the name is the screen title, not an input); Snooze/Undo/Duplicate/Delete/Rename/off-switch lookups use the current labels, testIDs and More menu; stat-line expectation is the current `Showed up 5 of 7 days (71%)`; per-dose and importance assertions rewritten for the current design (section 3).
- `app/task/[id]/delete.test.tsx`: delete starts from the More menu (helper `openDeleteFromMenu`); confirm is looked up inside `delete-task-sheet`; "Keep it" to "Cancel"; S23 fixture name is the default `Morning workout`.
- `app/task/[id]/icon.test.tsx`: screen title "Icon and colour", menu label "Change icon and colour", empty-search copy, Close (not Cancel) returns to S20 and is checked to leave the colour unchanged.
- `app/task/[id]/as-needed.test.tsx`: current empty-history sentence, chooser button "<name>: Done", history row "Ideal", Edit via More menu. Plus one new test (section 5).
- `app/task/[id]/celebrate.test.tsx`: rewritten for the current S24 behaviour (route replays the log toast and redirects to the task; level-up and badge are queued for the pop-up).
- `app/add/index.test.tsx`: rewritten for the add menu sheet (`AddMenuHost`) mounted over Today.
- `app/add/routine.test.tsx`: title "New routine"; as-needed footer copy; the Tuesday case now creates a second ideal step, because the per-step day grid only exists with two or more steps; routine-saved toast asserted.
- `app/add/event.test.tsx`: "One-time" default; repeat tab by role; cadence picker by testID; date error copy; "Event saved" toast asserted.
- `app/add/course.test.tsx`: fields "Starts"/"Ends"; stepper button "Increase doses per day"; error copy; "Course saved" toast asserted.
- `app/add/todo.test.tsx`: title "New to-do"; button "Save to-do"; field "Name"; a saved to-do lands on the to-dos list; "To-do saved" toast asserted; new note test.
- `src/features/today/TodayScreen.test.tsx`: added `useProgress` to the `@/queries` mock (the partial mock was the cause of 16 `useProgress is not a function` failures); copy and label updates; logging tests rewritten to assert the card, the toast with Undo and the celebration queue; `rerender` is awaited (RNTL 14's rerender is async).

## 3. Every failing test I dealt with

Initial failures: 67 in 11 suites. Every one is listed below. "Design change" means the approved screen now differs from what the test describes; per the brief the test was updated, not the app.

**`app/task/[id]/index.test.tsx` (S20), 14 tests.** Cause: mostly design change, plus mock/query setup.
- All name lookups (`displayValue: Morning workout`, 13 tests): the name is shown as the title in `TaskHero`; the rename input only exists inside the Rename dialog. Design change. Now `findByText`.
- "renders the task name, today card, and the two-slot action row (Duplicate + Snooze)": there is no two-slot row now. Snooze is a list row `Snooze to tomorrow` (testID `s20-snooze`); Duplicate is in the More menu. Design change. Updated.
- "snooze slot renders DISABLED ...": disabled row is `s20-snooze`, reason "Snoozing is turned off for this task." Updated.
- "tapping Snooze vacates today ...": row now reads the disabled reason "Nothing is due today to snooze." Updated.
- "renders "Snooze" enabled ... (acceptance test A)" and "renders "Undo snooze" ... (acceptance test B)": testIDs `s20-snooze` / `s20-undo-snooze`. Snooze logic itself is unchanged (`snoozeSlot.test.ts` still passes). Updated.
- "Duplicate copies the task ...": via More menu. Updated.
- "off-day toggle marks the task off for today": switch label is "Off today, this task only", and the test now checks the visible "Off today." copy instead of a no-op sanity check. Updated.
- "inline name edit persists via the Save name affordance": rename is a dialog from the More menu; save is `s20-save-name`. Design change. Updated.
- "Delete routes to S22 ...": via More menu. Updated.
- "stat line derives from perTaskConsistency ...": copy is now `Showed up 5 of 7 days (71%)`. Design copy. Updated. The number (5 of 7) is unchanged.
- "heatmap past-cell tap opens the drill-down popover ...": popover button is "<date>: Done" (LogButtons). Updated.
- "multi-dose card renders one full four-state StateChip per dose ...": each dose offers "Dose N of M: Done" only; Fallback and Skip are on the whole-day control. This differs from `docs/DESIGN_DECISIONS.md` D1 (see section 8). Updated to assert the current behaviour and to flag it.
- "pressing the Importance tag opens the inline Radio picker ...": the Importance options are always shown inline; there is no tag to press. Design change. Rewritten: choosing Low saves it (checked in the fake repo).
- "keys empty-history on task-lifetime data ..." was failing only on the name lookup. Passes now with no other change.

**`app/task/[id]/delete.test.tsx` (S22), 6 tests.** Cause: design change plus test setup.
- Delete from S20 and S23 now goes via the More menu (`More actions` then `Delete routine`). Helper added.
- The confirm button is inside `delete-task-sheet`, so it is looked up there (two elements carry "Delete routine").
- "Keep it": `DeleteTaskSheet` uses ConfirmSheet's default cancel label "Cancel". The spec (`ALLSCREENS_1.md` S22) says "Keep it". Test updated to "Cancel". Flagged in section 8.
- S23 cases: the fixture name is `Morning workout`, not "As-needed routine". Test setup.
- Persist-failure case: the retry banner and both buttons are checked inside the sheet.
- The 3 confirmed-delete/origin routing tests pass with the menu step added; origin logic unchanged.

**`app/task/[id]/icon.test.tsx` (S21), 4 tests.** Cause: design/copy change.
- Title "Choose icon & color" is now "Icon and colour" (`icon.tsx:64`).
- Menu and avatar label "Change icon and colour" (British spelling in the approved build).
- Empty search: headline "No icons match", subcopy "Nothing found for “…”. Try a different word." Test updated.
- Cancel: the screen has no Cancel; it closes with the header Close (X). Test renamed "Close discards …" and checks the saved colour is unchanged.
- "Save starts disabled": the Save button appears after the screen loads, so the test awaits it.

**`app/task/[id]/as-needed.test.tsx` (S23), 3 tests.** Cause: design change.
- "empty history renders the EmptyState": the copy is one sentence "Not used yet. There is no schedule and no consistency score — log it whenever the situation comes up." Updated.
- "Log used it ... logs and toasts 'Logged to history'": chooser buttons read "<name>: Done" and "<name>: Fallback" (the "Ideal" option is labelled Done in `LogButtons`); history row shows "Ideal" (no "Used ·" prefix). Updated; the toast is now asserted from the toast store.
- "Edit toggles inline name/reference fields": Edit is in the More menu and opens a dialog. Updated.

**`app/task/[id]/celebrate.test.tsx` (S24), 5 tests.** Cause: design change (decision D2 and `celebrate.tsx`).
- S24 no longer renders a celebration page. It replays the log feedback as a toast ("Ideal done" / "Fallback done", with "+N XP" detail) and redirects to the task. Level-up and badge milestones are pushed to the celebration queue.
- The "Nice — ideal done!", "You showed up 💪", "MARKER_ACHIEVEMENTS_CELEBRATE" and "Continue" expectations no longer exist anywhere in the app. Replaced with toast and queue assertions. The level-up test waits for the async lifetime-XP read.

**`app/add/index.test.tsx` (S15), 3 tests.** Cause: design change (the add menu is a sheet, `AddMenuHost`, mounted in `app/_layout.tsx`; `/add` redirects to Today and opens it).
- "renders the four rows with verbatim copy": copy is now "What do you want to add?"; rows "Routine / Repeats day to day", "Event / One-off, or repeats on a schedule", "Course / A run with an end date, like medication", "To-do or note / A loose task, no schedule". `DESIGN_DECISIONS.md` Round 4 records that S15 copy was changed after the spec. Updated.
- "tapping Routine/To-do": routed through the sheet rows (testIDs `add-pick-type-*`). Rewritten; events and courses covered too.

**`app/add/routine.test.tsx` (S16), 3 tests.**
- "empty name blocks save": title is "New routine" (`DESIGN_DECISIONS.md` D18: sentence case). Updated in every test that looked for the title.
- "as-needed toggle hides the cadence...": footer copy changed to "As-needed routines have no schedule and no consistency tracking. You log them from the Routines list when the situation comes up." Updated.
- "an empty ideal-step run-occurrence day blocks save": the per-step day grid (`Days for <step>`) only appears with two or more ideal steps. Test now adds a second step and turns Tuesday off for both. The banner check is unchanged.

**`app/add/event.test.tsx` (S17), 4 tests.**
- Title "New event" (sentence case).
- "defaults to 'Does not repeat'": the segmented control default is "One-time"; asserted by role `tab` and selected state.
- "selecting Repeats reveals the CadencePicker": the copy "Still an Event — just one that repeats." does not exist in the app. Asserts the cadence picker testID. Also `getByLabelText('Repeats')` matches two elements, so the test queries the tab by role.
- "unparseable free-typed Date": error copy is "Pick a date for this event." Updated.

**`app/add/course.test.tsx` (S18), 5 tests.**
- Fields are "Starts" and "Ends" (the spec's "Start date"/"End date" are not used). Updated.
- "missing end date": error is "Set an end date — a course runs for a fixed span." (no "always"). Updated.
- ">1 doses/day": Doses per day is a stepper, so the test presses "Increase doses per day" and checks the helper "Each dose is logged on its own. The day counts once every dose is handled." (the spec's wording differs).
- "unparseable free-typed Start date": error is "Pick a start date." Updated.
- "happy path": saves to Today (correct per spec); now also asserts the "Course saved" toast.
- "failed save": field label only.

**`app/add/todo.test.tsx` (S19), 4 tests.**
- Title "New to-do"; button "Save to-do"; field "Name" (the test's "What is it?" label does not exist). Updated.
- "happy path ... lands on Today": a saved to-do lands on the to-dos list (`ROUTES.todos`, `todo.tsx:41`). Test now asserts the to-dos list and flags the spec conflict (section 8).
- "no ideal/fallback fields": the add-menu-style "Say it instead" row mentions Fallback AI, so the queries are anchored to field labels.

**`src/features/today/TodayScreen.test.tsx` (S09), 16 tests.** Cause: mock out of date, plus design change.
- Every test failed with `useProgress is not a function`: the test's `@/queries` mock was partial. Added `useProgress` (brief: mock hooks the screen uses).
- "nothing due today": the headline and subcopy are one line of text. Updated.
- "stat chip: zero-data": the stat block only renders when a tracked task exists; the test now has one. Copy "No data yet". Updated.
- "populated": meta line is "Routine · Daily" (capitalised cadence). Updated.
- Logging tests (Done, Fallback, Skip, Undo, badge): the card no longer navigates to S24. Logging updates the card and shows a toast with Undo (`useLogFeedback`). The tests now drive a shared board state, await `rerender` (RNTL 14 rerender is async, a sync rerender silently does nothing), and assert card label, toast, Undo and the celebration queue. The "milestone badge" test asserts the queued `{ kind: 'badge', badgeKey: 'tenure-30' }` instead of a navigation.
- "failed persist reverts": card keeps its buttons; "Couldn't save that — try again." shown.
- "re-entry": CTA is "Even the fallback counts"; press asserts navigation to `/task/t1?from=today`.
- "just-added banner": "Your first habit is set." (no emoji in the code).
- "tapping anywhere on the card row": label "Movement, Routine, Daily. Opens the task".
- Whole-day off, loading, blank slate, error, search: passed once the mock was fixed.

## 4. Bugs found in app code

**Fixed**

1. `app/task/[id]/as-needed.tsx`, `saveEdit` (~line 62). The S23 Edit dialog saved whatever was in the Name field, including empty or whitespace-only text, so a routine could be left with a blank title. How a person hits it: open an as-needed routine, More (···) → Edit, clear the Name field, tap Save. Fix: trim the name; if empty, show the existing warning "Give this routine a name to save it." and save nothing. The dialog stays open. Covered by a new test (section 5).

**Found, not fixed**

2. `app/add/course.tsx`, `onSave` (lines 55–57). Nothing stops an end date earlier than the start date (`min={startDate}` only constrains the picker). How a person hits it: Starts 2026-07-20, Ends 2026-07-10, Save. The course is saved with an impossible span. The spec marks end-before-start as out of scope, so I did not invent wording. Needs a person's decision on the message and whether to block save.
3. `app/task/[id]/index.tsx`, `saveName` (line 155). If the rename field is empty, the dialog closes silently and the name is not changed. No message is shown. Minor, consistent with the rest of S20, but a person could think the rename was saved. Not changed.
4. `app/task/[id]/celebrate.tsx` line 18. The redirect to the task drops the `from` parameter, so Back from the task after an old celebrate link goes to Today rather than the original origin. Only old links hit this. Not changed.
5. `src/features/today/copy.ts`, `statLine` (line 55). The `percent` argument is unused (the percentage is shown in the ring, by design). Harmless, left alone.

## 5. Tests added

New tests (7 in total; the suite went from 94 to 101 tests, the rest are rewrites of existing names):
- `app/add/index.test.tsx`: "opens over Today with the four types and their copy"; "Event routes to S17 (New event)"; "Course routes to S18 (New course)"; "Close dismisses the menu and stays on Today". The routine and to-do row tests were rewritten in place. Together these cover: the add menu opens and routes to each add screen.
- `app/add/todo.test.tsx`: "a note saves with 'Note saved' and lands on the notes lens" (saved toast for the note type).
- `app/task/[id]/as-needed.test.tsx`: "Edit with an empty name saves nothing, keeps the editor open and warns" (regression for bug 1).
- `src/features/today/TodayScreen.test.tsx`: "logging Fallback updates the card to 'Fallback done' and offers Undo"; "Undo on the toast restores the previous (unlogged) state". The Done and Skip tests were extended to assert the card and Undo.

Saved-toast coverage across the four types (the brief's requirement): routine "Routine saved" (`routine.test.tsx`), event "Event saved" (`event.test.tsx`), course "Course saved" (`course.test.tsx`), to-do "To-do saved" and note "Note saved" (`todo.test.tsx`). Failed-save warning and kept form: routine, event, course, to-do (each has a test that checks the toast and that entered data remains).

Logging coverage on Today: Done, Fallback, Skip each update the card and offer Undo; Undo reverts (`TodayScreen.test.tsx`).

## 6. Shared files touched

None. I did not edit `src/ui`, `src/theme`, `src/queries`, `src/domain`, `src/db`, `src/services`, `src/lib`, `src/app-shell`, `src/navigation` or `__mocks__`.

## 7. What I read and found fine

Read in full or in the relevant part, for the bug hunt:
- App screens: `app/add/index.tsx`, `routine.tsx`, `event.tsx` (validation and save), `course.tsx` (validation and save), `todo.tsx`; `app/task/[id]/index.tsx` (S20, all of it), `as-needed.tsx`, `delete.tsx` (redirect), `icon.tsx` (render and save), `celebrate.tsx`; `app/(tabs)/today.tsx`.
- Feature code: `src/features/task/AddMenuHost.tsx`, `logFeedback.ts`, `snoozeSlot.ts` (resolver), `deleteOrigin.ts`, `DeleteTaskSheet.tsx`, `TaskHero.tsx` (name, meta, labels), `cadenceLabel.ts`, `dateLabel.ts`, `dateValidation.ts`, `useAsNeededHistory.ts`, `useWeekStrip.ts`, `formShared.ts` (constants), `TaskDetails.tsx` (`MetaLine`, `StatusPill`, `planSummary`).
- Today: `src/features/today/TodayScreen.tsx` (all), `TodayTaskCard.tsx`, `StatHero.tsx`, `useTodayRows.ts`, `copy.ts`.
- Shared, read only: `src/app-shell/stores/addMenu.ts`, `src/app-shell/stores/toast.ts`, `src/app-shell/stores/celebration.ts`, `src/ui/LogControl.tsx` (labels, `isLogged`), `src/ui/DateField.tsx`, `src/ui/Stepper.tsx`, `src/ui/ListGroup.tsx` (`ListRow` labels), `src/ui/MenuSheet.tsx`, `src/ui/ConfirmSheet.tsx`, `src/ui/ScreenHeader.tsx`, `src/ui/Toast.tsx` (action), `src/ui/CalendarHeatmap.tsx` (labels), `src/ui/WeekdayPicker.tsx`, `src/features/task/StepListEditor.tsx`, `src/queries/testSupport/fakeRepos.ts`, `src/features/task/testSupport/routerHarness.tsx`.
- Docs: `docs/DESIGN_DECISIONS.md` D1, D2, D3, D18, Round 4 notes on S15 copy; `design-input/fallback-handoff/uploads/ALLSCREENS_1.md` S15, S16, S17, S18, S19, S20, S21, S22, S23, S24 copy (to check which copy the build deliberately changed).

Checked with grep, no problem found: no `window`, `document`, `localStorage` or `sessionStorage` in the area. A rough scan for `<Pressable>` without an `accessibilityLabel` found none, but the scan was a heuristic, not a full check.

Found fine: S20 snooze resolution and its undo/disabled states; S20 chip and dose logic; S20 importance and necessity patches; Today row sorting, off-day toggle and its undo; `handleLog` undo path; course and event save ordering (validation before mutation); date-format validation (`isValidLocalDateString` rejects 2026-02-30); cadence ordinals and weekday ranges.

## 8. Not done / unsure

Needs a person's decision (the app follows the current build; I did not change wording or behaviour):
- **Delete sheet cancel label.** Spec S22 says "Keep it"; `DeleteTaskSheet` shows "Cancel" (ConfirmSheet default). Tests now assert "Cancel". Decide which wording is approved.
- **Per-dose control on S20.** `DESIGN_DECISIONS.md` D1 says a course's per-dose control is "this control" (Done / Fallback / Skip per dose). The build shows only "Dose N of M: Done" per dose, with Fallback and Skip on a whole-day control. The test asserts the current build. Confirm which is intended.
- **S23 chooser.** Spec: "Which version did you do?" with Ideal / Fallback chips. Build: the ideal option is labelled "Done" (shared `LogButtons`). Confirm the wording.
- **Where a save lands.** Spec is split for event, course and to-do: some lines say "always Today" (S17 line 859, S18 line 918, S19 line 976), others say "return to origin" (S17 line 495, S18 line 546, S19 line 594). Code: event and course always go to Today; to-do goes to the to-dos list (or notes lens). Tests follow the code.
- **Routine blocked-day banner.** Spec (S16 F23) gives a longer sentence ("… every step is toggled off. Turn at least one back on for Tuesday, or add a step that runs then."). Build: "Tuesday has no ideal step due. Turn at least one step back on for Tuesday." Test matches the start of the sentence.
- **Course end before start** (bug 2 above).

Left in place, lint not clearly safe to fix:
- `app/task/[id]/index.tsx` line 114 and `app/task/[id]/as-needed.tsx` line 49: `useEffect` that calls `setDeleteOpen(true)` when the `confirmDelete` param is `'1'`. `react-hooks/set-state-in-effect`. The route `app/task/[id]/delete.tsx` redirects into a freshly mounted screen, so a lazy `useState` initialiser would behave the same there. But the effect also reacts to the param changing while mounted, and I could not rule that out, so I left it. Both are the only remaining lint errors in the area.

Other notes:
- `TodayScreen.test.tsx` mocks `@/queries` with a partial factory; I added `useProgress`. The `@/db` module is not mocked there, and `logFeedback` imports `repos` from it. Tests pass because `repos` is only used on level-up, but a future level-up test in this file will need the db mock.
- RNTL 14 detail: `rerender` is async and must be awaited, or the screen does not re-render. The Today logging tests do this; no comment in the file records it, so a future editor could miss it.
