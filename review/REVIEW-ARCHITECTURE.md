# Review — Phase 3 architecture set: ARCHITECTURE.md + SCHEMA.md + API.md + MODULES.md (pass 1)
VERDICT: CHANGES_REQUIRED

Reviewed as one artifact set against `docs/PRD.md` (STATUS: APPROVED) and the
approved design (`design-input/fallback-handoff/uploads/ALLSCREENS_1.md`,
`design-input/fallback-handoff/_ds/verdant-design-system-*/`,
`design-input/fallback-handoff/fallback-theme.css`, Gate 2 per `design/APPROVAL.md`).
`design-input/fallback-handoff/scraps/` ignored.

Headline: **no path-ownership collision and no dropped or duplicated screen** — the two
highest-damage defect classes are clean (details under Verified). The blocking items are
two design-fidelity contradictions, one internal SCHEMA contradiction, and one
over-strong scaffold-deference instruction.

## Blocking items

1. **ARCHITECTURE.md §4.3 (lines 170–174) misstates S22's confirmed-delete destination —
   contradicts the approved design's load-bearing behavior.**
   §4.3 claims the confirmed delete is one of "two documented exceptions where the
   destination is *not* origin-dependent" and "always lands on the type's browse tab."
   The approved design says otherwise (`ALLSCREENS_1.md` S22, Interactions,
   lines 1204–1223): when S22 was opened from S20 and S20's *own* origin was S09 or a
   browse tab (S10–S13), confirmed delete returns to **that same screen** — the spec
   explicitly reproduces "S09 → S20 → S22 → confirms → **S09**" as a FLOWS.md edge. The
   type's-browse-tab fallback applies **only** when S20's origin is unstable (S14 or
   unknown); the S23 path always lands on S10. A builder implementing §4.3 verbatim
   ships wrong navigation for the most common delete path (delete from Today dumps the
   user on the Routines tab). MODULES.md M4 (lines 291–292) states only the S23→S10
   clause and is silent on the rest, so nothing downstream corrects this.
   **Fix:** rewrite §4.3's S22 clause (and extend M4's non-negotiable) to the design's
   two-level rule: confirm-destination = S20's own stable origin (S09/S10–S13) when it
   has one; else the deleted task's type browse tab; S23 path always S10.
   **Acceptance test:** §4.3 no longer claims the confirmed-delete destination is
   origin-independent, and the S09 → S20 → S22 → S09 case is stated verbatim.

2. **SCHEMA.md §7 Levels (lines 278–284): the Level-8 title contradicts S28's exact
   copy, and the "only L1 and L7 are pinned by the design" claim is false.**
   SCHEMA authors "8 Unshakeable" and asserts only L1 "Getting started" / L7
   "Consistent" are design-pinned. But `ALLSCREENS_1.md` S28 "Copy (exact strings)"
   (lines 2799–2800) pins the level-up fixture: headline "You're now Level 8." with
   subhead **"New title: Dependable."** MODULES.md Definition-of-done #3 (line 503)
   requires verbatim copy from `ALLSCREENS_1.md` — so M5 building S28 renders
   "Dependable" for level 8 while the M0/M2 title constant says "Unshakeable". Two
   builders following their own briefs produce a visible self-contradiction at the first
   real level-8 crossing.
   **Fix:** either set L8 = "Dependable" in the pinned constant (design-faithful,
   recommended), or explicitly record the divergence, instruct S28 to render the
   constant, and carve S28's demo title string out of the verbatim-copy rule. Either
   way, correct the provenance claim (the design pins L1, L7 **and** L8).
   **Acceptance test:** exactly one defined source for the rendered level-8 title, and
   SCHEMA's "pinned by the design" sentence matches what S28 actually pins.

3. **SCHEMA.md §2.3 (lines 113–119) vs §7 (lines 262–284): the delete cascade destroys
   `xp_award` rows, contradicting the artifact's own "XP never decays and a level never
   goes down" invariant.**
   §2.3 cascades task deletion to `xp_award` rows; §7 defines Lifetime XP as
   `SUM(amount)` over the ledger and pins "**XP never decays and a level never goes
   down**"; ARCHITECTURE.md §7 (line 379) adds "all progress reconciliation is
   upsert-only and monotonic". Deleting a task with history therefore lowers lifetime XP
   and can demote a level — the docs contradict themselves, and qa-tester asserting
   "nothing lifetime ever resets" (MODULES M5 line 349, PRD F13) can fail on a legal
   user action. Note PRD F7's own cascade names only "log + off-day records"
   (PRD line 398–399), and SCHEMA already exempts `cycle_record` from deletion by
   exactly this permanence logic (§2.3 lines 117–119).
   **Fix:** pin one behavior. Either exclude `xp_award` from the delete cascade
   (lifetime XP as a permanent ledger, symmetric with `cycle_record` and
   `achievement_unlock`), or explicitly declare task-deletion the sole sanctioned
   lifetime-XP reduction and reconcile §7's never-goes-down sentence plus the level
   display rule. State the expected result of a delete-task-with-history test.
   **Acceptance test:** §2.3 and §7 are consistent, and M1/M2 can both answer "what is
   lifetime XP after deleting a task with 10 ideal days?" identically from the docs.

