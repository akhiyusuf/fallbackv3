# Review — SCHEMA.md §4.2 F7 rescope + MODULES consistency edits (pass 3)
VERDICT: ADVISOR_REQUIRED

Pass 3, reviewing commit `7038a2d` against PRD §3.7/Decisions 21, API.md §3's
mutation-sequence contract, SCHEMA §7's award invariants, and the pre-rescope contract
(`7343b0e:docs/SCHEMA.md`) as the source of constructible legacy data shapes. This is the
third consecutive failing pass, which per protocol sets ADVISOR_REQUIRED rather than
CHANGES_REQUIRED. The reason it fails is narrow but real, and it contains a genuine policy
fork that should get one binding ruling instead of a fourth architect guess — details in
the blocking item and the "Why advisor" note.

## Direct answer to the orchestrator's question first

**I independently CONFIRM the double-count claim, and the rejection of "leave the ledger
untouched" was justified.** Trace: under leave-untouched, the normalised occurrence
displays its restored `ideal` at S with no award at `(τ, S)`; any subsequent mutation of
that occurrence (chip tap, step toggle — likely, since S now visibly shows data) runs
API.md §3 step 3, reconcile finds a showing-up outcome with no award, and mints one —
while the stale `(τ, T)` award survives. Two awards, one completion. Confirmed against
the mutation sequence exactly as I verified the pass-2 finding, and yes — this second
fault was not in my pass-2 review; the architect found something I missed.

**However: the chosen fix is also wrong, for the same root cause in mirror image.** The
double-count claim — and the relocation rule built on it — are both true **only in the
shape where the award at T belongs to the visiting occurrence** (T resolved via the old
clause (c): the visitor was T's carrier). Neither the rejected paragraph nor the pinned
rule is conditioned on that, and legacy data legally contains the opposite shape. The
discriminator both texts are missing is carrier designation — and the architect's own
cited precedent already contains it: C7's award travels home *because* "the award keys on
D+1 **while the occurrence shows there**" (T-3). The pinned rule dropped the italicised
condition.

## Blocking items

1. **SCHEMA.md 267–276 (pinned award relocation) + 278–284 (rejection rationale) +
   MODULES.md 240–249 (CR-4 M1 step 3): the unconditional
   `UPDATE xp_award SET date = S WHERE task_id = τ AND date = T` misattributes awards in
   legal, constructible legacy shapes — including the old contract's own required test
   fixtures.**
   - **Shape M (old C4 merge — own log was the carrier).** Task τ due at S and T. User
     completed T's own occurrence (award `(τ, T)` belongs to T's OWN occurrence), then
     moved S's occurrence onto T (old C4: "legal … its own live log winning"; visitor
     dormant; any prior award at S already retracted by old W-4's vacated-source rule).
     This is a legal old-contract end state — it is literally the old **C4 required-test
     fixture**. The pinned UPDATE relocates **T's own occurrence's award** to S:
     T is left displaying `ideal` with no award — violating §7's pinned iff ("An award
     exists **iff** the occurrence … resolved to `ideal` or `fallback`", SCHEMA 557–559);
     and if the dormant visitor's data is `todo`, S now holds an award against a
     pending/missed outcome — manufactured credit, the exact C4b-class incoherence the
     rejection paragraph invokes. Worse downstream: the next mutation at S then
     **retracts** that award (outcome not showing-up) — the migrated award evaporates and
     the net effect is the destruction of T's legitimately-earned award, an unsanctioned
     lifetime-XP reduction outside §7's "ONLY sanctioned reduction" boundary (546–550)
     and outside CR-2's mis-tap-correction scope. The paragraph's own claim "both dates
     are left coherent, so the next mutation touching either is a no-op" (272–273) is
     false in this shape at both dates.
   - **Shape V (old C7 — visitor was the carrier).** T non-natural, visitor completed at
     T, award `(τ, T)` is the visitor's. Here the pinned relocation is exactly right, and
     leave-untouched double-counts. **The old C4 and C7 fixtures — both mandatory tests
     of the previous contract, so both necessarily present in legacy stores — produce
     opposite correct answers under the same unconditional rule.**
   - **Shape C8 (legacy double-inbound).** Old C8 was legal and tested: rows at A1 and A2
     both pointing at B, both now normalised. At most one award `(τ, B)` exists, owned by
     old-C8's resolved carrier (live own log, else latest-source visitor). The per-row
     UPDATE is order-dependent: processing A1 first moves the award to A1 even when the
     carrier was A2's row or B's own log.
   - **The conflict rule (274–276 / MODULES 245–247) can delete a legitimate award.** In
     shape M plus an (inconsistent) stale award at S, "keep S's and delete the orphan at
     T" deletes T's own occurrence's genuinely-earned award — a real reduction,
     contradicting the same paragraph's "a relocation, never a reduction," and it is not
     P4 enforcement, because the two awards belong to two different occurrences (P4 is
     per `(task, date)`, and its inline gloss "one award per occurrence" only holds
     per-shape).
   - **Mechanical sub-point:** `xp_award` carries `UNIQUE (task_id, date)` (SCHEMA 536).
     In the conflict case, running the UPDATE before the delete violates the unique index
     and — since §9 pins migrations as single transactions that roll back fully — aborts
     the whole migration into `STORE_CORRUPT`/S50. The delete-before-update ordering must
     be stated.
   **Fix shape (for the advisor to pin):** condition relocation on carrier designation
   under the old read rules — the award at `(τ, T)` moves to S **iff** the normalised
   S-row was T's carrier (ownLog(τ, T) absent or itself residue; among multiple cleared
   inbound rows, the latest source, matching the old tie-break); otherwise it stays at T.
   Guard the conflict rule to genuine same-occurrence orphans. State the ordering under
   the UNIQUE index. And resolve the **residual policy fork** (below).
   **Acceptance test:** migrating a legacy store containing the old C4, C7, and C8
   fixtures leaves every date satisfying §7's award-iff invariant, lifetime XP equal to
   the sum of genuinely-earned completions, and no award whose provenance is a different
   occurrence's completion.

