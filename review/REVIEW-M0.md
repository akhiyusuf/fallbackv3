# Review — M0 (pass 3)
VERDICT: PASS

Module: **M0 — Kernel: types, tokens, component kit, shell**
History: pass 1 — CHANGES_REQUIRED (9 items, all design-fidelity/a11y) · pass 2 —
CHANGES_REQUIRED (1 item: `accessible` on the heatmap container) · **pass 3 — PASS.**

This pass was scoped, per the orchestrator, to the single pass-2 blocking item and any
regressions from it. The fix is correct, the technique is sound on both platforms, the
new test is load-bearing for the defect that actually occurred, and the diff since pass 2
is surgically confined to the two heatmap files — nothing else in the kernel moved.

**M0 passes. The kernel is safe to freeze for wave 2.** All pass-1/pass-2 verification
(token fidelity to the approved handoff in both palettes, Rule 4 with a real test, the
four-accent closed set, accent-immune signals, no colour literal outside `tokens.ts`, the
banned word absent, pinned `number.ts`/`number.test.ts` untouched, CR-1/CR-2 in the ports,
dependency rule clean, 39 substantive components) stands unchanged and is recorded in the
pass-1/2 entries of this file's history (commits `407ede2`, `d7adcc5`).

## Blocking items

None.

## The fix, verified

**`src/ui/CalendarHeatmap.tsx:74-86` + `src/ui/CalendarHeatmap.test.tsx`.**

1. **The defect is gone.** The root `View` (line 74) carries no accessibility props; a
   full-file check confirms no ancestor of the month-nav `IconButton`s or the per-cell
   `Pressable`s sets `accessible` anywhere in the component. The three legitimate
   `accessible` usages (legend items, and the ones in `ConsistencyBreakdownBar` /
   `MilestoneBadge`) wrap no interactive children — unchanged and correct.
2. **The visually-hidden `Text` works as claimed, on both platforms.** The claim — a host
   `Text` is an accessibility element by default, independent of the `accessible` prop —
   is correct RN semantics: iOS `Text` has `isAccessibilityElement` true by default, and
   TalkBack announces text nodes under the default `importantForAccessibility="auto"`.
   The `{position:'absolute', width:1, height:1, opacity:0}` technique keeps the node in
   the accessibility tree on both platforms (`opacity:0` does not remove elements from
   the a11y tree in RN — the well-known behaviour that makes this the standard RN
   "sr-only" approximation) while removing it from layout (`position:absolute` → no
   shift). It does add one screen-reader focus stop before "Previous month" — announcing
   the container's label as a region intro, which is the *point* of the label and an
   improvement over the never-announced pass-1 state; not a stray stop.
3. **The `TrendGraph` precedent is genuinely the same situation**, not over-generalised:
   `TrendGraph.tsx:62-64` uses the byte-identical `srOnly` style for its always-on
   summary — a hidden host-`Text` sibling providing SR-only context *outside* an
   interactive subtree (its scrub row, table and toggle are siblings, its Svg is
   explicitly hidden). One cosmetic difference: TrendGraph belt-and-braces its Text with
   explicit `importantForAccessibility="yes"` / `accessibilityElementsHidden={false}`;
   the heatmap relies on the (sufficient) defaults. See notes.
4. **The new test is load-bearing for the defect that shipped.** The ancestor walk
   (`expectNoAccessibleAncestor`) asserts `props.accessible !== true` on every ancestor
   of both the nav button and a cell — reintroducing pass 1's exact defect fails it
   deterministically, and the builder's reported break-it-then-revert verification is
   mechanically consistent with that (the walk cannot pass with `accessible` on the
   root). The suite also independently asserts both elements are pressable with distinct
   accessible names, and that the hidden label `Text` exists with the sr-only style — so
   a future edit that silently *deletes* the label is caught too.
5. **No regression in the five cell treatments.** `cellVisual`
   (`CalendarHeatmap.tsx:51-67`) is character-identical to the pass-2-verified version
   (ideal/fallback signal fills + `CheckCheck`/`Check`; off = `offSoft`+`border`+`Moon`
   in `textDim`; missed = `surface`+`borderStrong`, no icon; not-due = transparent +
   faint border; pending hollow-dashed), as are the legend rows. Better: the reworked
   suite now **pins** the most-churned treatments with dedicated assertions (off-soft
   not solid-off; missed vs not-due borders; themed legend labels; the item-7 combined
   tap target) — this surface can no longer regress silently.

## Non-blocking notes (carry forward; none impede the freeze)

1. **The reachability test guards the specific mechanism, not the whole class.** The
   ancestor walk checks only `accessible === true`. The same user-facing swallowing
   achieved another way — `accessibilityElementsHidden` (iOS),
   `importantForAccessibility="no-hide-descendants"` (Android), or `aria-hidden` on an
   ancestor — would pass this test, and the press assertions would not catch it either
   (RNTL fire events bypass the platform a11y tree). Cheap strengthening when next in the
   file: extend the walk to also assert those three props are absent on ancestors. Worth
   doing because wave 2 will copy this test as the house pattern.
2. **Parity nit:** add `TrendGraph`'s explicit `importantForAccessibility="yes"` /
   `accessibilityElementsHidden={false}` to the heatmap's hidden `Text` (or drop them
   from TrendGraph) so the kit has one canonical sr-only idiom, not two spellings.
   Defaults make both correct today.
3. **Real-device spot check for qa/visual-qa:** the 1×1/opacity-0 sr-only technique is
   the standard RN approximation, but VoiceOver/TalkBack behaviour on invisible elements
   is empirically OS-version-sensitive — both this label and TrendGraph's ship-blocking
   S26 summary should get one pass on real screen readers during Gate-3 QA.
4. Carried from pass 2, unchanged: locked `MilestoneBadge` label `textMuted` vs mockup
   `--text-dim`; provenance byte-offset comments would be better as string anchors;
   `TrendGraph` stroke colour deferred to M5's screen review; day-numeral
   below-the-cell (per MODULES.md) vs above (per mockup) documented for visual-qa; the
   expo-router `standard-navigation` Jest gap is **confirmed real** (pass-2 ruling) and
   is the architect's to fix centrally before wave 2 — M0's kept mock in
   `src/navigation/index.test.tsx` remains the correct local response until then.

## Verified (this pass)

a. **Diff confinement.** `git diff 5c4aaf8 HEAD` over all M0-owned paths →
   `src/ui/CalendarHeatmap.tsx` (+15/−1: root props removed, hidden `Text` + rationale
   comment + `srOnly` style added) and `src/ui/CalendarHeatmap.test.tsx` (+37: the
   reachability test and its helpers). Nothing else in `src/types`, `src/theme`,
   `src/ui`, `src/lib`, `src/navigation`, `src/app-shell`, or the two layout files
   changed since pass 2. Pinned files still untouched.
b. **Tests.** `npx jest src/ui src/lib src/navigation src/app-shell` → 15 suites /
   65 tests, all pass, no open-handle warnings. The full-repo 36/264 green and clean
   `tsc --noEmit` were confirmed by the orchestrator; the M0 subset was re-run here
   directly.
c. **Read the fix and the full test file end-to-end** (`CalendarHeatmap.tsx` lines
   69-158, `CalendarHeatmap.test.tsx`, all 6 tests) against RN's documented `Text` /
   `accessible` / opacity accessibility semantics and against the pass-2-verified cell
   treatment table extracted from the approved handoff.
d. **Grepped the kit** for any new `accessible` usage on wrappers of interactive
   children → none; only the three sanctioned usages remain.
