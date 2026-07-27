# Advisory — M2 (invocation 1)

Root cause: 1 — SPEC AMBIGUITY (a genuine gap, not two readings of one sentence).
F7's move semantics exist upstream as one sentence ("Move/snooze affects the
occurrence, not the cadence" — PRD §3.7, SCHEMA §4's `moved_to_date` column note,
ALLSCREENS S20's one interaction line). Nothing upstream defines composition: un-move,
same-day, chains, merges, or moves involving already-vacated dates. B1 lives exactly in
that gap, and so does at least one further defect the review did not find (case C6
below), which I verified against `src/domain/dayState.ts:92-94` — and which the pass-3
"good looks like" prescription does NOT fix. A contributing execution pattern (M2 fixes
the named case, tests the named criteria, and does not explore the compositions its own
fix creates) is real but secondary; it is addressed by Ruling 2. This module is
converging, not thrashing — the resolution below is a contract to finish against, not a
rebuke.

Advisory verification performed: re-ran `npx jest src/domain src/queries --forceExit`
(11 suites, 147 tests, green); traced B1 and C6 by direct inspection of
`src/queries/mutations.ts:583-617`, `src/queries/internal.ts:56-63,116-122`, and
`src/domain/dayState.ts:88-106`; confirmed no cross-repository transaction primitive
exists on the `Repositories` port (transactions are internal to M1's migrations/backup
only), which shapes W-3 below.

---

## BINDING RESOLUTION

### Ruling 1 — For the producer: F7 move semantics are pinned by the following contract

This table supersedes the pass-3 review's "good looks like" prose. Implement against
it, not against any review text. It requires NO schema change: `day_log.moved_to_date`
keeps its exact shape; only its semantics are pinned.

**Definitions** (for task τ, date D):
- `ownLog(D)` — the `day_log` row keyed `(τ, D)`, if any.
- `pointer(D)` — `ownLog(D).movedToDate` when non-null. A row with a non-null pointer
  is RESIDUE for its own date: its chip/step data belongs to the occurrence that left,
  and it neither vacates a date that has a moved-in record nor supplies data to one.
- `inbound(D)` — rows `r` with `r.movedToDate === D` (searched within the existing
  ±60-day window). Tie-break for multiple inbound rows: latest source `date`
  (unchanged from current `buildMovedInIndex`).
- `natural(D)` — `isDue(τ, D, notBefore)`.

**READ RESOLUTION** — `resolveOccurrence`, replacing the current check order:

```
R-1  if a moved-in record exists for D (inbound non-empty):
       D IS due — regardless of natural(D); off-marks still resolve `off` as today.
       effectiveLog := ownLog(D) if it exists AND pointer(D) is null   (a real user
                        action on D wins — pass-2 N1's rule, unchanged)
                     else the moved-in record (existing tie-break).
       A vacated own log (pointer non-null) NEVER annihilates a moved-in occurrence
       and NEVER supplies its data — it is residue (see C6).
R-2  else if pointer(D) is non-null: not-due (vacated). Unchanged.
R-3  else: the existing natural resolution. Unchanged.
```

The only delta from today's code is that the vacate check yields to a present
`movedInLog`, and a vacated own log is excluded as a data source. With no move in
play, behaviour must remain byte-equivalent to the pass-3-verified code — the same
regression standard the reviewer applied at pass 3 holds.

**WRITE** — `useMoveOccurrence(τ, F, T)`. Validate everything, then write:

