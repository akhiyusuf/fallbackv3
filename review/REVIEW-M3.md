# Review — M3 (pass 1)
VERDICT: CHANGES_REQUIRED

Module: M3 — Today, browse & search (S09–S14).
Scope reviewed: `src/features/today/**`, `src/features/browse/**`,
`src/features/search/**`, `app/(tabs)/today.tsx|routines.tsx|events.tsx|courses.tsx|todos.tsx`,
`app/search.tsx`, against `docs/MODULES.md` §M3, `docs/PRD.md` (F3–F6, F11, F14, F15, F27),
`design-input/fallback-handoff/uploads/ALLSCREENS_1.md` S09–S14, and the wave-2 report in
`docs/STATE.md`.

The core of this module is genuinely good: no reimplemented domain logic anywhere, the
as-needed → S23 routing is real and tested at both surfaces, the off-day toggle is derived
(not a local boolean), scope discipline is clean, and the flagged judgment calls in the
build report are all accurate as described. The blocking items below are concentrated in
S11 (Events) correctness, one missing S14 state, one dropped cross-module param, and
spec-fidelity details.

## Blocking items

1. **S14 has no error state — a read failure renders as "No matches."**
   `src/features/search/SearchScreen.tsx` has no `tasksQuery.isError` branch (see the
   chain at lines 125–149): on error, `all = []`, `nothingToSearchYet` is false (it
   requires `!isError`), `results` is empty, so the screen shows the no-results empty
   state — a false statement, with a "Clear all filters" action that cannot help.
   Spec: `ALLSCREENS_1.md` S14 States, line 634: "Error — results region replaced by
   `InlineRetryBanner`." Good looks like: an `isError` branch rendering
   `InlineRetryBanner` with a retry wired to `tasksQuery.refetch()`, plus a test
   (`SearchScreen.test.tsx`) asserting it — every sibling screen already has exactly
   this branch and test.

