# 05 — Progress, achievements, records, browse tabs, search, priorities

Agent: wave-2 area agent (progress / browse / search / priorities).
Area: `app/achievements/**`, `app/progress/**`, `app/records/**`, `app/search.tsx`, `app/priorities/**`,
`app/(tabs)/_layout.tsx`, `app/(tabs)/routines.tsx`, `events.tsx`, `courses.tsx`, `todos.tsx`,
`src/features/progress/**`, `src/features/browse/**`, `src/features/search/**`, `src/features/priorities/**`.
Commands: `npx jest app/achievements app/progress app/records app/priorities src/features/progress src/features/browse src/features/search src/features/priorities --maxWorkers=2`, `npx eslint <area> --quiet`, `npx tsc --noEmit`.

## 1. Summary

| Check | Before | After |
|---|---|---|
| Jest, my area | 11 of 11 suites failing; 51 of 98 tests failing (47 passing) | **16 of 16 suites pass; 128 of 128 tests pass** |
| ESLint, my area (`--quiet`) | 16 errors (13 `react-hooks/refs` in `Confetti.tsx`, 1 `react/display-name` in `app/(tabs)/_layout.tsx`, 2 `react-hooks/set-state-in-effect` in `app/priorities/index.tsx` and `app/progress/index.tsx`) | **0** |
| `npx tsc --noEmit` (whole project, run after my changes) | was clean from the foundations pass | **prints nothing, exit 0** |

Tests in my area: 128 in 16 suites. Of these, 30 are in five new files (9 in `order.test.ts`, 8 in `app/priorities/index.test.tsx`, 3 in `PriorityPlaceRow.test.tsx`, 9 in `CelebrationHost.test.tsx`, 1 in `badgeIcons.test.ts`). Four are new cases in existing files (2 in `ToDosBrowseScreen.test.tsx`, 2 in `SearchScreen.test.tsx`). The celebrate route test was rewritten and went from 6 cases to 3; its other 3 checks moved to `CelebrationHost.test.tsx`.

No failing test was skipped, deleted or weakened. Every failing assertion was either corrected to what the app does now, or the test setup was fixed (section 3).

## 2. Every file I changed

App code (fixes and lint only, no change to look, copy or layout):
- `app/priorities/index.tsx`
  - `move()`: a save whose `mutateAsync` throws now counts as failed (`.catch` at line 61). Before, the throw left `saving` true, so every arrow stayed disabled until the screen was left.
  - `move()`: awaits `refetch()` (line 65) before clearing the pending order (line 67). Before, the moved row jumped back to its old place for a moment after each save, because `invalidateCommon` does not wait for the refetch.
  - The `useEffect(() => setPending(null), [level])` (lint `set-state-in-effect`) is replaced by resetting `pending` in the tab's `onChange` (line 79). Same behaviour. `useEffect` import removed.
- `app/progress/index.tsx`: the effect that set the default task (lint `set-state-in-effect`) is replaced by a derived `activeTaskId` (first trackable task until one is picked). Same behaviour; the `eslint-disable` comment goes with it. `useEffect` import removed.
- `app/(tabs)/_layout.tsx`: `iconFor()` returns a named function `TabIcon` instead of an anonymous arrow (lint `react/display-name`). Renders the same.
- `src/features/progress/Confetti.tsx`: `useRef(new Animated.Value(0)).current` replaced by `useState(() => new Animated.Value(0))[0]` for `fadeIn` (line 26) and `fall` (line 75), per the brief's recipe. Timing, values and styles unchanged. `useRef` import removed.

