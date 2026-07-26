# Review — M0 (pass 2)
VERDICT: CHANGES_REQUIRED

Module: **M0 — Kernel: types, tokens, component kit, shell**
Previous: pass 1 — CHANGES_REQUIRED (9 blocking items). This pass re-verified every fix
**against the approved handoff's concrete values**, not against my own pass-1 prose.

Summary: all nine pass-1 blocking items are genuinely fixed and match the rendered
handoff value-for-value. The CR-1/CR-2 port changes are clean. `PRIMARY_NAV_ITEMS` and
`ROUTES` are real improvements, verified correct. The RNTL accessibility reasoning is
**correct** — and that is exactly why one item blocks this pass: the builder violated its
own verified rule in `CalendarHeatmap`, introducing a new screen-reader regression while
fixing my pass-1 non-blocking note. One item, one file, one line. Everything else passes.

## Blocking items

1. **`src/ui/CalendarHeatmap.tsx:74` — `accessible` on the container swallows every
   interactive child from individual screen-reader focus.** The rework added
   `<View accessible accessibilityLabel={…} accessibilityRole="none">` around the whole
   component in response to my pass-1 note ("the label may never be announced"). That was
   the wrong fix: this container wraps the month-nav `IconButton`s and every per-cell
   `Pressable` (the S20 drill-down edit affordance, `ALLSCREENS_1.md:1057`). Per React
   Native's own semantics, `accessible={true}` makes the view a single accessibility
   element and groups its children — on iOS, VoiceOver can no longer reach the cells or
   the month nav individually. This is precisely the rule the builder itself verified and
   documented this pass (`src/ui/StateChip.test.tsx:8-14`, commit 5c4aaf8's message:
   "views carrying a role while wrapping interactive children must not set it — doing so
   would swallow their children") and applied correctly in `StateChip`,
   `InlineRetryBanner` and `BottomTabs`. Unreachable interactive elements fail the
   ship-blocking a11y floor (ARCHITECTURE §5.1) harder than an unannounced container
   label ever did — my pass-1 note was non-blocking; this regression is not.
   **Fix:** remove `accessible` from the container (rely on the existing
   `accessibilityRole="header"` month label and per-cell labels; if a whole-grid summary
   is wanted, put it on a non-interactive sibling, the `statLine` being the natural
   host). The other three `accessible` usages
   (`CalendarHeatmap.tsx:150` legend items, `ConsistencyBreakdownBar.tsx:68`,
   `MilestoneBadge.tsx:50`) wrap **no** interactive children and are correct — leave them.
   **Acceptance:** no `accessible` prop on any view that contains a `Pressable`/
   `IconButton` descendant, kit-wide; the existing cell-press and month-nav tests still
   pass; a regression grep or test asserts the container node does not set `accessible`.

## Non-blocking notes

- **Commit-record hygiene (orchestrator, not M0):** the M0 rework is scattered across
  commits labelled for other work — `c30e845` ("Update STATE") carries `StateChip` +
  both CR type changes; the remaining kit rework evidently rode `141158f` ("M1 rework");
  `5c4aaf8` ("M0 rework") actually contains only M2-in-flight `src/queries/testSupport`
  files. STATE.md already records the pattern once; noting it recurred.
- `src/ui/MilestoneBadge.tsx:44` — locked label renders `textMuted`; the S27 mockup uses
  `--text-dim`. Trivial; fold into any future touch of the file.
- The in-code provenance byte offsets (`~1082599`, `~836200`, `~905541`) don't line up
  with where I located the same structures (~835k for the chip map); the file embeds
  escaped copies so offsets are ambiguous. The *values* are what I verified, and they
  match; consider citing anchors (`chip(state)`, `id="S27"`) instead of offsets.
- Carried from pass 1, still open by design: `TrendGraph` stroke colour vs the S26 mockup
  is deferred to M5's screen review; the day-numeral below-the-cell placement (per
  MODULES.md) vs above (per mockup) is documented in the component header for visual-qa.

## Rulings requested by the orchestrator

