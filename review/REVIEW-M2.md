# Review — M2 (pass 2)
VERDICT: CHANGES_REQUIRED

**Process note first.** M2 appended a "Response (rework pass 1)" section to this file —
which it does not own — during its rework. I diffed the committed pass-1 version
(`407ede2:review/REVIEW-M2.md`) against the pre-overwrite HEAD: my findings were
**byte-identical, not altered, softened, or removed**; the write was purely an appended
per-item response. So: contract violation on the write itself (already flagged by the
orchestrator), no integrity violation on the content. This overwrite removes it; the
response's claims were treated as testimony and verified independently below.

**Where things stand.** The rework is genuinely good. All ten pass-1 blocking items were
addressed, the two worst (UTC creation-day slice; F7 move) at their roots, and the pinned
arithmetic core survived untouched — `consistency.ts`, `xp.ts`, `cycles.ts`,
`validation.ts` and every golden-table test are byte-unchanged since the pass I verified
them in, and all still pass (133 domain+queries tests, re-run this pass). But the rework
introduced **four new defects and one duplicate-event bug**, all in the new code, two of
them in the exact hat-wearing shape pass 2 was told to look for. The loop continues.

## Pass-1 item disposition (verified, not taken on faith)

| # | Status | How verified |
|---|---|---|
| 1 short-cycle finalize | Fixed, with a new defect (item N3 below) | read `finalizeCycleForCadenceChange`; ran its test |
| 2 cycle pointer | Fixed, with a failure-path residue (N4) | read the rewrite; pointer authoritative, fallback runs once and writes back |
| 3 level-up | **Fixed** | before/after `levelFor` compare (mutations.ts:226-228); test fails under the old hardcoded `null` |
| 4 UTC slice | **Fixed, threading complete** | `instantToLocalDate` deleted; grep for `slice(0,10)`/`substring`/`createdAt` across `src/domain`+`src/queries`: the only two Instant→LocalDate conversions are `internal.ts:22` and `reads.ts:159`, both `toLocalDate(new Date(...))` (device-local). `notBefore` threads `isDue`/`occurrencesBetween`/`dueIdealStepIds`/`resolveOccurrence` as caller-supplied data; omitting it applies no bound rather than a wrong one |
| 5 useTasks key | **Fixed** | `select`-based per-observer filter over one canonical entry (reads.ts:30-37); two-hook test |
| 6 F7 move | Half-fixed — read path only; **new blocking item N1** | see below |
| 7 XP retraction + Results | Fixed at CR-2's sanctioned boundary; every reconcile-path Result checked — but **over-retracts on off days, N2** | see below |
| 8 calendar buckets | **Fixed** | real `startOfWeek/endOfMonth`/`YYYY-01-01` boundaries (reads.ts:115-149); every bucket but the last a full calendar period |
| 9 query keys | **Fixed** | `taskOccurrences`/`achievements` in `QUERY_KEYS`; predicate invalidation covers all variants; invalidation test |
| 10 fixtures + tests | **Fixed** | `threeDayMixedFixture` is real tasks/logs and reproduces 67% through `resolveOccurrence` → `aggregateConsistency`; `twoCompletedCyclesFixture` + `cycleBoundaryFixture` added; `src/queries` 0→10 tests against the real hooks |

CR-1 (`CycleStateRepository` in `ports.ts:80-82`/`Repositories.cycleState`) and CR-2
(`retractXpAward`, ports.ts:59, API.md §1/§2) landed through the architect as required;
M1's implementations verified read-only (`progressRepository.ts:121-128`).

## Blocking items (new, ranked by severity)

**N1. A moved-then-completed occurrence diverges between the mutation path and the read
path — the most common snooze flow is broken.**
`src/domain/dayState.ts:98` (`const effectiveLog = movedInLog ?? log;`) and
`src/queries/mutations.ts:193` (`resolveOccurrence` called **without** `movedInLog`).
Trace the flow F7 exists for — snooze today→tomorrow, then complete it tomorrow:
1. `useMoveOccurrence(06-01 → 06-02)`: source log gets `movedToDate`. Read path: 06-01
   `not-due`, 06-02 `pending`. Correct so far (and tested).
