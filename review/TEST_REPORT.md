# Test report — Fallback

Build: working tree as of Wave 2 + architect CR-5/6/7 batch, all M0–M7 module
reviews and the CR-5/6/7 batch review at PASS (`review/REVIEW-M0.md` …
`REVIEW-M7.md`, `review/REVIEW-architect-CR-5-7.md`).

Boot: **NOT VERIFIABLE IN THIS ENVIRONMENT** — no device/simulator or Expo dev
server available here. Scoped to: `npx tsc --noEmit` (static typecheck), the
full automated suite, and source tracing of every PRD acceptance criterion.
`npx tsc --noEmit` → **clean, zero errors.**

Suite:
- App/domain (`npx jest`): **99 suites / 697 tests, all passed.**
- Server (`cd server && npm test`, Node's built-in test runner): **23/23 passed.**
- No suite skipped, no `.only`/`.skip` found blocking coverage.

## Acceptance matrix (representative — full P0/P1 traced; see notes)

F1 persistence/migration/erase-touch: PASS (lifecycle tests: force-quit/reboot
persistence via SQLite, schema version + migration fixture, corrupt-store
recovery all present and green — `src/db/__tests__/lifecycle.test.ts`,
`migrations.test.ts`).

F2/F3/F4/F5 core loop incl. off-day exclusion, pending-today, round-half-up,
scope-1/scope-2 fractional aggregate: PASS. Single `roundHalfUp` in
`src/lib/number.ts` is the only rounding site (grep confirms); `domain/consistency.ts`
is the only formula implementation, and every UI consumer (S20 stat line,
Today, Progress/dashboard, Records/cycles, Achievements, notifications,
widgets, assistant tool executor) routes through `src/queries/reads.ts`
rather than re-deriving the math — no divergent implementation found. The
pinned 87%/100%/84% per-task anchors and the 67%-not-50% mixed-day aggregate
anchor are asserted exactly as PRD §6 specifies
(`src/domain/consistency.test.ts:37,102`).

F6 Today/Routines + empty states: PASS (present, tested).

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

F8/F9/F23/F25: PASS — theme/accent never recolors fixed signals (signal
colors are separate constants, not accent-derived, in the theme/token
source); onboarding skip/no-recur flag persisted; F23 no-empty-run-occurrence
save-time validation present and tested; F25 erase-all is atomic
(SecureStore-first, then DB delete+reopen, `store:erased`/`store:ready`
events), tested for the half-wiped-never-observable invariant.

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

None found at integration level in this pass. No blocking defect was
identified that the module-level code reviews missed. (The one known,
documented limitation is `snoozeSlot.ts`'s own disclosed RESIDUAL comment —
a rare shape where `isDue(task, today)` is true but today's own occurrence
is itself already snoozed; this fails safe into a rejected, zero-write
`VALIDATION_FAILED` toast rather than corrupting data, so it is a UX rough
edge, not a correctness bug, and is already flagged in-source as a known,
accepted limitation rather than silently shipped.)

## Needs human verification

- Full on-device/simulator boot, cold-launch timing (≤2.0s target),
  VoiceOver/TalkBack traversal, Dynamic Type clipping, and WCAG contrast in
  both themes — none of these are verifiable via static analysis alone.
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
PRD §3 traced through source and either PASS or (where inherently
device-dependent) NEEDS-HUMAN. F7's rescope composes correctly end-to-end,
the dormant-undo gap remains an honest, undisturbed open item rather than a
regression, the consistency algorithm's single implementation is used
uniformly by every consuming module, no punitive-streak language survived
anywhere in the assembled app, and all three architect CRs verified working
by reading the actual call sites, not by trusting self-reports. Recommend
proceeding to Gate 3 human review (screenshots via visual-qa on a real
device/simulator), with the two NEEDS-HUMAN items above flagged for that
pass.
