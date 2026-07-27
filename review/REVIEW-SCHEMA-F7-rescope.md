# Review — SCHEMA.md §4.2 F7 rescope + MODULES consistency edits (pass 4)
VERDICT: CHANGES_REQUIRED

Pass 4, reviewing commit `ef4c9db` for compliance with the binding
`review/ADVICE-SCHEMA-F7.md` (invocation 1; advisor counter reset, so this is pass 1 of
the new cycle). Per the advisory's reviewer instructions: compliance verified against the
advisory's own table and rulings, struck/ruled items not relitigated, and no findings
raised on the barred topics (the under-count residual, B3/destination-clear as
reductions, DELETE-then-INSERT, the mixed-C6 transient dip). Result: rulings 1–4 are
implemented faithfully and survived every adversarial trace I could construct — including
a new three-row cyclic construction for B3 that the table resolves correctly. **One
narrow blocking item remains: the C8-b fixture row is the only shape without a pinned
expected post-migration ledger (a gap against advisory item 4's explicit mandate), and as
written it can be instantiated in a sub-case where it proves nothing.** Two-sentence fix.

## Blocking items

1. **SCHEMA.md §9 fixture table, row C8-b (line ~872) — under-specified, and
   instantiable non-probatively; advisory item 4 requires the expected post-migration
   ledger pinned PER SHAPE, and this is the one row that lacks it.** The row's "Expected
   after migration" cell states the rationale ("carrier is computed over **all** inbound
   rows, KEPT included") but not the expected ledger state — every other row pins one.
   Worse, the legacy-state cell ("`S1 → T` LONG, `S2 → T` KEPT, award at T") leaves S1's
   date unconstrained, and the branch outcome depends on it:
   - **S1 < T−1** (the intended sub-case): `carrier(T) = MAX(S1, T−1) = S2` (the KEPT
     row) → **branch B2, award LEAVES at T**, S1 revives with no award. A broken
     cleared-rows-only implementation computes carrier = S1 and mis-relocates —
     **the fixture catches it.** This is the shape the advisory says "proves the carrier
     lookup must span kept rows."
   - **S1 > T** (a backward LONG pointer, legal in legacy data per the advisory's own
     LONG definition): `MAX(S1, T−1) = S1` **whether or not KEPT rows are included** —
     correct and broken implementations give the same answer (B1, relocate to S1), and
     the fixture **proves nothing** about the all-inbound rule.
   A fixture author free to pick either sub-case can build a green test over a broken
   carrier lookup — exactly the "coincidentally correct outcome" failure mode this pass
   was asked to screen for.
   **Fix:** pin the row — legacy state gains `S1 < T − 1` (e.g. `S1 = T − 5`), and the
   expected cell gains "**Branch B2.** Award **LEAVES** at T (the KEPT carrier still
   resolves there); S1 revives with its data and **no** award." (This also completes
   explicit branch coverage: M→A, V/C8-a→B1, C8-b→B2, mixed-C6→B3+destination-clear.)
   **Acceptance test:** every row of the fixture table pins both the legacy-state
   parameters that force its intended branch and the expected row-level ledger outcome,
   so no instantiation of any row can pass against an implementation that selects the
   wrong branch.

## The requested B3 adversarial construction, and its outcome

