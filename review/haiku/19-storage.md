# 19. Storage on real SQLite (edge-case campaign, area 19)

Test file: `src/db/__tests__/edge.storage.test.ts` (42 tests, real `node:sqlite` behind the file-backed
expo-sqlite double, same harness as `retiredDays.test.ts`). Old schemas are built by running the real
migration SQL from `src/db/migrations/`, not hand-written DDL.

Result: 42 of 42 pass in the full `src/db` run (214 of 214 tests across the 15 db files).

Command note for the main session: `--selectProjects` takes a list, so `npx jest --selectProjects app <path>`
treats the path as a project name and runs the whole app project. Put the path first:
`npx jest <path> --selectProjects app --maxWorkers=2 --forceExit`.

## Tests

**Upgrade from every older version (8)**
- v1, v2, v3, v4, v5, v6, v7 each open at schema 8 with the same realistic data: a running routine with a month of
  logs (done, fallback, skip, blank), a to-do with a note, a soft-deleted habit, XP per done day, a whole-day off mark,
  an achievement, emoji and newline in a name. Tasks, logs, XP total, settings and the deleted habit all survive.
  The to-do is a Note after upgrade only for v1 to v4 (migration 5 rule). (7 tests)
- A second launch after the upgrade changes nothing. (1)

**Newer app version (1)**
- A store at schema 9 (with an extra column) is refused calmly and its data and version are left unchanged. (1)

**Half-applied migration (2)**
- A v7 store with a leftover table that migration 8 needs to create: the whole migration rolls back (no `ended_on`
  column, version stays 7, data intact), and the store reports `corrupt`. (1)
- Once the obstacle is removed, a later `open()` on the same module instance reaches ready. (1)

**Backup (3)**
- 300 tasks with steps and 43,800 logs (3 years for 40 habits): round-trips; timing printed. (1)
- Names with emoji (including a ZWJ family), quotes, CRLF and LF newlines, backslashes, a tab, non-breaking space,
  Arabic, Japanese and a 4,000-character name come back exactly after erase and restore, including notes. (1)
- The BYO key, the endpoint, the sync error and the entitlement never appear in the backup text. (1)

**Restore of a damaged or foreign file, refused without touching current data (14)**
- Truncated JSON. Not a backup (object, array, `null`). `tables.task` is an object instead of an array.
- Wrong type: `doses_per_day: "many"`. Wrong type: `name: 42`.
- Duplicate task ids. Day log pointing at a task that is not in the file.
- Negative XP amount. Fractional XP amount.
- Settings singleton missing. Schema version newer than the app. A column name that looks like SQL injection.
- Missing file. A good backup from an older schema (no `retired_day` table) restores. (14 tests, counting the
  wrong-type pair and the XP pair separately)

**Erase all data (1)**
- Leaves a usable empty store at the current version with defaults, and clears every SecureStore key. (1)

**Settings persist (2)**
- Every field in `Settings` (theme, accent via `accent_ext`, onboarding, tenure anchor, cadence, all nine notification
  flags and digest time, assistant language and voice, all three widget configs, sync state, last backup) is written,
  reopened in a fresh launch and read back exactly. (1)
- A fixed widget whose task is deleted for good falls back to no task; the other fields survive. (1)

**Concurrent writes through the serial proxy (5)**
- 200 log writes fired at once all land. (1)
- 50 racing taps on one occurrence leave one row holding the last state. (1)
- 20 settings patches fired together each keep their change (no lost update). (1)
- Racing XP awards for one day count once; a backup taken alongside 20 inserts succeeds. (1)
- A backup taken while logs and XP awards are being written contains no XP award whose day log is missing. (1)

**Busy and locked database (2)**
- A lock released within the retry wait is recovered from. (1)
- A lock held longer than the single retry becomes a calm `WRITE_FAILED`, not a crash. (1)

**Unique constraints under racing writes (3)**
- One log per task per date: a second raw insert on the same pair is refused. (1)
- Ten racing whole-day off marks for one date leave one row. (1)
- A v1 store holding two whole-day marks for one date keeps one after migration 2. (1)

**Restore cannot bypass uniqueness (1)**
- A backup file carrying a second whole-day mark for one date is refused. (1)

## Bugs found and fixed

