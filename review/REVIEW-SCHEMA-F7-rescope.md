# Review — SCHEMA.md §4.2 F7 rescope (pass 5)
VERDICT: PASS

Pass 5, reviewing commit `be3724e` (C8-b fixture pinned — the single pass-4 blocking
item) plus a fresh whole-document pass across all four affected docs, as requested, since
this artifact has been through five rounds of surgery. Compliance with the binding
`review/ADVICE-SCHEMA-F7.md` was fully verified at pass 4 and nothing this commit touches
disturbs it. **The contract is clean and ready to hand to M2.**

## Blocking items

None.

## The C8-b fix — verified probative, both halves

**The `S1 < T − 1` pin genuinely discriminates.** Walked both implementations against the
pinned shape (`S2 → T` KEPT so `S2 = T−1`; `S1 → T` LONG with `S1 < T−1`; award at T; no
own row at T):
- *Correct* (carrier over ALL inbound rows): `carrier(T) = MAX(S1, T−1) = S2`, KEPT, not
  `revived(T)` → **B2** — award **stays at T**, S1 revives with no award. Matches the
  pinned expected cell exactly.
- *Broken* (carrier over cleared/LONG rows only — the bug this fixture exists to catch):
  carrier = S1, LONG → **B1** — award relocates to S1. The row-level assertion (award at
  T, same row) **fails**. Observably divergent; the fixture now catches the bug.
- The added "**Do not instantiate it with `S1 > T`**" warning correctly fences the
  degenerate sub-case I constructed at pass 4 (backward LONG pointer, where `MAX` picks
  S1 under both implementations and the fixture proves nothing) — and explains *why*,
  so a future fixture author can't reintroduce it innocently.

**The "no own row" addition genuinely closes the B3-vs-B2 ambiguity — and it cannot move
elsewhere.** With no row `(τ, T)`, `live(T)` and `revived(T)` are both structurally
false, killing branches A and B3; with both inbound rows and their date relation pinned,
`carrier(T)` is determined. Branch selection for this target group is now a function with
**zero free variables** — I checked the remaining unpinned parameters (T's cadence, the
rows' chip contents) and none of them feeds the decision table, so there is no adjacent
under-specification for the ambiguity to migrate into. The architect's self-found gap was
real (an own LONG row at T would have flipped the shape into B3/DELETE, silently
contradicting the pinned B2 expectation) and the fix is complete.

**Branch-coverage paragraph verified:** A by M; B1 by V, C8-a, and mixed-C6's `(τ, C)`
target; B2 by C8-b; B3 + destination-clear by mixed-C6's `(τ, B)` target — I re-derived
mixed-C6's two target-group branch selections and the claim is accurate. All four
branches plus the destination-clear are now exercised by pinned, row-level-asserted
fixtures.

## Fresh whole-document pass — observations, all non-blocking

1. **`inbound` is defined twice in §4.2 with different arities** — the migration
   predicate table (line 274: set-valued over ALL rows, pre-migration, ties possible)
   and the runtime definitions (line 379: at most one, provable from the CHECK). The two
   blocks are explicitly scoped ("Migration predicates — ALL evaluated against
   PRE-migration column values" vs the runtime "Definitions"), are mutually aware (the
   runtime note declares the tie-break dead; the migration block cites it as "the old
   latest-source tie-break" resurrected once for pre-CHECK data), and the migration
   vocabulary is the binding advisory's own — renaming it would deviate from the
   advisory for a cosmetic gain. Recorded so a future reader isn't surprised; no action.
2. **C8-a and C8-b do not pin T as off-cadence** the way shape V does. Derivable: by the
   section's own coherence facts, an award at a natural, rowless T would be a
   clause-(b) violation — pre-existing corruption, explicitly out of the migration's
   scope — so a coherent instantiation forces T off-cadence. Branch discrimination and
   every pinned ledger assertion are cadence-independent, so this cannot make either
   fixture pass wrongly. Cheap to add if the file is touched again; not worth a sixth
   pass.
3. **Record correction on the orchestrator's mechanical check:** "zero fragments of the
   four-branch table in MODULES" is overstated — predicate *names* appear at MODULES
   243/252/256 as reference pointers inside CR-4's steps. The substantive claim is
   nonetheless confirmed: no definitions, no conditions, and no table rows are
   duplicated; the branch logic lives only in SCHEMA §4.2 (16 cross-references point
   there), which is exactly the drift-safe mirror-by-reference I accepted at pass 4.
4. Cosmetic: the §7 carve-out's re-wrapped last sentence breaks awkwardly ("class, and /
   they are recoverable"). Formatting only.

## Verified

- **The pass-4 blocking item is resolved as specified:** the C8-b row pins both the
  legacy-state parameters that force branch B2 (`S1 < T−1`, `S2 = T−1` KEPT, no own row)
  and the expected row-level ledger outcome (award LEAVES at T; S1 revives with no
  award), and the accompanying rationale paragraph makes the fixture's discriminating
  condition and its forbidden instantiation explicit.
- **Both pass-4 non-blocking notes closed:** "inside the CR-2 boundary **defined
  above**" is now directionally correct (checked against actual §7 layout: the
  sanctioned-reduction paragraph precedes the carve-out); the mirror-by-reference
  question is settled per observation 3.
- **Nothing else moved.** `be3724e` touches exactly `docs/SCHEMA.md` (three hunks: the
  direction word, the C8-b row, the two new fixture paragraphs); MODULES/API/
  ARCHITECTURE byte-identical to their pass-4-verified state; working tree clean; no
  PRD/REQUIREMENTS/`design-input/**`/`src/**` changes.
- **Whole-artifact state re-confirmed across the five passes:** the advisory's four
  rulings implemented and adversarially traced (pass 4, including the three-row cyclic
  B3 construction); W-1s/W-1u split sound under adversarial reading (pass 2); the
  runtime case table C1–C14 with C5 inverted and C7's fixture constraint (passes 2–3);
  the CR-3 Current/Historical restructure with the F1-hazard eliminated (pass 2); the
  CHECK constraint, CR-4's six-step load-bearing order, and the standing
  date-vs-carrier principle with its five watch sites (pass 4); no bare `W-1`
  references anywhere; the dormant-undo PRD §7 gap still genuinely open and un-invented
  in both SCHEMA and the M4 brief.

## Handoff note

This contract is ready for M2. For the record, the things M2 must not miss are all
pinned in-document: build against §4.2's runtime rules and W-1s/W-1u (not the Historical
block of CR-3), the single-answerer discipline (`designateCarrier` /
`resolveWriteTarget`) survives the simplification untouched, the migration is CR-4's
six-step order exactly, and the standing principle makes any bare date-keyed
`day_log`/`xp_award` access a blocking code-review finding from here on.
