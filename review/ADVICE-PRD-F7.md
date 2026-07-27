# Advisory — PRD.md F7 (snooze) amendment (invocation 1)

Root cause: 2 (capability gap — narrowly; this is a converging loop, not a
crisis). Each pass's rework was correct on its findings but hand-restated the
one-live-outcome rule in fresh prose at multiple sites, and every hand-written
restatement is a fresh chance to drop the rule's per-task scope. The true
vector is the rule's own shorthand NAME: "one-live-outcome-per-date" omits the
scope, so every sentence built from the name inherits the omission. My sweep
(patterns in §Sweep below) found the name/restatement at ELEVEN sites — the
reviewer's three blocking sites plus two more defect-bearing restatements it
did not list (PRD 480 "exactly one occurrence is ever counted per date"; PRD
1720 "keeps exactly one outcome live per date"). Point-fixing three sites
would invite a pass-5 on the other two. The binding fix is therefore
structural: rename the rule so its shorthand carries the scope, correct every
restatement, and verify with a mechanical sweep. SCHEMA §4.2 is correct and
untouched; the defect is PRD-internal description drift, not a spec conflict.

## BINDING RESOLUTION

### For the producer (spec-writer) — apply exactly, one commit, PRD.md only

**R0 — Rename the rule (structural fix).** Canonical name becomes
**"ONE LIVE OUTCOME PER TASK PER DATE"**; hyphenated reference form
**"one-live-outcome-per-task-per-date"**. Mechanically update every use of the
old name: lines 32 (header banner), 463 (definition heading), 1191 (§4),
1282 (§6 fixtures heading), 1644 (item 21 body), 1674 (item 21 sub-heading
"One live outcome per date — DESCRIBED, not invented"). Sites 32 and 1644 need
only the name swap — their surrounding prose is already scoped to "what the
snooze target displays" and is not otherwise defective.

**R1 — Line 465 (the rule's preamble; blocking site 1).** Replace
"A date never displays or counts **more than one** outcome, ever." with:

> For a **given task**, a date never displays or counts more than one of
> **that task's** outcomes, ever. (Different tasks resolve independently — a
> date with several due or visiting tasks shows one outcome **per task**, as
> Today always has.)

**R2 — Lines 1190–1193 (§4 non-goal; blocking site 2).** Three edits:
- Title: "**Merging, summing, or co-displaying two occurrences of the same
  task on one date (F7).**"
- First sentence: "A date shows and counts **exactly one outcome per task** —
  §3.7's one-live-outcome-per-task-per-date precedence rule."
- In the affordance list: "a '2 occurrences **of this task** here' affordance".
The final clause ("any arithmetic that lets a visiting occurrence contribute
to a date that already resolves its own state") stands unchanged — it is
per-task-correct once the title and first sentence set the scope.

**R3 — Lines 1683–1685 (item 21, cross-task bullet; blocking site 3).**
REWRITE the parenthetical in place — do NOT merely reword it and do NOT move
it to the same-task bullet (1686–1689). Any "one displays, never both"
formulation is false for a cross-task bullet regardless of wording; the
correct statement for this bullet is the opposite. Moving it to bullet 2 is
also refused: bullet 2 does not need a restatement, and minimizing
restatements is the point of R0. Replace the bullet with:

> Two **different** tasks may each independently snooze one day forward onto
> the **same date**. Two occurrences sharing a date **stays in scope** — each
> remains its own task's occurrence, resolves **independently** under its own
> task's precedence rule, and **both display and count** (independently, per
> §3.7's cross-task edge case and F5's per-day sum).

**R4 — Line 1720 (item 21 closing clause; found by this advisory, same
defect).** "…the read-resolution precedence that keeps exactly one outcome
live **per task** per date — must **not** be deleted alongside the chain
machinery."

### Rulings on the five non-blocking items — four FIX (same commit), one no-action

**N1 (non-probative fixture assertion, 479–481 + its §6 twin at 1288) — FIX.**
The "because" clause is wrong twice over (per-task scope drop; and the §3.5
identity is definitional — it survives double-counting, wrong-visitor-display,
and wave 1's actual snoozed→silently-missed bug alike, so it proves nothing
about the precedence rule). Replace 479–481 with:

> **Consequences qa-tester must assert:** the load-bearing assertions are
> §6's precedence fixtures — no XP materialises at a case-2 target, the % is
> unchanged by a dormant visitor, and the visitor counts at a case-3 target.
> The §3.5 identity `numerator = denominator − missed` must also hold across
> any snooze, **as a sanity check only** — it is true by definition and does
> not by itself distinguish the precedence rule from its absence.

