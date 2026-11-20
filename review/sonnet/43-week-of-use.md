# 43 - A week of real use through the screens (Sonnet, round 4)

## Summary
One test file, `app/edge.weekOfUse.test.tsx` (5 tests, all pass: 1 week-long journey and 4 `it.failing` that each pin one bug). It runs the real route files and root layout (`renderRouter`), the fake repositories and a movable clock, from Monday 13 Jul to Sunday 19 Jul 2026 for one person with: Stretch (daily, ideal + fallback), Gym (Mon-Fri 07:00, two ideal steps, fallback), Antibiotic (a course, 3 doses a day, 13-22 Jul), Team sync (weekly event, Tuesdays), Meditate (as-needed), and two to-dos. Midnight passes with the app open (the shell's 60 s rollover).

Every expected value was worked out by hand from the rules (listed at the top of the test) before the first run, and is written next to its check. Checks are soft: each is a row (day, moment, what, expected, seen); the table below is that dump. **180 value checks, 8 differ.** All differences are the bugs below; everything else matched on the first value I derived by hand (percent, "x of y days", counts, order, strips, XP, level, badges, reminders), once two mistakes of my own were fixed (the rollover wait was 31 s but the app checks every 60 s, so it was my clock; a wording change by another agent, see Notes).

## Bugs (each has an `it.failing` in the file)
- **B1 Routines day picker goes stale after midnight** (`src/features/browse/RoutinesBrowseScreen.tsx`, `useState<Weekday>(todayWeekday)`). The tab stays mounted, so the picker keeps the weekday of the day the screen was first rendered. Opened on Monday, left in the background, on Wednesday it reads "Due Monday: Gym, Stretch", Wednesday's Gym is not marked "Due", and on Saturday "Due Friday: Gym" while Gym is not due Saturday. Tapping today's circle fixes it (the second row of each pair below passes). Fix: reset the selection when the date changes (key the state on `today()`), or derive it (`selected ?? todayWeekday`).
- **B4a / B4b / B4c Doses on the task page never celebrate.** `onDoseChange` in `app/task/[id]/index.tsx` (about line 177) only calls `logDose.mutateAsync`; it never calls `logFeedback` (it ignores the `badgesUnlocked` and `levelUp` the write returns). In the week: Friday's third dose earned **Comeback** (stored with date 2026-07-17, shown on the Achievements grid) and Saturday's first dose took XP from 98 to 104, **Level 2** (Today row says Level 2), and neither pop-up ever appeared; only First day and Safety net (earned by Stretch and by a Gym step) were shown. A person who only logs their course through its page would first learn about a level on the Achievements screen. Fix: run `logFeedback` (or at least the celebration push) with the result of `useLogDose`, as `onToggleStep` does. The same gap exists, I did not test it, for the day-log popover (`DayLogSheet.onChange`) that logs a past day. B4a is the Comeback row, B4b the level row, B4c the whole-week list.

## Findings, no change made
- Today's ring and its line can look at odds on a short record. Wed 08:00 reads 83% beside "2 of 2 days in the last 30" (sum of day fractions 1.67 over 2 days, x is rounded to a whole day); Fri 08:30 56% beside "2 of 3 days"; Fri 08:40 78% beside "2 of 3". They agree to within half a day (the test's `agrees` rule), which is as close as a whole number can get, but a reader will do 2/2. The Progress screen shows the honest "about 1.7 of 2" (weighted). Wording for the human; not changed.
- Ticking one of two Gym steps, or logging one dose of three, is a Fallback by the auto rule: Today shows "Fallback done", counts as showed up, awards 6 XP and can earn Safety net / Comeback, and the third dose or second step tops it up to ideal. That is the documented rule (F3, F12), but a person who takes dose 1 of 3 at 14:00 sees the card turn blue "Fallback done" for the rest of the day, and forgetting doses 2 and 3 on Tuesday (Antibiotic) leaves the day as a showed-up fallback, never a miss. Worth a look from the human; the tests pin the current behaviour.
- Safety net was earned on Monday by the first Gym step (a fallback by rule), not by a button the person called Fallback.
- Reminders: nothing wrong found. Each late-evening re-arm armed exactly the next day's pending habits (Tue: Stretch, Gym, Antibiotic dose, Team sync; Wed: three; Thu; Sat; Sun adds "Antibiotic is ending soon" on 19 Jul, 3 days before 22 Jul), nothing for the rest of the day, Gym back after the restore, Gym absent while deleted, Stretch absent after it ended.
- The stat card's name changed under me ("Showing up" / "Consistency", another agent's wording pass); the test accepts either (the words are assembled in two pieces so a text replace over the repo cannot rewrite them). The Restored toast also changed from curly quotes to `Restored "Gym".` mid-run; compared with the quotes and the full stop normalised.
- Not a bug but a trap for tests: the rollover is 60 s; a test that jumps the clock and waits 31 s sees yesterday's ring.

