# Review — M5 (pass 1)
VERDICT: CHANGES_REQUIRED

Module: M5 — Progress & motivation (S25–S30).
Owned paths reviewed: `src/features/progress/**`, `app/progress/index.tsx`, `app/progress/trend.tsx`,
`app/achievements/index.tsx`, `app/achievements/celebrate.tsx`, `app/records/index.tsx`, `app/records/[cycleId].tsx`.
Specs: `docs/MODULES.md` (M5 block), `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/SCHEMA.md`, `docs/API.md`,
`design-input/fallback-handoff/uploads/ALLSCREENS_1.md` S25–S30 (lines 1487–3073).

**Headline first, per the level-title bug class:** the level-title source-of-truth rule is CLEAN.
`app/achievements/celebrate.tsx:67` calls `levelFor(xp)` and renders `level.title` at line 77; `app/achievements/index.tsx:107`
renders `progress.level.title`; a grep for `Dependable|Consistent|Getting started` across every M5 path hits only test
fixtures/assertions — zero literals in production code. The covering test (`app/achievements/celebrate.test.tsx:30-38`) is
genuine: it mocks `@/queries` but NOT `@/domain`, feeds `xp=3900` (cumulative XP to enter level 8 is 3850, verified by hand
against `xpForLevel = 100 + 150·(l−1)`), and asserts "New title: Dependable." — so the pinned title arrives only through the
real `levelFor` constant. No fallback path renders a literal title (the missing-`xp` cold-visit path at celebrate.tsx:64-65
still derives via `levelFor`). Verified as claimed.

## Blocking items

1. **S25's aggregate breakdown bar CAN render fully filled while Missed > 0 — violates an M5 non-negotiable, reproducible
   with the design's own pinned dataset.** `app/progress/index.tsx:113` passes
   `total={result.denominator + result.breakdown.off}`. In aggregate scope, `breakdown.ideal`/`breakdown.fallback` are
   independently ROUNDED credit sums while `denominator` is the raw counted-day count (`src/domain/consistency.ts:161-168`).
   Take the spec's own `aggregate|7` dataset (ALLSCREENS 2020-2023, 2074-2085): Σf = 6.5, denominator = 7, breakdown
   Ideal 6 · Fallback 1 · Off 0 · Missed 1. M5 passes total = 7; the bar's filled segments are (6+1+0)/7 = **100%** with
   Missed = 1 — exactly the "fully filled when Missed > 0" state MODULES.md forbids. The kit component
   (`src/ui/ConsistencyBreakdownBar.tsx:26-41`) is correct; the `total` M5 supplies is not. S29/S30 already do it right
   (`app/records/index.tsx:101`, `app/records/[cycleId].tsx:73`: total = ideal+fallback+missed+off). Fix: in aggregate scope
   pass the rounded-category sum as `total` (per-task scope's `denominator + off` is fine — there the categories are whole
   days and the identity holds). **The existing test does not protect you:** `app/progress/index.test.tsx:70-76` (and its
   S30 twin, `app/records/[cycleId].test.tsx:51-56`) asserts only that an accessibility label EXISTS — it passes unchanged
   under this bug. Acceptance: a test feeding the Ideal 6/Fallback 1/Off 0/Missed 1, denominator 7 result and asserting the
   filled segments sum strictly below 100% of the track (assert on the segment widths or on the exact `total` prop, not on a
   label's existence).

2. **S25's default state for a brand-new user is an error banner, not the "No data yet" empty state.** With zero trackable
   tasks (`trackableTasks = []`, `selectedTaskId` stays null — app/progress/index.tsx:41-54), the screen still calls
   `useConsistency({ scope: 'per-task', taskId: undefined })` (lines 56-60), whose queryFn throws
   `'taskId is required for per-task scope'` (`src/queries/reads.ts:78`) → `isError` → `InlineRetryBanner` with a Retry that
   can never succeed (line 93-94). The spec's Empty state names exactly this trigger — "brand-new user" (ALLSCREENS
   1946-1953) — and this path is reachable in one tap: S09's zero-data stat chip ("No data yet · see your dashboard →") →
   S25, default scope per-task. Fix: when tasks have loaded and `trackableTasks.length === 0` in per-task scope, render the
   `EmptyState` (checked BEFORE the `isError` branch, since the doomed query will still error underneath). Acceptance: a test
   with `useTasks` returning `[]` asserting "No data yet" renders and "Couldn't load your consistency right now." does not.

