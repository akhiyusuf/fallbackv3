# 46 - Screen-level accessibility (round 4, edge campaign)

Owner: Haiku agent, round 4, area SCREEN-LEVEL ACCESSIBILITY (round 2 checked the shared kit; this pass checks whole screens).
Owned for fixes: `src/ui/**`, and accessibility props only in `app/**` and `src/features/**`. No copy constants, no layout.
New test file: `app/edge.screensA11y.test.tsx`.
Read first: `review/EDGE-BRIEF.md` (all rounds), `review/haiku/29-a11y-wording.md` (the round-2 open item on the toast).

## 1. Results

| Check | Result |
|---|---|
| `npx jest app/edge.screensA11y.test.tsx src/ui/Toast.test.tsx src/ui/edge.a11y.test.tsx app/add/routine.test.tsx --selectProjects app` | 4 suites, **155 passed**, 0 failed |
| Earlier run, before the toast and label fixes | new file: 2 failing (both fixed); a wider run of 18 suites: 22 failing, of which the three fixed suites are in section 5 and the rest are other agents' wording changes (section 5) |
| `npx eslint` on the new file | 0 errors; 9 warnings, all import-order or the deliberate lazy `require` (the file-level disable line covers `no-require-imports` only; `import/first` remains) |
| `npx eslint` on the changed `src/ui`, `src/features` and `app/settings/theme.tsx` files | 0 errors; 2 warnings in files I did not change (`SearchScreen.tsx` exhaustive-deps, `ListGroup.tsx` unused `RADIUS`) |
| `npx tsc --noEmit` | no errors in my files. Remaining errors are in other agents' files: `app/edge.weekOfUse.test.tsx:72` and `src/queries/edge.undo.test.tsx:161` / `src/db/__tests__/edge.undo.test.ts:176` (`fs` types), `src/db/__tests__/edge.undo.test.ts:113` (`LocalDate`) |

Git: several of my edits (`src/ui/Tabs.tsx`, `src/ui/ListGroup.tsx`, `src/features/task/StepListEditor.tsx`, `src/features/progress/CelebrationHost.tsx`, `src/features/search/SearchScreen.tsx`, `app/settings/theme.tsx`, `src/features/browse/ToDosBrowseScreen.tsx`) were already swept into HEAD `f60cc05` by another session's checkpoint commit. The changes still uncommitted from this pass are `src/ui/Toast.tsx`, `src/ui/Toast.test.tsx`, `src/ui/edge.a11y.test.tsx` (the toast block only), `app/add/routine.test.tsx` (one selector) and the new test file. Nothing was committed or pushed by me.

## 2. What "one header per screen" was taken to mean

Read literally, every section label (for example "Due today", "Schedule", "Ideal") would have to lose its heading role. I did not do that: VoiceOver and TalkBack use headings to jump between sections, and the app already marks them. The check is therefore:

- every screen has at least one heading, and its first heading is the screen title;
- no heading text is said twice on the same screen (this is what caught the duplicate "Theme" on the theme screen).

If the human wants section labels to stop being headings too, that is a one-prop change in `src/ui/ListGroup.tsx` (`SectionHeading`) and is a judgement call for the main session.

## 3. Tests added (`app/edge.screensA11y.test.tsx`, 55 tests)

Sample data: a daily routine with an ideal and a fallback (`Evening walk`), a weekday routine (`Read`), an event (`Dentist`), a course (`Spanish`), a to-do (`Renew passport`), an as-needed task (`Water plants`), and a settled consistency history for Today.

**Every main screen (49 tests, one per route):** Today, Routines, Events, Courses, To-dos; the task page for each kind (routine, event, course, to-do, as-needed); the add menu and the four add forms; search; Progress, its trend, Achievements, Records, a cycle record, Priorities; Settings, and Data, Recently deleted, Erase, Notifications, AI agent access, Subscription, Account and sync, Theme, Widgets, Help; the assistant (home, chat, history, one conversation, paywall, plan, own key, microphone primer); the onboarding steps (concept, hook, types, consistency, personalize, notifications, first task); recovery. Each one checks:
- at least one heading, and no heading said twice;
- every pressable that a screen reader can reach has a role, a label, and a label that says what it does (not a bare word such as "button", not an icon name), and no label is used by two controls on the same screen;
- every pressable that a touch can reach is also reachable by a screen reader (no silent controls);
- every switch and checkbox exposes checked or not;
- the screen shows some words (guards against a silent blank render).
- No load error in any route file.

