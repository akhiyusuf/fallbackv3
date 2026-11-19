# 13. Recently deleted: screens and cross-feature behaviour

Area: `app/**`, `src/features/**` (UI side). Data layer (`src/db`, `src/queries`, `src/domain`) was not edited.
Final state: whole suite `npx jest --forceExit` = 131 suites, 1134 tests, all pass. `npx tsc --noEmit` prints nothing.
eslint on touched files: no new errors (the only errors are the known `react-hooks/set-state-in-effect` ones, in
`app/settings/data/index.tsx:37`, `app/task/[id]/index.tsx:117`, `app/task/[id]/as-needed.tsx:52`,
`src/features/assistant/useEntitlementAndMic.ts:46`, all pre-existing). New test files carry the same
`import/first` / `no-require-imports` warnings every house-pattern test has (jest.mock before imports).

## Bugs found (all fixed unless stated)

| # | Where | What a person would see | Cause | Fix |
|---|---|---|---|---|
| 1 | `app/task/[id]/index.tsx`, `as-needed.tsx`, `icon.tsx` | Open a deleted task (back stack, a link, the assistant deleting it while its page is open): the page looked completely normal, with log buttons, steps, edit menu. Nothing said it was deleted; logging "worked" into a deleted task (the data layer now refuses the write, so it would have been a silent "Couldn't save"). | `useTask` returns deleted rows on purpose (documented in `src/queries/recentlyDeleted.test.tsx`), and no screen checked `deletedAt`. | New `src/features/task/DeletedTaskNotice.tsx`: "Deleted" screen, "“<name>” was deleted.", "It is in Recently deleted, with its history. Restore it to use it again.", buttons Restore (toast "Restored “<name>”") and "Open Recently deleted". Used by all three task pages. While a delete is being confirmed the page is marked as leaving so it does not flash the notice during the screen transition (`DeleteTaskSheet` has a new optional `onDeleted`). |
| 2 | same three pages | A task deleted for good (or expired) and opened from an old link/back stack showed grey loading skeleton forever. | `!task` was treated as "loading" even after the query finished with `null`. Pre-existing, but Recently deleted makes it reachable. | `GoneTaskNotice` in the same file: "This isn't here any more." / "It was deleted for good, so there is nothing to open." / button "Go to Today". |
| 3 | `app/settings/data/deleted.tsx` (Restore, Delete forever, Delete all) | Double tap on Restore / Delete forever: the second call runs after the item is gone, fails NOT_FOUND, and the toast "Restored..." / "Deleted for good" is replaced by the warning "Couldn't do that. Try again." although it worked. | The `loading` flag only disables the button after a re-render; two taps in the same tick both ran. | One-action-at-a-time ref guard (`busy`) in the three handlers. The three double-tap tests fail without it (checked). |
| 4 | `src/features/task/DeleteTaskSheet.tsx` | Double tap on "Delete routine": second delete fails ("already deleted"), shows the retry banner on a task that is in fact deleted, and navigates/toasts twice. Also a delete that *threw* was an unhandled rejection and nothing happened. | Same as 3. | `busy` ref guard; a thrown delete is now the normal retry banner. |
| 5 | `app/settings/data/index.tsx` | The Recently deleted row said "Nothing deleted lately." while the list was still loading or if it failed to load. | `data?.length ?? 0` treated undefined as 0. | No sub-line until the data is there. |
| 6 | `app/settings/widgets.tsx` | A widget whose fixed task is in Recently deleted: its picker showed "Choose a task" but Save was enabled (it would re-save the deleted id). | Draft task id kept an id that is not in the picker's list. | Draft id is null when the task is not in the list, so Save is disabled until one is chosen. Cancel changes nothing, and the stored setting is untouched, so the widget works again once the task is restored (tested). |

