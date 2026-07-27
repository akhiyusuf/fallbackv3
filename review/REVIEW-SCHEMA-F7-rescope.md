# Review — SCHEMA.md §4.2 F7 rescope + ARCHITECTURE/MODULES/API consistency edits (pass 1)
VERDICT: CHANGES_REQUIRED

Reviewing commit `d881cc6` against `docs/PRD.md` §3.7 / §4 / §6 / §7 / Decisions item 21
(post-amendment, pass-4 PASS), with `review/ADVICE-PRD-F7.md` and
`review/REVIEW-PRD-F7-amendment.md` as binding history and the pre-rewrite SCHEMA §4.2
(`7343b0e:docs/SCHEMA.md` 228–405) as the deletion baseline.

The core rewrite is good: the injectivity argument is sound (I re-derived it — see
Verified), the deletions are genuinely dead, C6 is genuinely equivalent, the
single-answerer discipline survives by name with the right warning, and the dormant-undo
gap is carried forward without being quietly resolved in either site. The blocking items
below are concentrated in MODULES.md's superseding note (which strands contradictory old
text below itself) and in the W-rules' silence on undo validation. Ranked by severity.

## Blocking items

1. **MODULES.md 307–322 — the old CR-3 tail is stranded BELOW the "SUPERSEDED IN PART"
   heading and reads as current guidance; it orders builders to implement a deleted write
   branch and qa-tester to test dead cases.** The new subsection was inserted mid-section
   (286–305), so the original CR-3 continuation now sits under the superseding heading with
   no historical marker. Three sentences there directly contradict SCHEMA §4.2:
   - **311–312:** "Write normalisation — a move *from* a date carrying inbound pointers
     operates on **those pointers only**; the own-log pointer is written only when no
     inbound exists," presented as one of "two halves and both are required." This is
     the deleted redirect-inbound W-3 branch (SCHEMA §4.2 314–317: "Do not reintroduce
     them"), and under the new contract it is behaviorally **false**: a snooze at a merged
     date acts on the displayed OWN occurrence and writes the own-log pointer (see item 3).
     This is the exact vector for reintroducing the dead machinery and, with it, a second
     answer to "which row is this occurrence?" — the F1 defect class this rewrite goes out
     of its way to fence off at SCHEMA 341–348.
   - **321:** "qa-tester — C1–C8 are required tests" — contradicts SCHEMA 397–401's case
     mapping (C2/C3/C5/C8 dead; C9–C14 required). As written it directs qa-tester to test
     chains (C3) that W-1 and the CHECK constraint now make impossible.
   - **314–315:** C6 restated in the old arbitrary-move notation ("B→C then A→B") as if
     current.
   **Fix:** restructure so nothing below the superseding heading reads as live unless it is
   true under the one-hop contract — either move the superseding subsection to the end of
   CR-3, or wrap 307–330 in an explicit "historical, superseded" marker, and restate the
   still-true content in one-hop terms (read precedence + T-rules survive; the write side
   is one row with no normalisation; qa-tester's required list is §4.2's current table:
   C1, C4, C4b, C4r, C6, C7, C9, C10, C11, C12, C13, C14).
   **Acceptance test:** no sentence below the "CR-3 SUPERSEDED IN PART" heading instructs
   building or testing anything SCHEMA §4.2 lists as deleted or dead, and the qa-tester
   instruction names §4.2's current case list.

2. **SCHEMA.md §4.2 288–309 — `undoSnooze` has no validation of its own, and W-1 read
   literally rejects every legal undo.** The WRITE heading (288) covers both operations,
   and W-1 (295–302) is a single undifferentiated rejection list. Applied to undo it
   rejects twice over: a snoozed occurrence's source date D resolves `not-due` (R-2,
   bullet 1), and the occurrence is by definition "ALREADY snoozed" (bullet 3) — yet
   C1/C4b/C4r/C7/C9 all require undo to succeed from exactly that state. Undo's real
   preconditions appear nowhere: reject only when `pointer(D)` is null; `task.snoozable`
   is NOT consulted (PRD §3.7 rendering 3 — "Undo snooze … appears regardless of the
   task's current `snoozable` value"). Two adjacent under-specifications belong in the
   same fix: (a) W-2's `D` is the **source** date while the UI invokes undo from a sheet
   displaying the visitor at D+1 — currently only derivable, not stated; (b) W-3's "emit
   `day:logged` once" no longer says which date the event carries (the old W-4 pinned
   "for T exactly once"; T-3 pins the data-write case; the snooze/undo case is now
   unpinned — M7's notification/widget rescheduling consumes this event).
   `docs/API.md` 201–203 inherits the same defect: the rejection comment is attached to
   both functions, so "rejects … when the occurrence is already snoozed" reads as
   forbidding undo.
   **Fix:** split W-1 into per-operation validation (snooze: the current three bullets;
   undo: pointer null → reject, snoozable ignored), state undo's date addressing, and pin
   the event date per operation; mirror the snooze/undo split in API.md's comment.
   **Acceptance test:** a builder can implement `undoSnooze` from §4.2 alone, and every
   undo step in C1, C4b, C4r, C7, and C9 passes the written validation.

3. **SCHEMA.md 397–401 — C5's death rationale is wrong, and its trigger sequence lost its
   named case.** The mapping declares "C3 and C5 (chains, unreachable once a snoozed
   occurrence cannot be re-snoozed)." True for C3; only **half**-true for C5. C5's old
   *resolution* (redirect the visitor's pointer = a chain) is dead, but its *triggering
   sequence* — merge first, then snooze at the merged date — is still UI-reachable: after
   snooze D→D+1 onto a date with its own state, the sheet at D+1 displays D+1's **own**
   occurrence (clause a or b), which is unsnoozed and in a snoozable state, so Snooze is
   enabled. The outcome is now the **inverse** of old C5's LIFO rule: the own occurrence
   moves to D+2 (one row, W-2), and the previously dormant visitor **revives** at D+1
   (clause c) — including re-materialising its award at D+1 via W-3's reconcile if it
   carries a showing-up state. The end storage state equals C6's, and I verified the
   R/W/T rules answer it consistently with PRD case 3 — but the case table is the
   required-test list, and this reachable order with its dormant-revival and
   XP-re-materialisation consequence is pinned nowhere.
   **Fix:** add a named case (e.g. C6b, "merge then vacate: snooze D→D+1 onto a logged
   D+1, then snooze D+1's own occurrence to D+2") with the required end state including
   the visitor's revival and award behavior, and correct the mapping note (C5's
   resolution is dead; its sequence survives with a changed answer, covered by the new
   row). **Acceptance test:** the case table contains the merge-then-vacate order, and
   the mapping no longer labels the C5 scenario "unreachable."

4. **The D+1 CHECK constraint exists only in §4.2 prose — §4's `day_log` table omits it
   and nobody is tasked with the migration that adds it.** SCHEMA 209's column row still
   reads "F7 snooze / move" with no constraint, while §4.2 241–242 says the column
   "gains" the CHECK; §4's tables are where every other constraint lives (the UNIQUE at
   212, the enum CHECKs, §0's convention that closed sets are "enforced in the database").
   Meanwhile CR-4's M1 bullet (MODULES 232–233) covers only the `task.snoozable` column —
   but adding a CHECK to an existing SQLite table is a table rebuild, and MODULES 304–305
   concedes "the code still implements the broad contract," so existing dev/test stores
   can hold pointers that violate the constraint; no policy says what the migration does
   with them, and §9's migration section is silent on the new migration entirely.
   **Fix:** put the CHECK in §4's `day_log` table row (and update the note to "F7 one-hop
   snooze"), and extend CR-4's M1 bullet (or add a sibling) with the `day_log` rebuild
   migration plus an explicit violating-row policy.
   **Acceptance test:** M1 can write the migration from MODULES + SCHEMA §4/§9 alone,
   including the answer for a legacy pointer that is not `date + 1`.

5. **MODULES.md 182 — "All three are approved" with four CRs on the page.** CR-4 was
   inserted (225–235, structurally matching CR-1/CR-2's preamble + M0/M1/M2 bullet
   pattern — that part is correct) but the section intro still enumerates three and
   classifies only CR-1/CR-2/CR-3, so CR-4's approval status is formally unstated; a
   builder must ask before touching frozen `src/types/task.ts`. Cosmetic but worth fixing
   in the same pass: CR-4 sits between CR-2 and CR-3, out of numeric order.
   **Acceptance test:** the intro enumerates four, states CR-4's approval status and
   nature (M0 type + M1 migration + M2 validation).

6. **API.md 199–200 — `snoozeOccurrence()` / `undoSnooze()` break the mutation list's
   `use*` hook convention, leaving the call shape ambiguous.** Every other read and
   mutation in §3's list (178–205) is a `use*` hook, and the layer is described as "read
   hooks compose repositories … mutations own persistence." Dropping the prefix either
   means these two are plain functions (contradicting the list they sit in) or is naming
   drift; M4 cannot tell which without asking. SCHEMA §4.2's use of the same names as
   domain-operation signatures is fine; the ambiguity is API.md-internal.
   **Fix:** either rename to `useSnoozeOccurrence()` / `useUndoSnooze()` or annotate why
   these two are not hooks. **Acceptance test:** M4 knows the call shape from API.md
   alone.

## Non-blocking notes

- **C7 (SCHEMA 359) carries an implicit fixture constraint:** "complete at D+1" requires
  the visitor to be displayed (clause c), and the end state "D+1 not-due" after undo holds
  only when D+1 is not naturally due. True as written, but stating "D+1 resolves case 3
  (e.g. weekday cadence)" in the row would stop a qa-tester from building a daily-cadence
  C7 fixture and wrongly failing the "D+1 not-due" assertion. PRD §6 already pins exactly
  this fixture shape.
- **C9's final clause ("revived by the visitor's own undo") is exercised via the hook on a
  dormant occurrence — which no UI currently reaches (the open §7 gap).** Legitimate for
  an end-to-end-through-hooks test; a cross-reference to the open-gap note would prevent
  qa-tester reading it as a UI-reachable step.
- SCHEMA §9's backup example still says `"schemaVersion": 3`; illustrative only, but will
  drift once the CR-4 migration lands.
- MODULES 240–284 (the pre-superseding CR-3 narrative, incl. 274's `useMoveOccurrence`
  mention) is acceptable as history once item 1's structural fix makes the
  historical/current boundary unambiguous.
- The architect's "178 → 170 lines" arithmetic is slightly off (old §4.2 spans 178 lines,
  new spans ~173) — immaterial; the honest framing of where the real simplification lives
  (5→3 write rules, N-row→1-row writes, tie-break eliminated by proof) checks out.

