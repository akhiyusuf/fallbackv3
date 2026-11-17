# 06 — Shared core and phone readiness

Agent: core / phone-readiness (wave 2). Area: `src/domain`, `src/db`, `src/queries`, `src/services`, `src/lib`, `src/theme`, `src/app-shell`, `src/navigation`, `src/ui`, `src/types`. Read-only outside that area (`app/**`, `src/features/**`).

## 1. Summary

| Check | Before (start of my run) | After |
|---|---|---|
| `npx tsc --noEmit` | clean | clean (no output) |
| `npx jest src/db src/queries src/services src/lib src/theme src/app-shell src/navigation src/ui` | 35 suites, 228 tests, all pass | **39 suites, 260 tests, all pass** |
| `npx jest --selectProjects domain` | 10 suites, 130 tests, all pass | **10 suites, 131 tests, all pass** |
| `npx eslint <my folders> --quiet` | 3 errors: 2 `react/display-name` (`src/queries/moveSemantics.test.ts:44`, `src/queries/mutations.test.ts:43`), 1 `react-hooks/set-state-in-effect` (`src/app-shell/index.ts:33`) | **1 error**: `src/app-shell/index.ts:33` (left on purpose, see section 8) |

Two bugs in app logic were fixed (achievement dates, backup file name), one phone bug is reported but not fixed because it needs a dependency (native date picker), and several items are routed to the main session because they are in `app/` or `src/features/`.

Note on git: I made no commits and no state-changing git commands. A checkpoint commit by another agent (`83be9d9`) already contains my edits.

## 2. Every file I changed

- `src/domain/achievements.ts` (~lines 211-225, ~253-262): `fallback-comeback` and `milestone-full-week` took the first match in insertion order, which follows task creation order, not the calendar. They now take the earliest match across all tasks/weeks. The badge date is never re-dated once saved, so the wrong date was permanent. Bug fix, proven by a failing test first.
- `src/domain/achievements.test.ts`: one new test (see section 5).
- `src/db/lifecycle.ts` (line 10 import, line 188): the backup file name used `envelope.createdAt.slice(0, 10)`, which is the UTC day. It now uses the device-local day via `toLocalDate`, as the rest of the app does. Bug fix (small, user-visible in the share sheet).
- `src/queries/moveSemantics.test.ts` (line 43) and `src/queries/mutations.test.ts` (line 42): `makeWrapper` returns a named `Wrapper` function. Lint fix only; behaviour unchanged.
- New test files: `src/db/__tests__/upgradePaths.test.ts`, `src/services/sfx/index.test.ts`, `src/app-shell/stores/toast.test.ts`, `src/ui/AppText.test.tsx`.
- `src/services/sfx/index.test.ts` mock types were corrected so `npx tsc --noEmit` stays clean.

No app code, styles, copy or sounds were changed.

## 3. Failing tests I dealt with

Start of my run: all tests in my area passed. The only failures I hit were my own new tests on the first run, which I fixed (test setup, not app code):

- `src/db/__tests__/upgradePaths.test.ts`, the v4/v6 upgrade tests: the `settings` singleton is seeded by `StoreLifecycle.open()`, not by the migrations. Fixed by seeding the row in the test.
- The same file, the "pre-v5 backup" test: the handcrafted `cycle_state` row used columns that do not exist (`current_cycle_id` is the real name). Fixed.
- `src/services/sfx/index.test.ts`: `jest.isolateModules` gives the module its own copy of the mocked libraries, so the test inspected the wrong mock instances. Changed to one fresh module registry per test (`jest.resetModules`), with the setup run before the module loads.
- `src/ui/AppText.test.tsx`: `render` needed `await`, matching the rest of the suite.

## 4. Bugs found in app code

### Fixed (in my area)

1. **Achievement date for "Comeback" and "Full week"** — `src/domain/achievements.ts` (~213-225 and ~255-262). Wrong date, stored permanently. How a person hits it: they have two habits; the older one first comes back on Nov 2, the newer one comes back on Oct 11. The badge is dated Nov 2 forever. Fix: take the earliest qualifying day across all tasks (and the earliest qualifying week). Test: section 5.
2. **Backup file date is the UTC day** — `src/db/lifecycle.ts:188`. A user west of UTC who backs up in the evening gets tomorrow's date in the file name. Fix: device-local date. Covered by a test that is only partly effective (section 8).

