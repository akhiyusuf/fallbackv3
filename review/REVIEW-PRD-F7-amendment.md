# Review — PRD.md §3.7 F7 amendment + REQUIREMENTS.md R9 CHANGE NOTE (pass 3)
VERDICT: ADVISOR_REQUIRED

Pass 3, reviewing commit `aa59363`. Both pass-2 findings are genuinely and
well fixed (see Verified — including independent re-verification of all five
design citations and the SCHEMA mirror). REQUIREMENTS.md zero diff again,
correct. But this pass introduces ONE new blocking defect — a per-task
scoping error in the new one-live-outcome rule's restatements that flatly
contradicts §3.7's own cross-task edge case — so pass 3 is still failing,
and per the 3-consecutive-fails rule the verdict is ADVISOR_REQUIRED.

**Context for the advisor, stated plainly:** this is NOT a broken-spec
spiral. Each pass fixed its predecessor's findings completely and introduced
a new, different defect in the fix — the same pattern STATE.md records for
every wave-1 module. The artifact is one mechanical edit (adding "per task"
scoping in three places) plus optional cleanups from clean. The escalation
is procedural, not a judgment that upstream is unsound.

## Blocking items

1. **The one-live-outcome rule's restatements drop its per-task scope,
   contradicting §3.7's own cross-task edge case and F5's aggregate math.**
   The rule as specified in §3.7's three cases is per-task by construction
   (own occurrence vs that same task's visitor), and §3.7's edge case
   (526–529) correctly says two DIFFERENT tasks snoozing onto one date each
   "resolve under the precedence rule, and count independently in F5." F5
   §3.5 likewise sums a day fraction over ALL of a day's due tasks. But three
   restatements state the rule at date level, without the per-task qualifier:
   - **PRD 465** (§3.7, the rule's own preamble): "A date never displays or
     counts **more than one** outcome, ever." Read literally, Today could
     never show two tasks.
   - **PRD 1190–1193** (§4 new non-goal): "A date shows and counts **exactly
     one** outcome."
   - **PRD 1683–1685** (item 21) — the worst instance, because the
     parenthetical is attached to the explicitly cross-task bullet: "Two
     **different** tasks may each independently snooze one day forward onto
     the **same date**. Two occurrences sharing a date **stays in scope**
     (resolved by the precedence rule — **one of them displays and counts,
     never both**)." For two different tasks this is simply false — BOTH
     display and count, per §3.7 526–529 and per the product's basic Today
     behavior. An architect following item 21 (the change's authoritative
     record) could suppress one task's occurrence on shared dates — a real
     behavioral error, and the §4 bullet would tell builders the same.
   **Fix:** scope all three statements per task — e.g. 465: "A date never
   displays or counts more than one outcome **of the same task**, ever";
   1190: "…exactly one outcome **per task**"; and either move the 1684
   parenthetical to item 21's same-task bullet (1686–1689) where it is true,
   or rewrite it: "(each task resolves independently under its own
   precedence rule; **within one task**, one occurrence displays and counts,
   never both)." **Acceptance test:** no sentence in §3.7, §4, or item 21
   permits the reading "a date with two different due/visiting tasks shows
   or counts only one of them," and the cross-task edge case at 526–529 is
   consistent with every restatement of the rule.

## Non-blocking notes

- **The new qa-tester assertion (479–481) is non-probative for its stated
  purpose, with an incorrect "because" clause.** `numerator = denominator −
  missed` is definitionally true per §3.5 (which already states it as an
  identity: numerator = shown-up, denominator = shown-up + missed). It holds
  even under the failure modes the precedence rule exists to prevent: a
  double-counted date raises both sides equally; a visitor's state wrongly
  displayed just reclassifies that date's single outcome; even wave 1's
  actual F7 bug (snoozed → silently missed) preserves it. The probative
  assertions are the ones §6's new fixtures mandate (1282–1288:
  no-XP-materialises at a case-2 target, %-unchanged-by-visitor, visitor
  counts at a case-3 target) — so the property IS covered and no consumer is
  left unable to act, which is why this is not blocking. Recommend, in the
  same edit as the blocking fix (the "because exactly one occurrence is ever
  counted per date" clause shares its per-task confusion): demote the
  identity to a sanity check and point the load-bearing assertion at the §6
  fixtures.
- **Case 2's parenthetical (470–472: "pending today, missed once the day has
  ended") omits the off-mark carve-out.** §3.7's own edge case (533–534,
  target off-marked → resolves off per F4) and §3's cross-cutting off-day
  rule resolve it; consider "(absent an off-mark, F4)" inside case 2 so the
  two sentences can't be read against each other.
- **Pin §6's pre-existing "one already-snoozed occurrence" fixture
  (1279–1281) to a case-3 target.** Its promise that the "Undo snooze"
  rendering is "reproducible on-screen" is only true when the visitor
  displays (case 3); a daily-cadence fixture would make it dormant. The
  adjacent precedence-fixture (3) already forces a case-3 instance, so no
  consumer is stuck — but one phrase ("make this the case-3 fixture") closes
  the trap.
