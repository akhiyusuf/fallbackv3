# 27. Time zones and clock changes across the stored data (round 2)

Area: `src/lib/date.ts`, `src/domain/retention.ts`, `src/domain/occurrence.ts`, with the stored
data paths in `src/queries/internal.ts` (outside my owned files: bugs reported, not edited).
New file: `src/domain/edge.timezones.test.ts`. Result: **30 tests, all passing** (4 of them are
`it.failing` bug tests, which pass while the bug is present). `tsc --noEmit` has no errors in
the new file. No source file was changed.

## Bugs found (not fixed: outside my owned files)

Two root causes in `src/queries/internal.ts`. Each has a failing test (`it.failing`) in the new file.

**Bug A. A habit's creation day is re-read in the current zone.**
- Cause: `creationLocalDate` (`internal.ts:34`) runs `toLocalDate(new Date(task.createdAt))` on the
  zone the device is in when the screen is read, not the zone it was created in. The stored
  `createdAt` is an absolute instant, so travel moves the first due day.
- Effect (Fiji UTC+12 to Honolulu UTC-10): a habit created 00:30 on 20 Nov in Fiji is read in
  Honolulu on the 20th as `[19 Nov (missed), 20 Nov]`. A missed day appears that the person never
  had a chance to log. The reverse trip (created 23:30 on 19 Nov in Honolulu, read in Fiji) moves
  the first day to the 20th, so the creation day vanishes.
- Failing tests: "habit created 20 Nov in Fiji must not show a missed 19 Nov after travelling to
  Honolulu"; "habit created 19 Nov at 23:30 in Honolulu must keep 19 Nov as its first day in Fiji".
- Fix (suggested): store the device-local creation day when the task is created (a column, or a
  `createdDay` field written at creation), and read that in `creationLocalDate` and in
  `recordStartDate` (`internal.ts:347`). Do not re-derive it from `createdAt`.

**Bug B. A deletion day is re-read in the current zone (the record boundary moves).**
- Cause: `deletionDay` (`internal.ts:279`) is `toLocalDate(new Date(task.deletedAt))`, computed
  at read time. `deletedRecordOf` (`internal.ts:283`) keeps "days before the deletion day, and the
  deletion day only if logged". The deletion-day rule ("deleting a habit you have not done yet
  today never counts that day as missed") is therefore broken by travel.
- Effect: a habit deleted at 23:00 on 20 Nov in New York (04:00Z on 21 Nov) gets a settled
  missed 20 Nov when read in Auckland (UTC+13), because the deletion day has moved to the 21st.
  The reverse (deleted 00:30 on 21 Nov in Auckland, read in New York) drops the real missed 20 Nov,
  because the deletion day has moved onto the 20th.
- Failing tests: "the same deletion read in Auckland must not add a missed 20th"; "deleted at
  00:30 on 21 Nov in Auckland must still count the missed 20th when read in New York".
- Fix (suggested): store the device-local deletion day when the habit is deleted (write it with
  `softDelete`, `src/db/repositories/taskRepository.ts`), and use that in `deletionDay`. Keep the
  instant for the 30-day purge (see below).

**Bug C (low likelihood). A deletion "in the future" counts today as a settled missed day.**
- Cause: after a clock set back, `deletedAt` is later than today. `resolveDeletedTaskRecord` /
  `deletedRecordOf` read `o.date < day` with `to` capped at today, so today's unlogged occurrence
  counts as missed although the day has not ended.
- Failing test: "a habit deleted 'in the future' must not count today as a settled missed day"
  (`New York`, deletion stamped 23:00 on 20 Nov, today reset to 19 Nov, record shows a missed 19th).
- Fix (suggested): in `deletedRecordOf`, exclude `o.date >= today` when `day > today`.

## Tests added (grouped, one line each)

**Calendar arithmetic in 11 zones (child Node process, TZ set, every day 2025 to 2027)**
- Fiji, Honolulu, Auckland, New York, Santiago, Kiritimati, Pago Pago, Chatham, Kathmandu, Lord Howe, London: round trip, addDays, diffDays, weekday, week and month ends, addMonths agree with the zone-free `dateMath`: pass (11 tests)
- Local midnight of every day maps back to its day, and one millisecond earlier to the day before (Auckland, ~730 days): pass. The naive UTC slice (`iso.slice(0, 10)`) differs from the local day on 300+ days in Auckland, which is why `occurrence.ts` warns against it: pass
- Santiago: the nonexistent DST-start midnight still maps to its calendar day: pass

