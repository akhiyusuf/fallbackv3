# Review — Phase 3 architecture set: ARCHITECTURE.md + SCHEMA.md + API.md + MODULES.md (pass 3)
VERDICT: PASS

Pass 3, reviewed after commit d1f703b, confined per the coordinator's brief to the
changed surface (MODULES "Scaffold deference" bullet, SCHEMA §2.3 sweep wording +
extended required test, SCHEMA §9 restore-validation clause, `src/lib/number.test.ts`
header comment) and to regressions. Governing inputs unchanged: `docs/PRD.md` and the
approved design under `design-input/` (PROJECT OVERRIDE per `CLAUDE.md`).

**The artifact set passes.** The pass-2 blocking item is genuinely fixed and survives
adversarial reading; the three non-blocking items are addressed; the one unrequested
addition (SCHEMA §9) is correct and conflict-free. The four documents are fit to launch
the eight feature-builders against.

## Blocking items

None.

## Non-blocking notes

- **ARCHITECTURE.md §14 line 618:** "`src/lib/number.test.ts` … may be extended by
  M0/M2, never weakened" — "M0/M2" sits slightly askew of file ownership (the test
  header and MODULES both put the file in M0-owned `src/lib`; M2's golden tests live in
  its own `src/domain` tree). Unchanged since pass 1 and harmless in practice — an M2
  extension would arrive as a change request under the ownership rules — but worth
  aligning to "M0 (M2 via change request)" whenever §14 is next touched. Not blocking:
  no builder can act wrongly on it without violating an unambiguous rule elsewhere.
- **Observation, no action needed:** in the corrected bullet, "the eight locked
  assertions … are the arbiter" is safe only *in conjunction with* the preceding
  bullet's pin of "the round-half-up algorithm (§6.5)" itself — a change that satisfies
  all eight cases but alters the pinned algorithm (e.g., `snap` precision) is caught by
  the pin enumeration, not by the tests. The two bullets together close this; neither
  alone would.

## Verified

**1. The corrected rule is unambiguous under adversarial reading.** The new three-part
rule (MODULES lines 52–58) was walked through the section's own scenario and several
constructed ones:
- `roundHalfUp(12.5) → 12` defect: assertion fails → the fix makes it pass → "exactly
  what a defect fix looks like — that is the good case, ship it." Every sentence in the
  bullet now gives the same answer; the pass-2 inversion is gone (and the coordinator's
  grep confirms no "pass that used to fail" phrasing survives anywhere in `docs/` or
  `src/`).
- Illegitimate reopening (banker's rounding): caught twice — it makes the 12.5/2.5/0.5
  assertions "fail that used to pass," and it is named in the pin list.
- Silent-divergence attempt (change satisfying all eight assertions but altering §6.5's
  pinned code, e.g. `snap` at 9 dp): caught by the previous bullet's enumerated pin (see
  observation above).
- Legitimate fix the rule might over-forbid: none found. A fix that changes no locked
  outcome is authorized by the "fix it" bullet; a fix that flips a failing assertion to
  passing is the named good case; scoping never-edit to "the eight locked assertions"
  correctly leaves builder-added extension cases correctable.
- Polarity of the two bullets above and M0's `number.ts` scope line (111–114)
  re-checked: consistent ("the implementation bytes are yours to correct if they are
  defective, the algorithm is not yours to change").

**2. `number.test.ts` header and the MODULES rule genuinely agree**, clause by clause,
not merely in tone: (a) never change an existing assertion's expected value → raise
(both); (b) a change to `number.ts` making an assertion fail that used to pass is wrong
(both); (c) a change making a failing assertion pass is the good case, ship with a note
in the result (both — the note requirement matches MODULES' "say so in your result so
the fix is visible", lines 44–46). The header now cross-references
`docs/MODULES.md` "Scaffold deference" so the two cannot drift silently. Coordinator
confirmed the diff is comment-only (no assertion or expected value touched) and jest is
8/8; the diff I inspected agrees.

**3. The unrequested SCHEMA §9 restore-validation clause is correct and conflicts with
nothing.**
- Correct: `xp_award.task_id` is `NULL`-able with `ON DELETE SET NULL` in the live
  schema (SCHEMA §7), so a NULL is a legal state any faithful restore must accept;
  SQLite FKs do not constrain NULLs, so the staging-schema insert succeeds without
  special-casing. The stated failure mode (a builder's referential-integrity check on
  the restore path silently undoing the XP-permanence fix) is real and this is the
  right place to close it.
- No conflict: API §1.1's `restore` contract fails only on `VALIDATION_FAILED`
  (unreadable/foreign file) — grep confirms no referential-integrity language anywhere
  in API.md or SCHEMA.md that the clause could contradict; the M1 brief's
  non-destructive-failure rule is untouched; F20 sync reuses the same envelope (API §6)
  and inherits the same semantics; the clause is correctly scoped to NULL `task_id`
  rows and does not weaken validation of anything else.
- The extended §2.3 required test is mechanically consistent with the schema: it
  sequences the NULLing *after* the hard sweep (where `ON DELETE SET NULL` actually
  fires — before the sweep the soft-deleted task row still exists and `task_id` still
  points at it), asserts lifetime XP unchanged at both stages, and its backup/restore
  leg matches the new §9 clause ("must not be dropped, rewritten or restored as 0 XP").

**4. No regression from the §2.3 rewording.** "hard-deletes every row already
soft-deleted at open time" now has a precise trigger, owner and row-set; MODULES M1
line 174 ("hard sweep runs on the next `open()`; there is no compaction job") still
agrees; no other doc references the old session phrasing or "compaction". The diff
touches nothing else in SCHEMA; §2.3's split-cascade table, §7's ledger, and the ER
summary are byte-identical to the pass-2-verified state.

**Standing verification (passes 1–2, unchanged).** Path ownership disjoint across all
eight modules; all 50 screens assigned exactly once with routes matching
`ALLSCREENS_1.md`; F1–F31 covered (F10 gap, F22 P2 correctly handled); waves acyclic;
consistency algorithm matches PRD §3.4/§3.5 and Decisions 6/13/16/18 with the §6.6
golden table re-derived; counted-day pin properly delegated via S25's open item;
S22/S48 navigation, token set (light + design-derived dark), level ladder (three
design-pinned titles), badge catalogue and provenance labels, XP-cascade split and
monotonicity — all verified against the design and PRD in the prior passes and
untouched by this commit. `tsc --noEmit` clean and jest 8/8 per coordinator.