Beyond re-tracing the advisory's shapes, I built a **three-row cyclic construction**
aimed at B3 and the destination-clear: task τ with `A → B` KEPT (A = B−1, visitor's
award at B — B3/destination-clear territory), `B → C` LONG (B's award at C), and
`C → B` LONG **backward** (legal legacy: old moves allowed past targets). This makes B a
target group with mixed inbound `{A KEPT, C LONG}` where the LONG row is also the MAX,
while C is simultaneously a relocation target group of its own — the shape most likely
to double-claim or orphan an award. Outcome, traced through the table:
- Target B: not `live(B)` (B's row carries a pointer); `carrier(B) = MAX(A, C) = C`,
  LONG → **B1**, not B3 — correct, because under the old tie-break C's occurrence (not
  the kept A-visitor) was B's carrier, so the award at B is C's occurrence's and travels
  home to C. The kept A-visitor was shadowed pre-migration and coherently holds no award.
- Target C: not `live(C)`; `carrier(C)` = B's row, LONG → **B1**, award at C relocates
  home to B.
- The two awards **swap**. Both are RELOC sources, so destination-clear correctly spares
  both ("not itself scheduled to relocate"); DELETE-then-INSERT against the frozen
  worklist makes the swap order-independent and UNIQUE-safe (a per-row UPDATE would
  collide either direction). End state: every occurrence home, every award at its own
  occurrence's date with preserved identity, `UNIQUE` intact, §7 award-iff satisfied at
  both B and C. **The table resolves the construction correctly — no defect found.**
Two further probes also held: (i) B3 with a `todo` revived own-row — the visitor's award
is deleted although the reviving occurrence resolves pending/missed; that is exactly
live-C9's semantics ("todo → pending, no award — no phantom"), and the visitor's award
revives via its own undo; (ii) the orchestrator's suggested future-undo race — after
mixed-C6 migration, undoing the kept visitor mints at A via reconcile while B's award is
untouched, and re-snoozing B's own occurrence retracts/re-affirms per C5/C9 with correct
final counts (two completions, two awards). No sequence lets two occurrences claim one
award or strands one permanently.

## Non-blocking notes

- **§7 carve-out, last paragraph: "inside the CR-2 boundary below"** — the
  sanctioned-reduction paragraph sits **above** the carve-out (SCHEMA ~633–637 vs
  ~649–661). Wrong direction word; fix when touching the file anyway.
- MODULES CR-4 mirrors the table **by reference** (step 2 names §4.2's four-branch table
  and its predicates, plus the branch-A hazard) rather than duplicating the four rows.
  I read the advisory's "both mirror sites carry the same table" as satisfied: both
  ordering rules, the no-unconditional-relocation rule, and the no-mint rule are
  physically present in both files, and duplicating the table itself would create the
  drift risk this pipeline keeps paying for. Noting the interpretation for the record.

## Verified

- **Ruling 1 — implemented verbatim.** Predicates (`LONG`/`KEPT`/`live`/`inbound` over
  ALL rows/`carrier` = `MAX(date)`/`revived`) match the advisory exactly, all evaluated
  pre-migration; the A/B1/B2/B3 table matches condition-for-condition, including A's
  residue-own-row exclusion and the one-decision-per-target-group rule; destination-clear
  present; the unconditional UPDATE and the keep-S/delete-T conflict rule are struck
  **and recorded as struck** in a fenced "Superseded" block; the leave-untouched
  rejection is now explicitly conditioned on shape V/branch B1 rather than stated
  unconditionally — every item on the advisory's reviewer checklist for ruling 1.
- **Ruling 2 — implemented.** No-mint pinned in §4.2 with the F1-second-answerer and
  not-expressible-in-SQL reasoning; §7 carries the carve-out with the advisory's fixed
  content (iff at mutation boundaries; migrations relocate/delete, never mint;
  under-count never inflation); B3/destination-clear named in §7 as C9-class shadow
  retraction inside CR-2 — not a new reduction class.
- **Ruling 3 — implemented, and the ordering is sufficient, not merely sequenced.** The
  six steps appear in both files; both load-bearing rules stated in both. Sufficiency
  check: every predicate reads `moved_to_date` (untouched until step 5) or the
  pre-migration award positions (frozen into the step-1 worklist before steps 3–4 mutate
  the ledger); deletions in step 3 only remove rows, so no new destination conflicts can
  appear after the worklist freeze; every pre-existing award at any INSERT destination is
  provably deleted first (either a RELOC source or destination-cleared into KILL);
  distinct target groups cannot share a destination (one row, one pointer — the
  advisory's collision argument, re-derived); steps 5 and 6 depend on nothing steps 3–4
  changed. CR-4 names its own prior step-order defect explicitly, as ruling 3 requires.
- **Ruling 4 — implemented.** The standing principle is present with teeth ("presumptively
  a blocking defect … a raw date-keyed WHERE … is a blocking code-review finding"), all
  four historical instances spelled out concretely, and all five watch sites listed.
- **Identity preservation (orchestrator task 3):** preserved fields match the advisory
  (`id`,`kind`,`amount`,`cycle_id`,`created_at`). Swept every `xp_award` reference in
  docs: nothing keys on award `id` (no FK references it — §10's ER shows only
  `task 0──n xp_award`; achievements, cycle records and F19 backup reference rows/totals,
  not ids), so delete+reinsert of the same UUID PK inside one transaction collides with
  nothing; keeping `cycle_id` unrewritten is consistent with the finalized-cycle-records
  note and keeps a relocated old-cycle award out of the current Cycling XP sum. The
  fixture's same-`id`/`cycle_id` assertions are what distinguish relocation from a
  covert re-mint — correctly probative.
- **Fixtures (orchestrator task 4):** M distinguishes branch A from the unconditional
  UPDATE; V distinguishes B1 from leave-untouched and pins identity; C8-a pins the
  per-target `MAX` against per-row order dependence; mixed C6 pins B3 +
  destination-clear + homecoming identity and pre-declares the transient dip. All
  probative — except C8-b as written (blocking item 1). Scope-of-repair note
  (pointer-caused incoherence only) matches the advisory.
- **Pass-3 non-blocking note applied:** `P4` no longer cited anywhere in either doc; the
  destination-clear paragraph cites §7's `UNIQUE (task_id, date)` instead.
- **Footprint:** `ef4c9db` touches exactly `docs/SCHEMA.md` and `docs/MODULES.md`;
  API.md/ARCHITECTURE.md untouched (correct — the advisory mandated no change there);
  no PRD/REQUIREMENTS/`design-input/**`/`src/**` changes; working tree clean. W-1s/W-1u,
  the runtime case table, the CR-3 Current/Historical structure, and the dormant-undo §7
  open gap all unchanged from their previously-verified state.
