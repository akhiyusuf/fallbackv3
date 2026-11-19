# 12. Recently deleted: data layer edge-case tests and bug fixes

Scope: `src/db/**`, `src/queries/**`, `src/domain/retention*`, and tests there. The screens (`app/settings/data/**`, `src/features/task/DeleteTaskSheet.tsx`) were not edited; UI problems are listed in section 7.

Commit under test: `9af141b` (Recently deleted, 30 days).

---

## 1. Summary

| | Before (my area, at start of this task) | After |
|---|---|---|
| `src/db` + `src/queries` (jest, app project) | 15 suites, 158 tests, all passing | 17 suites, 225 tests, all passing |
| `src/domain` (jest, domain project) | 134 tests (inferred: 147 minus the 13 new) | 147 tests, all passing (13 new) |
| Whole suite `npx jest --forceExit` | (not run at start) | 129 suites, 1113 tests, all passing (run before the last no-op move of one helper; the db/queries/domain suites were re-run after that move and pass) |
| `npx eslint src/db src/queries src/domain --quiet` | clean | clean (no output, exit 0) |
| `npx tsc --noEmit` | - | No errors in `src/**` or in any file of this task. The tree currently prints errors in other agents' files: 12 in `app/settings/data/deleted.test.tsx` earlier, and 3 in `app/recentlyDeleted.screens.test.tsx` at the last run. Not in my area; see section 7. |

Bugs found: 3 in the app, all fixed (B1 in `src/domain`, B2 and B3 in the query layer), plus 1 test-support fidelity gap (B4, fixed). Behaviours documented and left for a decision are in section 3.

---

## 2. Bugs found and fixed

### B1. "31 days left" right after deleting (clock set back)
- **Where:** `src/domain/retention.ts:26` (`daysLeft`).
- **What a person sees:** if the device clock was moved back after an item was deleted, its deletion time is ahead of "now". `daysLeft` returned 31 (ceil of 31 days remaining). The screen would say "31 days left", which contradicts the rule "30 just after deleting".
- **Cause:** no upper bound on the result.
- **Fix:** `Math.min(DELETED_KEEP_DAYS, Math.max(0, Math.ceil(left)))`.
- **Test:** `src/domain/retention.test.ts`, "never shows more than 30 days, even when the device clock was set back after deleting". It failed (received 31) before the fix.

### B2. Writes to a task in Recently deleted were accepted (log, step, dose, snooze, undo, off day, as-needed use, edit, duplicate)
- **Where:** `src/queries/mutations.ts`. The functions `logState`, `toggleStep`, `logDose`, `snoozeOccurrence`, `undoSnooze` and `reconcileOccurrence` all looked the task up with `repos.tasks.get`, which returns deleted rows. `markOffDay`, `useLogAsNeededUse`, `useUpdateTask` and `useDuplicateTask` did no check at all.
- **What a person sees:** a screen that still shows a task (a stale list, or a second tap during the delete) can log a day, toggle a step, snooze, mark an off day, edit the name, or duplicate the task. The duplicate comes back as a **live** new task with the same name, because `taskRepository.duplicate` sets `deletedAt: null`. Logging goes through `reconcileOccurrence`, which awards XP for the occurrence; the test checked the write succeeded (`ok: true`), and the XP path follows from the code (not separately observed in a run).
- **Cause:** `repos.tasks.get` is deliberately unfiltered (see section 3, N1), and no mutation checked `deletedAt`.
- **Fix:** one helper, `liveTask(id)` (`mutations.ts:230`), which returns the task only if `deletedAt === null`. Every task write now resolves through it: `reconcileOccurrence` (line 253), `logState` (517), `toggleStep` (558), `logDose` (620), `snoozeOccurrence` (714), `undoSnooze` (783). Explicit refusals at `markOffDay` (line 658, when `taskId` is set), `useLogAsNeededUse` (688), `useUpdateTask` (401) and `useDuplicateTask` (489). Each refusal returns `NOT_FOUND` with "Task not found.", the same as for an unknown id. Writes to live tasks are unchanged.
- **Tests:** `src/queries/recentlyDeleted.test.tsx`, section "writes aimed at a task in Recently deleted are refused and write nothing" (9 tests). All 8 refusal tests failed before the fix (`ok: true`). The 9th, "once restored, the same writes work again", passes both before and after.

