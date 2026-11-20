# 47. Backup and restore with every column (edge campaign, round 4)

Test file: `src/db/__tests__/edge.backupAllFields.test.ts` (10 tests, real `node:sqlite` behind the file-backed
expo-sqlite double). Result: 10 of 10 pass. With the two source fixes below reverted, 4 of them fail (the older-envelope
restores and both folder-picker checks), so the tests do catch the bugs.

Command: `npx jest src/db/__tests__/edge.backupAllFields.test.ts --selectProjects app --maxWorkers=1 --testTimeout=60000 --forceExit`
Related suites still green: `backupRestore`, `edge.storage`, `retiredDays`, `upgradePaths`, `recentlyDeleted`,
`offerBackupFile` (125 of 125). `npx tsc --noEmit` has no errors in `src/db/**` or `offerBackupFile.ts`. Lint: no errors.

## Tests

**Every column of every backed-up table (4)**
- Seed: every column of the 12 backed-up tables holds a value that is not its default (ended and deleted habits with
  local days, a deleted habit with `deleted_on` a day after its UTC day, retired days, pushed logs (`moved_to_date`),
  an off mark for one habit and one for the whole day, as-needed uses with a NULL marker, XP awards including a NULL-task
  one, badges, two cycle records (one with NULL consistency), cycle state, three widget configs (one with NULL task),
  settings with every field changed). Test asserts each column is covered. (1)
- The backed-up table list equals the whole schema minus the pinned exclusions (entitlement, assistant tables), so a new
  table has to be decided on. (1)
- Backup, erase, restore: every field of every row of every table is identical (columns read from `PRAGMA table_info`),
  the file holds exactly the 12 pinned tables and no chat text or entitlement column, and the record read
  (`resolveRecordOccurrences`) is the same before and after. (1)
- A backup over 5 MB (20 habits, about 8 MB of JSON with multi-byte text) round-trips exactly. (1)
- The file name is `fallback-backup-<local day>.fallbackbak`, with the local day of the backup instant. (1)

**Older envelopes restored into a schema 9 store (2)**
- Schema 7 and schema 8 envelopes, hand-built with only the columns those versions had (checked against the real
  migrations' `PRAGMA table_info`). The store is upgraded to 9 first; the record is read; the file is restored after an
  erase. Checks: `created_on` and `deleted_on` derived as migration 9 derives them, `ended_on` NULL for v7 (kept for v8),
  `retired_day` empty for v7 (kept for v8), and the record read after restore equals the record read before. (2)

**Backup file through the Android folder picker (3)**
- Real `backup()` file, then `offerBackupFile` with the real native deps and mocked SAF calls: the saved string equals the
  backup string and its UTF-8 bytes, with non-ASCII habit names. Then the copy restores after an erase. (1)
- A non-ASCII file name (`fallback-backup-café-日本`) keeps its characters; the saved content is byte-identical. (1)
- Source guard: the restore picker does not set `copyToCacheDirectory: false`, so restore reads a `file://` path. (1)

## Bugs found and fixed

1. **A restored schema 7 or 8 backup left `created_on` and `deleted_on` NULL.** Migration 9 fills both from the instants,
   but the restore only inserted the columns the file had. The record then re-derived the day from the instant in
   whatever zone the phone was in later, which is the drift migration 9 exists to stop. Fix:
   `src/db/backupEnvelope.ts:219` (`withLocalDays`), applied at `src/db/backupEnvelope.ts:240` before the column
   validation and the transaction. A value the file already carries is kept.

2. **The folder copy was saved as `….fallbackbak.json`.** `backupFileBaseName` only dropped `.json`, but the backup is named
   `.fallbackbak`, so the folder's provider added `.json` on top. The file still restored, but the name was wrong.
   Fix: `src/features/data/offerBackupFile.ts:42` drops `.fallbackbak` as well (and `.json`), so the folder gets
   `fallback-backup-<day>.json`. `safeDecode` (line 48) keeps a stray `%` in a name from throwing; before, that path
   returned `failed`.

## Left for the main session (not fixed here)

- **Restore reads a `content://` URI only through SAF tree URIs.** `restore()` passes its URI to the legacy
  `readAsStringAsync`. On Android, `FileSystemLegacyModule.kt:206` reads `content://` only when `isSAFUri`; any other
  `content://` URI throws "Unsupported scheme". The app is safe today: `DocumentPicker.getDocumentAsync` copies the file to
  the cache by default (`copyToCacheDirectory` defaults to true), so restore gets a `file://` path. Keep that default, or
  copy the file before `restore()` if it is ever turned off.
- **`last_backup_at` in the file is the value from before the backup.** `backup()` builds the envelope, then writes
  `last_backup_at` into the live row. A restored file therefore shows the earlier backup time. This is probably fine,
  but it is a product call.
- **Zone travel is not exercised in-process.** Jest sandboxes `process.env`, so a `TZ` set inside a test never reaches
  `Date` or SQLite (the same finding as `src/domain/edge.timezones.test.ts`, which uses a child process). The tests take
  every expected local day from the app's own helper, so they hold in any zone: run
  `TZ=Pacific/Kiritimati npx jest src/db/__tests__/edge.backupAllFields.test.ts ...` to try one. The "same record after a
  zone change" claim rests on the stored day, which the record reads in preference to the instant. A child-process check
  would prove it directly; not written.
- The Storage Access Framework naming is modelled, not verified: the mock assumes a JSON name keeps its `.json` and other
  names get one appended. Check the saved file name on a phone.
- Assistant chat history is still not backed up (already reported in round 1, area 19). Unchanged.

## Could not test here (needs a real phone)

- Real `createFileAsync` naming and whether the saved `.json` file opens after a restart.
- The Downloads folder and other providers (Drive, USB), and whether a plain `content://` URI reads through the legacy API.
- The real document picker (its copy to cache, and the name it gives the copy).
- Restore timing for a large store on a phone (the 8 MB case takes under a second in Node, which is not a phone).
- Disk-full during the write of the backup file: the double cannot fail a write, so only the `.tmp` path is covered by reading the code.
