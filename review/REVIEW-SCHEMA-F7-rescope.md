# Review — SCHEMA.md §4.2 F7 rescope + MODULES/API consistency edits (pass 2)
VERDICT: CHANGES_REQUIRED

Pass 2, reviewing commit `7850315` (rework of all six pass-1 findings) against
`docs/PRD.md` §3.7/§4/§6/§7 + Decisions 21, `docs/API.md` §3's mutation-sequence contract,
and the pass-1 review. Five of six pass-1 findings are fully and correctly resolved; the
sixth (migration ownership) is resolved in structure but its rework introduced **one new
defect** — a factually false claim about XP reconciliation that would misdirect M1's
migration and the §9 fixture. That single item is all that blocks. The four focus checks
the orchestrator requested are reported under Verified; all four pass on substance.

## Blocking items

1. **SCHEMA.md 259–261 — "Downstream, F5 and XP recompute from the restored occurrences
   on the next read; no separate backfill is needed" is half-false, and the false half is
   the one M1 will build against.** F5: true — a pure read, recomputed every query. XP:
   false — `xp_award` is a ledger written **only** inside the mutation sequence
   (API.md 176: "mutations own persistence *and* all downstream reconciliation";
   API.md 209–217, step 3). No read path ever writes or retracts an award, so nothing
   "recomputes XP on the next read." Consequence for a normalised legacy row: under the
   old contract the visitor's award keyed on its resolved display date (old T-3 —
   C7: "the award keys on B while the occurrence shows there"). Clearing a long-distance
   pointer S→T returns the occurrence to S displaying e.g. `ideal` with **no award at S**,
   while the stale `(τ, T)` award survives at a date that may now resolve blank — an
   award/outcome incoherence that no read will ever repair, and that the first unrelated
   mutation reconciling T will "fix" as a surprise retraction the user never caused. This
   is exactly the C4b-class incoherence (an award at a date whose outcome is not
   showing-up) the contract everywhere else forbids qa to accept.
   **Fix:** correct the sentence (F5 only), and **pin the award policy for normalised
   rows** — the architect's choice, e.g.: (a) the migration deliberately leaves the
   ledger untouched (lifetime totals unchanged — consistent with §2.3/§7's
   permanent-ledger posture), stale `(task, date)` keying from pre-rescope stores is
   accepted, and §9's migration fixture must assert **totals and row survival, not
   award/date coherence**; or (b) the migration re-keys or clears awards for normalised
   rows under a stated rule. Either is defensible; silence plus a false recompute claim
   is not. Mirror whichever policy is chosen in CR-4's M1 bullet (MODULES 227–237).
   **Acceptance test:** M1 can implement the migration and qa-tester can design the §9
   legacy fixture from the doc alone, without discovering mid-build that reads never
   reconcile XP, and the fixture's award assertions are derivable from the pinned policy.

## Non-blocking notes

- **W-1u's rejection clause lacks the "zero writes, zero reconciles, zero events" tail**
  that W-1s carries. Same semantics are clearly intended; copying the six words would
  remove the only asymmetry between the two blocks.
- Carried from pass 1, still open, still non-blocking: **C7's implicit fixture
  constraint** (its "D+1 not-due" end state requires a case-3/non-natural target — PRD §6
  pins the weekday-cadence fixture; one clause in the row would stop a daily-cadence C7
  fixture from wrongly failing); the **`"schemaVersion": 3`** example in §9 will drift
  once the CR-4 migration lands.
- CR-4 still sits between CR-2 and CR-3 (cosmetic; the rewritten intro at MODULES
  182–188 now disambiguates status, so this no longer risks a builder question).
- API.md 201 retains one `useMoveOccurrence` mention — correctly, as the "these replace"
  historical note. Not a hazard.

## Verified

**Focus check 1 — the restructured CR-3 genuinely eliminates the F1-class hazard.**
Held to the highest bar, including the skim-path: the heading pair alone
("Current state — this is the live guidance" at MODULES 253 / "Historical — …
(SUPERSEDED; do not implement from this)" at 293) gives a skimming builder the right
answer before any body text. The deleted redirect-inbound rule now appears exactly once,
**inside the Dead list**, quoted, marked "Deleted," with its one-row replacement stated
inline and the explicit "direct route back to the F1 defect class" warning (263–268). The
Historical block contains rationale only — no implementable mechanic survives in it (the
old "two halves" paragraph, the write-normalisation rule, and the "C1–C8" qa instruction
are gone entirely; grep confirms zero hits for "two halves", "C1–C8", or the redirect
rule text outside the Dead list). The qa-tester paragraph (280–286) names the current
set (C1, C4, C4b, C4r, C5, C6, C7, C9–C14), explicitly forbids C2/C3/C8 with correct
per-case reasons, and carries the §7-blocked undo-reachability caveat — which also
resolves my pass-1 non-blocking note on C9. The survival annotations in the Historical
bullets ("survives, as PRD §3.7 case 2" / "survives unchanged") are accurate and
consistent with the fence's "superseded **where they differ**" wording. Hazard
eliminated.

**Focus check 2 — W-1u under adversarial reading.** I attempted both failure directions
and found neither:
- *False reject:* the sole rejection is `pointer(D)` null; every legal undo has a
  non-null pointer by definition, so no legal undo can be rejected. The two clauses that
  wrongly rejected undo under pass 1's shared list are now explicitly inverted (not-due
  source = NORMAL case via R-2; `snoozable` irrelevant per PRD rendering 3 — both stated
  with their reasons).