```
W-0  F === T → no-op: return ok with the current occurrence. Zero writes, zero
     reconciles, zero events.
W-1  Resolve F via resolveOneOccurrence (under the R-rules above). If outcome is
     'not-due' → reject VALIDATION_FAILED, zero writes. (Never fabricate an
     occurrence from a never-due date; never move from an already-vacated date —
     the occurrence is moved from where it currently lives.)
     Any other outcome — pending, ideal, fallback, missed, off — is movable.
W-2  Distance guard, measured from the row that will CARRY each pointer, never
     from F: every redirected inbound row r must satisfy |r.date − T| ≤ 60
     (MOVE_SEARCH_PAD_DAYS); in the own-pointer branch, |F − T| ≤ 60. Any
     violation rejects the whole move with zero writes. (The current |F − T|
     check is wrong under chain collapse: S→B at 59 days then B→T at 59 more
     puts the pointer 118 days from its row and silently outruns the search
     window.)
W-3  Writes — the branch is chosen by inbound(F), nothing else:
     if inbound(F) is non-empty:                 [the VISITING occurrence moves]
        for each r in inbound(F):
           r.date === T → set r.movedToDate = null          (un-move: going home)
           r.date !== T → set r.movedToDate = T             (chain collapse / redirect)
        ownLog(F) is NOT touched in this branch — no pointer is ever written onto
        a date whose due-ness is conferred by a move, and a residue pointer on F
        (its own occurrence away elsewhere) is never hijacked.
     else:                                        [F's own live occurrence moves]
        upsert ownLog(F).movedToDate = T  (preserving existing chip/step data,
        as today).
     Ordering note: there is no transaction primitive on the Repositories port.
     Write cleared/redirected inbound rows first, one at a time — every
     intermediate state is a legal state under the R-rules — and on a mid-
     sequence persistence failure return the error and reconcile the dates
     already touched. No compensation logic is required or wanted.
W-4  Reconcile every touched date (F, T, and each written r.date) through
     reconcileOccurrence; emit day:logged for T exactly once. XP changes only
     through those reconciles: vacated showing-up sources retract (existing CR-2
     boundary), restored sources re-affirm.
```

**Named cases — each row below is a required test, asserted end-to-end through the
public surface (hooks + reads), not through internals:**

| # | Sequence | Required end state |
|---|---|---|
| C1 | A→B, then B→A (undo the snooze; A natural) | `ownLog(A).movedToDate = null`; no pointer anywhere; A due with its prior chip/step data and a previously-earned award re-affirmed; B not-due; denominator restored |
| C2 | A→A | no-op per W-0 |
| C3 | A→B, then B→C | exactly one pointer, `ownLog(A) → C`; due at C only; C→A afterwards restores A per C1. Guard: \|A − C\| ≤ 60 |
| C4 | A→B where B is naturally due (merge) | legal; A vacated (leaves the denominator); B unchanged — one occurrence, its own live log winning |
| C4r | …then B→A (un-merge) | inbound branch: clears `ownLog(A)` only; A due again with prior data; B's natural occurrence untouched — exact restore |
| C5 | A→B merged, then B→C | the VISITING occurrence moves: `ownLog(A) → C`; B's natural occurrence remains due at B. (To move B's own occurrence, move the visitor away first — deliberate, last-in-first-out) |
| C6 | task due A and B; B→C, then A→B | A's occurrence is DUE at B via its moved-in record (R-1) — B's residue outbound pointer does not annihilate it; B's own occurrence stays at C. **This is the case the pass-3 prescription does not fix** |
| C7 | A→B, complete at B, then B→A | A restored per C1; B resolves not-due and its award is retracted by reconcile; `ownLog(B)`'s chip data remains as dormant residue (D-rule) |
| C8 | A1→B and A2→B (double inbound) | both sources vacated; one occurrence at B; data = live `ownLog(B)` if any, else latest-source moved-in (existing tie-break) |

**D-rule (dormant data, pinned so it is not relitigated):** a `day_log` row's chip/step
data is per-date state. It is inert while no occurrence resolves at that date and
revives if an occurrence returns there (C1's restore; symmetrically, re-moving onto a
date with prior data revives that data and reconcile re-affirms). This mirrors F4's
"restore what was logged" and is intended behaviour, not a defect.

**Boundary notes:** T may be past or future — a past T resolves under the ordinary
past-date rules (an unlogged past target reads missed; that is coherent, not a bug).
A move onto an off-marked date resolves `off` with no retraction, exactly as verified
at pass 3.

### Ruling 2 — For the producer: invariant harness, required with this fix

The reviewer's remedy ("compose the operation with itself and its inverse") is
endorsed AS AMENDED — as literally worded it would have caught B1, the restamp half of
N2, and N4 only with fail injection added; it would NOT have caught N1 (move ×
complete is a cross-operation composition), N5 (an event-count property), or N3's
essence (an interval-disjointness state invariant). What is binding is the
generalisation that catches all seven pass-2/pass-3 defects:

