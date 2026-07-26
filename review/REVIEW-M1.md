# Review — M1 (pass 3)
VERDICT: PASS

Module: M1 — Data layer & data lifecycle. This is **pass 3**, deliberately narrow per
the coordinator: the `safeEmit` fix, the three note closures, and regressions from them.
Everything else stands as verified under adversarial probing in pass 2.

**M1 is clean.** The pass-2 blocking item is fixed correctly and non-vacuously, all three
note closures carry genuine, load-bearing coverage (mutation-checked, not taken on
faith), and no regression was found in `src/db/**` or the five screens.

---

## Ruling: silent-swallow is CORRECT at this boundary — stop worrying about it

`safeEmit` discarding the exception with no log is the right contract **for M1's call
sites**, for three reasons:

1. **The boundary is right.** A subscriber's exception is the subscriber's failure. M1's
   only obligation is that its Results and `status()` stay truthful — which the guard
   now guarantees — and that both events are still dispatched in order — which per-call-
   site placement guarantees (verified, Probe A below).
2. **A local dev-log here would be worse than none.** M2 emits seven other event types
   through the same raw `emit()` with the identical exposure. If M1 hand-rolls
   surfacing at its two call sites, the codebase gets one producer that logs subscriber
   bugs and one that crashes on them — incoherent observability that would mislead
   whoever debugs M7 later. Surfacing policy must exist exactly once.
3. **The correct home for surfacing is `src/lib/events.ts` (M0), not M1** — and the same
   home fixes a gap M1 *cannot* fix from its seat: `emit()`'s dispatch loop is not
   per-handler isolated, so one throwing subscriber starves later subscribers **of the
   same event** (true before this fix and after it; `safeEmit`'s catch sits outside the
   loop). Per-handler `try/catch` inside `emit()` with a `__DEV__`-only `console.error`
   would (a) surface every producer's subscriber bugs uniformly, (b) stop peer
   starvation, and (c) make M1's `safeEmit` harmless belt-and-braces. That is a
   one-file architect change note against M0's `src/lib/events.ts` — recommended, not
   required, and **not** an M1 defect. No telemetry implications: ARCHITECTURE §9.1
   bans network telemetry, not dev-console output.

So: judged and ruled — silent swallow at M1's boundary is correct; route the
`events.ts` per-handler-isolation + dev-surfacing recommendation to the architect for
M0 whenever convenient.

---

## Blocking items

None.

## Non-blocking notes

1. **Architect note (M0's file, carried from the ruling above):** `emit()` should
   isolate per handler and dev-log, closing the peer-starvation gap and giving M7's
   future bugs a visible signature. Until then, a genuine M7 handler bug on
   `store:ready`/`store:erased` fails invisibly — accepted consequence of the correct
   boundary, bounded to two events, and uniform with M2's exposure.
2. **Async-subscriber residue (informational, no action):** an `async` handler that
   rejects escapes to the environment's unhandled-rejection handler (Probe C — in the
   app that is RN's global handler / M0's root boundary territory). It **cannot**
   falsify M1's Results (proven below), so the original defect does not survive in
   async shape; noting only so nobody mistakes `safeEmit` for covering it.
3. **Commit hygiene / frozen-file flag for the ORCHESTRATOR, not M1:** the snapshot
   commit `948dbc7` labelled "M1 guarded emits" actually contains only `jest.config.js`
   (architect-frozen) and `src/queries/mutations.test.ts` (M2's); M1's safeEmit and
   tests landed in the earlier snapshots `d7adcc5`/`1a503a4`. All M1 content is inside
   M1's owned paths — no violation — but the `jest.config.js` edit (whitelisting
   `standard-navigation` for transform) has no stated author. Its style and subject
   match the architect's prior frozen-config fixes in the same file; please confirm
   architect authorship for the record. Not counted against M1.
4. Pass-2's carried notes (backup files surviving erase-all as an architect/product
   call; S47 banner dismiss affordance as an M0 component gap; SecureStore key-list
   rot as an M6 coordination item; `formatVersion` forward-compat) remain open by
   design and none block.

---

## Verified (what I checked and HOW)

**The fix itself**
- `safeEmit` implementation as quoted, wrapping **each** call site individually:
  `lifecycle.ts:88-94`, applied at `:120` (`open()`, still inside the `try` but now
  guarded) and `:165-166` (`eraseAll()`, after full success). Ordering confirmed in
  pass 2 is untouched.