4. **MODULES.md M0 (lines 77 and 87–89): scaffold deference is stated with no
   defect-fix path — "do not change" is stronger than the pin it protects.**
   "The shared type surface (already scaffolded — extend, don't restructure)" and
   "`roundHalfUp` / `toPercent` — **already written, do not change the algorithm**"
   instruct deference to scaffolded code inside paths the module *owns*. MODULES gives
   escape hatches for frozen/unowned surfaces (lines 3–4, 33–36, 53–56: "architect
   change request"), but nowhere says a builder who finds a genuine defect in scaffolded
   code within its own paths may fix it. A literal reader treats `src/lib/number.ts` as
   untouchable bytes rather than a pinned *algorithm* (§6.5 is the pin; the bytes are
   not). The same reading risk applies to "extend, don't restructure" on `src/types`.
   (Context noted from the orchestrator: the scaffold itself exceeded the architect's
   output contract; it currently typechecks and passes its tests, so this item is about
   the instruction's framing only.)
   **Fix:** add one rule to MODULES.md (top matter or M0): pinned decisions are pinned,
   scaffolded bytes are not — a genuine defect in scaffolded code inside your owned
   paths is yours to fix, with a regression test; only changes to pinned
   algorithms/contracts or frozen surfaces need an architect change request.
   **Acceptance test:** a builder can cite a line authorizing a defect fix in
   `src/lib/number.ts` (algorithm preserved) without an architect round-trip.

## Non-blocking notes

- **Counted-day provenance (ARCHITECTURE.md §6.4 header, line 291, and §13 row,
  line 549).** The decision itself is legitimate and correctly made: S25's "Open item —
  window-membership semantics" (`ALLSCREENS_1.md` lines 1582–1630) explicitly flags the
  choice for "Gate 2 / architect", the approved mockups and Appendix A's `agg`/`f`
  columns are mechanically counted-day, and §6.4 records the rejected alternative. But
  the citation "PRD §7, OWNER: architect" is wrong — PRD §7 contains no
  window-membership item (the PRD is silent, as §6.4's own prose admits). Cite S25's
  open-item flag as the delegation source. Also, the "approved S25 copy ('26 of the
  last 31 days')" quote is actually **S09's** stat-chip copy (lines 340, 394), and
  S09's display-format note declares that fixture degenerate (all 31 days qualifying),
  so it is consistent with either reading and is weak evidence; Appendix A's derivation
  rule is the real evidence and worth citing instead.
- **MODULES.md feature index (lines 490–493) is under-inclusive.** "F14 M7" omits M3's
  S09 re-entry banner state (which M3's own non-negotiable at line 247 assigns to M3);
  "F2 M4" omits M2, which owns `validateTaskDraft` implementing F2's validation rules.
  The work is unambiguously assigned in the module briefs, so this is informational,
  but the index claims to be the coverage check.
- **SCHEMA.md §2.3 "hard cascade at the next store compaction" (line 115):** "store
  compaction" is defined nowhere — no trigger, no owner, no schedule. M1 needs one
  sentence (when it runs) or drop the concept and hard-cascade after the undo window.
- **ARCHITECTURE.md §10 (lines 474–476): "the `danger` token is reserved for the
  erase-all confirm button"** — the design also puts the danger signal on S22's
  confirmed-delete button (`ALLSCREENS_1.md` lines 1172–1174) and MODULES M0 ships a
  `danger` Button variant. Loosen to "destructive-action confirm buttons (S22, S48)" so
  M4 doesn't read §10 as forbidding a danger button on S22.
- Verified but worth keeping an eye on: the level-title constant is correctly framed as
  a swappable architect-authored default (SCHEMA §7), and `req(L) = 100 + 150(L−1)` is
  honestly labelled as derived from two anchors — good practice; item 2 above is the
  only place the authored content collides with actual design copy.

## Verified

- **Path ownership (MODULES.md, all eight modules + architect-frozen list):** checked
  mechanically and exhaustively. `src/**` subtrees are disjoint (`types/theme/ui/lib/
  navigation/app-shell` M0 · `db, services/data, services/sync, features/data` M1 ·
  `domain, queries` M2 · feature folders `today/browse/search` M3, `task` M4,
  `progress` M5, `assistant, services/ai, services/billing, server` M6,
  `onboarding, settings, services/notifications, services/widgets, native, plugins` M7).
  Every `app/**` route file appears in exactly one module; `app/settings/*` splits
  cleanly (M1: sync, data/index, data/erase · M6: subscription · M7: index,
  notifications, theme, widgets, help); `app/_layout.tsx` + `app/(tabs)/_layout.tsx`
  M0-only; `app/index.tsx` + root configs architect-frozen, owned by no module.
  **No two modules own the same path.**
- **Screen coverage:** all 50 screens S01–S50 assigned exactly once (M1:5, M3:6, M4:10,
  M5:6, M6:11, M7:12, M0/M2:0 — sums to 50); every route in MODULES matches the
  `route:` line in `ALLSCREENS_1.md` (S01–S50 enumerated); S33/S36 correctly routeless
  as components, matching "route: within /assistant/*". Scaffolded route files on disk
  match the ownership lists.
- **Feature coverage:** F1–F9, F11–F21, F23–F31 all assigned; F10 correctly documented
  as a PRD numbering gap (PRD Decisions item 5); F22 correctly deferred as P2 with
  explicit do-not-build-toward-it language (MODULES M1 line 154, ARCH §9.2, API §6),
  matching PRD §4.
- **Dependency graph:** acyclic; Wave 1 (M0/M1/M2) → Wave 2 (M3–M7) matches each
  module's "Depends on contracts"; the one intra-wave coupling (M1's screens on M0's
  six kit components) is declared with a delivery order; M2→M1 is decoupled via the
  M0-owned `Repositories` port; M2→M7 decoupled via the closed event bus.
- **Consistency algorithm (ARCH §6 vs PRD §3.4/§3.5, Decisions 6/13/16/18):** off days
  excluded from both sides; aggregate = proportional fractional credit, Σ f(D) ÷ count
  of qualifying days × 100; per-task scope whole 0-or-1, unchanged; off-ness and
  pending-ness compose per task within a day; as-needed exclusion kept structurally
  distinct from off-days; `null` (never 0%) on zero denominator; single terminal
  round-half-up through one function, no intermediate rounding of f(D). Re-derived
  every §6.6 golden row against PRD §3.5/§6: 26/26→100, 26/30→87, 26/31→84, 27/32→84,
  3-day anchor →67 (not 50), 1/8→13, pending/skip/day-end rows, `numerator =
  denominator − missed`. All match. Chip→outcome mapping and the multi-dose
  day-counts-once rule match PRD §3.3/F12/F24.
- **Counted-day rule text (ARCH §6.4) vs S25's provisional rule (lines 1595–1613):**
  matches clause-by-clause (off skipped without consuming a slot but tallied; pending
  and zero-due excluded entirely; truncate, never fabricate; aggregate skips a day only
  when every due task is off; F28/F30 as calendar ranges). Provenance nit only (see
  non-blocking).
- **Design fidelity, spot-checked deep:** signal/accent hexes in ARCH §5 and
  `src/theme/tokens.ts` match `fallback-theme.css` + Verdant `colors.css` exactly, and
  the dark palette matches the dark-override block embedded in
  `Fallback Handoff (standalone).html` (#211f1c/#7CA95F/#6C9DBE/… — confirmed present;
  the "transcribed" claim is true); accent closed set {Forge Orange, Indigo, Berry,
  Plum} matches S06/S21/S43; level curve fits both design anchors (L1 0/100, L7
  620/1000 — S27 lines 2354/2389); XP 10/6 matches S24 (+10/+6, line 1442); badge
  catalogue matches S27 exactly, including day-level showing-up counts vs task-level
  fallback-wins counts and "Never zero (10th fallback)"; Cycling XP label-follows-
  cadence; S26 thresholds (<3 mo/3 mo–3 yr/3 yr+), completed-buckets-only, gap-as-break,
  always-present SR summary; S25 legend unit split + round-half-up display rule;
  origin-aware set {S14, S22-cancel, S23, S25, S27, S29, S48} matches the design's
  load-bearing notes; S48 dual-origin copy, erase→S01 both origins, and API §1.1's
  exact failure string; S38 card structure, pricing, trial, store-outage asymmetry;
  S16 as-needed branch + coarse-cadence degenerate note; S20's "replicate it, don't
  reinvent it" validator quote (line 1024) — accurately carried into M2/M4.
- **PRD invariants carried:** no-streak (incl. the banned token everywhere), no
  analytics/telemetry, offline P0 + exactly four opt-in network surfaces, BYO key in
  SecureStore only and excluded from backups, receipt-based no-account backend,
  guardrail categories + logs-literally fixtures verbatim from F16, F27 zero-XP/
  reference-only invariants (Decisions 17), archive-before-zero cycle boundaries and
  the nothing-lifetime-resets rule (F30/F31), tenure anchor decision correctly claimed
  from PRD §7 (genuinely OWNER-delegated there) with rationale and rejected
  alternatives, erase-all atomicity and Gate/recovery routing (F25/F1).
