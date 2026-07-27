# Review — PRD.md §3.7 F7 amendment + REQUIREMENTS.md R9 CHANGE NOTE (pass 2)
VERDICT: CHANGES_REQUIRED

Pass 2, reviewing commit `2bf2266` against the pass-1 review. All three
pass-1 substantive findings are genuinely fixed (see Verified), and the
banner-footprint item received its waiver disposition from the orchestrator.
REQUIREMENTS.md has zero diff this pass (confirmed: commit touches PRD.md
only), which is correct — R9 needed no change.

Two NEW blocking items, both introduced by this pass's rework — specifically
by the displayed-occurrence binding and the state-list edit. Both are cases
where the architect (or M4) would have to invent user-visible product
behavior. Nothing from pass 1 remains open.

## Blocking items

1. **"Undo is always available on a snoozed occurrence" (PRD 463) is
   unsatisfiable, or ambiguous, under the new displayed-occurrence binding
   (PRD 443–448) in at least two concrete cases the spec itself makes
   reachable.** The snooze slot's rendering is "determined by the sheet's
   displayed occurrence" (428–429), and the only display surface is S20's
   today-scoped occurrence card, with the heatmap drill-down explicitly
   offering no snooze control (445–448). Walk the guarantee through:
   - **(i) Immediately after snoozing** (the mis-tap scenario the delegated
     undo call at item 21 cites as its core rationale): today's occurrence
     relocates to D+1, so today is vacated. Is the "displayed occurrence" now
     the snoozed occurrence (→ rendering 3, "Undo snooze") or is it "no
     occurrence at all (the task is not due on the sheet's date)" (→ rendering
     2, disabled, per 434–435 and the edge case at 486–487)? The text supports
     both readings. If rendering 2, Undo is unreachable at the exact moment
     the delegated call says it matters most.
   - **(ii) The same-task natural-target merge** — in scope by this
     document's own invariant (494–497: "the target day's own occurrence is
     unchanged"; item 21, 1604–1611). Daily task, yesterday's occurrence
     snoozed onto naturally-due today: today's card displays today's OWN
     occurrence (never-snoozed → rendering 1). The snoozed visitor is
     displayed nowhere, today or any later day — so its guaranteed Undo has
     no surface, ever. The acceptance criterion and the binding rule cannot
     both hold as written.
   (The non-merge cross-day case resolves correctly: on D+1 a visitor on a
   non-natural date IS the displayed occurrence → rendering 3. Only (i) and
   (ii) break.)
   **Fix:** pin the card's display rule for a snoozed occurrence — e.g. "after
   snoozing, the sheet's occurrence card continues to display the snoozed
   occurrence, marked as snoozed to D+1, with the slot in rendering 3" — and
   then either (a) specify the display/undo surface for the merge case (ii),
   or (b) explicitly scope the undo guarantee ("always available while the
   snoozed occurrence is the sheet's displayed occurrence") AND reconcile
   that scoping with the delegated call's reversibility rationale in item 21,
   flagging any newly-irreversible case to the human the same way undo itself
   was flagged. **Acceptance test:** for each of (i) and (ii), a builder can
   answer "what does the card show, and where does the user tap Undo?" from
   §3.7 alone, and no reachable snoozed occurrence contradicts whatever the
   undo-availability sentence ends up promising.

2. **"A logged occurrence carries its chip state, step detail and XP award
   with it to D + 1" (PRD 455–456) is new this pass, unqualified, and
   collides with the same-task natural-target edge case (494–497).** When the
   target day is naturally due, §3.7 says the target's own occurrence "is
   unchanged" — so the visitor's carried state cannot be what D+1 displays,
   and if its XP award also "carries to D+1" while the target's own
   occurrence can independently earn there, the date double-credits (the
   exact exploit shape M2's reviewer adversarially probed per STATE.md). The
   undo bullet's "re-affirmed" (465) already implies the award may lapse in
   between, contradicting an unqualified "carries with it." As written, the
   architect must choose between the two sentences when rewriting SCHEMA
   §4.2's merge handling — a product call, not an engineering one.
   **Fix:** qualify the sentence — the carried state/award apply when the
   snoozed occurrence is the resolved occurrence at D+1; when the target's
   own occurrence is present, state the visitor's award status during the
   merge (dormant/not counted until undo, or whatever the spec-writer pins
   under the existing delegated-call flag), bounded by two invariants §3.7
   already implies: never double-credit one date, and undo restores the
   original state and award exactly. **Acceptance test:** for "complete at D,
   snooze onto naturally-due D+1," §3.7 yields exactly one answer to "what
   does D+1 display, and does the app currently count the visitor's XP?" —
   and no reading permits two awards for one date.

## Non-blocking notes

- §7's amended open item (1338–1344) still names OWNER: designer /
  screen-designer — agents the PROJECT OVERRIDE forbids invoking; in practice
  it lands on M4 + Gate-3 human review. Pre-existing wrinkle (same as F27's
  item, noted in REVIEW-PRD.md), carried, not blocking.
- The copy-inspection acceptance narrowed from "any occurrence-management
  flow" (pass 1) to "anywhere in the sheet" (440–442). No drop in practice:
  S20 is the design's only snooze surface (grep of ALLSCREENS_1.md: zero
  snooze/move references outside S20), S23 is explicitly excluded (498–499),
  and §4's non-goal (1146–1153) preserves the app-wide ban on move actions,
  pickers, and hooks. Worth keeping the §4 pairing intact in future edits.
- The "Evidence" paragraph (413–421) is interpretive rationale (alarm-clock =
  fixed push vs calendar = free selection), but its factual substrate is
  verbatim-accurate (verified below) and it is framed as evidence, not as a
  design instruction. Fine.
- Rendering rules 1–3 (430–439) are mutually exclusive and total given a
  defined displayed occurrence (snoozed → 3, regardless of `snoozable`; else
  non-snoozable-or-absent → 2; else → 1), and rendering 3's precedence over a
  later `snoozable`-off matches the edge case at 488–490. Clean — the pass-1
  wobble is genuinely resolved, modulo blocking item 1's display-rule gap.

## Verified

- **Footprint (git):** `git show --stat 2bf2266` — PRD.md only;
  REQUIREMENTS.md zero diff as the orchestrator stated. All hunks fall in
  §3.7, §3B (F27 "Does NOT do" — same pure-cross-reference class as the
  cleared F26 fix: no occurrence set ⇒ no snooze, no S23 slot), §4, §6, §7,
  Decisions item 21, plus one pointer sentence in the waived header banner
  (29–31, still zero normative content). `STATUS: APPROVED` unchanged.
- **Pass-1 finding 1 (design precedence) — FIXED.** The three-row table
  (398–405) names ALLSCREENS_1.md lines 1025/1072, line 1055, and the three
  additions; the still-controlling list (407–411) enumerates the untouched
  S20 surfaces. Completeness re-checked against the full S20 spec
  (ALLSCREENS_1.md 995–1090): the only F7-interaction lines in the Gate-2
  design are 1025, 1055, 1072 — all named; no other screen references
  snooze or move (repo-wide grep of ALLSCREENS_1.md). Icon evidence
  independently re-verified by me against
  `design-input/fallback-handoff/Fallback Handoff.dc.html` line 867:
  `data-lucide="copy"`→Duplicate, `data-lucide="alarm-clock"`→Snooze,
  `data-lucide="calendar-days"`→"Move day", exactly as cited; "Move day"
  appears nowhere else in that file.
- **Pass-1 finding 2 (occurrence binding + state list) — FIXED, with one new
  consequence (blocking item 1).** Binding pinned to the sheet's displayed
  occurrence with the heatmap drill-down excluded (443–448); not-due sheet
  state specified (486–487). The closed list (452–457) — pending / ideal /
  fallback / missed / off, not-due excluded — was walked against the state
  model: F3's chip states (To do/Done/Fallback/Skip → pending/ideal/fallback/
  missed), F4's off, and resolution's not-due partition exhaustively; the
  design's own S20 legend carries exactly these six. No sixth state exists
  (multi-dose partial days are pending until resolved; "showed up" is the
  ideal∪fallback rollup, not a state). The list's "missed (Skip-chipped, or a
  day that ended unlogged)" is a faithful compression of §3's
  single-source-of-truth definition (106–119) — both arms present, the
  pending-today carve-out preserved verbatim in the "pending (unlogged,
  un-Skipped today)" entry — a gloss, not a redefinition. (Note: the
  "ended unlogged" arm is vacuous through the today-scoped card, which is
  consistent, not contradictory.)