### B3. Deleting a task took back a badge that was already shown as earned
- **Where:** `src/queries/mutations.ts`: new `persistEarnedBadges()` (line 416), called first in `useDeleteTask` (line 434).
- **What a person sees:** the Achievements screen (`useAchievements`) shows badges computed on the fly from live tasks. A badge is only saved by the next logging mutation. In the test, "fallback-comeback" was shown as earned; after deleting the task that earned it, it disappeared from the list, and it reappeared on restore. Badges are meant to be monotonic (persisted, like XP).
- **Cause:** `useAchievements` recomputes from live tasks only, and nothing saved the computed badges before a task left the live set.
- **Fix:** `useDeleteTask` first persists the badges the live tasks have earned (same reconcile as `reconcileOccurrence`, emitting `badge:unlocked` for each new one), then soft-deletes.
- **Test:** `src/queries/recentlyDeleted.test.tsx`, "achievements already earned stay earned while an item is deleted, and come back unchanged after restore". It failed before the fix (the list lost `fallback-comeback`).

### B4. Test support did not behave like the real repository (`src/queries/testSupport/fakeRepos.ts`)
- **Not an app bug, but it hid B2.** `softDelete` stamped every task with a fixed `2024-01-01` and returned `ok` for an unknown or already-deleted id (the real repository returns `NOT_FOUND`; a second delete must not restart the 30 days). `duplicate` copied `deletedAt` into the copy (the real one sets it to `null`).
- **Fix:** `softDelete` now refuses missing or already-deleted ids and stamps `now()`; `duplicate` returns a live copy with `priorityRank: null`. The fake now imports `now` from `@/lib/date` (lines 9, 118-125, 149-155).
- All existing query tests still pass with the fake changed.

---

## 3. Behaviour found but NOT changed (for a decision or a note)

| # | Finding | Where | Why not changed |
|---|---|---|---|
| N1 | `repos.tasks.get(id)` returns deleted tasks. Read hooks `useTask`, `useTaskOccurrences`, and per-task `useConsistency` still compute for a deleted task. Every write now refuses one (B2), but a screen that opens a deleted task still shows its numbers. | `src/db/repositories/taskRepository.ts` `get`; `src/queries/reads.ts:56, 75, 93` | The brief asks for `get` to keep returning it and for callers to be documented. Callers must check `deletedAt`. See section 7 for the UI. |
| N2 | At exactly 30 days after deleting, the sweep and `purgeDeleted` keep the item (strict `<`), while `daysLeft` reads 0 for that instant. So a row can show "0 days left" for 1 ms. | `lifecycle.ts` `hardDeleteSweep`, `reads.ts` `useRecentlyDeleted`, `retention.ts` `daysLeft` | The strict comparison is what the code comments document ("kept its full time"). Harmless. A one-character change to `<=` would align them if the human prefers. |
| N3 | Restoring a backup does not run the sweep. An item that was already past 30 days in the backup is listed in Recently deleted until the next launch, or until the Recently deleted read runs (which purges first). | `src/db/lifecycle.ts` `restore`, `applyBackupEnvelope` | Harmless: the screen's read purges before listing. Pinned by a test. |
| N4 | `updated_at` is stamped on delete (`softDelete`) and on restore. A restored task's `updatedAt` is the restore time. | `taskRepository.ts` `softDelete`, `restore` | Probably fine. Listed for the human. |
| N5 | **Product effect (human decision):** deleting a task removes its occurrences from today's list and from the aggregate consistency (last 7, last 30, all-time) at once; restoring brings them back. When it is purged, its day logs go too, so past consistency percentages shift for good. XP and badges do not move. | `resolveAllOccurrences` uses `repos.tasks.list()` (live only) | This is the brief's intended exclusion ("excluded from aggregate consistency"), but the human may not expect a deleted routine to change last-30 percentages. Verified by test: aggregate with the item deleted equals aggregate in a world where it never existed. |
| N6 | `widget_config.fixed_task_id` still points at a deleted (kept) task until purge. The widget snapshot filters to live tasks, so a fixed-task widget pointing at a deleted task probably shows nothing. | `src/services/widgets/index.ts` (not my area) | Read from code only. Not tested here. The services owner should check. |
| N7 | Duplicates: `repos.tasks.duplicate` itself still copies a deleted source (the repo does not refuse it). Only the query hook refuses (B2). | `taskRepository.ts` `duplicate` | Guarded at the hook layer, which is what the brief asked for. A direct repo caller could still duplicate a deleted task. |

---

## 4. Cases tested and results

All rows pass after the fixes. "Before" marks the cases that failed before the fixes.