## Why ADVISOR_REQUIRED and not a fourth architect pass

Protocol: three consecutive failing passes. Substantively: passes 2 and 3 each introduced
a fresh defect in the same migration↔ledger territory, and the correct fix contains a
genuine judgment call the architect should not have to guess at a fourth time:
- **The residual fork.** In shape M, after correct (conditional) relocation, the revived
  occurrence at S carries completed data with **no** award. Under the live system's own
  C1/C4r semantics an undo would re-affirm via reconcile — but a migration has no
  reconcile (the ledger is mutation-only, per this pass's own corrected claim). Either
  the migration **mints** (requires expressing award eligibility at the DB layer — a
  layering question, since `domain/xp` sits above M1), or the residual is **accepted and
  stated** (next mutation at S re-affirms; until then S shows completed data with no
  award — an under-count, tolerable for pre-release fixture data but violating the §7
  iff until healed). Both are defensible; the choice interacts with the layering
  boundary and with what §9's migration fixture must assert. That is an advisor-grade
  call, and one binding ruling ends this loop.

## Non-blocking notes

- **P4 is cited in both files but defined only in `review/ADVICE-M2.md` 159.** The
  inline gloss keeps it readable, but the durable, self-contained citation is SCHEMA
  §7's own `UNIQUE (task_id, date)` at 536 — worth switching to when the paragraph is
  rewritten anyway.
- The corrected factual claim itself (SCHEMA 261–265, MODULES 241–245: F5 derived and
  self-correcting; the ledger mutation-only; no read path reconciles) is **accurate** —
  verified against API.md 176 and 209–217. Pass 2's blocking defect is genuinely fixed;
  what this pass adds on top of it is what fails.

## Verified

- **Pass-2 blocking item: resolved.** The false "XP recomputes on read" claim is gone
  from both files, replaced by the correct ledger/derived distinction with the right
  citation.
- **All three pass-2 non-blocking items landed correctly:** W-1u now carries the full
  "zero writes, zero reconciles, zero events" tail, symmetric with W-1s; C7's row states
  the fixture constraint explicitly and accurately ("D+1 must be NON-natural … a
  naturally-due D+1 would exercise clause (a)/(b) instead, which is C4/C4b" — correct,
  and consistent with PRD §6's pinned weekday-cadence fixture); the §9
  `"schemaVersion": 3` is annotated as illustrative (legal in the jsonc block).
- **Double-count trace (leave-untouched, shape V):** confirmed as described above,
  through API.md §3's mutation sequence — the S-side mint is reachable through ordinary
  user interaction with the visibly-restored occurrence; the rejection stands for that
  shape.
- **Chosen-fix trace (shape V):** conditional on the visitor having been the carrier,
  relocation is correct and lands both dates coherent — the C7-precedent reasoning is
  sound *when its own condition is honored*.
- **CR-2 boundary, third touch:** the relocation itself is not a retraction and does not
  move the boundary; the two ways this pass's rule can reduce genuinely-earned XP (the
  conflict-rule delete in shape M; the retract-after-misattribution cascade) are both
  consequences of the missing carrier condition, not new retraction classes — fixing the
  condition restores the boundary untouched.
- **Migration ordering (MODULES step 4):** normalise-and-relocate before CHECK remains
  correct; the CHECK constraint, W-1s/W-1u, the case table (C5's inverted row, C7's new
  constraint), and the CR-3 Current/Historical structure are all unchanged from their
  pass-2-verified state, re-confirmed by diff.
- **Footprint:** `7038a2d` touches exactly `docs/SCHEMA.md` and `docs/MODULES.md`;
  API.md and ARCHITECTURE.md untouched (correct — nothing in this change affects them);
  no PRD/REQUIREMENTS/`design-input/**`/`src/**` changes; working tree clean. The
  dormant-undo §7 gap remains open and undisturbed in both sites.
