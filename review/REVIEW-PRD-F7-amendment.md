# Review — PRD.md §3.7 F7 amendment + REQUIREMENTS.md R9 CHANGE NOTE (pass 1)
VERDICT: CHANGES_REQUIRED

Scope of this review: the amendment landed in commit `ab2b11a` only — PRD
header banner (25–32), §3.7 (382–456), §3B/F26 cost line (719–723), §4
non-goal (1090–1095), §6 fixture (1177–1182), §7 open item (1278–1283),
Decisions item 21 (1503–1551); REQUIREMENTS.md R9 (262–272). Product judgment
on the narrowing itself is settled human direction (STATE.md "IN PROGRESS —
F7 rescope") and was not re-litigated.

## Blocking items

1. **"No design change is requested or implied" (Decisions item 21(b), PRD
   ~1516–1517) is false as stated, and precedence over S20 is left ambiguous.**
   The load-bearing factual claim IS verified true: `ALLSCREENS_1.md` line 1025
   reads verbatim `**Actions.** IconButton + label, three: "Duplicate",
   "Snooze", "Move to another day".` — two distinct buttons, exactly as item 21
   quotes it, and "Move to another day" appears nowhere in the design outside
   S20 (only lines 1025, 1055, 1072; no dedicated move screen exists — S21 is
   the icon picker). So the core premise survives. But the amendment changes
   more of S20 than "drop one of two buttons":
   - `ALLSCREENS_1.md` line 1055: "Snooze / Move to another day → **inline
     pickers**, stay on S20". The approved design's Snooze itself opens a
     picker; PRD 399–401 now requires the target be "**computed, never
     chosen** — the user is offered no date to pick." That is a contradiction
     with the controlling design, not a no-op.
   - PRD 402–411 adds an "Undo snooze" action, a disabled-Snooze state with a
     screen-reader reason (416–418), and a snoozed-occurrence state; PRD
     412–415 adds a `snoozable` inline toggle. None exist anywhere in
     Gate-2-approved S20, and no copy for any of them exists in the design.
   - Internal wobble inside §3.7 itself: line 396–397 makes the action row
     "**'Duplicate' + 'Snooze'** only" a copy-inspection acceptance criterion,
     but line 403 says a snoozed occurrence offers "only **Undo snooze**" —
     a qa-tester asserting the row is exactly ["Duplicate","Snooze"] fails on
     the §6 fixture's mandatory already-snoozed occurrence (1181–1182).
   Item 21(b) simultaneously asserts `design-input/**` "remains … controlling".
   Wave 1's worst systemic defect class (STATE.md: "the design is controlling;
   prose describing it is not" — M0's nine blockers) is exactly this ambiguity;
   M4 will hit it on day one.
   **Fix:** in §3.7 or item 21(b): (i) drop or qualify "No design change is
   requested or implied"; (ii) enumerate the S20 deltas explicitly (Move button
   removed; Snooze inline picker → single computed tap; Undo-snooze, disabled
   state + reason copy, and the `snoozable` toggle added as NEW surfaces with
   no design source, to be reviewed as rendered output at Gate 3); (iii) state
   precedence: §3.7 supersedes `ALLSCREENS_1.md` lines 1025/1055/1072 on these
   F7 surfaces only, S20 controlling for everything else; (iv) restate the
   copy-inspection criterion per action-row state (never-snoozed / snoozed /
   non-snoozable). **Acceptance test:** a builder holding only §3.7 + S20 can
   list which S20 lines are superseded without asking, and line 1055 can no
   longer be read as requiring a snooze picker.

