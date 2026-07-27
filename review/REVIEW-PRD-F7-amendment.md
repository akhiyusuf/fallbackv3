# Review — PRD.md §3.7 F7 amendment + REQUIREMENTS.md R9 CHANGE NOTE (pass 4)
VERDICT: PASS

Pass 4, reviewing commit `82ab760` for compliance with the binding
`review/ADVICE-PRD-F7.md` (invocation 1). Per the advisory's reviewer
instructions: compliance checked against the advisory's own wording, the
sweep re-run independently, struck items not relitigated, and no new
findings raised outside this commit's footprint. Result: fully compliant,
zero blocking items. The amendment is clean to hand to the architect.

## Blocking items

None.

## Independent sweep — my own derivation (orchestrator task 1)

Method matters for the count, so I report all three levels:

- **Line-based grep (advisory patterns verbatim):** 12 hits — this
  UNDERCOUNTS, because three matches wrap across hard line breaks
  ("displays / and counts" in §3.7's case 1 at 470–471 and in the
  snoozable-states bullet at 459–460 hide from single-line grep).
- **Newline-normalized:** 14 matches.
- **Fully normalized (newlines collapsed, whitespace squeezed, markdown
  `**` stripped) — the maximal method:** **15 matches at 14 distinct
  sites.** This is my authoritative count.

**vs spec-writer's reported 17.** I could not reproduce 17 under any
normalization I tried; the difference is almost certainly tooling (e.g. a
looser matcher also catching "display and count" without the s, or
double-counting overlapping alternations). Two things make the discrepancy
non-blocking rather than a finding: (1) the direction — their count is
HIGHER, so it cannot indicate a site they failed to check; a lower count
would have been the dangerous direction; (2) the advisory's acceptance
criterion is not the number but the per-hit (a)/(b)/(c) test, which I
applied to every hit my strictest sweep finds — **all 15 pass, zero
unscoped restatements anywhere in the file**:

| Site (line) | Match | Disposition |
|---|---|---|
| 33 | one-live-outcome-per-task-per-date | (a) new name |
| 459–460 | "what D + 1 actually **displays and counts**" (wrapped) | (c)/(b) — one task's occurrence, sentence explicitly defers to the rule below |
| 463 | ONE LIVE OUTCOME PER TASK PER DATE | (a) new name, definition heading |
| 467 | "shows **one outcome** per task, as Today always has" | (c) explicit per-task |
| 470–471 | case 1 "**displays and counts**" (wrapped) | (b) inside three-case block |
| 482 | case 3 "**displays and counts**" | (b) inside three-case block |
| 1198 | "exactly **one outcome** per task" | (c) explicit per-task |
| 1199 | one-live-outcome-per-task-per-date | (a) new name |
| 1292 | fixtures heading, new name | (a) new name |
| 1294 | fixture (1) "state **displays and counts**" | (a) via its own bullet's per-task-per-date heading; a one-task case application, not a restatement |
| 1297 | fixture (3) "visitor **displays and counts** there" | same as 1294 |
| 1655 | one-live-outcome-per-task-per-date | (a) new name |
| 1685 | "One live outcome per task per date — DESCRIBED" | (a) new name |
| 1734 | "**one outcome** live **per** task per date" (2 overlapping matches) | (c) explicit per-task |