- **The restored DELEGATED CALL paragraph (1698–1711) dropped one of its
  reversal handles.** The pass-1 text invited the human to reverse "a
  used-once snooze should stay spent through an undo"; the restoration keeps
  the decision ("afterwards it is in the never-snoozed state") and the
  one-way and accepted-tradeoff handles, but no longer names the stay-spent
  option explicitly. The whole paragraph is still flagged as delegated
  inference, so the human can reverse any part; restoring the third handle
  would be more faithful to pass 1.
- §7's new item and the amended toggle item still carry OWNER: designer /
  screen-designer — agents the PROJECT OVERRIDE forbids invoking. Carried
  wrinkle (three instances now); in practice these land on the human at/
  before Gate 3, which the new item's escalation clause partially
  acknowledges.
- **Disclosure of a pass-2 review miss (mine):** commit `2bf2266` deleted
  item 21's DELEGATED CALL paragraph entirely; my pass-2 review did not
  catch that regression. Pass 3 (`aa59363`, 1698–1711) restored it with the
  reachability caveat added — verified present and improved now. Recorded
  here so the audit trail is honest.

## Verified

- **Footprint (git):** `aa59363` touches PRD.md only; REQUIREMENTS.md zero
  diff (git log/status). Hunks: header banner (waived pointer text only),
  §3.7, §4, §6, §7, item 21 — all in footprint. `STATUS: APPROVED`
  unchanged.
- **Pass-2 finding on double credit — FIXED.** The three-case precedence
  rule (463–478) is a faithful mirror of SCHEMA §4.2 R-1, checked
  clause-by-clause against the actual text (SCHEMA 269–283), not the
  paraphrase: case 1 ↔ clause (a) ("a real state at D always wins,"
  pointer-null), including the dormant-not-destroyed and undo-return
  language; case 2 ↔ clause (b) (natural, own row absent → blank state,
  "auto chip, pending/missed by date," visitor dormant), with the
  no-manufactured-XP rationale matching C4b's explicit no-award assertion;
  case 3 ↔ clause (c) verbatim in substance ("a non-natural date, or …
  natural-but-vacated"). **Completeness/non-overlap walked as instructed:**
  the orchestrator's fourth-case probe — target's own occurrence itself
  snoozed away when the visitor lands — is NOT a missing case; it is named
  inside case 3 exactly as R-1(c) names the C6 shape, and a residue row with
  old data cannot be claimed by case 1 without directly contradicting case
  3's explicit assignment (SCHEMA's pointer-null condition remains the
  precise arbiter via the "mirrored from" citation). The only soft boundary
  (case 1 vs case 2 when an own row exists in a pending shape) is
  outcome-invariant — the own side wins either way — so no product ambiguity
  exists. The load-bearing boundary (own occurrence present vs not) is
  crisp.
- **Coordinator-contradiction handling — CONFIRMED correct.** The commit
  message flags that the routing instructions self-contradicted and that
  spec-writer followed the variant matching SCHEMA's tested behavior; item
  21's "DESCRIBED, not invented" paragraph (1674–1680) records the same. My
  clause-by-clause check above confirms the PRD matches SCHEMA's actual R-1
  — i.e., the correct variant was chosen, and the choice is flagged, not
  silent. This also honors STATE.md's pass-5 mandate that the read/write
  single-answerer discipline survive the rescope (item 21's closing clause,
  1717–1720, now names the read-resolution precedence as must-not-delete).
- **Pass-2 finding on undo reachability — FIXED honestly.** The pass-2
  ambiguity (i) is now definitively answered (487–499: source date resolves
  not-due, slot disabled; the visitor displays nowhere under cases 1–2), and
  the merge case (ii) is declared an open §7 item rather than papered over.
  **All five design citations independently re-verified** against
  ALLSCREENS_1.md — the three the orchestrator did not check: S11 line 476
  ("No `StateChip` on the row — tap → S20"), S12 line 525 ("No `StateChip`
  on the row — tap → S20 (which hosts F12's per-dose completion UI)"), S14
  line 624 ("same `Card` row style … no `StateChip`"); plus S10 line 425 and
  S13 line 571 (plain binary Checkbox, To-dos only, no occurrences) — all
  accurate, all routing to date-based S20. The "common case, not a corner
  case" claim is correct: a daily task's snooze target is naturally due and
  (being a future date with no logging surface) never-logged by
  construction. **§7-item honesty check (orchestrator's third focus):** the
  item does NOT imply a testable answer exists — it names three unchosen
  candidates, forbids the accepted-tradeoff branch without human sign-off,
  states qa-tester cannot write the reachability assertion yet, and
  correctly leaves the undo MECHANIC testable today via the case-3/§6
  fixture path (visitor displayed → rendering 3). No pass-1-style
  false-reachability implication in either direction found.
- **Collapse-drop audit of this pass's edits:** the reworked edge block
  (520–537) preserves every pass-2 obligation (toggle-off keeps the Undo
  rendering "wherever it is displayed" — correctly reachability-neutral;
  cross-task legality; off-target per F4; S23 exclusion; persist-failure
  list; cancel-delete; empty grid). The same-task natural-target edge is now
  correctly folded into "case 1 or 2, not a special rule." The one semantic
  regression found is blocking item 1; the one weak addition is the
  non-probative assertion note.
