# Design decisions — consistency rebuild

Written by the orchestrator, **verbatim from the human** (picks and note), plus
the definition of each chosen option exactly as it was shown to the human on the
decision board. No agent may edit the "Human's picks" section.

## Provenance

- 2026-11-16. The human asked for "a tough ui/ux audit" of the built app and a
  board where they "choose between one thing or the other thing", so that the
  app is then rebuilt "so that everything is consistent".
- The audit was run against the built app (60 screens captured from a browser
  build of the real code). The board presented 21 decisions, each with the
  app's current behaviour and two or three options, and a list of 24 bugs that
  need no decision.
- The human returned the picks below in conversation.

## Precedence

`design-input/**` remains human-owned and is not edited. Where a decision below
conflicts with `design-input/fallback-handoff/uploads/ALLSCREENS_1.md`, the
Verdant design system or `fallback-theme.css`, **this file wins**: it is a later
instruction from the same human who approved those. Everything this file does
not mention stays as specified there.

This file changes **presentation and interaction patterns only**. It does not
change what the product does: the PRD's features, the consistency maths, XP
rules, data model and the no-punitive-streaks rule are untouched. If a builder
finds that a decision cannot be met without changing a PRD acceptance
criterion, that is a question for the human, not a builder call.

## Human's picks (verbatim)

```
Fallback design choices

01. Logging a day: C (Two buttons: Done and Fallback)
02. What happens after you log: C (Toast for daily logs, pop-up for milestones)
03. Confirming something risky: B (Bottom sheet over the dimmed screen)
04. Screen header: A (Left-aligned, one size per level)
05. Opening a task: A (A page with a back arrow)
06. Onboarding top bar: A (Back, dots, Skip on every step)
07. Settings and menu rows: A (Grouped list with dividers)
08. Where Save lives on a form: A (Pinned bar at the bottom)
09. Picking one of a few options: A (Segmented bar)
10. Choosing days of the week: A (Circles)
11. Two buttons together: B (Main button, outlined button below)
12. Entering dates and times: A (The phone's own picker)
13. Details on a task card: A (One quiet line, pills only for status)
    note: I think this one could look a tad bit better, the other option looked visually appealing but lacked that scanability
14. Task icons: A (Coloured circle everywhere)
15. Empty screens: A (Button in the empty state, no +)
16. Badge grid: A (Four across)
17. Text size: A (Comfortable: 16 · 14 · 12)
18. Capital letters: A (Sentence case)
19. Section headings: A (Bold heading)
20. Corners: A (Soft: 16 cards, 12–14 controls)
21. The colour of XP: A (Gold)
```

## What each pick means

Each entry gives the rule, then what it replaces. "Everywhere" means every
screen S01–S50 and every shared component.

### D1 — Logging a day: two buttons, Done and Fallback

- A task that is due and not yet logged shows two equal, side-by-side outlined
  buttons: **Done** (double-check icon in the ideal green) and **Fallback**
  (check icon in the fallback blue). Below them, a quiet text action
  **Skip today**.
- "To do" is not a button. It is simply the unlogged state.
- Once logged, the row shows the resulting state as a state chip (Done /
  Fallback / Skipped). Tapping that chip reopens the same choices so the log
  can be changed or cleared back to unlogged.
- The same control is used on Today (expanded row), on the task screen, per
  dose on a course, and in the theme preview. A course with several doses
  labels each dose ("Dose 1", "Dose 2") and uses this control per dose; it must
  never render an unlabelled stack of controls.
- Replaces: the four-radio row (To do / Done / Fallback / Skip) that wraps at
  phone width, and the separate filled chip style in the theme preview.

### D2 — After you log: toast for daily logs, pop-up for milestones

- Logging Done or Fallback shows a **toast** on the screen you are on: state
  icon, "Ideal done" or "Fallback done", the XP earned, and an **Undo** action.
  It never navigates away and never requires a tap.
- The toast sits **above** the bottom tab bar and the add button; it never
  covers them.
