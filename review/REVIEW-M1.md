# Review — M1 (pass 1)
VERDICT: CHANGES_REQUIRED

Module: M1 — Data layer & data lifecycle.
Scope reviewed: `src/db/**`, `src/services/data/**`, `src/services/sync/**`,
`src/features/data/**`, `app/splash.tsx` (S01), `app/recovery.tsx` (S50),
`app/settings/sync.tsx` (S45), `app/settings/data/index.tsx` (S47),
`app/settings/data/erase.tsx` (S48), plus their tests.

The two highest-stakes items — the SCHEMA §2.3 delete-cascade split and the NULL
`xp_award.task_id` restore path — are **correct, verified in the actual SQL and
independently re-executed against a real SQLite engine outside the module's own test
harness** (see Verified). Neither blocking item below touches them. Both blocking items
are in the F25/F19 lifecycle periphery.

---

## Blocking items

### 1. `restore()` accepts a semantically-impossible envelope and applies it destructively — `src/db/backupEnvelope.ts:70-97`

`validateBackupEnvelope` checks only that `tables[t]` is an array for each of the 11
pinned tables. An envelope whose 11 tables are all **empty arrays** — a file no build of
this app could ever have produced, since `buildBackupEnvelope` always serialises exactly
one `settings` row and one `cycle_state` row — passes validation, and
`applyBackupEnvelope` then deletes every row of real data and "restores" nothing.
**Reproduced live** (probe test, run and then removed):

```
restore result: {"ok":true}
tasks after restore: 0
settings.get() threw: settings singleton missing — StoreLifecycle.open() must seed it before any read
```

Consequences: (a) S47 shows the success toast "Restored — your data is back." over a
wiped store; (b) every subsequent `repos.settings.get()` **throws across the module
boundary** (violating ARCHITECTURE §10 — services do not throw) until the next relaunch;
(c) on that relaunch `ensureSingletons` mints a **new tenure anchor**, contradicting
SCHEMA §7 ("a sync restore carries the anchor") and silently resetting the F29 ladder.
SCHEMA §9's rule is that a malformed file "leaves existing data untouched" — a file that
cannot have come from `backup()` is malformed, whatever its JSON shape says.

