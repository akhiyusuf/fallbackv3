# Review — M2 (pass 4 — advisor-compliance check; pass counter reset by the advisor invocation)
VERDICT: CHANGES_REQUIRED

Verified against `review/ADVICE-M2.md`'s binding table (not my superseded pass-3 prose),
per Ruling 3. The implementation is **compliant with every R-rule, every W-rule, and all
eight named cases** — each verified as the ADVICE's case, not a nearby one — and the
no-move paths are **independently confirmed byte-equivalent**. Two things keep this from
PASS: one harness piece Ruling 2(a) requires is missing, and probing the one composition
that missing piece exists to cover found a real defect at the seam between the pinned READ
contract and the (unpinned) chip-write path. The defect's *fix* needs a write-side rule
the ADVICE doesn't state, so it belongs in the advisor's currently-open batch alongside
the R-1 merge-variant question — I am not ruling on the contract extension myself.

## Compliance verification, case by case

**R-rules** (`src/domain/dayState.ts:136-165`): implemented as written. R-1 evaluates a
present `movedInLog` before any vacate check; `effectiveLog := ownLog(D)` only when its
pointer is null, else the moved-in record — a vacated own log neither annihilates nor
supplies data. R-2 and R-3 unchanged. The shared `resolveDueOccurrence` extraction means
R-1 and R-3 use one computation.

**W-rules** (`src/queries/mutations.ts:607-692`): W-0 no-op with zero writes/reconciles/
events (verified by C2's rows/awards/events assertions); W-1 rejects a `not-due` source
with zero writes; W-2 measured from every pointer-carrying row (`carrierDates`,
mutations.ts:630-638) — C3's second test constructs |B−C| ≤ 60 with |A−C| ≈ 150 and is
rejected with A's pointer untouched; W-3 branch chosen by `inbound(F)` alone —
`findInboundLogs` (internal.ts:79-84) deliberately returns **every** inbound row un-tie-
broken for the write side while `buildMovedInIndex` keeps the display tie-break, exactly
the read/write split the ADVICE draws; ownLog(F) untouched in the visiting branch; ordered
one-row-at-a-time writes with reconcile-what-was-touched on mid-sequence failure and no
compensation logic; W-4 reconciles F, T and every written row's date, `day:logged` emitted
once for T only.

**C1–C8** (`src/queries/moveSemantics.test.ts`, all end-to-end through
`useMoveOccurrence`/`useLogState` + `useTaskOccurrences`, never domain internals):
- C1 ✓ data AND XP travel and return; one surviving row, `movedToDate: null`; B not-due.
- C2 ✓ true no-op — rows and awards deep-equal, zero `day:logged`.
- C3 ✓ single collapsed pointer A→C, B never a stored target; plus the guard-from-carrier
  rejection test. B's non-inheritance of A's data asserted.
- C4/C4r ✓ merge with B carrying genuine pre-existing data (the advisor's open R-1
  variant — B naturally-due-but-never-logged — is correctly *avoided*, implemented
  literally, and flagged rather than guessed; I am not ruling on it).
- C5 ✓ LIFO: the visitor's row redirected, B's own occurrence untouched and still due.
- C6 ✓ **the advisor's case exactly**: due {Mon,Tue}; B→C then A→B; B resolves due (not
  annihilated by its own residue), B's occurrence live at C, A vacated. The domain-level
  pass-3 test was **inverted** per Ruling 3 (dayState.test.ts C6 block), not reworded —
  it now asserts due-with-A's-data at B and B's data at C.
- C7 ✓ the D-rule precisely: undo restores A to its **own** pre-move (unlogged) history —
  not B's completed state; B's row physically survives as dormant residue with its chip
  data; the award is retracted (0 awards) per CR-2.
- C8 ✓ display tie-break = later source; a further move redirects **both** inbound rows.

**Ruling 2 harness** (`src/queries/mutations.invariants.test.ts`):
- (a) The enumeration is real: a generator over all (F,T) pairs of the pinned 5-date
  domain (cadence due on exactly {D1, D3}), lengths 1–3, `expect(count).toBe(16_275)`
  (25 + 625 + 15,625 — arithmetic checked), asserting P6+P1+P7 per step and P2–P5 per
  sequence. It runs (~30 s; I ran it). It discriminates: reverting the R-1 order fails
  P7's no-annihilation check on any C6-shaped sequence; removing W-0 fails the
  no-self-pointer check; chain non-collapse and guard-from-F regressions are caught by
  C3's structural assertions. P1 asserts the mutation's returned occurrence deep-equals a
  subsequent resolve — via `resolveOneOccurrence`, which is the identical function the
  read hooks' `resolveTaskOccurrences` path shares (N1's structural unification,
  re-verified by grep: no other resolution call site exists), so I accept it as "the
  public read surface" in the sense that matters; the true hooks are exercised by C1–C8.
