# 39 - App lifecycle (round 3)

Area: app lifecycle (background, foreground, rollover, splash, recovery, reminder taps, root layout, process kill).
Owned: `src/app-shell/**`, `app/splash.tsx`, `app/_layout.tsx`, `app/recovery.tsx`, `useDayTick` in `src/features/today/useTodayRows.ts`.
New test file: `src/app-shell/edge.lifecycle.test.tsx` (37 tests, all passing).

## 1. Result at a glance

| Check | Result |
|---|---|
| `npx jest src/app-shell/edge.lifecycle.test.tsx` | 37 of 37 pass (one of them is an `it.failing` that documents a bug in another module) |
| Related suites (`app/splash`, `app/_layout`, `app/recovery`, `app/coldStart`, `app/edge.recovery`, `src/services/widgets/edge.widgets`, `src/features/today`) | 10 suites, 130 tests, all pass |
| `npx tsc --noEmit`, filtered to my files | no errors |
| `npx eslint` on my files | clean |
| Mutation checks (see section 4) | 5 of 5 seeded faults caught by the intended test; 1 more caught once both cancel checks are removed |

Three things were fixed (section 3): the repair pass now also runs on foreground, the cold-start repair pass no longer races the cycle catch-up, and a reminder tap held for a person who has not finished onboarding no longer lingers. One bug in another module is documented as `it.failing` (section 5), and two more are left for the main session (section 5).

Commit note: I did not commit. My files are in `b6d638b` ("Backups on Android saved as a file via the folder picker; versionCode 2"), which another session made while I was working; the working tree was clean when I finished.

## 2. What each lifecycle item does, and the decision on foreground

| Item | Before this round | Decision | Now |
|---|---|---|---|
| Today moves to the new day | Foreground check in `useDayRollover` (layout) and `useDayTick` (Today, task page) | Already correct | Verified by tests |
| Recently deleted 30-day sweep | Cold start only (`app/splash.tsx`) | Run on foreground too | Runs on every foreground once the store is open |
| Cycles that ended while away | Cold start, and on Progress reads | Run on foreground too | Runs on every foreground once the store is open |
| Missing-XP repair | Cold start only | Run on foreground too | Runs on every foreground once the store is open, after the cycle catch-up |
| Reminders re-armed | Already on foreground (`initNotificationsBridge`, `AppState` listener) | Already correct | Verified by reading; not re-run |
| Widget refresh | Already on foreground (`initWidgetsBridge`) | Already correct | Verified by reading; not re-run |

Why the repairs are safe to repeat: the sweep only removes rows that are past their time, the cycle catch-up only archives cycles that have fully elapsed, and the XP heal writes with `ON CONFLICT (task_id, date) DO UPDATE` (`src/db/repositories/progressRepository.ts:104`), so a second run cannot double-award.

## 3. Fixes

### 3.1 Repair pass on foreground, one at a time (new `src/app-shell/repairs.ts`)
- Cause: the sweep, cycle catch-up and XP heal ran only at cold start, so an app kept in the background for days kept expired habits in Recently deleted and an ended cycle until it was killed.
- Fix: `runStartupRepairs()` is a single-flight pass. A foreground during a running pass queues exactly one more pass after it; it never overlaps. `useForegroundRepairs()` calls it on `active` when `store.status() === 'ready'`. Wired in `app/_layout.tsx:67`. The splash also calls the same function (`app/splash.tsx:60`), so the two paths share the guard.
- The layout test (`app/_layout.test.tsx:20`) gained one mock line for the new module. No assertion changed.

### 3.2 Cold-start repairs raced each other (`src/app-shell/repairs.ts`, `repairPass`)
- Cause: the splash started the sweep, the cycle catch-up and the XP heal together. The heal stamps the awards it adds with the current cycle pointer, and the pointer only moves when the catch-up finishes. If the heal read the pointer first, a repaired award landed in the old cycle and undercounted the new cycle's XP.
- Fix: the sweep runs alongside the catch-up; the heal runs only after the catch-up has finished (errors in either are swallowed, as before).
- Test: "the XP heal waits for the cycle catch-up" (mutant shows it is caught).

