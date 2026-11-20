# 20 - Today tab and task page (edge cases)

Result: 34 tests in `src/features/today/edge.today.test.tsx` and 23 in `app/task/[id]/edge.taskPage.test.tsx`, all passing.
Existing `TodayScreen.test.tsx`, `app/task/[id]/index.test.tsx`, `as-needed.test.tsx` (40 tests) still pass. `tsc --noEmit` has no errors in my files.

Note for the main session: the brief's command `jest --selectProjects app <path>` makes jest read the path as a second
project name and run the WHOLE suite. Put the path first: `npx jest <path> --selectProjects app ...`.

## Bugs fixed
1. Midnight with Today open (`src/features/today/useTodayRows.ts`): the date was read on each render but nothing forced a render.
   The root `useDayRollover` only invalidates queries, and a refetch that returns identical data (every habit already logged,
   or an unchanged task list) does not re-render, so the header date and list stayed on yesterday. Added `useDayTick`
   (30 s timer plus a check when the app returns to the foreground), used by Today and by the task page (`app/task/[id]/index.tsx`).
2. Double taps on Today (`TodayScreen.tsx`): Done/Fallback, Push to tomorrow, a card's Emergency day off and the whole-day switch ran
   twice (two sounds, two toasts, and a second "Already pushed once" toast replacing the Undo toast; `previous` was stale so the
   day-complete sound could play twice). One action at a time per card now (`once`, keyed by task and pushed-from, so a habit's own
   card and its pushed card do not block each other).
3. A log write that rejected on Today was an unhandled rejection with no feedback. `once` now catches it and shows the save-failed toast.
4. Task page (`app/task/[id]/index.tsx`): same double-tap guard on the own and the "From yesterday" log controls, plus the same
   rejected-write handling.
5. As-needed page (`app/task/[id]/as-needed.tsx`): a second tap on "Log used it" while the first save was in flight logged a second use.
   Guarded, and a rejected write now shows the save-failed toast.

## Tests: Today (`edge.today.test.tsx`)
How many habits: no habits (blank slate); habits but none due; one habit; 150 habits (count, "20 of 150 done", untimed before timed);
timed sort by time then untimed by name; an occurrence whose task is gone is dropped; other days' occurrences ignored.
Due / off / pushed: whole-day off shows "Off today" with no buttons and the switch on; switch off when only some are off;
pushed beside own gives two cards and each logs with its own `pushedFrom`; the busy guard is per card.
Double taps: Done twice logs once; Done then Fallback while saving ignored; a later tap after the save works; Push twice pushes once;
Emergency day off twice marks once; rejected write shows the toast and can be retried; not-ok result shows the toast.
Midnight: header and read key move to the new date even with no other re-render; yesterday's log is not today's; a log after midnight
goes to the new date; no day reads after unmount.
Names: 300-character name and emoji name keep their labels and one line; a one-character name.
Accessibility and wording: every button has a label; every log control names its habit; no em or en dash in any state (empty, none due,
timed, off, pushed, course, banners) or in `S09_COPY`; error state.
Sound timing (`services/sfx/timing.ts`): four badges and a level-up after a press start one at a time, each after the previous finished plus the gap;
calling one reward off leaves the rest; off after begin is harmless; day-complete waits for the log sound; a tap in the gap pushes a reward back, order kept.
Celebration host: three milestones queued show one pop-up at a time and all three are shown after dismissals.

## Tests: task page (`edge.taskPage.test.tsx`, real hooks on fake repos)
Kinds: routine; multi-dose course (dose controls, whole day, dose 2 first sets two taken); multi-step routine (ticking steps goes fallback then ideal);
one-off event with no steps; to-do (Done switch, note text); note (no Done switch); as-needed (own screen, Log used it, double tap logs one use).
Ended (card, Start again, no Today card or priority block; double tap starts once); in Recently deleted (notice, no log buttons);
gone for good (not-found notice).
Shared state: a log made elsewhere shows as the chip; logging on the page writes today's row; double tap on Done writes once;
pushed beside own logs separately (source row vs today's row); the per-task emergency day off.
Names and a11y: 300-character emoji-led name; every button has a label or test id for a routine with steps, a multi-dose course and an ended routine;
no em or en dash on any kind, `END_COPY` has none.

## Checked, no bug
- Own plus pushed occurrences: ordering from the resolver (own first) and the page's `pushedToday` lookup are right, including the case
  where own is not due and only the visitor exists (the page logs it through the carrier).
- The timing helper and `CelebrationHost` queue behave as designed.
- Today copy and task page copy contain no em or en dashes.

## Not tested (needs a real phone)
Real audio overlap and the felt gap; the midnight tick on a device in the background or after the phone sleeps (the foreground check is
only exercised through the timer here, since the jest AppState mock returns no subscription, hence `sub?.remove()`); time zone or
clock changes; scroll performance with 150 cards (rendered without virtualisation, fine in jest, not measured on a device);
screen reader reading order; the confetti/burst animations.

## Left for others
`src/app-shell/index.ts` `useDayRollover` calls `subscription.remove()` unguarded (fine on device, throws where AppState is mocked to undefined).
