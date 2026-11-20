# 44 - UI speed with many habits (round 4)

Owner of: `src/features/today/**` (not `useDayTick`), `src/features/browse/**`, `src/features/task/TaskCard.tsx`, `TaskDetails.tsx`. New test: `src/features/today/edge.renderCost.test.tsx` (6 tests). New source: `src/features/today/weekStrips.tsx`.

Method: the real Today and Routines screens, the real read hooks and a real QueryClient over the fake repositories, 150 daily routines. Repository calls counted with `jest.spyOn`, React `Profiler` for commits and render time, and a counter on `taskIconProps` (called once per row/card render) for "how many rows redrew". Times are jest with dev React on a shared machine: use them for ratios, not as phone numbers.

## Before and after

| Measure (150 habits) | Before | After |
|---|---:|---:|
| Routines mount: repository reads | 454 (150 `tasks.get`, 150 `logs.listForTask`, 151 off-mark reads, 3 other) | 7 |
| Routines mount: commits | 152 (one per strip answering) | 3 |
| Routines after one log (strips refetch): reads | 450 | 3 to 6 |
| Routines after a log: cards redrawn | all (a TaskCard had no memo) | 0 to 1 |
| Today, one habit logged: rows redrawn | 150 | 1 |
| Today, one habit logged: render time of that commit | 725 ms | 21 to 27 ms |
| Today mount: rows drawn / render time | 150 / about 1140 ms | unchanged (150 / about 1200 ms) |

## What was found and changed

1. **Week strips: one query per card.** Every Routines/Courses `TaskCard` ran `useTaskOccurrences` (task read, log read, off-mark read): 450 reads on mount, and every log invalidates the `taskOccurrences` key so all 450 ran again. Fix: `WeekStripsProvider` (`src/features/today/weekStrips.tsx`) wraps the card lists on Routines and Courses and reads the last 7 days of every habit once (`resolveAllOccurrences` with a floor: one log range read, one off-mark read, the same resolver the per-task read uses). Cards take their 7 days from context. The query key is `['taskOccurrences', 'strips', from, to]`, so every existing invalidation reaches it. A habit whose 7 days did not change keeps the same array, and the strip component is memoized, so only the changed strip redraws. A `TaskCard` outside a provider (Search) still reads its own strip, and without a QueryClient the provider is a pass-through, so the existing screen tests (which mock `@/queries` and render without a client) are unchanged. src/queries was not touched.
2. **TaskCard re-render.** Routines calls `useTodayRows`, so the whole list rebuilt on every Today change, and each card got new `meta` arrays, new `onPress` closures and a new `<StatusPill>` element. `TaskCard` is now `React.memo` with a comparator (same task object, same flags, same meta strings, status/leading/footer nodes equal by type and shallow props); `onPress` goes through a ref (set in an effect) so a stale closure is never called.
3. **Today redrew all 150 rows per log.** `TaskRow` was not memoized and got fresh closures per row. Now one stable `rowActions` object (handlers read the latest rows, date and handlers through a ref) and `TaskRow` is `React.memo` with a comparator on the row's task and occurrence (identity, then field values), `reopened`, and the actions. Behaviour (once-per-card guard, undo, the "day complete" sound that looks at all rows) is unchanged; the undo and second-log paths have a test.

## Decided against: virtualizing the lists

Measured an isolated 150-card list: `ScrollView` 450 to 780 ms, `FlatList` 32 ms to mount (14 to 24 times cheaper). I did not change Today or Routines to a `FlatList`/`SectionList`:
- The mount cost is paid once per visit, and the recurring cost (every log) is what is now fixed. On a phone with release Hermes the 150-card mount is a fraction of the dev-mode number, and 150 habits is the far end of use.
- An existing test (`edge.today.test.tsx`, "150 habits render...") asserts all 130 "Done" buttons are in the tree, which a virtualized list does not do; the brief says every existing test must pass and behaviour must not change (TalkBack and find-on-screen also see only the rendered window).
- Looks, the FAB clearance (`FAB_CLEARANCE` bottom padding) and the bounce/overscroll settings are kept as they are.
If the main session wants it later: `FlatList` with the banners, `StatHero`, the summary group and the section heading as `ListHeaderComponent`, `ItemSeparatorComponent` for the `SPACE.s2 + 4` gap, the same `contentContainerStyle`, and that one test relaxed. Rows are already memoized and have stable keys, so it would drop in.

## Tests added (`edge.renderCost.test.tsx`)

- Routines mount: 150 strips drawn, no `tasks.get`, no per-task log read, at most 12 reads, at most 6 commits.
- Routines after a log elsewhere (a log written, `taskOccurrences` and `today` invalidated): at most 10 reads, no `tasks.get`, at most 5 card renders, exactly one of the 150 strips changed and now reads "ideal".
- Batched strips equal the strips of cards that read their own, on a habit with ideal, fallback and off days.
- A card outside a provider (Search) still reads its own strip (one `tasks.get`).
- Today: mount draws 150 rows; one real `useLogState` tap redraws at most 3 (measures 1), the count and the logged row are right.
- Today: undo and a second log on the same screen still act on the latest rows.

## Results

`edge.renderCost.test.tsx` 6 passed. `src/features/today`, `browse`, `search`: all pass except 4 tests that already fail on the current tree for an unrelated reason (not my change): `TodayScreen.test.tsx` x2 and `ToDosBrowseScreen.test.tsx` x2 expect the toast text "Ideal done" / "Fallback done" / "Done" and the app now says "Ideal done." etc. (a wording pass changed `logFeedback.ts` and the to-do toast, tests not updated). Also failing and unrelated: `src/ui/edge.a11y.test.tsx` (17, toast and StatHero dash, another agent's UI wording work). `tsc --noEmit` and eslint have no errors in my files (warnings only, import order in the jest-mock style).

## Left for the main session

- Today's own mount does 33 `tasks.list`, 8 log-range and 8 off-mark reads (counted with the 150 habits). These come from the other hooks on the screen (`useConsistency`, `useProgress`, `usePriorityGroups`, `useTodayRows`) in src/queries, not mine; worth a look (coalesce `useTasks` reads, or a longer `staleTime`).
- `EventsBrowseScreen` runs one `useTaskOccurrences` per event card and `RoutinesBrowseScreen`'s `AsNeededRow` one `useAsNeededHistory` per as-needed card. Not measured at 150 (events and as-needed habits are rarely that many); same batching would apply.
- `weekStrips.tsx` imports `resolveAllOccurrences` from `@/queries/internal` and `repos` from `@/db` (the same narrow exception as `useAsNeededHistory`); promoting a `useWeekStrips(range)` read to `src/queries/reads.ts` would be the clean home.
- Phone timings: not measurable here. The removed reads each cross the native bridge on a phone, so the saving there is larger than the in-process numbers.