2. **Which occurrence Snooze binds to, and which occurrence states are
   snoozable, are unspecified — the architect must invent product behavior to
   rewrite SCHEMA §4.2's W-1 analog.** PRD 399–400 says "Tapping **Snooze** on
   an occurrence dated D", but Snooze is a sheet-level action (394–397) and
   nothing says which occurrence D is: today's? What renders when the sheet is
   opened on a day the task is not due? Can a past **missed** occurrence be
   snoozed (e.g. via the heatmap drill-down, S20 line 1057)? Can a completed
   (ideal/fallback) or off occurrence be snoozed, or only pending? The undo
   bullet's "any previously-earned XP award re-affirmed" (409) *implies*
   completed occurrences are snoozable but never says so. The old contract had
   an explicit answer (SCHEMA §4.2 W-1: any resolvable state except not-due is
   movable) — an advisor ruling under the OLD scope that the amended PRD
   neither adopts nor replaces. §3.7's edge list (430–452) covers non-snoozable
   tasks, second-snooze, toggle-off-while-snoozed, cross-task merge, same-task
   natural target, off target — but not this.
   **Fix:** one or two sentences in §3.7 pinning (a) the occurrence the
   manage-sheet Snooze acts on and its rendering when that occurrence is
   absent/not-due, and (b) the set of snoozable occurrence states — or an
   explicit delegation with a named owner if it is deliberately open.
   **Acceptance test:** qa-tester can enumerate the full enabled/disabled
   matrix for the Snooze action without reading SCHEMA.md.

3. **Item 21's downstream case guidance (PRD ~1545–1551) misclassifies the
   survivors: C8 is unreachable under one-hop, C6 is reachable and unnamed.**
   Item 21 tells the architect the merge cases "C4, C4b, C4r, **C8**" remain
   load-bearing. C8 (SCHEMA §4.2 line 371) is same-task double-inbound A1→B,
   A2→B with A1≠A2 — impossible when every pointer spans exactly one day, since
   both sources would be B−1, the same row; §3.7's own line 403–404 ("no
   occurrence is ever more than one day from its own date") proves it
   unreachable. Meanwhile the C6 shape (SCHEMA line 369: visitor + residue
   coexisting on one date) IS still reachable one-hop: daily task due D and
   D+1; snooze D+1's occurrence to D+2, then snooze D's to D+1 — two legal
   single hops on two never-snoozed occurrences. Item 21 neither names C6 as
   surviving nor does §3.7's prose state its product outcome ("target day's own
   occurrence is unchanged", 441, doesn't address a target whose own occurrence
   has itself been snoozed away). Given the architect's next task is a large
   §4.2 deletion and STATE.md already warns "don't over-simplify", naming a
   dead case as load-bearing while omitting a live one invites deleting C6
   with the chain machinery.
   **Fix:** correct item 21's surviving-case list (drop C8 as unreachable
   same-task, or re-scope it to the still-legal cross-task shared date, which
   is per-task inbound and needs no double-inbound machinery; add the C6
   shape), and add one §3.7 sentence stating the consecutive-occurrence
   double-snooze outcome. **Acceptance test:** no case item 21 names
   "load-bearing" is unreachable under §3.7's rules, and the reachable
   visitor+residue coexistence shape is named with its product behavior.

4. **Footprint deviation (procedural):** the top-of-file amendment banner (PRD
   25–32) is outside the authorized footprint (§3.7, the one F26 line, §4, §6,
   §7, Decisions appendix), which the orchestrator's brief classes as a defect
   regardless of quality. I verified it carries zero normative content — it is
   a pure pointer to §3.7/item 21, mirroring the existing post-approval note
   block directly above it, and smuggles no scope. **Fix:** orchestrator
   records a waiver in its routing note (recommended — the banner aids
   discoverability for readers of §1–§3.6), or spec-writer deletes it.
   **Acceptance test:** an explicit disposition either way.

## Non-blocking notes

- **R9 states "is undoable" as flat fact (REQUIREMENTS 264–265)** without the
  delegated-call flag. Mitigated: the CHANGE NOTE (267–272) routes the reader
  to PRD §3.7 + item 21 as settled scope, where the flag is unmistakable.
  Optional one-liner: "(undoability is a flagged delegated call — PRD
  Decisions item 21)".
- **The delegated undo call itself is sound and adequately flagged.** Assessed
  per the brief: the reasoning (product-wide reversibility — R4 off-days
  neutral, calm-retry on every persist failure, F25 recovery surface, no
  streaks; a one-way push would be the app's only irreversible occurrence
  action; a mis-tap permanently relocating an occurrence) holds against the
  upstream docs, and both the §3.7 banner (391) and item 21's bold DELEGATED
  CALL paragraph (~1535–1544) flag it, including the secondary sub-decision
  (undo resets to never-snoozed) with an explicit reversal invitation to the
  human. It stands as a placeholder decision.