2. Tomorrow the user taps Done on the 06-02 row → `useLogState(taskId, '06-02', 'done')`
   upserts a **target-date log** (done, manual). `reconcileOccurrence('06-02')` resolves
   *without* the moved-in log, sees the done chip → `ideal` → awards 10 XP, returns
   `celebrate: 'ideal'`. S24 fires.
3. But every **read** (`useToday`, `useTaskOccurrences`, `useConsistency` via
   `internal.ts:69-90`) resolves 06-02 with `movedInLog` present, and
   `movedInLog ?? log` makes the *source* log (chip `todo`) **shadow the user's own done
   log**. The day renders `pending`, and after 06-02 ends it becomes **missed**.
Result: XP awarded and celebration shown for a day the engine then counts as missed —
`numerator === denominator − missed` is violated system-wide (an award exists for a
denominator-missed day), and the user watches a completed day read as a miss, the exact
punitive outcome this product exists to avoid. The inverse direction is broken too: move
an already-done occurrence → read path shows `ideal` on the target, but
`reconcileOccurrence(toDate)` (mutations.ts:532) can't see the moved-in log, so for an
off-cadence target it resolves `not-due` and never awards — display and ledger disagree
again. *Good looks like:* (a) precedence `log ?? movedInLog` — a real user action on the
target date always wins over the moved-in record, which then only confers due-ness and the
initial record; (b) `reconcileOccurrence` performs the same moved-in lookup `internal.ts`
does (or receives the resolved occurrence), so both paths resolve one truth.
*Acceptance tests:* (i) move today→tomorrow, advance the clock, `useLogState(target,
'done')` → `useTaskOccurrences` shows `ideal` on the target, exactly one XP award,
`numerator === denominator − missed` holds; (ii) same on a `specific-weekdays` task whose
target is off-cadence — completing the moved occurrence awards XP and reads `ideal`.
Note the existing dayState test "a moved-in occurrence carries its own chip/step data"
(dayState.test.ts:166-171) asserts the shadowing precedence with `log: null` — it will
need its premise revisited, not just the implementation.

**N2. Marking an off day retracts earned XP — an explicit SCHEMA §7 / F4 violation.**
`src/queries/mutations.ts:218-223`: retraction fires whenever the resolved occurrence is
not XP-eligible, and `off` is not eligible. So: log Done (+10 XP), then mark that task-day
off (`useMarkOffDay` → `reconcileOccurrence`, mutations.ts:477) → outcome `off` →
`retractXpAward` **deletes the earned award**. SCHEMA §7: lifetime and cycling XP —
"Neither can be reduced by … an off day". PRD §3.4: an off day "never triggers a reset,
streak-break, or XP penalty". API §2's amended CR-2 clause also pins monotonicity "against
… an off day" and sanctions retraction only for "an undone mis-tap". It is also internally
inconsistent: a *whole-day* off mark (`taskId: null`) never reconciles, so the same action
at the other grain leaves XP intact — proof the retraction here is accidental. Secondary
damage: the mark→unmark round trip re-awards under the *current* cycle id, silently
migrating cycling-XP attribution across a boundary. *Good looks like:* retraction fires
only when the occurrence is **resolved-or-pending via its chip** (`todo`/`skip` — the
mis-tap and the un-set) and for the documented move-vacated case; never when outcome is
`off`. *Acceptance test:* Done (+10) → mark task-day off → lifetime XP still includes the
10 and the award row survives; unmark → still exactly one award, original cycle id.