## Verified

- **Scope discipline:** `git show --stat d881cc6` — exactly `docs/SCHEMA.md`,
  `docs/ARCHITECTURE.md`, `docs/MODULES.md`, `docs/API.md`; working tree clean; no
  `docs/PRD.md`, `docs/REQUIREMENTS.md`, `design-input/**`, `review/**`, `src/**`
  changes. `tsc` claim not re-verified per orchestrator instruction (no source touched).
- **Injectivity derivation, re-derived independently:** the CHECK forces
  `r.movedToDate = r.date + 1`, so any inbound row for (τ, D) has `r.date = D − 1`;
  `UNIQUE (task_id, date)` allows at most one row of τ at D−1; hence `|inbound(D)| ≤ 1`
  and same-task double-inbound (old C8) is impossible — the latest-source tie-break is
  genuinely dead, not merely unused. D→D+1 is injective, so two same-task sources can
  never share a target, matching Decisions 21's "eliminated (ii)" exactly.
- **CHECK constraint mechanics:** `LocalDate` is TEXT `'YYYY-MM-DD'` (SCHEMA §0), so
  SQLite `date(date, '+1 day')` yields comparable TEXT across month/year boundaries; the
  NULL arm is explicit. Every surviving case needs a pointer that is exactly D+1 or null
  (checked C1, C4/C4b/C4r, C6, C7, C9–C14) — no surviving scenario conflicts with the
  constraint. Gap: table placement and migration ownership (blocking item 4).
