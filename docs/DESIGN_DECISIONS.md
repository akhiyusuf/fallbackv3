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
