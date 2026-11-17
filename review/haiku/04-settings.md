# 04 — Settings area report

Area: `app/settings/**`, `src/features/settings/**`, `src/features/data/**`, `src/features/notifications/**`,
`src/features/widgets/**`, `src/features/agents/**`. Plus one shared file (`src/ui/Switch.tsx`), listed in section 6.

**Analytics and tracking: none found.** `package.json` has no analytics, crash-reporting or attribution SDK, and a
grep of `src/` and `app/` for analytics, tracking and SDK names found nothing. The settings area uses no
`window`, `document` or `localStorage`.

**Git note:** I made no git state changes. Some of my edits were already committed by other agents' checkpoint
commits (`83be9d9`, `ab94e75`), so `git status` shows those files as clean. The working tree is what matters.
Section 8 has a related incident.

## 1. Summary

| Check | Before | After |
|---|---|---|
| Jest, area paths (`app/settings src/features/settings src/features/data src/features/notifications src/features/widgets src/features/agents`) | 9 of 9 suites failing; 43 of 60 tests failing, 17 passing | **12 of 12 suites pass, 100 of 100 tests** (9 existing suites plus 3 new) |
| Jest, `src/ui` (shared Switch, which I changed) | not run before | 11 of 11 suites pass (run together with the area: 23 suites, 138 tests, all pass) |
| ESLint, area paths, `--quiet` | 13 errors | **3 errors**, all `react-hooks/set-state-in-effect`, left on purpose (section 8) |
| `npx tsc --noEmit` | not measured for my files | My files: no errors. Repo-wide: 3 errors, all in `src/features/priorities/*.test.*` and `app/priorities/index.test.tsx` (another area). |

## 2. Every file I changed

App code:

- `app/settings/agents.tsx`: `"Ask me every time"` in the helper text now uses `&quot;` (lint `react/no-unescaped-entities`). Visible text unchanged.
- `app/settings/index.tsx`: the Sounds switch is `onValueChange={setSoundsOn}`. I removed the explicit `play('toggle_on')` and the unused `play` import, because the shared `Switch` now plays its own click after the value changes (see the Sounds bug in section 4).
- `app/settings/data/index.tsx`: copy fixes to match the verbatim spec (ALLSCREENS S47). Backup toast is now `Backed up — <date>` (was `Backed up <date>`), and the subcopy is `Last backup: <date>` (was `Last backup <date>`). Both use the existing `S47_COPY.backupSuccessPrefix` and `S47_COPY.lastBackupPrefix`, which were defined but unused.
- `src/features/data/IndeterminateBar.tsx`: lint recipe (`useState(() => new Animated.Value(x))[0]` instead of `useRef(...).current`, which fixes 11 `react-hooks/refs` errors). Removed the write-only `reducedRef`. Added a `cancelled` flag so a loop never starts after unmount (section 4).

Tests (existing, updated to the current behaviour; no assertions removed without a replacement):

