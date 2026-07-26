# Review — M0 (pass 1)
VERDICT: CHANGES_REQUIRED

Module: **M0 — Kernel: types, tokens, component kit, shell**
Scope reviewed: `src/types/**`, `src/theme/**`, `src/ui/**`, `src/lib/**`,
`src/navigation/**`, `src/app-shell/**`, `app/_layout.tsx`, `app/(tabs)/_layout.tsx`.

Overall: this is a genuinely good kernel. All 39 components are real implementations, not
shells; tokens are a faithful transcription of both palettes; the pinned files are
untouched; the banned word appears nowhere; there are no colour literals outside
`tokens.ts`; the dependency rule is clean. Every blocking item below is a **design-fidelity
or a11y divergence**, not a structural problem — all are small, local fixes. The largest
theme is that several signal renderings were reasoned from ARCHITECTURE prose where the
approved rendered handoff (which the human signed off on, and which visual-qa will compare
screenshots against) already settles the question differently.

Reference for items 1–4: the approved chip map and S20 calendar grid extracted from
`design-input/Fallback Handoff (standalone).html` (the `chip(state)` map ~offset 835k, and
the S20 July-2026 grid ~offset 834960):

| State | Approved fill | Approved glyph | Glyph colour | Label colour |
|---|---|---|---|---|
| To do (chip) | transparent, 2px `--border-strong` | none | — | `--text-muted` |
| Done (chip) | `--ideal` | `check-check` | `--icon-on-signal` | `--ideal-deep` |
| Fallback (chip) | `--fallback` | `check` | `--icon-on-signal` | `--fallback-deep` |
| Skip (chip) | **`--off`** | **`minus`** | `--icon-on-signal` | `--off-deep` |
| Off (row state) | `--off-soft` + 1px `--border` | `moon` | `--text-dim` | `--text-dim` |
| Heatmap ideal | `--ideal` | `check-check` | `--icon-on-signal` | — |
| Heatmap fallback | `--fallback` | `check` | `--icon-on-signal` | — |
| Heatmap off | `--off-soft` + 1px `--border` | `moon` | `--text-dim` | — |
| Heatmap missed | `--surface` + 1px `--border-strong` | none | — | — |
| Heatmap not-due | transparent + 1px `--border` | none | — | — |
| Earned badge (S27) | `--gold-soft` + 2px `--celebration-gold` border | per-badge icon (`sunrise`, `calendar-check`, …) | `--gold-deep` | `--text`, below |
| Locked badge (S27) | `--surface` + 2px `--border` | `lock` | `--text-dim` | `--text-dim`, below |

## Blocking items

