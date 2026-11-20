# 16. Scheduling and date math (WHEN things are due)

Area: `src/domain/occurrence.ts`, `src/domain/dateMath.ts`, `src/lib/date.ts`, `src/features/task/cadenceLabel.ts`.
New file: `src/domain/edge.schedule.test.ts` (domain project, 63 tests, all passing; `tsc --noEmit` clean for these files).

## Bug fixed

1. **Duplicate weekdays repeated in the cadence label.** `weekdaysLabel` in `src/features/task/cadenceLabel.ts` (the `const sorted` line) read `[1, 1, 2]` as "Mon/Mon/Tue". Fix: de-duplicate with `new Set` before sorting. Now "Mon–Tue". Test: "duplicate weekdays do not repeat in the label".

## Known gaps (not fixed; outside this area's owned files)

2. **A course whose end date is before its start date is accepted on save.** `validateTaskDraft` (`src/domain/validation.ts`) checks presence only. Domain behaviour is safe: such a course is never due and the range does not loop. The Add Course screen guards it (`app/add/course.tsx:60`, "The end date is before the start date."). I did not verify the edit path. Written as `test.failing(...)` in the new file, so it turns red once the domain enforces it.
3. **No range checks on cadence fields.** `validateTaskDraft` does not check `dayOfMonth` in 1..31 or yearly `month` in 1..12. A value of 32 is clamped to the month's last day and labelled "32nd". Harmless only if the UI limits the picker (not verified here).
4. **"Every N days" does not exist.** `CadenceKind` is a closed set (daily, specific-weekdays, weekly, bi-weekly, monthly, bi-monthly, yearly), so this is not a gap in the code. Bi-weekly is the nearest cadence.

## Tests added (grouped)

**Cadence kinds across boundaries**
- daily crosses Dec 31 to Jan 1 and Feb 28 to Feb 29 with no gap: pass
- Sunday-only rhythm crosses the year end: pass
- bi-weekly with a weekday different from the anchor alternates on that weekday: pass
- bi-weekly keeps parity across the year end: pass
- monthly 31st is due once per month in 2025, short months on their last day: pass
- monthly 30th lands on Feb 29 (2024) and Feb 28 (2025): pass
- monthly 29th: Feb 2028 due on the 29th, Feb 2027 on the 28th: pass
- monthly anchored after its day does not fire before the anchor: pass
- bi-monthly keeps parity across the year end: pass
- bi-monthly parity over many years: pass
- bi-monthly 31st clamps short months and keeps parity: pass
- yearly Feb 29 across the 2100 century rule: pass
- yearly Feb 29 on the 400-year leap (2000): pass
- yearly anchored later in its year does not fire earlier: pass
- as-needed routine never due, even with a creation bound: pass

**Creation-day boundary**
- created 23:59 is due today, never a missed yesterday: pass
- monthly-15th created on the 16th does not invent a Jan 15 miss: pass
- weekly routine due on its creation day is due: pass
- backdated one-off event keeps its own date: pass

**Time zones (real Date, run in a child Node process with TZ set)**
- America/New_York: 23:30 local (04:30Z next day) is the local creation day: pass
- Pacific/Auckland: 00:30 local (11:30Z previous day) is the 20th, so the 19th is not a fake miss: pass
- America/New_York fall-back day (25-hour day): one occurrence per calendar day: pass

**Events, courses, to-dos**
- one-off event on 2024-02-29 is due only that day: pass
- repeating event follows its cadence and honours the creation bound: pass
- course with end before start is never due and does not loop: pass
- single-day course is due once: pass
- course endedOn stops inclusively: pass
- course with no cadence is never due: pass
- to-do and Note never due, even with a cadence: pass
- validateTaskDraft rejects end-before-start course: `test.failing` (gap 2)

**Ended tasks**
- endedOn is due, the day after is not: pass
- repeating event ended on a day is due on nothing after: pass
- endedOn before the creation bound leaves nothing due: pass