Found, NOT fixed (outside my area or a product call):
- `src/domain/retention.ts` `daysLeft`: a `deletedAt` in the future (phone clock set back after deleting) gives more than 30 ("31 days left"). Not negative, but not capped. Data-layer agent: consider `Math.min(DELETED_KEEP_DAYS, ...)`.
- Assistant: `delete_task` answers "Deleted <name>." That is not wrong (it does not say "for good"), but it gives no hint it is recoverable and no Undo. Suggestion for the human: "Deleted <name>. You can restore it from Settings > Data > Recently deleted." I did not change wording. Also the assistant's "Undo created task" revert (`toolExecutor.ts`, `create_task`) now soft-deletes, so an undone creation would sit in Recently deleted; that undo is not wired to any UI today (only `update_task` pushes undo), so nothing visible happens yet. If it is wired later it should call `useDeleteForever` after the delete.
- Undo toast after deleting shows "Restored “<name>”" with the neutral tone, not the green success tone the Restore screen uses. Left as is (look). Undo failing after the item was meanwhile deleted for good says "Try again from Settings > Data", which cannot work then; rare.
- The Recently deleted screen shows nothing (no skeleton) while loading. Left as is.
- Notification taps only ever route to Today (`/today?reentry=1&taskId=...`); Today falls back to the first row when that task is not in its rows, so a deleted task's re-entry button opens another task, not a deleted one. Fine.

## Cases tested

Files: `app/settings/data/deleted.test.tsx` (34), `app/task/[id]/recentlyDeleted.test.tsx` (29), `app/recentlyDeleted.screens.test.tsx` (13), `app/recentlyDeleted.services.test.tsx` (3), plus additions to `app/settings/data/index.test.tsx` (+2), `app/settings/widgets.test.tsx` (+1), `src/features/assistant/__tests__/toolExecutor.test.tsx` (+2). All run on the real queries over the in-memory fake repos.

| Case | Expected | Result |
|---|---|---|
| Delete sheet wording (routine, to-do) | "“name” goes to Recently deleted with its history. You can restore it for 30 days."; no "can't be undone" | pass |
| Confirm from task page, origin today / routines / events / courses / todos / search / none (event, course, todo types) | lands on today / its tab / type tab; toast "Moved to Recently deleted" with Undo; task in Recently deleted; no "was deleted" flash | pass (9) |
| Confirm from as-needed page | Routines + toast | pass |
| Double tap Delete | one delete, one toast, no retry banner | pass (fails without fix 4) |
| Undo | restores, toast "Restored “name”" even though the sheet is unmounted | pass |
| Undo, restore fails / throws | warning "Couldn't restore. Try again from Settings > Data." | pass |
| Delete fails / throws | retry banner, stays on page, no toast, not deleted; Retry then succeeds and navigates | pass |
| Assistant delete_task | goes through useDeleteTask, summary "Deleted X.", never says for good/permanent; failed delete is "not applied" | pass |
| Screen: loading | intro only, no empty text, no rows, no Delete all | pass |
| Screen: error | banner "Couldn't load Recently deleted.", Retry loads the list | pass |
| Screen: empty | empty text, no Delete all | pass |
| Screen: one item | name, "Routine · 30 days left", Delete all asks "Delete 1 item forever?" | pass |
| Screen: many items | newest deletion first, per-type labels, "Delete 3 items forever?" | pass |
| Day counts 0, 1, 15, 28, 28.5, 29, 29.9, 30 days ago | 30, 29, 15, 2, 2 days left, then "Last day" x3; never 0 or negative | pass |
| Item older than 30 days | removed on load, not listed | pass |
| Item sheet | "Deleted <date>. Unless you restore it, it's removed for good on <date+30>."; Restore, Delete forever, Close; Close changes nothing | pass |
| Accessibility | row label "name, Type, N days left. Restore or delete forever"; Back, Delete all forever, Restore, Delete forever, Close all named buttons | pass |
| Restore success / failure / throw / already gone / double tap | toast "Restored “name”" (success) and list updates; failure "Couldn't do that. Try again." (warning), item stays; gone-elsewhere is a warning and list refreshes; once only | pass |
| Delete forever: asks, Cancel keeps, confirm removes ("Deleted for good", neutral), failure keeps item, double tap once | as stated | pass |
| Delete all: count title, removes all and leaves live tasks, Cancel, failed purge, double tap once | as stated | pass |
| Back | goes to Settings > Data | pass |
| Settings > Data row | "2 items. Kept for 30 days." / "1 item. Kept for 30 days." / "Nothing deleted lately." / no claim while unloaded | pass |
| Today, Routines tab, Search, Priorities | task disappears at once on delete (no refresh), returns on restore, stays gone after delete forever, not shown when opened already deleted | pass (12) |
| Progress per-task list | drops on delete, returns on restore | pass |
| Reminders (real event bus + notifications bridge) | deleted task: no reminders, other task keeps its; restored: reminders back; deleted forever: none | pass |
| Widget snapshot | deleted fixed-task is dropped, setting kept, back on restore | pass |
| Widget settings with a deleted fixed task | generic label, picker asks to choose, Save disabled | pass |
| Deleted task via task page / as-needed / icon page / S22 delete link | notice, no log/edit controls; Restore brings the page back with a success toast; failed restore warns; "Open Recently deleted" navigates | pass |
| Task page open while the task is deleted elsewhere | switches to the notice | pass |
| Task gone for good (all three pages) | "This isn't here any more." + Go to Today | pass |
| XP / Achievements numbers | not UI-testable beyond the data tests in `src/queries/recentlyDeleted.test.tsx` (XP identical after delete/restore/forever); not duplicated | covered by data agent |

