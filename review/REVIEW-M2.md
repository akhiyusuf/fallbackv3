# Review — M2 (pass 1)
VERDICT: CHANGES_REQUIRED

The consistency core — the thing this module exists for — is **right**. I re-derived every
row of ARCHITECTURE §6.6 independently and checked the implementation and the tests against
the specs, not against each other: off days are excluded from both sides at both scopes and
cannot reduce any percentage on any path; the aggregate is a genuine Σ f(D) over a day-count
(the 67% anchor test asserts `numerator ≈ 1.3333, denominator = 2` before asserting 67, so
it is not a coincidence); rounding happens once, at the end, through `roundHalfUp`/`toPercent`
imported from `src/lib/number.ts` (consistency.ts:12) with no intermediate rounding of f(D);
zero denominator is `null` everywhere; the counted-day walk matches §6.4 and S25's rule
(off skipped-but-tallied, pending/nothing-due excluded entirely, truncation, fully-off-only
for the aggregate Off tally). "streak" appears nowhere (the only hit is the guard test).
The three design-pinned level titles and every S27 badge label are verbatim.

The failures are concentrated in the **query/mutation layer** and in the **cycle machinery**,
plus one genuine calendar-date bug in the domain. None of them require touching a pinned
algorithm.

## Blocking items

1. **Mid-cycle cadence change never finalises the in-progress cycle.**
   `src/queries/mutations.ts:411-421` — `useUpdateSettings` patches settings and emits
   `settings:changed`; nothing archives the in-progress cycle when `cycleCadence` changes,
   and `isShortCycle: false` is hardcoded at `mutations.ts:145`, so a short record can never
   exist. This violates M2's own non-negotiable (MODULES M2: "A mid-cycle cadence change
   finalises immediately") and SCHEMA §8 ("finalized on the spot as a possibly-short record
   … archive always precedes the zeroing"). *Good looks like:* a cadence change detected in
   `useUpdateSettings` archives the current window as `is_short_cycle = 1` (with its windowed
   % and cycling XP) **before** the patch takes effect, then starts the fresh window under the
   new cadence. *Acceptance test:* switch monthly→weekly mid-month; exactly one new
   `cycle_record` appears with `is_short_cycle = 1`, `cycling_xp_final` equal to the
   pre-switch counter, lifetime XP unchanged; the live counter reads 0 under the new cadence.

2. **`reconcileCycleBoundaries` fabricates duplicate history after any cadence change.**
   `src/queries/mutations.ts:122-131` — the walk starts at
   `currentCycleWindow(settings.cycleCadence, settings.tenureAnchorDate)`, i.e. it replays the
   **entire** history since the anchor under the **current** cadence, deduplicating by
   `cadence:start:end`. After a monthly→weekly switch, every past week since the anchor
   mismatches every archived monthly record, so one reconciliation appends dozens of
   overlapping weekly records covering months already archived — S29 becomes garbage, badge
   windows double-attribute, and `cyclingXp(w.id)` reads 0 for all of them (awards were
   stamped under old-cadence ids). Two further defects in the same function: (a) the walk's
   first window starts at `startOfMonth(anchor)`/`startOfWeek(anchor)`, disagreeing with the
   `cycle_state` row M1 seeds (start = store-creation day, `src/db/cycleWindowSeed.ts:30-33`);
   (b) the header comment (mutations.ts:6-20) claims the repository surface "exposes no
   accessor" for `cycle_state` — but the concrete `repos` object M2 already imports **does**
   ship one (`src/db/index.ts:32-41`, `repos.cycleState`, explicitly documented as the
   stopgap M1 built so that "every subsequent boundary … is M2's cycles.ts to own and
   persist"). Nothing ever advances it, so the SCHEMA §8 singleton is permanently stale.
   *Good looks like:* read `repos.cycleState.get()` as the walk's starting window (falling
   back to the anchor derivation only if absent), archive forward from **that**, and `set()`
   the new current window after each boundary — O(1), correct across cadence changes, and the
   singleton stays live. *Acceptance test:* archive two monthly cycles, switch to weekly, run
   reconciliation twice; record count grows only by genuinely elapsed weekly windows, no
   window overlaps any earlier record, second run is a no-op, and `cycle_state` matches the
   live window.

