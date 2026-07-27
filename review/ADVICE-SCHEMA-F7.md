# Advisory — SCHEMA.md §4.2 F7-rescope legacy migration (invocation 1)

Root cause: 2 — CAPABILITY GAP, with one genuine embedded policy fork (resolved below).
The architect has now produced the same defect four times in one cascade: acting on the
**calendar date** where an effect is visible, when the contract requires acting on the
**row/occurrence that carries the data** — F1 (`designateCarrier` was created to kill it),
pass-2 N1 (assumed read-side recompute of a mutation-only ledger), pass 3 (the
unconditional date-keyed `UPDATE xp_award SET date = S WHERE task_id = τ AND date = T`),
and — found while verifying this advisory — MODULES CR-4's own step order, which clears
`moved_to_date` (step 2) *before* the award step (step 3) that needs those values to decide
anything. The reviewer's diagnosis is correct in substance; the remaining fork
(mint-vs-accept for a revived unawarded occurrence) is a real judgment call and is ruled
here so no fifth guess is needed. Verified against `7343b0e:docs/SCHEMA.md` (old contract:
R-1 a/b/c, W-4, C4/C4b/C6/C7/C8/C9, the C9 semantic note), `review/ADVICE-M2.md` (P4 at
159; shadow-retraction sanction at 452–455), `docs/API.md` §3 (ledger written only in
mutations), and `docs/SCHEMA.md` §7 (`UNIQUE (task_id, date)` at 536, award-iff at
557–559, sanctioned-reduction boundary at 546–550).

Two facts about coherent legacy data anchor everything below, and both come from the OLD
contract itself:
- **A vacated source holds no award** (old W-4 retracts on vacate) and **a dormant/shadowed
  visitor holds no award** (old C9 semantic note: shadow → retraction, sanctioned,
  recoverable on revival). So in coherent legacy data, an award at `(τ, D)` belongs to
  exactly the occurrence that RESOLVED at D under the old R-rules — the carrier.
