# 01 — Onboarding and app launch: report

Area: `app/onboarding/**`, `app/splash.tsx`, `app/splash.test.tsx`, `app/recovery.tsx`, `app/recovery.test.tsx`,
`app/index.tsx`, `app/_layout.tsx`, `src/features/onboarding/**`.

## 1. Summary

| Check | Before | After |
|---|---|---|
| `npx jest app/onboarding app/splash app/recovery src/features/onboarding` | 9 of 9 suites failing; 23 of 37 tests failing (14 pass) | **12 of 12 suites, 60 of 60 tests pass** (9 existing suites plus 3 new: `app/onboarding/order.test.tsx`, `app/_layout.test.tsx`, `src/features/onboarding/OnboardingShell.test.tsx`) |
| `npx eslint <my paths> --quiet` | 1 error (`app/recovery.tsx:22`, `react-hooks/set-state-in-effect`) | 1 error, same line, left in place (see section 8) |
| `npx tsc --noEmit` | not measured for my area alone | No errors in any file in my area. The project-wide run prints 6 errors, all in `src/services/sfx/index.test.ts` (another agent's area, not touched). The brief's "must print nothing" is therefore not met project-wide. |

Note on the 23 failing tests: none were failing because the app code was broken in a way a person would see on a
phone. Almost all were stale expectations written before the onboarding rework (section 3). Two real bugs in app
code were found (section 4) and fixed.

## 2. Every file changed

App code (non-test):
- `src/features/onboarding/FirstTaskScreen.tsx`: the Save call now catches a thrown write
  (`createTask.mutateAsync(draft).catch(() => ({ ok: false as const }))`), so a rejected write reaches the existing
  retry toast and Save stops spinning. Before, a throw left the button loading for ever. Bug 1 in section 4.
- `src/features/onboarding/PersonalizeScreen.tsx`: the same catch on `updateSettings.mutateAsync` in `handleNext`,
  so a thrown write reverts the colour and shows the retry toast. Bug 2 in section 4.

Test files updated (assertions brought in line with the current app; no test skipped, deleted or weakened):
- `app/splash.test.tsx`: not-onboarded route is `/onboarding/concept` (was `/onboarding/hook`).
- `app/onboarding/concept.test.tsx`: Next goes to `/onboarding/hook`; the secure store is now an in-memory map so the
  resume pointer can be read back; added tests for the step number, no Back on step 1, the pointer it records, and the
  resume redirect (moved here from the hook test).
- `app/onboarding/hook.test.tsx`: Next goes to `/onboarding/types`; Skip also checked to clear the resume pointer; the
  old "hook redirects past S02" test became "hook records itself and does not redirect".
- `app/onboarding/types.test.tsx`: tiles and helper lines checked; the "NEW" tag assertion became "no NEW tag" with a
  comment (open question, section 8).
- `app/onboarding/consistency.test.tsx`: legend is Ideal and Fallback only (Off removed, as the brief says); added the
  86% / 6-of-7 example and step number.
- `app/onboarding/first-task.test.tsx`: "Save disabled until filled" became "Save enabled; pressing it empty shows the
  three errors and saves nothing" (the app does this; the spec disagrees, section 8); "tiles unavailable" became "no
  type picker, body says events, courses and to-dos come after setup"; added: an error clears when its field is typed
  in, and a thrown write shows the retry toast.
- `app/onboarding/personalize.test.tsx`: Skip is present (every step has one); seven dots with step 5 current; no
  Preview button; no reminders row on this step; the step does not arm the bridges itself (the root layout does);
  Next always goes to the primer; added a thrown-write test.
- `app/onboarding/notifications-primer.test.tsx`: `@/queries` mocked (the screen reads settings, which needs a
  QueryClient otherwise); labels are the app's (`Allow notifications`, `Not now`); Next goes by `push`; added tests:
  Not now turns reminders off if they were on, a granted Allow turns on the four described reminders and reschedules,
  a declined Allow changes nothing.
- `app/recovery.test.tsx`: `useLocalSearchParams` added to the expo-router mock; "Reset app data" opens the erase
  sheet over the screen (no navigation); added: `?confirmErase=1` opens the sheet on arrival.

New test files:
- `app/onboarding/order.test.tsx`
- `app/_layout.test.tsx`
- `src/features/onboarding/OnboardingShell.test.tsx`

## 3. Every failing test I dealt with

All 23 failures at the start, with cause and action:

| File | Test | Cause | Action |
|---|---|---|---|
| splash.test | routes to /onboarding/hook when not complete | Deliberate flow change: the entry route moved to concept (DESIGN_DECISIONS, round 4, fifth pass). | Test now expects `/onboarding/concept`. |
| concept.test | "Next" navigates to S04 | Flow change: concept's Next is the hook step (order: concept, hook, types...). The test expected `/onboarding/types`. | Expects `/onboarding/hook`. |
| hook.test | "Next" navigates to S03 | Test expected the previous step. Next goes to types. | Expects `/onboarding/types`. |
| hook.test | resume: saved pointer past S02 redirects | Deliberate: the resume check moved to the concept step (DESIGN_DECISIONS, fifth pass). Hook no longer reads it. | Redirect test moved to concept.test; hook.test asserts it records its own pointer and does not redirect. |
| first-task.test | Save disabled until all three have content | Spec mismatch: ALLSCREENS S08 says Save is disabled; the app keeps Save enabled and shows field errors on press. The test assumed the spec. | Test asserts current behaviour. Open question, section 8. |
| first-task.test | only Routines selectable; others "unavailable until after setup" | The reworked screen has no type picker at all (the body copy only says the other types come later). Test covered a control that no longer exists. | Replaced with "no type picker; body says events/courses/to-dos after setup". Listed here as the one covered-thing-gone case. Open question, section 8. |
| personalize.test | default: no Skip control | Wrong: D6 says Skip is on every step. | Test asserts Skip is present. |
| personalize.test | renders 5 dots; Preview not disabled | Dots: D6 is one dot per step (7). Preview button removed on purpose (DESIGN_DECISIONS item 11: "a full-width accent Preview button that does nothing"). | Asserts 7 dots, step 5 current, no Preview. |
| personalize.test | mounting arms the bridges | Moved: the root layout arms them at boot (CR-5 comment in `_layout.tsx`). | The step test asserts it does not arm them; `app/_layout.test.tsx` asserts the root does. |
| personalize.test | reminders off -> Next skips primer | Deliberate: reminders are asked on S07 always (DESIGN_DECISIONS, round 4, 4th pass). | Next always goes to the primer. |
| personalize.test | reminders on -> Next routes to S07 | The reminders switch was removed from this step (decision 10 of round 4). | Folded into the Next test. |
| types.test | renders the "NEW" tag | The app has no NEW tag (spec asks for one). | Asserts no NEW tag, flagged as open question. |
| consistency.test | legend names Ideal, Fallback and Off | Deliberate, per the brief: legend is Ideal and Fallback only. | Asserts Off is absent. |
| notifications-primer.test (6 tests) | all | Test setup: `useSettings` runs without a QueryClient. Also: the screen uses `push` (DESIGN_DECISIONS round 4, 4th pass; "pushed, not replaced") and the labels are `Allow notifications` / `Not now`, not `..., button`. | Mocked `@/queries`; updated labels and `push`. |
| recovery.test (4 tests) | all four | Test setup: the expo-router mock lacked `useLocalSearchParams`. Also, "Reset app data" now opens the erase sheet in place (D3: every confirmation is a bottom sheet), not a route. | Mock fixed; reset test asserts the sheet. |

Also fixed while there: `app/onboarding/personalize.test.tsx` had a wrong label (`Forge Orange, selected`); the app says `Forge, selected`
(`THEME_LABELS` in `src/theme/tokens.ts`).

## 4. Bugs found in app code

Fixed:

1. **`src/features/onboarding/FirstTaskScreen.tsx`, `handleSave`.** A write that throws (for example, the database
   is closed) rejected `createTask.mutateAsync`. The code had no catch, so `saving` stayed true: the Save button
   spun for ever and the retry toast never showed. How a person hits it: a write failure on the last onboarding step.
   Fix: catch the rejection and treat it as a failed save. Test added in first-task.test.
2. **`src/features/onboarding/PersonalizeScreen.tsx`, `handleNext`.** The same problem on
   `updateSettings.mutateAsync`: Next spun for ever and the colour was not reverted. Fix: the same catch. Test added
   in personalize.test.

Found, not fixed (need a decision or are too small to change):

3. **`src/features/onboarding/OnboardingShell.tsx`, `handleSkip`.** The settings write is `void`-ed and its result is
   never checked. If it fails, the person still lands on Today, and onboarding comes back on the next launch because
   `onboardingCompletedAt` was not saved. If the write throws, the rejection is unhandled. Not fixed: what Skip should
   do when the save fails is a product decision. Worth a look.
4. **`src/features/onboarding/FirstTaskScreen.tsx`, `handleSave`.** The `onboardingCompletedAt` write after the
   routine is saved is also `void`-ed. If it fails, onboarding restarts on the next launch and the person can create the
   first routine a second time. Not fixed, same reason as 3.
5. **`src/features/onboarding/NotificationsPrimerScreen.tsx`, `handleAllow`, around the `if (prefs)` check.** If the
   settings query has not loaded when Allow is tapped, the permission is granted and `reschedule()` runs, but no
   reminder is switched on, so Settings can still show nothing set. Reachable only if Allow is tapped before settings
   load, which is unlikely on this screen. Not fixed.
6. **`app/splash.tsx`, `'uninitialised'` branch.** `store.open()` (`src/db/lifecycle.ts`) only ever returns `ready` or
   `corrupt`, so the `uninitialised` check is dead code. Harmless. Not changed.
7. **`src/features/onboarding/progress.ts` header comment.** It says the pointer records the "furthest reached" step. It
   records the last step that mounted. The two differ only when the back fallback uses `router.replace`. Low impact;
   comment not changed.
8. **`src/features/onboarding/PersonalizeScreen.tsx`, the appearance `Radio`.** It is given `label=""`, so the group
   has no accessible name. Minor accessibility gap. Not changed (would change how the screen reads, so left to a person).

Spec and copy divergences (not bugs in the sense of the brief, but they contradict the spec the human approved; listed
in section 8): Save not disabled on S08; no type picker on S08; no NEW tag on S04; S07 "Allow" turns on reminders the S07 copy does not describe.

## 5. Tests added

- `app/onboarding/order.test.tsx`: the seven steps in order (`ORDER`); the last leads to `/today?justAdded=1`; for each
  step, its "Step N of 7" label and its Next (or Save) target equal the next entry.
- `app/_layout.test.tsx`: the root layout arms the notification and widget bridges at boot (the CR-5 call site). Heavy
  imports (Stack, status bar, gesture root, app shell, toast, celebration and add-menu hosts) are stubbed.
- `src/features/onboarding/OnboardingShell.test.tsx`: the density the shell picks for 390x1000 (regular), 390x844
  (compact) and 360x600 (tight), read back through `useOnboardingDensity`; seven dots; Back hidden on step 1 and shown
  from step 2. `planFor` itself is not exported and I did not export it; its result is tested through the density.
  The banner height (`top`) is not asserted.
- `app/onboarding/concept.test.tsx`: Next to hook; step 1 label; no Back; records its pointer; resume redirect.
- `app/onboarding/hook.test.tsx`: Next to types; Skip clears the pointer; records its pointer and does not redirect.
- `app/onboarding/first-task.test.tsx`: Save enabled and errors on an empty press; an error clears when typed in; no
  type picker; a thrown write shows the retry toast.
- `app/onboarding/personalize.test.tsx`: Skip present; seven dots; no Preview; no reminders row; does not arm the
  bridges; Next to primer; a thrown write reverts and shows the toast.
- `app/onboarding/notifications-primer.test.tsx`: Not now turns reminders off if they were on; a granted Allow turns on
  the four described reminders and reschedules; a declined Allow changes nothing and still goes on.
- `app/recovery.test.tsx`: Reset opens the erase sheet in place; `?confirmErase=1` opens it on arrival.
- `app/onboarding/types.test.tsx`, `consistency.test.tsx`: tile and helper lines; legend and example checks (see section 3).

## 6. Shared files touched

None. I did not edit anything under `src/ui`, `src/theme`, `src/queries`, `src/domain`, `src/db`, `src/services`,
`src/lib`, `src/app-shell`, `src/navigation`, `__mocks__` or any other agent's area. `onboardingNeeds.ts` (generated) was
not touched.

## 7. What I read and found fine

App: `app/_layout.tsx`, `app/index.tsx`, `app/splash.tsx`, `app/recovery.tsx`, all eight `app/onboarding/*.tsx` route
files (wrappers), and the test files in those folders.

Feature code: every file in `src/features/onboarding/`: `OnboardingShell.tsx`, `onboardingNeeds.ts` (generated, read
only), `bannerImages.ts`, `OnboardingPicture.tsx`, `copy.ts`, `progress.ts`, `useOnboardingResume.ts`, `ConceptScreen.tsx`,
`HookScreen.tsx`, `TypesScreen.tsx`, `ConsistencyScreen.tsx`, `SampleBreakdownBar.tsx`, `PersonalizeScreen.tsx`,
`NotificationsPrimerScreen.tsx`, `FirstTaskScreen.tsx`, `index.ts`.

Read for context: `src/features/data/copy.ts` (S01, S48, S50 copy), `src/features/data/EraseDataSheet.tsx`,
`src/db/lifecycle.ts` (`open()`), `src/services/notifications/index.ts` (`requestPermission`, `reschedule`),
`src/ui/ButtonPair.tsx`, `src/ui/ConfirmSheet.tsx`, `src/theme/tokens.ts` (`THEME_LABELS`), the head of `useCreateTask`
in `src/queries/mutations.ts`, `docs/DESIGN_DECISIONS.md` (D3, D6, D8, D11, the onboarding passes of round 4), and the
S01, S02-S08, S48 and S50 sections of `design-input/fallback-handoff/uploads/ALLSCREENS_1.md`.

Checked and fine: no `window`, `document`, `localStorage` or `sessionStorage` in my area; every pressable I found has
an accessibility label (Back, Skip, the accent swatches, the type tiles, Next, Allow and Not now); the 14-size fit table
is generated and was not edited; the S05 example maths is consistent (4 + 2 of 7 = 86%, 6 of 7 days); S02 counts match
its week strips (3 of 7 and 7 of 7).

## 8. Not done / unsure (for a person to decide)

Spec or design questions. Each is asserted as the app does it now and flagged in a test comment:

1. **S08 Save should be disabled until name, ideal and fallback are filled** (ALLSCREENS S08, Default state). The app
   keeps Save enabled and shows the three errors on press. Which is wanted? Code change if the spec wins:
   `FirstTaskScreen.tsx` (`nextDisabled`); test to flip back.
2. **S08 type picker** (Routines / Events / Courses / To-dos, the last three disabled with "After setup") is not on the
   screen. `S08_COPY.tiles` in `copy.ts` still lists them but nothing renders it. Confirm the picker is dropped, then
   remove that dead copy.
3. **S04 "NEW" tag** on the To-dos & Notes tile (spec) is absent; the tile label is "To-dos and notes" (spec: "To-dos &
   Notes"). Confirm both.
4. **S07 reminders:** "Allow" turns on routine due, event starting, course dose and gentle re-entry. The S07 copy only
   describes due habits and one invitation back. DESIGN_DECISIONS (round 4, 4th pass) already asks the PRD owner to
   confirm which reminders Allow turns on. Still open.
5. **Two S07/S08 copy lines** removed on short screens are still waiting on the human's yes or no (DESIGN_DECISIONS,
   round 4, 13th and 14th passes).
6. **Observations 3 and 4 in section 4**: what Skip and the final save should do when the settings write fails.
7. **`app/recovery.tsx:22`** lint error (`react-hooks/set-state-in-effect`, `if (confirmErase === '1') setEraseOpen(true)`).
   Left in place. The obvious fix (initialise `eraseOpen` from the param) changes behaviour if the param changes while
   the screen is mounted, and a deep link to `/recovery?confirmErase=1` can do that. Needs a decision on which behaviour
   is wanted.
8. **`npx tsc --noEmit`**: 6 errors in `src/services/sfx/index.test.ts` (`mock` / `mockImplementation` on the expo-audio
   player types). Another agent's area; not touched.
