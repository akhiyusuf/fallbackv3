# 26 - Whole journeys through the real router (Sonnet, round 2)

## Summary
28 tests in `app/edge.journeys.test.tsx`, all pass (5 of them are `it.failing`, each marking a real bug outside my files).
They run the app's real route files and the real root layout (providers, Stack, tab bar, Toast, CelebrationHost, AddMenuHost)
with `renderRouter`, the fake repositories behind them and a controllable clock (midnight is crossed with the app open).
Checked stack depth after each step (`rootStack()`), and the phone back button (the test collects every `hardwareBackPress`
listener, calls them newest first, and reports "exited" when nothing took the press).
`npx tsc --noEmit`: no errors in my files. Existing suites for navigation, task, add, search, progress, priorities, achievements, records pass.

## Bug fixed (my area)
1. **Origin-aware Back stacked a second copy of the origin** (`src/navigation/index.ts`, `useOriginAwareBack`).
   It called `router.replace(originHref)`. With a stack `[tabs, task]`, Back made `[tabs, tabs]`; every task opened and left added another
   Tabs entry, so the phone back button alternated Today / Routines / Today / Routines for six presses before leaving the app. From Search it
   also threw away the search text, because a new Search screen was mounted. Now `router.dismissTo(originHref)`: it pops to the origin that is
   still on the stack (text, tab and scroll as left) and only creates one when it is not there. The existing unit test asserted `replace`; I changed
   it to assert `dismissTo` and `replace` not called (this is the fix itself, not an assertion weakened). Journey 5 fails with the old call.

## Tests (grouped)
Journey 1, first launch: `/` to splash to the tour (six Next presses, Not now), first routine saved, lands on `/today?justAdded=1` with the tour gone
from the stack, Done logs it ("Ideal done"), the First day milestone pop-up arrives after the sound and is dismissed, the stat card opens Progress
(100 percent), Back returns to Today; the phone back button then leaves the app (does not replay the tour).
Journey 2: from the Routines tab "New routine" (origin kept), Thu/Fri saved, Today shows "0 of 2 done" and the toast; open it from Routines, Push to
tomorrow (source row moved to D+1), Back lands on `/routines` with no task screen left; Today asks for 1; midnight passes with the app open (shell
rollover), Today rolls to the next date with 3 cards (Stretch, Read, Read "From yesterday"), logging all three gives two rows (own on D2, pushed on its source day).
Journey 3: End routine from its page (Ended Jul 15, Ended card), Back to Routines, found in the Ended section, gone from Today, open it from Ended,
Start again, back in the active list and on Today, Progress opens.
Journey 4: delete from the task page opened on Today (lands on Today, Undo toast, blank slate), Undo restores; delete again, restore from
Settings > Data > Recently deleted; delete a third time, Delete forever (confirm), then Progress (via the Settings profile row, `from=settings`) shows the
same "counted days" line for All tasks / All time as before any deletion.
Journey 5: Today > Search > task (`from=search`) > Step schedule (Main set not on Friday, saved), Back lands on `/search` with the typed text and the filtered
result intact and exactly `[tabs, search]` on the stack; Back to Today leaves `[tabs]`.
Journey 6, reminder taps (reminders only ever route to `/today` or `/today?reentry=1&taskId=`): re-entry for a deleted habit and for an ended habit open Today
with the banner, no second Today pushed, no crash, and the button opens a live habit; nothing live: banner without a button, Dismiss clears it; a tap that arrives
while the store is still opening is handed to the splash and opened once (stack `[tabs]`); a link straight to a deleted task and to a gone-for-good task show their
notices, stack is the lone task page, on-screen Back goes to Today.
Journey 7, phone back button: Today > Settings > Data > Recently deleted goes up one screen per press then exits (no loop); a tab goes to Today then exits; the
resumed tour step 4 walks back 3, 2, 1 then exits (the OnboardingShell handler); a lone task link exits; with the delete sheet up, the Modal close request closes the
sheet and stays on the task, then back goes to Today.
Journey 7b (`it.failing`, see bugs): back stack growth by Settings Back, Data/Deleted Back, add-form Save, task Delete.
Journey 8, sheets and tabs: the add sheet (shell level) survives a link to another tab and closes cleanly; picking a type after the tab changed opens the
form and Back returns to the tab it was over; a link while the delete sheet is open changes nothing in the data and the back stack ends (bounded);
`it.failing` for the sheet staying visible.
Journey 9, stale task screen: Search > task > icon with Indigo chosen, task deleted elsewhere (write plus refresh): the icon screen then the task screen say
"was deleted", no Save, no log buttons, Back lands on Search without it; an icon Save that races the delete gets the retry toast and writes nothing; a Done tap
on a page whose task was just deleted writes no log and no celebration; Restore on the stale screen revives it and Today lists it again.