- (b) 25 ordered pairs × 2 date relations present, with P3's full "off-mark never reduces
  XP" form asserted inline across the actual mark/unmark round trip.
- (c) Fail-injected retry idempotence for the multi-write move (C8-shape, second write
  fails, retry converges with no duplicates) and for logState's XP write. The new
  `failLogsUpsertAfterCalls` fault is faithful: skip-N-then-fail-once against the real
  upsert path, no state fakery, reset-cleared.

**SCHEMA §4.2 mirror**: extracted the R-1…C8 block from both files and diffed —
byte-identical (`RULES-MIRROR-IDENTICAL`). ARCHITECTURE §6.1 carries the R-1-precedes-R-2
footnote; MODULES M4 points at SCHEMA §4.2. No disagreement anywhere.

**No-move byte-equivalence — explicitly confirmed, independently.** I diffed the pass-3
`resolveOccurrence` body (dca819c:src/domain/dayState.ts:108-141) against the extracted
`resolveDueOccurrence` (HEAD lines 79-112): textually identical. With no move in play the
pass-4 flow (R-1 skipped, R-2 skipped, R-3) reduces to exactly the pass-3 evaluation
order and data. `consistency.ts`, `xp.ts`, `occurrence.ts`, `cycles.ts` (additive only at
pass 3), `validation.ts`, `internal.ts`'s read paths and `reads.ts` are untouched since
the pass-3 sweep; the mutation-hook extraction (`logState`/`toggleStep`/`markOffDay`/
`updateSettings` as named `mutationFn`s) is verbatim relocation — hooks wrap the exact
functions, not re-implementations. 13 suites / 163 domain+queries tests pass (295
repo-wide per the orchestrator); every golden number rests on unchanged code.

## Blocking items

**F1. A chip tap on a C6-shape date writes onto the residue row: the user's action never
registers where they tapped, and teleports onto the departed occurrence.**
`src/queries/mutations.ts:422-436` (`logState`; same pattern `toggleStep` :479-490 and
`useLogDose` :517-528). These upserts preserve `movedToDate: existing?.movedToDate ?? null`
— correct on ordinary dates, wrong when `ownLog(D)` is **residue**. The only date where a
residue row coexists with a rendered chip is exactly C6's B (due via a moved-in record
while its own occurrence lives elsewhere) — which the ADVICE pinned as reachable and due.
Trace, verified against the code line by line:
1. C6 state: `ownLog(B).movedToDate = C` (residue); `inbound(B) = [log_A]`; B renders a
   chip (due, pending).
2. User taps Done on B → `logState(B, 'done')` → `existing` is the residue row → upsert
   sets `chipState: 'done'` while **preserving `movedToDate = C`**.
3. Read at B (R-1): own log's pointer is non-null → residue → `effectiveLog = log_A` →
   **the tap is invisible at B**; the mutation returns outcome `missed`/`pending`,
   `xpAwarded: 0`, `celebrate: 'none'` for a Done tap.
4. Read at C: `movedInLog = ownLog(B)` → now chip `done`, manual → **C flips to `ideal`**
   with no user action at C and no XP award anywhere.
This violates the D-rule's ownership statement — residue "chip/step data belongs to the
occurrence that left", and `logState` just overwrote the departed occurrence's travelling
data with input meant for the visiting one — and it defeats R-1's stated intent ("a real
user action on D wins"): on a residue-occupied date the user's action *cannot* win,
because `UNIQUE(task, date)` gives it nowhere to land that R-1 will read. Note the
harness cannot see this: P1 compares the mutation's resolution to a read that flows
through the same helper, so both agree on the wrong answer — an intent-vs-outcome gap,
not a path-divergence gap.
*The fix requires a write-side rule the ADVICE does not state* — e.g. "a day-level user
action (chip/step/dose) on a date whose R-1 `effectiveLog` is the moved-in record writes
to **that record's row** (the visiting occurrence's own row), never to a residue row" —
which extends the pinned contract, sits directly beside the advisor's open R-1
merge-variant question, and should be ruled in that same batch. I flag it and deliberately
do not pin the answer. *Acceptance once ruled:* in the C6 state, tap Done at B → B reads
`ideal` with one award at `(task, B)`, C is unchanged, and the residue row's chip data is
untouched; same for a step toggle and a dose log.