**Travel: creation-day bound (real `resolveTaskOccurrences`)**
- Read in Fiji, the habit is first due on its creation day (20 Nov), no fabricated 19th: pass
- A log written on the creation day survives a trip to Honolulu (logs are local dates): pass
- BUG A (two tests, `it.failing`): see above

**Deletion day (real `resolveDeletedTaskRecord` with the fake repos)**
- Deleted at 23:00 on 20 Nov in New York: the record has the missed 19th and no 20th: pass
- Deleted at exactly local midnight (00:00:00.000) in New York, Fiji, Kathmandu, Kiritimati: the deletion day is that calendar day: pass
- BUG B (two tests, `it.failing`) and BUG C: see above

**30-day Recently deleted window (`retention.ts`)**
- Purge instant is a function of the instant only (the same UTC instant from New York midnight and Fiji midnight): pass
- `daysLeft`: 30 at deletion, 1 on the last day, 0 at and after the purge instant: pass
- Spring forward (New York, 8 Mar 2026): 720 absolute hours from 1 Mar ends at 01:00 EDT on 31 Mar, one hour later than midnight, never shorter: pass
- Fall back (New York, 1 Nov 2026): 720 absolute hours ends at 23:00 on 18 Nov locally, one hour before the calendar 30th day starts. Pinned, see the trade-off below: pass
- Deletion stamped ahead of a clock set back a day: 30 days left, not purged: pass

**DST days in the stored record (real `resolveTaskOccurrences`, New York, all of 2026)**
- A daily habit has exactly one occurrence per calendar day across the fall-back (25-hour day) and spring-forward days, in order, no gap, no duplicate: pass
- Control: the record reads the same days in Fiji and New York when no stamp sits near midnight: pass

**Device clock set back a day**
- A log dated after the reset "today" stays out of the Today and record reads until its day arrives: pass

## Trade-off (documented, not changed)

- **The 30-day window is 720 absolute hours, not calendar days.** Across a fall-back the last
  wall-clock day ends an hour early (New York: a deletion at local midnight on 20 Oct is purged at
  23:00 on 18 Nov). Across a spring-forward it ends an hour late. The existing
  `retention.test.ts` pins this on purpose ("pure 24 h steps, no local-calendar drift"), so I left it.
  If the human wants calendar-day semantics, change `purgeCutoff` and `daysLeft` together.
- A deletion stamped exactly at `removeAt` reads `daysLeft` 0 while `purgeCutoff` is still equal
  to it, so the item is purged one millisecond later. Not user-visible; not changed.

## Checks with no finding

- `lib/date.ts` (`toLocalDate`, `parseLocalDate`, `addDays`, `addMonths`, `diffDays`, `eachDay`,
  week and month ends) is correct in every zone tested, including 30-minute and 45-minute offsets
  and the midnight-at-DST zones (Santiago). date-fns' `setDate`-based arithmetic keeps the local
  wall clock, so a 23- or 25-hour day never shifts the calendar date.
- `occurrencesBetween` and `isDue` take no clock and no zone, so they cannot shift on DST.
- Logs, off-days and `endedOn` are local dates written once, so a trip does not move them.
- `purgeCutoff` and `daysLeft` are pure instant arithmetic: no zone reads.
- Pacific/Apia skipped 30 Dec 2011 (a whole calendar day does not exist in that zone). Outside the
  tested range and before the app existed, so not tested. A user typing that date could never enter it.

## Not tested (needs a real phone)

- A real midnight rollover with the app open, and a real time-zone change while the app runs (the
  zone is read on each call here, but the app's `today()` cache and the query invalidation after a
  zone change were not exercised).
- The notification schedule across a zone change (`src/services/notifications/schedule.ts`).
- The Recently deleted screen's `daysLeft` label at the 30th day in a real zone change.

## Notes for the main session

- `jest` sandboxes `process.env`, so zone-dependent probes run in a child Node process with TZ set,
  transpiling the real `src/` modules (same harness as `edge.schedule.test.ts`). The child loads the
  real `src/queries/internal.ts` with `src/queries/testSupport/fakeRepos.ts`, with `expo-crypto`
  stubbed. If `internal.ts` gains a native import, the probe needs another stub.
- `internal.ts` was changing while I worked (a `floor` parameter appeared on the resolvers). The
  tests call only the public resolvers, whose signatures did not change, so they still apply. Line
  numbers above are as of this run.