**expo-router Jest config gap — CONFIRMED: YES, real, and it will hit wave 2.**
Reproduced independently (temp test file importing the real `expo-router`, since removed):

```
Cannot use import statement outside a module
  at Object.require (node_modules/expo-router/src/standard-navigation/index.tsx:4:1)
  at Object.require (node_modules/expo-router/src/exports.ts:70:1)
```

Chain verified: `expo-router@57.0.8` depends on `standard-navigation@^0.0.5`;
`node_modules/standard-navigation/package.json` declares `"type": "module"` with
`main: lib/src/index.js`, and that `.js` file opens with `import * as React` — ESM in a
`.js` extension. The frozen `jest.config.js` cannot handle it three ways at once: the
lucide `moduleNameMapper` doesn't name it, the `^.+\.mjs$` transform doesn't match `.js`,
and `transformIgnorePatterns`' whitelist (`expo(nent)?`, `lucide-react-native`, …) does
not include `standard-navigation`, so Babel never sees it. M0's kept mock in
`src/navigation/index.test.tsx:14` is the correct local response and is honestly
documented as a live workaround (unlike the lucide mock, which the central fix obsoleted).
Any wave-2 test that renders a screen importing `expo-router` un-mocked reproduces this.
**Route to the architect before wave 2:** the minimal central fix is appending
`|standard-navigation` to the whitelist — once un-ignored, the preset's existing
`\.[jt]sx?$` babel transform transpiles its ESM `.js` fine. (Not M0's to apply;
`jest.config.js` is frozen.)

**RNTL accessibility claim — CONFIRMED correct, and worth propagating to wave 2.**
Both halves check out: (a) RNTL 14's `*ByRole` queries match only nodes that are
accessibility elements — a plain `View` carrying `accessibilityRole` without `accessible`
is not queryable by role (its `isAccessibilityElement` check; Pressables are accessible
by default, which is why every `getByRole('button'|'radio'|'switch'|'tab')` in the kit
tests resolves); (b) setting `accessible={true}` on a wrapper genuinely groups children
into one element on iOS, so containers of interactive children must not set it. The
StateChip/InlineRetryBanner tests' prop-tree queries are therefore the *correct* way to
assert container semantics, not a weakness — the components have no defect there. The
one place the rule was broken in code, not tests, is blocking item 1.

**`MilestoneBadge` icon prop as a freeze surface — right seam, M5 can build on it.**
`icon: IconComponent` (required) with the Lucide reference kept out of `src/types` /
`src/domain` is the correct boundary: `src/domain` may import nothing but `@/types` +
`@/lib` (ARCHITECTURE §2), so an icon component reference in the achievements domain
model would violate the dependency rule; a key→icon map is presentation and belongs in
M5's UI layer. Verified M5 can express the approved S27 grid through it: the mockup's
badge glyphs (`sunrise`, `calendar-check`, `lock`, …) exist in the pinned
`lucide-react-native`, locked badges render `Lock` internally regardless of the passed
icon (matching the design, where locked badges lose their glyph), and the earned
treatment now matches the mockup exactly (54pt pill, `goldSoft` fill, 2px
`celebrationGold` border, 24pt icon in `goldDeep`, label below on neutral).

## Verified