### Found, NOT fixed, needs a person's decision or a dependency

3. **Date and time fields on a phone show raw ISO text and do not open a picker** — `src/ui/DateField.tsx:66-86`. The web branch is correct. The native branch renders a plain `TextInput` whose value is the raw `2026-11-16` or `19:00`, and nothing opens a picker. This breaks design decision D12 ("No raw ISO text is ever shown or typed"; "Tapping opens the platform's native date/time picker"). It affects every date and time field: `app/add/event.tsx:108-109`, `app/add/course.tsx:87-88`, `app/add/routine.tsx:107`, `app/task/[id]/index.tsx:408`. Fix needs a native picker library, such as `@react-native-community/datetimepicker`, which is not installed. The brief rules out new dependencies, so I did not patch it. A display-only change would make the field read-only, so I did not do that either.
4. **Monthly, bi-monthly and yearly on days 29–31 are never due in short months** — `src/domain/occurrence.ts` `cadenceDue` (exact day-of-month match). The UI offers 1–31 (`src/ui/CadencePicker.tsx:43`). `addMonths` clamps to the last day elsewhere, so the two rules disagree. A "31st" routine simply has no occurrence in April, June, September, November or February. No spec says which behaviour is intended (ALLSCREENS and SCHEMA are silent). Not changed. Needs a product decision: skip the month, or clamp to the last day.

### Routed to the main session (in `app/`, not my area)

5. **"Rate Fallback" on Android probably does nothing** — `app/settings/help.tsx:36`. `Linking.canOpenURL('market://details?id=…')` returns false on Android 11+ unless the app declares a `<queries>` entry, so the code falls through to the toast. Likely fix: drop the `canOpenURL` check and call `Linking.openURL` inside the existing try/catch. Not verified on a device.
6. **Paywall success timers are not cleared on unmount** — `app/assistant/paywall/plan.tsx:38` and `app/assistant/paywall/byo.tsx:39`: `setTimeout(() => router.replace('/assistant/chat'), 600)` with no cleanup. If the screen is left within 600 ms, the replace still fires. Low severity.

## 5. Tests added

- `src/db/__tests__/upgradePaths.test.ts` (9 tests):
  - Fresh install and a store upgraded from v1 have identical tables, columns and indexes (compared from `pragma_table_info` and `sqlite_master`).
  - The v5–v7 columns exist on a fresh install with their defaults.
  - Upgrade from v4: a To-do with text becomes a Note, a blank or null To-do stays a To-do, a routine note is untouched, the settings accent survives.
  - Upgrade from v5: explicit `is_note` values are not re-derived.
  - Upgrade from v6: `accent_ext` survives; `priority_rank` is null.
  - Running migrations on a v7 store changes nothing.
  - Backup, erase and restore keeps a Note, a placed priority (`priorityRank: 2`) and a custom accent (`hue-200`).
  - Backup file is named with the device-local day.
  - A handcrafted v4-shaped backup (no `is_note`, `priority_rank` or `accent_ext`) restores, with defaults applied.
- `src/services/sfx/index.test.ts` (12 tests): `play` is silent when sounds are off; plays a bundled sound when on; a delayed play fires after the delay (fake timers) and not before; a delayed play is dropped if sounds are turned off first; a throw from `createAudioPlayer` never leaks out of `play`; a failing `play()`/`seekTo()` or a rejected audio-mode call is swallowed; the saved `"off"` is read at start-up and silences sounds; `"on"` or no saved value leaves sounds on; a failed read keeps the default; `setOn` writes `off`/`on` to SecureStore; a failed write does not throw.
- `src/app-shell/stores/toast.test.ts` (6 tests): a warning toast plays `error`; a plain success toast plays `saved`; a success toast with an icon plays nothing; a neutral toast plays nothing; a warning with an icon plays `error`; the toast is still shown.
- `src/ui/AppText.test.tsx` (5 tests): `Text` sets `Nunito`, keeps the caller's style, forwards its ref; `TextInput` sets the family, keeps the style, forwards props and its ref.
- `src/domain/achievements.test.ts` (1 new test): "Comeback is dated by the earliest comeback across tasks". It failed before the fix (`2024-11-02` instead of `2024-10-11`) and passes after.

## 6. Shared files touched

