# 21 - Creating and editing, and onboarding: edge-case pass (Sonnet)

## Summary
30 new tests (21 forms, 9 onboarding/real-store), all pass. Also ran the existing app/add, app/onboarding, app/splash, app/coldStart, app/recovery, src/features/onboarding and app/task/[id] (except another agent's edge.taskPage) suites: pass. `npx tsc --noEmit`: no errors in my files. Bugs fixed: 6. The "couldn't save" seen on the phone was NOT reproduced; every path I could build ends in the retry toast with the real reason, with no duplicate routine and no stuck spinner (see below).

NOTE on the run command: `--selectProjects app <path>` swallows the path as a second project name and runs the whole suite. Put the path first: `npx jest <path> --selectProjects app ...`. Under load, existing tests time out at 5 s; I used `--testTimeout=60000`.

## Tests added
`app/add/edge.forms.test.tsx` (fake repos)
- Routine: whitespace-only name refused; padded name with emoji saved trimmed, 190+emoji name kept whole; fallback typed but no ideal refused; ideal typed but no fallback refused; ideal of only spaces is not a step; weekly with no day picked refused; three taps in one moment with a slow store save one routine; a save that THROWS ends in the toast, Save usable, data kept; as-needed with only a name saves with no steps.
- Event: whitespace-only name refused; two taps save one; event in the past is allowed and saved on that date; time 00:00 and 23:59 both kept (midnight is not "no time"); tracking on with blank steps saves no blank steps.
- Course: end on the start day allowed; fallback with no ideal refused; doses per day clamp to 1..12; two taps save one.
- To-do: whitespace-only name refused; two taps save one; emoji and padding saved trimmed.

`src/features/onboarding/edge.onboarding.test.tsx` (REAL SQLite through the real queries and the real FirstTaskScreen)
- Store not open yet: toast detail is "Database is not open yet.", Save usable, typed text kept; after `store.open()` the next press saves one routine and finishes onboarding.
- Whitespace-only name: error, nothing saved.
- 200+ character name with emoji, padded name and steps: saved trimmed and whole.
- Three presses with a slow insert: one routine, one navigation.
- Settings row missing: routine saved once, toast detail "settings singleton missing"; after the row is back a second press finishes without a second routine.
- Database busy on the first insert: goes through on the quiet retry, no toast.
- Resume pointer: unknown route starts clean (no redirect); real later step resumes there; nothing saved starts at concept and marks it.

## Bugs found and fixed
1. **Create forms had no double-tap guard** (app/add/routine.tsx, event.tsx, course.tsx, todo.tsx). `loading={createTask.isPending}` only turns on after a re-render, so two quick taps made two tasks. Fix: `useSingleFlightSave` (a ref guard) in `src/features/task/formShared.ts`, used by all four.
2. **A save that threw was an unhandled rejection with no toast** (same four files). The same helper catches it and shows "Couldn't save that. Try again."
3. **Blank steps counted as steps** (routine, course, tracked event). The form starts with one empty ideal and one empty fallback, and the validators only check the list length, so a routine with a name and a day but nothing typed could be saved with an empty-text ideal step. Fix: `withoutBlankSteps` (trim, drop blanks) when building the draft; the existing "Add at least one ideal step" errors now show.
4. **Names were saved with their padding** ("  Run  " stored as typed) on all four forms. Now trimmed in the draft. (useCreateTask itself still stores `draft.name` as given; assistant-created tasks were not checked, not my area.)
5. **S20 task screen: Duplicate double tap made two copies; rename, step-schedule save and the icon picker Save let a thrown write escape** (app/task/[id]/index.tsx onDuplicate, saveName, saveSchedule; app/task/[id]/icon.tsx save). Added a ref guard on Duplicate and try/catch with the usual toast on the others.
6. **Splash could send a healthy store to Recovery** (app/splash.tsx). The sweep, theme hydrate, billing init and `takePendingTapRoute` sat inside the one try, so any throw from them (for example billing.init throwing synchronously, or a bad theme value) went to /recovery. Each is now its own best-effort step; the sweep failing, or any of them, never blocks start-up.
7. **A stale or damaged onboarding pointer** (src/features/onboarding/useOnboardingResume.ts). The pointer was passed to `router.replace` unchecked, so a value from another build or a damaged value navigated to a route that does not exist. Now only the seven real step routes are accepted; anything else starts the tour clean.

## The "couldn't save, try again" on a real phone
Walked every path through FirstTaskScreen against real SQLite: store not open (toast reason "Database is not open yet.", recoverable by a later press), settings row missing (reason shown, no duplicate routine on retry), database busy (quiet retry works), slow store (single save), throw (toast, spinner stops). I could not make it fail on a path that did not show a reason. Candidate causes that need the phone to confirm: (a) a second SQLite connection or the OS holding the WAL file for longer than the two tries (150 ms inside the proxy plus 400 ms between the screen's two attempts); (b) the store failing to open on that launch and the person getting to onboarding anyway. If it happens again the toast now carries the real message; ask for that text.

## Left alone, for the main session or the human
- **Store never opens (hangs)**: the splash waits on `store.open()` with no timeout, so a native open that never returns spins for ever. `open()` itself never rejects. I did not add a timeout because /recovery calls `open()` again and two concurrent opens would race on migrations. A guarded "still opening after N seconds" needs a decision from the db owner.
- **First task: edits after a failed finish are ignored.** If the routine saved but the "onboarding finished" save failed, the name and steps are no longer saved on the next press (createdRef skips the create), so edits made in between are lost without a message. Rare; fix would be to update the created task instead.
- **Names have no length cap.** A 200 character name saves fine and is kept whole; layout on very long names needs a look on the phone (Today card, task header).
- **Past events** and **course ending in the past** are allowed (nothing in the spec forbids them).
- **Duplicate names** are allowed everywhere (no rule).
- No sound choice exists in onboarding (nothing to remember). Theme and accent: picks save at once (earlier pass), splash hydrates them; covered by existing tests, not re-tested across a real restart.
- The pointer in SecureStore is cleared by erase-all (lifecycle.ts SECURE_STORE_KEYS includes it).
- Existing `edge.taskPage.test.tsx` (another agent) has a type error (`UNSAFE_root`) and failures; not mine.

## Needs a real phone
Android hardware back and gesture after Skip/Save, kill mid-onboarding and relaunch (SecureStore persistence across a real kill), real SQLite file locking, the keyboard on step 7, the date and time dialogs at 00:00 and 23:59 (tested through the picker stand-in), long names on screen.
