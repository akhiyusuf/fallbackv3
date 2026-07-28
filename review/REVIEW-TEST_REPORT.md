# Review — TEST_REPORT.md (pass 1)
VERDICT: CHANGES_REQUIRED

Reviewed against: `docs/PRD.md` (full read, §1–§7 + Decisions appendix) per
CLAUDE.md's contract ("TEST_REPORT.md against PRD.md's acceptance criteria"),
with independent source spot-checks of every load-bearing claim (see Verified).

**Headline: the PASS verdict is substantively RIGHT — every load-bearing claim I
re-verified independently (F7 end-to-end, the streak sweep, the consistency
anchors, all three architect CRs, the exact suite counts) checks out, and the
NEEDS-HUMAN discipline is applied honestly. What fails this pass is the report's
own accuracy: it contains one demonstrably false "grep confirms" statement, one
evidence list inflated with surfaces that don't consume the metric at all, and a
few P0 criteria left with no explicit disposition. A Gate-3-facing verification
report cannot carry claims a one-line grep disproves. All three fixes are edits
to the report, not to the app.**

## Blocking items

### B1 — "Single `roundHalfUp` … is the only rounding site (grep confirms)" is false as written
`review/TEST_REPORT.md:26-27`. The exact grep the report claims to have run
disproves the claim: `src/services/widgets/snapshot.ts:92` computes a
user-facing percentage with inline `Math.round` (`percent: totalDue > 0 ?
Math.round((doneCount / totalDue) * 100) : null`), and
`src/features/browse/CoursesBrowseScreen.tsx:99` does the same for the S12
course-progress ring (`Math.round(Math.min(1, elapsedDays / totalDays) * 100)`).
(Also `app/settings/sync.tsx:113,117` — minutes/hours, not percentages, fine.)
Neither is an F5 consistency % — so the PRD §3.5 pinned-rounding criterion
itself is not violated on any consistency surface, and no test-suite result
changes — but `src/lib/number.ts:2-4`'s own contract ("The ONE rounding function
every percentage in this app passes through. Pinned in docs/ARCHITECTURE.md
§6.5 … do not inline `Math.round`") makes both sites candidate contract
deviations that the report's claimed sweep had to surface and disposition,
not paper over with "the only rounding site."
**Fix:** restate the claim truthfully — scope it to consistency-% computation
(where it is true: `roundHalfUp`/`toPercent` via `src/domain/consistency.ts` is
the only implementation) — and explicitly disposition the two inline-`Math.round`
percentage sites: either as a filed defect, or as a justified, named exception
(non-consistency metrics, behaviorally equivalent rounding for non-negative
values) flagged for the architect. "Bugs: None found" (`TEST_REPORT.md:120`)
must not stand alongside two undispositioned deviations from a pinned
ARCHITECTURE rule the report claims to have swept for.
**Acceptance test:** re-running `grep -rn "Math.round" src/ app/` yields no hit
that the revised report does not either scope out by its restated claim or
explicitly disposition by file:line.

### B2 — The uniform-consumption list names surfaces that do not consume the metric
`review/TEST_REPORT.md:27-31`: "every UI consumer (S20 stat line, Today,
Progress/dashboard, Records/cycles, Achievements, notifications, widgets,
assistant tool executor) routes through `src/queries/reads.ts`". Independently
grepped: `src/services/notifications/**`, `app/achievements/**`, and
`src/features/assistant/toolExecutor.ts` contain **zero** references to
consistency or any percent — they are not consumers of this metric at all. The
widgets don't consume it either, and the one percent the widget snapshot *does*
display is the inline-`Math.round` today-progress number from B1 — which does
**not** route through `reads.ts`. So for four of the eight listed surfaces the
sentence is wrong in one direction or the other. The underlying conclusion —
no divergent consistency implementation exists — is correct (the real consumer
set is `TodayScreen.tsx`, `app/task/[id]/index.tsx` (S20 stat line + heatmap),
`app/progress/index.tsx`, `app/settings/index.tsx`, `app/task/[id]/celebrate.tsx`
via `useConsistency`, plus cycle-record archival via `aggregateConsistency` at
`src/queries/mutations.ts:121` — all through `reads.ts`/`@/domain`), but a
verification report may not claim to have traced call sites it did not trace.
**Fix:** replace the list with the surfaces that actually consume the metric
(with the citations above), and state plainly that notifications, achievements,
widgets, and the assistant tool executor display no consistency % (which is
itself a useful verified fact — nothing to diverge).
**Acceptance test:** every surface named as a consumer in the revised sentence
has a greppable `useConsistency`/`perTaskConsistency`/`aggregateConsistency`
call site; no named surface has none.

