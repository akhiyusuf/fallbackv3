# Edge campaign 22: reminders and widgets (Haiku)

Area: things that happen without the app on screen. Owned: `src/services/notifications/**`,
`src/services/widgets/**`, `app/settings/notifications.tsx`, `app/settings/widgets.tsx`.
Screens were read, not changed.

## Tests added

`src/services/notifications/edge.reminders.test.ts`: 25 tests, 24 pass, 1 `it.failing` (a known gap, see below).

Which occurrences get a reminder
- PASS a habit logged done today gets no reminder for today, but still gets the other six days
- PASS a habit skipped (missed) today gets no reminder for the rest of today
- PASS a day off for every habit silences that day only
- PASS a day off for one habit silences only that habit
- PASS a habit ended three days ago gets no reminders and no re-entry nudge
- PASS a habit ended yesterday sends no "yesterday slipped by" nudge (was a bug, fixed)
- PASS as-needed habits, to-dos and deleted habits get no reminders of any kind
- PASS a one-off event reminds once, on its own date only
- PASS a course stops giving dose reminders after its end date
- PASS a snoozed-away day gets no reminder; its snooze target is reminded only if naturally due
- FAIL-AS-EXPECTED (`it.failing`) GAP: a pushed-in occurrence on a day the habit is not naturally due gets no reminder

Rescheduling after a change
- PASS a time change moves the same reminder (stable identifier, new clock time)
- PASS 00:00 and 23:59 land on the exact minute of their day
- PASS a re-arm that started before the master switch was turned off cannot re-arm after the cancel (was a bug, fixed)
- PASS master off: everything cancelled, nothing armed
- PASS permission denied: nothing armed, no error, reschedule never asks for permission

The "missed yesterday" nudge
- PASS not sent for a habit created today, even with no log
- PASS not sent when the habit was logged yesterday
- PASS not sent when yesterday was a day off
- PASS not sent for a deleted, as-needed or to-do habit
- PASS sent at most once, even when several habits were missed
- PASS uses one stable identifier, so a second re-arm the same day replaces it
- PASS not sent when the preference is off

Many habits and the platform limit
- PASS 30 habits: exactly 64 requests armed (iOS limit), and the soonest ones kept (was a bug, fixed)
- PASS under the cap, every reminder is armed (3 habits = 22 requests)

`src/services/widgets/edge.widgets.test.ts`: 10 tests, all pass.
- PASS empty state: zero due, percent null (never 0), empty list
- PASS done and fallback count as shown up; missed and pending do not; percent rounds (2 of 4 = 50)
- PASS one of three done rounds to 33
- PASS a habit ended yesterday is not in the snapshot
- PASS a to-do is never in the snapshot, even with a chip today
- PASS a fixed-task widget whose task was deleted: config keeps the id, task absent from the list (documents current behaviour, see below)
- PASS emoji and a 300-character name survive as valid JSON
- PASS an off-marked habit is listed as off and counted in totalDue (pins current behaviour, see below)
- PASS coming back to the foreground republishes the snapshot; background does not (was a bug, fixed)
- PASS a failing foreground republish never throws out of the AppState handler

Existing suites (`index.test.ts`, `schedule.test.ts`, `snapshot.test.ts` for both services) pass unchanged. No assertion was weakened.
`npx tsc --noEmit`: no errors in these files (27 remaining errors are in other areas).

## Bugs fixed (source)