(a) **Move-composition exhaustiveness.** One task, cadence due on exactly {D1, D3} of
a 5-consecutive-date domain {D1..D5} (this makes natural, off-cadence, merge, un-move
and vacated-target shapes all reachable). Enumerate ALL sequences of ≤ 3
`useMoveOccurrence` calls with F, T ∈ the domain, against in-memory fakes; a variant
interleaving one completion. Assert the pack below after every sequence. This is
mechanical enumeration, not probing — it is how M2 finds the rest of this class
instead of the reviewer finding it.

(b) **Cross-operation pairs.** For each ordered pair drawn from {move, logState,
toggleStep, markOffDay/unmark, updateSettings-cadence} composed on the same and on
adjacent dates, one test asserting the pack. This is the piece that would have caught
N1, N2 and N3.

(c) **Fail-injected retry idempotence** for every multi-write mutation: fail each
write in turn, re-run to success, assert the end state equals an unfailed run's. This
is N4's class, and it covers W-3's ordered multi-row writes.

**The invariant pack** (asserted through the public read surface):
- P1 — the mutation's returned occurrence/xpAwarded agree with a subsequent read of
  the same (task, date).
- P2 — `numerator === denominator − missed`, both scopes (already pinned, §6.2).
- P3 — lifetime XP monotone except across a sanctioned-retraction step; never reduced
  by an off-mark.
- P4 — at most one `xp_award` per (task, date); re-affirmation preserves `cycleId`.
- P5 — cycle records pairwise interval-disjoint; the pointer at/after every record end.
- P6 — exactly one `level:up` per level crossing; exactly one `day:logged` per
  day-changing mutation.
- P7 — I-move: no row's `movedToDate` equals its own date; after any accepted move
  sequence every original occurrence resolves due at exactly one date or shares a
  date via merge (annihilation impossible); any single accepted move is reversible by
  the opposite move in the single-visitor case.

Going forward (binding on M2 for the remainder of its build): any new mutation-layer
state ships with its pack assertions and its composition cases in the same commit.

### Ruling 3 — For the reviewer

- **B1 stands.** Nothing from the pass-3 blocking list is struck; there was no
  overreach in any pass.
- **Scope substitution:** verify the fix against Ruling 1's table, NOT against the
  pass-3 "good looks like" prose — that prose is superseded (it leaves C6 broken).
  Compliance means: the R-rule precedence delta confined to move-present paths
  (no-move behaviour byte-equivalent, same standard as your pass-3 regression sweep);
  W-0/W-1/W-2 rejections tested; the guard measured from the pointer-carrying row;
  W-3's branch choice by `inbound(F)` alone with ordered writes; C1–C8 each tested
  end-to-end; harness (a)–(c) present with P1–P7.
- **One pass-3 non-blocking note is overridden:** the instruction to keep the
  "chained move vacates B without resurrecting A" dayState test as re-worded
  defence-in-depth. Under R-1 that construction is reachable (C6) and now resolves
  DUE via the moved-in record — the test must be inverted to assert C6's outcome, not
  kept asserting vacation.
- **Do not relitigate:** the merge semantics (C4/C5, last-in-first-out), the D-rule's
  data revival, the 60-day guard's existence, the ordered-write approach in lieu of a
  transaction, and the harness's domain size. These are decided.
- **Re-invocation criterion:** if pass 4 fails, it must fail either on non-compliance
  with this table (cite the row) or on a defect outside the move feature. A new
  move-composition defect inside the table's domain is a compliance failure, not an
  ambiguity — this contract does not get reopened, it gets enforced.

### Ruling 4 — Module boundary (recorded so it is not reopened)

M2's boundary is correct; do not split it. The defect clusters were compositional —
move pointers × the XP ledger × the cycle pointer meeting in `reconcileOccurrence` —
and composition does not respect module boundaries: a split would convert in-module
interactions into cross-module contract gaps reviewed by nobody, while churning
MODULES.md, the freeze list, and five wave-2 briefs for zero reduction in defect
class. A 10 → 5 → 1 burn-down with zero recidivism on the largest correctness surface
is a normal convergence curve, not overload. The correct mitigation for M2's risk
concentration is Ruling 2, which is now in force.

## Deviation log

None. This is a gap filled, not a spec relaxed — no upstream sentence is contradicted;
"affects the occurrence, not the cadence" is preserved by every row of the table.

## Upstream amendment suggested (informational — architect owns these files)