- **A clause-(b) date holds no award** (old C4b's own mandatory assertion: blank state, "NO
  XP award materialises"). This is why the migration NEVER needs `natural(D)`/cadence
  resolution: award attribution is decidable from raw row shapes alone — row existence,
  pointer nullity, and `MAX(date)` over inbound rows. No SQL reimplementation of
  `designateCarrier` or `isXpEligible` is needed or permitted.

## BINDING RESOLUTION

### For the producer (architect) — rewrite SCHEMA §4.2's legacy paragraph and MODULES CR-4 step 2–4 to pin exactly this

**Definitions** (ALL predicates evaluate PRE-migration column values; task τ throughout):
- `LONG(r)` — `r.moved_to_date IS NOT NULL AND r.moved_to_date != date(r.date,'+1 day')`
  (the rows being cleared; includes backward pointers — old moves allowed a past target).
- `KEPT(r)` — `r.moved_to_date = date(r.date,'+1 day')` (legal one-hop; survives).
- `live(D)` — a row `(τ, D)` exists with `moved_to_date IS NULL`.
- `inbound(T)` — ALL rows of τ with `moved_to_date = T`, LONG **and** KEPT.
- `carrier(T)` — the row in `inbound(T)` with `MAX(date)` (the old latest-source
  tie-break; `MAX` is correct even when a backward move puts a source date after T).
- `revived(D)` — the row `(τ, D)` exists and is LONG (it becomes live this migration).

**1. Award decision table — one decision per `(τ, T)` target group, never per source row.**
For every `(τ, T)` holding an `xp_award` row where `inbound(T)` is non-empty and the
migration touches T (some inbound row is LONG, or `revived(T)`):

| # | Condition | Ruling | Why |
|---|---|---|---|
| A | `live(T)` | **LEAVE** the award at T | Old clause (a): T's own live log was the carrier; the award is T's own occurrence's. This is the reviewer's shape M — relocating it was pass 3's defect. A residue own-row at T does NOT trigger A (its award, if any, lives at ITS target, per old T-3). |
| B1 | not `live(T)`, `LONG(carrier(T))` | **RELOCATE** the award to `(τ, carrier(T).date)` | Old clause (c): the visitor was the carrier and is being sent home; the award travels with its occurrence (C7 doctrine). Covers shape V and closes C8's order dependence via the per-target `MAX`. |
| B2 | not `live(T)`, `KEPT(carrier(T))`, not `revived(T)` | **LEAVE** at T | The carrier still resolves at T post-migration (a kept-residue own row at T stays residue and does not shadow it). Coherent as-is. |
| B3 | not `live(T)`, `KEPT(carrier(T))`, `revived(T)` | **DELETE** the award at `(τ, T)` | T's own log revives this migration and shadows the kept visitor (new clause (a)). Live semantics for a shadowed visitor are the C9 semantic note: award retracted, sanctioned, recoverable — revival later re-affirms through the snooze/undo mutation's own reconcile (new C5 pins the re-materialisation). The migration reproduces the end state the live system defines for this shape. |

**Destination-clear (part of B1):** any award already sitting at a relocation destination
`(τ, carrier(T).date)` that is not itself scheduled to relocate is **DELETED**. Coherent
legacy holds no award at a vacated source (old W-4), so anything found there is either a
kept visitor about to be shadowed by the homecoming (B3-class, same sanction) or an
incoherent orphan (P4-class cleanup). The pass-3 conflict rule ("keep S's and delete the
orphan at T") is **struck** — it deletes the wrong side in shape M; this replaces it.

So the direct answer to "relocate iff T's award belonged to the visitor, else leave": yes
in principle, with two binding amendments to the reviewer's sketch: (i) the carrier is
`MAX(date)` over **all** inbound rows, kept ones included — restricting to cleared rows
mis-relocates when the kept row was the old carrier; (ii) leave/relocate is a false
dichotomy — the shadowed-visitor shapes require a third outcome, DELETE (B3 +
destination-clear), or the migration leaves silent over-counts that later retract.

**2. Residual gap — RULED: do NOT mint in the migration. Accept and state the under-count.**
A revived occurrence (shape M's S; any B-row whose homecoming brought no award) may
display completed data with no award until the first ordinary mutation touches it, which
re-affirms through reconcile. Reasons, in order of weight:
- Minting requires outcome/eligibility resolution (chip + override + steps + doses +
  off-marks + cadence) — `domain/dayState`/`domain/xp` territory. A SQL re-implementation
  is a second answerer of "what did this occurrence resolve to," the exact F1 defect class,
  and is not even faithfully expressible in plain SQL (JSON step arrays, off-marks,
  cadence).
- The ledger contract is "written only inside mutations" (API §3). Relocation preserves
  that — every row was minted by a mutation once. Minting in a migration breaks it.
- The residual is an **under-count, never inflation**, is invisible to F5/consistency
  (derived), and self-heals on the next interaction. Its shape is already a sanctioned
  state of the live contract: a dormant visitor holds completed data with no award until
  revival re-affirms (C5). This is not a new incoherence class.
Consequently §7's award-iff gains a pinned carve-out (architect words it, content fixed):
*the iff is guaranteed at mutation boundaries; a migration-revived occurrence may
under-hold its award until the first mutation touching it; migrations relocate or delete
ledger rows under §4.2's table, and never mint.* The B3/destination-clear deletions must
be named in §7 as the C9-class shadow retraction reached at migration time — inside the
CR-2 boundary (the occurrence stopped carrying a resolved showing-up state), not a new
reduction class.

**3. `UNIQUE (task_id, date)` ordering — RULED: worklist snapshot, then DELETE, then
INSERT, then clear, then rebuild. All in the one §9 transaction.**
1. Build the decision worklist (temp tables) from PRE-migration values: `RELOC(task_id,
   from_date, to_date)` from B1; `KILL(task_id, date)` from B3 plus destination-clears.
2. Copy relocating rows to a temp table with the new date, preserving `id`, `kind`,
   `amount`, `cycle_id`, `created_at` — **a relocation, never a re-mint**: same identity,
   same amount, and the cycle stamp is NOT rewritten (consistent with §4.2's
   finalized-cycle-records note).
3. `DELETE FROM xp_award` for everything in `KILL` and every `RELOC` source.
4. `INSERT` the temp rows back.
5. Clear all LONG pointers (`moved_to_date = NULL`).
6. Table-rebuild adding the one-hop `CHECK`.
Two orderings are load-bearing and must be stated in both files:
- **Steps 1–4 MUST precede step 5.** Every predicate in the decision table reads
  `moved_to_date`; clearing first makes residue indistinguishable from live and turns
  branch A into pass 3's bug. MODULES CR-4's current step order (normalise at step 2,
  awards at step 3) is therefore itself defective and must be inverted/renumbered.
- **DELETE-then-INSERT, not UPDATE.** SQLite cannot defer a UNIQUE constraint, and legacy
  stores legally contain chain-shaped pointer graphs (old C6: `A→B` and `B→C` as two
  independent rows), where per-row UPDATEs abort or destroy an award depending on
  processing order. Delete-then-insert against the snapshot is order-independent.
  (Relocation destinations cannot collide with each other: one row cannot point at two
  targets, so distinct targets have distinct carrier rows and distinct destinations.)

**4. §9 fixture — extend the mandatory older-version fixture** to contain at least: shape
M (old C4 merge), shape V (old C7 off-cadence completion), old C8 double-inbound (variant
with both sources LONG, and a variant where one source is a legal one-hop), and the mixed
C6 shape (`A→B` kept one-hop with the visitor's award at B, `B→C` LONG with B's award at
C). Pin the expected post-migration ledger per shape: V → one award, moved home; M → T
keeps its award, S revived with data and NO award, one tap at S mints exactly one; C8 →
award follows `MAX(date)` source; mixed C6 → exactly one award at B (the homecoming row,
same `id`/`cycle_id` as the old `(τ, C)` row), the kept visitor's award deleted and
recoverable via its own undo (its data travels home, reconcile re-affirms at A). Assert
row-level effects (which rows changed), not only displayed outcomes. Migration repairs
pointer-caused incoherence only; pre-existing ledger corruption unrelated to pointers
(e.g. an award on a live `todo` row) is out of scope and left to runtime reconcile.

Also apply the pass-3 non-blocking note while rewriting: cite P4 as SCHEMA §7's
`UNIQUE (task_id, date)` (line 536), not as `ADVICE-M2.md` 159.

### For the reviewer (artifact-reviewer)

- **Pass-3 blocking item 1 STANDS** as diagnosis; it is resolved by the table above.
  Nothing in your pass is struck — this was not overreach.
- Your proposed fix shape is **adopted as amended**: carrier over ALL inbound rows (not
  only cleared ones), and the B3/destination-clear DELETE branch added. Pass 4 verifies
  compliance with THIS table, not with your pass-3 sketch where the two differ.
- You must NOT flag, next pass: the R1 under-count residual (ruled, carve-out pinned);
  the B3/destination-clear deletions as unsanctioned reductions (ruled C9-class, inside
  CR-2); DELETE-then-INSERT as an append-only-ledger violation (identity-preserving
  relocation is pinned legal for migrations); the mixed-C6 fixture's transient lifetime-XP
  dip (faithful shadow semantics, recoverable). Your pass-3 acceptance line "lifetime XP
  equal to the sum of genuinely-earned completions" is superseded by the per-shape ledger
  assertions in item 4 — as written it would force minting, which is now ruled out.
- Verify both mirror sites carry the same table and BOTH ordering rules, and that the old
  unconditional-UPDATE and keep-S/delete-T sentences are gone, and that the
  leave-untouched rejection paragraph is now conditioned on shape V rather than stated
  unconditionally.

### Recurrence assessment (question 4)

High. Four instances in one cascade is a mental-model failure, not a typo. Pin one
principle in §4.2 (architect adds; code-reviewer enforces from then on): **any read or
write of `day_log` or `xp_award` keyed by a bare calendar date in snooze-adjacent logic is
presumptively a defect** unless it went through `designateCarrier` (runtime) or this
section's migration predicates (migration time). A raw date-keyed `WHERE` on those tables
is a blocking code-review finding absent that justification. Specific future sites to
watch: `off_day_mark.prior_chip_state` un-mark restore (a date-keyed snapshot — WHICH row
does it restore when the date's carrier is a visitor?); M4's S20 heatmap drill-down
(writes to user-picked past dates — must route through `resolveWriteTarget`, never upsert
`ownLog(date)` directly); backup-restore validation (must not "repair" `xp_award` by date
— same discipline §9 already pins for NULL `task_id`); cycle finalization (window the
ledger by `cycle_id` stamp only, never re-derive by date); and any future sync-merge logic
(F20 is whole-store snapshot today — the moment that changes, this class returns).
qa-tester keeps the C9/C10-style byte-level row assertions for the migration fixture.

Deviation log: none (cause 2, not 4 — no spec relaxation; PRD §3.7 is fully preserved).

Upstream amendment suggested: none to PRD/REQUIREMENTS. The §7 award-iff carve-out and
the §4.2 date-vs-carrier principle are SCHEMA-internal, architect-owned edits mandated
above. PRD §7's open item (undo reachability for a dormant occurrence) is untouched and
remains the human's.