- `src/domain/achievements.ts`: lines ~211-225 (comeback), ~253-262 (full week). Why: section 4, item 1.
- `src/db/lifecycle.ts`: line 10 (import `toLocalDate`), line 188 (file name). Why: section 4, item 2.
- `src/queries/moveSemantics.test.ts` line 43, `src/queries/mutations.test.ts` line 42: lint.
- `src/domain/achievements.test.ts`: one new test appended.

## 7. Phone readiness (point 4)

Scan: `window.`, `document.`, `localStorage`, `sessionStorage`, `navigator.`, `globalThis.`, `Platform.OS` branches, `alert(`, `fit-content`, `vh`, `calc(`, `position: 'fixed'`, `cursor`, `outlineStyle`, `boxShadow`, `backgroundImage`, `addEventListener`, `setInterval`, `setTimeout`, `require(`, `toISOString`, `new Date(`, and font and asset wiring. Searched all of `src/` and `app/`.

Hits and verdicts:

| Location | What it is | Verdict |
|---|---|---|
| `src/ui/DateField.tsx:19-26` | `document`, `Platform.OS !== 'web'` guard | Fine. Web-only, and guarded. |
| `src/ui/DateField.tsx:66-86` | Native branch is a raw `TextInput` showing `YYYY-MM-DD` / `HH:mm`, no picker | **BUG on phone** (D12). Reported, not fixed (section 4, item 3). |
| `src/ui/Input.tsx:85` | `outlineStyle: 'none'` (web-only key, added via spread) | Fine. Ignored on native. Left alone. |
| `src/ui/Toast.tsx:35` | `Platform.OS !== 'web'` before `announceForAccessibility` | Fine. |
| `src/ui/Toast.tsx:36` | Auto-dismiss timer | Fine. Cleared in the effect's cleanup. |
| `src/ui/Dialog.tsx:32` | Modal animation by platform | Fine. |
| `src/ui/Screen.tsx:31` | `KeyboardAvoidingView` `behavior` iOS `padding`, Android `undefined` | Fine in principle. Android keyboard behaviour depends on the window's soft-input mode, which the config does not set. Not verified on a device. |
| `src/ui/motion.tsx:16` | `reduceMotionChanged` listener | Fine. `sub.remove()` on cleanup. |
| `src/app-shell/index.ts:54-62` | `setInterval` + `AppState` listener (day rollover) | Fine. Both cleared on cleanup. |
| `src/services/notifications/index.ts:243-256` | `AppState` listener and notification-tap listener | Fine. All removed in the cleanup. |
| `src/services/sfx/index.ts:82,89` | `setTimeout` for warm-up and delayed sounds | Fine. Short, and harmless if it fires late. |
| `src/services/sync/index.ts:59-60` | `Platform.OS` picks an unavailable provider on both iOS and Android | Fine (intended: sync not implemented). |
| `src/services/ai/managedProvider.ts:35` | Platform header | Fine. |
| `src/features/progress/Confetti.tsx:48,66` | `pointerEvents="none"` | Fine. A React Native prop. |
| `app/settings/help.tsx:36` | `Linking.canOpenURL('market://…')` on Android | **Likely bug** (Android 11+ package visibility). Routed (section 4, item 5). |
| `app/assistant/paywall/plan.tsx:38`, `byo.tsx:39` | `setTimeout` replace, not cleared | Low. Routed (item 6). |
| `app/assistant/mic-primer.tsx:37-45` | `AppState` listener | Fine. Removed in cleanup. |
| `app/settings/subscription.tsx:58,74`, `app/settings/sync.tsx:41`, `app/assistant/paywall/plan.tsx:41-42`, `src/services/ai/...` | Platform-specific copy | Fine. Both branches are filled. |
| `require(...)` of `.wav` (`src/services/sfx/sounds.ts`), `.webp` (`src/features/onboarding/bannerImages.ts`) | Bundled assets | Fine. Every referenced file exists (checked `assets/sfx/*.wav`, `assets/onboarding/banner_1..7.webp`). |
| `src/db/__tests__/testHarness.ts`, `src/queries/testSupport/dbMock.ts` `require` | Test-only | Fine. |
| `app.config.ts` fonts | Nunito, five TTF weights (400–800); all five files exist in `assets/fonts/` | Android: the `expo-font` plugin writes per-weight definitions, so weights should resolve. **iOS: not verified**. The iOS plugin lists the same files with no weight mapping, so `fontWeight` 500/600/800 may render as Regular or Bold on iOS. Needs a device check. |
| `src/db/lifecycle.ts:188` | Backup file name from the UTC day | **Bug**, fixed (section 2). |
| `new Date(...)` in `src/lib/date.ts`, `src/queries/*`, `src/services/*` | Device-local helpers | Fine. |
| `src/lib/date.ts` `parseLocalDate` | `new Date(y, m, d)` at local midnight | Fine. Date-only; no DST issue for `YYYY-MM-DD` values. |