### 4a. Retention arithmetic (`src/domain/retention.test.ts`, pure)

| Case | Expected | Result |
|---|---|---|
| `DELETED_KEEP_DAYS` | 30 | pass |
| `purgeCutoff` is exactly 30 x 24 h before now, ISO UTC with ms | `2026-03-01T12:00:00.000Z` for `2026-03-31T12:00Z` | pass |
| `purgeCutoff` across a DST change (London, end of March) | exactly 720 h back | pass |
| `purgeCutoff` same answer in UTC, Kiritimati, Los Angeles, Pago Pago | identical string | pass |
| Cutoff format matches what the app writes (`toISOString`) | `YYYY-MM-DDTHH:mm:ss.sssZ` | pass |
| `daysLeft` at deletion | 30 | pass |
| `daysLeft` at +1 ms | 30 (ceil) | pass |
| `daysLeft` at +1 day / +29 days | 29 / 1 | pass |
| `daysLeft` at +29.5 days | 1 | pass |
| `daysLeft` at 30 days minus 1 ms / exactly 30 days | 1 / 0 | pass |
| `daysLeft` past expiry (+30 d +1 ms, +400 d) | 0, never negative | pass |
| `daysLeft` with deletion stamped 1 day in the future (clock set back) | at most 30 (30) | **Before: 31 (B1)**; pass after fix |
| `daysLeft` same answer under three time zones | identical | pass |

### 4b. Sweep on launch, real SQLite file, relaunch (`src/db/__tests__/recentlyDeleted.test.ts`)

| Case | Expected | Result |
|---|---|---|
| Deleted, relaunched +1 day | kept | pass |
| Relaunched at 30 days minus 1 ms | kept | pass |
| Relaunched at exactly 30 days | kept (strict `<`) | pass |
| Relaunched at 30 days plus 1 ms | removed | pass |
| Relaunched a year later | removed | pass |
| Deletion stamped in the future (relaunch 1 day before it) | kept | pass |
| Stored `deleted_at` is the UTC instant with ms and `Z` | matches | pass |
| SQL order across midnight (`23:59:59.999Z` vs `00:00:00.000Z` next day) | newest first, string order = time order | pass |

### 4c. Relaunch survival and the split cascade (real SQLite)

| Case | Expected | Result |
|---|---|---|
| Deleted item across two relaunches (+10 d, +20 d): steps, logs, off mark, as-needed use intact | all present | pass |
| Expired (+31 d) item removed: task, steps, day logs, per-task off marks, as-needed uses gone | gone | pass |
| Same relaunch: `xp_award` rows kept with `task_id` NULL; lifetime XP 16 unchanged; level unchanged | unchanged | pass |
| Same relaunch: achievement unlocks and the cycle record untouched | unchanged | pass |
| Same relaunch: whole-day off mark (`task_id` NULL) kept; per-task one removed | kept | pass |
| Same relaunch: widget `fixed_task_id` set to NULL, widget still configured | NULL | pass |
| Purging one expired item leaves a live task's history and XP alone | live task intact | pass |

### 4d. restore / deleteForever / purgeDeleted on the wrong item (real SQLite)

| Case | Expected | Result |
|---|---|---|
| Live task: restore and deleteForever | NOT_FOUND from both, task unchanged | pass |
| Unknown id: restore, deleteForever | NOT_FOUND; purge returns 0 | pass |
| `purgeDeleted(null)` with nothing deleted | 0, live tasks untouched | pass |
| Already restored: restore, deleteForever | NOT_FOUND; task still live | pass |
| Already deleted for good: restore, deleteForever, softDelete, get | NOT_FOUND, NOT_FOUND, NOT_FOUND, null | pass |
| Second softDelete | NOT_FOUND; first deletion time kept (30 days not restarted) | pass |
| Restore twice / deleteForever twice | second is NOT_FOUND each time | pass |
| `purgeDeleted(cutoff)` counts only older items; second call 0 | 1, then 0 | pass |
| `purgeDeleted(null)` removes all deleted, keeps live, keeps XP | 2 removed, XP 48 | pass |
| Log for a task deleted for good | refused by FK, no orphan `day_log` | pass |

### 4e. Restore round trip (real SQLite and fake hooks)

