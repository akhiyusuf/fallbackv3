# Review — M1 (pass 2)
VERDICT: CHANGES_REQUIRED

Module: M1 — Data layer & data lifecycle. This is **pass 2**, re-reviewing the rework
against the pass-1 review (commit `141158f`; M0/M2 are mid-rework concurrently and their
files in that commit are not assessed here).

**Status in one line:** both pass-1 blocking items are genuinely fixed and probe-hardened
— the restore validation survived seven adversarial envelopes without a single
destructive success — but the *placement* of the new event emissions introduces one new,
narrow, provable defect on the two most critical lifecycle paths. One blocking item.

---

## Blocking items

### 1. The new `emit()` calls sit inside the success paths, so a throwing subscriber falsifies `open()`'s and `eraseAll()`'s Results — `src/db/lifecycle.ts:101` and `:144-145`

`emit()` (`src/lib/events.ts:11-18`, M0) does not isolate handler exceptions, and nothing
anywhere contracts that handlers must not throw. M7's widget/notification handlers — the
exact consumers these events exist for — will run synchronously inside these two calls.

- **`open()`** (`lifecycle.ts:97-108`): `emit({type:'store:ready'})` is inside the `try`.
  A throwing `store:ready` subscriber lands in the `catch`, which sets
  `status = 'corrupt'` and returns `ok('corrupt')` — **a perfectly healthy store is
  routed to S50, permanently**: every "Try again" repeats the same open → same throw →
  same 'corrupt'. That is the recovery-surface crash-loop F1 exists to prevent,
  manufactured out of a working database.
- **`eraseAll()`** (`lifecycle.ts:144-146`): probe-proven (temp test, removed after run) —
  with a throwing `store:erased` subscriber:

  ```
  erase result: {"ok":false,"error":{"code":"WRITE_FAILED","message":"subscriber exploded"}}
  store status: ready    store:ready emitted during erase: 0
  ```

  The erase **fully succeeded**, yet: S48 renders "Something went wrong erasing your
  data. Nothing was lost — try again" (false twice over — everything was erased and
  nothing went wrong); `status()` says `'ready'` while the Result says `WRITE_FAILED`
  (internally inconsistent, observable today); and `store:erased` fired **without** its
  paired `store:ready` — exactly the split-emission state the ordering was supposed to
  make impossible. Retry loops the same false failure forever.

The clean-failure ordering itself is correct — the three new lifecycle tests
(`lifecycle.test.ts:113-165`) prove no emission on a failed open, a failed erase, or a
forced post-delete reopen failure. The defect is solely that emission failure can
contaminate the Result of an operation that already succeeded.

