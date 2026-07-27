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