**Key screens (6 tests):**
- Today reads in order: the header, the date, the header buttons, the consistency ring ("Showing up"), the achievements and priorities cards, the emergency day-off switch, "Due today", the summary line ("0 of 1 done"), the habit card with its log controls, then "Add task".
- A logged habit says its name and its state: after Done, the control reads "Evening walk, Ideal done. Change", the Done control disappears from the list of choices, the toast is an alert with its message as the name, and the message is announced.
- The toast's Dismiss is a named action (`dismiss`), not a focus stop; a focus stop reads the message.
- A milestone is announced with its headline when it arrives, and the same headline is one of the screen's headings.
- The add-routine form's two Add step buttons are told apart (`Add step: Ideal step`, `Add step: Fallback step`).
- The theme screen has one "Theme" heading.

Also updated (not weakened): `src/ui/Toast.test.tsx` gained three tests (the spoken message, focus on the message, the Dismiss and Undo actions); its "dismisses on tap" test now finds the visible Dismiss by label, because the alert, not Dismiss, is the focus stop. `src/ui/edge.a11y.test.tsx` (round 2, the toast block) asserted `role button, name Dismiss`; it now asserts the alert is the focus stop and Dismiss is a named action. `app/add/routine.test.tsx` looked up `Add step` by exact label; it now matches `/^Add step/`, because the button's label now names the list.

## 4. Bugs found and fixed