And replace 1288's "Every fixture must satisfy `numerator = denominator −
missed`, proving exactly one outcome per date." with:

> Every fixture must also satisfy `numerator = denominator − missed` (§3.5
> sanity check); the case-specific assertions above are what prove the
> precedence rule.

**N2 (case-2 off-mark carve-out, 471–473) — FIX.** Amend case 2's
parenthetical to: "(auto chip; pending today, missed once the day has ended —
or **off** if D + 1 is off-marked, per F4)". This mirrors SCHEMA R-1's
"off-marks still resolve `off` as today" and closes the only reading that
pits case 2 against the 533–534 edge case.

**N3 (pre-existing already-snoozed fixture, 1279–1281) — FIX.** After "one
already-snoozed occurrence" insert: "**pinned so its target resolves
precedence case 3** (the visitor displays — e.g. a weekday-cadence task
snoozed onto a not-naturally-due day; this may simply be the same fixture as
precedence fixture (3))". Without the pin, the fixture's "reproducible
on-screen" promise is false for a daily-cadence task.

**N4 (dropped "stay spent" reversal handle, 1710–1711) — FIX (restore).** The
DELEGATED CALL paragraph exists to enumerate the human's reversal handles;
silently narrowing them from three to two undercuts its purpose. Replace the
closing sentence with:

> **Visible to the human: if snooze should be one-way, if a used-once snooze
> should instead stay spent through an undo (undo returns the occurrence but
> leaves it un-snoozable), or if the unreachable dormant-undo case is an
> acceptable tradeoff — those are theirs to decide.**

**N5 (reviewer's self-disclosed pass-2 miss) — NO ACTION.** Recorded;
the unprompted disclosure is exactly what the audit trail should contain.
The DELEGATED CALL paragraph as restored at pass 3 stands.

**Carried wrinkle (§7 OWNER: designer / screen-designer on three items) —
DECLINE for this amendment.** Pre-existing document convention, outside this
amendment's footprint; the new §7 item's escalation clause already routes the
only decisive branch (accepted tradeoff) to the human. Informational note to
the orchestrator: under the PROJECT OVERRIDE these owner labels resolve to
the human at/before Gate 3.

### Sweep — recurrence check (producer runs it; reviewer repeats it)

After applying R0–R4 and N1–N4, run over docs/PRD.md:

- `one[- ]live[- ]outcome|outcome per date|one outcome|more than one outcome|never both|one of them displays`  (case-insensitive)
- `counted per date|live per|displays and counts`  (case-insensitive)

Every hit must satisfy one of: (a) uses the new per-task-per-date name;
(b) sits inside §3.7's three-case block, where scope is per-task by
construction (own occurrence vs that same task's visitor); (c) explicitly
states per-task scope in the sentence. Pre-sweep inventory for reference:
32, 463, 465, 480, 1191, 1282, 1288, 1644, 1674, 1684–1685, 1720 — R0–R4/N1
cover all eleven; the sweep exists to prove nothing else lurks and to make
pass 4 verifiably complete rather than sampled.

### For the reviewer (artifact-reviewer) — pass 4 scope

- All three pass-3 blocking sites are resolved by R1–R3 as worded above;
  R4 and the N-items are resolved as worded. Verify compliance with THIS
  advisory's wording (allowing trivial typographical joinery), not with
  alternative formulations — do not relitigate the choice to rewrite the
  item-21 parenthetical in place rather than move it.
- Re-run the sweep above and apply its (a)/(b)/(c) test. Acceptance test
  (subsumes the pass-3 one): no sentence in the PRD permits the reading
  "a date with two different due or visiting tasks shows or counts only one
  of them," and every restatement is consistent with 526–528's "count
  independently in F5" and §3.5's per-day sum.
- STRUCK / out of scope for pass 4: the §7 OWNER-label wrinkle (declined
  above); any further probing of the N1 assertion's probative value beyond
  the replacement text; any new stylistic findings outside the amendment's
  footprint. New findings are limited to (i) actual errors introduced by this
  commit or (ii) sweep hits failing the (a)/(b)/(c) test.
- Unchanged constraints to verify as before: PRD `STATUS: APPROVED` line
  intact; REQUIREMENTS.md zero diff; footprint is PRD.md only; the
  "mirrored from docs/SCHEMA.md §4.2" citation intact (the rename is
  PRD-local naming — SCHEMA does not use the phrase and is not touched).

Deviation log: none (not cause 4 — SCHEMA's rule is sound; the PRD merely
described it with a scope-dropping name).

Upstream amendment suggested (informational, no action now): none upstream —
SCHEMA §4.2 needs no change. Downstream note for STATE.md's cascade item 3:
when the architect rewrites SCHEMA §4.2 for the one-hop rule, adopting the
"one live outcome per task per date" name there will keep the two documents'
vocabulary aligned.