- `docs/SCHEMA.md` §4: add a §4.2 "`moved_to_date` semantics" mirroring Ruling 1's
  R-rules, W-rules and case table verbatim (column shape unchanged; semantics only).
  Route as architect change request CR-3 through the orchestrator, per the CR-1/CR-2
  pattern in `docs/MODULES.md`. M2 does NOT wait for it — this ADVICE is the binding
  copy now; the amendment is so wave-2 (M4 builds the snooze UI on S20) reads a
  contract, not a review trail.
- `docs/ARCHITECTURE.md` §6.1: one footnote on the outcome table — moved-in due-ness
  precedes the vacate check (R-1 before R-2).
- `docs/MODULES.md` M4 non-negotiables: one line pointing the snooze/move UI at
  SCHEMA §4.2 once it lands.

---
---

# Supplementary ruling — M2 (invocation 1, Supplement A) — 2026-07-27

The original advisory above stands byte-for-byte unmodified; this supplement is
append-only and states explicitly which clauses it amends. It rules on one genuine
contract ambiguity and three operationalisation questions raised by M2 after
implementing the ruling (38 suites / 295 tests green). M2's choice to flag all four
rather than deviate silently is exactly right and is the required pattern for
anything else the table underdetermines.

Amendment index: S1 REPLACES Ruling 1's R-1 effectiveLog formula and amends case rows
C4 (new variant C4b) and C8 (data clause). S4 TIGHTENS P7's reversibility clause in
Ruling 2. S2 and S3 amend nothing — they confirm M2's implementation as compliant and
bind the reviewer to those readings. Everything else in the original stands as
written.

## S1 — BINDING, amends Ruling 1: merge onto a naturally-due, never-logged date — the target's own blank state wins

M2 read the literal formula correctly and correctly identified the ambiguity: R-1 as
originally written keys on row EXISTENCE, so an unlogged natural target falls through
to the visitor's data. That literal reading is REJECTED. C4's already-stated intent —
"B unchanged" — governs: **a merge never changes what the user sees on the target
day, logged or blank.**

Rationale (recorded so it is not relitigated):
- Merge is joining, not overwriting. The merged occurrence is the target's own
  occurrence with the visitor absorbed; the visitor's entire contribution to the
  target is the vacation of its own source date.
- The literal reading mints outcomes from imported data: moving a COMPLETED
  occurrence onto an unlogged natural due date — possibly today, possibly in the
  future — would make that date resolve `ideal` off the imported done chip, and
  `reconcileOccurrence` would award XP for a day the user never touched. I verified
  this consequence against the implemented data flow; it alone decides the direction.
