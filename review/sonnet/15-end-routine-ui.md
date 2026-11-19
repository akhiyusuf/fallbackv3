# 15 End routine UI tests

Files: `app/task/[id]/endRoutine.test.tsx` (new), `src/features/browse/EndedSection.test.tsx` (new), priorities case added to `src/features/priorities/order.test.ts`.

## Bugs found and fixed
1. Double tap on End (confirm sheet) ran the end twice (two `tasks.update({endedOn})` calls, two toasts). Same for Start again (button and menu entry). Fix: `changing` ref guard in `onEnd` / `onStartAgain` in `app/task/[id]/index.tsx` (~lines 193-217), same pattern as DeleteTaskSheet.
No crash with `endedOn` undefined (old data): tests for the task page, Routines list and priorities all pass (`!tk.endedOn` and `?? null` handle it).

## Tests (all passing)
endRoutine.test.tsx
- Which kinds get End: routine, repeating event, course yes; to-do, note, as-needed routine, one-off event no (7 cases, menu also has no Start again).
- Confirm sheet: copy; Cancel leaves it running with no toast; confirm ends yesterday when unlogged (Ended Jul 15, toast, stored endedOn); ends today when today logged; failed end warns and shows no Ended card; double tap runs one end.
- Ended task: card, Today/Time/Priority and chip hidden; running control shows Today and week strip; undefined endedOn treated as running; menu has Start again (card plus menu entry) and no End; history stops at end date, week strip hidden, earlier day opens day sheet; Start again (button and menu) clears card, toasts, menu returns to End; double tap on Start again runs once; failed Start again warns and keeps card; course noun.
- Delete sheet wording via DELETE_COPY: with End instead line for a routine; none for a to-do or an ended routine.
- No em or en dashes in END_COPY / DELETE_COPY.
EndedSection.test.tsx: Routines (ended only in Ended, incl. as-needed; no section when none or undefined endedOn; open then Start again returns it; End from page moves it to Ended), Events (ended repeating only in Ended, one-offs untouched), Courses (ended course in Past not Active), EndedSection (empty, newest first).
order.test.ts: ended routine/event/course dropped, restarted and undefined-endedOn kept.

## Not covered
- Heatmap cells after the end date: occurrences stop at the end date so no cell exists to tap; the guard in `onCellPress` is not reachable in the fake data (asserted that no such cells render).
- Deleted.tsx Recently deleted copy (belongs to deleted.test.tsx, not touched here).
- Real SQLite behavior (fakes only).

## Runs
`npx tsc --noEmit`: clean. Whole suite: `Tests: 1210 passed, 1210 total`, no FAIL lines (retiredDays failures did not occur).