**Fix:** extend `validateBackupEnvelope` to require the singletons the schema guarantees
— exactly one `settings` row with `id = 1` and exactly one `cycle_state` row with
`id = 1` (rejecting before the transaction opens keeps the non-destructive guarantee
structural, which is the module's own stated design).
**Acceptance test:** restoring an envelope with `format`/`formatVersion`/`schemaVersion`
correct but all 11 tables `[]` returns `err(VALIDATION_FAILED)`, the pre-existing task
is still readable, and `repos.settings.get()` still resolves. The existing
`backupRestore.test.ts` suite must stay green (a genuine backup always contains both
singleton rows, so the round-trip tests are unaffected).

Note this does **not** reintroduce §9 "repair" behaviour: a NULL `xp_award.task_id` is a
row-level value and stays untouched; this check is table-cardinality only.

### 2. `store:erased` is never emitted, so F25's "clears widget snapshot files" is structurally unreachable — `src/db/lifecycle.ts:115-139` / `src/services/data/index.ts:19-21` / `app/settings/data/erase.tsx:51-62`

MODULES M1 non-negotiable: "`eraseAll` … clears SecureStore keys **and widget snapshot
files** too" (SCHEMA §9 says the same). `eraseAll` clears the DB file and the two BYO
SecureStore keys, and nothing else. The architecture's designated mechanism for the
snapshot is the event bus: the closed `AppEvent` union (`src/types/ports.ts:154-155`)
defines `store:ready` and `store:erased` precisely so M7's widget bridge can react
without M2/M1 importing it (ARCHITECTURE §4.4, API §3). Grep confirms **no code anywhere
emits either event** — and the entire erase flow (S48 → `services/data` →
`store.eraseAll`) is M1-owned, so no other module can ever fire it. Once M7 lands its
snapshot writer, an erase-all would leave the user's pre-erase habit data sitting in the
shared container, rendered on their home screen — a privacy-adjacent remnant on a
feature whose whole promise is "fully erased."

**Fix:** after a successful `eraseAll`, emit `{ type: 'store:erased' }` (and, since S01
and the lifecycle are also M1's, emit `{ type: 'store:ready' }` on a successful
`open()` — the closed union has no other plausible producer). `src/lib/events.ts` is
M0's importable lib surface; this stays inside M1's owned paths.
**Acceptance test:** a subscriber registered via `on('store:erased', …)` fires exactly
once when `eraseAll()` resolves ok, and does not fire when `eraseAll()` fails.

---

## Non-blocking notes

1. **Migration 2 can fail on legal v1 data, and its test comment claims coverage it
   avoids** — `src/db/migrations/002_offday_whole_day_unique.ts:16`,
   `src/db/__tests__/migrations.test.ts:38-39`. A v1 store holding two whole-day
   `off_day_mark` rows for one date (legal under v1's `UNIQUE(date, task_id)` because
   NULLs are distinct) makes `CREATE UNIQUE INDEX` throw — verified live:
   `UNIQUE constraint failed: off_day_mark.date` → `MIGRATION_FAILED` → S50 for a
   healthy store. Unreachable in production only because v1 and v2 ship in the same
   binary and always run in one `open()`. But the test comment "including two off-day
   whole-day rows for the SAME date — legal under v1" describes a fixture the test
   deliberately does not seed (it inserts its duplicates *after* migrating, on a fresh
   date). Recommend: prepend a dedupe `DELETE` (keep `MIN(rowid)` per NULL-task date) to
   migration 2, seed the duplicate fixture the comment already advertises, and assert
   the survivor. This also makes migration 2 the honest "real forward migration" the
   split was justified by.
2. **`backup()` cannot fully guarantee "no partial file left behind"**
   (`src/db/lifecycle.ts:145-156`): a mid-write failure of `writeAsStringAsync` may leave
   a truncated file at the final name. Write to a temp name then move, or delete on
   catch.
3. **Column names from the backup file are interpolated into INSERT SQL**
   (`src/db/backupEnvelope.ts:113-119`). Single-statement prepare limits the blast
   radius and everything runs in a rollback-on-throw transaction the user initiated, but
   a crafted key can still inject clauses into the statement. Cheap hardening: allowlist
   columns against `pragma_table_info(<table>)` and reject unknown keys as
   `VALIDATION_FAILED` (which also turns newer-schema backups into a clean error instead
   of an incidental one).
4. **`restore()` ignores `schemaVersion`** — a backup from a future schema fails only
   incidentally (unknown column → rollback). An explicit
   `schemaVersion > CURRENT_SCHEMA_VERSION → VALIDATION_FAILED` is one line and gives
   the calm S47 banner deterministically.
5. **Exported `.fallbackbak` files in `documentDirectory` survive erase-all.** S48's
   copy promises everything "will be permanently removed from this device," and the full
   pre-erase dataset persists in the app's own Documents dir. Defensible (a user's backup
   is their escape hatch; "backup metadata" = `last_backup_at`, which dies with the DB) —
   but it is a product-meaning call the architect/human should confirm, not the builder.
6. **S45 renders a dangling "Last synced" with no time** when
   `sync.enabled && !lastSyncedAt && !lastError` (`app/settings/sync.tsx:98`) — a state
   that persists if the app dies mid-first-push. Spec copy is "Last synced 2 min ago" /
   "just now"; render the off-helper or nothing instead of a bare prefix.
7. **S01's `boot()` has no catch** (`app/splash.tsx:32-56`): if
   `repos.settings.get()` rejected (it throws by design when the singleton is missing —
   see blocking item 1's interaction), the splash hangs forever on an unhandled
   rejection. Wrap the body; on throw, route to `/recovery`.
8. **S47's restore-failure banner has no dismiss affordance** (spec S47 line 4185 lists
   one; `InlineRetryBanner` (M0) has no such prop). Minor fidelity gap; if it matters,
   it is an M0 component request, not something M1 may build around with raw UI.
9. **"Deletes every SecureStore key" is implemented as a hardcoded two-key list**
   (`src/db/lifecycle.ts:25`). Correct today (the app defines only `byo.baseUrl`/
   `byo.apiKey`; SecureStore has no enumerate API), but the list will rot silently if
   M6 adds a key. Worth a cross-referenced constant or an explicit note in M6's brief.
10. Dead/misdirected trivia: `createCycleStateAccessor` (`src/db/lifecycle.ts:181-183`)
    is exported and never used; `001_initial.ts:10` says `ensureSingletons` lives in
    `src/db/index.ts` (it lives in `lifecycle.ts`); `lifecycle.test.ts:42` test name
    says "a NEW tenure anchor day" while the assertion (correctly, per its own comment)
    accepts same-day equality.