3. **`useLogState` can never trigger the S24→S28 handoff.**
   `src/queries/mutations.ts:265` — the pinned API §3 return shape is populated with
   hardcoded `levelUp: null, badgesUnlocked: []`, and `reconcileOccurrence`
   (mutations.ts:96-111) discards `newUnlocks` after persisting them. No `level:up` event is
   ever emitted anywhere despite being in the closed event union (ports.ts:160). MODULES
   M4/M5 route to `/achievements/celebrate` (S28) off exactly these values, so level-ups and
   milestone unlocks are silently uncelebratable. *Good looks like:* capture `lifetimeXp`
   before/after the award, compare `levelFor()`, return the new `LevelInfo` on a crossing and
   the keys from `newUnlocks`; emit `level:up`. *Acceptance test:* a log that lifts lifetime
   XP across `xpForLevel(1)` returns `levelUp.level === 2` and the unlock keys the same
   reconcile persisted; a non-crossing log returns `levelUp: null`.

4. **UTC-sliced creation date breaks the creation-day boundary in both directions.**
   `src/domain/dateMath.ts:166-168` (`instantToLocalDate` = `instant.slice(0, 10)`) used by
   `src/domain/occurrence.ts:14-16` (`effectiveStartDate`) and `src/queries/internal.ts:23`.
   `task.createdAt` is an ISO **UTC** instant; slicing yields the UTC calendar date, not the
   device-local date ARCHITECTURE §7 pins. West of UTC (evening create — e.g. 20:00 in New
   York = next day UTC): `effectiveStartDate` is **tomorrow**, `isDue(today)` is false, and a
   just-created routine does not appear on Today — the P0 S16→S09 flow fails at the most
   common creation hour. East of UTC (early-morning create): the routine is due **yesterday**,
   minting exactly the fabricated pre-existence "missed" day this bound exists to prevent
   (the code cites §6.4's "never fabricate days before the task existed" while doing so).
   *Good looks like:* the domain takes the creation-day lower bound as **data** in device-local
   terms; `src/queries` (which may use `@/lib/date`) derives it via
   `toLocalDate(new Date(createdAt))` and supplies it. *Acceptance test:* with a frozen clock,
   `createdAt = '2026-07-27T01:00:00Z'` in a UTC−5 context resolves the task due on local
   2026-07-26 and not due on 2026-07-25; the mirrored east-of-UTC case fabricates no
   pre-creation occurrence.

5. **`useTasks` cache-key collision across filters.**
   `src/queries/reads.ts:25-33` — the filter is applied inside `queryFn` but is absent from
   the key: `useTasks({ type: 'routine' })` and `useTasks({ type: 'event' })` share
   `['tasks']`. Two mounted tab screens (the S10–S13 browse tabs live in one tab navigator)
   clobber each other's cache entry; each refetch overwrites the shared entry with a
   differently-filtered list and both observers render it. *Good looks like:* one canonical
   `['tasks']` fetch of the unfiltered list with the type filter applied in `select` (or the
   filter folded into the key). *Acceptance test:* two hooks with different type filters
   mounted simultaneously each receive only their own type, across refetches.

6. **F7 snooze/move writes a field nothing reads.**
   `src/queries/mutations.ts:386-407` persists `movedToDate`, but neither
   `src/domain/occurrence.ts` nor `src/domain/dayState.ts` ever consults it: the occurrence
   stays due on the original date (and becomes **missed** there once the day ends — the
   punitive outcome snooze exists to avoid) and nothing appears on the target date. MODULES
   M4: "Snooze/move affects the occurrence, not the cadence" — currently it affects nothing.
   *Good looks like:* `resolveOccurrence`/the occurrence set treat a log with
   `movedToDate = T` as vacating the source date and creating a due occurrence on `T`.
   *Acceptance test:* move today's occurrence to tomorrow; today resolves `not-due` (not
   `missed` after rollover), tomorrow resolves `pending`, and the consistency denominator is
   unchanged until the moved occurrence itself resolves.

