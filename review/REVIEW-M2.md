# Review — M2 (pass 4 — fresh run after the session interruption; verified against ADVICE-M2.md INCLUDING Supplement A)
VERDICT: CHANGES_REQUIRED

This pass was restarted from the top after the interruption; nothing from the partial
pass-4 content was carried forward unverified — every claim below was re-established in
this run against the amended contract (original Ruling 1–4 + Supplement A S1–S4) and the
current tree (HEAD 5f84ddf; 13 suites / 165 domain+queries tests re-run green, 297
repo-wide per the orchestrator; `tsc` clean per the orchestrator).

**Summary:** the Supplement A implementation is correct and complete — clause (b) is
implemented exactly as ruled, C4b and S4 are faithful, the SCHEMA §4.2 mirror is
consistent with both parts of the ADVICE, the C6 test fix is a **legitimate
test-construction repair, independently confirmed** — but two items block PASS, and both
were invisible to every harness in the tree: a live defect where a chip tap on a C6-shape
date corrupts the departed occurrence's dormant data (F1), and Ruling 2(a)'s
completion-interleaved enumeration variant, which is still absent (F2) and is the exact
harness piece aimed at F1's class. F1's fix needs a write-side rule the contract does not
yet state, so it should go to the advisor's batch — I am not ruling the contract
extension myself.

## The C6 diagnosis — independently CONFIRMED (instruction 2)

M2's claim: the failing test was a construction artifact (incidental `daily` cadence made
C naturally due), not a conflict with "C6 is unchanged". I verified this three ways
rather than accepting it:

