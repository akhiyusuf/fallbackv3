# 37 — Spec coverage (round 3, Haiku)

Agent: Haiku, round 3 "spec coverage" (`review/EDGE-BRIEF.md`, Round 3).
Scope: does every PRD acceptance criterion and every ALLSCREENS_1.md (S01–S50) state and interaction have a test?
Read: `docs/PRD.md` (F1–F31 acceptance and edge bullets), `design-input/fallback-handoff/uploads/ALLSCREENS_1.md` (read only), `docs/DESIGN_DECISIONS.md` (Round 4 passes 19–25 override the spec where they changed it).
Source files changed: none. Shared files touched: none. Only new test files were added.

## 1. Summary

| | Before this round | After this round |
|---|---|---|
| New test files | — | 10 (listed in section 6) |
| New tests | — | 62 (3 are `it.failing`, one per spec gap below) |
| New tests passing | — | 62 of 62 (the 3 `it.failing` pass by failing as expected) |
| `npx tsc --noEmit` errors in my files | — | 0 (the project has other agents' errors, none in `edge.spec.*`) |

Method. The title index of all 2,223 `it`/`describe` lines was grepped per requirement. Where a title did not say enough, the test file or the source was read. Rows marked COVERED name at least one test file that I saw match the requirement. Rows marked PARTIAL name the part that is covered and the part I did not confirm. Screen states are grouped by screen to keep the table readable. Every state and interaction of S01–S50 is listed under its screen, with the grouped state where several were tested together.

Headline findings:
- **Three spec gaps, each pinned by an `it.failing` test**: S35 task cards navigate (spec says read-only); S26 has no scrub slider; the S16/S17/S18 no-empty-run banner copy is shorter than the spec sentence.
- **Two uncovered requirements now tested**: F27/F13 as-needed "used it" logs earn zero XP (no test drove that path before); S14 Importance and Necessity filters (only the Type chip had a test).
- **Two whole screens had no screen-level test before**: S35 (reopened conversation, `app/assistant/history/[id].tsx`) and the root Auto-theme switch (S43 / F8).
- **Dead code with a stale Skip option (no user impact)**: `src/ui/StateChip.tsx` still has `skip` in its option list (lines 37, 39), but no screen renders it. `src/ui/LogControl.tsx:5` still describes a "Skip today" link. Both are left over from before Round 4 pass 20.

## 2. Traceability table

Status key: **COVERED** (test found and read); **COVERED (NEW)** (test added this round, file in section 6); **PARTIAL** (part covered, part not confirmed); **GAP** (app does not meet the spec; an `it.failing` pins it); **OBSOLETE** (a later decision removed it; not tested, see section 3); **DEVICE** (needs a real phone, cannot be a Jest test); **OPEN** (human decision still pending).

Test file names are relative to the repo root. `titles` means the test title was matched in the title index.

### 2a. PRD P0 (F1–F9, F23, F25)

| # | Requirement | Source | Covering tests | Status |
|---|---|---|---|---|
| F1.1 | No sign-in or account; app reaches every P0 surface | PRD F1 accept. | `src/edge.privacy.test.ts`, `app/coldStart.test.tsx` | COVERED |
| F1.2 | Task, day state, off mark persist across force-quit and relaunch | PRD F1 | `src/db/__tests__/lifecycle.test.ts`, `src/db/__tests__/edge.restarts.test.ts`, `app/settings/remembered.test.tsx` (titles) | COVERED |
| F1.3 | Full OS reboot keeps data | PRD F1 | none possible in Jest | DEVICE |
| F1.4 | No outbound network call in any P0 flow | PRD F1 | `src/edge.privacy.test.ts` ('static: network calls', 'no hardcoded URL outside the managed backend') | PARTIAL (static scan of source, not a proxy capture) |
| F1.5 | Schema version and migration path; older fixture opens | PRD F1 | `src/db/__tests__/migrations.test.ts`, `upgradePaths.test.ts`, `settingsUpgrade.test.ts`, `app/settings/edge.settings.test.tsx` ('a backup from an OLDER version ... restores') | COVERED |
| F1.6 | Deleting the app removes all data | PRD F1 | `src/db/__tests__/lifecycle.test.ts` covers erase; uninstall itself is not testable | DEVICE (uninstall) |
| F1.7 | Storage full or write failure: save reported failed, calm retry, in-memory state kept | PRD F1 edge | `src/db/__tests__/edge.storage.test.ts`, `src/queries/mutations.test.ts` ('XP write failures are never reported as success') | COVERED |
| F1.8 | Rapid taps: last write per field wins, no corrupt day | PRD F1 edge | `src/queries/edge.logging.test.tsx`, `app/task/[id]/edge.taskPage.test.tsx` ('a double tap on Done writes one row once') | COVERED |
| F1.9 | Corrupt store on launch: calm recovery, no crash loop, no auto-wipe | PRD F1 edge | `app/splash.test.tsx` ('routes to /recovery on a corrupt store'), `app/recovery.test.tsx`, `app/edge.recovery.test.tsx`, `src/db/__tests__/lifecycle.test.ts` | COVERED |
| F1.10 | Fresh install: empty store, downstream empty states | PRD F1 edge | `app/coldStart.test.tsx`, `src/features/today/TodayScreen.test.tsx` | COVERED |
| F2.1 | Create a recurring routine: name, icon, colour, cadence (daily, specific weekday) | PRD F2 accept. | `app/add/routine.test.tsx`, `app/add/edge.forms.test.tsx` | COVERED |
| F2.2 | Ideal and fallback both required to save a trackable routine; inline message | PRD F2 | `app/add/routine.test.tsx` ('empty name blocks save...'), `src/domain/validation.test.ts` ('a tracked Routine with no ideal step is rejected') | COVERED |
| F2.3 | Importance and Necessity from fixed pickers only, no free-form tag field | PRD F2 | pickers covered in `app/task/[id]/index.test.tsx` ('the Importance options are shown inline'); no test asserts there is no free-text tag field | PARTIAL |
| F2.4 | Ideal, fallback and off colours fixed, accent-immune | PRD F2, F8 | `app/settings/theme.test.tsx` ('the preview log buttons do NOT recolor with the accent'), `src/ui/edge.a11y.test.tsx` | COVERED |
| F2.5 | Created routine shows on Today when due; "Create your first routine" empty state | PRD F2, F6 | `src/features/today/TodayScreen.test.tsx`, `src/features/browse/RoutinesBrowseScreen.test.tsx`, `src/features/browse/edge.browse.test.tsx` | COVERED |
| F2.6 | Fallback identical to ideal is allowed | PRD F2 edge | `src/edge.spec.routines.test.ts` ('a fallback identical to the ideal is allowed') | COVERED (NEW) |
| F2.7 | Recurrence with no selected days cannot be saved | PRD F2 edge | `src/domain/validation.test.ts`, `src/edge.spec.routines.test.ts` ('a repeating course whose day list is empty') | COVERED (NEW for the course case) |
| F2.8 | Empty name, missing ideal or fallback: inline validation, other data kept | PRD F2 edge | `app/add/routine.test.tsx` ('toggling as-needed back off does not lose the name already typed') | COVERED |
| F2.9 | As-needed variant: ideal and fallback optional | PRD F2 / F27 | `app/add/edge.forms.test.tsx` ('as-needed with nothing but a name saves') | COVERED |
| F3.1 | All ideal steps done logs ideal; at least fallback logs fallback; both count as showing up | PRD F3 | `src/domain/dayState.test.ts`, `src/queries/edge.numbers.test.tsx` ('ideal to fallback downgrades the single award') | COVERED |
| F3.2 | Only due sub-steps count (Tuesday vs Friday example) | PRD F3 | `src/domain/validation.test.ts` ('the Studying Mon-Fri fixture'), `src/edge.spec.routines.test.ts` ('Studying Mon to Fri: a Friday-only step') | COVERED |
| F3.3 | Chip override to one of To do / Done / Fallback / Skip | PRD F3 | To do, Done, Fallback: `app/task/[id]/index.test.tsx`, `src/features/today/TodayScreen.test.tsx`. **Skip: OBSOLETE** (Round 4 pass 20) | COVERED (Skip OBSOLETE) |
| F3.4 | Logged state visible and editable | PRD F3 | `app/task/[id]/edge.taskPage.test.tsx`, `src/features/today/TodayScreen.test.tsx` | COVERED |
| F3.5 | Skip or not-done day recorded in neutral language, no red, no shaming | PRD F3 | Skip OBSOLETE. Neutral missed copy: `src/edge.copy.test.ts` (copy sweep) | PARTIAL |
| F3.6 | State change persists and F5 updates without relaunch | PRD F3 | `src/queries/edge.logging.test.tsx`, `src/queries/mutations.invariants.test.ts` | COVERED |
| F3.7 | Manual override wins over auto-log until changed | PRD F3 edge | `src/queries/edge.logging.test.tsx` and `src/domain/dayState.test.ts` (titles contain 'override') | COVERED |
| F3.8 | Zero steps: day stays To do, not Fallback | PRD F3 edge | `app/task/[id]/edge.taskPage.test.tsx`, `src/domain/validation.test.ts` (titles contain 'zero steps / no steps') | PARTIAL (not read line by line) |
| F3.9 | Un-completing steps downgrades the log | PRD F3 edge | `src/queries/edge.numbers.test.tsx` (downgrade cases) | PARTIAL |
| F3.10 | Persist failure: chip reverts with calm retry, never a false "saved" | PRD F3 edge | `src/queries/mutations.test.ts`, `app/task/[id]/edge.taskPage.test.tsx` | COVERED |
| F3.11 | No steps completed today: chip reads To do | PRD F3 edge | `app/task/[id]/edge.taskPage.test.tsx` | PARTIAL |
| F4.1 | Mark a whole day and/or a task's day off (both grains) | PRD F4 | `src/queries/mutations.test.ts` ('Done (+10) -> mark task-day off'), `src/features/today/TodayScreen.test.tsx` ('whole-day off') | COVERED |
| F4.2 | Off is never a miss, never resets, no XP penalty | PRD F4 | `src/queries/mutations.test.ts` (lifetime XP still includes the 10), `src/domain/consistency.test.ts` | COVERED |
| F4.3 | Off removed from both sides of F5 | PRD F4/F5 | `src/domain/consistency.test.ts`, `src/domain/edge.numbers.test.ts` | COVERED |
| F4.4 | Off days counted and shown separately in breakdown | PRD F4 | `app/progress/index.test.tsx` ('aggregate breakdown bar total') | COVERED |
| F4.5 | Un-mark restores prior state | PRD F4 | `src/queries/mutations.test.ts` ('unmark -> still exactly on'), `src/db/__tests__/repositories.test.ts` ('unmark() removes the mark') | COVERED |
| F4.6 | Marking a future day off is allowed | PRD F4 edge | `src/queries/edge.logging.test.tsx` (titles contain 'future day') | COVERED |
| F4.7 | Every elapsed due day off: "no data yet", never 0% | PRD F4/F5 edge | `app/progress/edge.progress.test.tsx` ('only off days: percent null') | COVERED |
| F4.8 | Off persist failure reverts with retry | PRD F4 edge | not confirmed | PARTIAL |
| F5.1 | Formula (ideal + fallback) / (shown up + missed), rounded | PRD F5 | `src/domain/consistency.test.ts` ('26 shown up, 4 off, 4 missed -> 87%') | COVERED |
| F5.2 | Worked examples 100% and 87% | PRD F5 | `src/domain/consistency.test.ts`, `src/domain/edge.numbers.test.ts` | COVERED |
| F5.3 | Aggregate fractional anchor: 3-day window = 67%, not 50% | PRD F5 scope 2 | `src/domain/consistency.test.ts` ('aggregate 3-day anchor ... 67%'), `src/domain/edge.numbers.test.ts` (67) | COVERED |
| F5.4 | Pending today excluded from both sides; counts once resolved | PRD F5 | `src/domain/consistency.test.ts` ('pending-today aggregate case'), `src/domain/edge.numbers.test.ts` ('absent from the aggregate denominator') | COVERED |
| F5.5 | As-needed contributes nothing at either scope | PRD F5 / F27 | `src/db/__tests__/recentlyDeleted.test.ts`, `src/services/widgets/index.test.ts` ('never an as-needed routine'); F5 numerator/denominator not asserted directly | PARTIAL |
| F5.6 | Word "streak" and streak concepts appear nowhere | PRD F5 | `src/edge.spec.copy.test.ts` (NEW: scans every source file for "streak", "in a row", "days running") | COVERED (NEW) |
| F5.7 | Window 7 / 30 / all-time selectable and live | PRD F5 | `app/progress/index.test.tsx` ('a truncated 30-day window'); live recompute not separately confirmed | PARTIAL |
| F5.8 | Read failure: calm inline retry | PRD F5 edge | `app/progress/index.test.tsx` (loading and error titles) | PARTIAL |
| F5.9 | Per-task scope and task selector | PRD F5 scope 1 | `app/progress/index.test.tsx` (per-task title group) | PARTIAL |
| F6.1 | Today lists due tasks with state chips; toggle routine shows only due steps | PRD F6 | `src/features/today/TodayScreen.test.tsx`, `src/features/today/edge.today.test.tsx` | COVERED |
| F6.2 | Routines browse lists all routines | PRD F6 | `src/features/browse/RoutinesBrowseScreen.test.tsx` | COVERED |
| F6.3 | Every list has an on-brand empty state, never blank | PRD F6 | `src/features/browse/edge.browse.test.tsx`, `src/ui/EmptyState.test.tsx` | COVERED |
| F6.4 | Today and Routines reachable from the tab bar | PRD F6 | `src/ui/BottomTabs.test.tsx`, `src/navigation/index.test.tsx` | COVERED |
| F6.5 | Screen reader and large-text support | PRD F6 | `src/ui/edge.a11y.test.tsx` | COVERED |
| F6.6 | Many tasks due scroll smoothly | PRD F6 edge | `src/queries/edge.scale.test.tsx`, `src/db/__tests__/edge.scale.test.ts` (data scale; scroll smoothness is a device check) | PARTIAL + DEVICE |
| F6.7 | Task logged earlier today still shows its chip | PRD F6 edge | `src/features/today/TodayScreen.test.tsx` | PARTIAL |
| F6.8 | Load failure: calm inline retry | PRD F6 edge | `src/features/today/TodayScreen.test.tsx` (error state) | PARTIAL |
| F6.9 | "Nothing due right now" when routines exist but none due | PRD F6 | `src/features/today/TodayScreen.test.tsx`, `src/features/browse/edge.browse.test.tsx` | COVERED |
| F7.1 | Sheet offers edit, duplicate, icon and colour, snooze, delete | PRD F7 | `app/task/[id]/index.test.tsx`, `app/task/[id]/icon.test.tsx`, `app/task/[id]/delete.test.tsx` | COVERED |
| F7.2 | Action row: exactly two slots (Duplicate + one snooze slot) in all three renderings | PRD F7 | `src/features/task/snoozeSlot.test.ts` (9 tests), `app/task/[id]/index.test.tsx` ('snooze row renders DISABLED (not hidden)') | COVERED |
| F7.3 | No "Move to another day" action anywhere | PRD F7 (narrowed) | `app/task/[id]/index.test.tsx` (asserts the move action is absent) | COVERED |
| F7.4 | Snooze acts only on the occurrence shown in the sheet; not from heatmap | PRD F7 | `app/task/[id]/index.test.tsx` ('heatmap past-cell tap opens the drill-down popover') | PARTIAL |
| F7.5 | One hop forward only, target computed D to D+1 | PRD F7 | `src/queries/moveSemantics.test.ts`, `src/queries/mutations.invariants.test.ts` | COVERED |
| F7.6 | Snoozable from pending, ideal, fallback, missed, off; not-due disabled | PRD F7 | `src/features/task/snoozeSlot.test.ts`, `src/queries/moveSemantics.test.ts` | COVERED |
| F7.7 | One live outcome per task per date: precedence cases 1, 2, 3 | PRD F7 | `src/queries/moveSemantics.test.ts` (C4b, C5, C7, C9), `src/services/widgets/index.test.ts` (snoozed away / into today) | COVERED |
| F7.8 | Already-snoozed occurrence cannot be snoozed again | PRD F7 | `src/features/task/snoozeSlot.test.ts` ('renders Undo snooze ...'), `src/queries/mutations.invariants.test.ts` | COVERED |
| F7.9 | Undo restores the occurrence exactly | PRD F7 | `src/queries/moveSemantics.test.ts` | COVERED |
| F7.10 | Undo reachability when the target day is naturally due (the §7 gap) | PRD F7 §7 | `app/task/[id]/index.test.tsx` names the "documented reachability gap" | OPEN (human decision, PRD §7) |
| F7.11 | `snoozable` boolean: default on, editable after create, persists | PRD F7 | `src/db/__tests__/repositories.test.ts` ('snoozable defaults to true, round-trips ... is editable') | COVERED |
| F7.12 | Turning `snoozable` off does not retract an existing snooze | PRD F7 edge | `src/features/task/snoozeSlot.test.ts` ('renders Undo snooze regardless of the task snoozable flag') | COVERED |
| F7.13 | Two tasks may snooze onto the same date | PRD F7 edge | `src/domain/edge.numbers.test.ts`, `src/queries/moveSemantics.test.ts` (titles) | PARTIAL |
| F7.14 | Delete requires explicit confirmation; cancel changes nothing | PRD F7 | `app/task/[id]/delete.test.tsx` ('opened from S20 -> "Cancel" returns to S20 unchanged') | COVERED |
| F7.15 | Persist failure reverts control with retry; no partial writes | PRD F7 edge | `app/task/[id]/edge.taskPage.test.tsx`, `app/task/[id]/delete.test.tsx` ('a failed delete keeps the dialog open') | COVERED |
| F7.16 | Duplicate copies definitions and toggles, empty history, inherits `snoozable` | PRD F7 edge | `src/db/__tests__/repositories.test.ts` ('a duplicate inherits it'), `app/task/[id]/index.test.tsx` ('Duplicate copies the task') | COVERED |
| F7.17 | Sheet open on a task not due that day: snooze slot disabled | PRD F7 edge | `src/features/task/snoozeSlot.test.ts` ('renders Snooze disabled when today resolves not-due') | COVERED |
| F7.18 | Empty history renders a neutral grid, no missed cells | PRD F7 edge | `app/task/[id]/edge.taskPage.test.tsx` ('empty history'), `app/task/[id]/as-needed.test.tsx` | COVERED |
| F7.19 | Heatmap coloured by fixed signals; legend | PRD F7 | `src/ui/CalendarHeatmap.test.tsx` | COVERED |
| F7.20 | As-needed detail has no snooze slot | PRD F7 | `app/task/[id]/as-needed.test.tsx` | PARTIAL |
| F8.1 | Light, Dark, Auto persists and applies app-wide | PRD F8 | `app/settings/theme.test.tsx`, `app/settings/remembered.test.tsx` ('a theme picked before a restart') | COVERED |
| F8.2 | Auto switches live with the OS | PRD F8 edge, S43 | `src/edge.spec.theme.test.tsx` (NEW: OS flip while open re-themes, no relaunch) | COVERED (NEW) |
| F8.3 | Explicit Light or Dark ignores the OS | PRD F8, S43 | `src/edge.spec.theme.test.tsx` (NEW) | COVERED (NEW) |
| F8.4 | Accent recolours only CTAs and progress | PRD F8 | `app/settings/theme.test.tsx` ('picking a new accent recolors the preview card live') | COVERED |
| F8.5 | Accent never recolours ideal, fallback or off | PRD F8 | `app/settings/theme.test.tsx` ('do NOT recolor with the accent'), `src/ui/edge.a11y.test.tsx` | COVERED |
| F8.6 | Contrast in both themes | PRD F8 | `src/ui/edge.a11y.test.tsx` (scheme x accent grid) | COVERED |
| F8.7 | Persist failure reverts with retry | PRD F8 edge | `app/settings/theme.test.tsx` ('a failed appearance save reverts ...', 'a failed accent save reverts ...') | COVERED |
| F8.8 | Defaults: Auto and a default accent | PRD F8 | `app/settings/theme.test.tsx` ('default: Auto appearance and Forge accent are pre-selected') | COVERED |
| F9.1 | First launch explains ideal and fallback and no streaks, in a few screens | PRD F9 | `app/onboarding/*.test.tsx` (concept, hook, types, consistency) | COVERED |
| F9.2 | No-account and on-device promise stated plainly | PRD F9 | `app/onboarding/hook.test.tsx` and `app/onboarding/types.test.tsx` (copy); not confirmed line by line | PARTIAL |
| F9.3 | OS permission primed before the system prompt; usable if declined | PRD F9 | `app/onboarding/notifications-primer.test.tsx`, `app/settings/notifications.test.tsx` | COVERED |
| F9.4 | Skippable; does not recur after completion | PRD F9 | `app/onboarding/hook.test.tsx` ('"Skip" persists onboardingCompletedAt'), `app/coldStart.test.tsx` | COVERED |
| F9.5 | VoiceOver, TalkBack, Dynamic Type | PRD F9 | `src/ui/edge.a11y.test.tsx`, `app/onboarding/order.test.tsx` | COVERED (automated) + DEVICE (real screen reader) |
| F9.6 | Killed mid-onboarding resumes on next launch | PRD F9 edge | `src/features/onboarding/useOnboardingResume.test.tsx`, `src/features/onboarding/edge.onboarding.test.tsx` | COVERED |
| F9.7 | Erase or reinstall may re-show onboarding | PRD F9 edge | `app/settings/data/erase.test.tsx` (fresh state); re-show not asserted | PARTIAL |
| F23.1 | Each sub-step toggled per occurrence; subset of the parent's occurrences | PRD F23 | `src/domain/validation.test.ts`, `src/edge.spec.routines.test.ts` | COVERED |
| F23.2 | Friday-only step shows only on Fridays (Studying Mon to Fri) | PRD F23 testable | `src/domain/validation.test.ts`, `src/edge.spec.routines.test.ts` | COVERED |
| F23.3 | Fallback is whole-task and not per-occurrence | PRD F23 | not confirmed | PARTIAL |
| F23.4 | No empty run-occurrence at save: toggling every ideal step off on Tuesday is rejected | PRD F23 testable | `src/domain/validation.test.ts` ('toggling the ONLY ideal step off for Tuesday'), `app/add/routine.test.tsx` ('an empty ideal-step run-occurrence day blocks save') | COVERED |
| F23.5 | The save-time message names the offending occurrence, in the spec's full sentence | PRD F23 / S16 copy | `src/edge.spec.routineCopy.test.tsx` (NEW: `it.failing` for the full sentence) | GAP (copy, see section 4, bug B3) |
| F23.6 | Toggle state persists and drives Today | PRD F23 | not confirmed by title | PARTIAL |
| F23.7 | Single sub-step off everywhere: allowed while each occurrence keeps one other ideal | PRD F23 edge | `src/domain/validation.test.ts` ('the Studying Mon-Fri fixture') | COVERED |
| F23.8 | Dropping a parent occurrence removes it from every sub-step's due set | PRD F23 edge | not confirmed | PARTIAL |
| F25.1 | Erase everything from one place in Settings | PRD F25 | `app/settings/data/erase.test.tsx`, `src/features/data/EraseDataSheet.test.tsx` | COVERED |
| F25.2 | Explicit confirmation; cancel does nothing; copy says irreversible, calmly | PRD F25 | `app/settings/data/erase.test.tsx` ('Cancel closes the sheet and erases nothing') | COVERED |
| F25.3 | After erase: fresh-install state; relaunch still empty | PRD F25 | `src/db/__tests__/lifecycle.test.ts` ('eraseAll is atomic: a fresh store afterwards ...') | COVERED |
| F25.4 | Erase on an already-empty store is a no-op landing | PRD F25 edge | `src/db/__tests__/lifecycle.test.ts` ('erase-all on an already-empty store is a no-op') | COVERED |
| F25.5 | Purely local, no network | PRD F25 | `src/edge.privacy.test.ts` | COVERED |
| F25.6 | Mid-wipe failure leaves the store coherent, with a calm retry | PRD F25 edge | `src/db/__tests__/lifecycle.test.ts` (eraseAll atomic); a forced mid-wipe failure is not confirmed | PARTIAL |

### 2b. PRD P1 (F11–F31, the in-v1 fast follow)

| # | Requirement | Source | Covering tests | Status |
|---|---|---|---|---|
| F11 | Events, Courses, To-do/Notes task types | PRD F11 | `src/features/browse/EventsBrowseScreen.test.tsx`, `CoursesBrowseScreen.test.tsx`, `ToDosBrowseScreen.test.tsx`, `app/add/event.test.tsx`, `app/add/course.test.tsx`, `app/add/todo.test.tsx` | COVERED |
| F11-a | A one-off Event with no cadence still earns XP (its due date is the occurrence) | PRD F13 anchor | `src/edge.spec.routines.test.ts` ('a one-off Event with a date and no cadence saves, e.g. "Dentist visit"') saves only; XP on a one-off event is `src/queries/mutations.test.ts` (not read this round) | PARTIAL |
| F12 | Multi-dose courses | PRD F12 | `app/add/course.test.tsx` ('>1 doses/day shows the per-dose helper copy'), `app/task/[id]/edge.taskPage.test.tsx` ('multi-dose course: one control per dose') | COVERED |
| F12-a | A course with zero doses a day is refused | PRD F12 | `src/edge.spec.routines.test.ts` (NEW) | COVERED (NEW) |
| F13.1 | Levels and Showing up, Fallback wins, Milestones; All, Earned, Locked tabs | PRD F13 | `app/achievements/index.test.tsx` (11 tests) | COVERED |
| F13.2 | Fallback completions earn XP (6); ideal earns 10 | PRD F13 | `src/domain/xp.test.ts`, `src/queries/edge.numbers.test.tsx` | COVERED |
| F13.3 | Lifetime XP is monotonic: never resets or goes to zero on a miss or off day | PRD F13 | `src/domain/monotonicity.test.ts`, `src/queries/mutations.test.ts` (lifetime includes the 10 after off) | COVERED |
| F13.4 | As-needed "used it" logs earn ZERO XP (lifetime and cycling), no achievement, no confetti | PRD F13, F27, F31 | `src/edge.spec.asneeded.test.tsx` (NEW: 12 uses earn 0; a 'fallback' marker earns 0; a deleted routine refused) | COVERED (NEW) |
| F13.5 | Achievements recompute correctly from history | PRD F13 | `src/domain/achievements.test.ts` | COVERED |
| F14.1 | Local notifications only; reminder types; each toggleable; daily digest | PRD F14 | `src/services/notifications/schedule.test.ts`, `src/services/notifications/edge.reminders.test.ts`, `app/settings/notifications.test.tsx` ('the daily digest time picker ...') | COVERED |
| F14.2 | As-needed never produces a "routine due" reminder | PRD F14 / F27 | `src/services/notifications/schedule.test.ts` ('an as-needed routine generates zero "routine due" reminders') | COVERED |
| F14.3 | Missed-day encouragement is invitational, not shaming | PRD F14 | `src/services/notifications/index.test.ts` (copy), `src/edge.copy.test.ts` | PARTIAL |
| F15.1 | Filter by Type | PRD F15 | `src/features/search/SearchScreen.test.tsx` ('a Type filter chip narrows results') | COVERED |
| F15.2 | Filter by Importance (High, Med, Low) | PRD F15 | `src/edge.spec.search.test.tsx` (NEW: High chip; Low with High is OR; to-do with no importance hidden) | COVERED (NEW) |
| F15.3 | Filter by Necessity (Must-do, Recommended, Optional) | PRD F15 | `src/edge.spec.search.test.tsx` (NEW: Must-do chip; AND across groups) | COVERED (NEW) |
| F15.4 | Only the two fixed vocabularies, no free-form tags | PRD F15 | not confirmed | PARTIAL |
| F15.5 | Results update live; defined no-results empty state | PRD F15 | `src/features/search/SearchScreen.test.tsx` ('no matches: renders the no-results empty state'), `src/edge.spec.search.test.tsx` ('a filter that matches nothing') | COVERED |
| F16.1 | Real speech-to-text and streaming LLM | PRD F16 | `src/features/assistant/__tests__/useAssistantChat.test.tsx`, `src/services/ai/__tests__/sse.test.ts` | PARTIAL (speech capture is stubbed in code, see `app/assistant/chat.tsx` comment) |
| F16.2 | Creates and edits tasks mid-conversation across types; drafts pairs | PRD F16 | `src/features/assistant/__tests__/toolExecutor.test.tsx`, `src/features/assistant/__tests__/edge.assistant.test.tsx` | COVERED |
| F16.3 | Switch voice and text within one conversation | PRD F16 | `app/assistant/chat.test.tsx`, `app/assistant/mic-primer.test.tsx` ('primer — tap Allow, granted -> listening') | COVERED |
| F16.4 | Disambiguates same-named tasks | PRD F16 | `src/features/assistant/__tests__/ClarificationModal.test.tsx`, `src/features/assistant/__tests__/edge.assistant.test.tsx` | COVERED |
| F16.5 | Undo on edits | PRD F16 | `app/assistant/chat.test.tsx` ('Undo' edit banner); `src/features/assistant/__tests__/edge.assistantChat.test.tsx` | PARTIAL |
| F16.6 | Browsable, reopenable conversation history | PRD F16 | `app/assistant/history/index.test.tsx`, `src/edge.spec.s35.test.tsx` (NEW) | COVERED (NEW for S35) |
| F16.7 | Gated: subscription or BYO key; paywall copy explains | PRD F16 | `app/assistant/paywall/index.test.tsx`, `app/assistant/chat.test.tsx` ('an ENTITLEMENT_REQUIRED error mid-chat routes to the paywall') | COVERED |
| F16.8 | Guardrails: refuse harmful categories; still create literal neutral tasks | PRD F16 R15 | `src/services/ai/__tests__/guardrails.test.ts` (four canonical fixtures), `src/features/assistant/__tests__/edge.assistant.test.tsx` | COVERED |
| F16.9 | "add antibiotics twice a day" created literally, no dosing advice | PRD F16 | `app/add/course.test.tsx` ('Antibiotics fixture'), guardrail fixtures | PARTIAL |
| F16.10 | Never claims to be a doctor, therapist or emergency service | PRD F16 | `src/services/ai/__tests__/guardrails.test.ts` | PARTIAL |
| F16.11 | Privacy caveat shown at the assistant and paywall boundary | PRD F16 | `app/assistant/paywall/index.test.tsx` (copy); not confirmed | PARTIAL |
| F17.1 | $4.99 a month and $39.99 a year, 7-day free trial | PRD F17 | `src/edge.spec.paywall.test.tsx` (NEW: $4.99/mo; $39.99 "Save 33%" against $59.88; "7 days free" subcopy) | COVERED (NEW) |
| F17.2 | Billed by the platform store (no custom processing); Cancel anytime | PRD F17 | `src/services/billing/__tests__/billing.test.ts`, `src/services/billing/edge.billing.test.ts` | COVERED |
| F17.3 | Restore Purchases re-checks the store, no login | PRD F17 | `app/assistant/paywall/edge.paywall.test.tsx` ('nothing to restore: a neutral toast'), `app/settings/subscription.test.tsx` | COVERED |
| F17.4 | Native biometric confirmation | PRD F17 | `app/assistant/paywall/plan.test.tsx` ('a biometric cancel is calm'), `src/services/billing/edge.billing.test.ts` | COVERED (the real Face ID or fingerprint prompt: DEVICE) |
| F17.5 | Free tier keeps all core; only R13 to R15 gated | PRD F17 | `src/edge.privacy.test.ts`, `app/assistant/paywall/index.test.tsx` | PARTIAL |
| F17.6 | Subscription status offline at launch | PRD F17 (open) | recorded as open in Round 4 pass 25 | OPEN |
| F18.1 | BYO base URL and key, equal paywall alternative, manageable in Settings | PRD F18 | `app/assistant/paywall/byo.test.tsx`, `app/assistant/paywall/edge.paywall.test.tsx` | COVERED |
| F18.2 | Key stored on-device only; calls go direct; never in a backup | PRD F18 | `src/services/ai/__tests__/secureKeyStore.test.ts`, `src/services/ai/__tests__/byoKeyNeverInBackup.test.ts` | COVERED |
| F18.3 | Transcription absent: graceful text-only degradation | PRD F18 | `app/assistant/paywall/byo.test.tsx` ('success — degraded (no transcription)') | COVERED |
| F18.4 | Invalid endpoint: calm, never full-screen red | PRD F18 | `app/assistant/paywall/byo.test.tsx` ('invalid endpoint: keeps the typed values'), `src/services/ai/__tests__/byoInsecureUrl.test.ts` | COVERED |
| F18.5 | Reveal control shows or hides the key without changing it | S40 | `src/edge.spec.paywall.test.tsx` (NEW: starts masked; reveal and hide; Save sends the exact key) | COVERED (NEW) |
| F19.1 | Create backup; restore from it | PRD F19 | `src/db/__tests__/backupRestore.test.ts`, `app/settings/data/index.test.tsx` | COVERED |
| F19.2 | Failed restore lands in a non-destructive state | PRD F19 | `app/settings/edge.settings.test.tsx` ('a file that is not a backup at all, and a file that is empty, are refused'), `src/db/__tests__/backupRestore.test.ts` | COVERED |
| F20.1 | Opt-in, off by default; "last synced" status | PRD F20 | `app/settings/sync.test.tsx` ('sync-off (default)', 'sync-on, failed') | COVERED |
| F20.2 | Real iCloud or Android sync | PRD F20 | not built, the switch stores a flag | OPEN (architect, PRD §7) |
| F20.3 | Local data authoritative on conflict; sync failures calm | PRD F20 | `app/settings/sync.test.tsx` ('sync-on, failed'); conflict rule not exercised | PARTIAL |
| F21.1 | Small Today, Small One task, Medium Up next, each fixed or Smart | PRD F21 | `app/settings/widgets.test.tsx` ('gallery-default: all three widget rows shown'), `src/services/widgets/index.test.ts` | COVERED |
| F21.2 | Native home-screen widgets | PRD F21 | Android providers exist: `android/app/src/main/java/com/fallback/app/widgets/` (Small Today, Small One Task, Medium Up Next) | DEVICE (no Jest test can place a widget) |
| F21.3 | Honour theme and fixed signal colours | PRD F21 | `src/services/widgets/index.test.ts` ('theme auto resolves against the OS scheme'), `src/services/widgets/snapshot.test.ts` ('only the three FILLED signal colours') | COVERED |
| F21.4 | Refresh on change; widget refreshes on return to app | PRD F21 | `src/services/widgets/edge.widgets.test.ts`, `src/services/widgets/index.test.ts` ('store:ready republishes') | COVERED |
| F24 | Sub-step scheduling for Courses and Events | PRD F24 | `app/add/edge.forms.test.tsx` (no-empty validation, form level); Event and Course grid specifics not confirmed | PARTIAL |
| F26 | Extended cadences (weekly, bi-weekly, monthly, yearly) and repeating Events | PRD F26 | `src/domain/occurrence.test.ts` ('bi-weekly cadence skips alternate weeks', 'monthly on a day the month does not have'), `app/add/edge.forms.test.tsx` | COVERED |
| F26-a | Closed picker: no custom recurrence beyond the R23 set | PRD F26 | not confirmed | PARTIAL |
| F27.1 | As-needed routine created; a Routine, not a To-do or a fifth type | PRD F27 | `app/add/edge.forms.test.tsx` ('as-needed with nothing but a name saves'), `app/add/routine.test.tsx` ('as-needed toggle hides the cadence') | COVERED |
| F27.2 | Appears in Routines browse; never listed as due on Today | PRD F27 | `src/features/browse/RoutinesBrowseScreen.test.tsx`, `src/features/today/TodayScreen.test.tsx` | COVERED |
| F27.3 | Never "due", no missed day, excluded from F5 | PRD F27 | `src/edge.spec.asneeded.test.tsx` (NEW: never due, zero occurrences), `src/services/notifications/schedule.test.ts` | COVERED (NEW) |
| F27.4 | "Used it" log is reference-only, no XP, no achievement | PRD F27 | `src/edge.spec.asneeded.test.tsx` (NEW) | COVERED (NEW) |
| F27.5 | History shows only the used dates; unused dates blank, never missed | PRD F27 | `app/task/[id]/as-needed.test.tsx` ('empty history renders the EmptyState, not a heatmap') | COVERED |
| F27.6 | No snooze, no sub-step scheduling | PRD F27 | `app/task/[id]/as-needed.test.tsx` | PARTIAL |
| F27.7 | Deleted as-needed routine refuses a use | PRD F27 edge | `src/edge.spec.asneeded.test.tsx` (NEW) | COVERED (NEW) |
| F28.1 | Trend: one point per bucket, reuses scope-2 fractional formula | PRD F28 | `app/progress/trend.test.tsx` ('drops the in-progress trailing bucket'), `src/domain/consistency.test.ts` | COVERED |
| F28.2 | Auto-coarsen by data volume | PRD F28 | `app/progress/trend.test.tsx` (granularity), `src/db/__tests__/edge.scale.test.ts` | COVERED |
| F28.3 | Additive to F5; accessible table alternative | PRD F28 | `app/progress/trend.test.tsx` ('carries a real "Table" alternative'), `src/edge.spec.progress.test.tsx` (NEW) | COVERED |
| F28.4 | Short history: "no data yet", never an empty axis or 0% | PRD F28 edge | `app/progress/trend.test.tsx` ('empty state (history too short)') | COVERED |
| F28.5 | Long dormant gap: no fabricated points | PRD F28 edge | `app/progress/trend.test.tsx` (in-progress and gap handling) | PARTIAL |
| F29.1 | Eleven tenure tiers, from first day to 50 years, by calendar time | PRD F29 | `src/domain/achievements.test.ts` (labels and unlock), `app/achievements/index.test.tsx` ('a locked tenure badge shows a calendar unlock condition') | COVERED |
| F29.2 | Independent of consistency; not gated on F30 or F31 | PRD F29 | `src/domain/achievements.test.ts` | COVERED |
| F29.3 | Clock set back does not revoke a badge; forward jump unlocks all met tiers | PRD F29 edge | `src/domain/edge.numbers.test.ts` ('a clock set backward never unlocks a future tier, and never re-dates an unlocked one') | COVERED |
| F29.4 | Erase resets the anchor | PRD F29 edge | `src/db/__tests__/lifecycle.test.ts` (fresh store) | PARTIAL |
| F30.1 | Permanent per-cycle records, browsable | PRD F30 | `app/records/index.test.tsx`, `app/records/[cycleId].test.tsx` | COVERED |
| F30.2 | Cycle consistency reuses F5 fractional formula, windowed | PRD F30 | `src/domain/cycles.test.ts`, `src/domain/consistency.test.ts` | COVERED |
| F30.3 | Records never overwritten; mid-cycle cadence change archives the partial cycle | PRD F30 | `app/settings/edge.settings.test.tsx` ('changing the cycle cadence mid-cycle'), `app/records/index.test.tsx` ('a short cycle carries the cadence-change note') | COVERED |
| F30.4 | No-data cycle recorded, never 0% | PRD F30 edge | `app/records/index.test.tsx` (empty states) | PARTIAL |
| F30.5 | Before the first boundary: "your first recap arrives" | PRD F30 edge | `app/records/index.test.tsx` (empty state, monthly and weekly copy) | COVERED |
| F31.1 | Cycling XP counter, same eligibility as lifetime XP | PRD F31 | `app/achievements/index.test.tsx` ('Cycling XP label follows the ACTUAL active cadence'), `src/domain/cycles.test.ts` | COVERED |
| F31.2 | Cadence exactly weekly or monthly; default monthly | PRD F31 | `app/achievements/index.test.tsx` (weekly reset subline), `app/settings/edge.settings.test.tsx` | COVERED |
| F31.3 | Reset at each boundary touches nothing lifetime | PRD F31 | `src/domain/monotonicity.test.ts`, `src/domain/cycles.test.ts` | COVERED |
| F31.4 | Mid-cycle cadence change archives immediately and deterministically | PRD F31 | `app/settings/edge.settings.test.tsx` ('the short record ends yesterday, the new cycle starts today') | COVERED |
| F31.5 | Boundary archive-then-reset is atomic; month-end and leap-day maths | PRD F31 edge | `src/domain/cycles.test.ts`, `src/domain/edge.timezones.test.ts` | COVERED |
| F22 | True multi-device conflict resolution | PRD F22 (P2) | not built | OBSOLETE for v1 (P2) |

### 2c. ALLSCREENS_1.md, S01–S50 (states and interactions, grouped by screen)

| # | Screen | States and interactions checked | Covering tests | Status |
|---|---|---|---|---|
| S01 | Splash | Loading; routes to S02, S09, S50 by flag and store; corrupt store routes to recovery; palette restored before first screen | `app/splash.test.tsx` (8 tests incl. 'routes to /recovery on a corrupt store') | COVERED. The ~400 ms minimum display floor is not confirmed |
| S02 | Onboarding: Hook | Next to S03; Skip persists the flag and goes to Today; labelled controls | `app/onboarding/hook.test.tsx` (4) | COVERED |
| S03 | Onboarding: Concept | Next; Skip; inert example card; "Step 2 of 5" | `app/onboarding/concept.test.tsx` (5), `app/onboarding/order.test.tsx` | COVERED |
| S04 | Onboarding: Four ways | Inert tiles; Next; Skip; "Step 3 of 5" | `app/onboarding/types.test.tsx` (3) | COVERED |
| S05 | Onboarding: Consistency | Sample block labelled EXAMPLE, never real data; legend names only Ideal and Fallback; Next; Skip | `app/onboarding/consistency.test.tsx` (4) | COVERED |
| S06 | Onboarding: Make it yours | Default Forge Orange; swatch select; reminders switch; Next to S07 or S08; persist failure toast | `app/onboarding/personalize.test.tsx` (9) | COVERED |
| S07 | Notification primer | Allow to OS prompt, then S08; Not now to S08; declined is non-blocking | `app/onboarding/notifications-primer.test.tsx` (9) | COVERED |
| S08 | Onboarding: First task | Default; filling enables Save; four silent defaults on save; persist failure keeps text; Save routes to S09 | `app/onboarding/first-task.test.tsx` (10) | COVERED |
| S09 | Today | Populated; blank slate; nothing due right now; whole day off; first-habit banner; re-entry banner; error; chip persist failure; tap targets to S10 to S41; search origin Today | `src/features/today/TodayScreen.test.tsx` (21), `src/features/today/edge.today.test.tsx` (34). Banner copy confirmed at `TodayScreen.test.tsx:342` and `:324`. Whole-day off now reads "Emergency day off" (Round 4 pass 19) | COVERED |
| S10 | Routines browse | Populated with due and other sections; weekday strip re-partitions; no-routines empty state; nothing-due-on-day copy; scheduled tap to S20, as-needed tap to S23; search origin Routines | `src/features/browse/RoutinesBrowseScreen.test.tsx` (11), `edge.browse.test.tsx` (31) | COVERED |
| S11 | Events browse | Today and Upcoming sections; empty with upcoming; no events, "New event" to S17 | `src/features/browse/EventsBrowseScreen.test.tsx` (9), `edge.browse.test.tsx` | COVERED |
| S12 | Courses browse | Active and Past tabs; Past shows "Completed <date>"; no active but past exists; "New course" to S18 | `src/features/browse/CoursesBrowseScreen.test.tsx` (5, incl. 'Past tab: shows "Completed <date>"') | PARTIAL (the "New course" empty button to S18 not confirmed) |
| S13 | To-dos and Notes browse | To-dos and Notes lenses; checkbox toggles in place; empty authored copy; "New to-do or note" to S19 | `src/features/browse/ToDosBrowseScreen.test.tsx` (12) | COVERED |
| S14 | Filter and search | Default; query and chips live; Clear all; no matches; nothing to search; result tap by variant; back to origin | `src/features/search/SearchScreen.test.tsx` (10), `src/edge.spec.search.test.tsx` (NEW, 10: Importance and Necessity) | COVERED (NEW for filters) |
| S15 | Add: pick type | Four rows always enabled; each routes to S16 to S19; dismiss returns | `app/add/index.test.tsx` (6) | COVERED |
| S16 | Create routine | Default; as-needed toggle relabels optional; populated; empty name; no days; missing ideal or fallback; no-empty-run banner; saving; back to S15 | `app/add/routine.test.tsx` (6), `app/add/edge.forms.test.tsx` (21). Banner copy: `src/edge.spec.routineCopy.test.tsx` (NEW, it.failing for the full sentence) | COVERED, with GAP on banner copy (bug B3) |
| S17 | Create event | Default; repeating and one-off examples; empty name; no days; no-empty-run error; "Track with ideal + fallback" toggle; saving; back to S15 or S11 | `app/add/event.test.tsx` (6), `app/add/edge.forms.test.tsx` | PARTIAL ("Track with" toggle hiding steps not confirmed by title) |
| S18 | Create course | Default; Antibiotics and weekly examples; empty name; missing end; no days; missing steps; doses stepper helper; saving | `app/add/course.test.tsx` (6), `app/add/edge.forms.test.tsx` | COVERED (no-empty banner copy: see B3) |
| S19 | Create to-do or note | Default focus; populated; empty name on save; live validation; save persists; back | `app/add/todo.test.tsx` (5) | COVERED |
| S20 | Manage task sheet | Default; loading; empty history; persist failure reverts; heatmap error; close; icon avatar to S21; name, importance and necessity inline; Done or Fallback logs; Skip chip (removed); To do reverts; Log fallback; multi-dose chip; off toggle; duplicate; snooze and move (move removed); sub-step chip toggle; heatmap drill-down; delete to S22 | `app/task/[id]/index.test.tsx` (14), `app/task/[id]/edge.taskPage.test.tsx` (21), `app/task/[id]/delete.test.tsx` (6), `app/task/[id]/icon.test.tsx` (4). Skip: OBSOLETE. Move: removed, asserted absent in `index.test.tsx` | COVERED (Skip OBSOLETE) |
| S21 | Icon and colour | Default; loading; no icons match; select icon and colour enables Save; persist failure toast; Cancel discards | `app/task/[id]/icon.test.tsx` (4, incl. 'Close discards the in-progress selection') | COVERED |
| S22 | Delete confirmation | Default; loading; success; delete failed keeps dialog and retry banner; Keep it returns by origin; scrim equals Keep it | `app/task/[id]/delete.test.tsx` (6), `app/task/[id]/recentlyDeleted.test.tsx` (21) | COVERED (wording changed for Recently deleted, Round 4 pass 22) |
| S23 | As-needed detail | Default; empty history EmptyState; edit mode; loading; persist failure; origin-aware back; Log used it chooser; Edit save and cancel; delete to S22 | `app/task/[id]/as-needed.test.tsx` (5), `app/task/[id]/edge.taskPage.test.tsx` ('as-needed routine: a double tap on Log used it'), `src/edge.spec.asneeded.test.tsx` (NEW: XP zero) | COVERED (edit-mode cancel not confirmed) |
| S24 | Completion celebration | Ideal and fallback variants; reduced motion; Continue and scrim dismiss | `app/task/[id]/celebrate.test.tsx` (5), `src/features/progress/CelebrationHost.test.tsx` (9) | COVERED |
| S25 | Consistency dashboard | Default; loading; no-data empty; error retry; scope tabs; window tabs; task select; aggregate disclosure; Full history to S26; origin-aware back | `app/progress/index.test.tsx` (12), `app/progress/edge.progress.test.tsx` (7) | PARTIAL (window and scope recompute not confirmed by title; disclosure and "Full history" are covered) |
| S26 | All-time trend | Default; loading; empty; error; tap bucket moves readout; empty bucket reads "No data"; "Table" view; scrub slider; back to S25 | `app/progress/trend.test.tsx` (7), `src/edge.spec.progress.test.tsx` (NEW, 6 incl. it.failing for the scrub slider) | GAP (scrub slider missing, bug B2) |
| S27 | Achievements | Default; New user framing; loading; error; All, Earned, Locked tabs; Weekly and Monthly select relabels bar; tap badge opens detail; origin back | `app/achievements/index.test.tsx` (11). Badge detail sheet: the tests check labels and locked captions; the open-and-close sheet is not confirmed by title | PARTIAL |
| S28 | Level-up celebration | Level-up and tenure variants; reduced motion; Nice dismisses to S27 | `app/achievements/celebrate.test.tsx` (3) | COVERED |
| S29 | Cycle records | Default; loading; empty; error; archived card to S30; in-progress strip not tappable; origin back | `app/records/index.test.tsx` (7) | COVERED |
| S30 | Cycle record detail | Default; loading; error; no badges that cycle; read-only, back to S29 | `app/records/[cycleId].test.tsx` (7, incl. 'no badges that cycle shows the neutral copy') | COVERED |
| S31 | Assistant home | Default; loading; error; mic to S32 or S37; suggestion chip sends its text; footer send; back to Today; no data created | `app/assistant/index.test.tsx` (5), `src/features/assistant/__tests__/edge.assistant.test.tsx` | COVERED |
| S32 | Assistant conversation | Loading; listening; text input; active; clarification; offline with Try again; recap on close; mic off to S37; keyboard switch; undo edit; overflow to S36 | `app/assistant/chat.test.tsx` (7, incl. 'offline: "Try again" re-sends', mic-off recovery at line 119); `src/edge.spec.chat.test.tsx` (NEW, 4: recap on close, empty leaves at once, Done paths) | COVERED (NEW for recap) |
| S33 | Clarification modal | Default; re-ask copy; both options tappable; scrim dismiss | `src/features/assistant/__tests__/ClarificationModal.test.tsx` (3) | PARTIAL (spoken answer resolution not confirmed) |
| S34 | Conversation history | Default; loading; empty EmptyState; error; row to S35; back | `app/assistant/history/index.test.tsx` (3) | COVERED (error state not confirmed) |
| S35 | Reopened conversation | Header date and modality; replay; Tasks created list (only touched tasks); loading; error and Retry; metadata error; Send inert when empty; Send into chat with opening; mic continue; back fallback; task card is read-only | `src/edge.spec.s35.test.tsx` (NEW, 11; the read-only card is `it.failing`) | GAP (task card navigates, bug B1). Rest COVERED (NEW) |
| S36 | Options sheet | Six rows; New conversation; History; Voice and language inline; Manage subscription; Account and sync; Help; failed save reverts | `src/features/assistant/__tests__/OptionsSheet.test.tsx` (6) | PARTIAL: the spec says Voice and language expands as an accordion; the app shows it inline and its test asserts "no accordion". No decision found (see B4) |
| S37 | Microphone primer | Primer and recovery contexts; Enable to OS prompt; granted to listening; denied to text input; Type instead; Open Settings re-check on return | `app/assistant/mic-primer.test.tsx` (6) | COVERED |
| S38 | Paywall | Default; store unreachable disables Card A only; loading; Start free trial; BYO; Retry; Restore | `app/assistant/paywall/index.test.tsx` (8), `app/assistant/paywall/edge.paywall.test.tsx` (23) | COVERED |
| S39 | Choose plan and confirm | Annual pre-selected; monthly price; Save 33%; plan switching; verifying; success; biometric cancel calm; store error; loading | `app/assistant/paywall/plan.test.tsx` (5), `src/edge.spec.paywall.test.tsx` (NEW, 4) | COVERED (NEW for prices) |
| S40 | BYO key setup | Default; filled; validating; invalid calm; full success; degraded success; reveal toggle; back changes nothing | `app/assistant/paywall/byo.test.tsx` (6), `src/edge.spec.paywall.test.tsx` (NEW, 2 for reveal) | COVERED (NEW for reveal) |
| S41 | Settings home | Default; loading; stat line error degrades to inline retry; new user "No data yet"; every row navigates | `app/settings/index.test.tsx` (10, incl. 'error: the stat line degrades to an inline retry') | COVERED |
| S42 | Notifications settings | Master on and off; Trigger A (master off, sample); Trigger B (all subs off); digest time picker; persist failure revert; back | `app/settings/notifications.test.tsx` (9) | COVERED |
| S43 | Theme and accent | Default Auto and Forge; live update; persist failure revert; Auto follows OS live; explicit modes override | `app/settings/theme.test.tsx` (10), `src/edge.spec.theme.test.tsx` (NEW, 6) | COVERED (NEW for live OS switch) |
| S44 | Manage subscription | Subscribed, trial, free states; restore toasts; loading; store error banner; Confirm change to S39; manage in store | `app/settings/subscription.test.tsx` (6), `app/assistant/paywall/edge.paywall.test.tsx` | COVERED |
| S45 | Account and sync | Off default; on and healthy; on and failed; loading; toggle persists; toggle off reverts; back | `app/settings/sync.test.tsx` (5) | COVERED |
| S46 | Widgets | Gallery default; selected panel; Fixed task reveals picker; Smart hides it; save toast; persist failure; back | `app/settings/widgets.test.tsx` (11) | COVERED |
| S47 | Data | Default; backup in progress and success toast; restore in progress; restore failure and Try a different file; restore success; erase row always there; back | `app/settings/data/index.test.tsx` (17), `app/settings/edge.settings.test.tsx` | COVERED |
| S48 | Erase confirmation | Default by origin; erasing loading; mid-wipe failure coherent; erase to S01; Cancel by origin; back gesture | `app/settings/data/erase.test.tsx` (8), `src/features/data/EraseDataSheet.test.tsx` (2) | COVERED (origin-aware Cancel for Reset from S50 not confirmed) |
| S49 | Help and about | Link feedback toasts (email, FAQ, App Store, privacy, terms); back | `app/settings/help.test.tsx` (7) | COVERED |
| S50 | Data recovery | Default; retrying loading; returned from cancelled erase; Try again to S01; Reset app data to S48 with origin S50 | `app/recovery.test.tsx` (5), `app/edge.recovery.test.tsx` (6) | COVERED |

### 2d. Cross-cutting

| # | Requirement | Source | Covering tests | Status |
|---|---|---|---|---|
| X1 | Every control has a screen-reader label | S01–S50 (Screen reader lines) | `src/ui/edge.a11y.test.tsx`, `app/task/[id]/edge.taskPage.test.tsx` ('every button on the page has an accessibility label') | COVERED |
| X2 | Copy is clean wording (no em dash in visible text, no shaming) | Brief rule | `src/edge.copy.test.ts` (copy sweep over every `*_COPY` object) | COVERED |
| X3 | Phone-width layout, no horizontal page scroll | Brief / S-series Responsive notes | not testable in Jest | DEVICE |
| X4 | Reduced motion degrades to fades | S01, S24, S28 | not confirmed by title | PARTIAL |

## 3. Obsolete by later decisions (not tested, on purpose)

| Spec text | Replaced by | Where |
|---|---|---|
| F3: Skip as a chip state; F5: a Skip-chipped day is missed at once; S20: Skip chip resolves missed | Skip removed from every log control. Missed happens at day end | Round 4 pass 20, `docs/DESIGN_DECISIONS.md` |
| S09 / S20 "Skip" tap targets and the Skip sheet with its consistency preview | Removed. "Emergency day off" replaces it | Round 4 pass 20 |
| S09 "Mark today off" switch | "Emergency day off", "Nothing due today counts against you." | Round 4 passes 19 and 20 |
| F7 / S20: "Move to another day" action and calendar target picker | Removed. Snooze is one hop | PRD F7 scope narrowing (2026-07-27), kept |
| F7 / S20: "Snooze" wording | "Push to tomorrow", "Undo push", additive push | Round 4 pass 20 and pass 21 |
| F7 snooze undo as "Undo snooze" | "Undo push" in the sheet for the pushed occurrence | Round 4 pass 21 |
| S22: "Delete" permanent | Recently deleted for 30 days; Delete forever; End routine | Round 4 passes 22 and 23 |
| S20: Delete routine copy | Delete sheet says where the item goes, and offers End instead | Round 4 pass 23 |

Open, not obsolete: F7.10 undo reachability (PRD §7, human decision); F17.6 subscription offline (Round 4 pass 25); F20.2 real iCloud or Android sync (architect).

## 4. Bugs and deviations found (for the main session)

Each is pinned by an `it.failing` test or listed here with its evidence. None are fixed; no source file was edited.

| # | Where | Spec says | App does | Severity | Test |
|---|---|---|---|---|---|
| B1 | `app/assistant/history/[id].tsx`, the "Tasks created in this chat" rows (`onPress` pushes `/task/${task.id}`) | ALLSCREENS_1.md S35: a task card is "a read-only reference (no navigation away from S35 defined in the sitemap)". No decision overrides this | Tapping a card opens the task page | Low: a person may like the shortcut, but the spec and the sitemap say otherwise | `src/edge.spec.s35.test.tsx`, `it.failing` "a task card in 'Tasks created' is read-only" |
| B2 | `src/ui/TrendGraph.tsx`, `app/progress/trend.tsx` | ALLSCREENS_1.md S26: "Drag the scrub slider moves the highlighted chart point and updates the readout" | No slider. Tapping a bar moves the readout (works, and the table is a real alternative) | Low to medium: a drag-to-scrub path is missing. Tap-to-select is a reasonable substitute. Human to decide | `src/edge.spec.progress.test.tsx`, `it.failing` "the trend has a scrub slider" |
| B3 | `src/features/task/StepScheduleSection.tsx:39`, `src/features/task/StepListEditor.tsx:56`, `app/add/routine.tsx:140` | ALLSCREENS_1.md S16 error state (and S18 / S17 by reference): "Tuesday has no ideal step due — every step is toggled off. Turn at least one back on for Tuesday, or add a step that runs then." | "Tuesday has no ideal step due." (plus "Turn at least one step back on for Tuesday." on the step editor). The "or add a step that runs then" way out is missing | Low: copy only, the save is still blocked and the day is named | `src/edge.spec.routineCopy.test.tsx`, `it.failing` (full sentence) |
| B4 | `src/features/assistant/OptionsSheet.tsx` | ALLSCREENS_1.md S36: "Voice & language" row toggles an inline accordion, expanded in place | Voice and language choices always show inline. The existing test "default: the voice choices and the language row are shown inline, no accordion" encodes this choice | Note only: no decision in `docs/DESIGN_DECISIONS.md` covers it. Not tested as a failure because the test author chose inline on purpose. Main session to decide and align the spec or the code | none |
| B5 | `src/ui/StateChip.tsx` lines 37 and 39 | Skip removed from every log control (Round 4 pass 20) | `StateChip` still offers Skip as its fourth option. No screen renders `StateChip` today, so no user sees it | Dead code with a stale option. Suggest removing the Skip option, or the component | none |
| B6 | `src/ui/LogControl.tsx:5` comment | "plus a quiet 'Skip today'" | Comment is stale: the control has "Push to tomorrow" and "Emergency day off" | Comment only | none |

## 5. What this round could not test (needs a real phone)

- A full reboot keeping data (F1.3). Uninstalling the app removing all data (F1.6).
- Real home-screen widgets: the Android providers exist (`android/app/src/main/java/com/fallback/app/widgets/`), but no Jest test can place a widget or see it refresh (F21.2).
- The real Face ID or fingerprint sheet, and the real App Store or Play purchase and restore sheets (F17.4).
- The OS notification permission prompt and notification delivery at the set time (F9.3, F14).
- Dynamic Type and TalkBack or VoiceOver speech (F9.5, F6.5 beyond the automated checks).
- Phone-width layout and no horizontal scroll (X3). Smooth scrolling of long lists (F6.6).
- Opening the real mail app, the FAQ, the App Store, or a Settings deep link (S49, S37 recovery).
- Real microphone capture and speech-to-text (F16.1). The code stubs the capture loop, as its own comment says.
- The Android "Settings deep link" from the mic recovery screen (S37).

## 6. New tests (this round)

All in `src/` and `app/`'s tests folder; none change existing files. Run with `--selectProjects app`. 62 tests in 10 files, all passing; 3 of them are `it.failing` (B1, B2, B3).

| File | Tests | What it covers |
|---|---|---|
| `src/edge.spec.s35.test.tsx` | 11 (1 `it.failing`) | S35 reopened conversation: header, replay, touched-task list only, no section when none, read failure and Retry, metadata failure, loading, Send inert then sends with opening, mic continue, back fallback, read-only card (B1) |
| `src/edge.spec.search.test.tsx` | 10 | S14 and F15: Importance and Necessity chips, OR within a group, AND across groups, text plus chip, a to-do with no importance, toggle off, No matches and Clear all, Clear all resets every group |
| `src/edge.spec.paywall.test.tsx` | 6 | S39 prices ($4.99, $39.99 Save 33% against $59.88, $3.33), trial subcopy, Annual pre-selected and Monthly purchase path; S40 reveal control masks and unmasks and Save sends the exact key |
| `src/edge.spec.progress.test.tsx` | 6 (1 `it.failing`) | S26 bucket readout, empty bucket reads "No data", in-progress month never plots, Table view numbers and dashes, readout kept across Table and Chart; scrub slider (B2) |
| `src/edge.spec.theme.test.tsx` | 6 | S43 and F8: Auto follows the OS at boot and live, explicit Light and Dark ignore the OS, unknown OS reads as light, `resolveScheme` unit cases |
| `src/edge.spec.chat.test.tsx` | 4 | S32 close: empty chat leaves at once; chat with a created task shows recap first; Done leaves; Done with nothing to go back to goes to assistant home |
| `src/edge.spec.routines.test.ts` | 8 | F2, F3, F23 edge cases: fallback identical to ideal saves; one-off Event with no cadence saves; repeating course with no days rejected; zero doses rejected; empty due-day list covers nothing; weekend-only step rejected on weekdays; Friday-only step plus Mon-Thu step saves; no ideal steps rejected |
| `src/edge.spec.routineCopy.test.tsx` | 2 (1 `it.failing`) | S16 no-empty banner: names the day and blocks save; full spec sentence (B3) |
| `src/edge.spec.asneeded.test.tsx` | 6 | F27 and F13: 12 uses earn 0 XP; "fallback" marker earns 0; plain use is one reference row; never due, no occurrences; deleted routine refuses a use; a real routine's XP is unchanged by as-needed uses |
| `src/edge.spec.copy.test.ts` | 3 | F5: scans every feature and app source file for "streak", "in a row", "days running"; guard against an empty scan |

Note for the main session: `src/edge.spec.asneeded.test.tsx` prints React "not wrapped in act(...)" warnings from the mutation hook's cache invalidation. The assertions are unaffected. The same warning pattern is in the existing `src/queries/edge.logging.test.tsx` helpers.

## 7. Shared files touched

None. No source file, no existing test, no `design-input/`, no `docs/`, no config.

## 8. What I read and found fine

- `docs/EDGE-BRIEF.md` (review/EDGE-BRIEF.md, all rounds), `review/haiku/BRIEF.md`
- `docs/PRD.md` sections 3 to 3B (F1–F31 acceptance and edge bullets) and the PRD's §7 open decisions list
- `docs/DESIGN_DECISIONS.md` Round 4 passes 19 to 25 and "Still open with the human"
- `design-input/fallback-handoff/uploads/ALLSCREENS_1.md`, states and interactions of S01–S50 (read only)
- Source read for the gap checks: `app/assistant/history/[id].tsx`, `src/features/search/SearchScreen.tsx`, `src/ui/TrendGraph.tsx`, `app/progress/trend.tsx`, `app/assistant/paywall/byo.tsx`, `app/assistant/paywall/plan.tsx`, `src/features/assistant/copy.ts` (S39, S40, S44 copy), `app/assistant/chat.tsx`, `src/theme/index.ts`, `app/_layout.tsx`, `src/domain/validation.ts`, `src/domain/achievements.ts`, `src/queries/mutations.ts` (`useLogAsNeededUse`), `src/queries/testSupport/fakeRepos.ts`, `src/ui/StateChip.tsx`, `src/ui/LogControl.tsx`, `app/add/routine.tsx`, `src/features/task/StepScheduleSection.tsx`, `src/features/task/StepListEditor.tsx`
- Test titles: all 2,223 `it`/`describe` lines were indexed and grepped per requirement. Full files read: the six test harnesses copied for the new tests.

## 9. Not done or unsure

- The table is grouped by screen for S01–S50, not one row per sub-bullet. Where I could not confirm a sub-state by title, the row says PARTIAL rather than guessing. Those PARTIAL rows are the next place to look if the human wants every bullet pinned.
- I did not run the whole suite (the brief says not to; other agents share the machine). My new files all pass together (62 tests, 10 files).
- Several "COVERED" rows cite a file whose title list I read but not the test body. Where the body could decide the question, I marked it PARTIAL.
- B4 (Voice and language accordion vs inline) needs a human call; I did not change the test or the code.
- B2 (scrub slider) needs a human call: tap-to-select on the bars may be the intended design.
- Nothing in the app was fixed this round, by brief rule (source files are owned by other areas).