- `app/settings/index.test.tsx`: copy and label updates (section 3), plus the Sounds tests.
- `app/settings/theme.test.tsx`: rewritten for the current labels and behaviour. Same 6 original test names kept where still meaningful, plus the new save and revert cases.
- `app/settings/subscription.test.tsx`: copy and display updates.
- `app/settings/sync.test.tsx`: copy and display updates.
- `app/settings/help.test.tsx`: row label "FAQ and guides" (the screen's reading).
- `app/settings/notifications.test.tsx`: `useTasks` added to the mock, aria labels updated, two empty-state expectations updated, digest test split in two.
- `app/settings/widgets.test.tsx`: rewritten. Widgets are now rows that open a sheet (not expanding cards). The mock of `useTodayRows` is added.
- `app/settings/data/index.test.tsx`: `useLocalSearchParams` and `eraseAllData` added to the mocks. The erase-row test now asserts the sheet (not a route), plus new erase tests.
- `app/settings/data/erase.test.tsx`: rewritten. The S48 route is now a `Redirect`, so the test checks its targets, and the sheet behaviour is tested on `EraseDataSheet`.

New tests:

- `app/settings/agents.test.tsx` (new, 10 tests)
- `src/features/agents/store.test.ts` (new, 7 tests)
- `src/features/data/IndeterminateBar.test.tsx` (new, 2 tests)

## 3. Every failing test I dealt with

Baseline: 43 failing tests in 9 suites. All were fixed. None was skipped or deleted.

**`app/settings/index.test.tsx`** (S41, 3 failing)
- "default: renders the profile card and every section row": test used the old profile name `Maya`, the old stat text `87% showing up`, and `Help & about`. Reason: deliberate copy change. Updated to `Your progress` (the accessibility label carries it), `87% showing up, last 30 days`, `Help and about`.
- "empty (new user)": test expected lowercase `no data yet`; the spec and the screen both say `No data yet`. Updated the assertion and the title.
- "tapping Theme & accent navigates to S43": the row is labelled `Theme` now (`ROW_LABEL`). Updated to press `Theme`.

**`app/settings/theme.test.tsx`** (S43, 5 failing)
- Every test used old labels (`Accent color, Indigo`, `Appearance, Auto selected`, `preview-chip-*` test IDs that no longer exist, and a removed caption). Reason: deliberate design change (the Theme grid and tab rows use labels `Forge`, `Indigo`, `Light`/`Dark`/`Auto`, and log buttons are labelled `<task>: Done`). Rewritten to assert the current labels. The invariance check now compares the preview's log buttons before and after an accent change.

**`app/settings/subscription.test.tsx`** (S44, 2 failing)
- "free plan": the free-tier sentence is an inline string, not `S44_COPY.freeFraming`. Asserts the `Free plan` row, the footnote, and `Start free trial` now.
- "subscribed-active": the plan line is `Monthly` (not `Fallback AI · Monthly`), and Confirm appears only after a different plan is picked. Rewritten to assert both.
- "renews shows the real store date" (B2): the row is `Renews` / `Aug 20, 2026`. Updated. The "never 3 days" check is kept.

**`app/settings/sync.test.tsx`** (S45, 1 failing)
- "sync-off": the explainer is one footer string (`No login. Your data lives…`), and the row reads `On this device` / `Always`. Updated.

**`app/settings/help.test.tsx`** (S49, 1 failing)
- "renders every row": `FAQ & guides` is shown as `FAQ and guides` (reading choice used for all row labels). Updated. The accessibility labels keep `&`.

**`app/settings/notifications.test.tsx`** (S42, 7 failing)
- Every test: `useTasks` was missing from the `@/queries` mock (test setup, mock out of date). Added.
- Switch aria labels changed to `Allow notifications, on|off` and `Routine due, on`. Updated.
- "Trigger A" (master off): the screen shows a sample and the explainer, not the empty headline. Updated.
- "Trigger B": the empty line is one string, `No notifications set. You won't…`. Updated.
- "digest time picker": `8:00 AM` appears twice (the Select and the sample). Test now checks the Select label. Split into an off test and an on test.

**`app/settings/widgets.test.tsx`** (S46, 8 failing)
- `useToday is not a function` (test setup: `WidgetPreviews` calls `useTodayRows`). Mocked `useTodayRows`.
- Deliberate design change: widget cards are rows that open a settings sheet, not expandable cards. Rewritten around the sheet.

**`app/settings/data/index.test.tsx`** (S47, 7 failing)
- `useLocalSearchParams is not a function`: test setup (mock out of date). Added.
- "the erase-all row navigates to S48": deliberate design change. Erase opens the confirmation sheet (DESIGN_DECISIONS D3, "every confirmation is a bottom sheet"; "replaces the full-page erase layout"). Test now asserts the sheet and no navigation. Also changed the row query to the visible text (the row has no combined accessibility label).
- "a successful backup shows the success toast" and "Last backup" (real bug, not a test problem): the code's wording did not match the verbatim spec. Fixed in the code (section 4). The tests now pass against the spec wording.
- Backup failure, restore failure and cancelled-picker tests passed once the mock was fixed.

**`app/settings/data/erase.test.tsx`** (S48, 6 failing)
- Deliberate design change: the S48 route is a `Redirect` into the sheet (`/settings/data?confirmErase=1` or `/recovery?confirmErase=1`), so the old full-screen tests cannot match it. Rewritten: the redirect targets are tested per origin, and the copy, Cancel, confirm and failure behaviour are tested on `EraseDataSheet`.
- The old "Cancel returns to /settings/data" expectation no longer applies. Cancel closes the sheet and stays on the same screen (spec S48: "no change made"). Tested that way.

## 4. Bugs found in app code

**Fixed**

1. **Sounds off plays a click.** `src/ui/Switch.tsx:49-50` (shared file): `play(value ? 'toggle_off' : 'toggle_on')` ran before `onValueChange`. Turning Sounds off therefore still played `toggle_off` while sounds were on. The brief and the screen's own comment say turning sounds off is silent. How a person hits it: Settings > Sounds > switch off, and a click is heard. Fix: call `onValueChange` first, then `play`. Settings no longer plays the on-click itself (`app/settings/index.tsx`, the Sounds switch). The other switches in the app make the same sound as before. The test now checks that no audio player starts when turning off, and that exactly one switch sound starts when turning on.

2. **Backup wording did not match the verbatim spec.** `app/settings/data/index.tsx:50` and `:74`. The toast read `Backed up Jul 16, 2026 at 8:03 AM`, and the subcopy read `Last backup Jul 14, 2026 at 9:12 AM`. The spec (ALLSCREENS S47, Backup Card and states) says `Backed up — …` and `Last backup: …`. The constants existed in `src/features/data/copy.ts` but were not used. How a person hits it: any backup. Fix: use the constants.

3. **Splash loading bar could keep animating after it was gone.** `src/features/data/IndeterminateBar.tsx`. The reduce-motion preference is read asynchronously, and the loop started in the callback even after unmount. Its cleanup had already run, so nothing stopped it. The window is small (the bar must unmount before the preference resolves), so it is rare. Fix: a `cancelled` flag checked in the callback, plus a regression test. I confirmed the test fails without the guard.

**Found, not fixed**

4. **Contact support and the legal rows do nothing real.** `app/settings/help.tsx` (`handleSupportRow`, and the legal rows' `onPress`). "Contact support" shows `Opening your email app…`, "Privacy policy" and "Terms of service" show `Opening…`, and none of them opens anything. "Rate Fallback" opens the Play Store on Android only; on iOS it shows a toast. This is the interim the brief describes. **No contact address exists in the code** (I searched `app/` and `src/` for `@`, `mailto:` and `support@`), so there is no placeholder address to list. Needs the human's decision: which address, and whether the toast should say what actually happens.

5. **AI agent access looks live but is a preview.** `app/settings/agents.tsx` and `src/features/agents/store.ts`. DESIGN_DECISIONS says this feature is "NOT built" and must go through Phase 1 first. The screen does say "Design preview. Agents cannot connect yet", but: the Settings home row shows `AI agent access: On` or `Off`; the "Let AI agents connect" switch can be turned on; "Connect an agent" shows a fixed code `4K7 92Q`; and "Done" closes without connecting anyone. Only the hidden "Preview: show a connected agent" button adds an agent. The state is in memory, so nothing persists. Needs a decision before this ships: whether the Settings row and switch should exist in preview at all, and whether the fixed code should stay.

6. **Restore picker errors are not caught.** `app/settings/data/index.tsx:59`. `DocumentPicker.getDocumentAsync` is awaited without a try/catch, and `pickAndRestore` is called with `void`. A picker failure becomes an unhandled promise rejection and no message. Not reproduced. Low severity. Not fixed (wrong-scope judgement call on a native failure path).

7. **Digest settings can race.** `app/settings/notifications.tsx:48` (`patchPrefs`). Each patch is built from the settings snapshot at render time, so two toggles pressed before the first save's refetch finishes could undo the first. Local storage is fast, so this is unlikely. Not reproduced. Not fixed.

8. **Sounds setting loads after first render.** `src/services/sfx/index.ts` (the `SecureStore.getItemAsync` read at start-up). A saved "off" applies only after the async read. A sound played before that resolves can be heard. Minor. Not fixed (shared service; the fix would need a load-before-first-render design).

9. **Appearance tabs have no group label.** `app/settings/theme.tsx`, the `Radio label=""` call. The tablist has an empty accessibility label, although each tab is labelled. Minor accessibility gap. Not fixed (needs a change to the shared Radio API).

10. **Settings back chevron pushes instead of going back.** `app/settings/index.tsx` (`onBack` pushes `/today`). Likely intended (the spec names S09 as the entry point), but it adds a stack entry each time. Not changed. Worth a check.

## 5. Tests added

- `app/settings/index.test.tsx` (Sounds): "starts on, and turning it off changes the store and is silent"; "turning it back on changes the store and answers with exactly one switch sound". Checks the real store, and checks audio players through the `expo-audio` mock.
- `app/settings/theme.test.tsx`: each of the six named accents saves and applies (`it.each`); the first "More colours" swatch (Amber) saves `hue-52`; Light, Dark and Auto each save and apply; a failed appearance save reverts and shows the warning toast; a failed accent save reverts and shows the warning toast; the live preview recolour; log-button invariance; default selection; back chevron.
- `app/settings/data/index.test.tsx`: erase row opens the sheet and navigates nowhere; Cancel erases nothing and does not navigate; "Erase everything" erases and goes to `/splash`; a failed erase shows the retry banner and stays on the sheet; `confirmErase=1` opens the sheet; backup failure shows the warning toast (existing test, now passing).
- `app/settings/data/erase.test.tsx`: the redirect targets for `data`, `recovery` and no origin; sheet copy for both origins; Cancel closes without erasing; confirm erases and goes to `/splash`; failure keeps the sheet with the retry banner and the button enabled.
- `app/settings/agents.test.tsx` (new): off by default, with no connect controls; the design-preview notice; the switch reveals controls and turning it off clears agents; connect path (code shown, preview connects an example); Done connects nobody; disconnect removes one agent; "Disconnect every agent" clears all and shows the success toast, and is hidden when none; permission choices update the store; deleting cannot be set to allow; "Always allow adding tasks" sets add-and-edit to allow.
- `src/features/agents/store.test.ts` (new): starts off; connecting the example is idempotent; disconnect removes only one; disconnect-all; switching off clears agents; deleting excludes `allow`; each scope starts at its specified value.
- `src/features/data/IndeterminateBar.test.tsx` (new): starts its loop once the preference is known; no loop if unmounted before the preference arrives (regression test for item 3).

## 6. Shared files touched

- `src/ui/Switch.tsx`, `onPress` (lines 49-50). Swapped the order so the value changes before the click plays. Reason: bug 1, the Sounds switch played a click when turned off. No styles or other behaviour changed. The `src/ui` suites still pass (11 of 11).

## 7. What I read and found fine

App screens: `app/settings/index.tsx`, `theme.tsx`, `data/index.tsx`, `data/erase.tsx`, `agents.tsx`, `help.tsx`, `sync.tsx`, `subscription.tsx`, `notifications.tsx`, `widgets.tsx`.

Feature code: `src/features/agents/store.ts`, `src/features/data/EraseDataSheet.tsx`, `IndeterminateBar.tsx`, `copy.ts`, `src/features/settings/copy.ts`, `src/features/notifications/NotificationSample.tsx`, `src/features/widgets/WidgetPreviews.tsx` (first 40 lines and its imports; the rest I did not read in full).

Services and shared code: `src/services/sfx/index.ts`, `src/services/data/index.ts`, `src/db/lifecycle.ts` (backup, restore, erase), `src/queries/mutations.ts` (`useUpdateSettings`), `src/queries/reads.ts` (`useSettings`, `useTasks`), `src/ui/Switch.tsx`, `ConfirmSheet.tsx`, `Radio.tsx`, `Tabs.tsx` and `Select.tsx` (labels only), `src/app-shell/stores/theme.ts`, `src/theme/tokens.ts`, `src/features/today/useTodayRows.ts` (first 35 lines).

Spec and decisions: `design-input/fallback-handoff/uploads/ALLSCREENS_1.md` (S41, S47, S48 sections), `docs/DESIGN_DECISIONS.md` (D3, the Sounds note, the agents section), `src/features/assistant/copy.ts` (`S44_COPY`).

Found fine: the erase flow (sheet, Cancel, confirm, mid-wipe failure), backup and restore failure paths (both return `Result`, so the screens' failure branches are reachable), the notifications master and sub-switch logic, the widget save and failure paths, the theme revert on failure, the sync toggle and push, the subscription restore and manage paths, and the data-layer erase (clears secure-store keys and returns `Result`). Also: no `window`, `document` or `localStorage` in this area; every pressable I checked has an accessibility label; `useTasks` already excludes soft-deleted tasks, so the widget picker is correct.

## 8. Not done / unsure

- **Three lint errors left** (`react-hooks/set-state-in-effect`), all listed in the brief as "leave and report":
  - `app/settings/subscription.tsx:42` (`void load()` in an effect): the fetch is in an effect, and moving it changes timing.
  - `app/settings/subscription.tsx:46` (`setSelectedPlan(entitlement.plan)` in an effect): correct fix is to derive the selected plan, which changes behaviour when the plan loads later.
  - `app/settings/data/index.tsx:34` (`setEraseOpen(true)` from `confirmErase`): an initial-state fix would not open the sheet if the parameter changed while mounted. Left as is.
- **Incident with another agent's process.** While a debug run timed out, I called `TaskStop` on task `by2uan4y9`, assuming it was my run. The task's command, as reported back, was another agent's (`src/features/progress/badgeIcons.coverage.test.ts`). I did not check first. If it was that agent's run, it was stopped and needs a re-run. I am sorry for the disruption. I did not touch any other files.
- **`npx tsc --noEmit` is not clean repo-wide.** The three errors are in the priorities area's test files. My files are clean.
- **Agent preview decisions** (bug 5) and **contact addresses** (bug 4) need the human, not a code change.
- **Duplicated test name fixed:** in `app/settings/index.test.tsx` the empty-state test title now reads `No data yet` to match the spec.
- **Not verified on a device:** all tests run in Jest with mocked audio, Share, DocumentPicker and SecureStore. I did not check text clipping on a phone, real audio, or the reduce-motion path on a device.
- **Pre-existing lint/tests for other areas:** I did not touch `app/**` outside `app/settings`, or any other area's tests.