- A **pop-up** (card over the dimmed current screen, with the celebration
  treatment) appears only for milestones: a level-up, a newly earned badge, a
  tenure badge.
- One dismiss label for every celebration pop-up.
- Replaces: the full-screen card on a blank page after every single log (S24),
  and the two different dismiss labels ("Continue" / "Nice!").

### D3 — Confirming something risky: bottom sheet

- Every confirmation (delete a task, erase all data, reset app data, cancel a
  destructive flow) is a **bottom sheet over the dimmed current screen**: grab
  handle, title, one sentence of consequence, then the button pair from D11.
- Dropdown option lists and the add menu use the same sheet component.
- Replaces: the card on a blank page (S22), the full-page erase layout, and
  any other bespoke confirmation presentation.

### D4 — Screen header: left-aligned, one size per level

- **Tab screens** (Today, Routines, Events, Courses, To-dos): 24 bold title,
  left-aligned, action icons on the right. Today keeps its date line.
- **Every other screen**: back chevron, then a 20 bold title, left-aligned, on
  the same row and at the same height everywhere. An optional action sits at
  the right end.
- One shared header component implements both levels. No screen draws its own.
- Replaces: ten different header layouts (titles at 18/20/22/24/28, two
  vertical positions, centred variants, no-title variants).

### D5 — Opening a task: a page with a back arrow

- A task screen (including as-needed tasks) is a pushed page: back chevron,
  the task's coloured icon circle, the task name as a 20 bold **title** (not a
  text input), and a "more" (···) menu at the right holding Rename, Duplicate
  and Delete.
- The close cross is reserved for sheets that create or pick something: the
  add menu and the icon picker.
- Replaces: the task screen that closes with a cross and has the name as a
  text box in the header, while the as-needed task screen uses a back arrow.

### D6 — Onboarding top bar: back, dots, Skip on every step

- Every onboarding step has the same top bar at the same height: back chevron
  on the left (hidden on the first step), progress dots in the centre with
  **one dot per step**, **Skip** on the right.
- Replaces: four different top layouts across seven steps, five dots for seven
  steps, and the step where every dot is lit.

### D7 — Settings and menu rows: grouped list with dividers

- A group is a bold section heading (D19) **above** one card. Rows inside the
  card are separated by hairline dividers, not individual borders.
- A row is: icon, label, optional current value in muted text, chevron.
- A chevron is the only sign that a row opens a screen. No "→" typed into
  labels anywhere in the app.
- Applies to Settings, Help & about, Widgets, and any other menu-like list.
- Replaces: bordered rows inside bordered cards, bare text rows without icon
  or chevron, and one-card-per-row lists.

### D8 — Save on a form: pinned bar at the bottom

- Every create/edit form has a bar pinned to the bottom of the screen holding
  the single primary action. It stays visible while the form scrolls and sits
  above the keyboard.
- Cancel is the header's back chevron (or the sheet's cross). There is no
  separate Cancel link and never a second Save.
- Replaces: Save at the end of a long scroll with a Cancel link beneath it,
  and the icon picker's two Save buttons.

### D9 — Picking one of a few options: segmented bar

- Choosing exactly one of **two to four** short options uses the segmented
  bar, full width.
- **Five or more** options, or options with long labels, use the dropdown
  field that opens an option sheet.
- Chips are reserved for **multi-select filters** (e.g. Search).
- Exception: subscription plans keep selectable cards, because each carries a
  price and a description. They use one card style on every screen that shows
  plans.
- Replaces: chips, radio cards, radios and dropdowns all being used for
  single-choice inputs.

### D10 — Days of the week: circles

- One weekday control everywhere: seven circles lettered M T W T F S S,
  accent-filled when selected. Used on the routine form, the per-step schedule
  grid, and the day filter on the Routines tab (single-select mode there).
- Replaces: ticked rounded squares on the step grid and the joined strip on
  the Routines tab.

### D11 — Two buttons together: main button, outlined button below

- Any pair of actions is stacked full-width: the primary (or destructive)
  button on top, the secondary as an **outlined button** below it. Never a
  text link for the second action, never side by side.