**F2. Ruling 2(a)'s completion-interleaved enumeration variant is missing.**
The ADVICE requires the 16,275-sequence sweep **and** "a variant interleaving one
completion". `mutations.invariants.test.ts` has no such variant — section (a) is
moves-only, and section (b)'s pairs (2 operations) cannot reach the 3-operation shapes
(two moves + a completion) where move × complete compositions live. A required harness
piece, absent — and precisely the variant aimed at F1's class. (Honest caveat for the
advisor: as formulated, P1 would *pass* over F1 even in that variant, since both sides
resolve through the shared helper; if the harness is meant to catch intent-level defects,
P1 needs a clause like "a Done tap on a due date yields a read of `ideal` or an explicit
failure" — that sharpening is the advisor's to make, not mine.)

## Non-blocking notes

- Open advisor items acknowledged and not ruled on here, per instruction: the R-1
  naturally-due-never-logged merge variant (implemented literally, flagged, C4 built to
  avoid it); P2 asserted per-task only (the stated rationale is correct — aggregate
  `missed` is a post-rounding display remainder, so exact equality genuinely doesn't hold
  there; ARCHITECTURE §6.2 states the invariant per-task); P7's reversibility clause
  covered by C1/C4r rather than mechanically (tractability argument is sound; those are
  the single-visitor cases the clause names).
- Section (b)'s move op always uses `d → next(d)` — one fixed shape per pair. Compliant
  with the ADVICE's letter ("one test asserting the pack"); if P1 is sharpened per F2's
  caveat, widening the pair shapes would come along naturally.
- `useLogDose` was not extracted to a named function and is not fail-injected in section
  (c). Structurally identical to `logState`; acceptable — but it inherits F1 and must be
  included in F1's fix and tests.
- The Jest open-handles warning persists (known, honestly reported at pass 3, unchanged
  disposition). The enumeration adds ~30 s to the queries suite; fine for CI, worth a
  local-iteration note.
- Ownership: pass-4 changes are confined to `src/queries/**` and `src/domain/**`
  (commits d6af02f, 584f6a8); the `docs/**` amendments (SCHEMA §4.2, ARCHITECTURE §6.1
  footnote, MODULES CR-3 note) are the architect's own files per the CR pattern. M2 wrote
  nothing to `review/`. "streak" grep still clean.

## Verified

- `review/ADVICE-M2.md` read in full; every Ruling-3 compliance criterion checked
  individually (R-precedence delta confined to move-present paths; W-0/W-1/W-2 rejection
  tests present; guard measured from the carrier; W-3 branch by `inbound(F)` alone with
  ordered writes; C1–C8 end-to-end; harness (a)–(c) with P1–P7 — (a) minus the missing
  completion variant, F2).
- Ran `npx jest src/domain src/queries --forceExit`: 13 suites, 163 tests, green,
  including the full 16,275-sequence enumeration (count-asserted, ~30 s).
- Byte-equivalence proven by mechanical diff of the extracted resolution body against the
  pass-3 committed version (`git show dca819c:… | diff`), plus flow-order reasoning for
  the no-move path (R-3 ≡ pass-3 order); mutation-hook extraction diffed as verbatim
  relocation.
- Enumeration discriminance argued by inversion against four seeded-regression classes
  (R-1 order, W-0 removal, chain non-collapse, guard-from-F); fault injections inspected
  for fidelity (one-shot, real error paths, reset-cleared).
- F1 traced line-by-line through `logState` → R-1 → both reads (B and C), including why
  every P-invariant as formulated passes over it; confirmed the residue+chip combination
  is reachable **only** in the C6 shape, so the defect's blast radius is exactly the case
  the ADVICE pinned as reachable.
- SCHEMA §4.2 ↔ ADVICE rules block diffed byte-identical; ARCHITECTURE §6.1 footnote and
  MODULES M4 pointer present and consistent.