- **Deletions, against `7343b0e:docs/SCHEMA.md` 228–405:** W-0 (same-day no-op), W-2
  (±60-day guard / `MOVE_SEARCH_PAD_DAYS`), W-3's redirect-inbound branch, the multi-row
  ordering note, C2/C3/C5/C8, and the latest-source tie-break are all absent from the new
  §4.2, each with a correct death rationale — except C5's (blocking item 3). C2 and C3
  correctly dead: the target is computed so source ≠ target always; a chain requires
  re-snoozing a snoozed occurrence, rejected by W-1 and unrepresentable under the CHECK.
- **Preservation:** C1 (improved — "D+1 back to its own state" is cadence-agnostic where
  the old row assumed a non-natural target), C4↔PRD case 1, C4b↔PRD case 2 (incl. the
  no-XP-materialises assertion and the N2 off-mark carve-out in clause b), C4r, C7, C9,
  C10, C11 all correct under one-hop. **C6 equivalence verified:** old C6 ("task due A
  and B; B→C, then A→B") instantiated at A=D, B=D+1, C=D+2 is exactly the restated row,
  which is verbatim PRD Decisions 21's in-scope example; the load-bearing assertion
  (residue pointer does not annihilate the moved-in occurrence; clause c) is unchanged.
  T-1/T-2/T-3 preserved with the tie-break correctly dropped from clause (c);
  `designateCarrier` (`src/domain/dayState.ts`) and `resolveWriteTarget`
  (`src/queries/internal.ts`) named, with the explicit no-second-implementation sentence
  (SCHEMA 341–348) — the F1-defect fence survives in SCHEMA and in MODULES 296–302.
- **New cases vs PRD:** C12 ↔ §3.7's cross-task edge case (534–535) + Decisions 21
  bullet 1 (both display and count, per-task, F5 per-day sum); C13 ↔ 489–493 (UI
  impossibility + direct-attempt rejection + never-more-than-one-day invariant); C14 ↔
  435–438 + 530–532 (disabled-not-hidden, SR reason, writes nothing, toggle-off does not
  retract). All implementable without guessing — modulo undo validation (item 2).
- **Read resolution vs PRD 463–488:** R-1 clauses a/b/c map one-to-one onto PRD cases
  1/2/3, with the PRD case number cited inline at each clause; the "ONE LIVE OUTCOME PER
  TASK PER DATE" name and its per-task preamble adopted verbatim in SCHEMA 260–264 and
  ARCHITECTURE's rewritten footnote (254–261) — satisfying ADVICE-PRD-F7's downstream
  note and the pass-4 review's handoff note (name alignment + designateCarrier survival).
- **Dormant-undo gap genuinely open in both sites:** SCHEMA 387–395 and MODULES 608–613
  describe the gap, state mechanic-settled/reachability-open, and both explicitly forbid
  inventing a UI ("do not invent a UI for it here or in a module brief" / "Do not invent
  a UI to fix this"). Neither names a chosen surface; candidate resolutions stay in PRD
  §7 where they belong. Not resolved, not hedged — correct.
- **M4 brief vs PRD §3.7:** two-slot action row, three renderings (incl.
  Undo-regardless-of-snoozable), computed target, occurrence-card-only scope, heatmap
  exclusion, closed snoozable-state list, default-on + manage-sheet editability with the
  create-flow exposure left open per §7 — all faithful; the design-precedence framing
  matches §3.7's table.
- **API.md content vs SCHEMA:** one-hop, computed target, and the three snooze rejection
  conditions match W-1; replacing `useMoveOccurrence()` was necessary (leaving it would
  contradict PRD §4's "do not build, stub toward, or leave hooks" non-goal) and the scope
  addition was disclosed — accepted. Residual defects are items 2 (undo comment) and 6
  (naming).
- **Stale-terminology sweep** (`useMoveOccurrence`, C1–C8, ±60, tie-break, "Move to
  another day", chain) across all four docs: all remaining hits are either inside
  properly historical CR-3 narrative or are the stranded-tail defects in blocking item 1;
  ARCHITECTURE and API are clean.