1. **A store written by a newer app opened as `ready`.** `runMigrations` treated a higher `user_version` as "nothing
   to do" and the app then read and wrote a schema it does not know. Cause: no guard in `src/db/migrate.ts`.
   Fix: `src/db/migrate.ts:23-28` returns an error for a version above `CURRENT_SCHEMA_VERSION` without touching
   the file. `open()` then reports `corrupt`, the calm S50 route, and nothing is written.
   See the S50 note under "left for the main session".

2. **A failed open leaked a connection.** `openInternal` opened a connection, failed to migrate, and returned
   without closing it, so each retry added another handle. Fix: `src/db/lifecycle.ts:111` closes it on the failure path.

3. **A backup could be a torn snapshot.** `buildBackupEnvelope` read the eleven tables one proxy call at a time, so a
   log or XP write queued in between could land in one table and not the other. The test found XP awards in the
   file with no day log for their date. Fix: `src/db/lifecycle.ts:191` reads every table inside one
   `withTransactionAsync` on the proxy, so the reads share one instant.

4. **Restore accepted values of the wrong type.** SQLite stores text in an INTEGER column without error, so
   `doses_per_day: "many"` or `name: 42` restored "successfully" and would be read back as garbage.
   Fix: `src/db/backupEnvelope.ts:178-185` checks each value against the column's declared type (INTEGER must be
   a whole number, REAL a finite number, TEXT a string; NULL always allowed) before any write.

5. **Restore accepted negative and fractional XP.** `xp_award.amount` has no CHECK constraint, so a damaged file could
   pull lifetime XP below zero. Fix: `src/db/backupEnvelope.ts:144` (`NON_NEGATIVE_INTEGER_COLUMNS`, also
   `day_log.doses_completed`) and the integer check in the type rule, `backupEnvelope.ts:178`. Both refuse the file.

6. **Busy retry could never fire for native SQLite errors under jest.** `runWithBusyRetry` tested
   `e instanceof Error`, which is false for errors thrown by `node:sqlite` from another JS realm (verified). So a
   locked database was never retried in tests. Fix: `src/db/client.ts:63` reads the `message` structurally. The
   "lock released within the retry wait" test now passes. Real-device impact is unverified (see below).

Also added to the test double: `__read` and `__write` helpers in `src/db/testSupport/fileSystemTestDouble.ts`
(test-only). These edits were picked up by an earlier checkpoint commit (`925a05f`); the other changed source files
in `src/db` are not committed.

## Left for the main session (not fixed here)

- **S50 offers "Reset app data" for every open failure.** `open()` maps a migration failure, a newer-version store
  and any thrown error during open (for example the file being locked at launch) to `corrupt`, which shows S50 with
  reset. A user who taps reset loses data that was intact. Consider a separate status for "newer app version" and
  "transient open failure" that does not offer erase. The `corrupt` route is in `src/db/lifecycle.ts`; the screen
  is `app/recovery.tsx`.
- **One busy retry, 150 ms.** A lock held longer is a `WRITE_FAILED` (pinned calmly by a test). Whether expo-sqlite
  sets a busy timeout on the phone was not verified. Needs a device check, or a longer bounded retry.
- **AI assistant history is not backed up.** `assistant_conversation` and `assistant_message` are not in
  `BACKUP_TABLES` (`src/db/backupEnvelope.ts`), matching the pinned list in `docs/SCHEMA.md` §9. A restore on a new
  phone loses chat history. Product decision, not changed.
- **`xp_award.amount` has no CHECK in the schema.** Live writes are not guarded at the database, only restore is
  (fix 5). Defence in depth would need a table rebuild migration; not done.
- **Full-scale backup not measured.** Measured: 300 tasks and 43,800 logs back up in 341 ms (10.7 MB) and restore
  in 2.3 s on this machine. A full three years for 300 tasks (about 330,000 logs, roughly 80 MB) was not run.
  Extrapolating linearly is an estimate only, and phone speed is unknown.
- Other agents' type errors in `src/features/today/edge.today.test.tsx` appear in `npx tsc --noEmit`. Not in my area.

## Could not test here (needs a real phone)

- Real expo-sqlite on Android: WAL file behaviour, its busy timeout, behaviour when the app is killed mid-write.
- The real backup file and the OS share sheet, and whether the saved `.fallbackbak` file is readable after a restart.
- Restore on a phone with a large real store (timings above are from Node, not the device).
- The S50 copy and the reset sheet in a real newer-version or corrupt case.
- Storage pressure and disk-full behaviour (the backup write-failure path is not simulated; the double cannot fail a write).