Existing tests (mocks brought up to date, copy and design changes asserted as they now are; no assertion removed without a replacement):
- `src/features/browse/RoutinesBrowseScreen.test.tsx`: mock adds `useToday` and `useTaskOccurrences`; as-needed assertions follow the "As needed" section; FAB asserts the new-routine form.
- `src/features/browse/CoursesBrowseScreen.test.tsx`: mock adds `useTaskOccurrences`; course meta line asserted ("Day 8 of 10", "2 doses a day"); "No active courses" matched as a substring.
- `src/features/browse/ToDosBrowseScreen.test.tsx`: value is "High importance"; checkbox and row found by name regex (labels include importance and done); Notes fixture sets `isNote: true`; new tick/un-tick/Undo tests; `sfx` mocked.
- `src/features/browse/EventsBrowseScreen.test.tsx`: empty Today asserted through the "Nothing on this <day>" summary; time and "Repeats yearly" matched in the meta line.
- `src/features/search/SearchScreen.test.tsx`: mock adds `useTaskOccurrences`; "To-do" chip label; new results-of-each-type test and no-matches message test.
- `app/progress/index.test.tsx`: copy asserted as it is now (off-note punctuation, "All tasks" tab, "Full history" link, disclosure header and rows, aggregate caption, split hero/note for the truncation clause).
- `app/progress/trend.test.tsx`: "Table" / "Chart" toggle; "Jun" / "May" short labels; SR summary asserted by its bucket text; data-gap note as now written.
- `app/achievements/index.test.tsx`: locked-tenure caption "Unlocks on Jan 12, 2027, 1 year from your first day."; reset cadence is the Radio tab "Weekly"; new-user banner as now written.
- `app/achievements/celebrate.test.tsx`: rewritten to the route's real job (queue the celebration, redirect to Achievements). The pop-up assertions moved to `CelebrationHost.test.tsx`.
- `app/records/index.test.tsx`: in-progress strip asserted as "July 2026" + "In progress" pill + "128 XP so far"; short-cycle flag asserted as "Short cycle" in the meta line.
- `app/records/[cycleId].test.tsx`: header title "June 2026" and subtitle "Monthly cycle · Archived"; "XP this cycle" row with "412 XP"; short-cycle note as now written.

New tests:
- `app/priorities/index.test.tsx`
- `src/features/priorities/order.test.ts`
- `src/features/priorities/PriorityPlaceRow.test.tsx`
- `src/features/progress/CelebrationHost.test.tsx`
- `src/features/progress/badgeIcons.test.ts`

## 3. Every failing test I dealt with

Starting state: 11 suites failed, 51 tests failed. Causes below. "Mock out of date" means a partial `jest.mock('@/queries', …)` factory lacked a hook the screen now reaches through a shared component.

**`src/features/browse/RoutinesBrowseScreen.test.tsx` (11)**
- Mock out of date (`useToday is not a function`, via `useTodayRows`): loading, empty, error, "Last used" preview, tap scheduled routine, nothing-due variant, search icon, weekday tab. Fixed by adding `useToday` and `useTaskOccurrences` to the mock.
- Deliberate design change: "populated: … Other routines …" (the as-needed routine now sits in its own "As needed" section, and the card has no "Log used it" button). Test asserts the section and the "As-needed" pill.
- Deliberate design change: "tapping an as-needed card navigates to S23" (no "Log used it" button; the card is pressed by name, still goes to `/task/r2/as-needed?from=routines`).
- Deliberate design change: "the + FAB navigates to S15" (the Routines plus opens the new-routine form directly, per DESIGN_DECISIONS "Round 4, fifth pass"; label "New routine"). Test asserts `/add/routine?from=routines`.

**`src/features/search/SearchScreen.test.tsx` (5)**
- Mock out of date (`useTaskOccurrences`, from the shared TaskCard week strip): default results, typing filters live, no matches / Clear all, scheduled result tap, Type chip narrows. Fixed by adding the hook.
- Copy: "To-do/Note" chip is "To-do" (`S14_COPY.typeTodo`). Test updated after the mock fix.

**`src/features/browse/CoursesBrowseScreen.test.tsx` (4)**
- Mock out of date: Past tab, tap course card. Fixed.
- Deliberate design change: "populated (Active tab)" (the rework puts details in one muted meta line: "Day 8 of 10 · 2 doses a day · …"; no "2×/day" or "2 days left" badges). Test asserts the meta line.
- Copy shape: "no active courses … scoped empty" (one muted line, "No active courses right now. Start a new one whenever you're ready."). Matched as a substring.

**`src/features/browse/ToDosBrowseScreen.test.tsx` (4)**
- Copy: "populated" expected a bare "High" (the row shows "High importance").
- Test setup: "toggling" and "tapping the card row" looked up the checkbox and button by exact name; the labels include importance and "done". Matched by name regex.
- Test fixture bug: "Notes lens" note had no `isNote: true`, so it was not a note. Fixed in the fixture.

**`src/features/browse/EventsBrowseScreen.test.tsx` (3)**
- Deliberate design change (DESIGN_DECISIONS D15): "no events today" (the Today section is summed up in the header line "Nothing on this <day>" rather than a "No events today." line). Test asserts the summary.
- Copy shape: repeating event "7:00 PM" is one part of the meta line "7:00 PM · Repeats daily". Matched by regex.
- Copy: "Repeats · Yearly" is now "Repeats yearly". Updated.