2. **A milestone badge earned from a Today chip tap can never present S28.**
   `src/features/today/TodayScreen.tsx:75–86` builds the S24 route params from
   `useLogState`'s result but forwards only `variant`/`xp`/`levelUp`/`from` and drops
   `result.value.badgesUnlocked`. M4's S24 (`app/task/[id]/celebrate.tsx:61–72`) chains
   to `/achievements/celebrate?kind=tenure&badgeKey=…` only when the **caller** supplies
   `badgeKey` — its own doc header (lines 7–11) names `badgeKey` as part of the caller
   contract. Spec: S09 Interactions, `ALLSCREENS_1.md:372` — "If that same completion
   also crosses an XP level-up **or milestone** threshold (F13/F29), S28 presents next."
   From Today, the milestone half is unreachable. Good looks like: append
   `badgeKey=result.value.badgesUnlocked[0].key` (whatever the unlock's key field is)
   when present, and a test mirroring `TodayScreen.test.tsx:144–157` with a non-empty
   `badgesUnlocked` asserting the pushed URL carries `badgeKey`.

3. **Card-row tap targets don't match the spec on S09 and S13 (also an a11y defect).**
   - S09: spec says "Tapping anywhere else on the card row → S20" (`ALLSCREENS_1.md:348`,
     `:373`). In `TodayScreen.tsx:265–273` only the task-name `Text` has `onPress` —
     no `accessibilityRole`, a small target, and taps on the icon/meta/whitespace do
     nothing. `Card` already supports `onPress` with a button role (`src/ui/Card.tsx:35`).
     Make the row card itself pressable (chip excluded, as the chip handles its own tap).
   - S13: spec says "Tap anywhere else on a row (name/preview) → S20" (`:589`). In
     `ToDosBrowseScreen.tsx:90–106` the to-do card is not pressable; navigation is an
     invented "Details" text link (line 102–104) whose copy appears nowhere in the spec.
     Make the card pressable → S20 and delete the "Details" affordance (update the test
     at `ToDosBrowseScreen.test.tsx:75` accordingly). Note the Note-row card (line 108)
     already does this correctly — match it.
   Acceptance: pressing the row body (not the chip/checkbox) navigates to `/task/<id>`
   with the correct origin, asserted in both screens' tests.

4. **S11 Events browse — four correctness/spec defects in one screen**
   (`src/features/browse/EventsBrowseScreen.tsx`):
   a. **A repeating event due today never appears in the Today section**, and the screen
      will show "No events today." while one is due. `todayEvents` (line 33) contains
      only one-offs with `eventDate === today`; `RepeatingEventRow` (line 146) looks
      only for `o.date > todayDate`. Spec `:471` defines the Today section as today's
      events, and the scoped empty (`:484`) is only for a day with genuinely nothing.
      Acceptance: a repeating event whose occurrence resolves due today renders under
      "Today"; the scoped empty does not.
   b. **Upcoming day-groups are not chronological.** The `upcomingGroups` Map (lines
      36–42) preserves repo list order, not date order — a group for "Fri, Aug 21" can
      render before "Tomorrow". Spec `:471`: "Chronological list… grouped by day".
      Sort group keys ascending before rendering; test with two out-of-order fixtures.
   c. **A repeating event with no occurrence in the next 90 days vanishes from its own
      browse tab.** `UPCOMING_WINDOW_DAYS = 90` (line 21) + `if (!next) return null`
      (line 147) makes a yearly event invisible for most of the year. F11's browse
      surfaces must list the task regardless. Render the row with its recurrence badge
      even when no near occurrence resolves (drop the date text, or widen the window to
      cover the yearly cadence).
   d. **Repeating rows omit the time.** Spec `:474`: meta line is time + recurrence
      badge ("Team dinner… Fri 7:00 PM"). `RepeatingEventRow` (lines 154–157) shows
      only the next-date label and badge; add `formatTimeOfDay(tk.timeOfDay)` like
      `EventRow` does.

5. **S12 Past tab still shows the live dose badge.** `CoursesBrowseScreen.tsx:112`
   renders `2×/day` unconditionally; spec S12 Past state (`:532`): "no live dose
   badge". The existing test literally titles itself "no live dose badge requirement"
   (`CoursesBrowseScreen.test.tsx:62`) and then asserts nothing about it — box-checking.
   Gate the badge on `!isPast` and assert `queryByText('2×/day')` is null on Past.

6. **S10 as-needed rows omit the specified "Last used" preview.** Spec `:426` requires
   "a one-line reference-only history preview ('Last used Jul 2')" and the copy block
   `:458` shows "Last used Mar 3". `AsNeededCard` already exposes `lastUsedLabel`
   (`src/ui/AsNeededCard.tsx:18`) but `RoutinesBrowseScreen.tsx:101–112` never supplies
   it. The blocker is real — no `@/queries` read for as-needed history exists — but M4
   hit the identical gap and bridged it (`src/features/task/useAsNeededHistory.ts`, a
   narrow, flagged repo read). Resolution: preferred, ask the architect to promote that
   read into `@/queries` (it is now needed by two modules — that is the promotion
   signal); otherwise mirror the same narrow flagged exception inside M3. Either way
   the preview must render, with a test.

7. **Copy is not byte-verbatim: typographic apostrophes where the spec uses straight
   ones, in six strings.** `ALLSCREENS_1.md` contains **zero** U+2019 characters
   (verified by byte dump — every contraction is ASCII `'`), and M3's copy headers
   claim "direct quote… no paraphrasing". Offenders:
   `src/features/today/copy.ts:31,32` ("that’s", "doesn’t"),
   `src/features/browse/copy.ts:43,45,56` ("you’re" ×2, "doesn’t"), plus the authored
   `:61` for consistency. Related duplication: the browse error string is hardcoded
   inline in three screens instead of using `BROWSE_SHARED_COPY.errorReadFailure`
   (`EventsBrowseScreen.tsx:60`, `CoursesBrowseScreen.tsx:61`,
   `ToDosBrowseScreen.tsx:77`) — only Routines uses the constant. Normalize every
   string to the spec's straight apostrophes, route the error copy through the copy
   module, and update the tests that currently assert the curly form
   (`TodayScreen.test.tsx:212`, `RoutinesBrowseScreen.test.tsx:58`).

## Non-blocking notes

- **Off-toggle derivation corner (route to architect, do not fix locally):** if every
  due task is individually task-day-off (S20's grain), `allDueOff`
  (`TodayScreen.tsx:57`) reads true, the toggle shows "on", and un-toggling calls
  `markOffDay({taskId: null, mark: false})` — which unmarks a day-level row that does
  not exist, while the toast claims "your prior log is back". Root cause is upstream:
  `Occurrence` (`src/types/log.ts:70`) does not expose which grain produced `outcome:
  'off'`, and no day-off read hook exists. Same class as the wave-2 flagged gaps;
  deriving from outcomes remains the right call today.
- **The to-do/note heuristic misfire is real and user-visible, not theoretical.**
  S19 offers "Note (optional) — Add a detail if it helps" on every to-do
  (`app/add/todo.tsx:72`); any to-do saved with a detail note is classified as a Note
  (`ToDosBrowseScreen.tsx:33–35`), loses its checkbox, and disappears from the To-dos
  lens entirely. The builder's flag (STATE.md) is accurate and correctly routed to the
  architect/human (`Task.isNote` or similar). Keep this flag alive through Gate 3 —
  it will surface in QA the first time a tester adds a note to a to-do.
- **`useToday` over-fetch claim verified accurate.** `src/queries/reads.ts:47–55`
  resolves each task's full history through `date`; `useTodayRows.ts:32` slices
  `o.date === date` client-side and never re-derives due-ness (the as-needed exclusion
  correctly rides on `src/domain/occurrence.ts:59`). Workaround is correct, not just
  present.
- Dead scaffolding: all three feature `index.ts` files still read `/** … STUB. */
  export {};` (`src/features/today|browse|search/index.ts`). Nothing imports them —
  delete or populate.
- `TodayScreen.tsx:221–229` hand-rolls its FAB (extra accent-colored non-pressable
  wrapper `View`) instead of reusing `src/features/browse/Fab.tsx` — cosmetic drift
  risk between S09 and S10–S13; consolidate when touching item 3.
- `handleLogChip` / `handleToggleOff` (`TodayScreen.tsx:59–87`) and `toggleDone`
  (`ToDosBrowseScreen.tsx:52–54`) await `mutateAsync` with no try/catch; a thrown
  (non-Result) failure escapes as an unhandled rejection. Wrap with the existing
  failure toast.
- S12 uses `ProgressRing` where the spec says "linear progress bar" (`:522`); no linear
  progress primitive exists in `@/ui`, so this is a defensible judgment call — flagging
  for visual-qa/designer rather than blocking.
- S14 default ordering "most-relevant/most-recent first" (`:629`) is unimplemented
  (repo list order). Low stakes on-device; note for polish.
- `weekdayNameOf` hardcodes the `en-US` locale (`EventsBrowseScreen.tsx:115`) —
  consistent with the app's fixed-English copy, fine for v1.

## Verified

- **Tests run, not just read:** `npx jest src/features/today src/features/browse
  src/features/search` → 6 suites / 47 tests, all pass — matches the builder's
  self-report exactly. Tests assert behavior (copy rendered, routes pushed with origin
  params, mutation payloads) rather than implementation, with the one box-checking
  exception called out in blocking item 5.
- **No reimplemented logic:** grepped M3 for consistency/XP/occurrence math — none.
  `useConsistency`, `useLogState`, `useMarkOffDay`, `useUpdateTask`, `useTasks`,
  `useToday`, `useTaskOccurrences` are the only data paths; `format.ts` is pure
  presentation (its `cadenceRunsOnWeekday` is a weekday-membership preview for S10's
  strip, per the spec's own "badges by WEEKDAY, not by a resolved due-date" framing —
  not a due-ness re-derivation).
- **As-needed routing traced in source AND tests:** `RoutinesBrowseScreen.tsx:41–43` →
  `/task/<id>/as-needed?from=routines`; `SearchScreen.tsx:76–79` → same with
  `from=search`; scheduled rows → `/task/<id>`. Tests assert both branches
  (`RoutinesBrowseScreen.test.tsx:74–93`, `SearchScreen.test.tsx:78–97`). Never S20 for
  as-needed.
- **Off-day toggle:** state is derived from occurrence outcomes (`TodayScreen.tsx:57`),
  no shadow boolean; restoration is M2's (`src/queries/mutations.ts:574–587` snapshots
  `priorChipState` on mark, unmark removes the day row and the resolver restores prior
  logs). Chip-disable + "Off today" meta + checked toggle covered by tests at
  `TodayScreen.test.tsx:186–205`.
- **Cross-module contracts closed on both ends:** M7 constructs `/today?justAdded=1`
  (`src/features/onboarding/FirstTaskScreen.tsx:73`) and
  `/today?reentry=1&taskId=<id>` (`src/services/notifications/index.ts:42`, backed by a
  real missed-yesterday check per its `:120` comment). M4's S24 accepts
  `variant`/`xp`/`levelUp`/`from` (`app/task/[id]/celebrate.tsx:36–44`) — closed,
  except the `badgeKey` half (blocking item 2).
- **Stat chip:** no-data copy rendered and `0%` asserted absent
  (`TodayScreen.test.tsx:123–130`); numerals computed from `useConsistency` +
  `roundHalfUp`, window fixed at 30 per the pinned `ConsistencyWindow` (the mockup's
  "31" correctly treated as fixture, per S09's Display-format note).
- **Empty states:** S09 two distinct (tested `:96–112`); S10 no-routines + scoped
  nothing-due; S11 no-events-at-all + scoped no-events-today; S12 no-courses +
  no-active-but-past; S13 per-lens pair; S14 no-matches + nothing-to-search. All
  present with spec copy (modulo blocking item 7's apostrophes).
- **FAB clearance:** `FAB_CLEARANCE = SPACE.s8 + 56` applied to every browse scroll
  list; Today uses `SPACE.s8 + FAB_SIZE` (`TodayScreen.tsx:303`).
- **Scope discipline:** `git diff --stat 80accf3..420aa04 -- src/queries src/domain
  src/db src/ui src/theme src/navigation src/app-shell src/lib` → **empty**; frozen
  layers untouched all wave. M3's commits (`805eb7c` slice + `b01ac73`) touch only
  owned paths. `git status` clean at `420aa04`.
- **Hygiene:** zero raw color literals and zero occurrences of "streak" in M3 files
  (grepped); all colors via `useTheme`/`SPACE`/`RADIUS` tokens; interactive elements
  ride the kit's `MIN_TAP_TARGET`/roles (except the two bare-`Text` cases in blocking
  item 3).
- **Verbatim copy byte-check:** `od -c` on the spec's "that's okay" / "Couldn't load
  today" confirms straight apostrophes; `grep -c "’" ALLSCREENS_1.md` → 0 (basis for
  blocking item 7).

## Response (rework pass 1)

All 7 blocking items fixed. Non-blocking notes left untouched, as instructed.

1. Fixed. `SearchScreen.tsx` now has a `tasksQuery.isError` branch (checked before
   `nothingToSearchYet`) rendering `InlineRetryBanner` wired to `tasksQuery.refetch()`,
   copy routed through `BROWSE_SHARED_COPY`. Test added.
2. Fixed. `TodayScreen.tsx`'s `handleLogChip` now appends
   `badgeKey=result.value.badgesUnlocked[0]` to the S24 route when `!levelUp &&
   badgesUnlocked.length > 0` (mirroring M4's own `app/task/[id]/index.tsx` gating —
   levelUp and a milestone badge are mutually exclusive in practice per the celebrate
   route's doc header). `badgesUnlocked` turned out to be `readonly string[]` (the key
   directly), not objects with a `.key` field — confirmed against `src/queries/mutations.ts`.
   Test added mirroring the existing chip-tap test.
3. Fixed both. S09: `TaskRow`'s `Card` now carries `onPress={onOpen}`; the chip keeps its
   own `onPressCompact`/`onChange` handlers as a nested pressable (RN doesn't bubble touches
   from an inner Pressable to an outer one, so the chip's tap remains independent). Added a
   test asserting a press on the card body navigates to `/task/t1?from=today`. S13: the to-do
   `Card` is now `onPress`-pressable to `/task/<id>`; the "Details" text link is deleted.
   Updated the existing test to press the card (disambiguated via `getByRole('button', {name})`
   since the nested `Checkbox` shares the same accessible name).
4. Fixed all four in `EventsBrowseScreen.tsx`:
   a. `RepeatingEventRow` now takes a `section: 'today' | 'upcoming'` prop and computes
      `dueToday` from its own `useTaskOccurrences` window; the Today section renders it only
      when due today, and reports that status up to the parent (`onDueTodayChange`) via a
      small effect so the scoped "No events today." empty state is gated on
      `todayEvents.length === 0 && repeatingDueTodayIds.size === 0`, not just the one-off count.
   b. Upcoming day-groups are now rendered from `[...upcomingGroups.keys()].sort(...)`
      instead of raw Map iteration order.
   c. Widened nothing — instead, per the review's own suggested alternative, the row no
      longer early-returns when no occurrence resolves in the 90-day window; it still renders
      with its recurrence badge, just without the relative-date text.
   d. Repeating rows now include `formatTimeOfDay(tk.timeOfDay)` in the meta line alongside
      the date (Upcoming) or alone (Today, where the date is redundant).
   Four new tests added, one per defect.
5. Fixed. The dose badge in `CoursesBrowseScreen.tsx` is now gated on `!isPast`. The
   previously box-checking Past-tab test now asserts `queryByText('2×/day')` is null.
6. Fixed via the recommended fallback path (narrow, flagged mirror, not an `@/queries`
   promotion — that's an architect-level change outside this module's write scope).
   Added `src/features/browse/useAsNeededHistory.ts`, a direct copy of M4's pattern reading
   `repos.asNeeded.listForTask` via `@tanstack/react-query`'s `useQuery`, header-flagged as
   the same now-doubly-needed promotion candidate. `RoutinesBrowseScreen.tsx`'s as-needed
   rows now route through a new `AsNeededRow` sub-component that computes `lastUsedLabel`
   from the most recent history entry (`Last used ${format(..., 'MMM d')}`) and passes it to
   `AsNeededCard`. Test added asserting "Last used Mar 3" renders, matching the spec's own
   example string.
7. Fixed. All six apostrophes normalized to straight ASCII in `today/copy.ts` and
   `browse/copy.ts` (verified: `grep -rn "’" src/features/today src/features/browse
   src/features/search` → no matches). `EventsBrowseScreen.tsx`, `CoursesBrowseScreen.tsx`,
   and `ToDosBrowseScreen.tsx` now render their read-failure banner via
   `BROWSE_SHARED_COPY.errorReadFailure`/`.retry` instead of inline duplicate strings.
   Updated the tests that asserted the old curly form
   (`TodayScreen.test.tsx`, `RoutinesBrowseScreen.test.tsx`, plus the three sibling browse
   tests and `SearchScreen.test.tsx`'s new error test, which all shared the same duplicated
   string).

Verification: `npx jest src/features/today src/features/browse src/features/search` →
6 suites / 55 tests, all pass (was 6/47 pre-fix; +8 net new tests, no regressions).
`npx tsc --noEmit` shows zero errors in any M3 path (remaining project-wide errors are
pre-existing and outside M3's owned paths). `git diff --stat` for this pass touches only
`src/features/browse/{EventsBrowseScreen,RoutinesBrowseScreen}.{tsx,test.tsx}`,
`src/features/browse/copy.ts`, and new `src/features/browse/useAsNeededHistory.ts` — the
other blocking-item fixes (`TodayScreen.tsx`, `SearchScreen.tsx`, `ToDosBrowseScreen.tsx`,
`CoursesBrowseScreen.tsx`, `today/copy.ts` and their tests) were captured by an interim WIP
safety-snapshot commit (`98777ac`) made mid-session by the environment's autosave while this
rework was in progress; their content is identical to what's described above and is included
in the final commit's parent history, not lost or reverted.


## Review — M3 (pass 2)
VERDICT: PASS

All 7 pass-1 blocking items independently re-verified against current source
(commit `b5f3114`; no M3-owned file is dirty in the working tree — the current
`git status` modifications are all M5/M7 paths from other in-flight reworks).
I did not rely on the builder's Response section; every claim below was checked
in source and by running the suite.

### Per-item verification

1. **S14 error state — FIXED.** `SearchScreen.tsx:131–132`: `tasksQuery.isError`
   branch ahead of `nothingToSearchYet`, rendering `InlineRetryBanner` with
   `onRetry={() => tasksQuery.refetch()}`, copy via `BROWSE_SHARED_COPY`. Test
   `SearchScreen.test.tsx:48–57` asserts the banner renders, "No matches." does
   NOT, and pressing Retry calls the mocked `refetch` — real behavior, not
   box-checking.
2. **badgeKey forwarded — FIXED, and both flagged judgment calls verified.**
   `TodayScreen.tsx:85–87` appends `badgeKey=badgesUnlocked[0]` when
   `!levelUp && badgesUnlocked.length > 0`. (a) Type assumption confirmed at
   the source: `src/queries/mutations.ts:221` declares
   `badgesUnlocked: readonly string[]`, populated with bare `u.key` strings
   (`:305–309`) — pass 1's `.key` guess was wrong, the builder's correction is
   right. (b) The `!levelUp` gate: a levelUp+badge double-crossing IS
   representable (`reconcileOccurrence` computes them independently, `:290` and
   `:293–312`), but S24's own `onContinue` (`app/task/[id]/celebrate.tsx`)
   checks `levelUp === '1'` first and returns before ever reading `badgeKey`,
   and its doc header declares the params mutually exclusive. So M3's gate is
   behaviorally identical to sending both — nothing S24 would honor is dropped.
   The residual double-crossing behavior belongs to M4's contract (see
   non-blocking notes). Test `TodayScreen.test.tsx:159–175` asserts the pushed
   URL carries `&badgeKey=tenure-30`; the sibling test at `:155` asserts no
   badgeKey when the array is empty.
3. **Card-row tap targets — FIXED both.** S09: `TodayScreen.tsx:268` — the row
   `Card` carries `onPress={onOpen}` (button role + label via `Card`); chip
   stays an independent nested pressable. Test `:244–254` presses the card by
   its accessible label and asserts `/task/t1?from=today`. S13:
   `ToDosBrowseScreen.tsx:90` and `:107` — both to-do and note cards are
   pressable to S20; the invented "Details" link is gone (grep for `Details`
   in M3 tests/sources: no matches). Test `ToDosBrowseScreen.test.tsx:75–83`
   presses `getByRole('button', {name})` (correctly disambiguated from the
   same-named checkbox) and asserts `/task/td1?from=todos`.
4. **S11 four defects — ALL FIXED** (`EventsBrowseScreen.tsx`):
   a. `RepeatingEventRow` (`:182–224`) computes `dueToday` from its own
      occurrence window (`:199`), renders under Today when due
      (`:104–113`), and the scoped empty is gated on
      `todayEvents.length === 0 && repeatingDueTodayIds.size === 0` (`:63`).
      The effect-reporting pattern is loop-safe: `reportDueToday` (`:51–60`)
      is a `useCallback` whose functional updater returns `prev` unchanged
      when the status hasn't flipped, so React bails out even though the
      inline `onDueTodayChange` prop changes identity each render — verified
      by reading the updater, and empirically by the passing test (an actual
      infinite loop would hang/fail it). Test `:97–111`.
      **`@/domain` restriction confirmed real:** MODULES.md:530 lists M3's
      contract deps as `@/queries`, `@/ui`, `@/theme`, `@/navigation` only —
      importing `isDue` from `@/domain` would exceed the declared contract,
      so the chosen pattern is the compliant option.
   b. Day-groups render from sorted keys (`:44`, `:120`). Test `:113–120`
      with deliberately out-of-order fixtures asserts render order.
   c. No-occurrence-in-window repeating event still renders with its badge
      (`:206–210` — Today-section-only early return; date text simply
      omitted). Test `:122–129` with an empty occurrence window.
   d. Time in repeating meta line (`:208–210`, `:219`). Tests `:109`
      (Today, `7:00 PM`) and `:131–143` (Upcoming, `9:00 AM`).
5. **S12 Past dose badge — FIXED.** `CoursesBrowseScreen.tsx:112`:
   `!isPast && tk.dosesPerDay > 1`. The formerly box-checking test now
   asserts `queryByText('2×/day')` is null on Past
   (`CoursesBrowseScreen.test.tsx:64–69`).
6. **S10 "Last used" preview — FIXED** via the review's sanctioned fallback
   path. New `src/features/browse/useAsNeededHistory.ts` mirrors M4's
   exception exactly — same query key `['asNeededHistory', taskId]` as
   `src/features/task/useAsNeededHistory.ts` (so the two copies share one
   cache, no divergence), logic-free repo passthrough, header flags the
   now-two-module promotion signal for the architect. `AsNeededRow`
   (`RoutinesBrowseScreen.tsx:147–165`) sorts history descending and passes
   `Last used MMM d` to `AsNeededCard`. Test
   `RoutinesBrowseScreen.test.tsx:80–91` uses two out-of-order entries and
   asserts the spec's own example string "Last used Mar 3" — the most-recent
   one wins.
7. **Apostrophes + copy routing — FIXED.**
   `grep -rn '’' src/features/today src/features/browse src/features/search`
   → zero matches. All three sibling browse screens plus S14 now render the
   error banner via `BROWSE_SHARED_COPY.errorReadFailure`/`.retry`
   (`EventsBrowseScreen.tsx:79`, `CoursesBrowseScreen.tsx:61`,
   `ToDosBrowseScreen.tsx:77`, `SearchScreen.tsx:132`); tests assert the
   straight-apostrophe forms (e.g. `TodayScreen.test.tsx:230` "that's okay").

### Non-blocking notes (new this pass)

- **S11 stale due-today set on row unmount.** `repeatingDueTodayIds` has no
  cleanup: if a repeating event that reported due-today is deleted (or edited
  to a one-off) while the tab stays mounted, its id lingers in the set and
  suppresses the scoped "No events today." empty until the screen remounts.
  Low probability, self-corrects on remount — but if fixed, do NOT add a naive
  `useEffect` cleanup calling `onDueTodayChange(false)`: with the current
  unstable inline-callback identity that cleanup would fire every render and
  ping-pong the set. A stable per-id callback (or ref-based unmount-only
  cleanup) is required.
- **S11 transient empty-state flash:** while a repeating event's occurrence
  query is in flight, `dueToday` is false and the scoped empty can render for
  a frame before flipping. Cosmetic; flag for visual-qa.
- **S11 Upcoming ordering across kinds:** repeating rows are appended after
  all one-off day groups rather than merged chronologically. Pre-existing
  behavior pass 1 did not block on; noting for visual-qa, not relitigating.
- **Double-crossing (for M4/architect, not M3):** `reconcileOccurrence` can
  return both a level-up and a badge unlock; S24 celebrates only the level-up
  and drops the badge celebration (the unlock itself persists and shows in
  S27). If chained celebrations are ever wanted, that is an S24 contract
  change — M3 is already sending everything S24 would use.
- Pass-1 non-blocking notes (index.ts stubs, hand-rolled S09 FAB, bare
  `mutateAsync` awaits, ProgressRing vs. linear bar, S14 ordering) remain
  open by design — the builder was instructed to leave them; carry to polish.

### Verified (how)

- **Tests run myself:** `npx jest src/features/today src/features/browse
  src/features/search` → 6 suites / 55 passed, 0 failed (~8.5s). Matches the
  self-report; +8 tests over pass 1, one covering each blocking item (items
  4a–4d each have their own).
- **Type/contract ground truth read directly:** `src/queries/mutations.ts`
  (`ReconcileResult`, `:216–324`; `logStateResolver` return `:460–462`),
  committed `app/task/[id]/celebrate.tsx` (S24 param handling + `onContinue`
  chain order), `docs/MODULES.md:512–549` (§M3 owns/deps/may-not-touch).
- **Scope discipline:** `git show --stat b5f3114` → 6 files, all
  `src/features/browse/**` (M3-owned). The remaining item fixes live in the
  shared multi-agent WIP snapshots `98777ac`/`6cd3db2`; every M3-attributable
  file in those snapshots (`TodayScreen*`, `SearchScreen*`,
  `ToDosBrowseScreen*`, `CoursesBrowseScreen*`, `RoutinesBrowseScreen.test`,
  `today/copy.ts`, `browse/copy.ts`) is inside M3's owned paths; the non-M3
  files there (`app/achievements/*`, `src/features/progress/*`,
  `src/features/task/snoozeSlot*`) belong to the M4/M5 builders concurrently
  in flight per the snapshots' own commit messages. No M3 write to
  `src/queries`, `src/domain`, `src/ui`, `src/db` (the new
  `useAsNeededHistory.ts` READS `@/db` — the exact exception pass-1 item 6
  authorized, correctly flagged in its header).
- **Import discipline:** grep `@/domain` across `src/features` → only
  assistant (M6) and progress (M5) files; zero in M3.
- **Apostrophe byte-check:** grep for U+2019 across all three M3 feature
  dirs → exit 1 (no matches).