- Permission primers use the same pair and the same labels: **Allow** /
  **Not now**.
- Replaces: primary + text link, side-by-side pairs, and "Enable" vs "Allow".

### D12 — Dates and times: the phone's own picker

- A date or time field is a tappable field showing a human-readable value
  ("Mon, Nov 16", "7:00 PM") with a calendar or clock icon. Tapping opens the
  platform's native date/time picker.
- No raw ISO text ("2026-11-16") is ever shown or typed.
- Replaces: free-text date and time inputs.

### D13 — Details on a task card: one quiet line, pills only for status

- Under the task name, details are one muted line of text separated by
  middots: schedule, then importance, then necessity (e.g. "Daily · High ·
  Recommended"). A value that is not set is omitted entirely.
- Ideal and fallback summaries are each a line of muted text led by a small
  colour dot (ideal green, fallback blue).
- A pill is only ever a **live status**: Due, Off today, One-time, As-needed.
- **Open refinement.** The human's note: "I think this one could look a tad
  bit better, the other option looked visually appealing but lacked that
  scanability". The structure above is decided; its visual polish is pending
  the human's pick of a refined treatment. Build it as **one shared
  component** used by every task card so the refinement is a one-file change.
- Replaces: up to five identical grey pills per card, and pills that read
  "Importance" / "Necessity" when nothing is set.

### D14 — Task icons: coloured circle everywhere

- A task's icon always appears as a filled circle in the task's chosen colour
  with a white icon: Today rows, browse lists, search results, task screen,
  widgets previews.
- The add menu's type icons use the same circle shape.
- Replaces: plain grey outline icons in lists and grey circles in the add
  menu.

### D15 — Empty screens: button in the empty state, no +

- A screen with nothing on it shows: icon, a one-line title, one muted line,
  and one button that starts the add flow. The floating add button is hidden
  until the screen has content.
- A section that is merely empty inside a screen that has other content shows
  one line of muted text, not a full empty-state illustration.
- Replaces: an empty state button plus the floating add button on the same
  screen, and the full "No events today" illustration above real events.

### D16 — Badge grid: four across

- Badges are laid out four per row in every category, all visible without
  horizontal scrolling.
- Replaces: three per row with ragged last rows.

### D17 — Text size: comfortable

- Only these sizes are used, all from the existing `FONT_SIZE` tokens: **12**
  (captions), **14** (secondary text and labels), **16** (body, task names,
  buttons), **18** (section headings, D19), **20** (screen titles), **24**
  (tab screen titles), **32** (hero numbers). 40 and 56 remain available for
  the existing display numerals only.
- No raw font size, weight or line height in screen code: tokens only.
- Replaces: thirteen sizes including the off-scale 11, 13, 15, 22, 26, 28.

### D18 — Capital letters: sentence case

- Every title, heading, button, row label and menu item is sentence case:
  only the first word and proper names are capitalised ("New routine", "Use
  your own AI key", "Restore purchases", "Save & connect").
- Product and brand names keep their capitals (Fallback, Fallback AI, Google
  Play, App Store).

### D19 — Section headings: bold heading

- A section is introduced by a bold sentence-case heading placed above its
  content (above the card, not inside it). One style everywhere.
- Small uppercase labels are not used as section headings.

### D20 — Corners: soft

- Only the existing `RADIUS` tokens are used: **16** for cards, dialogs, the
  top corners of sheets, and buttons (the kit's Button already uses it),
  **12** for inputs and other controls,
  **8** for small inner elements (checkboxes, calendar cells), fully round for
  pills, chips, avatars and circles. No new radius tokens.
- No raw radius in screen code: tokens only.

### D21 — XP colour: gold

- XP amounts, the XP bar, level labels and "+N XP" use the celebration gold
  family already in the tokens.
- The fallback blue is used **only** for the fallback state.
- Colour meanings, app-wide: green = ideal, blue = fallback, gold = reward,
  accent = tappable primary action.

## Bugs to fix in the same rebuild (no decision needed)

### Wrong words
1. The delete button says "Delete routine" on events, to-dos, courses and
   as-needed tasks. It must name the right thing.
2. The add-step button reads "+ + Add step".
3. A course screen shows users the phrase "the same F3 mechanic", an internal
   spec code. The wording is verbatim from `ALLSCREENS_1.md`; the human was
   told it would be reworded and did not object. Reword in plain language.
4. The microphone primer prints "Audio is processed only when you tap the
   mic." twice.
5. The paywall shows "Restore purchases" twice.
6. The Settings profile card always says "Maya".
7. One permission screen says "Allow", the other "Enable" (see D11).
8. One headline uses an emoji where every other screen uses line icons.

### Controls on the wrong screen
9. To-dos and untracked events show the day-state card, the off-day toggle,
   Snoozable and a calendar. None applies to them.
10. "Cancel subscription" is offered to people on the free plan.
11. Onboarding has a full-width accent "Preview" button that does nothing.
12. "Erase all data" is a card with no affordance showing it can be tapped.
13. Doses per day is a free-text box. It becomes a stepper.
14. The show/hide control for the API key sits outside the field it controls.
15. The stat card on Today does not say what its percentage measures.

### Layout that breaks
16. The toast covers the bottom tab bar (see D2).
17. On Widgets, the label "To do" breaks across two lines.
18. Onboarding type cards are uneven widths on both screens that use them.
19. The level heading wraps mid-phrase.
20. The trend chart is an unlabelled thin line with no axis, dates or values.
21. Events shows a full empty-state illustration above events that exist (see
    D15).

### Under the hood
22. Five header components, two of them identical files, become one (D4).
23. Raw font sizes, weights and corner radii in screen code are replaced by
    tokens (D17, D20).
24. A test is added that fails when screen code uses a size, weight or radius
    that is not a token, so this cannot drift again.

---

# Round 2 — contrast and hierarchy (2026-11-16, human-directed)

After seeing the rebuilt preview the human asked for a contrast and hierarchy
pass, reported that the Today date and settings button sat too close to the
edge, and reported a bug: to-dos were being stored as notes. Applied by hand to
the browser preview (see `docs/design-rebuild/`); awaiting look approval.

## What the audit measured

Every visible text run and icon on 41 screens, in light and dark, was measured
against the surface it sits on (WCAG 2.1: 4.5:1 for text, 3:1 for large text
and icons). The script is `docs/design-rebuild/preview-harness/contrast.js`.

Before: roughly 26 failing colour pairs on content in light and 15 in dark
(counted by hand from the first run, leaving out disabled controls and hidden
elements). After: none on content. What the script still lists is not content:
disabled controls, the empty track of a progress ring, hidden duplicate tab
icons and screen-reader-only text.

| Was failing | Measured | Now |
|---|---|---|
| White label on the orange button (`#F2601A`) | 3.25 | Buttons and selected controls use a deeper orange `#C8490C` (4.76). The bright orange stays for marks with no text: task icon circles, progress, onboarding dots. |
| "Done" / "Fallback" labels and "Ideal done" chips (green `#5F8A3E`, blue `#4E82A8`) | 3.6–4.0 | Text-grade green `#46702A` and blue `#34678F` (5.2–6.0). The fills in bars and dots are unchanged. |
| Faint grey `#A09C92` used for real text: placeholders, calendar numbers, tab labels | 2.6–2.7 | `#716D64` (4.7–5.2). Inactive tab labels use the muted text colour. |
| Gold XP text `#A8853B` | 3.0–3.4 | `#7D5F14` (5.3–6.0). The gold bar fill is unchanged. |
| White ticks on green and blue calendar cells | 2.2–2.3 | Dark ink ticks (6.8–7.1). |
| Active tab label, orange on white | 3.25 | Accent text colour `#B4400A` (5.7). |
| Dark mode: accent badge text, "Due" pill, red delete icon, faint grey | 1.9–4.4 | Light tints of each accent for text on dark, `#FF7A7A` for danger text, `#A09A90` for faint grey (all 4.7 or better). |
| Field and control outlines `#D6D3CC` | 1.5 | `#8F8A80` (3.1–3.4) so inputs, circles and checkboxes are visible by their outline. |

## Hierarchy changes

- **Cards now stand off the page.** The page is a warm paper tone `#F6F4F0` and
  cards, fields, the tab bar and the pinned action bar are white. Before, cards
  were a shade darker than a white page and separated only by a hairline. Dark
  mode already worked this way (cards lighter than the page).
- **One orange for controls.** Buttons, the add button, switches, checkboxes
  and selected chips all use the deeper orange, so nothing on a screen competes
  with the main button.
- **Card details line.** The first item is slightly stronger; cards leave out
  the defaults (medium importance, recommended) so only what stands out shows.
- **Header room.** A tab header with a date line has space below it before the
  first card, and header icons sit further from the right edge.

## New accent tokens

`accent.fill` (behind white text), `accent.fillEdge` (its pressed edge) and
`accent.text` (accent-coloured text and icons for the current scheme) join
`base`, `hover`, `deep`, `soft`. Berry's fill is `#CE2C65`; indigo and plum
already passed and use their base colour.

## Bug fixed — to-dos stored as notes

A to-do and a note are the same task type. The app told them apart by whether
the item had any detail text, so a to-do with a detail was filed under Notes.
The kind is now an explicit choice:

- New column `task.is_note` (migration 005). Existing items keep the list they
  were already shown in.
- The add form has a "To-do / Note" switch at the top.
- A to-do's "···" menu has "Change to a note" (and the reverse) to move one
  that was filed wrongly.

**This is a data-model change.** It needs `docs/SCHEMA.md` and the PRD's To-do
wording updated through the architect before it lands in `src/**`.

## Open with the human

- The orange buttons are deeper than the brand orange. The alternative that
  also passes is bright orange with dark text.
- The theme screen's orange swatch still shows the bright orange.

# Round 3 — colour and themes (2026-11-16, human-directed, awaiting picks)

The human: the app "looks quite dull… I think it has to do with the coloring",
and asked how to keep an exciting theme while letting users change it. They
also asked that every audit be delivered as an artifact like the design board.

Delivered as the **Fallback Colour Board**
(https://claude.ai/artifact/LyQoUUtexW8HddWpTRKQkR). Source:
`docs/design-rebuild/colour-board/`.

## Measured (preview build, sample data, 390×760)

| | Light | Dark |
|---|---|---|
| Today: pixels carrying any colour | 2.7% | 2.6% |
| Routines | 3.0% | 3.1% |
| Task | 1.2% | 1.1% |
| Progress | 1.3% | 1.3% |
| Settings | 0.1% | 0.1% |

Switching Orange → Indigo changes 1.0% of Today, 2.0% of Routines and 0% of
Settings. Scripts: `colour-board/cov.js`, `colour-board/diff.js`.

## Proposed model

A theme is one seed colour. Every other shade (solid, text on solid, tint,
coloured text, page tone) is derived by rule and contrast-checked
(`colour-board/engine.js`). Ideal green, fallback blue and XP gold never change
with the theme, and theme hues are kept away from them and from error red.

## Decisions on the board (option A is always the app today)

| # | Decision | Recommended |
|---|---|---|
| 01 | Top card on Today | B — solid theme colour |
| 02 | Page background and borders | B — a hint of the theme |
| 03 | Done and Fallback buttons | B — soft fill |
| 04 | A logged task | B — whole card takes the state colour |
| 05 | The green and the blue | B — brighter |
| 06 | Tab bar | B — tinted pill behind the active tab |
| 07 | Text on the theme colour | B — bright shade, best-contrast text |
| 08 | What people choose | B — named themes with a preview |

Nothing here is applied yet. The human's picks are pending.

## Also fixed in the preview this round

The Settings → Theme preview drew a made-up card (ring, three chips, a Save
button) that exists nowhere else. It now renders the same `TodayTaskCard`
component the Today screen uses, so the two cannot drift apart.