- **Probe A — paired-emit atomicity** (temp test, deleted after run): throwing
  `store:erased` subscriber + recording `store:ready` subscriber →
  `eraseAll ok = true`, `store:ready` delivered exactly once, `status = ready`. A
  subscriber that throws cannot break the `store:erased` → `store:ready` sequence.
- **Probe B — the guard and its tests are not vacuous**: raw
  `emit('settings:changed')` with a throwing subscriber still propagates the throw
  (M0 added no isolation of its own), so `safeEmit` is the load-bearing element; my
  pass-2 probe already reproduced the exact failure through this same path without the
  guard. The two new tests (`lifecycle.test.ts:171-204`) assert precisely the
  conditions that probe violated: `open()` → `ok('ready')` + `status 'ready'` under a
  throwing `store:ready` handler; `eraseAll()` → `ok` + `status 'ready'` under
  throwing handlers on both events.
- **Probe C — async shape** (two runs): a rejecting `async` subscriber leaves
  `eraseAll ok = true`, `status ready`; the rejection materialises strictly *after*
  `eraseAll` has returned (microtask queue) and goes to the global handler — in the
  first run jest's own unhandled-rejection detection flagged it, which is itself the
  demonstration that it escapes to the environment rather than into M1's `catch`. The
  Result-falsification defect cannot recur in async form.

**The three note closures**
- **Column allowlist** (`backupRestore.test.ts:243-269`): starts from a *genuine*
  `store.backup()` output, injects `sneaky_extra_column: 'DROP TABLE task;--'` onto the
  task rows, drives it through the real `store.restore()` → `VALIDATION_FAILED`,
  pre-existing task intact. Exercises `validateBackupColumns` end-to-end, exactly the
  pass-2 gap.
- **`retractXpAward` orphan guarantee** (`repositories.test.ts:241-269`): insert →
  award → soft-delete → reopen (sweep orphans the award) → retract with the **stale**
  pre-deletion id → no-op `ok`, lifetime XP still 10, row still present.
  **Mutation-checked (Probe D)**: I rebuilt the repository over the same live database
  with the WHERE clause rewritten to the careless NULL-matching form
  (`(task_id = ? OR task_id IS NULL)`), and the buggy retract drove lifetime XP
  10 → 0 — precisely the state this test's assertions reject. The test genuinely
  fails under the bug it guards against; the level-demotion property is locked.
- **Migration-2 scoping** (`migrations.test.ts:75-107`): the v1 fixture now seeds a
  task-scoped mark on the duplicated date alongside the two whole-day duplicates;
  post-migration assertions require exactly `['off-legacy-1',
  'off-legacy-task-scoped']` to survive with the task-scoped row's `task_id` intact —
  asserting the dedupe's `WHERE task_id IS NULL` scoping, not merely its `MIN(rowid)`
  ordering.

**Regression + hygiene**
- `npx tsc --noEmit` → exit 0. `npx jest src/db app/splash.test.tsx app/recovery.test.tsx
  app/settings/sync.test.tsx app/settings/data` → **10 suites / 66 tests, all pass**,
  run by me. The known `src/queries/mutations.test.ts` failure is M2's mid-rework path,
  excluded per instruction and not counted.
- All four probe files were temporary and deleted after their runs; `git status` on
  M1's paths is clean.
- M1's diffs since pass 2 touch only `src/db/lifecycle.ts` and the three test files —
  all inside M1's owned paths; no frozen or unowned path carries M1 changes (see note 3
  for the unrelated `jest.config.js` attribution flag).

---

## Standing record (verified in passes 1–2, unchanged)

The SCHEMA §2.3 split cascade and NULL-`task_id` restore path are correct, verified in
the DDL and re-executed against a real SQLite engine outside the module's harness; the
restore validator survived seven adversarial envelopes (P1–P7) with zero destructive
successes while both legitimate cases (fresh-store backup, NULL-award pipeline)
restore intact; the interpolation surface is closed by exact-match `pragma_table_info`
allowlisting before the transaction; erase-all is atomic, confirmation-gated, correctly
scoped in blast radius, and now event-visible to M7; migrations are forward-only with a
tested v1 fixture, rollback test, and a dedupe that cannot touch a keeper; the five
screens match their `ALLSCREENS_1.md` specs with verbatim copy, origin-aware S48
behaviour, and behavioural tests fit to be the wave-2 reference; "streak" appears
nowhere; no raw colour literals; SQL confined to `src/db/**`; no dependencies added.

**M1 is approved to freeze with wave 1.**