1. Re-arms could interleave. Every bridge event calls `reschedule()` without waiting, and each run cancels then re-adds. A run that read "master on" before a toggle could finish after the run that read "master off" and re-arm reminders the person had just switched off. Fix: runs are queued one at a time (`rescheduleChain`, `src/services/notifications/index.ts` ~line 123).
2. Reminders ignored the day's outcome. Only snoozed-away days were excluded. A habit already logged today, or marked off, still got a reminder for the rest of today (and every off day). Fix: the horizon's logs and off marks are read, each (habit, day) is resolved with `resolveOccurrence` (the same function Today uses), and anything not `pending` is skipped (`settledOccurrences`, ~line 138; `rescheduleOnce`).
3. Re-entry nudge for an ended habit. A habit ended yesterday was still "missed" yesterday, so the nudge fired about a habit the person had ended. Fix: `gentleReentryRequest` skips `endedOn != null` (~line 243).
4. No cap on pending notifications. iOS keeps 64 pending per app. With many habits the code armed 7 per habit plus digest and nudge, and the OS would silently drop the tail, which can be today's reminders. Fix: all requests are sorted by fire time and the first 64 are armed (`PENDING_LIMIT`, `rescheduleOnce`).
5. Widget snapshot went stale over midnight. The widget only republished on events, and nothing fires at local midnight, so a person who backgrounded the app over midnight saw yesterday's counts. Fix: `initWidgetsBridge` now republishes on AppState `active` (`src/services/widgets/index.ts`).

## Bugs left for the main session (not fixed)

- GAP (it.failing test): a pushed-in occurrence (additive push, a second occurrence on D+1) gets no reminder when the habit is not naturally due that day. The schedule is cadence-only (`buildRollingSchedule`). Whether a pushed occurrence should remind is a product call. Left as a failing test.
- Past-dated reminders are not filtered. `triggerDateFor` can produce a time earlier than now (for example, a 09:00 routine re-armed at 20:00). Expo's behaviour for a past DATE trigger is not known here. If it fires at once, every foreground re-arm could re-fire today's earlier reminders. Needs a phone check, and if confirmed, filter `fireAt <= now`. I did not filter, because the existing test expects the 8-call count regardless of clock time.
- Midnight with the app open: no event fires, so the 7-day horizon and "yesterday" do not roll until the next foreground or change. The widget is the same. Would need a timer to next local midnight.
- Gentle re-entry is pinned to 09:00 and armed only on a re-arm. If the first open after the missed day is after 09:00, the 09:00 trigger is already in the past (same open question as above). Product call on whether the nudge should be armed at all in that case.
- Ended today still reminds today. `isDue` treats the last day as due, so ending a routine at 10:00 still reminds at 18:00 the same day. Consistent with Today showing it. Design question.
- Off-marked habits count in the widget's `totalDue` and lower the percent (the test pins this). Whether an off day should count in the widget denominator should match Today's own rule, which I did not verify.
- Fixed-task widget pointing at a deleted or ended task: the snapshot keeps `fixedTaskId` verbatim and drops the task from `tasks`. The native side must show an empty state. The native code is not in this repo's TypeScript and was not checked.
- `app/settings/notifications.tsx`: turning "Allow notifications" on while the OS permission is denied does nothing and explains nothing. The screen never asks for permission or links to system settings. Copy and flow decision, not changed.
- The daily digest is armed for seven days even with no habits. Minor.

## Test-command note for the whole campaign

The brief's command `--selectProjects app <path>` does not filter. `--selectProjects` takes a list, so the path is read as a project name and the whole `app` project runs (124 suites). Put the paths first: `npx jest <paths> --selectProjects app --maxWorkers=2 --forceExit`.

## What only a real phone can confirm

- Whether the OS delivers each reminder at its time, including after a force-quit and after a reboot.
- What happens to a DATE trigger whose time has already passed (see the past-dated item above).
- The iOS 64-pending behaviour, and whether the soonest-first cap matches what the OS keeps.
- Android: the channel, Doze and exact-alarm limits, and whether the channel is created before the permission prompt.
- The permission denied flow in the real OS dialog, and what the toggle shows after the person changes it in system settings.
- Midnight and DST: the 00:00 and 23:59 tests only check the trigger's hour and minute in the test's timezone, not a real DST change or a clock change.
- The home-screen widget refresh timing, the App Group read, and what the widget draws for an empty snapshot or a missing fixed task.
- Tap-through from a notification from closed, and the splash handoff.
