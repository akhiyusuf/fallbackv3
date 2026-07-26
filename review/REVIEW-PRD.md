# Review — PRD.md (pass 1)
VERDICT: PASS

Artifact: `docs/PRD.md` (1,426 lines, carried over from a previous pipeline run,
`STATUS: APPROVED` at line 2 — Gate 1 approval not re-litigated here).
Reviewed against: `docs/REQUIREMENTS.md` (R1–R26) and `docs/FEATURES.md`
(F1–F31, no F10), with `design-input/README.md` +
`design-input/fallback-handoff/uploads/ALLSCREENS_1.md` consulted only to
distinguish PRD defects from downstream resolutions of items the PRD left open.

## Blocking items

None.

## Non-blocking notes

1. **Rounding tie behavior is not pinned, despite the PRD calling rounding
   "pinned."** §3.5 ("Rounded to nearest whole percent — pinned, not
   adjustable") and the §7 F5 note ("the rounding rule is NOT open") pin
   "nearest whole percent," but none of the worked examples (86.67→87,
   83.87→84, 84.375→84, 66.67→67) exercises a .5 tie, so half-up vs.
   half-even is technically unspecified. The design has already resolved it
   (ALLSCREENS_1.md line 2947: "rounding round-half-up"). REQUIREMENTS R6 has
   the same wording, so this is not a fidelity break — but the architect should
   codify **round-half-up** explicitly so builders and qa-tester don't diverge
   on tie cases (e.g. 1/8 = 12.5%).

2. **Chip-state → logged-state mapping is implicit.** §3.3 defines the override
   set {To do, Done, Fallback, Skip} and §6 notes "missed is a derived history
   label, not a stored chip state," but the Done→ideal mapping is inferred
   rather than stated in one sentence. Unambiguous in practice (only ideal and
   fallback are "showing-up" states, and the design's StateChip resolves it),
   but a one-line mapping in ARCHITECTURE/SCHEMA would remove the inference.

3. **Two §7 items name "spec-writer" as (co-)owner of open forks** (F5/F30
   breakdown-display + "X of Y days" framing; F29 tenure anchor event) even
   though the PRD is the spec-writer's own terminal artifact — a slight process
   wrinkle. Harmless because each has a designer/architect co-owner and the
   design has in fact resolved the display forks (S25 keeps "X of Y counted
   days" with X = Σf; S29/S30 show the Ideal/Fallback/Off/Missed record
   breakdown). The F29 anchor event (install vs. first launch vs. first task)
   still needs the architect to pick one concrete event when F29 is built; the
   PRD's constraints on it (one fixed calendar date, consistency-independent,
   device-local, reset by F25 erase-all) are sufficient to build against.

4. **F5 §3.5 first bullet says the % is "broken into ideal / fallback / off
   counts" while the same section later declares whole-day counts inexact under
   fractional credit.** Not a contradiction — the bullet mirrors R6's verbatim
   requirement and the fork paragraph explicitly qualifies it — but a builder
   reading only the first bullet could miss the qualification. The design's
   resolution (breakdown bar + "counted days" copy) settles it.

5. **Minor presentational slip, no consequence:** §3.5 states "26/31 = 83.9 →
   84%"; the exact value is 83.87. One-decimal rounding, final 84% correct.

## Verified

- **Traceability (priority 1).** Every F-ID F1–F31 is present and priority-
  consistent with FEATURES.md: P0 = F1–F9 (§3.1–3.9), F23 (§3.10), F25 (§3.11)
  — eleven, matching the preamble count and Decisions item 15; P1 = F11, F12,
  F13, F14, F15, F16, F17, F18, F19, F20, F21, F24, F26, F27, F28, F29, F30,
  F31 (§3B); P2 = F22 (§3B end + §4), matching FEATURES' "Later (P2)". F10 is
  documented as an intentional gap (preamble line 7, Decisions item 5) —
  expected, not a defect. Every R-ID R1–R26 maps to at least one feature spec:
  R1→F2/F11, R2→F2, R3→F3, R4→F4, R5→F12, R6→F5, R7→F13, R8→F6/F9/F15, R9→F7,
  R10→F14, R11→F21, R12→F8, R13–R15→F16, R16/R17→F17, R18/R19→F18,
  R20→F1/F20/F22, R21→F19/F25 (human-directed split honored, Decisions 15),
  R22→F23/F24, R23→F2/F11/F26, R24→F27, R25(A/B/C)→F29/F30/F31, R26→F28. The
  only deferral is R20's conflict-resolution depth (F22, P2) — explicitly
  defensible per REQUIREMENTS' own open question and FEATURES' P2 placement.

- **Off-day / consistency-% maths (priority 2).** The two rules — (a) off days
  excluded from BOTH numerator and denominator, (b) aggregate rollup =
  proportional/fractional daily credit — are stated identically in every
  location they appear: preamble Gate-1 note (lines 15–23), §3 cross-cutting
  "missed" + off-day definitions (lines 96–116), §3.4, §3.5 (scope 1 and scope
  2), §6 fixtures (per-task and aggregate), §7 F5 note, and Decisions items 6
  (superseded, retained for history), 13, 16, and 18. No residue of the
  superseded "off-days-dilute" or "all-or-nothing day" readings survives
  anywhere. Arithmetic re-verified independently: 26/26 = 100%; 26/30 = 86.67
  → 87%; 26/31 = 83.87 → 84%; 27/32 = 84.375 → 84%; 3-day anchor Σf = 1.333 ÷
  2 = 66.67 → 67% (not 50%). The scope-2 formula is self-consistent: the
  degenerate one-task-per-day reduction to scope 1 is mathematically correct;
  zero-due/all-off/all-pending day exclusion, per-task off-ness within a day
  (1 off + 1 shown → f = 1/1), and per-task pending composition (1 done + 1
  pending → f = 1/1) match REQUIREMENTS R6 scope 2 exactly. The "elapsed"
  single definition (past days + today only once logged/Skipped), the
  Skip-resolves-to-missed-any-day rule, and `numerator = denominator − missed`
  are consistent across §3, §3.5, §6, and Decisions 16. F30's per-cycle % and
  F28's per-bucket points both declare reuse of the §3.5 scope-2 formula (no
  new calculation), matching R25(B)/R26 verbatim.