Nothing in `src/` or `app/` still uses `window`, `localStorage`, `navigator`, `globalThis`, `alert`, `vh`, `calc`, `fit-content`, `position: 'fixed'`, `boxShadow` or `backgroundImage` outside the web-only guarded branch above.

Typeface check: the only file that imports `Text` or `TextInput` from `react-native` is `src/ui/AppText.tsx`. I checked single-line and multi-line imports and namespace access. Three test files import `Text` from `react-native`; tests are excepted.

## 8. Not done, unsure, needs a decision

- **Left in place**: `src/app-shell/index.ts:33` (`react-hooks/set-state-in-effect`). The obvious fix is `useState(true)`. That changes the first render from "not ready" to "ready", so the blank first frame goes away. The brief says to fix only when behaviour stays the same, and the comment says the effect is deliberate, so I left it. Decision: accept `useState(true)` or keep the effect.
- **Date/time picker on phones** (section 4, item 3): needs a dependency decision.
- **Monthly day 29–31 rule** (section 4, item 4): needs a product decision.
- **Backup file-name test is weak**: it compares the file name with the device-local day of the backup's own `createdAt`. The wrong UTC code only fails when the host clock is near midnight in a zone west of UTC. The test passes in both UTC and America/Los_Angeles, so it does not prove the fix on its own.
- **Schema header comment**: `src/db/schema.sql` says it is "CURRENT (v4)" and lists migrations 1–4, although the body already includes the v5–v7 columns. Stale comment, not changed.
- **Sound players**: if creating a player throws, that sound is cached as `null` and never retried for the run. Acceptable for a sound effect. Noted, not changed.
- **Nothing was run on a device.** Phone observations come from reading the code and the Expo plugin sources, not from running the app on Android or iOS.
- Untracked `.jest-before.log` at the repo root was not created by me and is not in my area. Left alone.

## 9. What I read and found fine

Domain: `src/domain/dateMath.ts` (checked the civil-date algorithms by hand, the weekday anchor and `addMonths` clamping), `occurrence.ts`, `dayState.ts` (carrier logic), `consistency.ts` (per-task and aggregate windows, off and pending handling), `cycles.ts`, `xp.ts`, `validation.ts`, `achievements.ts` (fixed, see above), `index.ts`.

DB: `migrations/index.ts`, `005_task_is_note.ts`, `006_settings_accent_ext.ts`, `007_task_priority_rank.ts`, `001_initial.ts` (cycle_state shape), `migrate.ts`, `backupEnvelope.ts`, `lifecycle.ts` (backup, restore, erase), `repositories/settingsRepository.ts` (accent and accent_ext write logic), `repositories/taskRepository.ts` (new columns in insert, update, row mapping), `schema.sql`, `testSupport/expoSqliteTestDouble.ts`.

Queries: `internal.ts` (`resolveTaskOccurrences`, `resolveWriteTarget`, `creationLocalDate`), `reads.ts` (`useTrend`, `useToday`, `useConsistency`, `useAchievements`, `useTaskOccurrences`), `mutations.ts` (snooze, undo snooze, `useUpdateTask`).

Services: `sfx/index.ts`, `sfx/sounds.ts`, `notifications/index.ts` (listeners and cleanup).

Shared UI and app shell: `ui/AppText.tsx`, `ui/DateField.tsx`, `ui/Toast.tsx`, `ui/motion.tsx`, `ui/Input.tsx`, `ui/Screen.tsx`, `ui/Dialog.tsx`, `ui/CadencePicker.tsx` (day list), `app-shell/index.ts`, `app-shell/stores/toast.ts`, `src/features/priorities/order.ts` (read to check how `priorityRank` is used), `app/settings/help.tsx`, `app/assistant/mic-primer.tsx`, `app/assistant/paywall/plan.tsx`, `app/assistant/paywall/byo.tsx`, `app/settings/subscription.tsx`, `app.config.ts` (fonts and plugins), `assets/` listing.
