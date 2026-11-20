# 41 - Independent code review of rounds 2 and 3 (round 4)

Scope: the non-test source diff `9544cfb~1..HEAD`. No source edited. Three `it.failing` tests added; they pass today because the bug exists, and must become plain `it` once fixed.

## Ranked findings (most likely to be hit this week first)

### 1. A note (or to-do) saved from the add menu can land on the wrong lens, and the new item is not visible. HIGH likelihood
- Cause: `app/add/todo.tsx:45` changed `replace` to `dismissTo('/todos?lens=notes')`. The To-dos tab is a tab: once visited it stays mounted, so `dismissTo` only updates its params. `src/features/browse/ToDosBrowseScreen.tsx:35` reads `lens` once, in `useState(params.lens === 'notes' ? 'notes' : 'todos')`, so the param is ignored. Visit To-dos, go to Today, tap + then Note, save: you land on To-dos showing the To-do lens, and the note you just saved is not on screen. The reverse also happens (on the Notes lens, add a plain to-do from the global + menu).
- Verified: same test with the To-dos tab never visited passes; with it visited first it fails. Real `expo-router` with a `Tabs` layout.
- Test: `src/edge.review.todoLens.test.tsx` (`it.failing`).
- Fix: in `ToDosBrowseScreen`, `useEffect(() => { if (params.lens === 'notes' || params.lens === 'todos') setLens(params.lens); }, [params.lens])`. For the plain to-do case also pass `?lens=todos` from `app/add/todo.tsx:45`, since a bare `/todos` carries no param to follow.

### 2. A model reply that stalls freezes the chat for good (every later message and Try again wait behind it). MEDIUM likelihood on a flaky network
- Cause: `src/features/assistant/useAssistantChat.ts` passes `signal: undefined` to `streamChat` (line ~213), and neither provider sets a timeout (`byoProvider.ts:67`, `managedProvider.ts:58`); React Native fetch has no default read timeout. Before round 3 a stalled reply only left the spinner on and a new message still went out. Since `enqueueTurn` (turn chain) every later turn, `retryLast` included, awaits the stalled one, so nothing can be sent until the app is killed.
- Test: `src/edge.review.assistant.test.tsx` (`it.failing`): first stream never settles, 5 minutes pass, second message must reach the provider (it does not).
- Fix: give each turn an `AbortController` with a deadline (about 60 s of no event) and pass its signal; on abort treat as offline so the chain moves on.

### 3. Quiet error boundaries around AddMenuHost and CelebrationHost never recover. LOW likelihood, bad when it happens
- Cause: `src/app-shell/ErrorBoundary.tsx:36` returns `null` for `quiet` and nothing resets it. One bad render of the add menu: + does nothing until the app is killed; the add-menu store stays `open: true`, so `ExactRemindersAsk` (holds while the menu is open) never asks.
- Test: `src/edge.review.boundary.test.tsx` (`it.failing`).
- Fix: reset the quiet boundary when its child's driving store changes (`resetKeys`), or after a short delay.

## Looked at and found sound (no bug)
- `serialWrite` (`writeQueue.ts`) and every use: no serialized function calls another. `reconcileOccurrence`, `finalizeCycleForCadenceChange`, `reconcileCycleBoundaries`, `markAwayPushedDayOff` and the retire helpers call only unwrapped helpers. `catchUpCycles` and `healMissingXp` are called only from `repairs.ts` and `useProgress`, never from inside a queued write. `invalidateCommon` is awaited in `onSuccess`, outside the queue; `cancelQueries` settles at once (TanStack rejects the retryer), so it cannot wait on a queued `catchUpCycles`. No deadlock found.
- `repairs.ts` single-flight: the only gap is one microtask between the loop ending and `finally`, unreachable from a native event.
- `resolveMany` floors and windows: leading day `from - 1` is read, so a push landing on the floor is kept; a deleted habit whose last day is before the floor is correctly empty; ended habits trim `to` before the floor. `edge.scale.test.tsx` already compares against the frozen legacy resolvers, including floors placed on push targets. `deletedRecordOf` with `today` only changes the clock-set-back case.
- Migration 009 and `taskRepository` local days: insert, update (re-derive only when the instant changes), soft delete, restore, duplicate and old-backup restore (columns absent, falls back to the instant) all consistent.
- `dismissTo` to a tab route: tested with real `expo-router` (tabs under a pushed screen: pops and switches tab, stack does not grow; tabs not in the stack: pushes). Behaves. Only the param issue in finding 1.
- `inAppOpening` and the `opening` link param: values with spaces, `+`, `&`, `%`, `#`, `=`, emoji survive `URLSearchParams` and the router unchanged, so `takeInAppOpening` matches.
- `offerBackupFile`: a stripped-extension issue (`.fallbackbak` left on, provider adds `.json`) was present in the diff but is already fixed in the working tree by another agent; no test left.
- Notification launch routing: every `launchRouted=false` is followed by `true` on every splash exit that leads to a usable app (the recovery path returns to /splash). Cannot confirm on a phone whether a cold-start tap reaches `addNotificationResponseReceivedListener` (no `getLastNotificationResponseAsync` anywhere); needs a real phone.

## Risks noted, no test written
- Foreground repairs now run `healMissingXp` on every return to the app: a full-history `resolveAllOccurrences` plus `listXpAwards`, inside the write queue. With hundreds of habits and a year of logs, a log tap right after unlocking the phone waits behind it (up to the 10 s stall limit, after which writes overlap again). The cheap fix is to run the heal on launch only, or skip it when nothing was logged since the last pass. The UI-speed agent may measure this.
- Reminder cap (`PENDING_LIMIT = 64`, `notifications/index.ts`) is an iOS limit but applies on Android too: with about 15 daily habits plus a digest only the next 3 to 4 days are armed. Fine while the app is opened daily; reminders stop silently after that gap.
- The gentle re-entry nudge is dropped when the app is opened after 09:00 (the past-time filter), where it used to fire at once.
- `useAssistantChat.trimHistory` can return a tail starting with an assistant message when no user message is among the last 40 (needs 40 assistant lines in a row; not reachable in normal use).
- Pushed ("to tomorrow") occurrences get no reminder: `settledOccurrences` and `buildRollingSchedule` look at natural due dates only.
- Uncommitted work by other agents currently in the tree (`logStateRaw` `isManualOverride`, provider quote fixes) was not reviewed here.

## Files
- `/home/user/fallbackv3/src/edge.review.todoLens.test.tsx`
- `/home/user/fallbackv3/src/edge.review.assistant.test.tsx`
- `/home/user/fallbackv3/src/edge.review.boundary.test.tsx`
- `tsc --noEmit`: no errors in these files.