11. **eraseAll ordering**: SecureStore keys are cleared before the DB file is deleted, so
    a failure between the two leaves secrets-gone/data-intact — strictly not "fully
    erased or fully intact." Accepted: SecureStore cannot join a SQLite transaction, key
    deletion is idempotent/re-runnable, and secrets-first is the safe direction for a
    destructive erase. The code comment argues this honestly.

### Judgement calls assessed (as asked by the brief)

- **Two-migration split**: defensible in purpose (F1 needs a real forward migration to
  test), but see note 1 — the chosen migration is the one migration in the repo that can
  fail on legal prior-version data, and the test's comment papers over it. Keep the
  split; add the dedupe guard and the honest fixture.
- **`ensureSingletons` after pure-DDL migrations**: clean. Tenure-anchor semantics are
  preserved (first `open()` == store creation date; idempotent on re-open — tested at
  `lifecycle.test.ts:28-40`; restore carries the anchor because `settings` is restored
  wholesale). The deviation from SCHEMA §9's literal "migration 1 … writes
  tenure_anchor_date" is functionally equivalent and well-documented in the migration
  header. Accepted.
- **Restore as one wrapping transaction instead of staging-schema-and-swap**: delivers
  §9's actual guarantee. SQLite rolls back the DELETE+INSERT batch atomically on any
  throw (proven by the malformed-file test at `backupRestore.test.ts:167-182`), and a
  process death mid-transaction is healed by journal rollback on next open — arguably
  safer than a file swap. Accepted as satisfying the pinned *guarantee*; the architect
  may want SCHEMA §9's mechanism sentence updated to match, so the docs and code do not
  appear to disagree.
- **`node:sqlite` test double**: sound. It is a real SQLite engine, so CHECK/FK/partial
  unique/upsert semantics are exercised for real — the cascade and constraint tests
  mean something (I re-verified the cascade outside the harness and got identical
  results). Where the double differs from `expo-sqlite` it is *stricter* (strict
  multi-statement rejection in `prepare`), which is the safe direction. No dependency
  added; never shipped. Accepted.
