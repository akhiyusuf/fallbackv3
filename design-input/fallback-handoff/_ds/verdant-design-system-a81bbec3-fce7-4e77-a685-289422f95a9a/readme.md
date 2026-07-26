# Verdant Design System

**Verdant** is a friendly-education SaaS design system — a deliberate remix of
**Notion (55%)** and **Duolingo (45%)**. It's for learning platforms, courses, and
education tools that want to feel like a serious workspace *and* a friendly tutor at once.

> The result is a study app that feels like a Notion doc you can high-five.

**Mood:** focused, warm, encouraging.

Notion sets the writing surface — warm white, charcoal text, a generous reading column,
restrained chrome. Duolingo brings the encouragement — saturated leaf green for progress
and CTAs, rounded geometry, tactile button feedback, and streak / XP / progress
affordances that gamify without infantilizing.

### Sources
This system was authored from a written brand brief ("Notion × Duolingo — Friendly
Education SaaS"). **No codebase, Figma file, or logo assets were provided.** All values
(colors, type ramp, component geometry) are transcribed directly from that brief. Where a
mark or icon set would normally be referenced, see the caveats in **Iconography** and
**Caveats** below.

---

## Content fundamentals

How Verdant writes copy:

- **Voice:** warm, direct, second person. Address the learner as "you" ("You're on a
  12-day streak. Keep it going."). Encouraging without being saccharine — it respects the
  learner as an adult.
- **Tone by zone:** *document/lesson* copy is calm and explanatory, full sentences,
  teacherly ("Once you learn the pattern, you can conjugate hundreds of verbs.").
  *Practice/feedback* copy is short and upbeat ("Nice! +10 XP", "Keep your streak").
- **Casing:** Sentence case everywhere — headings, buttons, labels. No Title Case on
  buttons ("Start practice", not "Start Practice"). Eyebrows/section labels are the one
  exception: UPPERCASE, 12px, letter-spaced.
- **Encouragement, not pressure:** celebrate wins ("Nice!", "Almost there") and frame
  misses gently ("Correct: …" rather than "Wrong!").
- **Numbers are proud:** streaks, XP, and accuracy are shown big in weight-800 tabular
  figures. Numerals are part of the brand's emotional payload.
- **Emoji:** used sparingly and only as *signal reinforcement* — a 🔥 next to a streak
  count, a 💡 in a tip callout. Never as decoration or bullets, never in body prose.
- **Examples:** "Good morning, Maya" · "Daily goal · 20 XP · almost there" ·
  "Finish the practice below to earn 20 XP" · "Complete Unit 3 to unlock".

---

## Visual foundations

**Color.** A warm Notion neutral base (`--bg #ffffff`, `--bg-alt #fbfaf8`,
`--surface #f1efea`, text `--text #37352f`) carries all reading and document surfaces —
Duolingo's cold white is explicitly rejected. Duolingo's **leaf green** (`--accent #58cc02`)
replaces Notion's blue for *every* CTA and progress indicator. Three signal colors stay
strictly confined to their meaning: **streak** orange (`#ff9600`), **danger** red
(`#ff4b4b`), **XP** blue (`#1cb0f6`). No other categorical color enters general UI —
multi-color decoration is a regression.

**Type.** Inter throughout, no serif (both parents agreed sans wins for a learning
context). Display/h1 is Inter 700 at 40px+ with tight `-0.02em` tracking; h2–h4 are
600/700; body is Inter 400 at 16px / 1.6 line-height for a document reading feel; UI
labels and buttons are 600; and **XP / streak / score numerals are weight 800, tabular**.
Scale: 12 / 14 / 16 / 18 / 20 / 24 / 32 / 40 / 56.

**Spacing & layout.** 8px base scale (8 / 16 / 24 / 32 / 48 / 64 / 96). Two layout zones:
a **720px reading column** (centered) for lessons/documents, and a **480px card stack**
for practice/exercises. App shell is 1180px with a 240px nav rail.

**Backgrounds.** Flat warm-white surfaces only. No images, no gradients, no textures, no
patterns behind content. Depth comes from borders and one tactile shadow — never from
background treatment.

**Corner radii.** Inputs 8px, cards/lesson tiles 12px, buttons/exercise tiles 16px,
badges & progress tracks fully pill (999px).

**Cards.** Flat and border-only — `--bg-alt` fill, 1px `--border`, radius 12. Hover shifts
to `--surface` fill + `--border-strong`. **Cards never get a tactile shadow** — that would
kill the document feel and read as a button.

**Depth / elevation — two modes.**
1. *Document surfaces* (cards, callouts, tables): flat, border-only. Notion discipline.
2. *Interactive controls* (buttons, exercise tiles): the Duolingo tactile bottom shadow
   `0 4px 0 0` in a darker shade of the fill. Pressing collapses it to `0 0 0 0` and
   `translateY(2px)`. This is the system's signature move — reserved for things you
   *press / answer / commit*.
   Modals get a soft `0 20px 48px rgba(55,53,47,0.18)`. **No glass, no blur** on cards.

**Borders.** 1px `--border` (`#e9e7e2`) at rest, `--border-strong` (`#d6d3cc`) on hover /
for secondary-button outlines (2px there).

**Animation.** Quick and functional: 120–180ms. Buttons use a slight-overshoot ease
(`cubic-bezier(0.34,1.56,0.64,1)`) for the tactile press and the switch knob; everything
else uses a calm ease-out. Progress bars animate their width. No infinite/decorative loops.

**Hover / press states.** Hover = subtle background fill change (`--surface`) or a darker
accent — never opacity fades. Press (tactile controls only) = shadow collapse + 2px
downward shift. Focus = 2px `--accent` ring at 2px offset.

**Imagery vibe.** The brand is essentially imagery-free; personality comes from color,
rounded geometry, and the tactile press — not photography or illustration. (Notably: **do
not** use Duolingo's owl or any mascot — borrow the affordances, not the IP.)

**Transparency / blur.** Reserved almost entirely for the modal scrim
(`rgba(55,53,47,0.30)`) and an optional light backdrop-blur on the sticky app header.
Not used on content surfaces.

---

## Iconography

- **System:** [Lucide](https://lucide.dev) — clean 2px-stroke outline icons — loaded from
  CDN. Declared inline as `<i data-lucide="name">` and hydrated with
  `lucide.createIcons()`. **⚠️ Substitution flag:** the brand brief specified no icon set,
  so Lucide was chosen as the closest match to the friendly-but-serious, rounded,
  medium-stroke aesthetic. Swap it if you have a house icon set — tell me and I'll wire it in.
- **Sizing:** 20px in nav/toolbars, 18px inline in callouts/buttons, 22–24px in feature
  tiles. Stroke stays at Lucide's default.
- **Color:** icons inherit `currentColor` (usually `--text-muted`); active/feature icons
  take `--accent-deep`; signal icons (flame, zap, check-circle, x-circle) take their
  signal color.
- **Emoji as icon:** only as signal reinforcement (🔥 streak, 💡 tip). Never as a
  general icon system.
- **No logo provided.** The wordmark is rendered in plain Inter 700 type; the nav rail
  uses a generic Lucide `sprout` glyph in a green tactile chip as a stand-in mark. **Do
  not treat this as an official Verdant logo** — supply a real mark to replace it.

---

## Index / manifest

**Root**
- `styles.css` — global entry point (imports only). Consumers link this one file.
- `readme.md` — this file.
- `SKILL.md` — Agent-Skills-compatible entry for use in Claude Code.
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `elevation.css`, `fonts.css`.

**Components** (`components/`, namespace `window.VerdantDesignSystem_a81bbe`)
- Actions: **Button**, **IconButton**
- Forms: **Input**, **Select**, **Checkbox**, **Radio**, **Switch**
- Display: **Card**, **Badge**, **ProgressBar**, **Callout**
- Feedback: **Dialog**

Each component directory has `<Name>.jsx`, `<Name>.d.ts`, `<Name>.prompt.md`, and a
`@dsCard` demo HTML.

**Foundation cards** (`guidelines/`) — color, type, spacing, radius/elevation, and the
tactile-move specimen cards shown in the Design System tab.

**UI kits** (`ui_kits/`)
- `learn/` — the Verdant Learn app: Dashboard, Lesson, Practice screens (see its README).

**Templates** (`templates/`)
- `lesson-page/` — a Notion 720px reading-document starting point (`LessonPage.dc.html`)
  that composes Badge, Callout, and Button. Consuming projects copy this folder and edit
  the `base` line in `ds-base.js`.

---

## Do's and Don'ts

**Do** — reserve the tactile bottom-shadow for buttons and exercise tiles; use leaf green
only for CTAs and progress; keep streak/XP/danger in their signal contexts; set body in
Inter 16px / 1.6.

**Don't** — put tactile shadow on cards; use a serif body; use any mascot; drop multiple
categorical colors into general UI; use Notion's cold-white surfaces; go below 12px button
radius or use thin weights on CTAs; add glass/blur/drop-shadows to cards.

---

## Caveats

- **No logo / brand mark** was provided — a `sprout` glyph + type wordmark stands in.
- **Fonts** load from Google Fonts CDN (Inter); no self-hosted binaries are bundled.
- **Icons** use Lucide as a flagged substitution (see Iconography).