1. **Toast: focus read "Dismiss", the message sat inside it (the round-2 open item).** `src/ui/Toast.tsx`. The whole body was one Pressable labelled "Dismiss", and the message was its child, so a screen reader focusing it said "Dismiss" and never the message. Fix: the alert View is now the single focus stop (`accessible`), its label is the message and detail, and Dismiss and the action are `accessibilityActions` (`dismiss`, and the action's own label). The visible Dismiss area and the Undo button stay exactly where they were, marked `accessible={false}` so they are not separate focus stops. **No visual change**; tapping the message still dismisses. How a person hits it: a TalkBack or VoiceOver user lands on a toast and hears "Dismiss" and has to swipe back to learn what was saved or undone.

2. **Toast read "Ideal done., +10 XP".** `src/ui/Toast.tsx` (`spokenMessage`). The label joined message and detail with a comma after a message that already ended in a full stop. The announcement (`announceForAccessibility`) now also carries the detail, so it matches the label (`Ideal done. +10 XP`).

3. **Two "Add step" buttons with the same name.** `src/features/task/StepListEditor.tsx`. On the new routine and new course forms the ideal list and the fallback list both had an "Add step" button, and a screen reader user could not tell which list a button would add to. Label is now `Add step: Ideal step` / `Add step: Fallback step` (the list's own item label). Visible text unchanged.

4. **The theme screen said its heading "Theme" twice** (the screen title and the section label). `src/ui/ListGroup.tsx` (`SectionHeading` gained `heading`, default `true`) and `app/settings/theme.tsx:125` passes `heading={false}`. The section label is still read as text.

5. **The To-dos screen had two "To-dos" tabs** (the Routines/To-dos segment, and the bottom tab bar). `src/ui/Tabs.tsx` (`TabItem.accessibilityLabel`, optional, falls back to the visible label) and `src/features/browse/ToDosBrowseScreen.tsx` (the lens is named `To-dos list`). Visible text unchanged.

6. **The celebration was never announced.** `src/features/progress/CelebrationHost.tsx`. The pop-up appeared over the screen with no announcement; the headline is now announced when it arrives (`headlineOf` gives the same text the pop-up prints). A screen reader user no longer has to find it.

7. **The search screen's magnifier was readable as an unlabelled graphic.** `src/features/search/SearchScreen.tsx` (the leading icon in the search field is now hidden from screen readers; the field's own label is unchanged).

## 5. Failing tests I dealt with

| Suite | Test | Why it failed | What I did |
|---|---|---|---|
| `src/ui/edge.a11y.test.tsx` | toast is a labelled alert, 16 themes | Asserted `role button, name Dismiss`, the old structure that bug 1 changed on purpose | Updated to assert the new structure (alert focus stop, Dismiss as a named action). Recorded here. |
| `app/add/routine.test.tsx` | S16 "empty ideal-step ... banner" | Looked up `Add step` by exact label; bug 3 changed the label | Selector now `/^Add step/`. |
| `src/ui/Toast.test.tsx` | dismisses on tap | Looked up `button, name Dismiss`; Dismiss is no longer a focus stop | Finds it by label, same tap. |

Failures that are **not from this pass** (other agents' copy edits, in progress in the working tree; I did not touch them):
- `app/edge.journeys.test.tsx`, journeys 1, 3 and 4: the onboarding headline is now "A plan A and a plan B for every habit." (capitalised, `src/features/onboarding/copy.ts`), and the Today stat is now "Showing up" (`src/features/today/copy.ts:15`), so the journeys' `/^Consistency/` lookup fails.
- `src/features/browse/ToDosBrowseScreen.test.tsx`, two tests: the Done toast is now `Done.` (`src/features/browse/ToDosBrowseScreen.tsx:74`), the test expects `Done`.

## 6. Found and left (needs a decision or a phone)

a. **Decorative icons not hidden.** About six icons sit outside any focus group and have no label: on Today (the emergency day-off row), the add menu (its header row), Settings (one row) and Account and sync (two), Theme (one, next to the preview), and the paywall (one). A screen reader does not stop on them (they are not focusable and have no label), so the practical effect is small, but they are not marked hidden. Hiding them means editing about six call sites; I left them for the main session's decision, with the screens named here. Icons inside a focus group (the rows, the log buttons, the task hero) are hidden by their group and are fine.

b. **Emergency day-off row is read twice.** The row's text ("Emergency day off", "The whole day. Nothing due today counts against you.") is read as plain text, then the switch reads "Emergency day off, the whole day". Not changed: the fix is a grouping or wording change on a screen the human has approved.

c. **Toast may be read twice on Android.** The toast is announced by `announceForAccessibility` and is also a polite live region, so TalkBack may speak the message twice. Not verifiable here. Needs a phone check; if it does, the live region is the one to drop (the announcement is the reliable one).

d. **Sheets and dialogs.** The Dialog scrim carries `accessibilityViewIsModal` (checked in the code, not in a test), which tells VoiceOver to ignore the screen behind. TalkBack has no equivalent here, so the screen behind a sheet can still be reached by swipe on Android. Phone check.

e. **Records by cycle.** The record detail screen was checked with a made-up cycle id, so it shows its "could not load" state, not a real cycle. A real cycle needs a seeded cycle record.

f. **Logged state wording.** A logged habit reads "Evening walk, Ideal done. Change", which is clear. The log buttons before logging read "Evening walk: Done" with the selected state false. Both are fine; recorded so nobody thinks the state is missing.

## 7. What I could not test here (needs a real phone)

- VoiceOver on iOS and TalkBack on Android: the actual order of stops, what is spoken on focus, the custom actions menu, and the double announcement in (c).
- Large text: the toast's two-line message and the stop order at the largest text size.
- Reduced motion: the celebration confetti and the Tabs slide.
- Real taps on the toast's visible Dismiss area (unchanged size, but nobody has pressed it since the focus change).

## 8. Files I changed (this pass)

| File | Lines | Why |
|---|---|---|
| `src/ui/Toast.tsx` | the render, `spokenMessage` | bug 1 (focus, actions), bug 2 (punctuation, announcement) |
| `src/ui/Toast.test.tsx` | new tests, the dismiss test | the new structure |
| `src/ui/edge.a11y.test.tsx` | the toast block (round 2) | the new structure, see section 5 |
| `app/add/routine.test.tsx` | one selector | bug 3 |
| `src/features/task/StepListEditor.tsx` | the add button's `accessibilityLabel` | bug 3 (in HEAD `f60cc05`) |
| `src/ui/ListGroup.tsx` | `SectionHeading` `heading` prop | bug 4 (in HEAD `f60cc05`) |
| `app/settings/theme.tsx` | line 125 | bug 4 (in HEAD `f60cc05`) |
| `src/ui/Tabs.tsx` | `TabItem.accessibilityLabel` | bug 5 (in HEAD `f60cc05`) |
| `src/features/browse/ToDosBrowseScreen.tsx` | the lens's `accessibilityLabel` | bug 5 (in HEAD `f60cc05`) |
| `src/features/progress/CelebrationHost.tsx` | `headlineOf`, announce effect | bug 6 (in HEAD `f60cc05`) |
| `src/features/search/SearchScreen.tsx` | the icon's hidden props | bug 7 (in HEAD `f60cc05`) |
| `app/edge.screensA11y.test.tsx` | new | 55 tests |

No copy constant, style, colour or layout changed in this pass. There is no visible change; every fix is an accessibility prop, a label, or the toast's focus structure.

## 9. Not done / unsure

- Section headings are kept as headings (section 2). A human decision if they want the strict reading.
- The icons in section 6a were not hidden.
- The round-2 "Dismiss" open item is closed in code and in tests, but it needs a TalkBack and VoiceOver check before it counts as done.
- The journeys and To-dos failures in section 5 are from other agents' wording edits in progress. They will need the owners' updates to their tests, not a change here.
