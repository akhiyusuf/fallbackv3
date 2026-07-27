# Review — M4 (pass 1)
VERDICT: CHANGES_REQUIRED

Scope reviewed: `src/features/task/**`, `app/add/*`, `app/task/[id]/*` against
PRD §3.7, SCHEMA §4.2, MODULES M4, ARCHITECTURE, API, and `ALLSCREENS_1.md`
S15–S24 (with §3.7's three named supersessions). All 13 M4 suites / 64 tests
run and pass; tsc clean; scope discipline clean. The two headline claims were
traced in source: S22's two origin rules are genuinely separate and correct
(see Verified), but the snooze-slot heuristic does NOT hold to the builder's
own description of it — item 1 below is the reason this review fails.

## Blocking items

### 1. `snoozeSlot.ts` renders "Undo snooze" for a dormant visitor — it violates PRD §3.7's closed rendering rule in the COMMON case and unilaterally resolves the §7 open reachability gap
`src/features/task/snoozeSlot.ts:53-56`; enshrined by `app/task/[id]/index.test.tsx:75-102`.

The slot renders "Undo snooze" whenever `isDueYesterday && yesterdayOccurrence.outcome === 'not-due'`
— i.e. whenever yesterday's own row was vacated by a snooze — **regardless of what the
sheet's occurrence card is displaying**. PRD §3.7's three renderings are a closed rule
"determined by the sheet's displayed occurrence and the task's `snoozable` value":
rendering 3 ("Undo snooze") applies only when **the displayed occurrence is currently
snoozed**. Walk the shapes:

- **Precedence case 3** (today not naturally due, or today's own occurrence itself
  snoozed away → the visitor displays): "Undo snooze" is correct. ✔
- **Precedence case 2** (today naturally due, never logged → the card shows *today's
  own blank pending state*, the visitor is dormant and "displays nowhere" per PRD):
  the code still renders "Undo snooze". ✘ Per PRD this shape requires rendering 1,
  "Snooze" enabled — the displayed occurrence (today's own) is un-snoozed and snoozable.
- **Precedence case 1** (today has its own real logged state → visitor dormant): same
  wrong rendering. ✘

Case 2 is not a corner: **for a daily-cadence task it is the day-after state of every
snooze, by construction** — PRD §3.7's own words: "the common case, not a corner case."
Three distinct consequences:

1. **Spec violation** of the closed three-rendering acceptance criterion (PRD §3.7,
   renderings 1 and 3; MODULES M4 non-negotiables restate it verbatim).
2. **A legal snooze is made impossible**: in case 1/2 the user cannot snooze today's
   own occurrence at all (the slot shows Undo instead). Snoozing today's occurrence
   while yesterday's visitor sits dormant is explicitly legal (SCHEMA §4.2 C6 —
   "two independent one-hop snoozes on different occurrences — explicitly in scope").
3. **It invents the forbidden UI.** PRD §3.7 / SCHEMA §4.2 pin undo-reachability for a
   dormant (case-1/case-2) visitor as an OPEN human/designer decision: "no
   currently-specified surface exposes an undo for it… **Do not invent a UI to fix
   this**" (MODULES M4 non-negotiable, verbatim). Rendering "Undo snooze" on the
   target-date sheet for a dormant visitor is exactly such a surface. The build
   report's claim that "the reachability gap was left open, not papered over" is only
   half-true: the same-day shape is correctly left disabled
   (`index.test.tsx:60-73`), but the next-day shape papers the gap over — and
   `index.test.tsx:75-102` (daily task, yesterday's pointer → today, today naturally
   due and unlogged = case 2) locks the violation in as a passing test. The test
   comment at `index.test.tsx:67-69` even states the correct rule — "undo would be
   reachable only from tomorrow's own sheet, **and only if tomorrow itself isn't
   naturally due**" — and then the very next test contradicts it with a daily task.

**Safety assessment (verified, to the builder's credit):** the mis-rendering is never
*destructive*. When "Undo snooze" is shown, `pointer(yesterday)` is provably non-null
(R-2 is the only way a naturally-due date resolves `not-due`), so
`useUndoSnooze(τ, yesterday)` is always W-1u-legal, restores real data, and the label
accurately describes what it does. The defect class is spec/product, not data
corruption.

**What good looks like.** The `Occurrence` type genuinely cannot distinguish case 1/2
from the vacated-own+visitor shape in every sub-case (the flagged contract gap is
real — see Verified §5a). But it CAN distinguish the shapes that matter, with public
fields M4 already uses: render "Undo snooze" only when the displayed occurrence is
demonstrably the visitor — `sourceVacatedYesterday && !isDue(task, today)` (clause-c:
natural(today) false). Otherwise render per renderings 1/2. The residual
mis-rendering is then confined to C6's vacated-own-plus-visitor shape on a
naturally-due today, where showing "Snooze" fails **safe**: W-1s rejects with
`VALIDATION_FAILED`, zero writes (today's own row already carries a pointer), and the
existing failure toast shows. Document that residual in the same header block, or —
better — raise the architect change request the header already drafts
(`Occurrence.sourceDate` / a `useSnoozeState` read hook) and render all three
correctly. Either way:
- Acceptance test A (replaces `index.test.tsx:75-102`'s current assertion): daily
  task, seed `ownLog(yesterday).movedToDate = today`, today unlogged → S20 renders
  **"Snooze" enabled**; pressing it writes `ownLog(today).movedToDate = tomorrow` and
  never calls `useUndoSnooze`.
- Acceptance test B: weekdays-only task, yesterday due and snoozed, today off-cadence
  (clause c — the visitor displays) → S20 renders **"Undo snooze"**; pressing it
  restores yesterday. (This keeps the correct behavior the current test happens to
  also cover.)
- Keep the same-day disabled-slot test (`index.test.tsx:60-73`) exactly as is — that
  one is right.

### 2. S20 stat line: wrong copy, wrong arithmetic, and a second consistency implementation
`app/task/[id]/index.tsx:465-471`.

Spec (`ALLSCREENS_1.md:1032`, copy block `:1073`): **"89% showed up — 8 of 9 days"** —
percent first, and the worked fixture (line 1037) shows off days **excluded** from the
denominator (13 elapsed due days − 4 off = 9). The implementation renders
`"${x} of ${y} days shown up"` — no percent, wrong sentence shape — and computes
`y` as every outcome except `not-due`/`pending`, which **includes `off` days** (the
fixture would render "8 of 13"). Worse, it computes this locally: MODULES M2's scope
pins "consistency.ts — **one** implementation of the pinned algorithm, used by …
**F7's stat line**". `perTaskConsistency` is exported from `@/domain` and accepts a
`DateRange` window (`src/domain/consistency.ts:44-47`), so no contract change is
needed. Fix: derive the stat line from `perTaskConsistency` over the displayed month;
render the null-denominator case per the no-"0%" rule. Acceptance test: a month
fixture with ideal+fallback+off+missed days yields the spec's exact sentence with off
days out of the denominator and a round-half-up percent.

### 3. Heatmap drill-down is missing entirely
`app/task/[id]/index.tsx:460-474`.

Spec interaction (`ALLSCREENS_1.md:1057`): "Heatmap cell tap (past day) → drill-down
popover to view/edit that day's log (in-sheet affordance)". PRD §3.7 explicitly
preserves it: "tapping a past heatmap cell **keeps its existing
view/edit-that-day's-log behavior**". M0's `CalendarHeatmap` exposes `onCellPress`
(`src/ui/CalendarHeatmap.tsx:36`) — M4 never passes it, so past-day view/edit does not
exist anywhere. Build it, and note SCHEMA §4.2's named watch site: every write from
the drill-down must go through M2's mutations (`useLogState`/`useToggleStep`, which
route `resolveWriteTarget`) with the tapped date — never a hand-addressed row.
Acceptance test: tapping a past cell opens the popover showing that day's log; editing
a chip there persists through `useLogState` and re-renders the cell; snooze controls
absent from the popover (PRD §3.7).

### 4. Month-scoped "empty history" remap hides genuine missed days
`app/task/[id]/index.tsx:237-242`.

`isEmptyHistory` is computed over the *displayed month only*
(`every(o => o.chipState === null && o.outcome !== 'off')`) and then remaps
`missed → not-due`. A task with history in other months whose displayed month was
simply neglected (all missed-by-silence, chipState null) gets its real missed fills
blanked — the heatmap misrepresents history, and the stat line/caption flip to the
empty state too. The spec's empty-history state (`ALLSCREENS_1.md:1039`) is for a task
with **no logged history at all** (e.g. a fresh duplicate), whose pre-creation cells
are already not-due/blank without any remap. Fix: key the empty-history state on
task-lifetime emptiness (a cheap read: any log/off-mark exists), or drop the remap
entirely if occurrence sets never predate creation. Acceptance test: task with an
ideal log in month A; month B fully unlogged → month B renders its missed fills, not
a blank grid.

### 5. Multi-dose card: hardcoded two dose rows and Checkboxes instead of the spec'd four-state StateChips
`app/task/[id]/index.tsx:315-350`.

Two defects: (a) SCHEMA §2 pins `doses_per_day INTEGER CHECK(>=1)` — unbounded — and
S18 accepts any integer (`app/add/course.tsx:60`), but S20 renders exactly two
hardcoded rows ("Morning dose · 9:00a" / "Evening dose · 9:00p"); a 3-dose course
shows "n of 3 doses done" with no way to log the third dose. Render one row per
`task.dosesPerDay` (the two spec'd labels are the 2-dose fixture's copy, not a cap).
(b) Spec (`ALLSCREENS_1.md:1015`) requires each dose row to carry "its **own full
four-state `StateChip`** … **not a reduced two-state control**"; the implementation
uses `Checkbox`. Acceptance test: a `dosesPerDay: 3` course renders three dose
StateChips, each logging its own dose.

### 6. Importance/Necessity tags: false screen-reader affordance and an invented interaction pattern
`app/task/[id]/index.tsx:277-306`.

Spec (`ALLSCREENS_1.md:1006`): "tapping a tag opens an inline `Radio` picker". The
implementation's `Tag`s are not pressable; two extra ghost buttons ("Edit importance"
/ "Edit necessity") were added instead — an affordance the design doesn't have. The
blocking part: each Tag's `accessibilityLabel` promises "Double tap to change"
(`:279`, `:293`) on a **non-interactive** element — a screen-reader user double-taps
and nothing happens (DoD #4). Fix: make the tag itself the tap target opening the
inline Radio (wrap in Pressable if `Tag` lacks `onPress`), drop the extra buttons, and
make the a11y label truthful. Acceptance test: pressing the element labeled
"Importance…" opens the Radio picker.

### 7. Persist-failure states missing or degraded on S16–S19 and S22
- All four create screens silently swallow a failed save: `app/add/routine.tsx:118-119`,
  `app/add/event.tsx:99-100`, `app/add/course.tsx:105-106`, `app/add/todo.tsx:50-51` —
  `if (result.ok) router.replace(…)` with **no else**. The button stops spinning and
  nothing tells the user the task was not saved (PRD: persist failure → calm retry,
  "never a false 'saved'" — and silent nothing is worse). Add the standard failure
  toast/inline retry. Related gap on the same lines: on S17/S18 an unparseable
  free-typed date makes `validateTaskDraft` fail with **no visible error anywhere**
  (only name/end-date-empty have local messages) — every validator rejection must
  surface a visible error. Acceptance test per screen: seed the fake repo to fail
  `create` → pressing Save shows the failure state and stays on the form with data
  intact.
- S22 delete failure replaces the **entire button row** with the retry banner
  (`app/task/[id]/delete.tsx:74-89`), removing "Keep it". Spec
  (`ALLSCREENS_1.md:1198-1200`): dialog stays open, retry message, "**both buttons
  re-enabled**". Acceptance test: failed delete → both "Delete routine" and "Keep it"
  present and enabled alongside the retry message.

## Non-blocking notes
- `app/task/[id]/index.tsx:262-265` — name persists via a "Save name" button; spec says
  "edits persist on blur" (`ALLSCREENS_1.md:1005`). Consider blur-persist; at minimum
  this is a visible extra control the design lacks. (The `Switch` for `snoozable` is an
  acceptable reading of §3.7's "same inline-edit pattern" for a boolean.)
- `app/task/[id]/index.tsx:232-235` — `new Date(...).toLocaleDateString('en-US')` for
  the month label; the module already has `dateLabel.ts` with a `MONTH_ABBR` table.
  One formatting idiom, please.
- S16: spec wants the empty-run-occurrence error to appear **live** on grid toggle
  (`ALLSCREENS_1.md:790`) and save-failure to scroll to the first error (`:793`);
  implementation validates only at save and never scrolls.
- S24 has no spring pop / XP tick / reduced-motion cross-fade (`ALLSCREENS_1.md:1442,
  1457-1458`) — currently fully static. Confetti/gold/MilestoneBadge correctly absent.
- S23 renders the reference card and history with generic `Card`/rows; DESIGN assigns
  `AsNeededCard` (exported from `@/ui`). Visual-parity risk at visual-qa.
- `app/task/[id]/delete.tsx:70-72` — body copy uses straight quotes around the task
  name; the spec's verbatim block uses curly quotes (`“Morning workout”`).
- Test quality: `index.test.tsx:114-122` (off-day toggle) asserts only
  `fake.currentSettings()` is truthy — asserts nothing about off-day behavior;
  `index.test.tsx:104-112` (duplicate) never verifies empty history. Both are
  box-checking next to otherwise genuinely behavioral suites.
- `src/features/task/index.ts` is still the scaffold stub (`/** … STUB. */ export {};`)
  — misleading; delete or fill.
- `onNameBlur` (`index.tsx:135`) is press-invoked, not blur-invoked — misleading name.

## Verified
- **Tests run:** `npx jest app/add app/task src/features/task` → 13 suites / 64 tests,
  all pass (16.6s). Repo-wide state per STATE.md (97/613) not re-run.
- **S22's two origin rules (builder claim 1): CONFIRMED separate and correct.**
  Rule 1 is `router.back()` with a cold-deep-link `replace` fallback
  (`delete.tsx:40-46`); Rule 2 is `confirmedDeleteDestination()`
  (`src/features/task/deleteOrigin.ts:57-65`) keyed on `openedFrom` + the opener's own
  origin — S23 path returns `ROUTES.routines` unconditionally before any origin
  lookup. Integration tests exercise both rules through real navigation
  (`delete.test.tsx`: S09→S20→S22→confirm→MARKER_TODAY; from=search →
  MARKER_ROUTINES; S23+from=search → MARKER_ROUTINES; both Keep-it paths return to
  their openers). Pure-function tests additionally pin the never-S14 property.
- **Snooze-reachability same-day shape (claim 2): the test is real** —
  `index.test.tsx:60-73` snoozes today, then asserts the slot is *disabled* with no
  Undo. But the claim is only half of the story — the next-day shape invents the undo
  path (Blocking 1).
- **Three renderings + no "Move to another day" (claim 3):** all three renderings
  exist and are distinguishable (`index.tsx:432-451`; disabled state exposes its
  reason via `accessibilityLabel`, tested at `index.test.tsx:51-58`); grepped M4's
  paths for "Move to another day"/date pickers — none; `index.test.tsx:48` asserts
  the absence. Rendering-*selection* is wrong in case 1/2 (Blocking 1).
- **`snoozable` editable post-creation (claim 4):** present on S20
  (`index.tsx:386-389`), persists via `useUpdateTask`; not exposed on S16–S19
  (correct — that half is the PRD §7 open designer call).
- **Contract gap 5a (carrier identity):** genuine — `Occurrence` (`@/types`) carries
  no carrier/source field; grepped `src/queries` — `Carrier` lives only in
  `internal.ts`. The heuristic's *inference* (naturally-due yesterday resolving
  `not-due` ⇒ vacated own row ⇒ undo well-defined) is sound, and I verified it can
  never trigger a destructive or ill-defined mutation. The builder's *scoping* of the
  ambiguity to C6/C9 is wrong — the common case-1/case-2 shapes are mis-rendered, not
  merely the C6 overlap (Blocking 1).
- **Contract gap 5b (as-needed read hook):** genuine — `docs/API.md:57` names
  `AsNeededRepository.listForTask`; `src/queries/reads.ts` has no corresponding hook.
  `useAsNeededHistory.ts` is a true logic-free passthrough (one `useQuery`, one repo
  call, zero business rules), documented, with a promotion path. Acceptable exception.
- **Contract gap 5c (S24→S28):** closed on both ends —
  `app/task/[id]/celebrate.tsx:61-70` emits `?kind=level-up&xp=<lifetime>` /
  `?kind=tenure&badgeKey=<key>`; M5's `app/achievements/celebrate.tsx` (read-only)
  parses exactly `{kind, xp, badgeKey}` with matching semantics and derives the title
  from `levelFor(xp).title`. Handoff fires only after S24's Continue; S24 itself
  imports no confetti/gold/MilestoneBadge.
- **No raw colour literals (claim 6):** `grep -rnE '#hex|rgba?\(' src/features/task
  app/add app/task` → zero matches. All colours via `useTheme()`/`ACCENTS`/`SPACE`.
- **No "streak" (claim 7):** case-insensitive grep across M4 paths → zero matches.
- **Copy spot-checks (beyond the deviations listed above):** S15 four rows + title
  verbatim; S16 helper/framing/labels/all five error strings + banner verbatim
  (day-name substitution correct); S17 tracking helper + "Still an Event…" + errors
  verbatim; S18 all six error/helper strings verbatim; S20 off-day copy, rule lines,
  dose copy, duplicate toast, failure toast, empty-history caption verbatim; S22
  headline/body/buttons/retry verbatim (modulo quote glyphs); S23 chooser, "Logged to
  history" toast, empty state verbatim; S24 headlines/XP/body verbatim with live
  numerator/denominator substitution from `useConsistency`.
- **S16 as-needed branch:** toggling hides cadence + grid, relabels to "(optional)",
  suppresses required-ness (`routine.tsx:99-110` keyed on `requiresIdeal`), and state
  is preserved across toggle round-trips (arrays never cleared; filtered only in
  `buildDraft`); tested at `routine.test.tsx:44-66`.
- **Union-of-due-days validation:** S16/S17/S18 all call M2's `validateTaskDraft` and
  `emptyRunOccurrences` (`@/domain`) — no local reimplementation of the union check;
  offending-day banner names the weekday; end-to-end test at
  `routine.test.tsx:68-87`. (S20's schedule editor also re-checks locally at
  `index.tsx:205-211` before calling `useUpdateTask` — acceptable pre-flight, the
  authoritative check remains M2's.)
- **S23:** lean as specced (no StateChip/heatmap/sub-steps), reverse-chron used-dates
  list, origin-aware back through M0's `useOriginAwareBack` (from=search test at
  `as-needed.test.tsx:74`), delete forwards `openedFrom=as-needed`.
- **Scope discipline:** `git show --stat b4614c3` — only M4-owned paths (plus its own
  tests). The wave-2 WIP snapshots (`805eb7c`, `4227a07`, `e6db8ef`) touch no frozen
  path (`src/types|theme|ui|lib|navigation|db|domain|queries`, `package.json`,
  `jest.config.js` — checked each). Working tree clean. No dependency added. House
  testing pattern followed: no `expo-router` mock (uses the shipped
  `expo-router/testing-library` harness — a legitimate reading of the rule), local
  `expo-crypto` mock only, `@testing-library/react-native` throughout.
