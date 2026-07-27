# Review — M2 (pass 5 — Supplement B compliance check)
VERDICT: PASS

Verified against the full binding contract — the original ruling, Supplement A, and
Supplement B — plus SCHEMA §4.2's mirror. Every blocking item from all five passes is now
resolved, the three explicit rulings requested are all in M2's favour (details below), and
the adversarial probes found no new defect. One **upstream contract erratum** is flagged
for immediate routing (stale C7 row text in both the ADVICE table and SCHEMA §4.2 —
superseded by T-2, and the two copies agree with each other, so it is an intra-contract
inconsistency, not mirror drift). It is not an M2 defect and does not gate this verdict.

State verified this pass: 13 suites / 169 domain+queries tests green (ran them; 301
repo-wide and `tsc` clean per the orchestrator, committed and pushed).

## Ruling (a) — `designateCarrier` IS genuinely the single answerer: CONFIRMED

- `src/domain/dayState.ts:133-143`: one pure function, `(log, movedInLog, natural)` →
  `own-live | own-create | visitor(row) | none`, no task/date logic of its own — exactly
  B1's structural requirement.
- The read path consumes it: `resolveOccurrence` (dayState.ts:175-186) is now a switch
  over the carrier and contains **no clause logic of its own**.
- The write path consumes it: `resolveWriteTarget` (internal.ts:165-177) performs the
  same lookups as `resolveOneOccurrence` (same `fetchMoveWindowLogs` ±60 window, same
  `buildMovedInIndex` tie-break), calls `designateCarrier`, and maps `visitor` →
  `targetDate = row.date` (the visitor's own source row), everything else → D's own row.
- All three occurrence-data mutations route through it (`logState` mutations.ts:435,
  `toggleStep` :476, `logDose` :538 — `useLogDose` is now extracted and in
  `__testing__` too).
- **Adversarial second-implementation hunt:** grep for the underlying branch condition
  (`movedToDate ===/!== null` and variants) across all non-test source returns exactly
  the two lines inside `designateCarrier` plus `buildMovedInIndex`'s inbound-set filter
  (internal.ts:62) — which is the `inbound(D)` set constructor from the R-rule
  *definitions*, shared by both sides, not a clause selection. `findInboundLogs`
  (`movedToDate === date`) is W-3's pointer-write branch selector, which the contract
  deliberately keeps separate ("the branch is chosen by inbound(F), nothing else"). No
  other production code resolves occurrences (re-verified: the only `resolveOccurrence`
  call sites are `internal.ts`'s). No bypass exists.

## Ruling (b) — C7's changed assertions are LEGITIMATE: CONFIRMED, with one upstream erratum

I tried to break this one, as instructed, rather than nod at it.

- **The change is forced by the binding rule, not chosen to make broken code pass.** In
  C7's sequence the completion tap lands on a non-natural date whose only occurrence is
  the moved-in visitor — clause (c) — and T-2 *mandates* the write go to "the WINNING
  moved-in row (the row at its source date) … PRESERVING its movedToDate". Under T-2,
  `ownLog(B)` never comes into existence in this sequence at all, so the old C7 test's
  asserted end-state ("a fresh row at B, dormant after undo, award destroyed") is
  **unreachable** — it was an artifact of the old date-keyed write path, i.e. of F1
  itself. Supplement B's own prose confirms the new reading twice: the D-rule addition
  says tap-written visitor data is "the visiting occurrence's own state, **travelling
  with it exactly as C7 data does**", and B1's generalisation paragraph classifies C7's
  carrier as "the winning visitor … handled by T-2".
- **The new behaviour survives adversarial probing.** Move → complete → undo now
  preserves the user's credit (completion and award travel home, re-affirmed at A by
  reconcile) instead of the old outcome, which *destroyed* it (award retracted to zero,
  A reverting to unlogged and rotting to missed — punitive and lossy). I probed for
  double-credit (impossible: one occurrence, one award, retract/re-affirm through
  reconcile at each hop), farming via move/tap/undo cycles (UNIQUE(task,date) plus
  single-occurrence semantics hold), and lost credit (none — C9's full
  shadow-retract-then-revive cycle is asserted, and the transient retraction during
  shadowing is the pinned sanctioned case I am bound not to flag). The new C7 test also
  strengthens the structural claims: exactly one row, keyed at A, pointer intact after
  the tap, XP keyed on the tapped date (T-3).
- **The erratum:** the C7 *table row text* — in the ADVICE's original Ruling-1 table
  (line 113) **and** in SCHEMA §4.2's mirrored table — still describes the old
  end-state ("`ownLog(B)`'s chip data remains as dormant residue"). Supplement B's
  amendment index says C1–C8 are unchanged, but T-2 plus B1's own D-rule sentence
  supersede that row's end-state description. The two copies agree with each other
  (checked byte-for-byte), so this is not ADVICE↔SCHEMA drift — it is a one-line
  erratum for the advisor/architect: reword C7's end state to the travelling-data
  outcome the contract now mandates and the test now pins. Until then, the row is a
  trap for qa-tester and M4, who are pointed at §4.2. **Route this immediately;** it
  does not block M2, which could not satisfy both texts, followed the binding rule, and
  disclosed the deviation instead of hiding it.

## Ruling (c) — no-move / no-C6 behaviour is genuinely unchanged: CONFIRMED

- **Analytically:** the `resolveOccurrence` rewrite maps carrier kinds onto exactly the
  pass-4 branches — `own-live` → `resolveDueOccurrence(log)`, `own-create` → `(null)`,
  `none` → `notDueOccurrence(log?.chipState)` — with `natural` computed by the same
  `isDue(task, date, notBefore)` call. For every no-move input (movedInLog null) and
  every no-C6 input the decision table is value-identical to the pass-4 code I verified
  byte-equivalent to pass 3. `resolveDueOccurrence` itself is untouched this pass.
- **By diff:** the only pre-existing test that changed anywhere in the range is C7
  (disclosed; ruled legitimate above). `dayState.test.ts` (129 assertions including all
  golden chip→outcome paths) and `mutations.test.ts` (N1–N5) are byte-untouched and
  pass; `consistency.ts`/`xp.ts`/`occurrence.ts`/`cycles.ts`/`validation.ts`/`reads.ts`
  untouched; all §6.6 golden numbers rest on unchanged code.
- **The one intended unmoved-date delta** is T-1's rejection of writes to not-due dates
  — sanctioned explicitly by Supplement B's disposition ("the ONLY behaviour change on
  unmoved dates"), performed by no approved flow, and demonstrated by the fact that no
  pre-existing test needed to change to stay green.

## Supplement B compliance, item by item

- **T-1** (`mutations.ts:435-437`, `:476-478`, `:538-540`): `carrier.kind === 'none'` →
  `VALIDATION_FAILED` before any storage touch; zero writes, zero reconciles, zero
  events (verified in code order and by C10/C11's zero-event assertions and the
  harness's rejected branch).
- **T-2**: upserts key on `target.targetDate` with `target.existing` — own row,
  fresh own row (born pointer-null, enforced by P8b), or the visitor's row with
  `movedToDate` preserved; residue rows are never addressed (P8a asserts them
  byte-unchanged around every non-move op).
- **T-3**: reconcile and both emits still key on `input.date`; XP awards key on
  `(task, D)` (C9 asserts the award's date is the tapped date, not the carrier row's).
- **C9** — matches Supplement B's row clause-for-clause: tap visible at B (`ideal`, XP at
  (task,B)); write landed on A's row with pointer intact; residue `ownLog(B)`
  byte-unchanged (`toEqual` on before/after snapshots); C→B return resolves by B's
  uncorrupted blank data with no phantom; the visitor's award retraction during
  shadowing is asserted **with the pinned sanctioned-note rationale in the test**, and
  B→A revives the tapped data with its award re-affirmed.
- **C10** — exact: rejection, byte-identical row, zero events (both event types
  subscribed), zero XP delta, and un-move revives the *original* `fallback` data, never
  the rejected `done`.
- **C11** — exact: rejection, no fabricated row, and the later move-in resolves via the
  visitor clause with no phantom clause-(a) adoption.
- **P8 + F2 harness** (`mutations.invariants.test.ts:294-410`): the 650-sequence space ×
  5 tap dates with `expect(attempted).toBe(3_250)` (asserted exactly, not approximate);
  **both branches proven non-vacuous** (`tapAccepted > 0` AND `tapRejected > 0` are
  literal assertions); P8a/P8b from full-store snapshots — the pointer is checked
  unchanged on *every* row including the legitimate target, non-target rows are fully
  byte-compared, fresh rows must be born pointer-null, and no non-move op may delete a
  row; on rejection: zero events, byte-identical store, XP unchanged; on acceptance:
  P8c asserts the read at the tapped date reflects the tap itself (`chipState ===
  'done'`) and equals the mutation's returned outcome — the intent-level clause that
  catches agreement-in-wrongness, which is exactly what F1 hid behind. Seeded-regression
  check by inversion: the old (pass-4) write path fails this harness two independent
  ways on C6-shaped sequences (P8a: it modifies a non-target residue row; P8c: the read
  does not reflect the tap) and the named C10/C11 cases catch the vacated/fabrication
  members of the class. Section (b) now wraps every non-move op in a P8b check. **S4 was
  not extended** (still move-only), per the disposition.
- **SCHEMA §4.2 sync**: T-1..T-3 block byte-identical (diffed); C9/C10/C11 rows
  byte-identical (compared individually); the D-rule sentence appended verbatim to
  §4.2's D-rule paragraph. The only text issue is the shared stale C7 row — see Ruling
  (b). `docs/API.md` gained the optional §3 note (architect's discretion, exercised).

## Non-blocking notes

- **The C7 row erratum** (Ruling (b)) — the one action item out of this pass, for the
  advisor/architect, not M2.
- `markOffDay`'s `priorChipState` snapshot still reads the raw date-keyed row
  (mutations.ts:565-567), so on a C6-shape date it snapshots the residue chip rather
  than the visitor's. `prior_chip_state` is display metadata only (resolution never
  reads it; unmark just deletes the mark), and off-marks are date-scoped, so no
  behavioural effect — worth one line when anyone next touches that function. B1's
  T-rule enumeration deliberately excludes `markOffDay`, so this is not a compliance
  gap.
- A step toggle on an off-cadence moved-in date still writes a step id that no read
  surfaces (due-steps are computed at the tapped date, where nothing is due) and leaves
  the chip at `todo` — the pre-existing, both-paths-consistent v1 limitation noted since
  pass 3, unchanged by Supplement B and consistent with its "due-ness is evaluated at D"
  comment. M4 should simply not render step checkboxes on such dates.
- The Jest open-handles warning persists (known since pass 3; disposition unchanged).
  Domain+queries now costs ~42 s with the 16,275 + 650 + 3,250 sweeps — still fine for
  CI.
- **Rescope-friendliness (requested, optional):** the queued one-hop F7 rescope should
  be *easier* because of this pass, not harder. The general-move machinery is well
  localised — `moveOccurrence` (W-rules), the `internal.ts` lookup helpers, and the
  `movedInLog` parameter — and the Supplement-B layer (`designateCarrier`,
  `resolveWriteTarget`, T-1..T-3) is exactly the part a one-hop model still needs
  (one-hop still has visitors, residue and vacated sources). What deletion removes
  cleanly: chain collapse and multi-visitor redirect in W-3, C3/C5/C8 and the
  enumeration's depth. Tests are partitioned so the cut is low-risk
  (`moveSemantics.test.ts` cases named per row; harness sections independent). The one
  thing I would preserve verbatim through the rescope is `designateCarrier` and the
  single-answerer discipline — that is the fix that ended this defect class.

## Verified (how)

- Read in full: Supplement B (ADVICE lines 366-529); the complete range diff
  `5f84ddf..HEAD` for every M2 file; `dayState.ts`, `internal.ts`, `mutations.ts`,
  `moveSemantics.test.ts`, `mutations.invariants.test.ts` at HEAD.
- Ran `npx jest src/domain src/queries --forceExit`: 13 suites, 169 tests, green,
  including the 16,275-, 650- and 3,250-case sweeps (all count-asserted).
- Single-answerer: adversarial greps for the branch condition and for all
  `designateCarrier`/`resolveWriteTarget` call sites; classification of the two
  non-carrier hits against the contract's own rule separation.
- C7: traced the tap's carrier under T-2, established the old end-state's
  unreachability, cross-read B1's D-rule sentence and generalisation paragraph, probed
  the new behaviour for double-credit/lost-credit/farming, and diffed the old vs new
  test assertions line by line.
- C9/C10/C11: compared each test against its Supplement-B row clause by clause,
  including C9's residue byte-comparison and the sanctioned-retraction semantics I am
  bound to accept (and independently agree with).
- Harness: verified both-branch non-vacuity assertions exist and ran; verified P8a/P8b
  snapshot mechanics including target-row pointer immutability; inversion arguments for
  the old write path against P8a and P8c; confirmed S4 untouched.
- Mirrors: T-block diffed byte-identical; C9-C11 rows compared individually; D-rule
  sentence located verbatim in both; C7 rows compared (both stale, both identical —
  erratum, not drift).
- No-move equivalence: carrier-switch mapping analysis plus range-diff proof that
  `dayState.test.ts`/`mutations.test.ts` and the entire arithmetic core are untouched.
- Ownership: `docs/**` changes are the architect's (8ace771); `docs/STATE.md` the
  orchestrator's; M2's changes confined to `src/domain/**`/`src/queries/**`; the review
  file's last write was my own pass-4 commit; "streak" grep clean.
