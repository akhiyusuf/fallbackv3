# Test report — Fallback

Build: working tree as of Wave 2 + architect CR-5/6/7 batch, all M0–M7 module
reviews and the CR-5/6/7 batch review at PASS (`review/REVIEW-M0.md` …
`REVIEW-M7.md`, `review/REVIEW-architect-CR-5-7.md`).

Boot: **NOT VERIFIABLE IN THIS ENVIRONMENT** — no device/simulator or Expo dev
server available here. Scoped to: `npx tsc --noEmit` (static typecheck), the
full automated suite, and source tracing of every PRD acceptance criterion.
`npx tsc --noEmit` → **clean, zero errors.**

Suite:
- App/domain (`npx jest`): **99 suites / 697 tests, all passed.** Jest prints
  "A worker process has failed to exit gracefully" at the end of the run — a
  repo-wide teardown leak (already noted in `REVIEW-M6` pass-2), not a test
  failure; all 697 tests report pass before that warning.
- Server (`cd server && npm test`, Node's built-in test runner): **23/23 passed.**
- No suite skipped, no `.only`/`.skip`/`xit`/`xdescribe` found blocking coverage.

## Acceptance matrix (full P0/P1 traced; see Needs-human for device-only items)

F1 persistence/migration/erase-touch: PASS (lifecycle tests: force-quit/reboot
persistence via SQLite, schema version + migration fixture, corrupt-store
recovery all present and green — `src/db/__tests__/lifecycle.test.ts`,
`migrations.test.ts`). "Deleting the app removes all app data" (device-uninstall
half) is device-only — NEEDS-HUMAN, listed below.

F1 / cross-cutting zero-network + zero-analytics (PRD §3.1 bullet 3, §3
cross-cutting constraints, §5 ship-blocking privacy): PASS (static). Grepped
every `fetch(` call in `src/**`: all instances are confined to
`src/services/ai/byoProvider.ts`, `src/services/ai/byoProbe.ts`, and
`src/services/ai/managedProvider.ts` — i.e. only F16/F18's assistant paths,
which PRD §5 explicitly exempts from the zero-network posture. No P0/P1
module outside `src/services/ai/**` makes a network call; no analytics SDK,
telemetry call, or tracking key appears anywhere in `src/`/`app/`. The
runtime-proxy-observation half (confirming nothing actually leaves the device
at the OS/network level on a real build) is device-bound — NEEDS-HUMAN,
listed below.

F2/F3/F4/F5 core loop incl. off-day exclusion, pending-today, round-half-up,
scope-1/scope-2 fractional aggregate: PASS. For consistency-percentage
computation specifically, `roundHalfUp`/`toPercent` in `src/lib/number.ts`,
consumed exclusively by `src/domain/consistency.ts`, is the only
implementation — no divergent consistency formula exists anywhere in the app.
**Correction from review pass 1:** `roundHalfUp` is not the only `Math.round`
call site in the app overall — two inline `Math.round` sites exist outside
the consistency domain: `src/services/widgets/snapshot.ts:92` rounds the
widget's today-progress percentage (`doneCount/totalDue`, a today-completion
ratio, not a PRD-defined consistency %), and
`src/features/browse/CoursesBrowseScreen.tsx:99` rounds the S12 course
progress-ring percentage (`elapsedDays/totalDays`, a calendar-elapsed ratio,
not a consistency %). Neither touches a PRD §3.5/§6 consistency metric, so no
consistency anchor or test result is affected. However, `src/lib/number.ts`'s
own header comment claims to be "the ONE rounding function every percentage
in this app passes through," which is broader than ARCHITECTURE §6.5 (scoped
to the consistency algorithm) actually pins — under that broader wording
both inline sites are a minor, undispositioned deviation from the comment's
own contract. Flagging as a minor finding for the architect/M-owner, not a
blocking defect (see Bugs).

