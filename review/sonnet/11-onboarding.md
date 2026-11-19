# 11 — Onboarding: test and fix pass (Sonnet)

## Summary
Resume order, route lists, PREVIOUS map, step numbers and tests all agree with the current order (concept 1, hook 2, types 3, consistency 4, personalize 5, primer 6, first-task 7); splash lands on concept, and concept is the step that reads the resume pointer. Found and fixed 7 real problems (below). Area tests: 11 suites / 70 tests pass. Full suite: 123 suites / 959 tests pass. `npx tsc --noEmit` prints nothing. `eslint app/onboarding src/features/onboarding app/splash.tsx --quiet` prints nothing. Browser layout check (ob.js, 14 sizes x 7 steps): no step scrolls, all "ok". 3 sizes x light/dark screenshots looked at.

## Problems found
1. **Back after finishing returns into onboarding** (OnboardingShell.tsx handleSkip; FirstTaskScreen.tsx save). Steps are pushed, so Skip/Save did `router.replace('/today')` over only the top step; the phone's back button from Today went to the previous step (reproduced in the browser build: Skip from step 4, back -> step 3 URL). Fix: new `leaveOnboarding()` in useOnboardingResume.ts calls `router.dismissAll()` (guarded) then `replace`. Browser history cannot prove the native stack is cleared; confirm on phone.
2. **Resume went to the wrong step after Back.** Marker only wrote the pointer on mount; screens stay mounted underneath, so Back from step 4 to 3 left the pointer at 4. Fix: `useOnboardingStepMarker` also re-writes on the screen's `focus` event. Verified in browser: 4 -> Back -> relaunch lands on step 3.
3. **Phone back button on a resumed step left the app** (after resume the step is alone in the stack, so on step 4 hardware back exited). Fix: BackHandler in the shell, steps 2-7, replaces to PREVIOUS when `canGoBack()` is false; otherwise leaves it to the stack. Step 1 does not listen (exit is right).
4. **Colour / light-dark choice only saved on Next.** Picking and then Skip (or kill) lost it after relaunch. Fix (PersonalizeScreen.tsx): each pick applies at once and saves at once (quiet on failure; Next still saves and toasts on failure). The effect that copied settings.accent into the store on every settings change would have overwritten a quicker second pick when the reload of the first save arrived; it now takes the saved colour once. Verified in browser: Indigo + Dark, Skip, relaunch -> Today in dark indigo.
5. **Primer Allow/Not now before settings loaded did nothing for reminders** (`settingsQuery.data` undefined -> reminders not turned on though permission granted). Fix: ask again with `refetch()`. Also a thrown write left Allow spinning for ever / Not now stuck; both now catch and continue to step 7. Denied permission already proceeded.
6. **Double tap could create two routines** (first-task Save: the in-flight flag was state, set after the first render). Fix: `busyRef` guard. Skip got the same guard.
7. Concept's resume "Loading" view had no background (white flash in dark). Gave it the theme background and flex 1 (not a look change otherwise).

## Files changed
App: `src/features/onboarding/useOnboardingResume.ts`, `OnboardingShell.tsx`, `FirstTaskScreen.tsx`, `PersonalizeScreen.tsx`, `NotificationsPrimerScreen.tsx`, `ConceptScreen.tsx`.
Tests: `OnboardingShell.test.tsx`, `app/onboarding/personalize.test.tsx`, `first-task.test.tsx`, `notifications-primer.test.tsx`; new `src/features/onboarding/useOnboardingResume.test.tsx`.

## Tests added
- Shell: Skip does dismissAll then replace; second Skip tap saves once; hardware back on a lone step goes to the previous; hardware back left to the stack otherwise / not registered on step 1.
- Marker: records on mount and again on focus.
- Personalize: picks save at once; a settings reload does not undo a newer pick.
- First task: two presses = one routine, one settings save, dismissAll then replace to /today?justAdded=1.
- Primer: Allow before settings load turns reminders on; failed writes do not trap either button.

## Checked and fine
Next/Back targets all steps (order.test.tsx); Back hidden on step 1; Skip saves first and toasts + stays on failure; splash hydrates theme/accent; finished user goes straight to /today (relaunch verified); Not now turns reminders off if on; validation messages; KeyboardAvoidingView padding is in the shell. No window/document/localStorage use in the area; timers are in animations that are stopped on unmount; the pointer lives in SecureStore, not module memory (module vars only hold animation hints).

## Screenshots looked at (scratchpad/ob11/)
`light-360x640.png`, `dark-412x915.png` (also made: light/dark at 390x844, dark 360x640, light 412x915; contact sheets of all 7 steps). Seen: nothing cut off or overlapping, pictures centred, buttons visible, step 1 has no Back, dots correct. Also `p5-relaunch.png` (dark indigo Today after relaunch). Step 1 headline starts lowercase "a plan A..." deliberately (DESIGN_DECISIONS).

## Only confirmable on a real phone
Android back gesture/button behaviour after Skip/Save (dismissAll) and after resume; SecureStore persistence across a real kill; real notification permission dialog; keyboard on step 7; font width on device. Web `reload` keeps the URL so it does not exercise splash; I used a fresh `goto('/')`.

## Belongs to other areas / for the human
- "Erase all data" (settings/recovery) should also clear the onboarding pointer (`clearOnboardingProgress`); I did not check it fully — a stale pointer would send a re-onboarding user to a late step. Please verify in the settings agent's area.
- Open from the earlier pass: spec says Save disabled until filled; app keeps it enabled and shows errors; no type picker on step 7; no NEW tag on step 3.