**`app/achievements/index.test.tsx` (3)**
- Copy: locked tenure caption now "Unlocks on <date>, 1 year from your first day." (was "Locked — unlocks on …"). Updated; still checks the calendar unlock condition.
- Deliberate design change: reset cadence is a two-option Radio (tab list labelled "Resets"), not a Select. Test presses "Weekly".
- Copy: new-user banner text now "Show up once, ideal or fallback, and your first badge is on its way." Updated.

**`app/records/index.test.tsx` (2)**
- Copy/layout: in-progress strip shows "July 2026" and an "In progress" pill (the old one-line "In progress — July 2026" is gone). Updated.
- Copy: short cycle is flagged "Short cycle" in the list's meta line (the full note is on S30). Updated. See section 4 for the missing "Archived" tag and note.

**`app/records/[cycleId].test.tsx` (3)**
- Layout: header title "June 2026" and subtitle "Monthly cycle · Archived" (were one string). Updated.
- Layout: "XP this cycle" row with "412 XP" on the right (was "Cycling XP this cycle: 412"). Updated.
- Copy: short-cycle note "Short cycle, cadence changed part-way." (the current `S30_COPY` string). Updated.

**`app/progress/index.test.tsx` (6)**
- Copy: per-task off-note "4 days were off, not counted either way." Updated.
- Layout: truncation test expected the hero subcopy and the truncation clause in one string; they are two elements now. Both asserted.
- Copy: aggregate scope chip is "All tasks" (was "Aggregate"). Updated in 3 tests.
- Copy: aggregate unit caption "Ideal and fallback are rounded day credits. Off is a day count." Updated.
- Copy: disclosure header "How the all-tasks number is calculated"; rows "Wed: 2 of 2 tasks shown up, counts as 1.0" and so on. Updated.
- Copy: history link is "Full history" (sub-line "Your trend since day one"). Updated.
- All copy changes match the rework recorded in DESIGN_DECISIONS "Round 4, second pass" and the `S25_COPY` strings. Note: the spec (ALLSCREENS_1.md) still has the old wording; see section 8.

**`app/progress/trend.test.tsx` (4)**
- Test setup: "/no data/i" matched several elements. Now asserts the SR summary sentence "May 2026: 80 percent" and "June 2026: no data".
- Copy: toggle is "Table" / "Chart" (was "View as table" / "View as chart"). Updated.
- Layout: the table shows short labels "Jun" / "May". Updated.
- Copy: data-gap note "Stretches with nothing due show as a break in the line, never as 0%." Updated.

**`app/achievements/celebrate.test.tsx` (6)**
- Design/structure change: the route no longer renders the pop-up. It queues a `Celebration` in the store and redirects to Achievements, and `CelebrationHost` shows it. The six UI assertions (level title, tenure without "New title", 1-week body, no "100 tasks done", no "streak", dismiss) moved to the new `src/features/progress/CelebrationHost.test.tsx`. The route test keeps: level-up with XP, level-up falling back to lifetime XP, tenure badge; each followed by the redirect.

## 4. Bugs found in app code

Fixed:
1. `app/priorities/index.tsx:61` (line 62 before the fix; the `mutateAsync` call in `move()`). A write that throws (for example, a database error) rejected `move()`, so `saving` stayed `true`. Every arrow then stayed disabled for the rest of the visit to the screen. How a person hits it: a failed save while moving a task. Fix: `.catch` turns it into a failed save, which shows the existing "Couldn't save the new order. Try again." warning and re-enables the arrows. Test: "a save that throws unlocks the arrows again…".
2. `app/priorities/index.tsx:65–67`. The pending order was dropped as soon as the writes finished, but `invalidateCommon` (`src/queries/mutations.ts:60`) does not wait for the refetch. The moved row therefore jumped back to its old place until the list reloaded. How a person hits it: any move. Fix: `await refetch()` before clearing `pending`. The test checks that refetch is called; it does not reproduce the flicker itself (see section 8).
3. `app/progress/index.tsx` (effect that set the default task) and `app/priorities/index.tsx` (effect that reset pending on level change): both were set-state-in-effect. Replaced by derived state and a change handler (lint fixes, same behaviour).