**Leap years and arithmetic (lib/date and dateMath)**
- Jan 31 + 1 month clamps to Feb 29 (2024) and Feb 28 (2025), both modules: pass
- Feb 29 + years clamps to Feb 28, then returns on 2028-02-29: pass
- day steps across the leap day and year end: pass
- day differences across the leap day (367 days from 2024-02-28 to 2025-03-01): pass
- month and week ends on 2024-02 and 2100-02: pass
- known weekdays for 2024-02-29 and 2028-02-29: pass
- dateMath and lib/date agree with date-fns for every day 1999-12-31 to 2101-01-01 (about 36,500 days), and for month steps from the 29th to 31st: pass (about 4 s)

**DST (America/Santiago, child process)**
- DST-start week (2024-09-08, midnight does not exist) enumerates each day once: pass
- day steps and differences across the missing midnight: pass
- nonexistent midnight maps to the right day, weekday (Sunday) and week: pass
- daily routine across the DST-start week: one per day: pass
- DST-end week (April, 25-hour day): pass

**Per-step dueWeekdays**
- Wednesday-only step due on Wed only; null step due every occurrence: pass
- step never shows on a day its parent is not due: pass
- weekly parent: null step due only on the parent day: pass
- empty dueWeekdays list never shows (no crash): pass
- one-off event with a Monday-only step: pass

**Long ranges**
- daily over 30 years: 46 ms, count exact: pass
- specific-weekdays over 30 years: 62 ms: pass
- inverted range and range before the creation bound: empty and fast: pass

**Typed date strings (features/task/dateValidation)**
- Feb 29 accepted only in leap years (2000, 2024, 2028; rejected 2025, 2100): pass
- impossible days and malformed shapes rejected: pass

**Cadence labels**
- one label per cadence kind (for example "Routine · Monthly · 1st", "Routine · Yearly · Feb 29"): pass
- ordinals for 1 to 31, including 11th to 13th and 21st to 23rd: pass
- all 12 yearly month abbreviations: pass
- full week "Mon–Sun", pair "Sat–Sun", wrap "Mon/Sun", single "Wed": pass
- unsorted weekdays sorted in the label: pass
- duplicate weekdays do not repeat: pass (was failing, fixed above)
- event, course, to-do and as-needed labels: pass
- no label contains an em dash: pass

## Checks with no finding

- `isDue`, `occurrencesBetween` and `dueIdealStepIds` do not touch the wall clock or `Date`, so DST cannot shift them. Creation-day bound is supplied as data (`toLocalDate(new Date(createdAt))`, `src/queries/internal.ts:34`). Verified by the NY and Auckland cases.
- `isMonthDay` (`occurrence.ts`) uses `new Date(y, m, 0)` for the last day of the month. Correct for every month tested.
- The bi-weekly and bi-monthly parity is anchored to `anchorDate`, not to the first matching weekday. Consistent with the existing tests.
- Ordinal suffixes are correct for 1 to 31.

## Observed but not mine

- During one full domain run, four tests in `src/domain/edge.numbers.test.ts` (another agent's file) were failing: the "Counted days" expectation, two badge tests (showing-up-7 with a missed day, and Comeback two days after the miss), and the 30-day showing-up test. Not investigated.
- Jest sandboxes `process.env`, so assigning `process.env.TZ` in a test has no effect on `Date`. The zone tests therefore spawn a child Node with `TZ` set and transpile `src/` with the repo's `typescript`. This runs the real modules.

## Not tested (needs a real phone or the app running)

- A real midnight rollover with the app open, and a device clock or time zone change while the app runs (query-layer `resolveTaskOccurrences` and `today()` were not exercised here; no query-layer file was written).
- Notification schedule timing across DST (`src/services/notifications/schedule.ts` was not in this area).
- A user setting a course end before start through the edit screen (gap 2).