### B3 — P0 criteria silently skipped instead of explicitly dispositioned
The overall verdict (`TEST_REPORT.md:148-149`) claims "every P0 acceptance
criterion in PRD §3 traced through source and either PASS or (where inherently
device-dependent) NEEDS-HUMAN." Three places fall short of that standard:
1. **F1 / cross-cutting zero-network + zero-analytics** (PRD §3.1 bullet 3, §3
   cross-cutting constraints, §5 ship-blocking privacy): the report neither
   claims it nor marks it NEEDS-HUMAN. It is statically verifiable and in fact
   holds — I grepped: every `fetch(` in `src/**` lives in `src/services/ai/**`
   (F16/F18, the §5-exempted network features); zero network calls, analytics
   keys, or telemetry in any P0 module. The proxy-observation half is
   device-bound → NEEDS-HUMAN. Say both halves explicitly.
2. **F6** (`TEST_REPORT.md:35`): "PASS (present, tested)" cites nothing, against
   the report's own evidence standard everywhere else. Name the tests/screens
   covering: Today lists due tasks with chips, toggle-routines show only
   due-that-day steps, Routines browse, and the defined empty states.
3. **F9** (`TEST_REPORT.md:75-76`): only "skip/no-recur flag persisted" is
   claimed. The remaining F9 criteria (premise + privacy copy present,
   permission primed with rationale before the system prompt, app fully usable
   if declined) are statically traceable — trace them or mark them NEEDS-HUMAN;
   don't leave them unmentioned. (F1's "deleting the app removes all app data"
   is device-only — add it to the NEEDS-HUMAN list too.)
**Acceptance test:** every acceptance bullet in PRD §3.1–§3.11 maps to an
explicit PASS-with-citation or NEEDS-HUMAN line in the revised report; a reader
can find each §3 bullet's disposition without inferring it.

## Non-blocking notes
1. The full-suite jest run prints "A worker process has failed to exit
   gracefully…" (repo-wide teardown leak, already noted in REVIEW-M6 pass-2
   note 6). All 697 tests pass; worth one honest line in the report's suite
   section so the human isn't surprised by it at Gate 3.
2. `TEST_REPORT.md:17` labels the matrix "representative" while line 148 claims
   exhaustive tracing — after B3 lands, drop "representative" or reconcile the
   two framings.
3. The Bugs-section disclosure of `snoozeSlot.ts`'s RESIDUAL (lines 122-127) is
   accurate and honest — confirmed against the source comment
   (`snoozeSlot.ts:38-49`) and the fail-safe guard it relies on. Good practice;
   keep it.

## Verified (what I checked and against what)

All against `docs/PRD.md` (read in full, both pages) + direct source reads —
not against the report's own citations alone.

- **F7 end-to-end (PRD §3.7, §4 non-goals, Decisions item 21):**
  `src/queries/mutations.ts:627-685` — `snoozeOccurrence` takes `{taskId, date}`
  only, target `addDays(date, 1)` computed at line 656, never chosen; all three
  W-1s rejections present, routed through `resolveWriteTarget`/`designateCarrier`;
  the already-snoozed guard is exactly `VALIDATION_FAILED: 'This occurrence is
  already snoozed.'` at line 649 as cited. `undoSnooze` (694-715) rejects only
  on no-pointer and ignores `snoozable` (matching §3.7's turning-off-doesn't-
  retract edge). `app/task/[id]/index.tsx:471-519` — action row is exactly
  Duplicate + one conditional slot (Undo snooze | Snooze); no third action, no
  date picker; `Snoozable` switch at line 433 uses the ordinary
  `useUpdateTask` patch path and feeds `task.snoozable` straight into
  `resolveSnoozeSlot` (line 207) → immediate re-render without leaving the
  sheet. `DayLogPopover` (537+) routes writes through `useLogState` only — no
  snooze/undo control in the heatmap drill-down.
- **§7 dormant-undo gap still genuinely open:** `src/features/task/snoozeSlot.ts:76`
  renders `undo` only when `sourceVacatedYesterday && !isDueToday` — i.e. only
  when the visitor itself displays (precedence case 3). `useUndoSnooze`'s sole
  UI call site is that S20 slot (grep: only `app/task/[id]/index.tsx` +
  tests). No browse surface or popover exposes per-occurrence undo. The gap is
  neither silently closed nor reintroduced — matches PRD §7 exactly.
- **Streak sweep:** `grep -rin streak` over `src/**` + `app/**` returns exactly
  the two test-negation sites the report cites
  (`src/domain/achievements.test.ts:40-42`,
  `app/achievements/celebrate.test.tsx:55-59`) and nothing else — no
  "StreakBadge" identifier anywhere in code.
