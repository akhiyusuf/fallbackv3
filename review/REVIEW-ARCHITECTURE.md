# Review — Phase 3 architecture set: ARCHITECTURE.md + SCHEMA.md + API.md + MODULES.md (pass 2)
VERDICT: CHANGES_REQUIRED

Pass 2, re-reviewed after commit f8ea4ba against `docs/PRD.md` and the approved design
(`design-input/fallback-handoff/uploads/ALLSCREENS_1.md`, Verdant DS, `fallback-theme.css`;
Gate 2 per `design/APPROVAL.md`). All four pass-1 blocking items and all four non-blocking
notes were genuinely addressed, not merely reworded — verified against the design line by
line, details under Verified. The architect's two self-found extras (L3 title collision,
tenure title-casing) and its badge-provenance audit were independently confirmed as
correct. **One new defect introduced by the rework blocks a PASS: a single inverted
sentence in the new scaffold-deference section that contradicts its own example and, read
literally, forbids the exact fix the section exists to authorize.** It is a one-sentence
correction.

## Blocking items

1. **MODULES.md, "Scaffold deference" section, lines 52–55 — the locked-assertion
   sentence is inverted and contradicts the example immediately before it.**
   The bullet reads: "`roundHalfUp` returning the wrong value for 12.5 would be a defect
   worth fixing; changing it to banker's rounding would be re-opening a pin. **If a fix
   would make one of the eight locked assertions in `src/lib/number.test.ts` pass that
   used to fail, the fix is wrong — raise it instead.**"
   Walk the authorized scenario through the final sentence: if `roundHalfUp(12.5)`
   returned 12 (a defect), the locked assertion `roundHalfUp(12.5) === 13` *fails*; the
   defect fix makes it *pass* — which the sentence then declares wrong and tells the
   builder to raise instead. That is the precise suppression failure mode this section
   was added to eliminate, now stated inside the section itself, one sentence after the
   example that permits the fix. (All eight assertions currently pass, so the sentence
   describes an impossible present state — but the moment it becomes applicable is
   exactly the defect-fix moment, with inverted polarity.) The intended rule is
   presumably the test file's own never-weaken guard, which concerns edits *to the
   assertions*, not to the implementation.
   **Fix:** replace the sentence with the correctly-oriented pair, e.g.: "A fix must
   never require editing a locked assertion's expected value — if it does, you are
   re-opening the pin: raise it. A code change that makes a locked assertion *fail* that
   used to pass is wrong. A code change that makes a failing locked assertion pass is
   exactly what a defect fix looks like."
   **Acceptance test:** applying the section's own 12.5 example to every sentence in the
   bullet yields one consistent answer (fix it, don't raise it), and no sentence in the
   section condemns a change that brings the implementation into line with an unedited
   locked assertion.

## Non-blocking notes

- **The same inverted sentence lives in `src/lib/number.test.ts`'s header comment**
  ("if a change here makes a case pass that used to fail, the change is wrong"). In the
  test file, "a change here" plausibly means an edit to the assertions (never-weaken),
  where the logic is closer to right — but it shares the ambiguity. I cannot touch
  `src/**`; when M0 first extends that file, the comment should be reworded to say
  "never change an existing assertion's expected value" (M0 owns the file; this is a
  defect-class comment fix under the new scaffold-deference rule once item 1 lands).
- **SCHEMA.md §2.3 (lines 116–118):** "sweeps rows whose `deleted_at` is older than the
  current session" is slightly fuzzy (a session has no timestamp). Suggest: "`open()`
  hard-deletes every row already soft-deleted at open time." Trigger and owner are now
  defined, so this is wording only.
- **SCHEMA.md §2.3 required test** is well-formed and M1/M2-symmetric; consider also
  asserting the orphaned rows survive a backup→restore round trip (the §9 envelope
  includes `xp_award`, and `taskId: null` must serialize/restore cleanly).

## Verified

**Pass-1 blocking item 1 (S22 delete destination) — fixed in both places.**
ARCHITECTURE §4.3 now states cancel and confirm as two separate rules with the two-level
confirm lookup, matching `ALLSCREENS_1.md` S22 (lines 1155–1166, 1202–1247) clause by
clause, including the verbatim S09 → S20 → S22 → confirm → S09 edge, the unstable-origin
(S14/unknown) fallback to the type browse tab, the S23 → always-S10 rule, and
S14-never-a-post-delete-destination. Critically, **MODULES M4 (lines 325–336) now carries
the full rule itself** — both bullets, the two-level lookup, and the explicit "Deleting
from Today returns to Today, not to the Routines tab" — so a builder reading only its own
brief cannot ship the old behaviour. S48's erase→S01 correctly remains the sole
origin-independent case.

**Pass-1 blocking item 2 (level-8 title) — fixed, and the two self-found extras are
genuine.** SCHEMA §7 now tabulates all ten titles with per-row provenance; L8 =
"Dependable" matches S28's exact-copy block (line 2800, coordinator-confirmed).
Independently verified: (a) the design pins exactly three titles — my own grep of every
"Level N ·" string in `ALLSCREENS_1.md` finds only L1 (lines 2354/2417/3883), L7
(2301/2389/3859/3905) and L8 (2799–2800); (b) the **L3 collision was real** — "Showing
up" is an S27 badge-category header rendered on the same screen as the title ladder
(lines 2318–2321, 2395), so moving L3 off it was correct; the new ladder (Warming up /
Finding your rhythm / … / Unshakeable L9 / Enduring L10) collides with no S27-rendered
string — checked against every badge label, category header and tenure label; (c) the
**tenure title-casing was real** — S27's exact-copy block (lines 2401–2403) renders
"First day" · "1 Week" · "1 Month" …, and SCHEMA now carries those exact labels with a
note that S27's rendered copy wins over the PRD's lowercase prose. The
single-source-of-truth rule (S28 renders `levelFor(xp).title`, never a hardcoded string)
is stated in SCHEMA §7 and mirrored in MODULES M5 (lines 396–399), resolving the
verbatim-copy-vs-constant tension by construction. Constant ownership is now unambiguous
(M2, `src/domain/xp.ts`) — the pass-1 "M0/M2" ambiguity is gone.

**Badge audit — independently confirmed, all provenance labels honest.** Checked each
cited line: "Safety net" first-fallback (line 2480 Appendix B row + 2681–2682);
"Never zero" = 10 task-level fallbacks (2493: "(10th fallback)", 2685–2687);
"Saved 25×" **is** design-witnessed — line 2714 states it is locked because "Maya's
task-level fallback count hasn't reached 25", witnessing both the threshold and the
task-level unit; "Comeback" day-after-missed (2697–2699); "100 done" design-witnessed as
a task-completion count (2708–2712); "Full week" 7/7 (2324, 2562 Appendix B row,
2700–2701); showing-up badges day-level per S27's own fix note (2407–2414);
"Course ×3" appears in the design only as a label (2324, 2400) with no stated condition,
so "architect-authored" is the honest classification. Labels in SCHEMA's new table match
S27's exact-strings block (2397–2403) verbatim.

**Pass-1 blocking item 3 (XP cascade) — complete and consistent across all five files.**
SCHEMA §2.3 is now a pinned two-column split (cascaded: step / day_log / off_day_mark /
as_needed_use; permanent: xp_award via `ON DELETE SET NULL`, achievement_unlock,
cycle_record) with the intentional-asymmetry rationale and a concrete M1+M2 required
test; §7's ledger table carries the nullable FK, the NULLs-distinct UNIQUE note (correct
SQLite semantics — orphans can't collide with new awards or each other), and the
corrected corrections-vs-deletion sentence; the ER summary reads `task 0──n xp_award …
awards OUTLIVE their task`. ARCHITECTURE §7 gains the monotonicity-survives-deletion
bullet; API §1 `softDelete` and `ProgressRepository` comments and API §2's invariants
carry the same rule; MODULES M1 (lines 169–174) and M2 (lines 234–240) both state it
with the same required test. `src/types/progress.ts` has `taskId: Id | null` with the
matching doc comment. Grepped all four docs for surviving contradictions: no statement
anywhere still destroys XP rows on delete or allows a level to go down; "XP never decays
and a level never goes down" is now unconditionally true as stated. The mid-soft-delete
window is sound by construction (occurrences derive from non-deleted tasks, so F5
excludes the deleted task's days immediately, before the `open()` sweep).

**Pass-1 blocking item 4 (scaffold deference) — structurally fixed, one sentence
defective.** The new section (MODULES lines 38–58) gives a clear authorization ("fix it…
Do not preserve a bug out of deference"), an enumerated closed list of pinned decisions,
a workable src/types rule, and the M0 brief's two strong statements were rewritten to
match (lines 96–98: "restructure or correct it if it is actually wrong"; 111–114:
"the implementation bytes are yours to correct if they are defective, the algorithm is
not yours to change"). Only the inverted sentence in blocking item 1 mars it.

**Pass-1 non-blocking notes — all four addressed.** §6.4 provenance now cites S25's own
open-item delegation (lines 1582–1630 — range verified) with the Appendix A derivation
note (1611–1613 — quote verified) as evidence, explicitly disclaims PRD §7, and
correctly demotes the "26 of the last 31 days" fixture as degenerate under both rules
(S09's display-format note confirms); §13 retitled with the design-delegated marker.
Feature index gains F2 M2/M4 and F14 M3/M7 with correct rationales. "Store compaction"
replaced by a defined trigger and owner (M1's `StoreLifecycle.open()`, "no compaction
job" — consistent in SCHEMA §2.3 and MODULES M1). §10's danger-token rule now names S22
+ S48 with S22's own "danger lives on the button only" quote, and M4 carries the S22
danger-variant note.

**No regressions elsewhere.** The rework diffs touch only the sections above (confirmed
via `git diff HEAD~1`); coordinator confirmed owned-path lists and screen assignments
are byte-identical for `src/`/`app/` ownership, `tsc --noEmit` clean, jest 8/8. The
pass-1 Verified findings (path disjointness, 50-screen coverage, feature coverage,
acyclic waves, consistency algorithm vs PRD §3.4/§3.5 and Decisions 6/13/16/18, golden
table, token fidelity incl. the design-derived dark palette, counted-day rule text vs
S25, origin-aware set, S38/S48/S16/S20 fidelity) stand unchanged.
