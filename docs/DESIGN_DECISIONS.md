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

Picks received and applied to the preview: see "Round 3 — picks" below.

## Also fixed in the preview this round

The Settings → Theme preview drew a made-up card (ring, three chips, a Save
button) that exists nowhere else. It now renders the same `TodayTaskCard`
component the Today screen uses, so the two cannot drift apart.

# Round 3 — picks (2026-11-16, human)

| # | Decision | Pick |
|---|---|---|
| 01 | Top card on Today | B — solid theme colour. Note: "I'm not really feeling the contrast with the black against the orange though" |
| 02 | Page background and borders | B — a hint of the theme |
| 03 | Done and Fallback buttons | B — soft fill |
| 04 | A logged task | B — whole card takes the colour |
| 05 | The green and the blue | B — brighter |
| 06 | Tab bar | B — tinted pill |
| 07 | Text on the theme colour | B — bright shade, best-contrast text |
| 08 | What people choose | C — themes plus your own colour (differs from the recommendation) |

With it, verbatim: "we should be a bit more strict on the colours users are able
to choose though, I also feel the microphone should be inside of the plus
screen, it doesn't really scream AI voice, also enable ai mcp usage (this'll
allow an ai agent go in and help the user, with strict permissons coming from
the app for the user to approve of of course)".

## How each was applied (preview only)

- **Theme engine** (`src/theme/engine.ts`). A theme is one seed colour; the
  solid, its text colour, a deeper band, the tint, coloured text and the page
  tone are derived and contrast-checked. 680 pair checks across 5 named themes
  and 15 extra colours, light and dark: 0 failing
  (`docs/design-rebuild/colour-board/allthemes.ts`).
- **01 + the note.** `StatHero`: the top card is the bright theme colour with
  **white** text. White on the bright orange is 3.25:1, which is enough for
  large bold text only, so the number (40px) and the label (20px bold) sit on
  the bright colour and the small line sits on a deeper band where white is
  4.6:1. No dark text on the card.
- **07.** Buttons, selected chips and selected days keep the bright colour
  with whichever of near-black or white reads at 4.5:1 (near-black on Forge,
  white on Indigo, Berry, Plum). Icons and large text use white where 3:1
  holds (the add button). *Open:* if dark labels on orange buttons also feel
  wrong, the choices are the deeper orange with white, or larger button
  labels.
- **02.** Page, surfaces and borders take 5% of the seed in light and 7–13% in
  dark; secondary text and outlines are re-checked on the tinted page.
- **03 / 04 / 05.** Soft-filled Done and Fallback; a logged card takes the
  state colour with a filled tick and a "change" chevron; ideal is `#22A94E`,
  fallback `#2B93EE` (dark: `#2DBE5E`, `#3D9DF2`).
- **06.** The active tab sits on a pill of the theme tint.
- **08, made stricter.** Five named themes (Forge, Indigo, Berry, Plum, and a
  new Lagoon) shown as preview cards, plus "More colours": 15 fixed swatches,
  not a free slider. The person chooses a hue only; brightness and strength
  are fixed. Greens, sky blues, golds and reds are not offered because those
  hues mean ideal, fallback, XP and error.
- **Microphone.** Removed from the Today header. Fallback AI now leads the add
  sheet as "Tell Fallback AI — Say it or type it. It sets it up for you."

## Data-model changes this round (need the architect)

- `settings.accent_ext` (migration 006): themes beyond the original four and
  custom colours (`hue-<n>`). `settings.accent` keeps its CHECK; `accent_ext`
  wins when set. The architect may prefer a table rebuild.
- `AccentKey` widens to `NamedTheme | hue-<n>`.

## New feature request — AI agent access over MCP (NOT built)

The human asked to "enable ai mcp usage". This is a new product feature, not a
look change, so it is **not** implemented. What exists is a design reference:
`app/settings/agents.tsx` + `src/features/agents/store.ts` (in-memory, no
server, labelled "Design preview" on screen). It shows: off by default; a
permission per kind of action (see / log / add and edit / delete / read
notes); "Ask me every time" as the default for anything that changes data;
delete can never be pre-approved; an approval sheet per request; a list of
things an agent can never do; an activity log; disconnect.

It must go through Phase 1 (requirements → features → PRD → Gate 1) before any
of it is built. Open questions for the human:

1. **How does an agent reach the app?** A phone app cannot be an MCP server
   that outside agents call. It needs either a hosted relay tied to an account
   (which depends on the still-open cloud sync decision, F20), or it only works
   with an agent running on the same device.
2. Is this free, or part of the Fallback AI subscription?
3. Approvals when the app is closed: by notification, or do requests wait?

# Round 4 — whole-app polish (2026-11-16, human-directed, awaiting picks)

The human: "Why do I feel as though it is only the today screen you worked
on? … the entire app needs polish. We are consistent in design, but like it
doesn't feel polished enough … polish this app to feel like one of those
polished productivity apps. Think Duolingo, but don't change the color that we
have."

They were right. Round 3's structural changes reached Today, Theme and the add
sheet; every other screen only inherited tokens. Measured on preview v5
(light, sample data, 390×760; `polish-board/cap.js`):

| Screen | Colour | Screen | Colour |
|---|---|---|---|
| Today | 15.1% | Progress | 1.3% |
| Routines | 3.1% | Achievements | 1.5% |
| Events | 1.4% | Records | 0.4% |
| Courses | 1.6% | Trend | 0.3% |
| To-dos | 1.0% | Settings | 0.1% |
| Task | 1.0% | Notifications | 0% |

