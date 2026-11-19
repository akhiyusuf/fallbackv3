# 10 — Cold start and the settings data layer

Owner: Haiku agent 10 (data layer). Scope: `src/db/**`, `src/queries/**`, `app/_layout.tsx`, `app/index.tsx`, and tests for them.
Brief followed: `review/haiku/BRIEF.md` (Rules section). No test was skipped, deleted or weakened; no look, wording or layout changed; no git command that changes state; no dependency added; `design-input/`, `docs/`, `assets/`, `app.config.ts`, package files, jest/eslint/tsconfig and CLAUDE.md untouched.

Note on git: while I worked, another agent committed a checkpoint (`c237415`, "Checkpoint: settings-memory fixes and agents' work in progress"). Some of my new test files are therefore already tracked, and `git status` shows my later edits as modified rather than new. I ran no state-changing git command.

## 1. Result at a glance

| Check | Before my work | After my work |
|---|---|---|
| Data-layer, query and cold-start suites (`src/db`, `src/queries`, `app/_layout`, `app/splash`, `app/recovery`, `app/coldStart`) | 13 suites, 112 tests, all passing | 18 suites, 170 tests, all passing (5 new suites, 58 new tests) |
| Whole suite, `npx jest --forceExit` | (not measured by me) | 123 suites, 959 tests, all passing, exit 0 |
| `npx eslint src/db src/queries app/_layout.tsx app/index.tsx --quiet` | 0 errors | 0 errors (exit 0) |
| `npx tsc --noEmit` | not measured by me | **Not clean**: 2 errors, both in `src/features/onboarding/OnboardingShell.test.tsx` (onboarding agent's file, lines 145 and 158, `HardwareBackPressEvent` handler type). Nothing in my area. |

Three real data-loss or save-failure bugs were found and fixed (sections 3.1–3.3). Each one was reproduced by a failing test before the fix.

## 2. What I checked

1. **Round trip of every `Settings` field across a real restart.** The test double was extended with a file-backed mode (each launch is a new connection to the same SQLite file, WAL included). A "launch" is a fresh JS module registry, nothing closed first, like a killed app. Covered: all fields of `src/types/settings.ts` (theme light/dark/auto, accent named + `hue-0`/`hue-200`/`hue-359` + `lagoon`/`mono`, switching back from custom to named and checking the raw row has `accent_ext` NULL, all eight notification switches individually and together, `dailyDigestTime`, assistant language/voice, widgets incl. a fixed-task widget, sync state, `lastBackupAt`, `onboardingCompletedAt`, `cycleCadence`, tenure anchor stable across launches).
2. **Partial updates.** `patch({ notifications: { master: false } })` keeps the other notification fields; `patch({ accent })` keeps theme, widgets and assistant prefs; a patch that omits widgets leaves them alone; a key set to `undefined` does not block the rest of the save.
3. **Back-to-back updates.** Two patches started in the same tick (and two `useUpdateSettings` calls via the hook) both land. This is where the bugs in 3.1–3.2 were found.
4. **Migrations.** A real database was built at schema v3, v5 and v6 (migrations applied up to that version, settings row written with that version's columns, `user_version` checked), then the current app was launched on it. Every saved value survived, including `accent_ext` from v6 and the assistant defaults for v3. A save and a restart after the upgrade keep old and new values. A second open changes nothing. A store already at the current version is not migrated again (re-running the runner is `ok` and `user_version` stays at 7). Migration 003 (table rebuild of `day_log`, with foreign keys on) is exercised by the existing `crFourSnoozeMigration` and `upgradePaths` suites, which still pass.
5. **Cold start through the app.** `app/index.tsx` returns a redirect to `/splash` (asserted on the returned element). `app/splash.tsx` run against a real store: returning onboarded user lands on `/today` with the saved theme and colour restored; a saved look but unfinished onboarding lands on `/onboarding/concept` in those colours; a first launch lands on onboarding on the default look; a store file that is not a database lands on `/recovery`.
6. **Stores that hold a saved preference and are never restored at start-up.** See section 5 (findings for other areas).
7. **Query cache.** `useUpdateSettings` invalidates `QUERY_KEYS.settings`, so `useSettings` shows a saved change without a restart; no optimistic write, so the cache never shows a value before the save is confirmed; a refused save (validation, or a foreign-key refusal) returns `ok: false` / `WRITE_FAILED` and the screen keeps the saved value.
8. **Device-only data-path behaviour.** Transactions, WAL, a kill mid-save, backup and restore. See section 6.

## 3. Bugs found and fixed

### 3.1 Two settings saves started together: the second one fails (high)

- **Where:** `src/db/repositories/settingsRepository.ts` (`patch`, the `withTransactionAsync` call, was line ~152 before my edit) and `src/db/client.ts` (`DbClientProxy`).
- **What a person would see:** tap two switches quickly (or change theme and accent in quick succession). The second change is refused with a save error. On the theme screen that means the switch reverts and a warning toast shows; the value is not kept.
- **Cause:** expo-sqlite's `withTransactionAsync` is not exclusive (its own docs say so). The second `BEGIN` arrives while the first transaction is still open and fails with `SQL logic error` / "cannot start a transaction within a transaction". The read that builds the merged row also ran before the transaction, so a save that did get through could be built from a stale copy.
- **Fix:** all database work now goes through one ordered queue in `DbClientProxy` (`client.ts`, method `serial`, lines ~72–75). The settings read moved inside the transaction (`settingsRepository.ts`, lines ~153–160), so each save merges against what the previous save committed. Covered by `settingsDurability.test.ts` ("two patches started in the same tick ... both land" and "a notifications patch and an assistant patch started together both survive") and `settingsCache.test.tsx` ("two saves started together both show on the screen").

### 3.2 A successful write is silently undone by a neighbouring failed save (high, data loss)

- **Where:** same queue (`client.ts`), and every transaction body in `settingsRepository.ts`, `taskRepository.ts` (`insert`, `update`, `duplicate`) and `backupEnvelope.ts` (`applyBackupEnvelope`).
- **What a person would see:** a task is deleted (or any write succeeds) at the same moment a settings save fails. The success is reported, then the write vanishes: the deleted task is back on the next screen load.
- **Reproduced:** a plain `softDelete` started 1–7 microtasks after a failing `settings.patch` returned `ok: true`, and the row was not deleted, in 7 of 12 timings. Mutation check: with the queue disabled, 3 of the new tests fail; with it restored, they pass.
- **Cause:** expo-sqlite's transaction is not exclusive, so any statement issued on the connection while a transaction is open runs inside it, and is rolled back with it.
- **Fix:** `DbClientProxy` runs every operation (reads, writes, transactions, close) one at a time in arrival order. The transaction callback is handed the live connection (`client.ts`, `withTransactionAsync`, line ~99), and every statement inside a transaction body now uses that `tx` handle (not the proxy), so nothing can wait on itself. `DbClient.withTransactionAsync` now takes `(tx) => ...`; the raw-connection callers in `lifecycle.ts` and `migrate.ts` ignore the argument and are unchanged. Covered by `writeOrdering.test.ts` ("a task deletion that reported success is not undone by a settings save that fails, whatever the timing").

### 3.3 A failed settings save returned the driver's error code (medium)

- **Where:** `settingsRepository.ts`, the `catch` of `patch` (line ~218, previously line ~204).
- **What a person would see:** nothing directly (the screens only check `ok`), but any caller that switches on `error.code` got `ERR_SQLITE_ERROR`, which is not a code the app defines, and `error.message` was the generic text.
- **Cause:** the catch passed through any thrown object that had a `code` property, and SQLite errors carry one.
- **Fix:** every failure of a settings save is now `WRITE_FAILED` (the task repository already does this). Covered by `settingsCache.test.tsx` ("a save the database refuses returns WRITE_FAILED and never shows up in the cache").

### 3.4 A key set to `undefined` refused the whole save (low/medium)

- **Where:** `settingsRepository.ts`, top of `patch` (`withoutUndefined`, line ~110 and line ~141).
- **What a person would see:** a caller that passes `{ theme: undefined, accent: 'plum' }` (for example when a value came from a query that had not loaded) gets a silent refused save; nothing changes.
- **Cause:** the spread copied `undefined` over the saved value, and the SQLite driver refuses an `undefined` binding (`ERR_INVALID_ARG_TYPE`).
- **Fix:** an explicit `undefined` now means "not part of this change", at the top level and inside the nested notification, assistant and sync objects. Covered by `settingsDurability.test.ts` ("a key set to undefined is not part of the change").

### 3.5 Two quick edits to one task: one edit is lost (medium, same class as 3.1)

- **Where:** `taskRepository.ts`, `update` (lines ~308–338). The existing row was read before the transaction, and the write used that copy.
- **What a person would see:** rename a task and change its importance in quick succession: one of the two edits silently reverts.
- **Cause:** read-merge-write outside the transaction.
- **Fix:** the read moved inside the transaction, and a missing row sets a flag so the function still returns `NOT_FOUND` (checked after the transaction). Covered by `writeOrdering.test.ts` ("a rename and an importance change started in the same tick both land" and "updating a task that does not exist still reports NOT_FOUND"). This one I established from the code and the regression test, not by a separate before/after run.

## 4. Files changed

All in my area.

- `src/db/client.ts`: `DbClient.withTransactionAsync` takes `(tx)`; `DbClientProxy` runs every job through one queue (`serial`); transactions receive the live connection; doc comments explain why.
- `src/db/repositories/settingsRepository.ts`: read inside the transaction; `tx` handle inside; `readWidgets(client)`; `withoutUndefined`; every failure is `WRITE_FAILED`.
- `src/db/repositories/taskRepository.ts`: `update` reads inside the transaction and returns `NOT_FOUND` after it; `insert`, `update`, `duplicate` use `tx` inside.
- `src/db/backupEnvelope.ts`: `applyBackupEnvelope` transaction body uses `tx`.
- `src/db/testSupport/expoSqliteTestDouble.ts`: optional `directory` option for file-backed mode (every open is a new connection to a real file; `deleteDatabaseAsync` removes `-wal`/`-shm` too). The default in-memory behaviour is unchanged.

## 5. Tests added

New files (58 tests in total):

- `src/db/__tests__/settingsDurability.test.ts` (34): round trip of every `Settings` field across a restart; accent cases; custom-to-named switch-back (checked on the raw row); every notification switch alone and all together; digest time and its refusal; onboarding and tenure anchor stable across launches; partial updates; `undefined` keys; back-to-back patches; backup, erase and restore keeps custom colour, assistant, notifications and widgets; a killed app (transaction open, connection closed without commit) keeps the previous settings.
- `src/db/__tests__/settingsUpgrade.test.ts` (10): upgrade from v3, v5 and v6 keeps every value; saves after the upgrade survive a restart; second open idempotent; current version not re-migrated.
- `src/db/__tests__/writeOrdering.test.ts` (4): task edits back to back; NOT_FOUND kept; a neighbour's success is not undone by a failing save at every timing; a failing save rolls back only itself.
- `app/coldStart.test.tsx` (5): index route to `/splash`; returning onboarded user to `/today` with the saved look; unfinished onboarding to `/onboarding/concept` with the saved look; first launch on defaults; unreadable store to `/recovery`.
- `src/queries/settingsCache.test.tsx` (5): saved change shows without a restart; cache does not show a value before it is confirmed; validation refusal returns `ok: false` and keeps the saved value; DB refusal returns `WRITE_FAILED` and never reaches the cache; two saves at once both show.

Support file (new): `src/db/testSupport/nodeTempFiles.ts`, a typed wrapper for `fs`/`os`/`path` (this project has no `@types/node`, the same reason `node-sqlite.d.ts` exists).

No existing test was edited, skipped or deleted.

## 6. Checked and found correct (no change needed)

- `useUpdateSettings` (`src/queries/mutations.ts`, lines ~743–758): invalidates `QUERY_KEYS.settings` on success and on `ok: false` (harmless: no optimistic value to undo). The `cycleCadence` path finalises the cycle before the patch, which is correct order.
- `emit` isolates subscriber exceptions (`src/lib/events.ts`), so a throwing `settings:changed` subscriber cannot turn a saved write into a rejected mutation.
- `store.open()` seeds the singletons once, and the tenure anchor is never reset on relaunch.
- Migration runner (`src/db/migrate.ts`) applies only versions above `user_version`, each in its own transaction, so no migration runs twice.
- Backup export uses `SELECT *`, so `accent_ext` and the assistant columns are included, and restore inserts only the columns a file carries (pinned by an existing test).
- `PRAGMA foreign_keys = ON` and `journal_mode = WAL` are set on every open (`client.ts`, `openClient`).
- Migration 003 drops `day_log` inside a transaction with foreign keys on. Nothing references `day_log`, so the drop cannot cascade. Verified with a grep of all `REFERENCES` clauses.

## 7. Findings for other areas (not edited by me)

### 7.1 A notification tap can open a screen before the store is open (medium, phone check needed)

- **Where:** `src/services/notifications/index.ts`, line ~275: `router.push(routeForTap(data))`. The listener is attached by `initNotificationsBridge()`, called from `app/_layout.tsx` line ~73 in the root layout's `useEffect`, so it is live from the first frame, and `routeForTap` (lines ~60–65) returns `/today` for every kind except gentle re-entry.
- **Likely effect:** an app killed and then opened by tapping a reminder pushes `/today` before `app/splash.tsx` has run `store.open()`. Every read throws `STORE_UNAVAILABLE` ("Database is not open yet.") until the store opens, so the screen can show an error state. A person who has not finished onboarding can also see `/today` before the splash sends them to onboarding (the splash's `router.replace` usually fixes this, but not necessarily the error state).
- **Suggested fix (owner: notifications service, with the splash owner):** when the store is not `ready`, hold the target route and push it once the splash has finished, or route taps through `/splash` with the target as a parameter. `store.status()` (`src/db/lifecycle.ts`) is available for the check.
- **Phone check:** whether Expo delivers a cold-start notification response to a listener attached after launch, and what the screen shows.

### 7.2 Theme and other saved look are restored only on the splash (low, linked to 7.1)

- `app/splash.tsx` line 54 is the only place that hydrates `useThemeStore`. Any route opened first (see 7.1) starts with `mode: 'auto'` and the default accent until the splash runs. Fixing 7.1 by going through the splash fixes this too.

### 7.3 Entitlement is never restored at launch (medium, for the billing/settings owner)

- The entitlement store (`src/app-shell/stores/entitlement.ts`) starts at `source: 'none'` on every launch. `billing.refreshEntitlement()` is called only from `app/settings/index.tsx:73`, `app/settings/subscription.tsx:36`, `app/assistant/chat.tsx:71` and `src/features/assistant/useEntitlementAndMic.ts:28`.
- The comment at `src/services/billing/index.ts` (the "B1" note around `refreshEntitlement`) says app-shell's boot sequence calls it. It does not: `useAppBootstrap` (`src/app-shell/index.ts`) has no such call, so that comment is wrong.
- **Effect:** a paying subscriber who relaunches sees the "not subscribed" state until they open one of those screens.
- **Suggested fix (owner: onboarding agent for `app/splash.tsx`, or billing):** call `billing.refreshEntitlement()` once after `store.open()` succeeds in `app/splash.tsx` (not awaited before routing), and correct the comment in `src/services/billing/index.ts`.

### 7.4 A transient open failure is reported as a corrupt store (low, copy)

- `src/db/lifecycle.ts`: `open()` catches every error and returns `corrupt`, so a temporary failure (for example a locked file) sends the person to the recovery screen. Recovery offers "Try again" first (`app/recovery.tsx` line ~29 replaces to `/splash`), and erase only as a separate confirmed step, so this is recoverable. The copy on the recovery screen may still say the data is damaged.
- Not changed: distinguishing the cases changes behaviour and copy, which the brief keeps out of my remit.

### 7.5 `store.open()` called twice leaves the first connection open (low)

- `src/db/lifecycle.ts` `openInternal`: each call opens a new connection and re-points the proxy without closing the previous one. The splash runs `open()` once per mount, so this is only a leak if the splash is mounted again. Low priority; one line (`closeAsync` on the previous client) would fix it, but it sits in lifecycle semantics I did not want to change without a test for `eraseAll`.

### 7.6 Other stores that hold a saved preference (report of section 2.6)

| Preference | Where it is kept | Restored on launch? |
|---|---|---|
| Theme mode and accent | `settings` row, copied to `useThemeStore` | Yes, in `app/splash.tsx:54` |
| Notifications, digest time, assistant voice and language, widgets, sync, backup time, onboarding completion | `settings` row / `widget_config` | Read from the DB by each screen and by the bridges (no store copy) |
| Sound on/off | SecureStore (`src/services/sfx/index.ts`) | Loaded by `warmUpSounds()` at boot (asynchronous) |
| Onboarding resume pointer | SecureStore (`src/features/onboarding/progress.ts`) | Read by the S02 resume hook; cleared on erase by the notifications bridge (`store:erased`) |
| BYO AI endpoint and key | SecureStore (`src/services/ai/secureKeyStore.ts`) | Read on use; erase clears it |
| Entitlement | Derived; not stored | Not restored at launch (7.3) |
| Toasts, add menu, celebrations, assistant session | In-memory by design | Not expected to persist |

Only the entitlement store holds a saved-fact mirror that is never restored at launch (7.3).

### 7.7 Onboarding agent: `OnboardingShell.test.tsx` breaks `npx tsc --noEmit`

- `src/features/onboarding/OnboardingShell.test.tsx` lines 145 and 158: the `BackHandler` mock handler is typed `(event: HardwareBackPressEvent) => boolean | null | undefined` where the target signature takes no arguments. Fix the handler's parameter list in that test (or widen the mock type). Not my file.

## 8. What can only be confirmed on a real phone

- **Concurrent saves on Android.** The queue and the transaction fixes are proven against node:sqlite. expo-sqlite's native queue may order concurrent calls differently, so repeat: tap two switches quickly, kill the app, reopen, and check both are kept.
- **Delete during a failing save.** Same check with a task deletion.
- **Kill during a save.** Start a change, kill the app from the recents list within a second, reopen: the previous value should be shown, never a partial one.
- **Notification tap from a killed app (7.1).** Does the tap reach the screen, and does `/today` show an error first?
- **WAL on the device.** `PRAGMA journal_mode = WAL` succeeds on Android storage; `-wal` and `-shm` files appear beside `fallback.db` and are removed on a clean close. Verified only with node:sqlite.
- **Upgrade on the phone.** Install the previous APK, save settings (custom colour, notifications), install the new build over it, open: values kept. The test covers the schema path, not the installed-APK path.
- **Entitlement on relaunch (7.3).** Subscribed account: after relaunch, what does the settings screen show before any refresh?

## 9. Summary

- Data-layer writes were not safe when they overlapped: two saves at once could fail, and a successful write could be undone by a neighbouring failed save. Both fixed by one ordered queue in `DbClientProxy` and transaction bodies that use their own connection. A related read-merge-write race in task edits is fixed the same way.
- A failed settings save now returns `WRITE_FAILED`, and an `undefined` field no longer blocks a save.
- Every saved setting survives a restart, a kill mid-save, a backup and restore, and an upgrade from schema v3, v5 or v6.
- Open items for other owners: 7.1–7.3 (cold-start routing and entitlement), 7.7 (`OnboardingShell.test.tsx` type errors, which currently fail `tsc`).