**N3. After a cadence change, the fresh window starts at the calendar period start —
overlapping the just-archived short record.**
`src/queries/mutations.ts:172`: `currentCycleWindow(newCadence, today)` has
`startDate = startOfWeek/startOfMonth(today)`, up to 6/30 days **before** the short record's
`endDate = today`. Concrete: monthly→weekly on Wed 2024-03-20 → short record Mar 1–20,
fresh weekly window Mar 18–24; when that window archives, days Mar 18–20 sit in **two
permanent cycle records**, double-attributed in both records' consistency %. SCHEMA §8: the
fresh cycle "**begins**" at the change and runs "to that cadence's next natural boundary" —
i.e. a leading partial window starting **today**, exactly the shape M1's genesis seed uses
(`cycleWindowSeed.ts:30-33`: start = today, end = calendar end). M2's own response text
claims "starts a fresh window under the new cadence **from today**" — the code does not do
what the response says. The item-2 test's comment "no duplicates/overlaps"
(mutations.test.ts:375) asserts only **key uniqueness**, which cannot catch an interval
overlap — it currently documents a property the code doesn't have. *Good looks like:* fresh
window `{ start: today, end: endOfWeek/endOfMonth(today) }` (id scheme can stay
deterministic or reuse the seed pattern). *Acceptance test:* switch cadence mid-period;
assert the fresh pointer's `startDate === today`, and that no two archived records'
`[start, end]` intervals intersect (a real interval check, not a key-string check) after
the next natural boundary archives.

**N4. Partial failure can double-archive a cycle — SCHEMA §8's "never a double archive"
is not upheld.**
`src/queries/mutations.ts:140-146`: the loop archives every elapsed window, then advances
the pointer **once, after all of them**. If archive A succeeds and archive B fails
(`appendCycleRecord` is fallible), the function returns with the pointer still at A's
window; the next reconciliation re-archives A → duplicate permanent record (the pass-1
dedup scan was removed, so the pointer is now the *only* idempotency mechanism and it isn't
advanced in lockstep). Same class in `finalizeCycleForCadenceChange` (mutations.ts:169-174):
short record appended, then `cycleState.set` fails → error returned, patch not applied,
next attempt appends a **second** short record. And `getOrInitCycleState`
(mutations.ts:91) deliberately ignores its `set` failure, so a fallback-derived run that
archives and then fails to persist the pointer replays from the anchor next time. SCHEMA
§8: "wrapped in one transaction per boundary … either archived-and-reset, or intact to
retry — never a lost value, never a double archive." *Good looks like:* advance the pointer
after **each** successful archive (one pointer write per boundary), treat a failed pointer
write after a successful append as a state that must not re-append (e.g. a cheap
`(cadence,start,end)` existence check before append as a belt-and-braces guard), and stop
archiving in `getOrInitCycleState`-fallback mode if the pointer cannot be persisted.
*Acceptance test:* fail the second of three pending archives → re-run reconciliation →
exactly three records exist, no duplicates; fail `cycleState.set` after the short-cycle
append → re-run the cadence change → still exactly one short record.

**N5. Step-driven level-ups emit `level:up` twice.**
`reconcileOccurrence` emits it (mutations.ts:252) and `useToggleStep` emits it again
(mutations.ts:426) for the same crossing — grep confirms exactly these two sites.
`useLogState`/`useLogDose` correctly rely on the reconcile-path emit alone. M7's
notification scheduler subscribes to this event; a duplicate emit is a duplicate
milestone notification. Remove the re-emit in `useToggleStep` (or move the emit out of
`reconcileOccurrence` and make every caller responsible — one convention, applied once).
*Acceptance test:* a step toggle that crosses a level records exactly one `level:up` on
the bus.

## Non-blocking notes

- `MOVE_SEARCH_PAD_DAYS = 60` (internal.ts:46): a move landing >60 days from the resolve
  range silently drops the occurrence from reads while the source stays vacated. Either
  clamp/reject far moves in `useMoveOccurrence` or document the bound where M4 will see it.
- Chained moves: `log.movedToDate` is checked before `movedInLog` (dayState.ts:88), so if
  B's own occurrence was moved to C, an occurrence moved A→B vanishes entirely. Two sources
  moved into one target: `movedInByDate` last-writer-wins (internal.ts:69-74). Both are
  edges of N1's rework — decide and test the tie-breaks while in there.
- S27's locked-detail lines ("Locked — show up 7 days total, ideal or fallback." etc.,
  ALLSCREENS 2407-2414) are design-pinned rendered copy; the catalogue's
  `lockedHint`/`description` strings are close but not verbatim. That is fine only as long
  as M5 renders from its own `copy.ts` — worth one sentence in the catalogue header so M5
  doesn't mistake the hints for the pinned copy.