## Bugs left for the main session (each has an `it.failing` test)
2. **Screens that leave with push/replace to a screen already on the stack** make the phone back button step through copies. Observed stacks:
   - `app/settings/index.tsx:85` Back is `router.push('/today')`: Today > Settings > Back gives `[tabs, settings, tabs]`; the phone back button then returns to Settings.
     Fix: `router.back()` (or `dismissTo('/today')`).
   - `app/settings/data/index.tsx:44` (`replace('/settings')`) and `app/settings/data/deleted.tsx:92` (`replace('/settings/data')`) double the screen they go back to.
     Fix: `dismissTo(...)` / `back()`.
   - `app/add/routine.tsx:80`, `event.tsx:79`, `course.tsx:72` (`router.replace(ROUTES.today)` after Save; to-do replaces to its tab) and
     `src/features/task/DeleteTaskSheet.tsx` (`router.replace(confirmedDeleteDestination(...))`) give `[tabs, tabs]`. After a save from Routines, phone back shows Routines, then Today,
     then Routines, then exits. Fix: `router.dismissTo(...)` (it replaces the screen on top and reuses the Tabs entry); `GoneTaskNotice` "Go to Today" has the same shape.
   - Tests: "Settings > Back", "Settings > Data > Recently deleted > Back, Back", "Today > Add task > Routine > Save", "Today > a task > Delete" in journey 7b.
3. **A sheet is left showing when its screen is covered.** The task page stays mounted under a tab opened by a link (`router.navigate('/routines')` gives
   `[tabs, task, tabs]`), still holding its open delete sheet with `Modal visible = true`; a Modal is a native overlay, so on a phone it would float over the Routines tab.
   Narrow in practice (needs a link, widget or reminder tap while a sheet is open), but the same is true of any sheet on any screen under a pushed link.
   Fix belongs in `src/ui/Dialog.tsx` (hide when the screen loses focus, `useIsFocused`). Test: "a sheet open on a task page is not left showing...".

## Findings, no change made
- Re-entry banner with a `taskId` whose habit is deleted or ended falls back to `rows[0]` (`TodayScreen` reentryTarget `?? rows[0]`), so "Even the fallback counts" opens an unrelated habit.
  Probably intended for a missing param only; left as is (test documents that it opens a live habit and does not crash).
- The re-entry banner says "Your consistency is intact" next to "0%" when nothing has been logged (copy, not my area).
- Reminders never deep link to a task page; only Today (plain or re-entry). A task link comes only from in-app navigation, so "reminder opens a deleted task" is the banner case above.
- A save from an add form goes to Today (spec: "navigates to S09 (Today)") even when started from Routines; that is by design, only the stack depth (bug 2) is wrong.
- `useDayRollover` already uses `subscription?.remove()` here (the round-1 note is resolved).

## Test infrastructure notes (for whoever extends this)
- `renderRouter` turns on fake timers; use `await act(async () => jest.advanceTimersByTime(ms))` OUTSIDE `waitFor`. An `act` inside a `waitFor` callback overlaps RNTL's own
  act and leaves the act environment switched off, so every later test in the file renders nothing (cost me an hour: the symptom is `screen.toJSON()` null from the second test on).
- The root layout owns a module-level `QueryClient`; the file wraps the `QueryClient` constructor to capture it and clears it in `beforeEach`.
- `initNotificationsBridge` is idempotent for the module's life, so the reminder tap listener is registered once; the test keeps it across tests.
- Run: `npx jest app/edge.journeys.test.tsx --selectProjects app --maxWorkers=1 --testTimeout=60000 --forceExit` (about 20 s).

## Needs a real phone
Real hardware back and the edge-swipe gesture (iOS-style `ios_from_right` on Android), the Modal-over-covered-screen behaviour in bug 3, real `dismissTo` animation,
a cold start from a real notification tap (`getLastNotificationResponse`), the 400 ms splash timing on a slow phone, audio overlap on the milestone pop-up.