- **Consistency anchors (PRD §3.5/§6):** `src/domain/consistency.test.ts` —
  100% (26/26, lines 25-35), 87% at line 37 as cited, 84%/84% Flow-5 (50-62),
  round-half-up 1/8→13% (64-70), pending-today (72-78),
  `numerator = denominator − missed` (80-84), no-data-never-0% (86-98), and the
  scope-2 67%-not-50% anchor at line 102 as cited, plus 1-done+1-pending→1.0
  and per-task off-ness → f=1/1. `src/lib/number.ts` is the single
  consistency-rounding implementation, consumed by `src/domain/consistency.ts`.
- **Architect CRs from call sites:** CR-5 — `app/_layout.tsx:68-71` calls both
  bridge inits in a root `useEffect`, comment documents idempotence. CR-6 —
  `src/features/assistant/voiceLanguagePrefs.ts:13,29-30` reads/writes via
  `useSettings`/`useUpdateSettings`; migration 4 adds
  `assistant_language`/`assistant_voice`
  (`src/db/migrations/004_assistant_voice_language.ts:26-29`, schema.sql:27-28).
  CR-7 — `src/db/lifecycle.ts:33`'s four `SECURE_STORE_KEYS` match
  `src/services/ai/secureKeyStore.ts:24-27`'s four key constants one-for-one;
  `lifecycle.test.ts:100` pins it.
- **Suites re-run myself:** `npx tsc --noEmit` → exit 0. `npx jest` → **99
  suites / 697 tests, all pass** (worker-teardown warning noted above).
  `cd server && npm test` → **23/23 pass**. No `.only`/`.skip`/`xit`/
  `xdescribe` anywhere in `src/`, `app/`, `server/`. All three counts match the
  report exactly.
- **NEEDS-HUMAN discipline:** the report makes no visual, timing, contrast,
  screen-reader, on-device-boot, store-billing, or live-network claim anywhere
  in its PASS lines; all such items appear only in the Needs-human section.
  Applied consistently (modulo the B3 additions).
- **Environment claims:** "Build: working tree as of Wave 2 + CR-5/6/7" and the
  module-review PASS trail cross-checked against `docs/STATE.md`'s "Wave-2
  review outcome" section and the `review/REVIEW-M*.md` files present.

Route back to qa-tester: B1–B3 are report edits (restate, cite, disposition) —
no application code changes are requested by this review.

---

# Review — TEST_REPORT.md (pass 2)
VERDICT: PASS