| Case | Expected | Result |
|---|---|---|
| Task, steps, logs, off marks, as-needed uses, XP after delete + restore | identical (updatedAt aside) | pass |
| 10 delete / restore cycles | no drift | pass |
| Restored item not purged by a later launch | kept, logs intact | pass |
| Delete, restore, then edit | edit lands, history stays | pass |
| Restore after a relaunch | works | pass |
| Task pushed to tomorrow before deletion (snooze): `useTaskOccurrences` and `useToday` after restore | same as before; pushed occurrence (`pushedFrom`) present | pass |
| Aggregate and per-task consistency and `useTasks` after round trip | identical | pass |
| Priority rank after restore | kept (2) | pass |
| Five delete / restore cycles, then log again | history 1 log; logging works | pass |
| Delete, restore, edit (hook) | edit lands | pass |

### 4f. While deleted (real SQLite and fake hooks)

| Case | Expected | Result |
|---|---|---|
| `list()` hides it; `list({includeDeleted})` and `listDeleted()` show it; `get()` returns it | as stated (N1) | pass |
| Its logs, XP, whole-day marks stay in account-wide tables | XP unchanged | pass |
| `useToday` on the day (dated today) excludes it; `useTasks` excludes it | only the live task | pass |
| Aggregate consistency excludes it | equals a world without it (N5) | pass |
| `useTask(id)` still returns it, with `deletedAt` set | documented (N1) | pass |
| Achievements already earned stay earned while deleted and after restore | unchanged | **Before: "fallback-comeback" lost (B3)**; pass after fix |

### 4g. Backup, erase, restore (real SQLite and file-system double)

| Case | Expected | Result |
|---|---|---|
| Deleted item inside a backup, restored after erase | still deleted, same `deleted_at`, logs intact | pass |
| Restored-from-backup item expires on the original schedule | kept at 30 d, gone at 31 d + 1 ms | pass |
| Backup holding an item already past 30 days | restore brings it back; next launch removes it (N3) | pass |
| Erase all with deleted items | everything gone, no `day_log` or `xp_award` rows | pass |

### 4h. Ordering and the purge-first read

| Case | Expected | Result |
|---|---|---|
| `listDeleted` newest first (three items, 1 s apart) | third, second, first | pass |
| Two items deleted in the same millisecond | both listed (order not promised) | pass |
| `useRecentlyDeleted` purges items older than 30 days before listing; newest first | `[recent, mid]`, old gone from store | pass |
| Item deleted exactly 30 days before "now" stays in the list | kept | pass |
| Nothing deleted | empty list | pass |

### 4i. Concurrency (real SQLite)

| Case | Expected | Result |
|---|---|---|
| `restore` and `deleteForever` fired together | exactly one ok; database agrees with the winner | pass |
| Two `deleteForever` fired together | one ok, one NOT_FOUND | pass |
| `purgeDeleted(null)` fired with `restore` of one item | restored item live with its logs; the other removed | pass |

### 4j. Hooks and writes aimed at a deleted task (fake repos)

| Case | Expected | Result |
|---|---|---|
| `useDeleteTask` emits `task:changed` and the item moves to Recently deleted | yes | pass |
| `useDeleteTask` on an already-deleted item | refused; deletion time not restarted | pass |
| `useRestoreTask` on a live item | refused, no event | pass |
| `useDeleteForever` on a live item; twice; on an unknown id | refused | pass |
| `useEmptyRecentlyDeleted` with 0 deleted, then 2 deleted | 0, then 2; live item stays | pass |
| Restore after the purge | refused; nothing comes back | pass |
| XP and award rows across delete, restore, delete for good | identical | pass |
| `useLogState` on a deleted task | NOT_FOUND; no log; no XP | **Before: ok (B2)**; pass after fix |
| `useToggleStep` on a deleted task | NOT_FOUND; no change | **Before: ok (B2)**; pass after fix |
| `useLogDose` on a deleted task | NOT_FOUND | **Before: ok (B2)**; pass after fix |
| `useSnoozeOccurrence` / `useUndoSnooze` on a deleted task | NOT_FOUND; no pointer set | **Before: ok (B2)**; pass after fix |
| `useMarkOffDay` for a deleted task | NOT_FOUND; no mark | **Before: ok (B2)**; pass after fix |
| `useLogAsNeededUse` for a deleted task | NOT_FOUND; no use row | **Before: ok (B2)**; pass after fix |
| `useUpdateTask` on a deleted task | NOT_FOUND; name unchanged | **Before: ok (B2)**; pass after fix |
| `useDuplicateTask` on a deleted task | NOT_FOUND; no copy | **Before: ok, a live copy appeared (B2)**; pass after fix |
| After restore, the same writes work again | yes | pass |

### 4k. Existing suites

