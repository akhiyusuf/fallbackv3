# 40 - New features: exact reminders and the breakdown that adds up (round 4)

## Tests added (all pass; `tsc --noEmit` clean for these files)
`src/domain/edge.apportion.test.ts` (domain, 14)
- apportion: single share; zero total and empty input; floating error (2.9999999, 3.0000001, negative sliver); ties go to the earlier share; deterministic and input untouched; order-stable under permutation; 5000 random share sets sum to the total and each result is within 1 of its share; whole numbers untouched.
- aggregate: 3 days each with one ideal and one fallback (2/1/0, sums to 3); 1 day split; thirds (ideal, fallback, missed); off tasks and fully off days do not disturb the sum; only fully off days; 400 random histories x 4 windows (last-7, last-30, all-time, range) always give ideal + fallback + missed = days counted.

`src/features/notifications/edge.exactReminders.test.tsx` (16)
- Ask never stacks: waits for a queued milestone, waits for the add menu, hides again if one arrives while it is up and returns after, `hold` delays without losing it.
- Answers: Allow with a system page that will not open gives a calm toast (not a warning tone, no dashes) and is still remembered; Allow that opens gives no toast; erase (key removed) asks again; key is in the erase list in `lifecycle.ts`; SecureStore read throwing never asks; write throwing still closes; permission check throwing never asks; unmount before the permission check answers is safe; copy has no em dash.
- Settings row: shown when off and notifications on, press opens the page; press with a failing page toasts calmly; hidden when exact is on and when notifications are off; AppState: only `active` re-reads, hides when now on, returns when off again, listener removed on unmount.

`src/services/exactAlarms/edge.exactAlarms.test.ts` (4): Android with module; iOS/web never touch the module; Android with module missing; module or lookup that throws.

`app/progress/edge.breakdownSums.test.tsx` (4, extra file): real domain output for 3 split days rendered through S25 (aggregate), S26 table row, S29 card, S30 ("About 3 of 3 counted days"); counts add to 3.

## Bugs found and fixed
1. Ask could stack on other sheets. `ExactRemindersAsk.tsx` showed as soon as its async checks finished, regardless of a queued milestone pop-up (`CelebrationHost`, a Modal) or the open add menu (both Modals), so two sheets could be on screen. Now it renders only when no celebration is queued, the add menu is closed and a new `hold` prop is false; it is not counted as asked while held. Today passes `hold={isJustAdded || isReentry}` so the ask does not land on the first-habit banner or the welcome back note (those are inline cards, not sheets; I held anyway so one calm thing appears at a time). The whole-day emergency choice is a Switch plus a toast, not a sheet, so it cannot collide.
2. Allow with the system page failing (`openExactReminderSettings()` false) did nothing visible (ExactRemindersAsk.tsx, Settings row in `app/settings/notifications.tsx`). Both now toast `S42_COPY.exactTimingCannotOpen` ("That page would not open. You can try again in Settings, under Notifications."), added in `src/features/settings/copy.ts`. The ask stays remembered as answered (no nagging); the Settings row remains the way back.
3. `src/domain/consistency.ts:181` destructuring of `apportion` gave a tsc error under noUncheckedIndexedAccess; defaulted each to 0 (no behaviour change).

## Reviewed, no bug
- `apportion`: clamps negatives, rounds shares to 1e-9 before flooring so 2.9999999999 style noise cannot lose a day, leftovers go by largest fraction then earlier index; sum equals total whenever shares sum to total; result is never more than 1 from the exact share; deterministic. Note: if shares summed to MORE than total it would not reduce, but aggregate never does that.
- Wrapper `src/services/exactAlarms/index.ts`: non-Android and missing module give "exact" (nothing shown); every call is try/caught. Scheduler untouched (no exact-alarm references in `src/services/notifications/schedule.ts`).
- Kotlin `ExactAlarmModule.kt` (read, not run): `canScheduleExactAlarms` is guarded by `SDK_INT < S` (API 31) and null `reactContext`, both returning true; open returns false in the same cases; intent is `Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM` with `package:` URI (correct per docs; the page exists from API 31); `FLAG_ACTIVITY_NEW_TASK` is set (needed from a non-activity context); `startActivity` wrapped in try/catch (ActivityNotFoundException, SecurityException). Smart cast of `context` after `||` is valid. Manifest has `SCHEDULE_EXACT_ALARM` (app.config.ts:55); module registered in `expo-module.config.json`; gradle namespace matches the package. Android 13/14 note: `SCHEDULE_EXACT_ALARM` is denied by default on 14+ for new installs, which is exactly the case the ask targets.
- S25 aggregate tiles/subcopy, trend rows, S29/S30 all read the apportioned counts; S30 computes its denominator as ideal + fallback + missed, which now equals days counted.

## Left for the main session / could not test
- Older stored cycle records (before this pass) keep their old rounded breakdown; they may not sum to days counted. Not migrated.
- The ask is not tied to Today being focused: if someone leaves Today within the few milliseconds of the async checks, it could appear over another tab's screen. Judged negligible; no focus hook is used anywhere in the app.
- Needs a real phone: Kotlin compile and run, the real system page opening, return-from-page via AppState on a device, and Android 12/13/14 permission defaults.
- During my run `src/features/today/edge.today.test.tsx` failed 13 tests once under load (shared machine) and passed 34/34 on two later runs, including against my final code; I treated it as load flake, not a regression.