1. **Structural proof that clause (b) cannot reach a C6-shaped date.** Clause (b) fires
   only when `ownLog(D) === null && natural(D)` (dayState.ts:155-158 — keyed on row
   ABSENCE, exactly Supplement A's wording). A date whose own occurrence has genuinely
   moved away **necessarily carries a residue row**: the only writer of an own-date
   pointer is `moveOccurrence`'s own-branch (`ownLog(F).movedToDate = T`); the visiting
   branch never touches `ownLog(F)`; `day_log` rows are never deleted by any M2 surface
   (only M1's whole-task cascade); and un-move nulls the pointer only when the occurrence
   returns home. So `ownLog(D)` absent ⟹ D's own occurrence never left ⟹ clause (b)'s
   "blank state" is genuinely the state of a present, unlogged occurrence — and every
   C6-shaped (vacated-but-visited) date takes clause (c), never (b). I probed for a
   counterexample sequence (chains, merges, double-inbound, un-moves) and there is none:
   the invariant "own occurrence away ⟺ residue row present" holds across all W-rule
   writes.
2. **The failing assertion really was testing a different case.** The pre-fix dayState C6
   block used `daily` cadence, so its C-side assertion (`ideal` at C from B's residue)
   depended on the visitor's data displaying on a *naturally due, never-logged* date —
   which is precisely the literal-formula reading Supplement A REJECTED (S1's rationale
   names this exact shape). The ADVICE's C6 row premise is "task due A and B" — C is
   outside the due set. The fix (Sat/Sun cadence, dayState.test.ts:216-222) restores the
   pinned premise; **both assertions were kept, not weakened** (B resolves A's data via
   clause (c); C resolves B's data via clause (c)); and the hooks-level C6 test was
   already correctly shaped (`weekdays [1,2]`, D3 off-cadence) and untouched.
3. **C6's actual guarantee still holds at HEAD**, traced through the three-clause code:
   at B, (a) fails (residue pointer non-null), (b) fails (row exists), (c) yields the
   moved-in record — due, not annihilated. Re-ran both C6 tests green.

Verdict on the diagnosis: correct, and the kind of fix it should have been — setup
repaired to match the pinned case, assertions intact.

## Compliance verification against the amended contract

- **S1 / clause (b)** (`src/domain/dayState.ts:144-165`): three clauses implemented
  verbatim — (a) live own log, (b) `log === null && isDue(...)` → null (blank state),
  (c) moved-in record. Due-ness clause and residue principle unchanged. The change is
  confined to the `movedInLog != null` branch, honoring the no-move standard.
- **C4b** (`moveSemantics.test.ts:305-346`): exactly Supplement A's required variant — a
  **completed** visitor moved onto a naturally-due never-logged D2; asserts B keeps its
  blank state (neither the visitor's outcome nor its chip), then the **standalone
  no-award assertions** (`xpAwards()` length 0 AND `lifetimeXp() === 0` — the retraction
  of A's award plus nothing minted at B), then un-merge restores A with data and its
  re-affirmed award. This is the case, not a neighbor.
- **C1, C2, C3 (+guard-from-carrier), C4, C4r, C5, C7** — unchanged since the
  pre-supplement commit (range diff verified) and re-read in this run against the amended
  table: all still assert their table rows end-to-end through the real hooks; none is
  affected by clause (b) (C4's target is pre-logged → clause (a); C7's completed target
  is a live own log → clause (a); C1/C4r restores go through R-2/R-3).
- **C6** — see above. **C8** — the amended data clause's third arm is now genuinely under
  test (B moved off-cadence so the tie-break, not clause (b), governs), with the
  write-side both-rows redirect assertion intact.
- **S2 (P2 per-task only)** — accepted as binding; not relitigated. The implementation's
  per-task P2 with the §6.5 rationale matches S2's confirmation.
- **S3 (P3 weak/full split)** — accepted as binding; section (a) uses the ledger form,
  section (b) asserts full off-mark monotonicity inline across the mark/unmark round
  trip. Matches.
- **S4** (`mutations.invariants.test.ts:228-296`): mechanical snapshot-reversal over all
  length-≤2 sequences with `expect(sequenceCount).toBe(650)` (25+625 — exact, not
  approximate); W-0 no-ops excluded; multi-visitor exception implemented as specified
  (prior inbound at the target → liveness-only via `checkP7`); comparison is the resolved
  five-date occurrence map (full `Occurrence` objects — due-ness, outcome, chip, steps,
  doses — never raw rows/ids/timestamps); a non-vacuity assertion prevents a silently
  skipped run; length-3 reversal correctly not attempted. Discriminance checked by
  inversion: a pointer-not-cleared regression fails P7's self-pointer/liveness clauses; a
  data-corrupting reversal (the D-rule residue class S4 exists for) fails the `toEqual`
  map comparison; a redirect-writes-ownLog(F) regression breaks the map after inversion.
- **Enumeration (Ruling 2a core)**: `expect(count).toBe(16_275)` (25+625+15,625 —
  arithmetic checked) still asserted; per-step P6+P1+P7, per-sequence P2–P5; the sweep
  genuinely executes (~25 s observed in this run's jest time). P1 and the S4 map are
  evaluated via `resolveOneOccurrence` — internal, but provably the identical resolution
  the public read hooks use (grep re-run this pass: the only production
  `resolveOccurrence` call sites are `internal.ts`'s two, shared by
  `resolveTaskOccurrences`, which `useToday`/`useTaskOccurrences`/`useConsistency` call);
  the true hooks are exercised by all of C1–C8/C4b. I accept this as "the public read
  surface" in the sense that matters, with the caveat noted under F2.
- **SCHEMA §4.2 ↔ ADVICE (both parts)** — no drift. Mechanical checks this run: the W-rule
  block diffs byte-identical; the C4b row is byte-identical to Supplement A's; §4.2's R-1
  is the correct composite (original due-ness sentence + residue principle + Supplement
  A's three clauses, clause text byte-identical); §4.2's C8 row carries Supplement A's
  amended data clause verbatim while the ADVICE's original table row stands unamended
  with the change stated in the supplement — exactly the append-only structure the
  supplement prescribes. S2–S4 correctly kept out of §4.2. Nothing for the architect.
- **No-move byte-equivalence — re-proven fresh at HEAD**: mechanical diff of the pass-3
  committed resolution body (`dca819c:src/domain/dayState.ts:108-141`) against HEAD's
  extracted `resolveDueOccurrence` (lines 79-112): identical. With no move in play the
  flow is R-1 skipped, R-2 skipped, R-3 — same evaluation order and data as pass 3.
  `consistency.ts`, `xp.ts`, `occurrence.ts`, `cycles.ts`, `validation.ts`, `reads.ts`
  untouched in the post-supplement range; every §6.6 golden number rests on unchanged
  code and the suites pass.
- **Regression sweep**: the post-supplement range (584f6a8..HEAD) touches, in M2 paths,
  only `dayState.ts` (clause b), `dayState.test.ts`, `moveSemantics.test.ts` (C4b, C8
  cadence), `mutations.invariants.test.ts` (S4). Clause (b) re-checked against every
  pass-3-verified trace: move-to-off-cadence-then-complete (clause (a) after the
  completion — unchanged), C4 pre-logged merge (clause (a)), C1 restore (R-3), off-marked
  moved-in dates (`off`, no retraction). No regression found in this pass's changes.
  Ownership: `docs/**` changes are the architect's (b279875, per the CR-3 pattern);
  `review/REVIEW-M2.md` was touched only by the orchestrator's WIP snapshot of the
  interrupted reviewer session (8a37724), not by M2. "streak" grep clean.

## Blocking items

**F1. A chip tap on a C6-shape date is silently lost where the user tapped and corrupts
the departed occurrence's dormant data.** Pre-existing (found in the interrupted pass,
re-derived from scratch at HEAD); NOT introduced or fixed by Supplement A, and invisible
to every harness in the tree.
`src/queries/mutations.ts:433` (`logState`), `:487` (`toggleStep`), `:525` (`useLogDose`)
all write `movedToDate: existing?.movedToDate ?? null` — correct on ordinary dates,
wrong when `ownLog(D)` is **residue**. The only reachable date where a residue row
coexists with a rendered chip is exactly C6's B (due via a moved-in visitor while its own
occurrence lives elsewhere) — pinned reachable-and-due by the ADVICE. Trace at HEAD:
1. C6 state: `ownLog(B).movedToDate = C` (residue); `inbound(B) = [log_A]`; B renders a
   chip (clause (c) → pending).
2. Tap Done at B → `logState` finds the residue row and upserts `chipState: 'done'`
   while **preserving `movedToDate = C`**.
3. Read at B: clause (a) fails (pointer non-null), (b) fails (row exists), (c) → log_A →
   **the tap is invisible at B**; the mutation itself returns `xpAwarded: 0`,
   `celebrate: 'none'` for a Done tap.
4. If C is off-cadence (C6 proper): clause (c) at C reads `ownLog(B)` — **C flips to
   `ideal`** with no user action at C and no award anywhere. If C is natural: clause (b)
   keeps C blank, and the corrupted `done` lies dormant on B's residue row — reviving as
   a phantom completed state **with a fresh XP award** if B's occurrence is later
   un-moved home (inverse move C→B clears the pointer; reconcile then sees a live done
   log the user never meant for B's own occurrence).
This violates the D-rule's ownership statement (residue "chip/step data belongs to the
occurrence that left") and defeats R-1(a)'s intent — on a residue-occupied date the
user's action *cannot* win, because `UNIQUE(task, date)` gives it nowhere to land that
R-1 will read. Why no harness sees it: P1 compares the mutation's resolution to a read
through the same shared helper (they agree on the wrong answer); S4 is move-only;
section (b)'s pairs (2 ops) cannot reach the 3-op C6 setup. *The fix needs a write-side
rule the contract does not state* — e.g. "a day-level user action (chip/step/dose) on a
date whose R-1 `effectiveLog` is the moved-in record writes to **that record's row**
(the visiting occurrence's own row), never to a residue row" — which extends the pinned
contract and belongs with the advisor, alongside the S1 pattern of flag-don't-guess. I
deliberately do not pin the answer. *Acceptance once ruled:* in the C6 state, tap Done at
B → B reads `ideal` with exactly one award at `(task, B)`; C unchanged; the residue
row's chip data untouched; same for step toggles and dose logs; and the C→B un-move
afterwards must not revive a phantom completion.

**F2. Ruling 2(a)'s completion-interleaved enumeration variant is still missing.**
The original ruling requires the move-sequence enumeration **and** "a variant
interleaving one completion". Supplement A's amendment index amends only P7's
reversibility clause (S4) and leaves "everything else in the original … as written" — so
the requirement stands, and `mutations.invariants.test.ts` still has no such variant
(grep: `logState` appears only in section (b)'s pairs and section (c)'s fail-injection;
sections (a) and S4 are moves-only). This is a required harness piece, absent — and it
is precisely the variant aimed at F1's class of move × complete compositions. (Caveat
for the advisor, so the variant is built to catch F1 rather than pass over it: P1 as
formulated cannot see agreement-in-wrongness; the variant needs an intent-level clause —
e.g. "a Done tap on a due date yields a read of `ideal`, or an explicit failure" — which
is the advisor's to word, not mine.)

## Non-blocking notes

- C8's amended data clause's *second* arm (double inbound onto a naturally-due,
  never-logged target → blank state) has no direct test — the C8 test deliberately uses
  an off-cadence target to pin the third arm, and C4b covers the single-visitor blank
  case. Clause (b)'s implementation is visitor-count-independent, so this is a coverage
  nicety, worth one case when F1/F2's tests are written.
- S4's inverse-rejected `continue` (mutations.invariants.test.ts:279) is unreachable
  in-domain (the inverse of an accepted in-domain move cannot fail W-1 or the guard);
  harmless, and the non-vacuity assertion already protects against silent skipping.
- The Jest open-handles warning persists (known since pass 3, honestly reported,
  disposition unchanged). Suite cost with the enumeration + S4 is ~25 s; fine for CI.
- `useLogDose` remains un-extracted and un-fail-injected in section (c); structurally
  identical to `logState`, but it inherits F1 and must ride F1's fix and tests.

## Verified (how)

- Read in full, this run: ADVICE-M2.md including Supplement A (all 364 lines); SCHEMA
  §4.2 at HEAD; the complete post-supplement diffs (`git diff 584f6a8 HEAD`) for every
  M2 file; `dayState.ts`, `internal.ts`, `mutations.ts` (move + logging paths),
  `moveSemantics.test.ts`, `mutations.invariants.test.ts`, `fakeRepos.ts` at HEAD.
- Ran `npx jest src/domain src/queries --forceExit`: 13 suites, 165 tests, green,
  including the count-asserted 16,275-sequence enumeration and the 650-sequence S4
  reversal.
- C6 diagnosis: structural proof + pre/post test-diff inspection + HEAD trace (above).
- F1: re-derived line-by-line at HEAD through `logState` → clauses (a)/(b)/(c) → reads
  at both B and C, both C-flavors (off-cadence and natural), including the
  phantom-award-on-unmove consequence; grep confirmed the three preserve-pointer write
  sites and that `mutations.ts` is unchanged in the post-supplement range.
- Mirrors: W-block and C4b row byte-diffed; R-1 composite verified clause-by-clause;
  C8 rows compared against Supplement A's amendment string.
- Byte-equivalence: mechanical diff pass-3 → HEAD of the shared resolution body, plus
  flow-order argument for the no-move path.
- Ownership and "streak": range attribution per commit; grep clean.