- **§7's new open item (1278–1283) names OWNER: designer / screen-designer** —
  agents the PROJECT OVERRIDE forbids invoking. In practice this resolves as
  M4 + human review at Gate 3. Same pre-existing wrinkle as the F27 history
  item (already noted in REVIEW-PRD.md finding 3), so not blocking; consider
  "OWNER: human (at Gate 3)".
- Commit `ab2b11a`'s message overreaches in two spots the artifact itself does
  not: "no date-picker UI exists anywhere in the app" (the PRD correctly
  scopes to occurrence-management flows, 397–398 — create flows may
  legitimately carry date inputs) and "F3B" for §3B. Message-only; no action.
- R9's short in-body summary sentence (264–266) slightly duplicates §3.7
  rather than purely pointing, but it is consistent with it and follows the R4
  CHANGE NOTE precedent (REQUIREMENTS 63). Acceptable.

## Verified

- **Footprint (git):** `git show --stat ab2b11a` — exactly two files touched
  (PRD.md, REQUIREMENTS.md); every PRD hunk lands in the authorized sections
  except the header banner (blocking item 4); the only REQUIREMENTS hunk is
  R9. `STATUS: APPROVED` (PRD) and `STATUS: DRAFT` (REQUIREMENTS) unchanged.
- **R9 CHANGE NOTE accuracy:** pre-image (diff) confirms R9 previously listed
  "snooze, move to another day" as two actions; the note describes the change
  correctly, points to PRD §3.7 + Decisions item 21 as authoritative, and
  "nothing else in R9 changes" is true (edit/duplicate/icon-color/heatmap/
  delete-with-confirmation untouched). Precedent claim (R4-style CHANGE NOTE)
  confirmed at REQUIREMENTS line 63.
- **Design mapping, checked directly against
  `design-input/fallback-handoff/uploads/ALLSCREENS_1.md`:** line 1025 quote
  verbatim-exact; "Snooze" and "Move to another day" are separate buttons, not
  synonyms; "Move to another day" appears only within S20 (1025/1055/1072) —
  no orphaned screen or cross-screen reference. Line 1055's "inline pickers"
  contradiction and the missing Undo/disabled/toggle surfaces → blocking
  item 1. (`design-input/**` untouched by the amendment, confirmed.)
- **S20 inline-edit pattern is real, not invented:** line 1005 (name:
  "inline-editable `Input`-as-text; edits persist on blur") and line 1006
  (Importance/Necessity tags → "inline `Radio` picker … stays on S20") — the
  §3.7 claim at 413–415 cites exactly these.
- **F26 cross-reference fix (PRD 719–723):** diff shows only
  "snooze/move (F7)" → "the one-hop snooze (F7)" within an otherwise unchanged
  sentence; pure factual correction to a removed action's name, no scope
  change.
- **Testability spot-checks:** second-snooze-impossible (402–406) and
  disabled-not-hidden (416–418) are testable as written given §6's mandated
  fixtures (1177–1182: one non-snoozable task, one already-snoozed
  occurrence); the remaining gap is the state/binding matrix → blocking
  item 2.
- **Completeness against SCHEMA §4.2 C1–C11 (lines 360–374):** C1 → PRD
  407–411 + 439–442 (exact restore, award re-affirmed, denominator). C2, C3,
  C5, W-2 → moot/unreachable one-hop, correctly listed for deletion in
  item 21. C4/C4r/C4b → PRD 439–442. C7 → PRD 407–409. C9/C10/C11 residue and
  write-carrier discipline → item 21 keeps them load-bearing, matching
  STATE.md's pass-5 reviewer mandate on `designateCarrier`. Gaps found: C8
  misclassified as surviving, C6 reachable but unnamed (blocking item 3);
  snoozable-state set / occurrence binding unspecified (blocking item 2).
- **Merges-not-eliminated invariant:** consistent across §3.7 (436–439), §4
  (1094–1095), item 21 (~1530–1534), and STATE.md's warning.