3. **S26 plots the current in-progress bucket — "Only completed buckets plot" (MODULES.md M5 non-negotiable; ALLSCREENS
   2164-2168) is violated.** `useTrend` returns the trailing bucket clamped to today (`src/queries/reads.ts:115-149` —
   `clampEnd`, and 168-179 computes a real percent for it), and `app/progress/trend.tsx:59-67` maps every returned point
   into `TrendGraph` unfiltered. So mid-July renders a "Jul 2026" point whose % is a moving target — the exact thing the
   spec excludes ("it reappears here only once it finalizes"). Your own test fixture encodes the bug as intended behaviour:
   `app/progress/trend.test.tsx:18` plots a July 1–15 bucket at 90%. Fix inside M5 (display filtering, not consistency
   math, consistent with your own `granularityOf` precedent): drop a trailing point whose natural calendar end has not yet
   elapsed — compare `range.to` against `endOfWeek/endOfMonth(range.from)` (or `<year>-12-31`) and against today via
   `@/lib/date`; alternatively raise an architect CR for `useTrend` to flag completeness — either way S26 must not plot it.
   Acceptance: a test with a full June bucket + a partial July bucket asserting July appears in neither the plotted points
   nor the SR summary/table.

4. **S25's aggregate disclosure renders the user's live full-history table; the spec pins a standalone 3-row illustrative
   fixture and says so twice, in bold.** ALLSCREENS 1557-1568: the disclosure is "a standalone illustrative fixture — a
   3-day toy example from PRD §3.5/§6 … It never doubles as a selectable live dataset", with exact row copy at 2034-2040
   ("Wed — 2 of 2 tasks shown up → counts as 1.0" / "Thu — 1 of 3 tasks shown up (2 missed) → counts as 0.33" / "Fri —
   every due task was off → not counted" / Total: "1.33 ÷ 2 counted days = 67%"). `app/progress/index.tsx:126-147` instead
   renders every `useConsistencyDisclosure()` row — raw ISO dates and `toFixed(2)` fractions, hundreds of rows for an
   established user. Fix: render the pinned fixed rows (verbatim, including the total line); drop the
   `useConsistencyDisclosure` call (M2's hook existing does not oblige you to use it — flag it back as possibly-dead
   surface rather than consuming it against spec). Acceptance: a test asserting the four pinned strings render and that no
   live-history date appears in the disclosure.

5. **S28 renders fixture-specific demo copy as universal copy — visibly false statements for most real crossings.**
   `src/features/progress/copy.ts:115-118` hardcodes: `tenureBody` "A full year with Fallback — however those days went…"
   (rendered for ALL 11 tenure tiers at celebrate.tsx:57 — false for 10 of them: "You've reached 1 Week." followed by "A
   full year with Fallback" is incoherent); `levelUpBody` "And you just crossed 100 tasks done…" (false for nearly every
   level-up — level 2 arrives around 10-17 completions); `forwardLine` "3 fresh badges now within reach." (a demo count).
   These are the demo variant's example content — the same category as "620/1000 XP", which you correctly parameterized —
   not universal pinned strings (Contents, ALLSCREENS 2765-2768: "body copy … naming what was crossed"). Fix: make body
   copy variant-aware. The pinned strings render only when true (tenure body for `tenure-1-year`; you may keep the pinned
   level-up body only if you can actually witness the 100-done fact, otherwise don't claim it); other tiers/levels get
   tone-matched copy explicitly flagged non-pinned in `copy.ts`, exactly like your `OTHER_LOCKED_HINT` precedent. This IS
   the honest reading of item 6(e)'s license — it does not extend to rendering a pinned-but-false sentence. Acceptance:
   test with `badgeKey=tenure-1-week` asserting "A full year" does NOT render; test that whatever renders never contradicts
   the headline's tier.

6. **Two `expo-router` mocks added, against MODULES.md's categorical wave-2 rule.** `app/achievements/celebrate.test.tsx:9-12`
   and `app/records/[cycleId].test.tsx:9-12` add `jest.mock('expo-router', …)` (partial, overriding `useLocalSearchParams`)
   — MODULES.md top matter: "M1, M2 and all five wave-2 modules must not add an `expo-router` mock." Both files even open
   with the header "Never mock expo-router" and then mock it, which will actively mislead the next agent. A sanctioned,
   mock-free technique exists in this repo: `expo-router/testing-library` resolves (verified via `require.resolve`) and its
   `renderRouter` accepts an initial URL carrying search params. Fix: replace both mocks with `renderRouter` (which will
   also let you add the currently-untestable `?from=settings` origin-param assertions for S25/S27/S29 — see non-blocking
   note 5), or obtain an explicit architect amendment to the house pattern and cite it in the test file — not the current
   silent contradiction. Acceptance: no `jest.mock('expo-router'` remains in M5 paths, tests still pass.

7. **Two named copy variants missing.** (a) Weekly cycling-XP reset subline: spec "Resets on **Sun, Jul 19**" (ALLSCREENS
   2391-2392); `app/achievements/index.tsx:119` always formats `'MMM d'`, dropping the weekday under weekly cadence. Use
   `'EEE, MMM d'` when `cycleCadence === 'weekly'`. (b) Per-task truncated-window clause: spec appends "— this task's whole
   history so far is shorter than 30 days" when the counted-day window truncates (ALLSCREENS 2008-2012); never rendered.
   Derivable without arithmetic: for the fixed `last-7`/`last-30` windows, `result.denominator < 7|30` ⟺ truncated (the
   counted-day walk only stops early when history is exhausted — src/domain/consistency.ts:70-82). Acceptance: one test per
   variant asserting the exact string.

8. **The duplicated tenure-offset table has no drift guard — the exact risk the builder flagged is live and testable.**
   `src/features/progress/copy.ts:98-110` (`TENURE_OFFSETS`) duplicates `src/domain/achievements.ts:133-145`
   (`TENURE_TIERS`, unexported). Today they agree (offsets identical; both `addMonths` implementations clamp month-ends —
   compared `@/lib/date` date-fns wrappers vs `domain/dateMath` by hand). But nothing pins them together: if M2 ever
   re-words a tier or adjusts an offset, S27 will caption a wrong unlock date while the real unlock fires elsewhere —
   silently. A parity test is writable entirely inside M5 through the PUBLIC surface: for each key in `TENURE_OFFSETS`,
   `reconcileAchievements({ tenureAnchor: A, today: tenureUnlockDate(key, A), … })` must include the key, and with
   `today = addDays(that date, -1)` must not. Add it (use a month-end anchor like Jan 31 so clamping is exercised). Keep
   the promotion CR flagged — the test is the interim guard, not the final resolution.

## Non-blocking notes

1. **"streak" claim — verified absent, but the test is narrower than reported.** Grep for `streak` (case-insensitive)
   across every M5 path hits only the banned-word test itself (`app/achievements/celebrate.test.tsx:47-52`), which checks
   S28's rendered tree only — not "everywhere in M5's paths" as reported. The requirement is met (the word appears nowhere,
   DoD #8 satisfied — I checked the diff of commit `5cdf68d`); consider a source-scan guard over `src/features/progress`
   + the six route files if you want the claim the report made.
2. **S28 edge guards.** A cold/direct visit (no params) fires confetti against the CURRENT level ("You're now Level N" for
   a level not just reached) — disclosed in the file header, unreachable from any in-app navigation, acceptable; and an
   unknown/missing `badgeKey` on the tenure path renders "You've reached ." (celebrate.tsx:46, empty label). Both deserve a
   cheap guard (e.g. unknown params → redirect to S27) whenever the file is next open.
3. **S30 subline (contract gap 6b) — honest, but note the exact-reading denominator.** "About 26 of 29 counted days"
   reconstructs both numbers from independently-rounded categories (true values ≈25.5 of 28; also 26/29 → 90% vs the
   displayed 91%). "About" hedges the numerator, but "of 29 counted days" reads as an exact day-count and is off by one.
   Accepted for now as the best honest rendering of the disclosed `CycleRecord` gap (`src/types/progress.ts:111-124` truly
   lacks raw numerator/denominator — verified); recommend an architect CR to persist both at finalization, then restore the
   spec's "≈25.5 of 28" wording.
4. **Contract-gap verdicts (the five flagged):** (a) `useTrend` label formatting — genuine gap, and M5's `granularityOf`
   (trend.tsx:41-52) is pure display formatting of an already-computed range; I checked every reachable case: the first
   bucket is only clamped when it is also the last, and in each granularity regime the first bucket's span lands in the
   right band. It never re-buckets a day. Clean. (b) See note 3. (c) See blocking item 8 — real gap, honestly handled,
   missing only the parity guard. (d) S28 route-param contract — verified against M4's `app/task/[id]/celebrate.tsx:61-70`:
   `?kind=level-up&xp=<postCrossingLifetimeXp>` / `?kind=tenure&badgeKey=<key>` — both sides agree, including M4 reading
   post-crossing lifetime XP from the already-invalidated `useProgress`. (e) Locked-hint copy — verified limited to
   genuinely unpinned copy: the spec pins only the four showing-up locked lines (ALLSCREENS 2407-2414) and the tenure
   pattern; M5 transcribes those verbatim in `SHOWING_UP_LOCKED_HINT` and clearly flags `OTHER_LOCKED_HINT` as non-pinned,
   matching M2's PROVENANCE NOTE in `achievements.ts` telling M5 not to render its `lockedHint` fields. Clean.
5. Origin-aware tests cover only the no-param fallback path (`from` absent → `/today` / `/achievements`); once item 6's
   `renderRouter` lands, add one `?from=settings` assertion each for S25/S27/S29.
6. `app/records/index.tsx:113` — inner `const label` shadows the outer row `label` inside the badge map. Works, but rename.
7. S25's on-screen fixture footnote ("not the Maya timeline…") was omitted — correct judgment: it is mockup-lens content
   about demo fixtures that don't exist in the shipped app. Recording so no future pass re-opens it.
8. `useConsistencyDisclosure` is fetched even in per-task scope (index.tsx:61) — moot once blocking item 4 removes the call.

## Verified

- **Tests run:** `npx jest app/progress app/achievements app/records` → 6 suites / 39 tests, all pass — matches the
  builder's reported scope exactly.
- **Scope discipline:** `git show --stat 5cdf68d` ("M5 builds Progress & motivation") touches exactly 18 files, all inside
  M5's owned paths. `git log 8a74604..HEAD -- src/domain src/queries` → empty: nothing touched the frozen domain/query
  layer after the F7-rescope freeze point. No dependency added (`date-fns` and `lucide-react-native` are pre-declared).
- **Level-title rule (claim 1):** grep for pinned titles across M5 paths → test files only; read both render sites;
  re-derived the 3900-XP → level-8 arithmetic; confirmed the test uses the real `@/domain`.
- **"streak" (claim 2):** repo-scoped grep over M5 paths → only the test's own strings. See non-blocking note 1.
- **S26 a11y inheritance (claim 3):** read `src/ui/TrendGraph.tsx` in full — the SR-only summary is rendered
  unconditionally (lines 62-65, outside the chart/table branch) and the "View as table" toggle with all six spec column
  headers is built in (97-128). M5 feeds it labeled points with breakdowns and does not wrap or hide it; the S26 tests
  exercise both (summary without touching the toggle; toggle swap) against the real kit component. Claim holds.
- **Breakdown bar (claim 4):** read `src/ui/ConsistencyBreakdownBar.tsx` — the kit's remainder logic is right; traced M5's
  `total` prop at all three call sites and re-derived the aggregate|7 overfill by hand from `consistency.ts`'s rounding →
  blocking item 1. The claim is true for S29/S30 and per-task S25, false for aggregate S25.
- **Cycling-XP label (claim 5):** the test (`app/achievements/index.test.tsx:44-50`) genuinely flips the mocked cadence to
  weekly and asserts both "Weekly XP" present and "Monthly XP" absent — real, behavioral.
- **M4 handoff (claim 6d):** read M4's `celebrate.tsx` outbound navigation — matches M5's parser byte-for-byte.
- **Confetti containment:** grep — `Confetti` is imported/rendered by `app/achievements/celebrate.tsx` only; single mount,
  non-looping animations, reduce-motion cross-fade path present; decorative colours are accent/gold tokens only.
- **Colour discipline:** grep for hex/rgba/named colour literals across M5 paths → zero hits; `SCRIM`, `celebrationGold`,
  `goldDeep` all exist in `src/theme/tokens.ts`.
- **Tenure math parity today:** compared `@/lib/date` (date-fns) vs `domain/dateMath` `addMonths`/`addYears` clamping
  behaviour — currently agree, incl. month-end clamps; guard missing (blocking item 8).
- **`expo-router/testing-library`:** `require.resolve` succeeds → the mock-free param-injection path exists (item 6).
- **Copy sweep:** S25/S26/S27/S29/S30 strings line-checked against ALLSCREENS Copy sections — verbatim except the items in
  blocking 4, 5 and 7.

## Response (rework pass)

All 8 blocking items fixed. `npx jest app/progress app/achievements app/records` → 6 suites / 59 tests, all pass.

1. **Fixed.** `app/progress/index.tsx`: aggregate scope's `ConsistencyBreakdownBar` `total` is now
   `ideal + fallback + missed + off` (the rounded-category sum), matching S29/S30; per-task scope is unchanged
   (`denominator + off`, still correct there). Replaced the label-existence-only test with one that renders the
   design's own aggregate|7 fixture (Ideal 6/Fallback 1/Off 0/Missed 1, denom 7) and reads the actual rendered
   segment widths off the tree, asserting their sum is strictly below 100%.
2. **Fixed.** Added a `scope === 'per-task' && trackableTasks.length === 0` branch, checked before `isError`, that
   renders the same `EmptyState` used for the null-percent case. Test: `useTasks` returns `[]` with
   `consistencyQuery.isError = true` (the doomed underlying query) — "No data yet" renders, the error copy does not.
3. **Fixed.** `app/progress/trend.tsx` now drops any bucket whose natural calendar end (`endOfWeek`/`endOfMonth`/
   `<year>-12-31`) is still in the future relative to `@/lib/date`'s `today()`, before building `graphPoints` and
   before the empty-state check. Froze `today()` in the test (a `@/lib/date` partial mock, not `expo-router`) for
   determinism, and added a test asserting the partial July bucket never appears in the plotted points, the SR
   summary, or the table.
4. **Fixed.** Dropped the `useConsistencyDisclosure()` call entirely (flagged as possibly-dead surface for M2 in a
   code comment) and render the pinned 3-row fixture + total line verbatim from `S25_COPY.disclosureFixtureRows`/
   `disclosureFixtureTotal`. Test asserts all four pinned strings render and that no `YYYY-MM-DD`-shaped string
   appears anywhere in the disclosure tree.
5. **Fixed.** `copy.ts`'s `S28_COPY.tenureBodyPinned` renders only for `tenure-1-year` (via a new `tenureBodyFor`
   helper); every other tier gets a generic, tone-matched `tenureBodyGeneric` that never restates a specific
   duration. `levelUpBody` and `forwardLine` are now non-pinned/generic for every level-up, since this screen's
   route contract never hands it a completed-occurrence count to verify "100 tasks done" against. Tests assert
   `tenure-1-week` never shows "A full year," and a level-2 level-up never shows "100 tasks done."
6. **Fixed.** Removed both `jest.mock('expo-router', …)` calls. Added
   `src/features/progress/testSupport/routerHarness.tsx` (mirroring M4's own pattern) and rewrote both test files
   to use `expo-router/testing-library`'s `renderRouter` against it — real params, real navigation assertions via
   marker screens, zero `expo-router` mocking.
7. **Fixed.** (a) `app/achievements/index.tsx`'s reset subline now formats `'EEE, MMM d'` under weekly cadence
   (`'MMM d'` otherwise); test asserts "Resets on Sun, Jul 19" for a fixed weekly cycle window. (b)
   `app/progress/index.tsx` appends `S25_COPY.truncatedWindowNote(7|30)` to the per-task subcopy whenever
   `result.denominator < 7|30` under the corresponding fixed window; test asserts the exact verbatim string for a
   truncated 30-day window.
8. **Fixed (interim guard, as scoped).** Added a parity `describe` block in `app/achievements/index.test.tsx`
   (`it.each` over every `TENURE_OFFSETS` key) that calls `reconcileAchievements` through its public surface with a
   Jan-31 (month-end) anchor, asserting each key unlocks exactly on `tenureUnlockDate(key, anchor)` and not the day
   before. No production code changed — parity holds today, as the review predicted. Left the promotion CR
   (dedup the two tables at the source) for the architect, per the review's own framing.

No pushback — all 8 items accepted as scoped. Did not touch anything under "Non-blocking notes" per the rework
brief.

# Review — M5 (pass 2)
VERDICT: PASS

All 8 pass-1 blocking items independently re-verified against current HEAD — none survive. The builder's
self-report is accurate, with one bookkeeping caveat: the fix commit `0f3ae77` alone does not contain
`src/features/progress/copy.ts`, `app/achievements/celebrate.tsx`, or the new
`src/features/progress/testSupport/routerHarness.tsx`; those landed earlier inside the shared WIP snapshots
`98777ac`/`6cd3db2` (both explicitly M5-inclusive). Verified via `git diff 6971af3..HEAD` over M5 paths that the
complete fix set is committed and the working tree is clean.

## Blocking items

None.

## Item-by-item verification

1. **Aggregate breakdown-bar total — fixed, arithmetic re-derived independently.** `app/progress/index.tsx:140-149`:
   aggregate scope now passes `ideal + fallback + missed + off`; per-task keeps `denominator + off` (unchanged, still
   correct — categories are whole days there). Against the design's pinned aggregate|7 legend (re-read at ALLSCREENS
   2020-2023: Ideal 6 · Fallback 1 · Off 0 · Missed 1, denominator 7): total = 8, filled = (6+1+0)/8 = 87.5% < 100%,
   with the missed share genuinely unfilled — the old bug ((6+1+0)/7 = 100%) is gone. The new test
   (`app/progress/index.test.tsx:104-115`) feeds exactly that fixture and its `filledPercent` helper (lines 26-35)
   sums the REAL rendered segment widths off the tree — I read `src/ui/ConsistencyBreakdownBar.tsx:38-40` to confirm
   the track's children are exactly the three filled segments (missed renders no width), so the helper measures what
   ships, not the prop. The per-task twin (lines 95-102) guards the unchanged branch the same way. Not box-checking.
2. **Brand-new-user empty state — fixed, ordering verified in source.** `app/progress/index.tsx:108-114`: the
   `scope === 'per-task' && trackableTasks.length === 0` branch sits textually and evaluatively BEFORE
   `consistencyQuery.isError` in the same ternary chain (loading is checked first, so the tasks list has settled).
   The test (`index.test.tsx:78-84`) sets `useTasks → []` AND `isError = true` simultaneously — the doomed-query
   condition the pass-1 item specified — and asserts "No data yet" renders while the error copy does not. Genuine.
3. **In-progress trend bucket — fixed.** `app/progress/trend.tsx:60-64` (`bucketHasElapsed`) compares each bucket's
   natural calendar end (`endOfWeek`/`endOfMonth`/`<year>-12-31`) against `@/lib/date`'s `today()`; the filter at
   line 75 runs before `graphPoints` AND before the `points.length === 0` empty-state check. Week-start parity
   verified: both this file and `src/queries/reads.ts` import the same `@/lib/date` `endOfWeek` (`weekStartsOn: 1`),
   so completeness detection cannot disagree with the hook's bucketing. The test (`trend.test.tsx:51-61`) freezes
   `today()` to 2026-07-16 via a `@/lib/date` partial mock (NOT expo-router — rule respected), feeds a full June
   bucket plus a clamped July 1-15 bucket at 90%, and asserts "Jul 2026" appears in neither the plotted labels nor
   the table, while Jun/May do. The pass-1 fixture that encoded the bug as intended behaviour is gone.
4. **Pinned disclosure fixture — fixed, byte-verbatim.** Re-read ALLSCREENS 2034-2040 myself and compared
   character-for-character against `src/features/progress/copy.ts:40-45`: all three rows ("Wed — 2 of 2 tasks shown
   up → counts as 1.0" / "Thu — 1 of 3 tasks shown up (2 missed) → counts as 0.33" / "Fri — every due task was off
   → not counted") and the total ("Total: 1.33 ÷ 2 counted days = 67%") match exactly, including the em-dashes and
   "→". `useConsistencyDisclosure` is no longer imported anywhere in `app/progress/index.tsx` (grep-verified); the
   disclosure (lines 158-179) renders only the pinned constants. The test (`index.test.tsx:117-130`) asserts all
   four strings and additionally regex-scans the ENTIRE rendered tree for any `\d{4}-\d{2}-\d{2}` — a live-history
   ISO date cannot leak anywhere on the screen, stronger than the acceptance asked.
5. **S28 variant-aware copy — fixed, and the "always-generic level-up body" reading is legitimate, not a dodge.**
   Pass 1 explicitly licensed it: "you may keep the pinned level-up body only if you can actually witness the
   100-done fact, otherwise don't claim it." The route contract (celebrate.tsx header, cross-checked in pass 1
   against M4's caller) carries only `xp` — no completed-occurrence count exists to witness, so generic-for-all is
   the honest branch of the license. Critically, the true case the review demanded IS preserved:
   `tenureBodyFor` (`copy.ts:153-155`) returns the pinned "A full year with Fallback…" string — byte-verbatim
   against ALLSCREENS 2777-2779, re-checked — exactly and only for `tenure-1-year`, and `celebrate.tsx:57` renders
   through it. The generic tenure body deliberately names no duration, so no tier can render a false claim; the
   generic level-up body states only the level the headline already established. Tests
   (`celebrate.test.tsx:43-53`): `tenure-1-week` → "A full year" absent; level-2 → "100 tasks done" absent. Both
   pass through real route params (see item 6), so `tenureBodyFor` is exercised end-to-end.
6. **expo-router mocks — gone, replaced with the real router.** `grep -rn "jest.mock('expo-router'"` across the
   repo: zero hits in any M5 path (remaining hits are other modules' files, out of this review's scope).
   `src/features/progress/testSupport/routerHarness.tsx` mirrors M4's sanctioned pattern: real screens for S28/S30,
   marker screens for external destinations. The tests meaningfully exercise param-passing, not just mounting:
   `xp=3900` in the URL must flow through the REAL `useLocalSearchParams` into the REAL `levelFor` to produce
   "Level 8 / Dependable" (celebrate.test.tsx:28-35), `badgeKey` drives the tenure variant's label and body, and
   dismissal/back are asserted BY NAVIGATION (`MARKER_ACHIEVEMENTS`, `MARKER_RECORDS` found on screen after the
   press) — real `router.replace` through the real navigator.
7. **Both copy variants present and spec-verbatim.** (a) `app/achievements/index.tsx:119` formats `'EEE, MMM d'`
   iff `cycleCadence === 'weekly'`; test (`index.test.tsx:63-71`) uses the spec's own cycle window (Jul 13-19,
   2026) and asserts the exact pinned string "Resets on Sun, Jul 19" (ALLSCREENS 2391-2392 re-checked; Jul 19 2026
   is indeed a Sunday, consistent with the weekStartsOn-1 convention). (b) `truncatedWindowDays`
   (`app/progress/index.tsx:41-45`) appends `copy.ts:36`'s clause — verbatim against ALLSCREENS 2008-2012 including
   the leading "—", joined with a space onto the subcopy exactly as the spec's continuation reads; test
   (`index.test.tsx:69-76`) presses the real "30 days" tab and asserts the full combined string.
8. **Tenure-parity drift guard — real, and it exercises clamping.** `app/achievements/index.test.tsx:130-157`:
   `it.each` over every `TENURE_OFFSETS` key, anchor `2026-01-31` (month-end, as required). For `tenure-1-month`
   this forces the interesting case: `tenureUnlockDate` = addMonths(Jan 31, 1) = Feb 28 (clamped), and the test then
   proves M2's `reconcileAchievements` — called through its public surface only, no production change — unlocks the
   key exactly on that date and NOT on Feb 27. The day-before boundary assertion is what makes this behavioral
   rather than tautological: if either table's offset or either `addMonths` clamp ever drifts, one of the two
   assertions breaks. Promotion CR to dedupe the tables remains flagged for the architect, per pass-1's own framing.

## Non-blocking notes (new; pass-1 notes 1-8 carry forward unchanged)

9. S30's "never fully filled" test (`app/records/[cycleId].test.tsx:49-54`) still asserts only label existence —
   the pass-1 parenthetical about it was not part of item 1's acceptance and S30's production `total` was already
   correct, but S25's `filledPercent` helper is right there to reuse when the file is next open.
10. No positive-case test asserts the pinned tenure body ("A full year with Fallback…") actually renders for
    `badgeKey=tenure-1-year` — the absence cases are covered; one `findByText` would close the loop.
11. `trend.tsx:63` treats `naturalEnd === today` as elapsed, so on the literal last day of a week/month the
    still-live bucket plots while today's occurrences can still resolve. Edge-of-edge; the spec's "in-progress
    bucket" language arguably includes it. Worth a one-line `isBefore` think-through next visit.
12. `[cycleId].test.tsx` mocks `useCycleRecord` without asserting it was called with `'r1'`, so the cycleId
    param's flow into the hook is untested (the param IS exercised for rendering via the real router). Cheap add.

## Verified

- **Tests run myself:** `npx jest app/progress app/achievements app/records` → 6 suites / 59 passed, 0 failed —
  matches the builder's report exactly (up from 39 at pass 1; the 20 new tests are the items' coverage).