### 3.3 A reminder tap held for an unfinished onboarding was never cleared (`app/splash.tsx:78-90`)
- Cause: `takePendingTapRoute()` was called only on the onboarded branch. For a person still onboarding, the held route stayed in memory and could be used by a later splash in the same process (for example after Recovery's Try again).
- Fix: the route is taken on every launch; it is used only when onboarding is complete.
- Test: "a cold-start tap is dropped when onboarding is not finished" (mutant shows it is caught).

## 4. Tests added (`src/app-shell/edge.lifecycle.test.tsx`)

**A. The day moves on while backgrounded (4)**
- Next foreground moves the header date to the new day and refreshes the queries.
- With no foreground, the minute check catches midnight once the app is awake.
- A screen that reads the day on render (`useDayTick`) moves on foreground, not only on the 30 s timer.
- A background event alone does not move the day.

**B. Background and foreground, repeated quickly (3)**
- Forty cycles leave one listener and one interval per mounted hook, and do not re-invalidate queries without a day change.
- Unmounting removes every AppState listener and clears the interval.
- An active event after unmount does nothing and logs no state-update warning.

**C. The repair pass on foreground (6)**
- Runs all three repairs once the store is open.
- The XP heal waits for the cycle catch-up.
- A failing sweep does not stop the catch-up or the heal, and throws nothing.
- Never two passes at once: five foregrounds during a running pass give exactly one more pass, and never more than one in flight.
- Through the real layout, a foreground does nothing while the store is `uninitialised` or `corrupt`, and runs once it is `ready`.
- Background does not start a pass; foreground does.

**D. The splash under a slow or failing store (8)**
- A slow store holds the splash and navigates exactly once when it answers.
- The 400 ms minimum display holds even when the store answers at once.
- Leaving before the store answers means no navigation when it does.
- Leaving during the minimum-display wait means no navigation after it.
- A corrupt store goes to recovery once, never to Today.
- An `uninitialised` store goes to recovery.
- A store open that throws goes to recovery rather than hanging.
- A missing settings singleton after a ready open goes to recovery, once.

**E. Corrupt store, then Try again (4)**
- Try again on a store that is now readable returns to the splash, which then reaches Today.
- Try again on a store that is still corrupt stays on recovery and can be tried again.
- Two presses before the first answer open the store once.
- Try again whose open throws stays calm on recovery.

**F. Reminder taps (6)**
- From a cold start: the tap is held until the splash opens, then the splash goes to the tapped screen.
- While the app is open: the tap pushes the tapped screen at once.
- A routine reminder opens plain Today.
- A held cold-start tap is taken once; a second take returns nothing.
- A cold-start tap is dropped when onboarding is not finished (fix 3.3).
- `it.failing`: a tap during the splash's minimum-display wait is overwritten by Today (bug left, section 5).

**G. The root layout (4)**
- Notification and widget bridges, and the warm-up of sounds, run once per mount, not once per render.
- The toast host shows a message on the screens.
- A crash inside the screens shows the calm fallback, and the toast host is still mounted.
- The status bar follows the saved look once the splash hydrates it (characterisation of the first-paint gap, section 5).

**H. A process kill and restore (2)**
- A relaunch with the same database reads back the saved look and lands on Today.
- The repair pass runs again on the relaunch (nothing about it was kept in memory).

Test-harness notes (for whoever reads this file next): RNTL v14's `act` returns a promise even for a synchronous callback, so every `act` and `fireEvent` here is awaited. An un-awaited `act` leaves React's act scope broken and makes later tests in the file fail for unrelated reasons; that was the cause of most early failures in this file.

## 5. Bugs left for the main session

1. **Tap during the splash's minimum-display wait ends on Today** (`src/services/notifications/index.ts:357-367`, not my file). The tap listener checks `store.status() === 'ready'` and pushes the route. If the store is ready but the splash has not yet navigated (the 400 ms minimum), the splash then replaces with `/today` and the tapped screen is lost. Covered by `it.failing` in my file: when the listener is fixed, that test starts failing and should then be changed to a plain `it`. Suggested fix: have the listener hand the route to `pendingTapRoute` whenever the splash has not navigated yet, not only when the store is not ready.
2. **A second store open on Try again leaks a database connection** (`src/db/lifecycle.ts` `openInternal`, `src/db/client.ts` `openClient`). `app/recovery.tsx:33` opens the store and then routes to `/splash`, which opens it again. Each open creates a new SQLite connection and `proxy.setClient(db)` replaces the old one without closing it. Found by reading, not tested (a useful test needs an `expo-sqlite` fake that counts opens and closes). Low impact: one extra handle per successful Try again. Suggested fix: close the previous client in `openInternal`, or let the splash skip re-opening when `store.status() === 'ready'`.
3. **The first paint uses the OS look, not the saved look** (`src/app-shell/stores/theme.ts` default `mode: 'auto'`; `app/splash.tsx` hydrates after the store opens). A person who chose Dark on a light phone sees the splash in light until the store answers, then it flips. This needs the look stored where it can be read before the database opens (a synchronous store such as SecureStore), which is a product decision. Characterised in the layout test; not changed.
4. **The error boundary does not cover the overlays** (`app/_layout.tsx`, the `ErrorBoundary` wraps only the `Stack`). `Toast`, `AddMenuHost` and `CelebrationHost` sit outside it, so an exception inside one of them takes the whole app down rather than showing the calm fallback. Not tested: it would crash the test renderer. Suggested fix: also wrap the overlays, or move the boundary above all of them.
5. `useAppBootstrap` returns `ready` but nothing reads it (`src/app-shell/index.ts`). It does no harm; noted for tidiness.

## 6. Checked, no bug

- Day tick and rollover: the interval and the AppState listener are both cleared on unmount; a no-change check does not re-render or re-invalidate.
- Repeated background and foreground: listeners and intervals stay at one per hook (forty cycles checked).
- No state update after unmount: nothing logs one after the hooks unmount.
- The splash's leave-before-answer and leave-during-wait paths cancel correctly (two cancel checks; removing both fails two tests).
- Double press on Try again: the busy ref opens the store once.
- Reminder re-arm on foreground: `reschedule` is serialised, so two foregrounds cannot interleave.
- The XP heal and the sweep are idempotent, so a foreground repair cannot double-award or remove live data.
- The notification bridge's `reschedule` cancels all reminders before it reads settings; if the store is not open, the reminders are re-armed on `store:ready`. Benign.

## 7. Mutation checks (run against the lifecycle file)

| Seeded fault | Caught by |
|---|---|
| Second repair pass runs alongside the first (single-flight removed) | "never runs two passes at once" |
| XP heal runs in parallel with the cycle catch-up | "the XP heal waits for the cycle catch-up" (and others, via a hang) |
| Held tap taken only when onboarded (fix 3.3 reverted) | "a cold-start tap is dropped when onboarding is not finished" |
| Splash does not check cancel after the minimum wait | equivalent: the second cancel check covers it, no test fails |
| Splash checks neither cancel point | "leaving the splash before the store answers", "leaving during the minimum-display wait" |
| Day tick does not clear its interval | "unmounting removes every AppState listener and clears the interval" |

## 8. What I could not test (needs a real phone)

- The real OS background and foreground transitions, and the timing of a phone sleeping across midnight. Jest fakes both through the AppState emitter and the clock.
- A process killed in the background and restored by Android or iOS: the in-memory state (toast, celebration, add menu, assistant conversation in progress) is lost by design, and only the database and settings survive. The assistant's in-flight conversation is kept in memory until it is persisted (`src/app-shell/stores/assistantSession.ts`); whether a kill mid-reply loses text needs a device check.
- A real reminder tapped from the system tray, both from a cold start and while the app is open. The jest tests inject the tap response.
- The first-paint look on a device (section 5, item 3) and the status-bar flip.
- The widget refresh on the home screen after a foreground (the publish is tested; what the widget shows is not).
- Timing of the 400 ms minimum display and the splash's wordmark on real hardware.
