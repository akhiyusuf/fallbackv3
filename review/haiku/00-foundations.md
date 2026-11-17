# 00 — Foundations report

Owner: foundations agent (first of several). Scope: type errors in test code, shared test
fixtures and mocks, the `src/ui` kit tests, lint setup, and the domain / db / queries /
services / lib / theme / app-shell test folders.

## 1. Summary

| Check | Before | After |
|---|---|---|
| `npx tsc --noEmit` | 14 errors | **0** (no output, exit 0) |
| `npx jest src/ui` | 3 of 10 suites failing; 9 of 33 tests failing | **10 of 10 suites, 33 of 33 tests pass** |
| `npx jest --selectProjects domain` | not measured before my edits (type-only edits in this folder) | **10 of 10 suites, 130 of 130 tests pass** |
| `src/db src/queries src/services src/lib src/theme src/app-shell` | not measured before my edits | **24 of 24 suites, 190 of 190 tests pass** |
| `npx eslint . --quiet` | 175 errors | **41 errors**, all in `src/features`, `app`, `src/queries`, `src/app-shell` (outside my fix scope, listed in section 5) |
| Full `npx jest` (all projects), after my changes | 49 failing suites / 282 failing tests (measured after the kit and type fixes, before the shared safe-area mock) | **46 failing suites / 197 failing tests**; 53 suites and 500 tests pass. Every failing suite is under `app/` or `src/features/`. |

The full-run baseline from before any of my edits was not captured, so I cannot give a
clean before number for the whole suite.

## 2. Files changed

Test and fixture files (type fields added, no assertions removed):

- `src/features/task/testSupport/taskFixture.ts` — shared `makeTask` fixture: added `priorityRank: null`, `isNote: false`.
- `src/domain/dayState.test.ts`, `src/domain/occurrence.test.ts` — `makeTask` literals: added `priorityRank: null`, `isNote: false` (fixes the TS errors).
- `src/db/__tests__/lifecycle.test.ts` — `tasks.insert` literal: added `priorityRank: null`, `isNote: false` (TS error).
- `src/db/__tests__/repositories.test.ts`, `src/db/__tests__/backupRestore.test.ts`, `src/db/__tests__/cascade.test.ts` — same two fields in task literals, for consistency with the type (not required by tsc).
- `src/queries/mutations.test.ts`, `src/queries/mutations.invariants.test.ts`, `src/queries/moveSemantics.test.ts` — `makeTask` base: added `priorityRank: null`, `isNote: false` (TS errors).
- `src/services/widgets/snapshot.test.ts` — test `PALETTE`: added `xpFill: '#000'` (4 TS errors); `task()` literal gets the two new Task fields.
- `src/services/ai/__tests__/byoKeyNeverInBackup.test.ts`, `src/services/notifications/schedule.test.ts` — same two Task fields, for consistency (not required by tsc).
- `app/onboarding/concept.test.tsx` — type-only: `S03_COPY.idealLabel` / `fallbackLabel` (keys that no longer exist) replaced with `idealText` / `fallbackText`, which `ConceptScreen` renders.
- `app/onboarding/consistency.test.tsx` — type-only: `S05_COPY.eyebrow` (no such key) replaced with `S05_COPY.headline`, which `ConsistencyScreen` renders as its heading.

Kit tests and kit components:

- `src/ui/Toast.test.tsx` — the reworked Toast has no tone colours and its root is a plain View with role "alert" that is not an accessibility element (its Dismiss button is). `getByRole('alert')` cannot find it, so the alert is looked up by its label with its `alert` role checked. "dismisses on tap" now presses the real Dismiss button. The success test now expects the inverse card surface (`PALETTES.dark.bgAlt`) instead of `idealSoft`.
- `src/ui/MilestoneBadge.test.tsx` — the earned badge is now the solid gold coin: fill is `celebrationGold`, not `goldSoft`. Matches `docs/DESIGN_DECISIONS.md` line 576 ("Earned badges are solid gold coins").
- `src/ui/CalendarHeatmap.test.tsx` — neutrals (surface, border, text-muted) come from `buildTheme('light').color`, because the theme engine tints them toward the accent. Style values are read with `StyleSheet.flatten` because `AppText` now nests style arrays.
- `src/ui/Skeleton.tsx`, `src/ui/Switch.tsx` — `useRef(new Animated.Value(x)).current` replaced with `useState(() => new Animated.Value(x))[0]` (lint recipe). Timing, values and styles unchanged.