- **`repos.cycleState` additive field** (`src/db/index.ts:32`): a clean stopgap, not a
  contract violation in disguise — `ports.ts` is untouched, the addition lives in M1's
  owned file, every `Repositories`-typed consumer is unaffected, and both M1 and M2
  independently flagged the underlying port gap to the architect. One condition: before
  any *other* module consumes `repos.cycleState` (M2's F31 loop will want it), the
  accessor's type must be formalised into `src/types/ports.ts` via the architect change
  request both builders already raised — a cross-module type living in `src/db` would
  violate ARCHITECTURE §11.
- **The async test-double fix**: complete and genuinely regression-covered. All six
  methods are `async` (`expoSqliteTestDouble.ts:38-75`, with the rationale comment), and
  the suites exercise the rejection path directly: `.rejects.toThrow()` on constraint
  violations (`migrations.test.ts:80-87`, plus the CHECK-violation Result assertions in
  `repositories.test.ts:106-111`) would fail as call-site throws under the old bug.
- **F20 sync as honest-unavailable** (`src/services/sync/index.ts`): correct and
  honest given the frozen dependency set — the header documents precisely *why* neither
  transport is reachable (no JS bridge to the ubiquity container; no OAuth client id in
  `app.config.ts`'s extra), `isAvailable()` is `false`, failures are calm
  `NETWORK_UNAVAILABLE` (a legal `AppErrorCode`), and no F22-shaped hooks exist. S45
  still matches its spec: sync-off default, loading skeleton, and sync-on-failed with
  the verbatim warning banner all render (asserted in `sync.test.tsx`); the sync-on-
  healthy state is implemented but unreachable until a transport exists — acceptable
  for a P1 fast-follow, and vastly preferable to a fabricated "Last synced" lie. The
  contract gap is correctly escalated to the architect rather than resolved by adding a
  dependency. This needs an architect answer before F20 can ship; it does not block M1.

---

## Verified (what I checked and how)

- **Cascade split (SCHEMA §2.3)** — read the actual DDL: `xp_award.task_id TEXT
  REFERENCES task(id) ON DELETE SET NULL` (`001_initial.ts:120`), CASCADE on
  `step`/`day_log`/`off_day_mark`/`as_needed_use` (`:77,87,104,112`), sweep is a single
  `DELETE FROM task WHERE deleted_at IS NOT NULL` in a transaction on `open()` only
  (`lifecycle.ts:62-66,88`), FKs on (`client.ts:32`). Then **re-executed the migration
  DDL + sweep directly in `node:sqlite`, bypassing the module's harness**: after the
  sweep — step 0, day_log 0, off_day_mark 0, as_needed_use 0, `xp_award` 1 row with
  `task_id = NULL`, `SUM(amount)` unchanged. `achievement_unlock`/`cycle_record` have no
  task FK at all, so they cannot cascade by construction.
- **NULL task_id on restore** — `validateBackupEnvelope` is structural only;
  `applyBackupEnvelope` moves raw `SELECT *` rows column-by-column with no reference
  checking (`backupEnvelope.ts:105-131`); nothing anywhere inspects or rewrites
  `task_id`. The mandatory round trip (10 awards → delete → sweep → backup → eraseAll →
  restore → 10 NULL-task awards, lifetime XP 100) is a literal test
  (`backupRestore.test.ts:120-165`) and passes.
- **Tests run**: `npx jest src/db app/splash.test.tsx app/recovery.test.tsx
  app/settings/sync.test.tsx app/settings/data` → **10 suites, 52 tests, all pass**.
  `npx tsc --noEmit` → exit 2 with exactly 2 errors, both in `src/ui/__probe2.test.tsx`
  (M0's path, the known pinned-@testing-library breakage being fixed separately —
  excluded from M1 per brief; zero errors in any M1 path).
- **Probes run** (temp files, deleted after): (a) empty-tables envelope restore →
  destructive success + thrown settings read (blocking item 1); (b) duplicate whole-day
  v1 rows + migration 2 → `UNIQUE constraint failed` (note 1).
- **Erase-all**: order and guards read (`lifecycle.ts:115-139`); atomicity, SecureStore
  clearing (`byo.baseUrl`/`byo.apiKey` asserted), already-empty no-op, and fresh-anchor
  semantics all covered in `lifecycle.test.ts`. Blast radius: `fallback.db` +
  the two BYO keys + in-DB metadata only; nothing outside the app's own store is
  touched. S48 cannot fire without an explicit tap on the `danger` "Erase everything"
  button; both buttons disable while erasing; failure re-enables with the verbatim calm
  banner (`erase.test.tsx:91-108`).
- **Backup excludes secrets**: `BACKUP_TABLES` (`backupEnvelope.ts:26-38`) omits
  `entitlement` and both assistant tables; the BYO key never enters SQLite at all
  (SecureStore only); test asserts the written file's table set and the absence of
  `entitlement`/`byo.apiKey` strings (`backupRestore.test.ts:63-80`).
- **Migrations**: forward-only ordered runner, each migration + its `user_version` bump
  in one transaction (`migrate.ts:22-28`); failure-rollback test leaves
  `user_version = 0`; F1 older-version fixture (v1 → v2, data preserved, new constraint
  live) passes; `schema.sql` verified as a non-executed reference in sync with the
  cumulative migrations (diff = header comment + appended migration-2 index only).
- **Screens vs `ALLSCREENS_1.md`**: all copy in `src/features/data/copy.ts` diffed
  string-by-string against S01/S45/S47/S48/S50 spec blocks — verbatim, including both
  S48 origin variants and every toast/banner string. S48's two origin rules (Cancel →
  origin screen incl. hardware back intercept; success → S01 from both origins) match
  spec lines 4221-4248 and are test-asserted with both `from` values. S50 is calm
  (RefreshCw, no red, silent retry failure, no escalation), S01 has the three-way
  routing + ~400 ms minimum hold + indeterminate bar with reduced-motion degrade. S47
  covers default/no-backup/in-progress/failure/success states; erase row always
  present.
- **Hygiene**: no occurrence of "streak" in any M1 path (case-insensitive grep); no raw
  colour literal in any M1 path (hex/rgba grep); SQL statements exist only under
  `src/db/**` (repo-wide grep); no dependency added; `git show --stat` of both wave-1
  commits shows no file outside the union of M0/M1/M2 owned paths, and M1's own closing
  commit touches only M1-owned files.