- Symmetry with the rest of the table: the visitor's data travels only where the
  visitor IS the occurrence (off-cadence targets; C6's natural-but-vacated targets).
  Where the target's own occurrence is present, the target's state — logged or
  blank — is the occurrence's state, and the visitor's data lies dormant at its
  source (D-rule), reviving on un-move with its award re-affirmed by reconcile.

**R-1's effectiveLog formula is REPLACED by this three-clause version. The due-ness
clause ("a moved-in record makes D due; off-marks still resolve `off`") and the
residue principle are unchanged:**

```
R-1  if a moved-in record exists for D: D IS due.
     effectiveLog :=
       a. ownLog(D), if it exists and pointer(D) is null        [a real state at D
          always wins — pass-2 N1's rule, unchanged]
       b. else null, if natural(D) and ownLog(D) is absent      [D's own occurrence
          is present and never logged: the merge keeps D's blank state — auto chip,
          pending/missed by date; the visitor's data stays dormant at its source]
       c. else the moved-in record (existing latest-source tie-break)   [the visitor
          is the only occurrence present: a non-natural date, or C6's
          natural-but-vacated date]
```

Clauses (a) and (c) are behaviour-identical to the original formula; clause (b) is
the amendment. Clause (c) is exactly what C6 relies on — **C6 is unchanged**, as are
every W-rule, all due-ness and denominator behaviour, and the pass-3-verified traces
(own-live-log-wins merge; move-to-off-cadence-then-complete).

**Case table amendments:**
- C4 gains a required variant, **C4b**: A→B where B is naturally due and NEVER
  logged → B still resolves by its own blank state (auto chip; pending today, missed
  past); the visitor's chip/step data contributes nothing at B, and — assert this
  explicitly with a completed visitor — NO XP award materialises at B; B→A afterwards
  restores A with its data and re-affirms its award per C1/C4r mechanics.
- C8's data clause becomes: "data = live `ownLog(B)` if any; else, if B's own natural
  occurrence is present, B's blank state; else latest-source moved-in."

**For the producer:** implement clause (b) and add the C4b test. This is a contained
change in the R-rule resolution; the no-move byte-equivalence standard still applies.
**For the reviewer:** verify C4b including the no-award assertion, verify clause
(c)/C6 behaviour is unchanged, and do not relitigate the merge-keeps-target-state
choice — the rationale above is the record.

**SCHEMA §4.2 amendment (route to the architect as an update to CR-3; the ADVICE and
SCHEMA copies must not drift):** replace §4.2's R-1 effectiveLog formula with the
three-clause version above, verbatim; add the C4b row; replace C8's data clause. No
other change to §4.2. S2–S4 below are harness operationalisations under Ruling 2 and
do NOT belong in SCHEMA §4.2.

## S2 — BINDING clarification of P2: per-task scope only; M2's implementation is compliant

M2's reasoning is correct and matches the spec. `numerator === denominator − missed`
is stated for per-task scope (ARCHITECTURE §6.2 — "Unchanged by the fractional
aggregate rule"), and no literal aggregate analogue exists: the aggregate numerator
is a sum of fractions, and the aggregate "missed" legend figure is a post-rounding
remainder that §6.5 explicitly pins as a deliberately different unit from its
neighbours. Mandating a rounded aggregate identity would contradict §6.5. P2's
original wording "both scopes" is corrected to per-task scope only; the reviewer must
not demand an aggregate P2. Aggregate arithmetic remains policed by the §6.6 golden
anchors on unchanged, pass-1-verified code, and by P1/P7 guaranteeing the occurrence
sets it consumes.

## S3 — BINDING confirmation of the P3 weak/full split: correct as implemented

The split matches where the defect classes live. In section (a)'s move enumeration,
retraction and re-affirmation are LEGITIMATE (vacate/restore per W-4), so asserting
full monotonicity there would require an oracle of sanctioned steps — added modelling
complexity that can itself be wrong — while ledger-sum-equals-`lifetimeXp` plus
non-negativity plus P1/P4 already pin XP correctness against wrong resolutions in
that space. The full form belongs exactly where M2 put it: section (b)'s
mark/unmark-off round trip (N2's defect class), asserting lifetime XP unchanged at
the midpoint and the end. Confirmed compliant; no change.

## S4 — BINDING, tightens P7: two named cases are NOT sufficient; mechanical reversal is required over the pair space (full triple-space reversal is not)

The orchestrator's instinct is right — this is the shaped hole. The enumeration's
invariant pack is a liveness net: it catches annihilation (B1/C6's class) but is a
weak oracle for state-residue bugs. A reversal that restores due-ness but corrupts
dormant data (a D-rule interaction) passes every liveness assertion and both named
cases unless the corruption happens to occur in exactly C1's or C4r's shape — which
is precisely where the next class member would hide. But full mechanical reversal
over all 16,275 length-3 sequences buys third-order coverage at the disclosed 2–3×
runtime cost; not proportionate.

Binding middle path — for every ACCEPTED sequence of length ≤ 2 (~650 sequences):
snapshot the full five-date resolution map (due-ness + outcome + effective chip per
date) immediately before the final move; apply the inverse of that final move (T→F);
assert the resolution map equals the snapshot. Exception, per P7's original
single-visitor caveat: where the final move's target already carried an inbound
pointer before that move (the multi-visitor case), assert only P7's liveness clauses
for the reversal, not snapshot equality. W-0 no-ops are excluded (trivially
reversible). Compare RESOLVED state, never raw rows — ids and timestamps are not part
of the contract. This generalises C1/C4r from two shapes to every
reachable-in-≤2-moves shape at a few seconds' cost; C1 and C4r remain as named,
human-readable anchors. Length-3 sequences stay covered by the existing pack, and
full length-3 reversal is explicitly NOT required — do not add it.

## Disposition

- S1: changes code + tests (R-1 clause (b); C4b) and SCHEMA §4.2 (exact amendment
  above, via the CR-3 update).
- S4: changes tests only (pair-space reversal added to harness section (a)).
- S2, S3: no changes — M2's implementation is confirmed compliant; the reviewer
  verifies against these readings and does not reopen them.
- The reviewer's in-flight compliance pass folds S1 and S4 into its checklist;
  neither invalidates any already-verified item.

---
---

# Supplementary ruling — M2 (invocation 1, Supplement B) — 2026-07-27

The original advisory and Supplement A stand byte-for-byte unmodified; this
supplement is append-only. It rules on F1 (a write-side contract gap found on the
Supplement-A compliance pass — a genuine gap, correctly routed here rather than
pinned ad hoc) and specifies F2, the test class that cannot exist until this rule
does. It also records that the reviewer's structural proof of clause (b)/C6
consistency is accepted: its "only useMoveOccurrence writes pointers" lemma is
promoted below from an emergent property to an asserted invariant (P8b), so the
proof's premise is enforced from now on, not merely observed.

Amendment index: B1 ADDS a write-side rule (T-1..T-3) to Ruling 1, one sentence to
the D-rule, and case rows C9/C10/C11 to the case table. B2 ADDS invariant P8 to
Ruling 2's pack and the F2 harness extension to section (b). Nothing in the R-rules,
W-rules, Supplement A's three clauses, C1-C8, or S2-S4 changes.

## B1 — BINDING, amends Ruling 1: occurrence-data writes follow the read's carrier; residue is immutable; not-due writes are rejected

F1's root: reads resolve a CARRIER (Supplement A's clauses a/b/c) while writes
address storage by DATE-KEY (`(task, tappedDate)` upsert). Wherever those two
disagree, the tap is invisible and the write corrupts state belonging to a departed
occurrence. This is the write-side twin of pass-2 N1, and it gets the same medicine:
one construction, consumed by both sides.

**Disposition of the coordinator's candidates (recorded so it is not relitigated):**
- Candidate 1 (redirect to the resolved carrier) — ADOPTED, for the case where a
  visitor is the occurrence. What the user sees is what gets touched.
- Candidate 2 (implicit un-move, then tap) — REJECTED. A log action must never
  mutate scheduling state: it would silently undo a deliberate move, turn a chip tap
  into a two-effect operation no approved screen hints at, and break the
  moves-are-the-only-pointer-writers exclusivity (P8b) that the reviewer's
  structural proof of clause (b)/C6 consistency rests on.
- Candidate 3 (reject) — ADOPTED, but ONLY where nothing resolves at the date.
  Rejecting the tappable C6-shape would make a visibly-due occurrence uncompletable —
  a product regression with no design support.
- "Design-level decision" — NOT NEEDED. The approved screens already decide this:
  S09/S20 render exactly one occurrence per (task, date) with a tappable chip
  whenever due; "what you see is what you touch" is forced by that, and no new
  design surface exists to consult.

**T-rule (write-side carrier selection) — applies to every occurrence-data mutation:
`logState`, `toggleStep`, `useLogDose`. Appended to Ruling 1 after the W-rules:**

```
T-1  Resolve D through the R-rules first. If the occurrence at D resolves
     `not-due` — a vacated source (R-2), or a plainly not-due date — REJECT the
     write: VALIDATION_FAILED, zero writes, zero reconciles, zero events. There
     is no occurrence at D to log. This is load-bearing twice over: it protects
     residue rows from the write side (C10), and it closes the fabrication path
     where an inert row written on a not-due date is later adopted as clause-(a)
     truth by a move-in — phantom credit with no residue involved at all (C11).
T-2  Otherwise write to the occurrence's data carrier, designated by the SAME
     clause selection the read uses:
       clause-(a) shape — ownLog(D) exists, pointer null → update ownLog(D).
       clause-(b) shape — natural(D), no own row (visitor dormant or absent),
         and the plain R-3 rowless case → create ownLog(D) fresh, pointer null.
       clause-(c) shape — the visitor is the occurrence (non-natural D, or
         natural-but-vacated / C6-shape D) → update the WINNING moved-in row
         (the row at its source date; latest-source tie-break), changing only
         its chip/step/dose/override fields and PRESERVING its movedToDate.
         ownLog(D), if present as residue, is NOT touched.
T-3  Reconcile and emit against D, the resolved date, exactly as today: the XP
     award keys on (task, D); `day:logged` carries D. Only the addressed row
     changes.
```

**Structural requirement (same discipline as N1's fix):** ONE pure
carrier-designation function — in `src/domain` beside `resolveOccurrence` — returns
`own-live | own-create | visitor(row) | none` for a `(log, movedInLog, natural)`
triple. `resolveOccurrence`'s effectiveLog selection and a query-layer write-target
resolver (in `internal.ts`, beside `resolveOneOccurrence`) BOTH consume it. No
second implementation of the clause selection may exist anywhere. F1 happened
because reads and writes answered "which row is this occurrence?" independently;
after this fix the question must have exactly one answerer.

**D-rule addition (one sentence):** residue rows are immutable to every mutation
except `useMoveOccurrence`; dormant data can change only by the occurrence returning
home — and data a tap writes to a visitor's row is the visiting occurrence's own
state, travelling with it exactly as C7 data does.

**Semantic note the reviewer must not flag as a defect:** after C9's tap-on-visitor,
a later un-move of the date's own occurrence shadows the visitor (merge doctrine,
Supplement A: the target's own state wins), so the visitor's tapped completion goes
dormant on its row and its award at that date is retracted by reconcile — sanctioned
under CR-2 (the resolved occurrence at that date stopped carrying a showing-up
state), and fully recoverable by the visitor's own un-move. Transient retraction
during shadowing is the merge doctrine working, not value loss.

**New case rows (required tests, end-to-end through the public surface):**

| # | Sequence | Required end state |
|---|---|---|
| C9 | due {A,B}; B→C; A→B; then chip/step tap on B | tap VISIBLE at B (outcome per tap; XP for (task,B) iff eligible); the write landed on A's row (the visitor), its pointer intact; residue ownLog(B) byte-unchanged. Then C→B (own occurrence returns): B resolves by its own uncorrupted dormant data (todo → pending, no award — no phantom); visitor's award at B retracted (see semantic note); B→A afterwards revives the visitor's tapped data at A with its award re-affirmed |
| C10 | A→B; then any occurrence-data write on A | VALIDATION_FAILED; ownLog(A) byte-identical; zero events, zero XP delta; subsequent un-move revives A exactly as pre-move |
| C11 | any occurrence-data write on a rowless not-due date | VALIDATION_FAILED, zero writes — and therefore a later move-in to that date finds no fabricated clause-(a) row |

**Generalisation ruling (the coordinator's question 2):** F1 is broader than its
discovery vector. The class is "any occurrence-data write addressed to a date whose
carrier is not the date-keyed row", and it has three members: (i) the tappable
C6/chain-target shape (visitor present + residue own row) — fixed by T-2's clause-(c)
redirect; (ii) EVERY vacated source date — a single move suffices, no C6 shape
needed: A→B then a write to A corrupts A's dormant data invisibly — fixed by T-1;
(iii) rowless not-due dates — the write currently fabricates an inert live row that
a later move-in adopts as clause-(a) truth — fixed by T-1. Plain chains expose only
members (ii)/(iii): after collapse, A is residue (T-1 rejects) and B is rowless
not-due (T-1 rejects); a tap on B BEFORE the second move is the ordinary clause-(a)
own-create, already correct and C7-covered. C1/C2/C4/C4b/C5/C7/C8 end-states expose
nothing new: their carriers are own-live, own-create, or the winning visitor, all
handled by T-2. Note for wave 2: M4's S20 heatmap drill-down writes to arbitrary
past dates, so T-1 is load-bearing product surface, not defence-in-depth.

## B2 — BINDING, amends Ruling 2: invariant P8 and the F2 harness extension

**P8 (added to the pack):**
- P8a — residue immutability: across any mutation other than `useMoveOccurrence`,
  every row with a non-null `movedToDate` is byte-identical before and after
  (snapshot-compare all residue rows around each op).
- P8b — pointer-writer exclusivity: no mutation other than `useMoveOccurrence` ever
  sets, clears, or changes any row's `movedToDate`.
- P8c — write visibility: an ACCEPTED occurrence-data write is always visible — the
  post-write read at the tapped date reflects the written data, and the mutation's
  returned occurrence equals that read (P1 extended to assert the tap itself, not
  just path agreement).

**F2 harness extension (section (b)):** compose every ACCEPTED move sequence of
length ≤ 2 (reusing S4's ~650 enumeration and its infrastructure — the extracted
`logState`/`toggleStep` functions the harness already drives) with ONE
`logState('done')` on EACH of the five domain dates (~3,250 cases). After each:
assert the full pack including P8, and additionally — for rejected writes — zero
events and a byte-identical store. This reaches the three-operation shape
(move, move, tap) that section (b)'s pairs could not, which is exactly where F1
lived. The other tap kinds (fallback/skip/todo chips, `toggleStep`, `useLogDose`)
are exercised in C9/C10/C11's named forms; the full op-product is NOT required.
S4's reversal sweep stays move-only — do not extend it.

## SCHEMA §4.2 amendment (route to the architect as an update to CR-3; mechanical mirror, no drift)

- Append the T-1..T-3 block verbatim after the W-rules, under a heading
  "Write-side carrier selection (occurrence-data mutations)".
- Append the D-rule sentence from B1 verbatim to §4.2's D-rule paragraph.
- Append case rows C9, C10, C11 to §4.2's case table verbatim.
- No change to the R-rules, W-rules, Supplement A's clauses, or C1-C8.
- Optional, architect's discretion: one line in `docs/API.md` §3 noting that
  `useLogState`/`useToggleStep`/`useLogDose` return VALIDATION_FAILED for a date
  with no resolvable occurrence — the Result shape itself is unchanged.

## Disposition

- For the producer: implement T-1..T-3 via the single carrier-designation function;
  add C9/C10/C11; add P8 and the F2 extension. The no-move byte-equivalence
  standard still applies: with no move in play, T-2 must reduce to today's
  clause-(a)/own-create behaviour on due dates, changing nothing pass-3-verified;
  the ONLY behaviour change on unmoved dates is T-1's rejection of not-due writes,
  which no approved flow performs.
- For the reviewer: verify the single-answerer structure (grep for any second
  implementation of the clause selection), verify C9's residue byte-comparison and
  the un-move retraction semantics per the note above, verify T-1 rejections emit
  nothing, and verify S4 was not extended. Wave-2 consumers do not exist yet, so
  T-1 breaks no caller.
- F2's gap is closed by B2; it is downstream of B1 exactly as the reviewer said,
  and could not have been written first.

---

# Erratum E1 — C7's end-state text (architect, 2026-07-27)

**Not a new ruling.** This records a factual correction to Ruling 1's C7 row, found by the
reviewer on the pass-5 verification of Supplement B and confirmed against the implemented,
reviewed and PASSED behaviour. No contract changes: nothing in the R-rules, W-rules,
T-rules, Supplement A's clauses, or any other case row is affected.

**Appended rather than edited in place**, because Supplement A and Supplement B each assert
that the parts before them stand *byte-for-byte unmodified*; editing Ruling 1's table would
falsify both. This is the same append-only mechanism by which Supplement A superseded C8's
data clause and added C4b.

Amendment index: E1 SUPERSEDES the end-state cell of Ruling 1's case row **C7**. Nothing
else in any part of this file changes.

**Why it went stale.** C7 was written before Supplement B. Implementing T-2 necessarily
changed C7's behaviour: a tap on a visiting occurrence now writes to the visitor's own row
instead of fabricating a fresh row at the tapped date, so on undo the completion travels
home with its occurrence. The superseded text described the pre-T-2 behaviour, in which undo
destroyed the user's completion and its award outright — that was the bug F1 exists to fix,
not the target state.

**C7's end state, superseded:**

> A restored per C1; B resolves not-due and its award is retracted by reconcile;
> `ownLog(B)`'s chip data remains as dormant residue (D-rule)

**C7's end state, corrected — this is the binding text:**

| # | Sequence | Required end state |
|---|---|---|
| C7 | A→B, complete at B, then B→A | the tap writes to A's OWN row (the visitor), pointer preserved — no row is fabricated at B (T-2 clause-(c)); the award keys on B while the occurrence shows there (T-3). On undo the completion travels home WITH the occurrence: A due `ideal` with its chip data; B not-due; exactly one award, re-affirmed at A — not lost, not duplicated |

Ground truth: `src/queries/moveSemantics.test.ts`, describe block *"C7 — move, complete at
the target, then undo: the completion travels WITH the moved occurrence"*. `docs/SCHEMA.md`
§4.2 carries the corrected row inline, since it is a merged mirror rather than an
append-only record.