- *False accept:* undo with a pointer present is always legal per PRD §3.7 — no state
  restriction exists on undo, `snoozable`-off must not strand a snoozed occurrence
  (C14), double-undo hits the null-pointer rejection, and a hook-level undo of a
  **dormant** occurrence (displayed nowhere) is required — C9's final step and PRD §6's
  fixtures depend on it, and the §7 gap concerns UI reachability, not API legality.
- The D-addressing pin ("D is always the occurrence's OWN date … never the date being
  viewed", mirrored at API.md 203–204) closes the wrong-row hazard I checked in the C6
  shape, where both D and D+1 carry pointers and a viewed-date caller would have cleared
  the wrong one. W-3's per-operation event dates (snooze → D+1, undo → D) are internally
  consistent ("the date the occurrence now lives at") and match API.md. Correct, modulo
  the non-blocking zero-writes tail.

**Focus check 3 — C5's revival mechanic vs CR-2 and monotonicity.** Consistent. I walked
the full flow: the first snooze retracts the visitor's vacated-source award (the
already-sanctioned CR-2 case from the original passes, unchanged); the second snooze
reconciles D+1 and D+2; the revival at D+1 via clause (c) is **award-shaped
(monotonic-up)** — re-materialisation mints/re-affirms, it retracts nothing new. The
only retraction reachable in the vicinity is the shadowing/dormancy retraction already
sanctioned at C9 ("sanctioned, CR-2") in the pre-rescope passes; C5 adds no new
retraction class, and the lifetime-XP monotonicity boundary (missed/off/cycle-boundary/
deletion never retract — CR-2, API.md 163–169) is untouched. Also verified: W-1s permits
the second snooze (the displayed occurrence at D+1 resolves via clause (a), is in a
snoozable state, and is not itself snoozed); the end storage state equals C6's (pointers
D→D+1 and D+1→D+2, each exactly one hop, CHECK-legal, consistent with C13's
never-more-than-one-day invariant); and the row's required assertions (ordering,
revival, award re-materialisation, "a dormant visitor is never destroyed by its host
leaving") pin exactly what pass 1 found unpinned. The mapping paragraph now correctly
says C5's slot survives with inverted content rather than labelling the scenario
unreachable.

**Focus check 4 — legacy migration vs the D-rule.** The clear-to-NULL rule itself is
safe: I constructed every configuration I could and found no stranding — the row's data
rides home with the pointer clear (mirroring undo/C7 semantics, since old-contract taps
wrote to the visitor's own row per old T-2 clause (c), so there is no orphaned data at
the abandoned target); a legacy exactly-one-hop pointer is correctly kept; legacy
same-task double-inbound normalises to at most the one legal D−1 inbound, satisfying the
new invariant; clearing into a date that is another occurrence's legal target lands in
the C4 dormant shape, which is legal and revivable; and the ordering requirement
(normalise before adding the CHECK, one transaction) is correct for SQLite's
rebuild-to-add-CHECK limitation. The "conservative direction" claim is true for
*occurrence placement and logged data*. It is **not** true for the XP ledger — that is
blocking item 1, the one genuine defect this pass introduced.

**Pass-1 findings 1–6, resolution status:** 1 — resolved (above). 2 — resolved
(W-1s/W-1u split, D-addressing, per-op event dates; API.md 199–207 mirrors the split
including "undo rejects ONLY if there is no pointer to clear"). 3 — resolved (C5
restored, inverted, with the right assertions; mapping corrected). 4 — resolved in
structure (§4's `day_log` row now carries the CHECK verbatim and the one-hop wording at
SCHEMA 209; CR-4 widened to M0+M1 with the three-step ordered migration and the
table-rebuild note at MODULES 227–237; §4.2 247–250 names M1 and the transaction
discipline) — but see blocking item 1 for the defect inside its legacy-rows paragraph.
5 — resolved ("All four are approved" with per-CR status, MODULES 182–188). 6 —
resolved (`useSnoozeOccurrence()`/`useUndoSnooze()`; mechanical scan confirms every §3
mutation now carries the `use*` prefix).

**Footprint:** `7850315` touches exactly `docs/SCHEMA.md`, `docs/MODULES.md`,
`docs/API.md`; ARCHITECTURE.md untouched (its pass-1 state was clean and remains
consistent — footnote name, one-hop wording); no PRD, REQUIREMENTS, `design-input/**`,
`src/**` changes; working tree clean. The dormant-undo §7 gap remains genuinely open in
both SCHEMA's open note and the M4 brief — the rework did not disturb either.