Found, not fixed (needs a decision or new wording; the brief says to report these):
4. `src/features/browse/ToDosBrowseScreen.tsx:48–55`. `toggleDone` and the Undo action call `updateTask.mutateAsync` with `void` and no `.catch`. A database exception becomes an unhandled promise rejection, the checkbox does not change, and no message is shown. How a person hits it: a write error when ticking a to-do. Not fixed because the fix needs a new error message; the write path is `Result`-based and rarely throws.
5. `src/features/browse/ToDosBrowseScreen.tsx:105`. The checkbox label is `${tk.name}, done` whether or not the to-do is ticked, so a screen reader reads "Renew passport, done, checkbox, not checked" on an open item. Not changed: it is an accessibility wording decision.
6. `src/features/browse/RoutinesBrowseScreen.tsx` (as-needed rows). `S10_COPY.logUsedIt` ("Log used it") is defined in `src/features/browse/copy.ts:10` but never rendered. The spec (ALLSCREENS_1.md:426, 442) has a "Log used it" button on the as-needed card that logs a use from the list. Now a tap goes to S23, where it is logged. Not added: the approved look has no button there, and adding one changes the screen.
7. `app/records/index.tsx` and `src/features/progress/copy.ts:173`. `S29_COPY.archivedTag` ("Archived") and `shortCycleNote` (copy.ts:179) are not rendered on the list. The spec wants an "archived" label to tell finalized cycles from the in-progress strip (ALLSCREENS_1.md S29, lines 31, 111). The rework (D13: pills only for live status) removed the tag; the list now relies on the "In progress" pill alone. Needs a decision.
8. `src/features/browse/CoursesBrowseScreen.tsx:102–107` and `src/features/browse/copy.ts:42`. "N days left" is gone; the course card shows "Day N of M". `S12_COPY.daysLeftSuffix` is unused. The spec's "2 days left" (ALLSCREENS_1.md:523, 532) is the only place the remaining time shows. Needs a decision.
9. `src/features/browse/CoursesBrowseScreen.tsx` (empty, no active courses). The spec wants a headline, subcopy and a "New course" button; the screen shows one muted line with no button, and the FAB is the only way to add. Not changed; decision needed.
10. `app/achievements/celebrate.tsx`. Nothing in the app pushes this route (`ROUTES.achievementsCelebrate` is defined in `src/navigation/index.ts:54` and not used; level-ups and badges go to the store from `src/features/task/logFeedback.ts`). It is reachable only by a typed link. If the link has no `xp` and the progress query has failed, it queues a "Level 1" pop-up (`?? 0` fallback). Unreachable from the UI, so not changed.
11. `src/features/browse/EventsBrowseScreen.tsx:91, 134`. Uses `toLocaleDateString('en-US', …)` for the month abbreviation and the weekday name. Works in Jest. On a device it depends on Hermes' Intl support, which I could not check here. The rest of the area uses date-fns. Not changed (no device to test on); worth a look on a phone.
12. `app/(tabs)/_layout.tsx` (`iconFor`). It builds a new component type on every render of `TabsLayout`, so the tab icons remount whenever the layout re-renders (for example, on a theme change). I saw no visible symptom. Not changed.

Checked, fine (no bug found): tab route files; `CelebrationHost` queue and sound; search filters and the as-needed route branch; events repeating-row logic; priorities ordering and rank writes; `PriorityPlaceRow`; `resolveIcon`; `format.ts` helpers (`formatTimeOfDay` at 00:xx and 12:xx, weekday sets, relative day labels); every achievement has a badge glyph (new test).

## 5. Tests added

- `src/features/priorities/order.test.ts` (9): High/Medium/Low split; no-importance task excluded; ranked tasks first (lowest first), then unplaced oldest first; a task moved to rank 0 comes first; equal ranks keep input order; unplaced tasks with equal creation times keep input order; a placed task sorts before an unplaced one whatever the dates; finished things drop out (done to-do, note, ended course, past one-off event; repeating event kept); a course ending today is still live.
- `app/priorities/index.test.tsx` (8): lists the High tasks in order with numbers; moving a task up swaps it and saves each changed place (not the unchanged ones), then reloads; moving down, then up twice, ends with every rank saved; top/bottom arrows disabled; a failed save shows the warning and restores the saved order; a throwing save unlocks the arrows and shows the warning; switching level shows that level (and its empty state); one task at a level has no arrows.
- `src/features/priorities/PriorityPlaceRow.test.tsx` (3): "No. 2 of 3 in High" with its caption; press opens `/priorities?level=high`; renders nothing for a task not on that level.
- `src/features/progress/CelebrationHost.test.tsx` (9): empty queue shows nothing; a queued badge shows, plays `badge_earned` 600, and after "Nice" the next queued badge shows, then nothing; level-up title from `levelFor` (Level 8, Dependable); tenure badge has no "New title" subhead; 1-year tier shows the pinned "A full year with Fallback" body; 1-week tier does not; level-up never claims "100 tasks done"; no "streak" anywhere.
- `src/features/progress/badgeIcons.test.ts` (1): every achievement has its own glyph (so none is silently dropped from the grid).
- `app/achievements/celebrate.test.tsx` (3, rewritten): level-up with XP queues it and redirects; level-up without XP uses lifetime XP; tenure badge queues its badge key and redirects.
- `src/features/browse/ToDosBrowseScreen.test.tsx` (+2): ticking plays `todo_done`, shows a "Done" toast with Undo, and Undo clears `todoDoneAt`; un-ticking clears it and shows no toast.
- `src/features/search/SearchScreen.test.tsx` (+2): results of every type are listed, each card labelled with its type (including "Note" for a to-do note); a query with no match shows "No matches." and the subcopy.