All 17 `src/db` and `src/queries` suites (225 tests, including the 67 new) pass. The 13 retention unit tests are in the domain project.

---

## 5. Files changed

| File | What and why |
|---|---|
| `src/domain/retention.ts` | `daysLeft` capped at `DELETED_KEEP_DAYS` (B1). One line. |
| `src/queries/mutations.ts` | New `liveTask` helper (line 230, B2); all task writes resolve through it; explicit refusals in `markOffDay` (658), `useLogAsNeededUse` (688), `useUpdateTask` (401), `useDuplicateTask` (489); new `persistEarnedBadges` (416) called first in `useDeleteTask` (434, B3); `TaskWithSteps` added to the type import. Live-task behaviour unchanged. |
| `src/queries/testSupport/fakeRepos.ts` | `softDelete` and `duplicate` now mirror the real repository (B4); imports `now` from `@/lib/date`. Test support only. |

## 6. Tests added

| File | What it checks |
|---|---|
| `src/domain/retention.test.ts` (new, 13 tests) | Retention arithmetic: cutoff, `daysLeft` at every boundary, the 30-day cap, time-zone independence, string format. |
| `src/db/__tests__/recentlyDeleted.test.ts` (new, 38 tests) | Real SQLite (file-backed, relaunch): sweep boundaries; relaunch survival; split cascade; restore / deleteForever / purge edges; restore round trip; while deleted; backup, erase, restore; ordering; concurrency. |
| `src/queries/recentlyDeleted.test.tsx` (new, 29 tests) | Real hooks against fake repos: purge-first read; delete / restore / delete-for-good / empty; XP never moves; restored item resolves as before (pushed occurrence, consistency, today, priority); while deleted; writes to a deleted task refused; achievements persistence. |

## 7. Problems for the UI agent (not edited by me)

1. **Deleted tasks still come back from `useTask(id)`, `useTaskOccurrences` and per-task `useConsistency`** (N1). A screen that opens a deleted task should treat `deletedAt !== null` as "not found" and leave, rather than show it as live.
2. **New refusals reach the screens.** `useLogState`, `useToggleStep`, `useLogDose`, `useSnoozeOccurrence`, `useUndoSnooze`, `useMarkOffDay`, `useLogAsNeededUse`, `useUpdateTask` and `useDuplicateTask` now return `{ ok: false, error: { code: 'NOT_FOUND', message: 'Task not found.' } }` for a task in Recently deleted. A sheet or screen that still holds such a task should handle this result and must not show the internal message text verbatim.
3. **The Undo toast after delete** calls restore. Restore returns NOT_FOUND once the item has been deleted for good (or emptied by the purge). The toast must not claim success in that case.
4. **Recently deleted screen:** `restore`, `deleteForever` and `empty` return NOT_FOUND for an item already gone (for example, emptied from another screen). Handle it calmly.
5. **Compile errors in other agents' files**, which `npx tsc --noEmit` reports: 12 in `app/settings/data/deleted.test.tsx` (earlier run; `TestInstance | undefined` at lines 121-296), and 3 in `app/recentlyDeleted.screens.test.tsx` at the last run. Not mine, not fixed by me.

## 8. Problems for the human

1. **N5:** deleting a task changes last-7 / last-30 / all-time consistency immediately, and purge makes the change permanent. Decide whether that is wanted, or whether consistency should keep counting deleted tasks until purge.
2. **N2:** the boundary is strict: at exactly 30 days the item is still kept, and shows "0 days left" for one millisecond. Say if `<=` is preferred.
3. **N4:** `updated_at` changes on delete and on restore.
4. **N6 (not verified):** a fixed-task widget that points at a deleted task probably shows nothing. The services owner should check.

## 9. Not done / unsure

- **Not verified in a running app:** the XP-on-deleted-task outcome before the fix is inferred from the code path (`logState` → `reconcileOccurrence` → XP award), not observed in a run. The write itself was observed (`ok: true`).
- **Widgets and notifications** were checked only by reading `services/widgets` and `services/notifications`, which both filter to live tasks. No test was added there (not my area).
- **Clock:** the SQL tests use a controlled clock (`globalThis.__rdNow`). Time-zone independence is shown for the pure functions only. The stored instants are UTC ISO strings, so SQL does not depend on the device zone.
- **Search and priorities:** covered through `useTasks` (the default list excludes deleted items), not through the search screen or the priorities screen.
- **Git:** only read-only git commands were used (`git show`, `git diff`). No files outside my area were edited.