1. **`src/ui/StateChip.tsx:47-49` — Skip is a filled state in the approved design; the
   builder rendered it neutral/outlined with an `X` glyph.** The screen spec is explicit:
   `ALLSCREENS_1.md` line 348 — "the **filled states (Done/Fallback/Skip)** render as an
   icon-only pill in the signal fill" — and the handoff's chip map renders Skip on the
   `--off` grey fill with a `minus` glyph and an `--off-deep` label. The builder's
   documented rationale ("missed has no colour of its own", ARCHITECTURE §5) misapplies
   that rule: §5's sentence governs the *unfilled remainder of a bar and the empty heatmap
   cell*, and reusing the existing `off` grey is not "inventing a missed hue" — the
   approved design already made this exact call. The `X` glyph is also a tonal regression
   (the design deliberately chose the non-punitive `minus`; `X` is the kit's Close glyph).
   *Note the same builder judgement applied to the heatmap missed CELL was correct — see
   Verified §e — only the chip state is wrong.*
   **Fix:** selected Skip pill = `t.color.off` fill, `Minus` icon in `t.color.iconOnSignal`.
   **Acceptance:** rendered selected-Skip pill's `backgroundColor === PALETTES.<scheme>.off`
   and its icon is `Minus`; the existing Rule 4 test (no `Text` inside the fill) still
   passes.

2. **`src/ui/StateChip.tsx:44-46` and `src/ui/CalendarHeatmap.tsx:39-41` — wrong glyphs for
   Done/ideal and Fallback.** Approved rendering everywhere (chip map, S09 rows, S20
   calendar): Done/ideal = `check-check` (double check), Fallback = `check` (single check —
   the spec prose's "half-check", line 1029). Builder shipped `Check` for done/ideal and
   `CircleDashed` for fallback. This is learned iconography repeated across every screen;
   it must match the approved handoff.
   **Fix:** `CheckCheck` for done/ideal, `Check` for fallback, in both components.
   **Acceptance:** the rendered ideal fill contains a `CheckCheck` node and the fallback
   fill a `Check` node, in both `StateChip` and `CalendarHeatmap`.

3. **`src/ui/CalendarHeatmap.tsx:42-43` — off cell diverges from the approved rendering.**
   Builder: solid `--off` fill + `Pause` glyph in `iconOnSignal`. Approved S20 grid: an off
   day (e.g. July 4/11) is `--off-soft` background + 1px `--border` + `moon` glyph in
   `--text-dim` — matching the S09 off-banner and the chip map's off state, a consistent
   "moon on soft grey" motif. I acknowledge the spec prose (line 1029) says "pause"; the
   rendered mockup — the artifact the human visually approved, and the one visual-qa will
   diff screenshots against — says moon-on-soft, and the moon motif recurs across S09/S20
   while "pause" appears once in prose. Follow the mockup. If M0 believes the prose should
   win, that is an architect question to raise, not a silent pick — but do not ship a
   third rendering (solid fill + white pause) that matches neither.
   **Fix:** off cell = `t.color.offSoft` bg, 1px `t.color.border`, `Moon` icon in
   `t.color.textDim`; update the legend swatch to match. (While in here: mockup's missed
   cell is `--surface`-filled + `--border-strong`, builder uses transparent + strong
   border; mockup's not-due cell keeps a faint 1px `--border`, builder renders it fully
   invisible — align both.)
   **Acceptance:** off/missed/not-due cell styles match the table above in both palettes.

4. **`src/ui/MilestoneBadge.tsx:22-32` — earned badge fill and icon diverge from the
   approved S27 rendering, and the API cannot express it.** Builder: solid
   `celebrationGold` fill + white `Award` icon, hardcoded for every earned badge. Approved
   S27: earned = `--gold-soft` background + 2px `--celebration-gold` border + a
   **per-badge icon** in `--gold-deep` (`sunrise` for 7 days, `calendar-check` for
   30 days, …). There is no `icon` prop, so M5 cannot render the approved badges at all —
   this is a Wave-1 freeze problem, not just a styling nit. (The builder's decision to
   apply Rule 4 to gold — icon-only fill, label below — was itself correct and matches the
   design; keep that.) Locked rendering already matches — keep it.
   **Fix:** add a required `icon: IconComponent` prop; earned = `goldSoft` bg + 2px
   `celebrationGold` border + icon in `goldDeep`.
   **Acceptance:** `<MilestoneBadge icon={Sunrise} earned label="7 days"/>` renders
   gold-soft bg, gold border, gold-deep icon, no `Text` inside the pill.

5. **`src/ui/Toast.tsx:43-46` — warning tone paints a danger-family background; success
   tone puts text on an ideal-family fill.** `tone === 'warning'` sets
   `backgroundColor: t.color.dangerDeep` behind white-ish text. ARCHITECTURE §10 is
   explicit: the danger token "is reserved for destructive-action confirm buttons … and
   **never spreads to a surrounding icon, banner or background**" — and the warning toast
   is exactly the calm failed-write surface ("Couldn't save that — try again", S09/S20/S42).
   Likewise `success` puts the message text on an `idealDeep` fill, against Rule 4's
   intent. The design's own pattern for tinted informational surfaces is soft tint + deep
   text (S09 off banner: `--off-soft` bg, `--off-deep` text).
   **Fix:** neutral = current inverted style is fine; success = `idealSoft` bg with
   `idealDeep` text; warning = a calm neutral or `offSoft`/`surface` treatment with muted
   text — anything **not** danger-family, no signal-base/deep fill under text.
   **Acceptance:** a `warning` toast renders with no danger-family colour anywhere; no
   toast tone renders `Text` on a signal base/deep fill.

6. **`src/ui/CalendarHeatmap.tsx:129-140, 166` — legend labels have no themed colour →
   near-black default text in dark mode.** `styles.legendLabel` is `{ fontSize: 12 }` with
   no `color`, and `LegendEntry` never applies one, so RN's default (black) ships on the
   dark `#211f1c` background — an unreadable, WCAG-failing legend on every S20 in dark
   mode. The mandatory legend (spec line 1031) is primary content.
   **Fix:** pass `t.color.textMuted` (or `textDim`) into `LegendEntry`'s label.
   **Acceptance:** rendered legend `Text` colour equals a palette token in both schemes;
   no `Text` in the component resolves to the RN default colour.

7. **`src/ui/CalendarHeatmap.tsx:84-103` — cell tap target excludes the numeral caption
   and is under the 44pt floor.** Spec line 1057: "Tap target covers the cell **and its
   numeral caption together**, not just the colored cell (Rule 8)." The `Pressable` wraps
   only the 24×24 cell (`hitSlop={4}` → ~32pt) and the numeral `Text` sits outside it.
   **Fix:** make the `Pressable` the column wrapper (cell + numeral), with
   `minWidth/minHeight` ≥ `MIN_TAP_TARGET` or equivalent hitSlop.
   **Acceptance:** pressing on the numeral fires `onCellPress`; effective target ≥ 44pt.

8. **`app/(tabs)/_layout.tsx:21` — Today tab icon is `Sprout`; the approved design uses
   `sun`.** Every tab bar in the handoff renders Today with `data-lucide="sun"` (Routines
   `repeat`, Events `calendar`, Courses `list-checks`, To-dos `sticky-note` — those four
   match). Primary nav, visible on every screen; visual-qa will flag it against the
   mockups on all five tabs.
   **Fix:** `Sun` from `lucide-react-native`.
   **Acceptance:** Today's `tabBarIcon` renders `Sun`.

9. **`src/ui/MilestoneBadge.tsx:34` (`numberOfLines={2}`) and `src/ui/ProgressRing.tsx:47`
   (`numberOfLines={1}`) — line clamps on primary copy.** M0's non-negotiable: "survives
   the largest Dynamic Type setting — … no `numberOfLines` clipping primary copy"
   (ARCHITECTURE §5.1). The badge label is that element's only text (and includes the
   design-pinned SCHEMA §7 badge labels); the ring label is typically the percent numeral.
   At maximum font scale the 84pt-wide badge column will ellipsize.
   **Fix:** drop the clamps (let the badge column grow; the ring label is short enough to
   render unclamped, or scale the ring).
   **Acceptance:** with `fontScale` at maximum, a two-word badge label renders fully,
   no ellipsis.

## Non-blocking notes

- **Judgement calls (assessed per the brief):**
  - *Skip/missed on neutral fill*: wrong for the **chip** (blocking item 1), **right** for
    the heatmap missed **cell** — the mockup's own missed cell is a neutral surface with no
    signal hue, exactly as the builder reasoned.
  - *Rule 4 on MilestoneBadge gold*: correct in principle (gold is a §5 signal; the design
    itself keeps the badge fill icon-only, label below). The concrete fill/icon treatment
    is item 4.
  - *`BottomTabs` standalone + expo-router `Tabs` in the shell*: acceptable. Verified no
    dual rendering — nothing currently imports `BottomTabs` (only `src/ui/index.ts`
    exports it). It exists because MODULES.md names it as a required kit component; the
    native-gesture rationale for the real shell is sound. Risk is drift between the two
    (the tab item list/icons live in both files); consider a shared items constant when
    fixing item 8.
  - *`useAppBootstrap` store-agnostic*: acceptable and correctly documented — M0 cannot
    import `src/db`, and M1's S01 owns `StoreLifecycle.open()`/corrupt routing. The
    hardcoded `storeStatus: 'ready'` return is slightly misleading (it never checks
    anything); a name like `shellReady` would be honest, but not worth a churn now.
- `src/ui/StateChip.tsx:101` — selected option labels render in `t.color.text`; the design
  colours the selected label with the state's deep tone (`--ideal-deep` / `--fallback-deep`
  / `--off-deep`, chip map). Consider matching while fixing items 1–2.