## 6. Shared files touched

None. I did not edit anything under `src/ui`, `src/theme`, `src/queries`, `src/domain`, `src/db`, `src/services`, `src/lib`, `src/app-shell`, `src/navigation` or `__mocks__`. The `routerHarness.tsx` used by the celebrate tests was read but not changed.

Note: other agents' checkpoint commits (for example `17e6908`, `ab94e75`, `6fda6f6`) have since committed part of the shared working tree, so `git status` no longer lists every file above. The list in section 2 is the authoritative record of my edits.

## 7. What I read and found fine

App screens and routes: `app/achievements/index.tsx`, `celebrate.tsx`; `app/progress/index.tsx`, `trend.tsx`; `app/records/index.tsx`, `[cycleId].tsx`; `app/priorities/index.tsx`; `app/search.tsx`; `app/(tabs)/_layout.tsx`, `routines.tsx`, `events.tsx`, `courses.tsx`, `todos.tsx`.

Feature code: `src/features/progress/Confetti.tsx`, `CelebrationHost.tsx`, `copy.ts`, `format.ts`, `badgeIcons.ts`, `index.ts`, `testSupport/routerHarness.tsx`; `src/features/browse/RoutinesBrowseScreen.tsx`, `CoursesBrowseScreen.tsx`, `ToDosBrowseScreen.tsx`, `EventsBrowseScreen.tsx`, `copy.ts`, `format.ts`, `BrowseHeader.tsx`, `Fab.tsx`, `resolveIcon.ts`, `useAsNeededHistory.ts`, `weekdayLabels.ts`, `index.ts`; `src/features/search/SearchScreen.tsx`, `FilterChip.tsx`, `copy.ts`, `index.ts`; `src/features/priorities/order.ts`, `PriorityPlaceRow.tsx`.

Read for context only (not in my area): `src/features/task/useWeekStrip.ts`, `TaskCard.tsx` and `TaskDetails.tsx` (`metaParts`), `src/app-shell/stores/celebration.ts`, `src/app-shell/stores/toast.ts`, `src/ui/ListGroup.tsx` (`ListRow` accessibility), `src/ui/Radio.tsx`, `src/ui/TrendGraph.tsx`, `src/queries/reads.ts`, `src/queries/mutations.ts` (`invalidateCommon`, `useUpdateTask`), `src/queries/index.ts`, `docs/DESIGN_DECISIONS.md` (D13, D15, D19, Round 4 passes 2, 5, 9), `design-input/fallback-handoff/uploads/ALLSCREENS_1.md` (S10–S14, S25–S30).

## 8. Not done / unsure

- **Priorities snap-back fix (section 4, item 2) is not covered by a failing-then-passing test.** The new test checks that refetch is called and that the final order is right. The flicker itself depends on the real query timing, which the mock does not reproduce. Worth a look on a device.
- **Copy and layout decisions in section 4, items 6–9** (missing "Log used it" button, "Archived" tag and short-cycle note on the cycles list, "days left" on courses, the courses empty-state button). The app now matches the approved look as the code and DESIGN_DECISIONS describe it. The spec (ALLSCREENS_1.md) still has the old wording, and DESIGN_DECISIONS says the spec needs updating for these changes. Someone should decide whether these are intended before the spec is updated.
- **Copy I did not change:** the progress screen and trend screen match the rework's strings, not ALLSCREENS_1.md (for example "All tasks" versus "Aggregate", "Full history" versus "See full history →"). These are recorded design changes, so I asserted the current strings in the tests.
- **Routines, courses and events screens** match the rework (one muted line, D13 and D15). I did not re-check every spec line for these screens.
- **Priorities is new and has no spec in ALLSCREENS_1.md.** Its wording comes from the screen itself. A person should review it.
- **Lint and types for other areas** are not mine. My area is at 0 errors.
- **Temporary files:** I created and removed two scratch files outside the project (`/tmp/x` and `/tmp/claude-0/tsc_out.txt`). Neither is left behind.
- **Full project Jest run** was not run; only my area and the files it touches.