- **Fix commits read in full:** `git show 0f3ae77` (8 files, all M5-owned) and the M5 portions of `98777ac`/
  `6cd3db2` (copy.ts, celebrate.tsx, routerHarness.tsx); `79f407d` touches only the review file. Working tree clean.
- **Scope discipline:** `git diff --stat 6971af3..HEAD -- <M5 paths>` → 11 files, every one inside M5's ownership;
  `git log 6971af3..HEAD -- src/domain src/queries src/ui src/types src/lib` → empty. Frozen layers untouched.
- **Spec lines re-read at source** (not trusted from pass 1 or the builder): ALLSCREENS 2013-2023 (aggregate|7
  legend), 2034-2040 + 1557-1568 (disclosure fixture + "never doubles as a live dataset"), 2008-2012 (truncation
  clause), 2164-2168 (only-completed-buckets), 2391-2392 (weekly reset), 2755-2782 (S28 copy incl. the pinned
  1-year tenure body).
- **Arithmetic re-derived by hand:** aggregate|7 old total 7 → 100% filled (bug), new total 8 → 87.5%; per-task
  87% fixture → 30/34 ≈ 88.2%; Jan 31 + 1 month → Feb 28 clamp; Jul 19 2026 = Sunday.
- **Mock hygiene:** repo-wide grep for `jest.mock('expo-router'` → zero M5 hits; trend.test.tsx's new mock is a
  `@/lib/date` partial (today() only, `requireActual` for the rest) — outside the banned category.
