# 23. Browse tabs, search, priorities, Progress, assistant (Sonnet edge pass, 2026-11-20)

Files added: `src/features/browse/edge.browse.test.tsx` (26), `app/progress/edge.progress.test.tsx` (7),
`src/features/assistant/__tests__/edge.assistant.test.tsx` (22), `src/features/assistant/__tests__/edge.assistantChat.test.tsx` (4).
Result: 59 new tests pass. The neighbouring suites (browse, search, priorities, progress, assistant, services/ai, 23 files, 197 tests) pass. No tsc errors in my files.

## Tests
Routines: one routine; 300 routines; emoji and very long names; weekday filter (Tue shows "No routines on Tuesdays", Mon clears it, routine still listed under Other); `cadenceRunsOnWeekday` for every cadence kind; only-ended routines (not the empty state, newest first, dates); ended as-needed not in As needed; 12-hour time at midnight/noon.
Events: today, tomorrow; only past one-offs; ended repeating under Ended only; three on one day.
Courses: not started yet; ended early; one-day course; only past courses; no end date.
To-dos: only notes; double tap on the checkbox; write that throws.
Search: case, partial words, emoji, trimming, regex characters as plain text, ended item findable, no matches then Clear all, note result and importance filter, nothing at all.
Priorities order: rank then oldest-first, ended/done/note/past/finished items drop out, empty and equal ranks.
Progress: default task, to-dos and as-needed never chips, picked task deleted, ended task still a chip, no history, only off days, no tasks, 100 percent and emoji.
Assistant tools (real mutations over fake repos): log_state after a habit ended, on a deleted habit, habit ended mid-chat, garbage dates (5 shapes), unknown state, positive control; update/delete on deleted; delete on ended; create with emoji, whitespace name, 5000-char name, unknown type, null args, unknown tool, backwards course.
BYO provider: key only to the configured host and only in the Authorization header; trailing slash; probe host and no logging; missing key; 401; network failure; connection dropped mid-stream; garbage frames and broken tool-call JSON; transcription failure.
Chat hook: unapplied call is explained; provider throws mid-stream; provider cannot be created then Try again; whitespace message.

## Bugs fixed
1. Garbage `log_state` date or state was accepted and written (`toolExecutor.ts`, `log_state` case; `isRealLocalDate`, `CHIP_STATES`). A model saying "tomorrow" or "2024-02-30", or state "banana", got `applied: true`. Now refused before any write.
2. `create_task` with a type outside the four (and `update_task` patch with one) was accepted (`toolExecutor.ts`, `TASK_TYPES`). Now refused; null args refused.
3. A BYO base URL saved with a trailing slash produced `//chat/completions` (`byoProvider.ts`, new `endpoint()`); the probe already trimmed, so save worked and chat then broke. Also applied to transcription.
4. A connection dropping mid-reply threw out of both providers (`byoProvider.ts` stream loop, `managedProvider.ts` stream loop), and any throw in `getAssistantProvider`/streaming was an unhandled rejection from the send tap (`useAssistantChat.ts` `streamAndApply`). Now an error event, then the offline banner with Try again.
5. A tool call the app could not apply (task ended or deleted, invalid input) vanished silently (`useAssistantChat.ts`, `DROPPED_CALL_LINE`). Now one calm line: "I couldn't do that one. It may have ended, been deleted, or not been something I could set up. Nothing was changed."
6. Progress: if the picked task was deleted, the chips showed none lit while the numbers were for the deleted task (`app/progress/index.tsx`, `activeTaskId`). Falls back to the first trackable task.
7. Courses: a course ended early read "Completed <planned last day>" (a future date) and the full planned length; a course not yet started read "Day 0 of N"; "1 days" (`CoursesBrowseScreen.tsx` `CourseRow`). Now ends on the end day, "Starts Mmm d", "1 day".
8. To-dos: a quick double tap on the checkbox ran the write twice (two Done toasts, doubled sound) (`ToDosBrowseScreen.tsx`, per-task in-flight guard).
9. Search results gave no sign a habit was ended (`SearchScreen.tsx`): now an "Ended" pill.

## Checked, no bug
Key handling: the key goes only to `baseUrl` in the Authorization header, never in the body or URL, read fresh per call from SecureStore (WHEN_UNLOCKED_THIS_DEVICE_ONLY); no `console.*` in services/ai or the assistant; no analytics in the app. Logging from `ErrorBoundary`/`events.ts` does not touch the key. Writes to deleted tasks are refused. Ended habit: log_state for a day after its last day is refused; delete is allowed.

## Left for the main session (not fixed)
- A 401 from the BYO endpoint (bad key) maps to the same "offline" banner as a network failure; the message text is not shown. Calm, but misleading. Needs a copy decision (an "Check your key" line) and a distinct error code in `app/assistant/chat.tsx`.
- BYO requests send no task list (managed sends names and ids), so with BYO the model has no ids for `update_task`, `delete_task`, `log_state` and can only create. Design gap, not a regression.
- S40 accepts an `http://` base URL, sending the key in clear text if the person types one. Consider requiring https except localhost (`app/assistant/paywall/byo.tsx`, not in my area).
- Events tab never lists past one-off events (only Today and Upcoming); a person with only past events sees "Nothing coming up". Matches the S11 spec; they stay searchable. Flagging in case it surprises.
- Priorities screen (`app/priorities/index.tsx`, outside my list): `move` writes ranks one by one; if the app is killed midway the order is partly saved. Not tested at screen level.
- Search does not fold accents ("cafe" does not find "café") or collapse double spaces.

## Needs a real phone
Keyboard behaviour in Search, drag/long-press feel, the SSE stream over a real flaky mobile connection (only simulated here), SecureStore on a locked device, screen reader announcements.
