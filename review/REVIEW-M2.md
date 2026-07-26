# Review — M2 (pass 3)
VERDICT: ADVISOR_REQUIRED

One blocking defect remains — a new one, in the newest code, found by composing F7 moves
with themselves. Everything else from passes 1 and 2 is verified fixed, structurally where
that was demanded, and the arithmetic core is intact. Per the three-pass rule this sets
ADVISOR_REQUIRED; my diagnosis of the regression pattern, and what I think the advisor
should actually pin, is at the end — this module is converging (10 → 5 → 1), not thrashing.

## Pass-2 item disposition (all verified, none taken on faith)

- **N1 (path divergence) — fixed structurally, as demanded.** `resolveOneOccurrence`
  (internal.ts:116-122) shares `fetchMoveWindowLogs` + `buildMovedInIndex` +
  `resolveOccurrence` with `resolveTaskOccurrences`; `reconcileOccurrence` calls it
  (mutations.ts:239). Bypass check: grep shows the only production `resolveOccurrence` call
  sites are the two inside `internal.ts` — no read or mutation path can resolve
  independently. Divergence-hunting: the two helpers use different fetch windows
  (`[from−60, to+60]` vs `[D−60, D+60]`), but the new up-front move-distance guard
  (mutations.ts:587-593) enforces `|source − target| ≤ 60`, which makes every source a
  batch read can see for target D also visible to the single read, and the double-move
  tie-break is deterministic (latest source date, `buildMovedInIndex`'s ascending sort) so
  both paths pick the same winner. Precedence `log ?? movedInLog` with due-ness
  `movedInLog != null || isDue(...)` (dayState.ts:98-106). End-to-end traces all agree
  between mutation and read, including across a rollover: move→complete (ideal, one award),
  move-to-off-cadence-day→complete (ideal, one award), move onto a naturally-due day with
  its own log (own log wins), move onto an off day (`off`, no retraction — N2 branch),
  move across a cycle boundary (original `cycleId` preserved). The N1 acceptance tests
  assert exactly my pass-2 criteria including `numerator === denominator − missed`, and
  fail by inversion under the pass-2 precedence (`movedInLog ?? log` would read `pending`,
  not `ideal`) and under the reconcile-blind bug (off-cadence completion would award 0).
- **N2 (off-day retraction) — fixed**, `else if (occurrence.outcome !== 'off')`
  (mutations.ts:276-285). The self-found second bug (re-affirmation re-stamping `cycleId`)
  is genuinely fixed: an existing award's `cycleId` is preserved via `listXpAwards(date,
  date)` filtered to the task (mutations.ts:255-261); M1's upsert writes the same value
  back, so downgrade keeps attribution too; orphaned same-date awards (`taskId` null)
  can't be picked up by the filter. The test is sharp: the seeded January award vs. a
  pointer that the boundary walk has advanced to June means the re-stamp bug would
  genuinely flip the asserted `cycleId` — it fails under the bug.
- **N3 (overlap) — fixed**, and one better than my prescription: `freshCycleWindow`
  (cycles.ts:46-49) starts exactly at the given date, and the short record ends
  **yesterday** (mutations.ts:203-207), closing the one-day overlap my own acceptance test
  would have left at `[oldStart, today]`/`[today, …]`. Degenerate guard checked: live
  window started today → `shortCycleEnd < startDate` → nothing archived, only the fresh
  pointer set; two same-day cadence changes cannot produce an invalid or overlapping
  record. `assertNoOverlappingRecords` is a real interval-intersection check and is applied
  to the item-2 walk too.
- **N4 (double-archive) — fixed.** Pointer advances after each successful archive
  (mutations.ts:162-170); `archiveCycleWindow` has an existence guard on
  `(cadence, start, recordEnd)` that returns the existing id without re-appending or
  re-emitting (mutations.ts:115-117); `getOrInitCycleState` returns `{state, persisted}`
  and both callers refuse to archive against an unpersisted pointer (mutations.ts:157,
  199-200). Guard false-positive check: windows never legitimately repeat (the pointer is
  monotonic — advanced only to `nextCycleWindow`, or to `freshCycleWindow(today)` where
  today ≥ the live start; records survive everything except erase-all, which clears both),
  and a short record can never collide with a full one at identical bounds because a
  change on a period's first day takes the degenerate path. Both partial-failure tests
  (mid-loop append failure; pointer-write failure after the short append) use real
  fail-injection in the fake and fail under the pass-2 code.
- **N5 (duplicate `level:up`) — fixed.** The `useToggleStep` re-emit is gone; grep confirms
  exactly one emit site (mutations.ts:316), documented as the sole one. The test asserts
  exactly one event through M0's now-isolated (reliably-delivering) bus.
- **Non-blocking items:** move guard enforced up front with a calm `VALIDATION_FAILED`
  (better than silent disappearance); tie-breaks deterministic and chained-move behaviour
  documented and tested; S27 locked-copy provenance note added to the catalogue header;
  `getOrInitCycleState`'s fallback now uses the leading-partial shape (aligned with M1's
  genesis seed). The Jest open-handles warning remains, honestly reported as
  investigated-not-isolated — I accept that: the suite passes deterministically, the
  teardown is diligent, and this is a known react-query/@testing-library timer interplay;
  it masks nothing I can find. Worth one more attempt with `--detectOpenHandles` before
  qa-tester copies the harness, but not blocking.

## Regression sweep (pass-2 fixes vs pass-1 establishment)

`consistency.ts`, `xp.ts`, `occurrence.ts`, `validation.ts`, `reads.ts` untouched this
pass (commit e008938 numstat); `cycles.ts` change is additive (`freshCycleWindow`);
`dayState.ts` changes are confined to the moved path — with no move in play,
`effectiveLog === log` and every branch is byte-equivalent to the verified pass-1
behaviour, so all §6.6 golden numbers rest on unchanged code. `notBefore` threading
unchanged; no new Instant→date conversions (still exactly the two `toLocalDate(new
Date(...))` sites). Full suite re-run: 147 domain+queries tests pass (279 repo-wide per
the orchestrator). "streak" still absent. Ownership: the rework commit touches only
`src/domain/**` and `src/queries/**`, and M2 did not write to `review/` this pass.

## Blocking item

**B1. Moving an occurrence back to its original day — or to its own day — annihilates it.**
`src/queries/mutations.ts:583-617` + `src/domain/dayState.ts:92-94`. The vacate check
(`log.movedToDate !== null` → `not-due`) runs **before** the moved-in check, and
`useMoveOccurrence` always writes the pointer onto `fromDate`'s own log. Compose two legal
moves:
1. **Undo a snooze.** Move A→B (log_A.movedToDate = B). The user changes their mind and
   moves it back: `useMoveOccurrence(fromDate: B, toDate: A)` creates log_B with
   `movedToDate = A`. Now A's own log vacates A (its moved-in record from B is never
   reached — dayState.ts:92 returns first), and B's own log vacates B. The occurrence
   resolves `not-due` on **both** dates: it has ceased to exist. Any XP it had is
   retracted (source reconcile), the day leaves the denominator, and no read or mutation
   can ever reach it again — nothing on the public surface can clear a `movedToDate`.
2. **Same-day move.** `fromDate === toDate` passes the distance guard (distance 0) and
   writes `movedToDate = date` onto the date's own log → immediate self-annihilation.
Re-snoozing *forward* (A→B, then B→C) works — C resolves through B's pointer — so this is
specifically the **cycle** case, and "undo the snooze" is a completely ordinary user
intention for F7. Both paths agree on the wrong answer (so N1's structural fix held —
this is not a divergence), but a pair of legal actions silently destroying an occurrence
violates F7's basic promise ("affects the occurrence", not "deletes the occurrence") and
is a data-loss bug M4 would build the snooze UI directly on top of, behind a frozen
surface, if it shipped in the wave-1 freeze.
*Good looks like:* normalise at write time so the single-hop invariant holds by
construction — in `useMoveOccurrence`, if `fromDate`'s due-ness comes from a moved-in
record (original source S = that record's `date`), update **S**'s log instead of chaining:
`movedToDate = toDate`, or `movedToDate = null` when `toDate === S` (a true un-move); and
short-circuit `fromDate === toDate` as a no-op. *Acceptance tests:* (i) move A→B then
B→A → the occurrence is due on A again (`pending`, or its prior chip state), `not-due` on
B, denominator restored, a previously-earned award re-affirmable; (ii) move A→A → no-op,
occurrence still due on A; (iii) move A→B→C → due on C only, and C→A restores A.

## Non-blocking notes

- The chained-move representation (pointer chains resolved single-hop at read time) is
  what makes B1 possible at all; the write-time normalisation above also collapses chains,
  after which the "chained move vacates B without resurrecting A" dayState test describes
  a representation that can no longer occur through the public surface — keep it as a
  defence-in-depth assertion, but re-word its premise.
- A moved occurrence on an off-cadence target is manual-chip-only (`dueIdealStepIds` is
  cadence-based, so step checkboxes don't travel with the move). Both paths agree, F23 is
  silent on moved dates, and the day still resolves correctly through the chip — fine for
  v1, but note it for M4 so the sheet doesn't render an empty step list oddly.
- Day-of-change XP (earned before an afternoon cadence switch) stays stamped with the old
  cycle id, so it lands in the short record's `cyclingXpFinal` while the day's
  *consistency* belongs to the fresh window — a deliberate, value-preserving asymmetry
  worth one comment line. Two same-day cadence changes with a log between them orphan that
  log's cycling XP from every window (lifetime intact) — accepted edge-of-edge.
- Jest open-handles warning: accepted as reported; see above.

## Why this module keeps regressing — diagnosis for the advisor

**Mostly execution pattern, not spec ambiguity — and it is converging, not thrashing:**
10 defects → 5 → 1 across passes, every fix real (structural where structure was
demanded), and zero recidivism — nothing fixed has un-fixed.

1. **Not the spec, with one exception.** Every regression so far violated an *explicit*
   upstream sentence (off days never a penalty — SCHEMA §7 / PRD §3.4; "never a double
   archive" — SCHEMA §8; fresh-cycle disjointness — §8's "begins … runs to the next
   natural boundary"). The specs were adequate; the builder consulted them when answering
   review items but not when writing *new* code. The **one genuine spec gap** across all
   three passes is F7's move micro-semantics: SCHEMA gives it one column and one sentence,
   ALLSCREENS never shows a move flow, and nobody upstream defined chains, un-move,
   same-day moves, or collisions. B1 lives exactly in that gap, and both move-related
   findings (pass-2 N1, pass-3 B1) had to be adjudicated against reviewer reasoning rather
   than a pinned contract.
2. **The failure mode is consistent:** M2 fixes precisely what the review names, writes
   tests from the review's acceptance criteria, then extends its own state machine without
   exploring the interactions *it* just created. Each pass's new defect sat in the newest
   code, in a composition the named criteria didn't cover (off-retraction × cycle
   attribution; move-display × move-complete; now move × move). The module is not too
   large; its mutation layer carries three coupled temporal state machines (move pointers,
   the cycle pointer, the XP ledger) — too coupled for example-based testing alone.
3. **What the advisor should pin, concretely:** (a) F7 move semantics as a small state
   table — legal transitions, chain collapse at write time, un-move, same-day no-op,
   collision rule — so the B1 fix is made against a contract instead of review prose;
   (b) a requirement that any new mutation-layer state ships with invariant-style tests
   (compose the operation with itself and its inverse), the single practice that would
   have caught all three passes' new defects before review.

## Verified

- Ran `npx jest src/domain src/queries --forceExit` → 11 suites, 147 tests, all pass.
- Read in full: the pass-3 diffs (`dayState.ts`, `internal.ts`, `mutations.ts`,
  `cycles.ts`, `achievements.ts` header, both test files, `fakeRepos` fail-injection);
  traced every N-item fix and its test against the pass-2 acceptance criteria;
  inversion-checked that the N1/N2/N3/N4/N5 tests fail under the code they replaced
  (including N2's January-award-vs-June-pointer construction, which makes the cycle-id
  assertion genuinely discriminating).
- Bypass check for N1's structural claim: grep for `resolveOccurrence` across
  `src/queries` — only `internal.ts`'s two shared call sites; `reconcileOccurrence` uses
  `resolveOneOccurrence`; the ≤60-day guard closes the fetch-window asymmetry.
- Adversarial move compositions traced by hand: forward re-snooze (works), move-back
  (B1), same-day (B1), move-onto-logged-day, move-onto-off-day, move-across-boundary,
  chained A→B→C (works).
- Regression sweep as above; ownership via `git show e008938 --numstat`; "streak" grep
  clean; review-file integrity: unchanged since my pass-2 commit (`git diff ee3f8d7 HEAD`
  on this file was empty before this overwrite).