**Fix:** decouple emission from the Result — wrap each `emit` in its own `try/catch`
(swallowing, or logging via dev-only means), or hoist emissions out of the guarded
region after the outcome is fixed. (The systemic fix — `emit()` isolating handler
exceptions — is M0's file and would protect M2's mutations too; worth an architect
note, but M1's Results must be truthful regardless of what M0 does.)
**Acceptance test:** register a `store:ready` subscriber that throws and a
`store:erased` subscriber that throws; `open()` still returns `ok('ready')` with
`status() === 'ready'`; `eraseAll()` still returns `ok` and still attempts both
emissions in order; the existing three no-emission-on-failure tests stay green.

---

## Non-blocking notes

1. **`validateBackupColumns` has no covering test.** Its behaviour is real — my probes
   P2 (hostile column key) and P6 (unknown column on a valid settings row) both got a
   clean pre-transaction `VALIDATION_FAILED` with data untouched — but the only exercise
   of this code path was my probe, which was deleted. Add one test asserting an
   unrecognised column rejects without touching data, or the hardening can silently
   regress.
2. **The `.tmp`-then-`moveAsync` backup path has no failure-mode test** (the double now
   implements `moveAsync`, `fileSystemTestDouble.ts:27-32`, and the happy path is
   covered). A test forcing `writeAsStringAsync` to throw and asserting no file exists
   at the final uri would lock "no partial file left behind."
3. **Lock the orphan-unreachability property of `retractXpAward` with a test.** The SQL
   (`progressRepository.ts:123`, `WHERE task_id = ? AND date = ?`) structurally cannot
   match an orphaned `task_id = NULL` award — SQL `=` never matches NULL — which is a
   load-bearing monotonicity guarantee: even a buggy caller passing a deleted task's
   former id cannot reduce post-deletion lifetime XP. One test (orphan award + retract
   with the former id → award intact) makes that property survive any future rewrite of
   the WHERE clause.
4. **Migration-2 dedupe fixture could also seed a task-scoped mark on the duplicated
   date.** The DELETE is correctly scoped (`task_id IS NULL` filter; `MIN(rowid)`
   survivor per date; the `NOT IN` subquery cannot yield NULL — verified by analysis and
   by the passing fixture keeping `off-legacy-1`), so it cannot delete a task-scoped
   row — but the fixture doesn't currently prove that half of the scoping.
5. **Residual window on a failed erase, documented and accepted:** if the post-delete
   reopen fails, data is genuinely gone but `store:erased` has not fired (per the
   contract the tests pin: "fires iff eraseAll reports success"), so a future widget
   snapshot would stay stale until the user's retry succeeds. Bounded by S48's retry
   UX; fine.
6. **Carried from pass 1, still open by design (not claimed fixed, none blocking):**
   exported `.fallbackbak` files survive erase-all (architect/product call — pass-1 note
   5); S47's restore-failure banner lacks the spec's dismiss affordance
   (`InlineRetryBanner` is M0's; component-gap request, not M1's to work around); the
   SecureStore key list is a hardcoded two-key constant that rots if M6 adds keys
   (pass-1 note 9); `formatVersion` forward-compatibility is still unchecked (only
   `typeof number`) — trivial, same one-line shape as the `schemaVersion` check that
   was added.

---

## Pass-1 items: resolution verified

- **Blocking 1 (destructive impossible-envelope restore) — FIXED and robust.**
  `validateBackupEnvelope` (`backupEnvelope.ts:81-129`) now requires exactly one
  `settings` row with `id === 1` and exactly one `cycle_state` row with `id === 1`,
  before any transaction; `schemaVersion > CURRENT_SCHEMA_VERSION` rejects; the exact
  pass-1 reproduction is now a real test asserting non-ok, task intact, `settings.get()`
  resolving, and the tenure anchor unchanged (`backupRestore.test.ts:171-210`, plus
  `:212-238` for the missing-cycle_state and future-schema variants).
  **Probed adversarially through the real `store.restore()` path** (all temp probes
  deleted after): P1 minimal singletons `{id:1}` only → NOT-NULL constraint → rollback →
  `VALIDATION_FAILED`, data intact; P2 hostile column key → rejected pre-transaction;
  P3 duplicate singleton rows → rejected; P4 string `"1"` id → rejected (and a genuine
  backup always serialises a numeric 1, so no false negative); P6 valid row + one
  unknown column → rejected; P7 dangling **non-null** `xp_award.task_id` (impossible in
  a real backup) → FK violation → rollback, intact. The two legitimate cases still
  succeed: P5, a true fresh-store backup (settings + cycle_state populated, everything
  else empty — this is a *possible* envelope and must restore, and does); P8, a NULL
  `task_id` award through the full pipeline → restores intact, lifetime XP 10. **No
  destructive-success path found.**
- **The interpolation risk is closed, not narrowed** — `validateBackupColumns`
  (`backupEnvelope.ts:139-154`) runs before the transaction and every key must
  exact-match a `pragma_table_info` column name; nothing reaches the interpolated
  INSERT unless it is a literal current-schema column identifier. (Only gap: no test —
  note 1.)
- **Blocking 2 (events) — emitted, correctly ordered on every clean path** (`:101`,
  `:144-145`; tests `lifecycle.test.ts:113-165` cover exactly-once-on-success,
  never-on-failure, and never-on-forced-post-delete-reopen-failure). The one residue is
  the new blocking item above — emission placement, not emission absence.
- **CR-1/CR-2 conformance checked against the ports M0 actually landed**, not the
  prose: `Repositories.cycleState` is a first-class `CycleStateRepository`
  (`ports.ts:80-102`); M1's `repos` drops the intersection type and `CycleState` is
  imported from `@/types` (`cycleStateRepository.ts:8`); `retractXpAward(taskId, date)`
  matches the port signature and its documented no-op-returns-ok contract
  (`progressRepository.ts:121-128`, tests `repositories.test.ts:207-234`). Boundary: in
  the current (mid-flight, not-assessed-as-M1) M2 code, retraction fires only from
  `reconcileOccurrence` on a live task's un-set showing-up state, and `useDeleteTask`
  explicitly does not call it; on M1's side the NULL-mismatch property (note 3) makes
  deletion-orphans unreachable regardless of caller discipline. No path from a missed
  day, off day, cycle boundary, or deletion reaches a row that exists to delete.
- **Migration-2 dedupe** — correct and now honestly tested: the v1 fixture seeds two
  same-date whole-day rows *before* migrating (`migrations.test.ts:62-75`), migration
  succeeds, the lowest-rowid survivor `off-legacy-1` is asserted (`:89-93`), task/xp
  rows survive, and the new index is proven live (`:95-110`). Analysis of the DELETE:
  scoped to `task_id IS NULL`; keeps `MIN(rowid)` per date; a `MIN(rowid)` over a
  non-empty group can never be NULL, so `NOT IN` has no NULL trap. It cannot delete a
  row it should keep (coverage nit in note 4).
- **Non-blocking 2/6/7/10 from pass 1 — all fixed as claimed:** temp-write+move with
  best-effort `.tmp` cleanup on failure (`lifecycle.ts:164-176`); S45 renders nothing
  rather than a dangling "Last synced" (`sync.tsx:96-101`, with a dedicated test
  `sync.test.tsx:51-57`); S01's `boot()` wrapped, degrading to `/recovery` with a test
  (`splash.tsx:32-65`, `splash.test.tsx:50-55`); dead `createCycleStateAccessor` gone,
  wrong-file comment and misleading test title corrected.

## Verified (what I checked and HOW)

- `npx tsc --noEmit` → **exit 0** (the pass-1 probe-file errors are gone).
  `npx jest` → **35 suites / 249 tests, all pass** — run by me, not taken from the
  builder's report.
- **Adversarial restore probes P1–P8** via a temporary test through the real
  `store.restore()` against the real-SQL double (outputs quoted above; file deleted).
- **Event-emission probe**: throwing `store:erased` subscriber during a real
  `eraseAll()` → `WRITE_FAILED` + `status()==='ready'` + no `store:ready` (the blocking
  item; file deleted).
- **Screen tests re-read in full** — now `@testing-library/react-native` with awaited
  `render` per the house pattern, no local lucide mocks. They assert behaviour, not
  rendering: exact routing destinations incl. origin params
  (`/settings/data/erase?from=data|recovery`, `/splash`, `/recovery`, `/settings`),
  both S48 copy variants, disabled→re-enabled button state via `accessibilityState`,
  toast tone + prefix on backup success/failure, picker-cancel short-circuit, all three
  S45 helper states, and S01's five routing outcomes including the new throw-degrade.
  Adequate as the wave-2 reference.
- **Ownership**: `git show --stat 141158f` — every M1-owned file in the commit is inside
  M1's paths; the other files are M0/M2 rework (out of scope per instruction); no
  frozen/unowned path touched. Working tree's uncommitted `src/queries/mutations.*`
  changes are M2 mid-flight.
- Re-confirmed unchanged from pass 1: cascade DDL and sweep, backup table set excluding
  `entitlement`, no "streak", no raw colour literals, SQL confined to `src/db/**`.
