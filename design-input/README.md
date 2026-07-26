# design-input — human-supplied Fallback design artifacts

Everything here was **provided by the human**, not produced by a pipeline agent in
this repo. It is the Phase 2 design work for **Fallback**, a phones-only habit
tracker built on one idea: *every habit has an ideal and a fallback, and a
fallback still counts.*

It is carried over from a previous run of the pipeline. `ALLSCREENS_1.md` states
it is "consolidated from `design/screens/*.md`, current as of the **Gate-2-ready**
state" — ready for Gate 2, not approved at it.

## What's here

| Path | What it is | Pipeline analogue |
|---|---|---|
| `Fallback Handoff (standalone).html` | Single self-contained file, all 50 screens rendered. Open directly in a browser — no server, no network. | the Gate 2 review artifact |
| `fallback-handoff/Fallback Handoff.dc.html` | Source of the same document. Needs its sibling files (see below). | — |
| `fallback-handoff/uploads/ALLSCREENS_1.md` | Full written spec for S01–S50: contents, states, interactions, responsive, verbatim copy. 4,346 lines. | `design/screens/*.md` |
| `fallback-handoff/_ds/verdant-design-system-*/` | The **Verdant** design system — tokens (colors, type, spacing, elevation), `styles.css`, component bundle, adherence lint config, readme. | the human-provided `<Design System>/` |
| `fallback-handoff/fallback-theme.css` | Fallback's theme layer over Verdant. Repoints accent to Forge Orange `#F2601A` and adds the state signals Verdant doesn't ship. | app-level design tokens |
| `fallback-handoff/BottomTabs.dc.html`, `StatusBar.dc.html` | Reusable frame chrome partials. | — |
| `fallback-handoff/support.js` | Runtime the `.dc.html` files need to render. Generated — do not edit. | — |
| `fallback-handoff/scraps/` | Intermediate check renders kept from the design session. Reference only, not authoritative. | — |

## Reading it

The standalone HTML is the one to open. The `.dc.html` source resolves
`./support.js`, `./fallback-theme.css` and `_ds/verdant-design-system-*/…` by
relative path, so **`fallback-handoff/` must stay intact as a directory** — moving
any piece out breaks the render.

## Design decisions already fixed here

- **Accent is Forge Orange** (`#F2601A`), not Verdant's leaf green. It recolours
  CTAs, progress, the active tab and the add button, and nothing else.
- **State colours are semantic, never decoration:** ideal `#8FBC6B` (green),
  fallback `#7FB2D4` (blue), off `#A8A294` (grey), gold `#DCB863` (S27–S30 only),
  danger `#FF4B4B`. "Missed" is only ever the unfilled remainder of a bar — it has
  no colour of its own, which is what keeps the framing non-punitive.
- **No streak language.** Consistency is expressed as "26 of the last 31 days you
  showed up", never as a streak that can be broken.
- **Custom components** Verdant doesn't ship — `StateChip`, `OffDayToggle`,
  `BottomTabs`, `ConsistencyBreakdownBar`, `ConsistencyRing`, `MilestoneBadge`,
  `EmptyState`, `Skeleton`, `InlineRetryBanner`, `Tag`, `StatusBar` — are composed
  from Verdant tokens.
- **Fixture data is spec-exact.** Names, percentages and the sample week in the
  mockups are verbatim from the spec so engineering can match strings and maths
  directly.

## Screens

50 screens across 8 flows:

| Flow | Screens | Covers |
|---|---|---|
| 01 Launch & onboarding | S01–S08 | splash, 5-step tour, notification primer, first task |
| 02 Today | S09 | the daily loop and its states |
| 03 Browse & search | S10–S14 | routines, events, courses, to-dos, filter & search |
| 04 Create a task | S15–S19 | type picker, then the four builders |
| 05 Manage · edit · celebrate | S20–S24 | manage sheet, icon/colour, delete, as-needed, completion |
| 06 Progress & achievements | S25–S30 | dashboard, trend, achievements, cycle records |
| 07 AI assistant | S31–S40 | home, conversation, history, mic primer, paywall, BYO key |
| 08 Settings & recovery | S41–S50 | settings and sub-pages, data, erase, help, recovery |

## Known gap — upstream artifacts are missing

The specs cite upstream documents that **are not in this drop**:

- `docs/IDEA.md` — referenced ~15× for verbatim copy (e.g. "Copy (verbatim,
  IDEA.md Flow 10.1)", Flows 6.1–6.2, 11.4–11.9).
- `docs/PRD.md` — referenced ~45×, by section: §3 (19×), §5 (14×), §7 (7×), §4, §6,
  plus named rules ("the PRD's no-streak-language rule", "the PRD's non-punitive…").
- `docs/FEATURES.md` — every screen is tagged with feature IDs. 29 distinct ones
  appear (F1–F9, F11–F21, F23–F31); **F10 and F22 are never referenced**, so the
  feature list itself is not fully recoverable from these specs alone.

Per the artifact contract in `CLAUDE.md`, `docs/PRD.md` is read by *everyone
downstream* — architect, feature-builders, qa-tester all depend on it. Phase 3
cannot start against these design files alone. Either the prior run's
`IDEA.md` / `REQUIREMENTS.md` / `FEATURES.md` / `PRD.md` need to be supplied, or
Phases 0–1 need to be re-run to reconstruct them.