Shared mock and config:

- `__mocks__/react-native-safe-area-context.js` (new) — root manual mock, picked up by Jest without a `jest.mock` call. Keeps the real module's exports and contexts, and gives `useSafeAreaInsets` / `useSafeAreaFrame` / `SafeAreaProvider` a default (zero insets, 390x844 frame). Without it, every test that renders anything reading insets fails with "No safe area value available". Same shape as the library's own `jest/mock.tsx`, written as plain JS. `jest.config.js` (frozen) was not changed.
- `eslint.config.js` — see section 5.

## 3. Failing tests dealt with

Kit (`src/ui`), all now passing:

- **Toast, all 5 tests** (`renders nothing…`, `renders the store message as an alert…`, `dismisses on tap`, `a warning toast never paints…`, `a success toast…`). Cause: test setup. The reworked Toast reads `useSafeAreaInsets`, and no provider was mounted. Fixed by the shared safe-area mock. Two further test-side changes: the alert lookup by label + role (RNTL's `getByRole` cannot see a non-accessible View), and the success assertion, which is a deliberate design change (toasts are always the inverse card now; no tone tint).
- **MilestoneBadge, "earned: …"**. Cause: deliberate design change (solid gold coin). Test now asserts the `celebrationGold` fill. The locked-badge test was not changed and passes.
- **CalendarHeatmap, "missed cells are `--surface` …"**. Cause: fixture out of date. Expected the untinted `PALETTES.light.surface` (`#ebe8e1`); the component paints the theme's accent-tinted surface (`#ecddd1`). Test now derives expected values from the same theme.
- **CalendarHeatmap, "legend labels are themed …"**. Cause: test helper. The helper could not see the colour inside `AppText`'s nested style array. Fixed with `StyleSheet.flatten`. Expected colour is the tinted `textMuted`.
- **CalendarHeatmap, "cells and month nav are individually reachable …"**. Cause: test helper, same nested style array, on the sr-only label. Fixed with `StyleSheet.flatten`. No assertion weakened; the accessibility checks are unchanged.

Onboarding (type fixes only, as the brief allows). Status after the shared mock:

- `app/onboarding/concept.test.tsx`, "renders the ideal/fallback worked example…": passes.
- `app/onboarding/concept.test.tsx`, **"Next navigates to S04"**: still fails. It expects `/onboarding/types`; `ConceptScreen` now pushes `/onboarding/hook`. Looks like a deliberate flow change (a new Hook screen sits between concept and types). Not changed; this file is outside my scope beyond type fixes.
- `app/onboarding/consistency.test.tsx`, "renders the sample stat block…" and "\"Next\" navigates to S06": pass.
- `app/onboarding/consistency.test.tsx`, **"sample legend names only Ideal, Fallback and Off"**: still fails. It expects the Off legend entry, but `S05_COPY.sample.off` is now `0`, and `SampleBreakdownBar` only renders the Off entry when `off > 0`. Looks deliberate (copy.ts says the example was changed to match the picture). Not changed, same scope reason.

Other failing suites (`app/` and `src/features/`): not touched, per the brief. The most common failure in the full run is `TypeError: (0, _queries.useToday) is not a function` (and `useProgress`, `useTasks`, `useTaskOccurrences`). The hooks do exist in `src/queries/reads.ts`. 28 test files mock `'@/queries'` with a partial factory that omits the hooks the screen imports. That is a test-side problem for the area agents, not an app bug. Other common messages: `Unable to find an element with displayValue: Morning workout` (38), `useLocalSearchParams is not a function` (22), `No QueryClient set` (12).

## 4. Bugs found in app code

None confirmed. No app file was changed.

Observations, not fixed (need a design or owner decision):

- `src/ui/Toast.tsx`, root `View` (around line 66): carries `accessibilityRole="alert"` and a label but no `accessible` prop, so it is not an accessibility element on its own. The alert is announced by `AccessibilityInfo.announceForAccessibility` and `accessibilityLiveRegion`, so the message is probably still spoken. Adding `accessible` would group the Dismiss and action buttons into one element, which the kit's own rules forbid, so I did not change it. Worth a check with a screen reader.
- `src/ui/MilestoneBadge.tsx`, header comment: still says "earned = `--gold-soft` fill + 2px `--celebration-gold` border". The code and the approved design use a solid `celebrationGold` coin with a 5px bottom edge. Stale comment, not changed.

## 5. Lint

Config changes (`eslint.config.js`; the file's header says "frozen", but the brief asked for these edits):

- Ignores added: `design-input/**`, `docs/**`. Already present and kept: `node_modules/**`, `.expo/**`, `.expo-export-check/**`, `ios/**`, `android/**`, `server/dist/**`. Removes 83 errors (72 in `design-input/`, 11 in `docs/`), mostly `no-var` and `no-undef`.
- `__mocks__/**` gets jest and node globals, written inline (no new dependency). Removes 37 `no-undef` errors (`jest` in `expo-audio.js` and `expo-iap.js`).
- `plugins/**` and `server/**` get node globals (`__dirname`, `Buffer`, `process`, …). Removes 3 `no-undef` errors.

Fixed in `src/ui/` (recipe): `Skeleton.tsx` and `Switch.tsx`, `react-hooks/refs`, 11 errors. No `react/display-name` or `set-state-in-effect` in `src/ui`.

Remaining errors: 41, all outside my fix scope.

- `src/features/` (24)
  - `react-hooks/refs` (23): `src/features/progress/Confetti.tsx` (lines 26 ×5, 75 ×2, 87 ×2, 88 ×2, 89 ×2); `src/features/data/IndeterminateBar.tsx` (lines 15, 16 ×4, 39, 41 ×2); `src/features/assistant/useAssistantChat.ts` (lines 234, 235).
  - `react-hooks/set-state-in-effect` (1): `src/features/assistant/useEntitlementAndMic.ts:46`.
- `app/` (14)
  - `react-hooks/set-state-in-effect` (10): `app/assistant/history/[id].tsx:40`, `app/assistant/paywall/index.tsx:32`, `app/priorities/index.tsx:41`, `app/progress/index.tsx:50`, `app/recovery.tsx:22`, `app/settings/data/index.tsx:34`, `app/settings/subscription.tsx:42,46`, `app/task/[id]/as-needed.tsx:49`, `app/task/[id]/index.tsx:114`.
  - `react/display-name` (1): `app/(tabs)/_layout.tsx:16`.
  - `react/no-unescaped-entities` (3): `app/settings/agents.tsx:79` ×2, `app/task/[id]/index.tsx:482`.
- `src/queries/` (2), test files outside my four folders: `react/display-name` in `src/queries/moveSemantics.test.ts:44` and `src/queries/mutations.test.ts:43`.
- `src/app-shell/` (1): `react-hooks/set-state-in-effect` at `src/app-shell/index.ts:33`.

The `set-state-in-effect` fixes were not attempted in `app/`, `src/features/` or `src/app-shell/`, which are not in my scope.

## 6. Not done / unsure

- **Type-only edits in the two onboarding files.** The two remaining failing tests in them (section 3) were left alone on purpose. Both look like deliberate design or flow changes, so the owning agent should update them.
- **Partial `@/queries` mocks** in 28 test files (section 3). Area agents should add the hooks their screens use, or use `jest.requireActual` for the rest.
- **Toast accessibility** (section 4). Worth a screen-reader check.
- **Stale comment in `MilestoneBadge.tsx`** (section 4).
- **Repository HEAD moved during this run.** At the start it was `047f32d`. It is now `4003be0`, which committed `__mocks__/expo-audio.js` (an untracked file when I started). I did not commit anything. My changes are uncommitted in the working tree.
- **`src/ui/CalendarHeatmap.test.tsx` changed on disk during the run.** The notice said it had changed. When I re-read it, its content matched my own edit, and I found no other changes.
- **Safe-area mock scope.** It changes behaviour for every test that uses the safe-area hooks, not just the kit. It removed the "No safe area value available" failure across the app and feature suites, and no test in my folders regressed. Area agents should know it is there.
- **Baselines.** I did not run the domain or db/queries/services/lib/theme/app-shell suites before my edits, so the "before" column for those is not measured.