- `app/(tabs)/_layout.tsx:17` — inactive tint is `textMuted`; the mockup's inactive tabs
  use `--text-dim`.
- Day numeral placement: MODULES.md's M0 brief says "caption **below** the cell" and the
  builder complied; the rendered mockup places it *above*. Not M0's error — but flag to
  visual-qa so the diff isn't mis-attributed, or align to the mockup when fixing item 3.
- `src/navigation/index.ts` — MODULES.md's M0 scope lists "route constants"; none are
  exported (only the private `ORIGIN_ROUTES`). expo-router's typed routes largely cover
  this, but decide before the Wave-1 freeze — adding exports later is an architect change
  request.
- `src/theme/index.ts:1` — stale "STUB — M0 implements" comment on a fully implemented
  file.
- `src/ui/CalendarHeatmap.tsx:59` — container has `accessibilityLabel` with
  `accessibilityRole="none"` and no `accessible`; the label may never be announced.
- `src/ui/TrendGraph.tsx:70` — line/points stroke is `t.color.text`; check against S26's
  mockup when M5 lands (accent is sanctioned for "progress").
- `src/ui/TrendGraph.tsx:85-88` — scrub row uses raw `onTouchStart` on `View`s and
  `accessibilityRole="adjustable"` without `accessibilityActions`; functional, but the
  per-bucket data is fully available via the always-on summary and table, so a11y intent
  is met.