Delivered as the **Fallback Polish Board**
(https://claude.ai/artifact/QeDRSAQgHWe5bwxRpj2Tsh); source in
`docs/design-rebuild/polish-board/` (it reuses `colour-board/engine.js` and the
colour board's base styles). Colours are unchanged in every option.

| # | Decision | Affects | Recommended |
|---|---|---|---|
| 01 | Typeface | every screen | B — rounded (Nunito) |
| 02 | Card and button depth | every screen | B — chunky, with an edge |
| 03 | A headline on every tab | Routines, Events, Courses, To-dos | B — headline card |
| 04 | Routine and course cards | Routines, Courses, Search | B — the week at a glance |
| 05 | Top of a task screen | every task | B — block in the task's colour |
| 06 | Progress screen | consistency, trend | B — ring, stat tiles, thick bar |
| 07 | Levels and badges | Achievements, Settings | B — medallions, thick XP bar |
| 08 | Settings and list rows | Settings, Notifications, options | B — icons on a theme-tint tile |
| 09 | Empty screens | Events, To-dos, Records, … | B — illustration and a button |
| 10 | Onboarding | seven first-run steps | B — coloured top with a picture |
| 11 | How the app reacts | logging, buttons, progress | B — responsive |
| 12 | The voice screen | Fallback AI | B — listening orb |

## Round 4 — picks (received 2026-11-16) and how each was applied

Applied to the preview only (Fallback Preview, version 6). Not in `src/**`.

| # | Pick | The human's note | Applied as |
|---|---|---|---|
| 01 | Typeface: **not decided** | "the fraction should be within the circle" | Defaulted to the rounded face (Nunito) so the look can be judged; one line to switch back. Every ring now carries its own figure inside it (`ProgressRing` `label`), Today's hero included. |
| 02 | B — chunky, with an edge | — | `cardSurface()` in `src/ui/surface.ts`: 2px outline, 5px bottom edge, 20px corners. Cards, list groups, stat tiles, log buttons, chips. Pressed = edge collapses. |
| 03 | B — a headline on every tab | "shouldn't look or feel like the main one too much… redundant, inconsistent, confusing instead of being simple" | New `TabSummary`: one quiet tinted row (a mark, one fact, one line), ordinary text size. Never the solid card Today uses. It replaces information rather than repeating it: on Events it stands in for the empty "Today" section. |
| 04 | B — the week at a glance | — | `WeekStrip` + `useWeekStrip` on routine and course cards (last seven days), with the plan on one line beneath. |
| 05 | B — a block in the task's own colour | — | `TaskHero`: wash of the task colour, icon on a solid tile, name large, week strip. The screen title becomes the type ("Routine"). |
| 06 | B — ring, stat tiles, thick bar | — | Progress reuses Today's `StatHero`, then three `StatTile`s (ideal, fallback, off), then the breakdown bar at 14px. |
| 07 | B — medallions and a thick XP bar | — | Level medallion, 16px XP bar, "N XP to level N+1". Earned badges are solid gold coins; locked ones are flat and quiet. |
| 08 | B — icons on a tile of the theme tint | — | `ListRow` `icon` sits on a 32px tinted tile everywhere. |
| 09 | B — a small illustration and a button | "in dark mode the circles representing dates need to be a bit brighter" | `EmptyArt`, drawn from the theme's own colours. The calendar's dots use the solid signal colours, so they stay bright in dark mode. |
| 10 | B — a coloured top with a picture | — | `OnboardingShell`: solid theme-colour top holding the step dots, a tile with the step's icon, a green and a blue tick. Back and Skip sit on white pills. |
| 11 | **C** — responsive, plus a little celebration (recommendation was B) | — | `src/ui/motion.tsx`: buttons press down, the tick pops, logging the ideal throws a ten-piece burst. All skipped when the OS asks for reduced motion. |
| 12 | B — a listening orb | "maybe a star and the waveform combined (a waveform within the star icon)" | `VoiceMark`: a four-point star with five wave bars inside it. Large and moving on the voice screen, small and still on the add sheet. |

Further feedback while this was being applied:

- **"This reads as AI. I'm talking about the green bar under the card."** A
  logged card no longer has any coloured edge: it sits flat in its state colour
  (`settledSurface()`), as if pressed in. The Done and Fallback buttons keep a
  tonal edge (a slightly deeper shade of their own fill), never a saturated one.
  Rule for builders: a raised edge is always a tone of the surface it belongs
  to, never a second colour.
- **"I'm not a fan of how big the text is for Thursday"** (Events headline on
  the board). The tab headline uses body-size text; the date sits in a small
  tile.

Checks on the preview build: contrast audit over 41 screens in both
appearances — no failures beyond the known disabled controls and
screen-reader-only text; 680 theme checks (5 named themes, 15 hues, both
appearances) — 0 failing.

### Round 4, second pass (same day, preview version 7)

Feedback on version 6: the consistency page did not feel polished, and the
tinted cards (task header, the headline row on Routines, Events and Courses)
"need contrast".

- **Tinted cards.** New `tintedSurface(t, colour)` in `src/ui/surface.ts`: a
  stronger wash (20% of the colour in light, 30% in dark) closed by a 2px
  outline in a deeper tone of the same colour (50% / 62%). Flat, no thicker
  bottom edge. Used by `TabSummary` and `TaskHero`. Before, the wash was 13%
  with no outline and all but disappeared against the tinted page.
- **Consistency page.** The two segmented controls and the dropdown became
  one row of chips (All tasks, then each task with its own icon) and one
  window control. The hero reads "Showed up" on one line. Four tiles (ideal,
  fallback, off, missed) use the same marks as the week strip and double as
  the legend, so the bar lost its own legend and grew to 18px.
  Note: the screen now opens on the first task chip, as before; "All tasks"
  is the first chip rather than a second tab.

### Round 4, third pass (same day, preview version 8)

**Onboarding.** Feedback: the picture at the top must change with every step
and show what the words under it say; nothing in onboarding may need
scrolling, on any device; the design of the steps themselves is fine and stays.

- `OnboardingPicture`: one drawing per step, made from the theme's colours.
  1 a plant with a green and a blue leaf · 2 an "A" card and a "B" card ·
  3 the four task kinds · 4 a week of days and the bar they add up to ·
  5 the theme swatches · 6 one quiet notification · 7 an empty task card.
  It eases in on arrival (not under reduced motion).
- No scrolling: the coloured top gives up its height first (the picture scales
  down, then goes), and type and gaps tighten in two steps by the screen's real
  height (`useOnboardingDensity`: regular ≥ 760, compact ≥ 650, tight below).
  Measured with `preview-harness/ob.js`: all seven steps fit at 320×568,
  360×640, 375×667, 390×700, 390×776, 390×844, 412×915 and 430×932.
  The scroll view stays as a fallback for large accessibility text and the
  keyboard.

**New feature request — Priorities (built in the preview, NOT specified).**
The human: importance should be "its own category where each thing in high,
medium or low has its own hierarchy set by the user"; a person can look at all
their high priorities and arrange which matters most.

- In the preview: `/priorities`, three levels (High, Medium, Low, with
  counts), each a numbered list in the person's order, moved with up and down
  arrows. Reached from a "Priorities" row on Today and from a "No. 2 of 5 in
  High" row under Importance on a task's screen.
- Data: `task.priority_rank INTEGER NULL` (migration 007). Lower comes first;
  unplaced tasks follow, oldest first; changing importance clears the rank;
  a duplicate starts unplaced. Finished things drop out of the lists (done
  to-dos, notes, ended courses, past one-off events).
- This is a product feature, not a restyle. It needs Phase 1 before the
  architect touches it. Open questions for the human:
  1. Should the order do anything outside this screen (sort Today, sort the
     list tabs, decide which reminder comes first)?
  2. Should tasks with no importance be listed somewhere, to be sorted in?
  3. Arrows work everywhere and with a screen reader; is drag-to-reorder
     wanted as well on a phone?

### Round 4, fourth pass (same day, preview version 9)

Feedback: an onboarding step must not say the same thing twice (a picture of
the set-up, then the set-up itself). Steps 2, 4 and 6 read fine. And the
choice made on step 5 "doesn't register in the app after a user has clicked
Allow".

- **Rule for the pictures:** a step's picture shows the idea in its headline.
  It is never a small copy of the content under it. Steps 3, 5 and 7 broke
  that and were redrawn: 3 a planner page (was the four task kinds, which are
  the tiles below) · 5 a phone with a brush on it (was the theme swatches,
  which are the picker below) · 7 a seedling in a pot with a plus (was a task
  card, which is the form below; it also answers step 1's grown plant).
- **Bug found and fixed in the preview — reminders did not register.**
  Turning on "Gentle nudges" on step 5 and tapping Allow on step 6 left
  `notifications.master` on with every reminder under it off, so Settings said
  "No notifications set" and nothing would ever be sent. Allow now also
  switches on the reminders that screen describes: routine due, event
  starting, course dose, gentle re-entry. **This is a behaviour change the
  PRD owner must confirm** (which reminders "Allow" turns on).
- Also fixed: a step left behind in the navigation stack reported a height of
  zero and could push the shared density to "tight"; zero heights are ignored.
- **Decided by the human (preview version 10): reminders are asked about
  once, on step 6.** The "Gentle nudges" switch is removed from step 5, which
  is now only the colour (body copy: "Pick the colour you'll see every day.").
  Step 6 is always shown, so the dots never skip. Allow turns reminders on
  (see above); Not now leaves them off, and turns them off again if the person
  comes back and changes their mind. Step 6 is pushed rather than replaced,
  so Back from step 7 returns to it. **This changes approved copy and flow for
  S06 and S07 in `design-input/` (human-owned): the PRD and the screen spec
  need the same change before builders work from them.**

### Round 4, fifth pass (2026-11-17, preview version 11)

Decisions from the human, applied to the preview:

- **The plus button.** Only Today's plus opens the sheet with every option.
  On Routines, Events, Courses and To-dos the plus goes straight to that
  tab's create form (To-dos opens "New note" when the Notes view is showing).
- **Fallback AI from a list tab (my suggestion, the human asked for one).**
  Each create form starts with one slim row, "Say it instead — Tell Fallback AI
  and it sets it up", which opens the assistant. Today's sheet keeps its own
  "Tell Fallback AI" row. To be confirmed by the human.
- **Onboarding order.** The plan A / plan B step now leads; "Something beats
  nothing" is second. Order: concept, hook, types, consistency, personalize,
  reminders, first habit. The app's entry route and the resume-after-kill
  check moved to the concept step with it.
- **Onboarding copy.** Step 1 headline is now "a plan A and a plan B for every
  habit." — the leading article in lower case, so the capitals belong to
  "plan A" and "plan B".
- **Snoozing is chosen at creation.** The routine form has a switch, "Can be
  moved to tomorrow" (on by default, hidden for as-needed routines). It sets
  the existing `task.snoozable`; no schema change. The task screen's switch
  uses the same words.
- **Undo, because the interface was unforgiving.** New Undo actions on the
  toast after: snoozing to tomorrow (same day — before, undo only appeared the
  next day), marking today off, and ticking a to-do. Logging already had one.

These change approved copy and flow in `design-input/` (S02, S03, S10–S13
plus buttons, S15 create routine, S20 snooze). The PRD and screen spec need
the same changes before builders work from them.

**Not done — deleting a task still cannot be undone.** Delete removes the
task's steps and history at once (`softDelete` cascades), so an Undo there is
not a restyle: it needs the delete to be deferred, or the rows kept until the
sweep. Architect decision; flagged to the human.

### Round 4, sixth pass (2026-11-17, preview version 12)

- **Onboarding step 2 ("Something beats nothing") looked empty.** It now has
  one card under the words, "The same week, twice": the same seven days shown
  as "The full version or nothing" (3 of 7 days) and "With a fallback"
  (7 of 7 days), drawn with the app's own week dots. Still fits without
  scrolling at all eight sizes.
- **Fallback AI pricing screen (S38) redrawn.** It opens with the star-and-wave
  mark, centred, then three benefit rows with icons, then the plan as the one
  tinted block (price large, one button), an "or" divider, and the bring-your-
  own-key card. Copy tightened: benefits are now a title and a line each; the
  own-key description and its fine print are shorter and plainer.
- **One mark for Fallback AI.** The loose sparkle icon is gone from the add
  sheet title and from the assistant's chat bubbles; both use the mark.
- **Step days sit under their step.** On the routine, event and course create
  forms, the separate "When each step applies" section is gone. Each step's
  day circles are directly beneath that step's field (`StepListEditor`
  `schedule` prop), with one line of explanation under the heading.

These change approved copy and layout in `design-input/` (S02, S15, S17, S18,
S38); the spec needs the same changes before builders work from them.

### Round 4, seventh pass (2026-11-17, preview version 13)

- **Widgets can be seen.** Settings, Widgets opens with a picture of the three
  widgets on a stand-in home screen, drawn from today's real tasks in the
  current theme and scheme (`src/features/widgets/WidgetPreviews.tsx`):
  *Small: today* (ring with the count, one dot per task in its state colour),
  *Small: one task* (icon, time, name, state) and *Medium: up next* (two rows
  and the day's count). The list below is now only the settings. The native
  widgets must match this picture.
- **Notifications can be seen.** In Settings, Notifications, every switch has
  its reminder drawn beneath it the way a phone shows it (app icon, "Fallback",
  time, bold first line, second line), using the person's own task names and
  the reminder service's wording. A sample is dimmed while its switch is off.
  With notifications off entirely, one sample is still shown.
  Found while drawing them: "Course ending soon" sends the raw date
  ("Runs through 2026-11-21."). The sample shows a readable date; the service
  needs the same fix.
- **Routines can have a time.** The routine form has an optional Time field,
  the task screen has a Time block to change it, and Today's card now leads
  with the time ("7:00 AM · Routine · Daily"). The Routines tab shows it after
  the cadence. No schema change: `task.time_of_day` already exists.
- **Mono theme.** A sixth named theme, black and white, in light and dark
  (`deriveMonoTheme` in the theme engine; stored through `accent_ext`). The
  state colours and each task's own colour are unchanged. Passes the same
  contrast audit as the others (714 theme checks, 0 failing; whole-app audit
  clean in Mono).
- **Sounds: list written, nothing wired yet.** 28 sounds with prompts, lengths
  and file names are in `docs/design-rebuild/SOUND_EFFECTS.md` and the
  "Fallback Sound List" page. They get wired into the preview when the human
  sends the files. Sound is a new feature and needs a PRD line, a Sounds
  switch in Settings and the architect's choice of audio library.

These change approved screens in `design-input/` (S09, S10, S15, S20, S42,
S43, S46) and the widget look; the spec needs the same changes before builders
work from them.

### Round 4, eighth pass (2026-11-17, preview version 14)

- **Light or dark is chosen in onboarding.** Step 5 ("Make it yours") now has
  the colour swatches and a Light / Dark / Match phone choice. It applies as
  soon as it is tapped and is saved with the colour on Next. Copy: body is
  "Pick a colour, then light or dark."; the section labels are "Colour" and
  "Light or dark".
- **Onboarding banners.** The coloured top of each step is now called the
  banner and has fixed sizes: steps 1 to 4 share one height, steps 6 and 7
  share another (smaller, because step 7's form is long), and step 5 takes
  all the room its short content leaves. Moving between steps eases the
  banner from the size it had to the new one (420 ms, ease in and out; no
  motion when the phone asks for reduced motion). Every step still fits
  without scrolling at all eight test sizes.
- **Banner pictures are replaceable.** `src/features/onboarding/bannerImages.ts`
  maps a step to an image; a step with no image keeps its drawn stand-in. The
  human wants AI-made pictures here in place of the drawings. None are made
  yet (see "Still open").
- **Empty screens.** The drawing, headline, line of text and button now sit
  in the middle of the space between the header and the tab bar, and at the
  same height on Today, Routines, Events, Courses and To-dos (`EmptyState`
  keeps fixed heights for its parts). Screens whose content fits no longer
  bounce or drag: `alwaysBounceVertical={false}` on every vertical scroller,
  and no rubber-banding of the page in the browser preview.
- **Sounds.** The human connected ElevenLabs and set two rules: no musical
  instruments, and do not go overboard. Twelve source sounds were generated
  (48 takes). The human picks on the "Fallback Sound Picker" page; editing and
  wiring follow the picks. Details in `docs/design-rebuild/SOUND_EFFECTS.md`.

These change approved screens in `design-input/` (S02 to S08 layout, S06
content, and the empty states of S09 to S13); the spec needs the same changes
before builders work from them.

### Round 4, ninth pass (2026-11-17, preview version 15)

- **Sounds are in the preview.** The human picked takes (iron rod on an iron
  bar for Done, a knock for Skip, a light switch, a pencil check mark, a glass
  flick for the assistant, paper swish take 4 for "moved to tomorrow") and
  asked for a sound director's edit. Fifteen sounds were cut from those six
  takes: frequent sounds are quiet and dry, the rare happy ones (day
  finished, level up) are the loudest and the only ones with echo. Full
  table, levels and hook points: `docs/design-rebuild/SOUND_EFFECTS.md`.
- **A "Sounds" switch in Settings** turns them all off. Undo, menus and
  onboarding steps are silent because the human chose no sound for them.
- **Rejected by the human:** a wooden block for "saved" ("not a fan of wood
  saving things") and a coin for "badge earned" (a coin does not say "badge").
  New takes (metal latch, rubber stamp, pin badge, medal, and two built from
  the chosen iron hit) are on "Fallback Sound Picker 2"
  (https://claude.ai/artifact/6JuV4MSQ3FfVu1eUHnh4hL), which also asks about
  buttons and tabs (no answer in round one, silent for now) and lets the
  human flag any of the fifteen edited sounds.
- **Banner pictures, one at a time.** The human chose gpt-image-2 and asked
  for one image at a time. Banner 1 (step 1, "a plan A and a plan B"): a big
  and a small clay dumbbell, a green tick badge on the big one and a blue tick
  badge on the small one, standing for ideal and fallback. It replaces the
  drawn A and B cards. The model paints a fake checkerboard when asked for a
  transparent background, so the picture is cut out locally
  (`docs/design-rebuild/banners/cutout.sh`); later prompts should ask for a
  plain flat light-grey background with no floor shadow. Steps 2 to 7 keep
  their drawn stand-ins until the human has reacted to banner 1.
- **New things the spec does not have yet:** sound (a setting, the files, an
  audio library, silent-mode behaviour, the notification sound), and bundled
  AI-made banner images (files per step, licence for AI-made content).

### Round 4, tenth pass (2026-11-17, preview version 16)

- **Every onboarding step has a banner picture.** The human approved going on
  with gpt-image-2: two passes per step, made one at a time, vetted before
  being shown. Fourteen pictures; one per step is in the preview and both
  passes are on the "Fallback Banner Board"
  (https://claude.ai/artifact/EwgWnHvKpF5k14c57Vyizz), where the human can
  overrule a pick (`picks/step_<n>` = `{choice: "a" | "b" | "redo", note}`).
  Chosen: 1 two dumbbells lying down, green tick on the big one and blue on
  the small one; 2 a sprout between a rain cloud and a sun; 3 repeat arrows,
  calendar, pill bottle and checklist in a cluster; 4 a week tray of seven
  ticked tokens, green and blue; 5 a painter's palette with a sun and a moon;
  6 a bell on a cushion; 7 three pots going from seed to sprout.
- **One look for all of them:** matte cream-white clay, chunky rounded shapes,
  accents only in the ideal green and fallback blue, no text. They are cut out
  so the banner colour (which follows the chosen theme colour) shows through.
- **Vetting rules used:** same material and palette as the others; reads at
  the size of the banner on a 360-wide phone; says what the headline says
  without needing the text; a clean edge on both the orange and a dark
  ground; nothing cropped. The second pass of a step was written after
  looking at the first, to fix what the first got wrong or to try the other
  reading of the copy.
- **Banner pictures get side margins** (28 px) so a wide picture clears the
  banner's edges and the back and skip buttons.
- **Badge earned has its sound** (the human's pick): two quick iron hits and a
  higher third, played when the badge pop-up appears.
- **Skip today cannot be heard on a phone**, and the human said so. Measured:
  the knock is nearly all below 500 Hz. Brighter replacements for Skip,
  "could not save", and buttons and tabs are on "Fallback Sound Picker 3"
  (https://claude.ai/artifact/RanySU19mQXes9mdyq6oht). Takes are now
  measured before they are offered. Details in
  `docs/design-rebuild/SOUND_EFFECTS.md`.

### Round 4, eleventh pass (2026-11-17, preview version 17)

- **The human's answers on the banner board.** Kept: step 1 (dumbbells lying
  down), 3 (the cluster), 5 (the palette), 6 (the bell on a cushion). Redo:
  step 2 ("I agree with your second step but to be fair the first step looks
  better"), step 4 (the same answer), step 7 ("A single sprout pot would've
  done the job").
- **The three redos.** Step 2: the bold pot, sprout and rain cloud of the
  first pass, with the sun peeking out from behind the cloud. Step 4: a week
  tray holding plump green and blue marbles, six in and the seventh about to
  drop. Step 7: one sprout pot with a small plus. All three are in the
  preview and on the board (answers for this round are stored in the board's
  `round2` collection).
- **The human could not see the pictures, except in step 5.** Cause: the
  banner's height came from a rough formula that was only checked at full
  phone heights. In a shorter window (an artifact viewer, a phone browser
  with its bars) it left the banner about 120 px and the picture about 35 px,
  or none. Fix: the banner now takes everything the tallest step of its group
  does not need, from measurements of the built app at seven widths and three
  densities (`NEEDS` in `OnboardingShell.tsx`, measured by
  `preview-harness/obneed.js`), and the last two steps switch to the tighter
  setting earlier. Steps 1 to 4 still share one height and 6 and 7 another.
  At 390 by 620 the banner goes from 120 to 165; at 390 by 700 from 200 to
  205 (and from 116 to 207 on the last two steps).
- **The fit check now covers short windows:** fourteen sizes from 320 by 568
  to 430 by 932, including 360 by 600, 390 by 600, 620, 649, 650 and 759.
  Nothing scrolls at any of them.
- **Lesson recorded for whoever builds this:** `NEEDS` is a table of measured
  heights. Any change to the words or the example under a step's headline
  means measuring again, or the banner will be wrong (too small is safe; too
  big only shrinks, because the banner gives up height before anything
  scrolls).

### Round 4, twelfth pass (2026-11-17, preview version 18)

- **Banner board, round two.** The human accepted steps 1 to 6 as they
  stand (1 b, 2 c, 3 b, 4 c, 5 b, 6 b). Step 7: "like I said just a single
  sprout is enough here, no need for a plus sign". The plus is erased from
  the same picture (no new generation); step 7 is now the sprout pot alone.
- **Sound Picker 3 answered.** Buttons and tabs: `nail_tap_1`. Saved:
  `stamp_1`. Skip today: `page_flip_2`.
- **The edit.** `tap` is the nail hit alone, the quietest and shortest
  sound in the set (peak -17 dBFS, 0.135 s), because it is heard most.
  `saved` is one stamp (-9.6, 0.22 s). `log_skip` is one page flip with its
  quiet lead-in cut so it starts on the press (-9.2, 0.43 s). `error` is the
  first part of the same flip twice, the second 4 semitones lower and a
  little quieter (-8.2, 0.5 s). All dry. All four keep their level above
  500 Hz (they lose 0.1 to 2.7 dB), so the "cannot hear it" problem of the
  wood knock is gone; the knock is no longer used.
- **Where they play.** `tap`: every kit `Button`, the bottom tab bar, and
  the segmented `Tabs` (only when the tab changes). `saved`: any success
  toast without an icon, placed in the toast store beside the existing
  warning sound, so every "… saved", backup, restore and copy confirmation
  gets it and log toasts (which carry an icon and their own sound) do not.
- **A choice made here, for the human to confirm:** icon buttons (back
  arrows, the add button, close crosses), list rows, chips and pickers stay
  silent, so the tap does not turn into constant noise. A save is therefore
  two sounds: the button's tap, then the stamp.
- **Checked:** type-check clean; `sfxcheck4.js` in a browser (tab → tap,
  Skip today → flip, Save to-do → tap then stamp, no page errors); the
  onboarding fit check passes at all 14 sizes. **Not checked:** by ear.
  Levels are set by measurement.

### Round 4, thirteenth pass (2026-11-17, preview version 19)

The human sent screenshots of onboarding in their preview window (about
375 by 609): step 5's banner was about 200 px, steps 1 to 4 about 135,
steps 6 and 7 about 115, with empty room under steps 4 and 6. Their words:
step 5 "should be a bit bigger ... so that all the space at the bottom will
be used up", and the text in the others should shrink "so that the others
may share the exact same space that the fifth one is using". Also: "the art
doesn't match the example data so make the example data match it, this way
we don't burn credits" (step 4).

- **One banner height for all seven steps.** Replaces the two groups
  (steps 1 to 4, steps 6 and 7) of the eleventh pass. The height is what the
  fullest step leaves free, capped at 36% of the screen. Step 5 may run up
  to 15% taller, to use the room it would otherwise leave empty.
- **The type tightens on all steps together, in favour of the banner.** A
  roomier setting is used only if the banner keeps at least 92% of what the
  tightest setting would give it. Result on a 390-wide phone: tight below about 760 px
  of height, compact from there to about 860, regular above.
- **What was tightened on a short screen ("tight"):** headline 22/27 and
  body 14/20 on every step; smaller gaps and paddings; step 1's card and
  privacy line; step 2's card and day circles (24); step 3's tiles put the
  icon beside the label (28 px icon) instead of above it; step 7's fields
  are 44 high instead of 48 (`dense` on the kit `Input`).
- **Copy removed, for the human to confirm.** Step 7 no longer shows the
  helper line under each field at any size ("What do you want to build?",
  "The full version, on a good day.", "The low bar — still counts as showing
  up."): the three cost 66 px and the placeholders already give an example
  of each. On a short screen step 7 also drops "It runs every day. You can
  change that anytime." These are in the design's verbatim copy, so the
  human decides whether they stay out.
- **Measured, in the human's window (375 by 609):** every banner 190 px,
  step 5 215 px. Before: 134, 203 and 116. On a 390 by 844 phone: 304 on
  every step, 350 on step 5.
- **The measurements moved into their own generated file.**
  `src/features/onboarding/onboardingNeeds.ts` is written by
  `preview-harness/obneed.js`, which now forces each type setting (the shell
  obeys `globalThis.__obDensity`) instead of relying on window height. Any
  change to a step's content needs a re-measure.
- **Step 4's example matches the tray in the picture.** The picture shows a
  week tray with four green marbles and two blue in it and the seventh place
  empty. The example now reads 86%, "6 of 7 days you showed up", a bar of
  four ideal, two fallback and one empty seventh, and a legend of Ideal and
  Fallback only (no Off, since the picture has none). The design had 83%,
  5 of 6, with an off day. No image was generated.

### Round 4, fourteenth pass (2026-11-17, preview version 20)

- **Step 5's banner is the same height as the others.** The human: "the 5th
  card from it's onboarding step should be the same size as the others".
  The 15% extra from the thirteenth pass is removed (`STEP5_EXTRA` is gone);
  all seven banners are now identical at every size (190 px in the human's
  375 by 609 window, 304 px at 390 by 844). Step 5's spare room sits above
  its button, like any other step's.
- The two pieces of copy removed from onboarding step 7 in the thirteenth
  pass are still waiting on the human's yes or no.

### Round 4, fifteenth pass (2026-11-17, preview version 21)

- **The preview was silent; the human said so** ("I expected to hear my
  chosen sfxs on the preview"). Cause: the sound service loaded each inlined
  clip with `fetch`, and the artifact viewer forbids network calls, data:
  addresses included. Every load failed quietly, so no sound has ever played
  in the published preview, in any pass. The local checks ran against a
  plain local server with no such rule and so reported sounds starting.
- **Fix:** `src/services/sfx/index.ts` decodes the clip straight from its
  inlined text (no `fetch`). `preview-harness/sfxcheck5.js` now loads the
  published page wrapped as the viewer wraps it, under a policy that blocks
  network calls: before the fix it shows the refusal and no sound; after, a
  bottom tab starts the tap.
- **Lesson for later checks:** anything that has to work in the published
  preview is checked on the published page under that policy, not only on
  the local build.

### Round 4, sixteenth pass (2026-11-17, preview version 24)

The human, after using the preview:

- **"Switching tabs shouldn't have a ticking sound. It is only button presses
  and switch presses that should have a sound."** The bottom tab bar and the
  segmented tabs (`src/ui/Tabs.tsx`) are silent again.
- **The plus button and the add-menu rows had no sound.** They now play the
  press sound (`tap`), as does the "Tell Fallback AI" button.
- **"The [sound] we are using for the tab should be used for the plus button
  as well and for switches."** Switches now play `tap` both ways. The separate
  `toggle_on` / `toggle_off` files stay in `assets/sfx/` but nothing plays
  them (main session's reading of the sentence; one line in `src/ui/Switch.tsx`
  to put them back).
- **"Whenever an achievement is made, if a sound is currently being played,
  that achievement should wait first ... timing is key."** Rule, in
  `src/services/sfx/timing.ts`: a reward (`badge_earned`, `level_up`,
  `day_complete`) starts only when whatever is sounding has finished plus
  500 ms, and two rewards never overlap. The milestone pop-up now waits with
  its sound and appears at the moment the sound starts
  (`CelebrationHost`). Measured in the preview: done sound at 0.08 s, badge
  sound and pop-up at 1.72 s.
- **"The tell fallback AI button, it's not really looking like it's
  pressable. It looks like it's just a notification."** It was a pale tinted
  card. It is now built like the app's other buttons: solid accent face on a
  darker edge that sinks when pressed, white mark, arrow on the right.
- **"There's an M dash. Please do well to remove it because that makes it seem
  as if this whole thing was built by an AI."** Every em dash in wording the
  app shows (about 100 strings: toasts, empty states, onboarding, settings,
  notifications, assistant replies written by the app) is replaced by a full
  stop, comma, colon or brackets. Where a dash stood for "no value" it is now
  the short dash already used on the Today ring. The assistant's instructions
  (app and server copies) now tell it not to write em dashes either. This
  departs from the dash-heavy wording in `design-input/`, on the human's word.

### Round 4, seventeenth pass (2026-11-17, after the first APK)

The human, after installing the APK:

- **"The sfx isn't in the app."** Cause found in `expo-audio`'s Android code:
  with `playsInSilentMode: false` it refuses to start any sound while the
  phone's ringer is on vibrate or silent. On Android the app now passes `true`,
  so sounds follow the media volume like other apps; the iPhone keeps the
  silent switch. The sounds heard most are also made ready at start-up, so the
  first press is not late. Not confirmed on a phone yet.
- **The onboarding pictures sat towards one side on the phone, not in the
  centre.** The picture box was sized by the image's own "fit inside" rule,
  which Android drew against one edge. Each picture now gets an exact width and
  height worked out from the room in the banner and the picture's shape
  (`BANNER_ASPECT`), and the room centres it. Measured in the browser at
  360, 390, 412 and 480 wide: equal space left and right on all seven steps.
- **"Instead of the entire page ... flipping from page to page, I want it to
  animate in a very nice and interactive way."** Onboarding steps no longer
  swap pages. The banner, dots and Next button stay where they are; the new
  picture springs in from the side the person is heading, and the headline,
  body and content rise in one after another (about half a second in all).
  Back, and the phone's back gesture, play it from the other side. Reduced
  motion shows it at once. Everywhere else in the app, a new screen on Android
  slides in from the right over the last one (`ios_from_right`) instead of
  Android's quick fade and jump (main session's reading: the human named
  button presses in general).

### Round 4, eighteenth pass (2026-11-17)

The human:

- **"Options that look like they can easily be slid through, like the to-do /
  note switch ... I want that switch to move to the other one. Same thing when
  I'm switching tabs."** Every segmented control (`src/ui/Tabs.tsx`) now has one
  highlight that slides to the chosen option with a spring, kept inside its
  track, and it can be dragged: slide a finger across and it follows, settling
  on the option it is let go over. The bottom tab bar is now `SlidingTabBar`:
  the tinted pill slides from tab to tab, the arriving icon lifts slightly, and
  the tab screens shift as they change.
- **"When a user hits the skip button, they should know that they are
  affecting their consistency data."** Skip no longer logs straight away. It
  opens one sheet ("Skip <name> today?") that shows the real change to the
  last-30 number before committing, e.g. "78% → 75% if you skip"
  (`useSkipPreview`, worked out with the same calculation as the Today ring).
- **"There should also be an emergency skip button ... to avoid redundance ...
  smooth and clean."** No second button on the card. The same sheet's second
  choice, "Take today off" ("Something came up? Today won't count for or
  against you."), marks that one habit off for the day, which the data model
  already had (the "Off today" switch on a task's page). A toast offers Undo.
  No limit on how often it can be used: main session's choice, flagged to the
  human.

### Round 4, nineteenth pass (2026-11-19)

The human: **"Let it be unlimited, some people have really rough lives. Also let
it be present on the Today page as well; I see that it doesn't state anything
about an emergency there either."**

- The emergency day off stays unlimited.
- Each card on Today shows "Emergency day off" (life-buoy icon) opposite "Skip
  today" while nothing is logged. One tap takes just that habit off today (no
  effect on consistency), with the same toast and Undo as the Skip sheet's
  "Take today off" (shared in `useTakeDayOff`).
- The whole-day switch on Today was "Mark today off"; it is now "Emergency:
  whole day off", "Something came up? Nothing due today counts against you.",
  with a life-buoy icon like its neighbours. Its toast reads "Day off. Nothing
  due today counts against you."

### Round 4, twentieth pass (2026-11-19)

The human: **"Skip today and emergency day off are the same thing. Remove skip
today. Keep it as emergency day off for either the whole day or for just that
particular task ... The only other thing you can keep with emergency day off
is snooze to tomorrow. Instead of snooze to tomorrow do push to tomorrow."**

- Skip is gone from every log control (Today's cards, a task's page, past-day
  popover). A day not done already counts as missed at the end of the day, so
  Skip only recorded the same miss early; an emergency day off is the excused
  case. Old skip logs still show as "Skipped" and can be cleared. The Skip
  sheet (and its consistency preview) is removed: nothing opens it any more.
- Under Done / Fallback each card has "→ Push to tomorrow" (left, only for a
  habit allowed to move) and "Emergency day off" (right). Once something is
  logged, "Clear log" takes that place.
- "Snooze" is called "push" everywhere a person reads it: "Push to tomorrow",
  "Undo push", toasts "Pushed to tomorrow" / "Push undone", the routine form's
  "Push a day instead of missing it". A push that cannot happen says why
  ("Already pushed once. It stays on today.").
- The whole-day switch on Today is "Emergency day off", "The whole day. Nothing
  due today counts against you." The task page's per-task switch is "Emergency
  day off", "Just this task, today."
- The first-routine save that failed on the human's phone could not be
  reproduced (it saves on real SQLite in tests). It now retries once on its
  own, every database job retries once on a "database is locked" error, and if
  the first-routine save still fails the toast shows the real reason under
  "Couldn't save. Try again", so a screenshot names the cause.

### Round 4, twenty-first pass (2026-11-19)

- **Celebration:** the human looked at the board
  (`docs/design-rebuild/celebration/celebration-picker.html`, Stamp / Glow /
  Medal / Still beside the current confetti) and chose `{"celebration":"current"}`.
  The confetti stays as it is.
- **"Pushing to tomorrow should mean doing it with whatever is available
  tomorrow, not overwriting tomorrow's routine."** The push is now ADDITIVE.
  Before, pushing a habit onto a day it was due anyway merged the two (SCHEMA
  §4.2 clauses a/b): the pushed occurrence and its data disappeared under the
  day's own. Now that day holds two occurrences: its own, and the pushed one
  ("From yesterday" on its card), each logged on its own row, each counting
  toward consistency, each earning its own XP. Rules kept: one hop only (the
  pushed one cannot be pushed again; the day's own can), undo brings it home.
  XP is now keyed by the date of the row that holds an occurrence's data (the
  source date for a pushed one), so no two occurrences share a key. Code:
  `resolvePushedOccurrence` (src/domain/dayState.ts), `resolveTaskOccurrences`
  / `resolveOneOccurrence` / `resolveWriteTarget` (src/queries/internal.ts,
  optional `pushedFrom`), `reconcileOccurrence` (XP key), `Occurrence.pushedFrom`.
  Tests C4b, C5, C7, C9 in `src/queries/moveSemantics.test.ts` were rewritten
  to the new rule and C4p added.

### Round 4, twenty-second pass (2026-11-19)

The human: **"Let's not make deleting things final, maybe add a spot things can
be reverted after a set number of days, in which they can go to permanently
delete stuff as they please, please run accurate edge case tests on this with
haiku and sonnet."**

- Deleting a routine, event, course or to-do moves it to **Recently deleted**
  with its history, kept **30 days** (`DELETED_KEEP_DAYS`, main session's
  choice of number). Settings > Data > Recently deleted lists them ("Routine ·
  12 days left", "Last day"); each can be restored or deleted forever, and
  "Delete all forever" empties it. Expired items go at the next launch or when
  the screen loads. The delete sheet says where the item goes; the toast after
  deleting offers Undo. XP is never taken away. "Erase all data" stays final.
- A task page opened for a deleted task (link, back stack, assistant) shows
  "“X” was deleted." with Restore / Open Recently deleted; for one deleted for
  good, "This isn't here any more." Writes to a deleted task are refused.
- The assistant now replies "Moved X to Recently deleted. You can restore it
  for 30 days from Settings, Data."
- Edge-case passes: `review/haiku/12-recently-deleted-data.md` (data layer,
  80 tests, 4 bugs fixed) and `review/sonnet/13-recently-deleted-ui.md`
  (screens and cross-feature, 86 tests, 6 bugs fixed).

### Round 4, twenty-third pass (2026-11-19)

The human: **"Deleted habits should act like routines that one has abruptly
decided to end... their past consistency should still show up in the app... if
someone wants to end a routine, it's slightly different from deleting that
routine. I'll just let you figure it out."**

Main session's resolution (the human left it open):

- **End** ("I'm stopping this"). Task page menu: "End routine" (also repeating
  events and courses; not to-dos, notes, as-needed routines or one-off events).
  Its last day is today if today is logged, otherwise yesterday, so ending never
  makes today a miss. It stays in the app under **Ended** (Routines, Events;
  an ended course shows under past courses), with its history and an "Ended
  <date>" card and **Start again**. Starting again marks the ended days off.
- **Delete** ("take it out of my app"). Hidden everywhere, in Recently deleted
  for 30 days. Its past days keep counting: every day before the deletion day,
  and the deletion day only if it was logged. Restoring marks the days away off.
- **Delete forever** (or after 30 days): name, steps and logs go; each settled
  past day stays as an anonymous `retired_day` row (date and outcome only), so
  consistency, the trend, cycle records and badges are unchanged.
- Neither counts the days after it stopped as misses.
- Today, the lists and reminders show live habits only; consistency, the trend,
  badges and cycle records read the whole record (`resolveRecordOccurrences`).
- The delete sheet now says the days still count, and for things that can be
  ended: "Only stopping? End the routine instead and it stays in your list."

Data changes (architect): migration 8 adds `task.ended_on` and `retired_day`;
backups carry `retired_day` (older backups without it still restore).
`deleteForever(id, keep)` writes the kept days and removes the task in one
transaction. The store no longer removes anything on open: S01 runs
`sweepExpiredDeleted()` after the store is ready, which keeps each item's days.

Edge-case passes: `review/haiku/14-ended-retired-data.md` (real SQLite, 22
tests; fixed: the per-habit "comeback" badge is now saved before a habit's days
become anonymous) and `review/sonnet/15-end-routine-ui.md` (screens; fixed: a
double tap on End or Start again ran it twice). Whole suite: 1210 tests pass.

### Round 4, twenty-fourth pass (2026-11-20): edge-case campaign

The human: **"I'll need rigorous edge case tests done right now, use haiku and
sonnet all over, I'm going to test the app for the week."** Eight agents, one
area each (`review/EDGE-BRIEF.md`), reports `review/haiku/16, 17, 19, 22` and
`review/sonnet/18, 20, 21, 23`. About 450 new tests; whole suite 1660 passing.

Fixed (by the agents in their areas, or by the main session where marked):
- Reminders: only for habits still pending that day (not logged, not off);
  only times still ahead (main session: Android fires a past DATE trigger at
  once, and rescheduling runs after every log); capped at 64; re-arms
  serialized; no "slipped by" nudge for a habit ended yesterday. The widget
  refreshes when the app comes back.
- Logging: XP restored when a day off is lifted; ending keeps a logged day that
  was pushed; pushing an ended habit's last day refused; XP reported is what a
  write actually added (main session); a cycle's first log goes to the new cycle
  and cycles catch up on launch and on Progress (main session).
- Storage: a store from a newer app version is left untouched; backups are one
  consistent snapshot; damaged or wrongly typed restores refused; busy retry
  works for native errors; a failed open no longer leaks a connection.
- Screens: double taps run once (Today cards, task page, forms, Duplicate,
  to-dos, as-needed, End/Start again); Today moves to the new day at midnight
  while open; thrown saves show a toast; splash steps each best-effort;
  blank steps dropped and names trimmed; course end before start rejected in
  the domain (main session); courses ended early or not started read right;
  search shows Ended; Progress falls back when the chosen habit is deleted.
- Assistant: invalid dates, states and types refused before any write; a change
  it could not apply is said plainly; a dropped stream shows the offline banner;
  a BYO base URL with a trailing slash works.

Open with the human:
- With a BYO key the assistant is not sent the habit list, so it can only create.
- A bad BYO key reads as "offline"; chat history is not in backups.
- Recovery offers Reset (behind a confirm) even for a store from a newer version.
- The "couldn't save" seen once on the phone was not reproduced; the toast now
  carries the real reason.

### Round 4, twenty-fifth pass (2026-11-20): edge-case round 2

The human: **"do more tests."** Round 2 looked across areas (reports
`review/sonnet/24, 26, 28, 30` and `review/haiku/25, 27, 29, 31`).

Fixed (agents in their areas, main session where marked):
- Time zones (main session): migration 9 stores `task.created_on` and
  `task.deleted_on`, the device's local day at the moment it happened, so a
  person who travels cannot gain a missed day that never happened or lose a
  real one. A clock set back no longer makes today a settled miss.
- Android back (journeys agent + main session): Back, Save and Delete return
  to the screen below (`dismissTo`) instead of stacking a copy, so the phone's
  back button no longer walks through duplicates.
- Speed: one range read for all habits instead of two per habit, windowed
  reads; Today 1117 ms to 7 ms on a heavy three-year record, same answers.
- Restarts (main session): `healMissingXp` on launch gives a logged day the XP
  award it is owed when the app was killed between the two writes.
- Year simulation: 60 seeded years, 14 invariants after every step; restore no
  longer turns a day pushed before the delete into a miss.
- Privacy: an assistant delete needs the person's own words to name the
  habit; "draw over other apps" removed; agent-access store refuses choices a
  scope does not offer; an http:// AI address is refused on every request
  (local model servers excepted).
- Settings and subscription: pending purchases wait instead of showing success;
  expired or refunded plans are not active; Buy runs once; restore refreshes
  reminders and the widget; failing saves undo and say so.
- Wording and access: ranges read "Mon to Fri"; the no-value mark is one short
  dash everywhere; error text uses the darker red for contrast; tabs reach a
  44 px tap area; labels wrap at large text.

Open with the human:
- Editing a habit's schedule rewrites how its past days read (the simulation
  exempts it). Freezing the past would need schedule history.
- The subscription is not cached on the phone: offline at launch reads "Free
  plan" until the store answers.
- After every log the badges re-read the whole record (about 0.6 s on a very
  heavy record); fine for now, a candidate if logging ever feels slow.
- A pop-up message may read "Dismiss" to a screen reader (check on the phone).

### Round 4, twenty-sixth pass (2026-11-20): edge-case round 3

The human: **"do more tests"** (again). Round 3 tested the tests and the parts
untouched so far (reports `review/sonnet/32, 33, 36, 38` and
`review/haiku/34, 35, 37, 39`).

Fixed:
- Backups on Android (main session): React Native's Share sends text only, so
  the backup "share" handed over the file's path. Now Android's folder picker
  opens and the backup FILE is written where the person chooses
  (`src/features/data/offerBackupFile.ts`). Adding expo-sharing was blocked in
  this session, so the built-in Storage Access Framework is used.
- Assistant: model-created routines were all refused (schema vs validator);
  turns are queued; Continue keeps the new message; only the newest 40
  messages are sent; a quadratic guardrail pattern removed; an outside
  `fallback://` link only fills the message box, while buttons inside the app
  still send in one tap (main session: `inAppOpening.ts`).
- Races: writes run one at a time (`writeQueue.ts`), so double taps or two
  screens cannot report an award twice or fire two level-ups; a hung write
  holds the queue for at most 10 s (main session).
- Lifecycle: the repairs (expiry sweep, cycle catch-up, XP heal) also run on
  foreground, single-flight, heal after catch-up; a reminder tap during the
  splash opens its screen (main session); overlays fail quietly.
- Android config: 18 unused permissions blocked; versionCode 2.
- Browser: weekday chips fit at 320 px; an invalid Save explains itself.
- Fuzzing: an infinite or NaN XP no longer hangs `levelFor`; malformed drafts
  and backup files are refused, never thrown on.
- Mutation testing: 226 planted bugs, 57 gaps closed with new tests; the cycle
  walk cannot loop forever (main session).
- Spec coverage: 273-row traceability table, 62 tests for the gaps.

Open with the human:
- Release signing uses the public debug key (fine for testing only); R8 is off
  (APK about 55 MB); exact alarms are not requested on Android 14+, so
  reminders may arrive late; a home-network http model server is blocked by
  Android's cleartext rule; sounds play with the ringer off (by request).
- The breakdown counts on S25/S26 can add to more than the counted days on a
  day with both an ideal and a fallback (rounding each separately).
- Small spec differences: S35 cards navigate; S26 uses taps, not a slider; the
  routine "no ideal step" banner is shorter than the spec's sentence.

### Round 4, twenty-seventh pass (2026-11-20): exact reminders, counts that add up, edge round 4

The human: **"Should it ask?" "yessssssssss"**, **"Fix it" "yes"**, and **"also do more tests"**.

- **Exact reminders (Android).** The app's own native module (`modules/exact-alarm`, no new
  package) reports whether Android lets Fallback ring at the exact minute and opens its page.
  Today asks once ("Get reminders right on time": Allow / Not now), only on Android with
  notifications on and exact timing off, never over another sheet; the answer is kept in secure
  storage and erased with everything else. Settings > Notifications keeps a "Ring reminders on
  time" row while it is off.
- **Breakdown counts add up.** Ideal + fallback + missed always equal the counted days (largest
  remainder, `apportion`). Cycle records stored before this pass keep their old counts.
- **Wording.** A round-4 wording pass made names consistent (Try again, Delete forever, full stops
  on toasts, filler cut). It had also replaced "habit" with "task" and the "Showing up" label with
  "Consistency", and the no-value dash with a hyphen; the main session restored all three (the
  human's approved wording).

Edge round 4 (reports `review/sonnet/40, 41, 43, 44`, `review/haiku/42, 45, 46, 47`). Fixed:
notes saved from + land on the Notes lens; a model reply quiet for 60 s ends as offline instead of
holding every later message; a crashed overlay tries again; Routines' day filter follows midnight;
course doses and history logs celebrate badges and levels; a taken-back day is not pinned as a
manual choice; old backups restore with their local days; the folder copy is named right;
toasts read their message first to a screen reader; celebrations are announced; logging one of 150
habits redraws one card, and Routines mounts with 7 reads instead of 454.

Open with the human:
- One of two steps, or one of three doses, counts the day as a fallback (showed up, 6 XP).
- Early on, the ring can read 83% beside "2 of 2 days" (weighted share vs rounded days).
- Restoring or starting again after midnight marks the days away off; a duplicate's creation day
  counts like any new habit's.
- Editing a schedule still rewrites how past days read (known since pass 25).

### Round 4, twenty-eighth pass (2026-11-21): partial days switch, Pause vs Delete

The human's answers to the three open questions from the twenty-seventh pass:

1. **Partial days get a switch, per habit.** "Every dose needed" (courses with more than one dose a
   day) or "Every step needed" (routines with more than one ideal step), in the habit's settings,
   off by default. Off: doing part of it is a fallback, as before. On: doing part of it is a miss
   once the day is over (still to do while it is today); doing all of it is ideal, and the Fallback
   chip still logs a fallback. Migration 10 (`task.all_required`, default 0); the flag travels in
   backups. `computeAutoChip`/`autoChipState` take it. Flipping it rereads past partial days, the
   same way a schedule edit does.
2. **Ring % vs "x of y days"** was not clear to the human; explained in chat (the ring gives part
   credit for a part-done day, the count counts whole days). No change unless they ask.
3. **Days away marked off after restoring: yes.** And to stop needless skipping, the two ways to
   step away are framed by purpose: **Pause** (was "End routine") is for an emergency or a hard
   stretch: nothing is due and the days away do not count; **Resume** starts it again from today.
   **Delete** is for something no longer needed. Each confirm sheet points to the other. Paused
   courses have their own Paused section on Courses > Active (no longer under Past, never
   "Completed"); Search and the lists say "Paused" / "Paused since <date>".

### What the architect needs to know from round 4

- **A bundled font.** The preview loads Nunito as a web font. On a device it is
  a bundled asset, one file per weight (400, 600, 700, 800), with a
  weight-to-family map, because React Native does not synthesise weights for a
  custom family. Pending the human's typeface decision.
- **New shared kit, all presentation-only:** `surface.ts`, `motion.tsx`,
  `WeekStrip`, `TabSummary`, `StatTile`, `EmptyArt`, `VoiceMark`; new
  `features/task/TaskHero.tsx`, `useWeekStrip.ts`. No schema change this round.
- **More reads per list.** Each routine or course card now reads seven days of
  occurrences (`useTaskOccurrences`). Fine at the sizes tested; a batched query
  would be the cleaner contract.
- Token changes: `RADIUS` 8/12/16/20, new `EDGE = { outline: 2, bottom: 5 }`.

### Still open with the human after round 4

- The typeface (rounded is in the preview as a default, not a decision).
- Dark labels on the orange buttons (carried from round 3).
- Locked badges do not show progress toward the badge: the app has no
  per-badge progress read yet. That is a small feature, not a restyle.
