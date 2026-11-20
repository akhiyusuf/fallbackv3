# 33 - Real app in a browser (round 3)

Build: the web build in the scratchpad (built earlier, does NOT contain the fixes below). Scripts: `scratchpad/r3-browser/` (`sweep.js` every route, `flow*.js` mouse flows, `stress.js` long/emoji/150 habits/320px). Chromium, 390x844 at 1x, light and dark, plus 320x568-wide runs. Fonts: Nunito did not load offline, so the browser used a serif fallback; widths of text differ a little from a phone.

## What was run
- Every route (45 static plus task/[id], icon, delete, celebrate, as-needed for 7 tasks, three bad ids) on an empty store and on sample data, light and dark: 0 console errors, 0 page errors. Bad ids render without crashing.
- Per page checks: horizontal overflow, ellipsis clipping, tap targets under 44, overlapping tappables (ignoring aria-hidden stacked screens).
- Mouse flows (light): skip onboarding, create a routine through the form (Daily, ideal, fallback), log Done, Undo, Fallback, Push to tomorrow (+Undo), Emergency day off on Today (all rows read "Off today"), tabs, Courses Past, To-dos Notes, task page, "..." menu, Rename sheet, End routine confirm then Ended section on Routines, Start again, Delete routine confirm sheet, delete then Recently deleted list, all Settings screens, add sheet open/close, Escape closes a menu, course/as-needed/event/todo task pages.
- Stress: 200-character names (with spaces, without spaces, 60 W's, 400 chars), emoji/ZWJ/flags/Arabic/Japanese names, 150 habits (mixed routines/todos/events) on every list, task page, forms; at 390 and 320.
- Dark: sweep and the 150-habit run. Nothing dark-specific found.

## Bugs
1. FIXED (jest only, confirmed in build): **seven weekday chips overflow a 320pt phone.** `src/ui/WeekdayPicker.tsx`: 7 x 44 = 308pt in a 288pt row; chips touch and Sunday ends at x=324 (off screen) on New routine, and the same component is the Routines day filter (`Sun L280 R324`). Fix: `flexShrink: 1`, `minWidth: 36`. Test `src/ui/WeekdayPicker.test.tsx`. Screenshot `review/screenshots/r3/weekday-picker-overflow-320.png`. Verified by measuring in the build, and by jest for the style only (no layout engine in jest).
2. FIXED (jest only, confirmed in build): **Save with an invalid form looks dead.** Tapping Save routine with no fallback step does nothing visible: the error ("Add a fallback...") is below the fold and the form does not scroll to it. Screenshot `review/screenshots/r3/form-invalid-save-no-feedback.png`. Fix: a toast "Some fields need attention. Scroll to see what." (`FIX_FIELDS` in `src/features/task/formShared.ts`) in all four forms (`app/add/{routine,todo,course,event}.tsx`). Test `app/add/formInvalidToast.test.tsx` (4 cases); `app/add` suites all pass (54 tests). A scroll-to-first-error would be nicer on a phone; left for the main session.
3. Requested by the main session: `formatWeekdaySet` (`src/features/browse/format.ts`) now de-duplicates ([1,1,2] reads "Mon·Tue"); the `it.failing` in `src/edge.fuzz.test.ts` is now a plain `it` and passes (52 tests).

## Findings not fixed (design or other owners)
- Tap targets under 44pt (design decisions or shared pieces, not changed): segmented tabs (Tabs/SlidingTabBar) 36pt tall on Add forms, Priorities, Progress, Achievements, Theme, Courses, To-dos; "Skip onboarding" 59x36 and onboarding Back 40x40; "Show API key" 32x32; To-do row checkbox 28x28 (row itself is tappable); Priorities move up/down 38x44; Today's "Push to tomorrow"/"Emergency day off" text buttons 127x28 and 134x28 and the row-open button 40 high; toast Dismiss 40 high; "Change" chip 121x32; calendar day cells on the task page 36x44 at 320 wide (44 at 390).
- Overlaps, all only while scrolling or from transient layers, no permanent clash: FAB over the last row/badge ("As-needed" badge under the FAB on Routines at scroll end of the first screenful), toast over list bottom, sticky Save bar over "Add step" mid-scroll (bottom padding is enough once scrolled to the end).
- Long names: every list truncates with an ellipsis (names, steps), nothing overflows at 390 or 320 for 200-char, no-space or emoji names. Task header clamps to two lines, so a 200-char name can only be read in full in Rename or the delete sheet (design call).
- 150 habits: every route renders in about 1 to 1.8 s including navigation; no errors.

## Not tested / limits
- Real phone fonts, keyboard avoidance, safe-area insets, haptics, native pickers (date/time sheets were not driven), notification permission, scrolling momentum.
- Restore from Recently deleted: the list and its row render; the detail/restore tap was not driven in the browser (covered by `recentlyDeleted*.test.tsx`).
- The preview harness has no cache refresh, so rows added directly through `repos` show only after a cold route (I seeded before first visiting Today).
- No bugs found in files owned by others (assistant, splash, useTodayRows, app-shell, queries).