7. **XP is never retracted on un-set, and mutation failures are reported as success.**
   `src/queries/mutations.ts:74-93` only appends when the new outcome is eligible. SCHEMA §7
   is explicit: "un-setting a showing-up state on a **live** task deletes its row." A
   mistaken Done tap reverted to To do leaves 10 permanent XP. (Downgrade ideal→fallback does
   work, via M1's upsert — verified at `src/db/repositories/progressRepository.ts:104-110`.)
   The port genuinely lacks a retraction call — `ProgressRepository` (ports.ts:49-59) has no
   delete — so this half needs the same architect change request as item 2's port gap; it must
   stay visible as a deviation, not buried in a comment that mislabels it "part of the same
   cycle_state gap note" (mutations.ts:75-78). Separately and fixable now: the `Result`s of
   `appendXpAward` (line 84), `upsertUnlock` (line 109) and `appendCycleRecord` (line 136)
   are all discarded — a failed award write still returns `ok` with `xpAwarded: 10` and emits
   `xp:awarded`/`badge:unlocked`, violating API §3's "mutations … NEVER report success on a
   failed write". *Acceptance test:* stub `appendXpAward` to fail; `useLogState` must not
   report `xpAwarded > 0` and must not emit `xp:awarded`.

8. **F28 trend buckets are not calendar buckets.**
   `src/queries/reads.ts:113-123` strides fixed 7/30/365-day windows anchored to the earliest
   task's creation date. ARCHITECTURE §6.4 (last paragraph): F28 buckets "are explicit
   calendar `DateRange`s (a week / month / year)". 30-day "months" drift off calendar months
   within a year; 365-day "years" drift over leap years; bucket edges depend on when the
   first task was created rather than on the calendar. `dateMath` already exports
   `startOfWeek/startOfMonth/endOfMonth`. *Acceptance test:* with history spanning
   March–June, monthly buckets are exactly `Mar 1–31, Apr 1–30, May 1–31, …` regardless of
   the first task's creation day.

9. **Ad-hoc query keys break the invalidation contract.**
   `src/queries/reads.ts:55` (`['taskOccurrences', …]`) and `reads.ts:180`
   (`['achievements']`) are not in `QUERY_KEYS` (ARCHITECTURE §11: "Query keys come from
   `QUERY_KEYS` only"), and **no mutation invalidates `taskOccurrences`** — after a chip log,
   S20's heatmap/occurrence history (fed by `useTaskOccurrences`) stays stale, breaking the
   §3 "chip tap → recompute ≤100 ms via key invalidation" contract. *Good looks like:* both
   keys added to `QUERY_KEYS` and `invalidateCommon` (mutations.ts:55-64) covering
   `taskOccurrences`. *Acceptance test:* a `useLogState` call invalidates a mounted
   `useTaskOccurrences` for that task.

10. **The mandated fixture set is incomplete, and `src/queries` has zero tests.**
    PRD §6 and ARCHITECTURE §12 make the seed set mandatory and place it in
    `src/domain/__fixtures__/` for everyone to reuse. Delivered: Studying ✓, Emergency plan ✓,
    Maya (87%/100% reproduce through the real resolve pipeline) ✓. Missing:
    `threeDayMixedFixture` (`__fixtures__/index.ts:182-184`) returns three date **strings**
    with no tasks/logs/off-marks — downstream cannot reproduce the 67% anchor on-screen from
    it; there is no ≥2-completed-cycles fixture and no cycling-XP boundary / mid-cycle
    cadence-change fixture (PRD §6 R25 b/c — the very behaviours items 1–2 show are broken).
    And `npx jest src/queries` runs **no suites at all**: the seven-step mutation sequence,
    `reconcileCycleBoundaries` and the invalidation map — the buggiest code in this module —
    have zero coverage, against MODULES' "npm test passes, including every test your module
    owns". *Acceptance:* a real 3-day mixed fixture (2 tasks day 1, 3 tasks day 2, fully-off
    day 3) whose resolved occurrences yield 67%; a cycle fixture with ≥2 archived records;
    tests covering items 1, 2, 3, 7 and 9's acceptance criteria.

## Non-blocking notes

- `emit({ type: 'cycle:finalized', recordId: w.id })` (mutations.ts:148) sends the window id,
  but the record was appended with a fresh `newId()` (line 137) — the event references an id
  matching no `cycle_record` row. Align them.
- `milestone-course-x3` sets `unlockedOn: today` (achievements.ts:208) — SCHEMA §7 wants the
  **true condition date** so F30's per-cycle badge attribution is deterministic; pass course
  end dates (or the third course's end date) instead of ids alone.
- `occurrencesBetween` (occurrence.ts:79-89) and `eachDay` (dateMath.ts:153-163) loop forever
  when `from > to`; M0's `lib/date.eachDay` returns `[]` for the same input. Guard it — this
  is exactly the kind of silent semantic divergence the dateMath duplication risks.
- `daysBetween(from, to)` is sign-opposite to `lib/date.diffDays(a, b)`
  (`differenceInCalendarDays(a, b)` = a−b). Nothing currently mixes them, but whoever
  collapses the duplication will hit it; leave a warning or align the name.
- One-off Event: `occurrence.ts:59-62` deliberately skips the createdAt bound ("the single
  due date IS the whole occurrence set"), but `internal.ts:23-25` starts the resolve range at
  createdAt anyway, so a backdated Event's occurrence never materialises. Reconcile the two.
  Similarly a Course backdated via `startDate` fabricates pre-creation missed days
  (occurrence.ts:65-69) — defensible as a user-chosen date, but record the reading.
- `useToday`/`useConsistency` resolve every task's **entire** history on every read
  (internal.ts:26-29, O(history) per render). Correct, but bound it before histories grow to
  years, or Today's ≤100 ms budget will erode.
- Stale scaffold comment "STUB — M2 implements" still heads `src/queries/index.ts:5`.
- `useAchievements` (reads.ts:178-197) reconciles on the read path without persisting —
  deterministic and idempotent, fine, but note the badge only durably lands on the next
  mutation.
- Judgement calls reviewed and accepted: **dateMath.ts** — verified semantically compatible
  with M0's landed `lib/date` by direct cross-check (script comparing `weekdayOf` and
  `addMonths` against date-fns over 3,000 consecutive days 2020–2028: 0 mismatches;
  Monday=1 ISO convention confirmed both sides); it imports nothing, never calls `new Date()`,
  and is not exported via `domain/index.ts`. Keeping it is acceptable; collapsing onto
  `lib/date` is an M0-coordination cleanup, not a requirement — except the `instantToLocalDate`
  UTC defect (blocking item 4), which is the one place the private twin is *semantically
  wrong*, not merely duplicated. **Due-but-future → `pending`** — fine; both consistency
  entry points filter `date > today` anyway. **`fallback-comeback` task-level adjacency** —
  defensible: SCHEMA's fallback-wins block is declared task-level; note the design witness
  (ALLSCREENS 2697-2699, Maya's day-level ledger) reads day-level, and the two diverge on
  mixed days (task missed yesterday on a day where another task showed up). Record the
  interpretation for qa-tester so its fixture doesn't assert the other reading.
  **`milestone-full-week`** calendar-ISO-week with 7 counted days each f=1.0 — matches
  SCHEMA's wording exactly; accepted.

## Verified

- **Read in full:** all 20 files in `src/domain/**`, all 4 in `src/queries/**`,
  ARCHITECTURE §6/§7/§11/§12, SCHEMA §2.3/§7/§8, API §1-§3, PRD §3.4/§3.5/§6/Decisions
  6·13·16·17·18, MODULES M2 + Scaffold deference, ALLSCREENS S25 window-membership +
  Appendix A preamble (lines 1570-1660) and S27 contents/copy/provenance (2295-2724).
- **Ran:** `npx jest src/domain src/queries` → 10 suites, 112 tests, all pass — and observed
  that zero of them live in `src/queries`.
- **Golden table:** matched every §6.6 row to a literal assertion in
  `consistency.test.ts`/`dayState.test.ts` and re-derived each expected value by hand
  (26/26→100, 26/30→87, 26/31→84, 27/32→84, Σf 4/3 over 2→67, f=1.0 both mixed-day cases,
  pending-today identity, skip-today immediacy, 1/8→13, both no-data rows, the
  `numerator = denominator − missed` invariant). The 67% test asserts the fractional
  numerator and day-count denominator separately, so it cannot pass via all-or-nothing.
- **Rounding:** `consistency.ts` imports `roundHalfUp`/`toPercent` from `@/lib/number`
  (line 12), accumulates Σf at full precision, rounds once; checked float-tie behaviour of
  `snap` on representative sums (1/3+1/6 → 49.999…996 → snap → 50).
- **dateMath vs date-fns:** node script in the session scratchpad compared `weekdayOf` and
  `addMonths` against `date-fns` (`getISODay`, clamping `addMonths`) over 3,000 consecutive
  days: 0 mismatches. `1970-01-01` Thursday anchor and negative-modulo handling checked by
  inspection.
- **Cadences:** hand-traced all seven `cadenceDue` branches including bi-weekly week parity
  off-anchor-weekday and bi-monthly month parity; anchored-lower-bound checks present.
- **Strings:** level titles vs SCHEMA §7 table and S27/S28 copy blocks; all 22 badge labels
  vs ALLSCREENS 2397-2403 ("Saved 25×" with the true `×`, tenure title-casing "1 Week" …).
  `grep -rni streak src/domain src/queries` → only the guard test.
- **Purity:** no `new Date()` in `src/domain` (grep — only two comments); domain imports
  only `./*` and `@/types` (and `@/lib` transitively allowed — none used beyond types);
  queries imports `@/lib`, `@/db`, `@/domain`, react-query only.
- **Ownership:** `git show fd9617f --stat` — M2's contribution touches only
  `src/domain/**` and `src/queries/**`; no file outside owned paths attributable to M2.
  (Current working-tree modifications to `jest.config.js`/`package.json` and
  `src/ui/__probe*.test.tsx` predate this review and are the separately-tracked frozen-config
  fix, per the review brief.)
- **M1 seams inspected read-only** to adjudicate M2's claims: `progressRepository.ts`
  (`appendXpAward` is a true upsert on `(task_id, date)`, so downgrade works),
  `cycleStateRepository.ts` / `cycleWindowSeed.ts` / `db/index.ts` (`repos.cycleState`
  exists, seeded, never advanced by anyone).