## Verified

a. **Pinned scaffold untouched.** `git diff af8c1fd..HEAD -- src/lib/number.ts
   src/lib/number.test.ts` → empty. The eight locked assertions are byte-identical to the
   architect's scaffold. `src/types/**` also shows no diff since scaffold (extended
   nowhere, restructured nowhere).
b. **Ownership.** `git diff --name-only af8c1fd..HEAD` over M0's owned paths matches the
   57-file M0 surface; no `docs/**`, `design/**`, or frozen-config change is attributable
   to M0. (The uncommitted `jest.config.js`/`package.json`/`package-lock.json` edits in the
   working tree are the separately-sanctioned test-infra fix named in my brief — lucide CJS
   mapping + `.mjs` transform — not M0's diff; per instruction, not reported as an M0
   defect.) Wave-1 commits are orchestrator bundles, so attribution was confirmed by
   content: nothing in M1/M2's trees references or duplicates M0 kit internals.
c. **Tests & typecheck.** `npx tsc --noEmit` → exit 0. `npx jest src/ui src/lib
   src/navigation src/app-shell` → 12 suites, 49 tests, all pass. The Rule 4 test
   (`StateChip.test.tsx` "the signal-filled pill never contains a Text node") asserts the
   real render tree (finds the ideal-filled `View`, asserts zero `Text` descendants), not
   implementation details. The lucide `jest.mock` workarounds match the sanctioned pattern.
d. **Rule 1 / banned word / accent immunity.** `grep -rniE "streak"` over all owned paths →
   zero hits. Colour-literal grep over `src/ui`, `src/lib`, `src/navigation`,
   `src/app-shell`, `src/types`, both layout files → zero literals (only token-name strings
   like `'forge-orange'`). In `tokens.ts`, every signal value in both palettes is a
   hardcoded hex with no reference to `ACCENTS` — accent-immunity is structural. The
   `SCRIM` exception is genuinely in `tokens.ts:132` and matches Verdant `readme.md:104`
   (`rgba(55,53,47,0.30)`) exactly.
e. **Token fidelity.** Light palette cross-checked value-by-value against
   `fallback-theme.css` (accent quad, ideal/fallback/off/gold triples, danger set, xp,
   icon-on-signal) and Verdant `tokens/colors.css` (document base) — exact matches,
   including `canvas` `#e9e5dd`/`#141312` from the handoff body backgrounds. Dark palette
   cross-checked against the handoff's dark override block (`--bg:#211f1c…`) — exact,
   including the inverted deep values (`idealDeep #A8C98D` etc.) and dark danger
   soft/deep. All four accents match the handoff's accent table including `softD` values.
   Heatmap **missed** cell verified against the rendered S20 grid: neutral
   surface/border-strong, no signal hue — the builder's reading is confirmed correct for
   cells (and for `ConsistencyBreakdownBar`, whose missed share is the unfilled remainder,
   verified never-full when missed > 0 by construction at
   `ConsistencyBreakdownBar.tsx:38-41`).
f. **Rule 4 in code.** Read `StateChip.tsx` and `CalendarHeatmap.tsx` render paths: the
   only children of a signal-filled `View`/`Pressable` are icon components; labels/numerals
   are siblings on neutral background. `MilestoneBadge` same. No regression of the two
   design-pass fixes.
g. **Component depth.** Read all 39 kit files end-to-end. No stubs: `Dialog`, `Select`,
   `Switch` (animated, cleanup-safe), `Skeleton` (reduce-motion aware), `TrendGraph`
   (gap-safe polyline, always-on SR summary, real table toggle), `CadencePicker` (all
   seven R23 kinds with state-preserving kind switches), `SubStepScheduleGrid`
   (`dueWeekdays === null` = all-on, error-day highlighting) are all substantive and match
   their contracts. Every interactive component takes `accessibilityLabel` and sets a role;
   text containers use `minHeight`, not fixed heights (the two clamp exceptions are
   blocking item 9).
h. **Dependency rule.** Grep across all owned paths for `@/db`, `@/domain`, `@/queries`,
   `@/features`, `@/services` imports → zero. `app/_layout.tsx` composes providers only;
   `useDayRollover` invalidates broadly instead of importing M2's `QUERY_KEYS` — correct
   layering.
i. **Chip→state surface.** `ChipState` in `src/types/log.ts:9` is exactly
   `todo|done|fallback|skip` per §6.1; S09's off-day row need ("chips render disabled") is
   expressible via `disabled`.