The actual consumers of the consistency metric — verified by grep for
`useConsistency`/`perTaskConsistency`/`aggregateConsistency` call sites, not
assumed — are: `src/features/today/TodayScreen.tsx` (Today), `app/task/[id]/index.tsx`
(S20 stat line + heatmap) and `app/task/[id]/celebrate.tsx`, `app/progress/index.tsx`
(Progress/dashboard), and `app/settings/index.tsx` (Records/cycles), plus
cycle-record archival via `aggregateConsistency` at `src/queries/mutations.ts:121`
— all routed through `src/queries/reads.ts`/`@/domain` rather than
re-deriving the math. **Correction from review pass 1:** the prior draft of
this report also listed Achievements, notifications, widgets, and the
assistant tool executor as consumers of this metric; grep confirms none of
`src/services/notifications/**`, `app/achievements/**`,
`src/services/widgets/**`, or `src/features/assistant/toolExecutor.ts`
reference consistency or a consistency percentage at all — they display no
consistency % and were wrongly included. The pinned 87%/100%/84% per-task
anchors and the 67%-not-50% mixed-day aggregate anchor are asserted exactly
as PRD §6 specifies (`src/domain/consistency.test.ts:37,102`).

F6 Today/Routines + empty states: PASS, with citations. Today: due-task rows
with meta line + chip state (`src/features/today/TodayScreen.test.tsx:132`
"populated: renders a due task row with its meta line and current chip
state"), both empty states distinguished — "no tasks exist anywhere" vs.
"nothing due today" (`TodayScreen.test.tsx:96,105`). Toggle-Routines showing
only that occurrence's due sub-steps: `src/domain/occurrence.test.ts:141`
("Friday additionally requires the Friday-only step"), matching PRD §3.10/F23's
Studying-routine fixture. Routines browse: populated Due/Other partitioning,
as-needed vs. scheduled routing, and the F6 empty state
(`src/features/browse/RoutinesBrowseScreen.test.tsx:54` "empty — no routines
at all: renders the F6 empty state", plus `:67,80,114`).

F7 snooze rescope (traced end-to-end):
- Two-slot action row ("Duplicate" + one snooze slot), no third slot, no date
  picker anywhere in S20: PASS — confirmed directly in
  `app/task/[id]/index.tsx` action row markup (single conditional slot,
  `resolveSnoozeSlot` gates its content) and in `snoozeSlot.test.ts`.
- Exactly-one-hop, target computed never chosen: PASS — `useSnoozeOccurrence`
  takes no target-date parameter; `mutations.ts` relocates D→D+1 only.
- Already-snoozed cannot be re-snoozed: PASS —
  `VALIDATION_FAILED: "This occurrence is already snoozed."` guard in
  `mutations.ts:649`, routed through `resolveWriteTarget`/`designateCarrier`
  per SCHEMA §4.2 (fixed in F7-implementation review pass 1, re-verified
  present in current source).
- `snoozable` editable post-creation via the sheet's inline-edit pattern,
  takes effect immediately, re-renders the slot without leaving the sheet:
  PASS — `task.snoozable` flows into `resolveSnoozeSlot`, toggle mutation is
  the ordinary task-edit path.
- ONE LIVE OUTCOME PER TASK PER DATE (3-case precedence): PASS at the domain
  level (`designateCarrier`/`resolveWriteTarget`, exercised by the P8 harness
  and F7-implementation's fixture set) and consistent with the S20 read side
  (`snoozeSlot.ts`'s documented derivation from the same carrier logic).
- Heatmap drill-down carries no snooze/undo control: PASS — `DayLogPopover`
  in `app/task/[id]/index.tsx` renders only a `StateChip`, nothing else;
  code comment explicitly notes "No snooze controls here."
- **The §7 open gap — no UI reaches "Undo snooze" for a dormant (case
  1/2) occurrence — is still exactly that: an honest, disclosed gap, not
  silently closed.** Traced every place a snoozed-and-now-dormant occurrence
  could conceivably be reached: (a) S20's action row only evaluates
  today's/yesterday's occurrence relative to the *currently open* task's
  sheet — a dormant visitor whose target date itself resolves its own state
  is never the card shown; (b) the heatmap popover only offers a `StateChip`
  on the tapped date's own resolved state, never a "restore visitor" control;
  (c) no other task-centric surface (S10–S14 browse rows, per PRD §7's own
  audit) exposes per-occurrence undo. This matches the PRD's own §7
  disclosure precisely — confirmed as still-open, not reintroduced and not
  quietly patched elsewhere.
- No punitive/streak language anywhere: confirmed by sweep below.

F8/F25: PASS — theme/accent never recolors fixed signals (signal colors are
separate constants, not accent-derived, in the theme/token source); F25
erase-all is atomic (SecureStore-first, then DB delete+reopen,
`store:erased`/`store:ready` events), tested for the half-wiped-never-observable
invariant.

F23: PASS — no-empty-run-occurrence save-time validation present and tested;
per-occurrence sub-step subset-of-parent behavior traced above (F6 entry) and
in `src/domain/occurrence.test.ts`.

F9 (PRD §3.9), each acceptance bullet dispositioned individually:
- Ideal/fallback + "no streaks" premise explained in a few screens: PASS —
  `app/onboarding/concept.test.tsx:16` "renders the ideal/fallback worked
  example and the privacy promise verbatim"; `src/features/onboarding/ConceptScreen.tsx`
  renders the worked ideal/fallback example plus an explicit privacy row.
- No-account / on-device-privacy promise stated plainly: PASS — same
  citation; `ConceptScreen.tsx`'s `privacyRow` renders `S03_COPY.privacy`
  with an accessibility label carrying the same text.
- OS permission primed with a rationale before the system prompt: PASS —
  `src/features/onboarding/NotificationsPrimerScreen.tsx` (S07) renders the
  rationale + a sample-notification preview and only calls
  `notifications.requestPermission()` (the actual OS prompt) when the user
  taps "Allow" on this screen, never on mount; test:
  `app/onboarding/notifications-primer.test.tsx:35` "'Allow' primes the OS
  system prompt then proceeds to S08 regardless of outcome".
- App fully usable if declined: PASS —
  `app/onboarding/notifications-primer.test.tsx:45` "'Not now' declines
  without ever calling the OS prompt, and still proceeds to S08 (F9 — fully
  usable if declined)"; `handleAllow` in the same screen also proceeds
  identically regardless of the OS result (`result.ok && result.value` only
  gates whether reminders are rescheduled, never the navigation).
- Onboarding skippable, does not recur after completion (persisted flag):
  PASS — `app/onboarding/hook.test.tsx:53` "'Skip' persists
  onboardingCompletedAt and routes straight to Today"; resume-past-completion
  guard tested at `hook.test.tsx:64`.
- Fully accessible (VoiceOver/TalkBack, Dynamic Type): NEEDS-HUMAN — not
  verifiable via static analysis/jest; listed below.

P1 items (F11–F31) traced structurally: XP eligibility keyed on due
occurrence (not cadence) with as-needed routines earning zero of either XP
kind, tenure badges calendar-elapsed only, Cycling XP archive-before-zero,
F28/F30 reusing F5's exact fractional formula — all present in
`src/domain/{xp,achievements,cycles,consistency}.ts` and covered by green
tests (`xp.test.ts`, `achievements.test.ts`, `cycles.test.ts`).

**No punitive streaks anywhere (sweep).** `grep -rn streak` across
`src/`/`app/` (excluding tests/comments/negations) returns zero user-facing
hits; the two remaining hits are the tests that *assert* the word never
renders (`src/domain/achievements.test.ts:40`, `app/achievements/celebrate.test.tsx:55`).
No "StreakBadge" component name leaks a break/reset — grep for
reset/zero/break near XP/tenure/Cycling-XP code shows only the F31
cycle-boundary reset (explicitly non-punitive: archive-before-zero, never
touches lifetime XP/tenure).

**Cross-module contracts (architect CR-5/6/7), traced in running code, not
just claimed:**
- CR-5 (notifications + widgets arm on first boot without visiting
  Settings): PASS — `app/_layout.tsx`'s `AppShell` calls
  `initNotificationsBridge()` / `initWidgetsBridge()` unconditionally in a
  root-level `useEffect`, independent of whether the user ever opens an M7
  settings screen; both bridges are idempotent (`bridgeInitialized` guard),
  so this composes safely with M7's own per-screen init calls.
- CR-6 (voice/language S36 settings survive restart): PASS — `useVoiceLanguagePrefs`
  reads/writes exclusively via `useSettings()`/`useUpdateSettings()` (the
  DB-backed `settings` singleton, migration 4 columns
  `assistant_language`/`assistant_voice`); no module-local/in-memory state
  remains in the current source.
- CR-7 (erase-all clears every BYO SecureStore key): PASS — `SECURE_STORE_KEYS`
  in `src/db/lifecycle.ts` lists exactly the four keys
  (`byo.baseUrl`, `byo.apiKey`, `byo.supportsTranscription`, `byo.model`),
  which match `secureKeyStore.ts`'s actual key set one-for-one (verified by
  direct comparison, not by trusting the comment) — no fifth key was added
  to `secureKeyStore.ts` since CR-7 without a matching update to
  `SECURE_STORE_KEYS`.

## Bugs

None found at integration level in this pass that blocks Gate 3. Two items
worth the human's attention, neither correctness-affecting:

1. (Minor, non-blocking) `src/lib/number.ts`'s header comment claims to be
   "the ONE rounding function every percentage in this app passes through,"
   but `src/services/widgets/snapshot.ts:92` and
   `src/features/browse/CoursesBrowseScreen.tsx:99` each inline `Math.round`
   for a display percentage (today-progress ratio and course-elapsed ratio,
   respectively — neither is a PRD §3.5/§6 consistency metric, so no
   consistency anchor is affected and ARCHITECTURE §6.5, which pins rounding
   for the consistency algorithm specifically, is not violated). Flagging as
   a small drift from the source comment's own stated contract, owner:
   architect/M-owner to either widen `roundHalfUp` to these two sites or
   narrow the comment's claim.
2. The one known, documented limitation is `snoozeSlot.ts`'s own disclosed
   RESIDUAL comment — a rare shape where `isDue(task, today)` is true but
   today's own occurrence is itself already snoozed; this fails safe into a
   rejected, zero-write `VALIDATION_FAILED` toast rather than corrupting
   data, so it is a UX rough edge, not a correctness bug, and is already
   flagged in-source as a known, accepted limitation rather than silently
   shipped.

## Needs human verification

- Full on-device/simulator boot, cold-launch timing (≤2.0s target),
  VoiceOver/TalkBack traversal, Dynamic Type clipping, and WCAG contrast in
  both themes — none of these are verifiable via static analysis alone
  (covers F9's accessibility bullet).
- F1: confirm that deleting/uninstalling the app actually removes all
  on-device data (SQLite file + SecureStore keys) — device-only, cannot be
  exercised in this environment.
- Cross-cutting zero-network/zero-analytics: the static half is verified
  PASS above (all `fetch(` confined to `src/services/ai/**`); the runtime
  proxy-observation half — confirming no traffic actually leaves the device
  on a real build outside those assistant paths — needs a device/proxy
  capture, not exercisable here.
- Visual review of the disabled-snooze and "Undo snooze" renderings (no
  Gate-2 mockup exists for either — PRD §7 flags this as an open design
  surface) — needs visual-qa / human once a build is running.
- The §7 dormant-undo-reachability gap itself is a genuine **open product
  decision**, not a bug: confirmed present and undisturbed. Recommend this
  reach the human for a designer decision before ship, per PRD §7's own
  routing.
- Store billing (F17), device biometric prompts, and the AI assistant's live
  network paths (F16) require a device/store sandbox, not exercisable here.

## Overall verdict

**PASS with no blocking integration defects found.** Full suite green
(99/697 app + 23/23 server), `tsc` clean, every P0 acceptance criterion in
PRD §3 traced through source and given an explicit PASS-with-citation or
NEEDS-HUMAN disposition — none left unmentioned. F7's rescope composes
correctly end-to-end, the dormant-undo gap remains an honest, undisturbed
open item rather than a regression, the consistency algorithm has exactly
one implementation (`src/lib/number.ts` + `src/domain/consistency.ts`) used
uniformly by its actual consumers (Today, S20, Progress/dashboard,
Records/cycles), no punitive-streak language survived anywhere in the
assembled app, and all three architect CRs verified working by reading the
actual call sites, not by trusting self-reports. One minor, non-blocking
drift is flagged in Bugs (two inline `Math.round` display percentages
outside the consistency domain vs. a broader claim in `number.ts`'s own
comment). Recommend proceeding to Gate 3 human review (screenshots via
visual-qa on a real device/simulator), with the NEEDS-HUMAN items above
flagged for that pass.