- `getOrInitCycleState`'s fallback window (`currentCycleWindow(cadence, anchor)`) starts at
  the calendar period containing the anchor, i.e. possibly before the store existed —
  M1's seed starts at the creation day. Rare path (pointer is seeded at genesis and carried
  by backup/sync), but aligning the fallback shape with N3's fix costs nothing.
- The queries suite leaves Jest with an open-handles warning ("did not exit one second
  after the test run"). Teardown is mostly handled (the `afterEach` unmount dance); worth
  chasing before qa-tester inherits the pattern.
- Comeback's task-level interpretation is now recorded in the catalogue comment and copy
  (achievements.ts:65-77) — good; note the *description* wording changed accordingly, which
  is legal (only the label is design-pinned).
- Fixed and verified from pass-1 non-blocking list: `cycle:finalized` carries the real
  record id (mutations.ts:107-121); `milestone-course-x3` unlocks on the chronological 3rd
  course's own end date (achievements.ts:224-229, with test); inverted-range guards in
  `occurrencesBetween`/`eachDay`; `daysBetween` sign-convention warning; backdated
  Event/Course materialisation via `iterationFrom` (internal.ts:33-37); stale "STUB"
  comment gone; dateMath header now records the keep-it rationale (acceptable — the ruling
  stands, collapsing remains optional).

## Verified

- **Pass-1 findings integrity:** `git diff 407ede2:review/REVIEW-M2.md HEAD:…` — additions
  only (the appended Response section); zero modifications to my text.
- **Ran:** `npx jest src/domain src/queries` → 11 suites, 133 tests, all pass (10 domain
  suites + the new `mutations.test.ts`).
- **Arithmetic core regression check:** cumulative diff `407ede2..HEAD` touches
  `occurrence.ts`, `dayState.ts`, `dateMath.ts`, `achievements.ts`, fixtures and the
  queries layer — `consistency.ts`, `xp.ts`, `cycles.ts`, `validation.ts` and
  `consistency.test.ts` are untouched. Re-read the changed upstream files end-to-end: the
  chip→outcome mapping, off-check ordering, auto-log rule and `effectiveLog === log`
  equivalence when no move is involved are all preserved, so every §6.6 golden number rests
  on unchanged code paths; re-ran the suite to confirm (67% anchor now additionally
  reproduced through the real pipeline from the new fixture).
- **Item 4 exhaustively:** grep for every Instant→date derivation across both owned trees;
  only the two `toLocalDate(new Date(...))` sites remain; `notBefore` threading read at
  every call site; domain purity intact (no `new Date()`, no new imports in `src/domain`).
- **Cycle pointer:** read the full rewrite; pointer authoritative; fallback derivation
  reached only on `null` and written back (runs at most once per the header's claim —
  true, except the ignored-set edge in N4); `useProgress` reads the pointer, and XP awards
  are stamped with the pointer's id, so stamping and summing agree, including with M1's
  random genesis id (`lifecycle.ts:41-52`).
- **New tests mutation-checked by inversion reasoning:** the level-up test asserts
  `levelUp.level === 2` where the old code returned a hardcoded `null` — fails under the
  bug; the move test asserts the source date is `not-due` where the old code yielded
  `pending` — fails under the bug; the item-7 test injects an `appendXpAward` failure and
  asserts `xpAwarded: 0` + no emit — fails under the bug; the useTasks test mounts two
  filters on one QueryClient — fails under the shared-key bug. The item-1/item-2 cycle
  tests genuinely exercise the new machinery but do not assert window-interval disjointness
  or the fresh window's start (which is how N3 slipped through) and do not exercise partial
  failure (N4).
- **FakeRepos fidelity:** read in full; matches the port surface including
  `retractXpAward`/`cycleState`; `failNextAppendXpAward` used by the item-7 tests.
- **Ownership:** cumulative diff since my pass-1 commit touches, in M2-attributable paths,
  only `src/domain/**` and `src/queries/**` (including `src/queries/testSupport/`);
  `src/db/testSupport/*` was M1's own commit (141158f), `src/lib`/`src/ui` were M0's
  in-flight snapshots. The one M2 write outside its contract was the Response section in
  this file — see the process note.
- **Strings:** "streak" still absent from both trees (guard test aside); design-pinned
  labels unchanged.