Caveat: the "does not flash the notice while leaving" tests pass even without the `leaving` guard in jest (the router replaces synchronously there), so they only prove the end state. The guard exists for the animated transition on a phone; I could not verify it in a browser build either.

## Files changed
- `app/settings/data/deleted.tsx`: busy guard (fix 3).
- `app/settings/data/index.tsx`: no sub-line until loaded (fix 5).
- `app/settings/widgets.tsx`: draft task id (fix 6).
- `app/task/[id]/index.tsx`, `as-needed.tsx`, `icon.tsx`: deleted/gone notices; `leaving` state.
- `src/features/task/DeleteTaskSheet.tsx`: busy guard, caught throw, `onDeleted` prop.
- `src/features/task/DeletedTaskNotice.tsx`: new (`DeletedTaskNotice`, `GoneTaskNotice`).
- Tests: the four new files above and additions to `app/settings/data/index.test.tsx` (its `mockDeleted` type now allows `undefined`), `app/settings/widgets.test.tsx`, `src/features/assistant/__tests__/toolExecutor.test.tsx`. No test deleted, skipped or weakened.
- No shared files (`src/ui`, `src/queries`, ...) touched by me.

## Visual check (browser build, sample data, two tasks deleted through the UI: Morning workout, Dentist check-up)
Build copied the changed repo files into the scratchpad `web/` copy first; script `.../scratchpad/rd.js`; PNGs in `/tmp/claude-0/-home-user-fallbackv3/4065cf9b-48bb-5876-bcc5-38bb70a7fbe9/scratchpad/rd/`, named `<scheme>-<width>-<n>-<what>.png` for light/dark x 360/390:
`1-delete-sheet` (task page with the new wording), `2-after-delete-toast` (Routines with "Moved to Recently deleted" + Undo), `3-settings-data` (row "2 items. Kept for 30 days."), `4-list`, `5-item-sheet`, `6-confirm-one`, `7-confirm-all`, `8-deleted-task-page` (the new notice).
I read the 360 light/dark and 390 light/dark ones: nothing cut off, overlapping or unreadable; two-line sheet text wraps cleanly at 360; sheet shows "Deleted Nov 19 ... removed for good on Dec 19" (correct, today is Nov 19); danger row and red buttons readable in dark; notice screen is plain and legible. Not seen: a list with many (10+) items (it is a normal scrolling Screen) and the Undo toast on top of the notice.

## For the data-layer agent / the human
- `daysLeft` not capped at 30 for a future `deletedAt` (above).
- Human decision: assistant delete wording/Undo (above).
- `useTask` still returns deleted rows; every new screen that opens a task by id must check `deletedAt` (the three task pages now do).