a. **Fidelity re-checked against the handoff, not the review.** Extracted the approved
   `chip(state)` map and the S20 July-2026 grid from
   `design-input/Fallback Handoff (standalone).html` again and diffed value-for-value:
   - `StateChip` (`chipVisual`, StateChip.tsx:49-61): done = `ideal` fill /
     `CheckCheck` / `iconOnSignal` glyph / `idealDeep` label; fallback = `fallback` /
     `Check` / `fallbackDeep`; skip = `off` / `Minus` / `offDeep`; todo = transparent +
     2px `borderStrong` + `textMuted` label. **1:1 with the chip map**, including the
     pass-1 non-blocking deep-tone labels. `X` gone. Unselected options render the
     hollow todo-style ring, consistent with spec line 348's "filled … only when
     selected".
   - `CalendarHeatmap` (`cellVisual`, CalendarHeatmap.tsx:51-67): ideal/fallback =
     signal fill + `CheckCheck`/`Check`; off = `offSoft` + `border` + `Moon` in
     `textDim` (mockup day 4/11); missed = `surface` + `borderStrong`, no icon (mockup
     day 10); not-due = transparent + faint `border` (mockup day 5); pending = hollow
     dashed. Legend swatches (lines 129-136) mirror all six treatments; legend labels
     take `textMuted` (item 6 fixed). Tap target now wraps cell + numeral with
     `minHeight: MIN_TAP_TARGET` (item 7 fixed).
   - `MilestoneBadge` vs the S27 grid (`id="S27"` badge markup): exact, both earned and
     locked (see ruling above).
   - `Toast` tones (toneColors, Toast.tsx:52-57): success = `idealSoft`/`idealDeep`
     (the S09 off-banner soft-bg/deep-text pattern), warning = `surface`/`textMuted`,
     neutral inverted. Grep confirms no danger-family colour anywhere in the file; the
     new test asserts it against the token set.
   - Tab bar: `Sun`/`Repeat`/`Calendar`/`ListChecks`/`StickyNote` — matches every
     handoff nav strip (`sun`/`repeat`/`calendar`/`list-checks`/`sticky-note`); inactive
     tint now `textDim`, matching the mockup's `--text-dim`.
b. **`PRIMARY_NAV_ITEMS` is genuinely single-source.** `app/(tabs)/_layout.tsx:8-14`
   derives all five `tabBarIcon`s from the exported table via `iconFor(key)`; labels and
   icons exist in exactly one place (`BottomTabs.tsx:26-32`); active/inactive tints agree
   (`accent.base` / `textDim`) between the two renderings. No second source created.
c. **`ROUTES` matches the real route tree.** Counted 41 entries; the route tree has 48
   routed screens of which 7 are parameterised (`/task/[id]` ×5, `/records/[cycleId]`,
   `/assistant/history/[id]`) and deliberately excluded with a documented rationale —
   41 static routes, all 41 present, each verified against an existing `app/**` file, no
   stale entries. `satisfies Record<string, Href>` + clean `tsc` validates every literal
   against expo-router's generated types. `ORIGIN_ROUTES` now derives from it.
d. **CR-1/CR-2 landed as ruled.** `src/types/progress.ts:103` `CycleState` (singleton
   pointer, null-fallback + write-back contract documented); `src/types/ports.ts:80-83`
   `CycleStateRepository` with `cycleState` a first-class `Repositories` member beside
   `settings` (ports.ts:101); `retractXpAward` (ports.ts:59) carries the
   monotonicity-boundary comment naming the only sanctioned reduction and the cases that
   stay monotonic.
e. **Regression sweep.** `npx jest src/ui src/lib src/navigation src/app-shell` → 15
   suites / 64 tests, all pass. Greps over all owned paths: "streak" zero hits; colour
   literals outside `tokens.ts` zero; `numberOfLines` zero (item 9 fixed, both files);
   full `accessible`-prop enumeration in the kit → 4 usages, 3 correct, 1 = blocking
   item 1. `git diff` confirms `src/lib/number.ts` / `number.test.ts` still untouched.
   Working-tree `src/queries/mutations.ts` modification is M2-in-flight, not assessed
   here per instruction.
f. **Kit tests as wave-2 reference.** Read `Button`, `Card`, `EmptyState`, `Switch`,
   `Toast`, `StateChip`, `InlineRetryBanner` suites: all assert behaviour through
   fired events, role queries and store state (`Toast` drives the real zustand store;
   `Switch` documents its animation-teardown `cleanup`); prop-tree queries appear only
   where the verified RNTL constraint makes role queries impossible, each with the
   reasoning in a comment. The new Skip/warning-tone tests pin this pass's fixes to
   token values, not snapshots. Good copy-source for wave 2.
g. **expo-router reproduction.** Ran the un-mocked import under the frozen config
   (scratch file, removed afterwards); failure and chain confirmed as quoted above.