Scope: verification of commit `f86ed79` ("Fix TEST_REPORT.md accuracy issues
from review pass 1") against pass-1 blocking items B1–B3. The commit touches
only `review/TEST_REPORT.md` (150 insertions / 40 deletions, no other file) —
contract clean, and correctly a report-only fix.

## Blocking items
None.

## Non-blocking notes
1. `TEST_REPORT.md` (F2–F5 correction paragraph): "two inline `Math.round`
   sites exist outside the consistency domain" reads as an exhaustive count,
   but `app/settings/sync.tsx:113,117` also `Math.round` outside the
   consistency domain (minutes/hours duration formatting — not percentages,
   so outside both the restated claim and `number.ts`'s "every percentage"
   comment; nothing unaccounted for that matters). "Two inline percentage
   sites" would have been exact. Not worth a bounce.
2. F9 no-recur bullet cites "resume-past-completion guard tested at
   `hook.test.tsx:64`" — the test there is the resume-MID-onboarding redirect
   (saved progress pointer past S02), not past-completion. The actual no-recur
   gate is `app/splash.tsx:51` (`onboardingCompletedAt` → skip onboarding),
   tested at `app/splash.test.tsx:29`. The PRD bullet is genuinely satisfied
   and tested — only the citation label is imprecise. Not worth a bounce.

## Verified (each pass-1 fix re-checked independently against source)

- **B1 (rounding claim) — FIXED.** The claim is now scoped to
  consistency-percentage computation, where it is true. Re-ran the full
  `Math.round` grep over `src/`+`app/`: hits are exactly
  `src/services/widgets/snapshot.ts:92`, `src/features/browse/CoursesBrowseScreen.tsx:99`,
  `app/settings/sync.tsx:113,117`, and the `number.ts:4` comment. Read both
  dispositioned call sites myself: snapshot.ts:92 rounds
  `doneCount/totalDue` (widget today-completion ratio over chip states —
  not a PRD §3.5/§6 consistency metric); CoursesBrowseScreen.tsx:99 rounds
  `elapsedDays/totalDays` (calendar-elapsed course ratio — likewise not a
  consistency %). The report's characterization of both is accurate.
  Confirmed ARCHITECTURE §6.5 sits inside §6 (the consistency algorithm) so
  "§6.5 … is not violated" is a fair reading, while `number.ts:2-4`'s broader
  comment is the thing drifted from — exactly how the report now frames it,
  with an explicit owner (architect/M-owner) in the Bugs section. B1's
  acceptance test passes: every grep hit is either scoped out by the restated
  claim or dispositioned by file:line.
- **B2 (consumer list) — FIXED.** Grepped
  `useConsistency|perTaskConsistency|aggregateConsistency` across `src/`+`app/`:
  every newly-named consumer has a real call site —
  `src/features/today/TodayScreen.tsx:46` (aggregate last-30),
  `app/task/[id]/index.tsx:97,285` (S20 stat line + heatmap; :285 calls
  `perTaskConsistency` from `@/domain` directly, covered by the report's
  "reads.ts/@/domain" phrasing), `app/task/[id]/celebrate.tsx:48`,
  `app/progress/index.tsx:69`, `app/settings/index.tsx:64`, and
  `src/queries/mutations.ts:121` (`aggregateConsistency`, cycle-record
  archival). The four wrongly-listed surfaces (notifications, achievements,
  widgets, assistant toolExecutor) produce zero grep hits — the report now
  says so explicitly instead of listing them as consumers. B2's acceptance
  test passes: no named consumer lacks a call site.
- **B3.1 (F1 network isolation) — FIXED.** New explicit PASS(static) entry.
  Re-grepped `fetch(` over `src/`+`app/` myself: every true network `fetch(`
  is in `src/services/ai/managedProvider.ts:55,94`,
  `src/services/ai/byoProvider.ts:52,106`, `src/services/ai/byoProbe.ts:31,46,64`
  — the exact three files the report names; all other grep hits are React
  Query `refetch(` calls. No `XMLHttpRequest`/analytics/telemetry/tracking
  identifiers anywhere (sole hit is a "never telemetry" comment in
  `src/lib/events.ts:25`). Runtime-proxy half and F1 uninstall-wipes-data
  correctly added to Needs-human.
- **B3.2 (F6 evidence) — FIXED.** Every citation checked verbatim:
  `TodayScreen.test.tsx:96` (blank-slate empty state), `:105` (distinct
  nothing-due empty state, including the no-0% assertion), `:132` (populated
  row + meta line + chip state); `src/domain/occurrence.test.ts:141`
  ("Friday additionally requires the Friday-only step" — the F23/§3.10
  Studying fixture); `RoutinesBrowseScreen.test.tsx:54` ("empty — no
  routines at all: renders the F6 empty state") plus the :67/:80/:114
  partition/as-needed/nothing-due tests. All exist and say what the report
  claims.
- **B3.3 (F9 sub-bullets) — FIXED.** PRD §3.9 has exactly five acceptance
  bullets (re-read at PRD.md:581-588); the report now dispositions all five
  (splitting the primed-before-prompt / usable-if-declined bullet into two
  lines, accessibility → NEEDS-HUMAN). Citations verified:
  `concept.test.tsx:16` renders the worked example + privacy promise;
  `ConceptScreen.tsx:52-54` renders `S03_COPY.privacy` with the matching
  accessibility label; `NotificationsPrimerScreen.tsx` calls
  `notifications.requestPermission()` only inside `handleAllow` (line 37),
  never on mount (the mount `useEffect` at :24-27 only arms bridges), and
  navigation never forks on the OS result;
  `notifications-primer.test.tsx:35` (Allow → prompt → proceed) and `:45`
  (Not now → no prompt → still proceeds); `hook.test.tsx:53` (Skip persists
  `onboardingCompletedAt`). See non-blocking note 2 on the :64 citation label.
- **Pass-1 non-blocking notes:** all three addressed — worker-teardown
  warning disclosed in the suite section; "representative" header replaced
  with "full P0/P1 traced"; snoozeSlot RESIDUAL disclosure retained.
- **Verdict integrity:** no application code changed in `f86ed79`, and none
  of the corrections surfaced a real defect — the two inline `Math.round`
  sites are genuinely non-consistency display ratios, correctly logged as a
  minor architect-owned drift from `number.ts`'s comment, not a PRD or
  ARCHITECTURE violation. The overall PASS verdict stands on the same
  evidence pass 1 already re-verified (suite counts, F7 end-to-end, streak
  sweep, consistency anchors, architect CRs).

**TEST_REPORT.md is now cleared to gate Gate 3.** Per the pipeline, next is
visual-qa (screenshots at 390×844 and 1440×900 against the approved
`design-input` handoff screens), then the human-only Gate 3 review of the
screenshots + this test report.