- **Buildability of P0 (priority 3).** Each of the eleven P0 specs has
  acceptance criteria, edge/error/empty states, and data-touched sections; the
  cross-cutting missed/off definitions give a single source of truth. Items a
  P0 builder cannot decide alone (signal-color hues, dashboard windows/layout,
  missed-count display) are all §7-flagged with a Phase-2 designer owner and
  are resolved in the existing design — no P0 behavior requires a builder to
  invent product policy. The F23 no-empty-run-occurrence invariant (Decisions
  12) keeps F3/F5/F6/"missed" mutually consistent without special-casing.

- **§7 owner claim (priority 4).** Verified: all 14 §7 items carry explicit
  owners — spec-writer/designer (2), screen-designer/architect (1), designer/
  screen-designer (1), architect (6), designer/architect (1), screen-designer
  (1), designer (2, incl. the Phase-2 forge-orange conflict). **None is
  OWNER: human**, matching the preamble claim and Decisions item 18's removal
  of the last human-owned item. REQUIREMENTS' Open Questions section likewise
  contains no unresolved OWNER: human item — no silent re-decision of anything
  reserved to the human.

- **Contract & fidelity.** The R15 "clearly harmful" boundary was explicitly
  delegated to the spec-writer by REQUIREMENTS and is resolved openly
  (F16 §3B five categories + canonical test pairs; Decisions item 7), not
  silently. All four FEATURES "Flags carried to Gate 1" appear in the PRD
  (off-day math: preamble/§3.5/Decisions 13; rollup: §3.5/Decisions 18;
  as-needed no-XP call with "visible at Gate 1" marker: Decisions 17; R25/R26
  scope calls: Decisions 19/20). Human-confirmed R24/R25/R26 decisions (name
  "As-needed routine," optional ideal+fallback, reference-only logging,
  occurrence-based XP eligibility, 11 tenure tiers, weekly/monthly-only
  Cycling-XP cadence with cadence-following label, mid-cycle immediate-archive
  rule, ADDITIVE graph) are carried verbatim with no drift. §4 non-goals match
  REQUIREMENTS' non-goals list one-for-one, including the Cycling-XP-interval
  and tenure-badge-gating non-goals.