## What I could not test (needs a real phone or is outside the fakes)
Real notification delivery and Android exact alarms (only what `scheduleNotificationAsync` is asked for is checked, with `Date.now()` pinned by the fake clock), the app killed overnight (the repairs and XP heal on launch), time zones (clock is the machine's), the OS back button (covered by report 26), animation and sound timing (pop-ups appear after `advance(3000)`), and the widget.

## How to run
`WEEK_JSON=/some/path.json npx jest app/edge.weekOfUse.test.tsx --selectProjects app --maxWorkers=1 --testTimeout=600000 --forceExit` (about 20 s; the JSON is the table below). `npx tsc --noEmit` is clean for the file.

## The week, day by day
Legend: ok = seen equals expected. Codes in week strips: I ideal, F fallback, O off day, X missed, o not logged yet, - not due; seven characters, oldest first, today last.


### Mon 08:00  open the app, nothing logged yet

| Check | Expected | Seen | |
|---|---|---|---|
| Today list and order | ['Stretch: open', 'Gym: open', 'Antibiotic: open'] | same | ok |
| Today done count | 0 of 3 | same | ok |
| Showing up ring | No data yet | same | ok |
| "x of y days in the last 30" line | No data yet | same | ok |
| ring and line agree (to the rounding of x) | True | same | ok |
| Level row on Today | Level 1 | same | ok |

### Mon 08:10  Stretch: Done

| Check | Expected | Seen | |
|---|---|---|---|
| pop-ups after the first log | ["You've reached First day."] | same | ok |
| Today list and order | ['Stretch: I', 'Gym: open', 'Antibiotic: open'] | same | ok |
| Today done count | 1 of 3 | same | ok |
| Showing up ring | 100% | same | ok |
| "x of y days in the last 30" line | 1 of 1 day in the last 30 | same | ok |
| ring and line agree (to the rounding of x) | True | same | ok |

### Mon 08:20  Gym: tick Warm up, then Lift (task page)

| Check | Expected | Seen | |
|---|---|---|---|
| pop-ups after the first step (a fallback by rule) | ['Badge earned: Safety net.'] | same | ok |
| Today list and order | ['Stretch: I', 'Gym: I', 'Antibiotic: open'] | same | ok |
| Today done count | 2 of 3 | same | ok |
| Showing up ring | 100% | same | ok |
| "x of y days in the last 30" line | 1 of 1 day in the last 30 | same | ok |
| ring and line agree (to the rounding of x) | True | same | ok |
| lifetime XP after Stretch 10 + Gym 6 + 4 | 20 | same | ok |

### Mon 14:00  Antibiotic: dose 1 of 3 (task page), then Routines and Courses tabs

| Check | Expected | Seen | |
|---|---|---|---|
| Today list and order | ['Stretch: I', 'Gym: I', 'Antibiotic: F'] | same | ok |
| Today done count | 3 of 3 | same | ok |
| Showing up ring | 100% | same | ok |
| "x of y days in the last 30" line | 1 of 1 day in the last 30 | same | ok |
| ring and line agree (to the rounding of x) | True | same | ok |
| Routines sections on Monday | Due Monday: Gym, Stretch / As needed: Meditate | same | ok |
| Routines: Stretch week strip (Jul 7..13) | ------I | same | ok |
| Routines: Gym week strip | ------I | same | ok |
| Courses: Antibiotic week strip (dose 1 only: fallback) | ------F | same | ok |

### Mon 22:00  Antibiotic: dose 3 (it jumps to all three taken)

| Check | Expected | Seen | |
|---|---|---|---|

### Mon 22:30  late evening check

| Check | Expected | Seen | |
|---|---|---|---|
| Today list and order | ['Stretch: I', 'Gym: I', 'Antibiotic: I'] | same | ok |
| Today done count | 3 of 3 | same | ok |
| Showing up ring | 100% | same | ok |
| "x of y days in the last 30" line | 1 of 1 day in the last 30 | same | ok |
| ring and line agree (to the rounding of x) | True | same | ok |
| lifetime XP Monday: three ideals | 30 | same | ok |
| Courses: Antibiotic week strip after all doses | ------I | same | ok |
| Achievements Monday: level card | Level 1, Getting started. 30 of 100 XP | same | ok |
| Achievements Monday: earned | ['First day', 'Safety net'] | same | ok |
| reminders armed for Tuesday | ['course-dose:abx:2026-07-14', 'event-starting:sync:2026-07-14', 'routine-due:gym:2026-07-14', 'routine-due:stretch:2026-07-14'] | same | ok |
| reminders still armed for the rest of Monday (all times are past) | [] | same | ok |

### Tue 08:30  midnight passed with the app open

| Check | Expected | Seen | |
|---|---|---|---|
| Today list and order | ['Stretch: open', 'Gym: open', 'Antibiotic: open', 'Team sync: open'] | same | ok |
| Today done count | 0 of 4 | same | ok |
| Showing up ring | 100% | same | ok |
| "x of y days in the last 30" line | 1 of 1 day in the last 30 | same | ok |
| ring and line agree (to the rounding of x) | True | same | ok |

### Tue 08:40  Stretch: Fallback; Gym: Push to tomorrow

| Check | Expected | Seen | |
|---|---|---|---|
| Today list and order | ['Stretch: F', 'Antibiotic: open', 'Team sync: open'] | same | ok |
| Today done count | 1 of 3 | same | ok |
| Showing up ring | 100% | same | ok |
| "x of y days in the last 30" line | 2 of 2 days in the last 30 | same | ok |
| ring and line agree (to the rounding of x) | True | same | ok |

### Tue 15:00  Antibiotic: doses 1 and 2 only (forgets the third); Team sync is forgotten

| Check | Expected | Seen | |
|---|---|---|---|
| Today list and order | ['Stretch: F', 'Antibiotic: F', 'Team sync: open'] | same | ok |
| Today done count | 2 of 3 | same | ok |
| Showing up ring | 100% | same | ok |
| "x of y days in the last 30" line | 2 of 2 days in the last 30 | same | ok |
| ring and line agree (to the rounding of x) | True | same | ok |

### Tue 22:30  late evening check

| Check | Expected | Seen | |
|---|---|---|---|
| lifetime XP Tuesday (30 + 6 + 6) | 42 | same | ok |
| Gym week strip: Tuesday is empty (pushed away, not missed) | -----I- | same | ok |
| Stretch week strip | -----IF | same | ok |
| Antibiotic week strip (two doses of three: fallback) | -----IF | same | ok |
| reminders armed for Wednesday | ['course-dose:abx:2026-07-15', 'routine-due:gym:2026-07-15', 'routine-due:stretch:2026-07-15'] | same | ok |

### Wed 08:00  midnight passed with the app open; Tuesday has settled

| Check | Expected | Seen | |
|---|---|---|---|
| Today list and order | ['Stretch: open', 'Gym: open', 'Gym (from yesterday): open', 'Antibiotic: open'] | same | ok |
| Today done count | 0 of 4 | same | ok |
| Showing up ring | 83% | same | ok |
| "x of y days in the last 30" line | 2 of 2 days in the last 30 | same | ok |
| ring and line agree (to the rounding of x) | True | same | ok |
| Gym (pushed from yesterday) is labelled | True | same | ok |

### Wed 08:05  Emergency day off, the whole day

| Check | Expected | Seen | |
|---|---|---|---|
| Today list and order | ['Stretch: open', 'Gym: open', 'Gym (from yesterday): open', 'Antibiotic: open'] | same | ok |
| Today done count | 0 of 4 | same | ok |
| Showing up ring | 83% | same | ok |
| "x of y days in the last 30" line | 2 of 2 days in the last 30 | same | ok |
| ring and line agree (to the rounding of x) | True | same | ok |
| cards showing "Off today" | 4 | same | ok |

### Wed 12:00  Meditate (as-needed): Log used it

| Check | Expected | Seen | |
|---|---|---|---|
| as-needed use is in the history | True | same | ok |
| lifetime XP unchanged by an as-needed use | 42 | same | ok |

### Wed 15:00  Routines tab

| Check | Expected | Seen | |
|---|---|---|---|
| Routines sections on Wednesday | Due Wednesday: Gym, Stretch / As needed: Meditate | Due Monday: Gym, Stretch / As needed: Meditate | BUG B1-stale-weekday |
| Routines sections on Wednesday (after tapping Wed) | Due Wednesday: Gym, Stretch / As needed: Meditate | same | ok |
| Stretch week strip (Jul 9..15, Wed is off) | ----IFO | same | ok |
| Gym week strip (Wed off) | ----I-O | same | ok |
| Antibiotic week strip (Wed off) | ----IFO | same | ok |

### Wed 22:30  late evening check

| Check | Expected | Seen | |
|---|---|---|---|
| Achievements Wednesday: level card (XP unchanged by a day off) | Level 1, Getting started. 42 of 100 XP | same | ok |
| reminders armed for Thursday | ['course-dose:abx:2026-07-16', 'routine-due:gym:2026-07-16', 'routine-due:stretch:2026-07-16'] | same | ok |

### Fri 08:30  opens the app after the forgotten Thursday

| Check | Expected | Seen | |
|---|---|---|---|
| Today list and order | ['Stretch: open', 'Gym: open', 'Antibiotic: open'] | same | ok |
| Today done count | 0 of 3 | same | ok |
| Showing up ring | 56% | same | ok |
| "x of y days in the last 30" line | 2 of 3 days in the last 30 | same | ok |
| ring and line agree (to the rounding of x) | True | same | ok |
| Level row on Today | Level 1 | same | ok |
| Stretch week strip with Thursday missed (Jul 11..17) | --IFOXo | same | ok |
| Gym week strip with Thursday missed | --I-OXo | same | ok |
| Routines sections on Friday | Due Friday: Gym, Stretch / As needed: Meditate | Due Wednesday: Gym, Stretch / As needed: Meditate | BUG B1-stale-weekday |
| Routines sections on Friday (after tapping Fri) | Due Friday: Gym, Stretch / As needed: Meditate | same | ok |

### Fri 08:40  Stretch page: History > Thu Jul 16 > Done; Gym page: Thu Jul 16 > Fallback (log Thursday late)

| Check | Expected | Seen | |
|---|---|---|---|
| Stretch history: Thursday now ideal | True | same | ok |
| lifetime XP after late logs (42 + 10 + 6) | 58 | same | ok |
| Stretch week strip after the late log | --IFOIo | same | ok |
| Gym week strip after the late log | --I-OFo | same | ok |
| Today list and order | ['Stretch: open', 'Gym: open', 'Antibiotic: open'] | same | ok |
| Today done count | 0 of 3 | same | ok |
| Showing up ring | 78% | same | ok |
| "x of y days in the last 30" line | 2 of 3 days in the last 30 | same | ok |
| ring and line agree (to the rounding of x) | True | same | ok |

### Fri 09:00  Stretch Done; Gym tick Warm up and Lift; Antibiotic dose 3 at once

| Check | Expected | Seen | |
|---|---|---|---|
| badges stored just before the Friday dose | ['fallback-safety-net', 'tenure-first-day'] | same | ok |
| badges stored just after the Friday dose (Comeback: missed Thu, showed up Fri) | ['fallback-comeback', 'fallback-safety-net', 'tenure-first-day'] | same | ok |
| pop-ups on Friday (Comeback, once) | ['Badge earned: Comeback.'] | [] | BUG B4a-comeback-popup |
| Today list and order | ['Stretch: I', 'Gym: I', 'Antibiotic: I'] | same | ok |
| Today done count | 3 of 3 | same | ok |
| Showing up ring | 83% | same | ok |
| "x of y days in the last 30" line | 3 of 4 days in the last 30 | same | ok |
| ring and line agree (to the rounding of x) | True | same | ok |
| lifetime XP Friday (58 + 10 + 10 + 10) | 88 | same | ok |

### Fri 15:00  tick Buy stamps on To-dos; Progress (All tasks)

| Check | Expected | Seen | |
|---|---|---|---|
| To-dos summary before | 2 left to do | same | ok |
| To-dos summary after ticking Buy stamps | 1 left to do | same | ok |
| to-dos are not on Today | ['Stretch: I', 'Gym: I', 'Antibiotic: I'] | same | ok |
| Progress, all tasks, 30 days (Fri) | 83 percent; ≈3.3 of 4 counted days (weighted by that day's tasks); Ideal 2, Fallback 1, Off 1, Missed 1 | same | ok |

### Fri 22:30  late evening check

| Check | Expected | Seen | |
|---|---|---|---|
| Achievements Friday: level card | Level 1, Getting started. 88 of 100 XP | same | ok |
| Achievements Friday: earned | ['Comeback', 'First day', 'Safety net'] | same | ok |
| reminders armed for Saturday | ['course-dose:abx:2026-07-18', 'routine-due:stretch:2026-07-18'] | same | ok |

### Sat 08:30  midnight passed

| Check | Expected | Seen | |
|---|---|---|---|
| Today list and order | ['Stretch: open', 'Antibiotic: open'] | same | ok |
| Today done count | 0 of 2 | same | ok |
| Showing up ring | 83% | same | ok |
| "x of y days in the last 30" line | 3 of 4 days in the last 30 | same | ok |
| ring and line agree (to the rounding of x) | True | same | ok |

### Sat 08:40  Stretch: Done; Antibiotic dose 1

| Check | Expected | Seen | |
|---|---|---|---|
| pop-ups Saturday (level 2, once) | ["You're now Level 2."] | [] | BUG B4b-levelup-popup |
| Today list and order | ['Stretch: I', 'Antibiotic: F'] | same | ok |
| Today done count | 2 of 2 | same | ok |
| Showing up ring | 87% | same | ok |
| "x of y days in the last 30" line | 4 of 5 days in the last 30 | same | ok |
| ring and line agree (to the rounding of x) | True | same | ok |
| Level row on Today | Level 2 | same | ok |

### Sat 14:00  End routine Stretch (it is logged today, so it ends today)

| Check | Expected | Seen | |
|---|---|---|---|
| Stretch ended on the day it was last logged | Ended Jul 18 | same | ok |
| stored endedOn | 2026-07-18 | same | ok |
| Routines sections on Saturday after ending Stretch | Due Saturday: (none) / Other routines: Gym / As needed: Meditate / Ended: Stretch | Due Friday: Gym / As needed: Meditate / Ended: Stretch | BUG B1-stale-weekday |
| Routines sections on Saturday after ending Stretch (after tapping Sat) | Due Saturday: (none) / Other routines: Gym / As needed: Meditate / Ended: Stretch | same | ok |
| Ended card meta | True | same | ok |
| Today after ending Stretch (its logged day stays) | ['Stretch: I', 'Antibiotic: F'] | same | ok |

### Sat 20:00  Antibiotic dose 3

| Check | Expected | Seen | |
|---|---|---|---|

### Sat 22:30  late evening check

| Check | Expected | Seen | |
|---|---|---|---|
| Today list and order | ['Stretch: I', 'Antibiotic: I'] | same | ok |
| Today done count | 2 of 2 | same | ok |
| Showing up ring | 87% | same | ok |
| "x of y days in the last 30" line | 4 of 5 days in the last 30 | same | ok |
| ring and line agree (to the rounding of x) | True | same | ok |
| Achievements Saturday: level card (108 XP) | Level 2, Warming up. 8 of 250 XP | same | ok |
| reminders armed for Sunday | ['course-dose:abx:2026-07-19', 'course-ending-soon:abx:2026-07-22'] | same | ok |

### Sun 09:00  midnight passed

| Check | Expected | Seen | |
|---|---|---|---|
| Today list and order | ['Antibiotic: open'] | same | ok |
| Today done count | 0 of 1 | same | ok |
| Showing up ring | 87% | same | ok |
| "x of y days in the last 30" line | 4 of 5 days in the last 30 | same | ok |
| ring and line agree (to the rounding of x) | True | same | ok |
| Level row on Today | Level 2 | same | ok |

### Sun 09:10  Antibiotic: dose 1, then dose 3

| Check | Expected | Seen | |
|---|---|---|---|
| Today list and order | ['Antibiotic: I'] | same | ok |
| Today done count | 1 of 1 | same | ok |
| Showing up ring | 89% | same | ok |
| "x of y days in the last 30" line | 5 of 6 days in the last 30 | same | ok |
| ring and line agree (to the rounding of x) | True | same | ok |
| lifetime XP Sunday (108 + 10) | 118 | same | ok |

### Sun 15:00  Routines tab; Progress (All tasks and Stretch alone)

| Check | Expected | Seen | |
|---|---|---|---|
| Routines sections on Sunday | Due Sunday: (none) / Other routines: Gym / As needed: Meditate / Ended: Stretch | Due Saturday: (none) / Other routines: Gym / As needed: Meditate / Ended: Stretch | BUG B1-stale-weekday |
| Routines sections on Sunday (after tapping Sun) | Due Sunday: (none) / Other routines: Gym / As needed: Meditate / Ended: Stretch | same | ok |
| Ended Stretch week strip (Jul 13..19; Sunday is after its end) | IFOIII- | same | ok |
| Gym week strip | I-OFI-- | same | ok |
| Progress, all tasks, 30 days (Sun) | 89 percent; ≈5.3 of 6 counted days (weighted by that day's tasks); Ideal 4, Fallback 1, Off 1, Missed 1 | same | ok |
| Progress, Stretch only | 100 percent; 4 ideal + 1 fallback = 5 of 5 counted days; Ideal 4, Fallback 1, Off 1, Missed 0 | same | ok |

### Sun 15:30  delete Gym from its page (Routines > Other routines), look, then restore from Recently deleted

| Check | Expected | Seen | |
|---|---|---|---|
| Routines without Gym | Due Sunday: (none) / As needed: Meditate / Ended: Stretch | same | ok |
| Gym is in Recently deleted, not gone | True | same | ok |
| Progress while Gym is deleted: unchanged | 89 percent; ≈5.3 of 6 counted days (weighted by that day's tasks); Ideal 4, Fallback 1, Off 1, Missed 1 | same | ok |
| lifetime XP while Gym is deleted (XP is never taken away) | 118 | same | ok |
| reminders for Monday while Gym is deleted | ['course-dose:abx:2026-07-20'] | same | ok |
| restored toast | Restored "Gym". | same | ok |
| Routines with Gym restored | Due Sunday: (none) / Other routines: Gym / As needed: Meditate / Ended: Stretch | same | ok |
| restored Gym keeps its week (Jul 13..19) | I-OFI-- | same | ok |

### Sun 22:30  late evening check

| Check | Expected | Seen | |
|---|---|---|---|
| Today list and order | ['Antibiotic: I'] | same | ok |
| Today done count | 1 of 1 | same | ok |
| Showing up ring | 89% | same | ok |
| "x of y days in the last 30" line | 5 of 6 days in the last 30 | same | ok |
| ring and line agree (to the rounding of x) | True | same | ok |
| Level row on Today | Level 2 | same | ok |
| Progress after the restore: unchanged | 89 percent; ≈5.3 of 6 counted days (weighted by that day's tasks); Ideal 4, Fallback 1, Off 1, Missed 1 | same | ok |
| Achievements Sunday: level card (118 XP) | Level 2, Warming up. 18 of 250 XP | same | ok |
| Achievements Sunday: earned (no 7 days yet) | ['Comeback', 'First day', 'Safety net'] | same | ok |
| reminders armed for Monday 20 (Gym restored) | ['course-dose:abx:2026-07-20', 'routine-due:gym:2026-07-20'] | same | ok |

### Week   pop-ups over the whole week

| Check | Expected | Seen | |
|---|---|---|---|
| milestones queued over the week, in order | ['tenure-first-day', 'fallback-safety-net', 'fallback-comeback', 'level-up'] | ['tenure-first-day', 'fallback-safety-net'] | BUG B4c-week-popups |
| when each milestone arrived | ['Mon 08:10 tenure-first-day', 'Mon 08:20 fallback-safety-net', 'Fri 09:00 fallback-comeback', 'Sat 08:40 level-up'] | ['Mon 08:10 tenure-first-day', 'Mon 08:20 fallback-safety-net'] | BUG B4c-week-popups |
| badge dates | ['fallback-comeback 2026-07-17', 'fallback-safety-net 2026-07-13', 'tenure-first-day 2026-07-13'] | same | ok |
| unlocked badges stored | ['fallback-comeback', 'fallback-safety-net', 'tenure-first-day'] | same | ok |