- **Pass-1 finding 3 (case classification) — FIXED.** Zero SCHEMA case-IDs
  remain anywhere in PRD.md (grep). Item 21's product invariant (1604–1619):
  in-scope bullet 2 is exactly the C6 shape with a worked example matching
  the pass-1 derivation; eliminated (ii) is exactly C8's same-task
  double-inbound with the correct injectivity argument (strict D→D+1 maps
  distinct sources to distinct targets); eliminated (i) covers C3/C5 chains
  and the W-2 guard; A→A (C2) is unreachable via the computed target;
  C1/C7 map to §3.7's undo bullet; C4/C4b/C4r map to 494–497 plus the
  cross-task bullet; the residue/write-carrier survival clause (1620–1627)
  preserves the C9–C11 discipline without naming it. The architect can derive
  the full mapping from the invariant + §3.7 without a round-trip — except
  for the two questions in blocking items 1–2, which are product gaps, not
  mapping gaps.
- **Collapse-drop audit (orchestrator's fourth focus):** every pass-1
  acceptance obligation re-located in the rework — disabled-not-hidden + SR
  reason + zero-writes (434–435), second-snooze-impossible + qa assertion
  (458–462), toggle-off-keeps-undo (488–490), cross-task merge legality
  (490–493), off-target (497–499), as-needed exclusion (503–505), persist
  failure incl. snooze/undo/toggle (505–508), fixture requirements reworded
  but intact (§6 1236–1241). The only semantic changes found are the two new
  blocking items above; the snoozed-occurrence rendering change (pass-1
  "disabled Snooze + Undo offered" → "Undo replaces Snooze") is the sanctioned
  wobble fix, applied consistently everywhere it appears.