Advisory acceptance test (subsuming pass 3's): no sentence in the PRD
permits the reading "a date with two different due or visiting tasks shows
or counts only one of them" — confirmed; every restatement is consistent
with the reference-standard cross-task edge case (now at 533–535, "counts
independently in F5") and §3.5's per-day sum. Both previously-missed defect
strings ("exactly one occurrence is ever counted per date"; "keeps exactly
one outcome live per date") confirmed gone by exact-string grep.

## Compliance with the advisory's rulings — verified item by item

- **R0:** new name present at all six named sites (33, 463, 1198–1199,
  1292, 1655, 1685) plus the R4 site; the old unscoped name appears nowhere
  (sweep). No passage quotes the old name as preserved historical text —
  confirmed.
- **R1 (463–468):** matches the prescribed wording, including the
  different-tasks-resolve-independently parenthetical and "as Today always
  has." Trivial joinery only.
- **R2 (1197–1201):** all three edits — title "of the same task," first
  sentence "exactly one outcome per task" with the new rule name, "'2
  occurrences **of this task** here'" — and the final arithmetic clause
  stands unchanged, as the advisory directed.
- **R3 (1693–1696) — verified for TRUTH, not just presence (orchestrator
  task 2):** the parenthetical was rewritten in place, not relocated; it now
  reads "each remains its own task's occurrence, resolves **independently**
  under its own task's precedence rule, and **both display and count**
  (independently, per §3.7's cross-task edge case and F5's per-day sum)" —
  verbatim the advisory's text, and now states what is actually true, with
  no residue of any "one displays, never both" formulation anywhere
  (sweep pattern "never both": zero hits).
- **R4 (1733–1735):** "exactly one outcome live **per task** per date" —
  applied as prescribed.
- **N1 (orchestrator task 4) — demotion did NOT weaken §6:** §3.7's
  replacement (484–489) matches the advisory's wording — load-bearing
  assertions repointed at §6's fixtures, identity retained "as a sanity
  check only." §6's three case-specific probative assertions survive
  verbatim (1293–1297: target's state displays and counts / visitor
  contributes nothing; **no XP materialises** at a case-2 target + %
  unchanged; visitor counts at a case-3 target), and the closing sentence
  now reads exactly per the advisory ("§3.5 sanity check … the
  case-specific assertions above are what prove the precedence rule").
  Both halves survived correctly.
- **N2 (474):** case 2's parenthetical now carries "— or **off** if D + 1
  is off-marked, per F4", matching the advisory and SCHEMA R-1's off-mark
  clause; the reading that pitted case 2 against the off-target edge case
  is closed.
- **N3 (1284–1287):** the already-snoozed fixture is pinned to a
  precedence-case-3 target with the advisory's example and the
  may-be-the-same-fixture note; the "reproducible on-screen" promise is now
  true by construction.
- **N4 (1727–1730):** the third reversal handle restored — "if a used-once
  snooze should instead stay spent through an undo (undo returns the
  occurrence but leaves it un-snoozable)" — all three handles now
  enumerated, per the advisory's exact text.

## The disclosed non-change (orchestrator task 3)

Leaving §3.7's cross-task edge case sentence (533–535) untouched is the
CORRECT read of the advisory. The advisory's reviewer instructions
explicitly use that sentence as the standard other restatements are checked
against ("consistent with 526–528's 'count independently in F5'"), and no
R/N item prescribes an edit to it. The sentence is also correct as it
stands. Editing the yardstick while applying a binding ruling measured
against it would have been a deviation, not diligence. spec-writer's
reasoning is sound and its disclosure is the right behavior.

## New defects from this pass (orchestrator task 5)

None found. The full diff was read hunk by hunk; every change traces to a
specific R/N item or is trivial rewrap joinery (header banner). No
acceptance criterion, edge case, fixture obligation, or delegated-call flag
was dropped or semantically altered beyond the prescribed texts.

## Non-blocking notes

- Count-methodology note for the record: the advisory's sweep patterns,
  run as plain line-based grep, miss wrapped matches in this hard-wrapped
  document (3 of my 15 hits wrap). Any future sweep of this kind should
  normalize whitespace first. Not a defect in the artifact.

## Verified

- **Footprint:** `82ab760` touches `docs/PRD.md` only; `docs/REQUIREMENTS.md`
  zero diff (git log/status). `STATUS: APPROVED` intact. The "mirrored from
  `docs/SCHEMA.md` §4.2" citation intact at 464; SCHEMA untouched, as the
  advisory requires (the rename is PRD-local).
- **Struck items honored:** nothing raised on the §7 OWNER-label wrinkle
  (declined by the advisory), nothing further on N1's probative value beyond
  verifying the replacement text, no stylistic findings outside the
  amendment's footprint.
- **Prior-pass obligations still standing:** design-precedence table and
  S20 citations (pass 2), the five S10–S14 citations and the honest §7
  undo-reachability item (pass 3) — all unmodified by this commit and
  re-confirmed present.

## Handoff note for the architect (informational, from the advisory)

The advisory's downstream note stands: when SCHEMA §4.2 is rewritten for
the one-hop rule, adopting the "one live outcome per task per date" name
there keeps the two documents' vocabulary aligned. Also carry STATE.md's
existing mandate: `designateCarrier` / the single-answerer discipline and
the residue/write-carrier machinery survive the simplification; PRD item
21's closing clause (1731–1735) now names both.
