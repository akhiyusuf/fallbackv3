# Fallback — All Screen Specs (S01-S50)

_Consolidated from design/screens/*.md, current as of the Gate-2-ready state._

---


# S01 — Splash    route: /splash
Features: F1, F9

## Contents

- Wordmark lockup: "Fallback". No logo mark/illustration (Rule 11 — no photography/illustration/gradient).
- Tagline: "Something beats nothing."
- Status line: "Loading your day…"
- A single calm loading indicator: a thin indeterminate bar OR the `Skeleton` component's shimmer treatment — not a full-screen spinner-only treatment (DESIGN.md Gallery note "no spinners-only screens" carried forward as the calm-loading convention). Decision: use an indeterminate bar.
- No header, no tab bar, no primary actions anywhere on this screen (sitemap: "none — auto-advances").

## States
- **Loading (default, and only user-facing state).** Store read begins immediately on mount; this exact visual renders for the duration of that read. No skeleton content (nothing else on screen to placeholder).
- **Routing (invisible / instantaneous, not a rendered state)** — as soon as the local store read resolves, the screen unmounts and one of three destinations is pushed with no intermediate frame:
  1. Store read succeeds, onboarding-complete flag is **false/absent** → S02 (first launch).
  2. Store read succeeds, onboarding-complete flag is **true** → S09 (returning user).
  3. Store read throws / detects a corrupt store → S50 (Data Recovery), never a crash or infinite spinner.
- **Minimum-display floor.** If the store read resolves in under ~400ms, the splash still holds for a brief minimum so the wordmark isn't a single-frame flash; this is a calm-pacing decision, not a loading-state variant.
- **Error.** A corrupt-store detection is not rendered as an error *on this screen* — it is a routing outcome (→ S50, which owns the calm recovery copy). S01 itself never shows retry/error UI.
- **Empty.** N/A — no list/data surface on this screen.

## Interactions
- No tappable elements. Screen reader announces the wordmark + tagline once as a single heading (`accessibilityRole="header"`), then the "Loading your day…" status line as a live region (`aria-live="polite"`) so VoiceOver/TalkBack don't re-announce on every re-render.
- Auto-advance → S02 / S09 / S50 per the routing rule above; no user gesture triggers navigation.
- Reduced-motion: the indeterminate bar degrades to a static opacity-pulsed block (Rule 13).

## Responsive
- Phones-only per PRD; desktop is browser review only — no tablet/desktop layout committed (DESIGN.md Rule 14).

## Copy (verbatim, IDEA.md Flow 10.1)
- "Fallback"
- "Something beats nothing."
- "Loading your day…"

---

# S02 — Onboarding: Hook    route: /onboarding/hook
Features: F9

## Contents

**Onboarding shell** (reused across S02–S06, established here):
- `Button` "Skip" — first screen, no back target.
- **Progress indicator**: 5 progress dots representing steps 1–5 of the core pitch tour (S02–S06); step 1 is the current/filled step.
- Lucide icon, decorative (e.g. `Sprout`/seedling glyph — matches IDEA's 🌱 motif without emoji-as-content).
- Headline: "Something beats nothing."
- Body copy: "Build habits that survive your worst days — not just your best ones."
- `Button` "Next".

## States
- **Default.** As above.
- **Loading.** N/A — static content, no data fetch.
- **Empty.** N/A — no list/data.
- **Error.** N/A — no persistence action on this screen (Skip/Next only navigate; the onboarding-complete flag write happens on Skip, and if that persist fails it is a silent retry-on-next-launch per F9's edge case, not a blocking error shown here — the user still advances so onboarding never traps them).

## Interactions
- **"Next"** → advances to S03.
- **"Skip"** → marks onboarding complete (persisted flag, F9) → S09 (returning-user Today), skipping the remaining tour permanently (does not recur).
- Both controls screen-reader-labeled ("Next, button" / "Skip onboarding, button"); progress dots are decorative and hidden from the accessibility tree (`accessibilityElementsHidden`), with the current step instead announced verbally as part of the header ("Step 1 of 5").
- Killed mid-screen → relaunch resumes at S02 (interruption branch, Flow: First-launch onboarding).

## Responsive
- Phones-only; desktop is review-only, no committed tablet/desktop layout.

## Copy (verbatim, IDEA.md Flow 1.1)
- "Something beats nothing."
- "Build habits that survive your worst days — not just your best ones."
- "Skip" / "Next"

---

# S03 — Onboarding: Concept (ideal + fallback)    route: /onboarding/concept
Features: F9, F2

## Contents

Uses the onboarding shell from S02 (Skip control, 5-dot progress — step 2 of 5 current).

- Lucide icon (`GitBranch`/split-path glyph, signalling "two versions of one thing").
- Headline: "A plan A and a plan B for every habit."
- Body copy: "Too tired for the full thing? Do the fallback. You still showed up."
- **Worked-example `Card`**:
  - Eyebrow label: "MORNING WORKOUT"
  - Row 1 — Ideal: check-circle Lucide icon, label "Ideal — Full workout", helper "30 min, all 3 steps."
  - Row 2 — Fallback: half-check/circle-dash Lucide icon, label "Fallback — 10 pushups", helper "The low bar on a hard day."
  - Both rows draw icons in the signal hue itself (not filled pills) since this is explanatory copy, not a live StateChip — no reversed text on a fill, consistent with Rule 4's spirit.
- **Privacy note** (F9 acceptance: "no-account / on-device-privacy promise stated plainly" — this is that statement's home in the onboarding sequence): Lucide `Lock` icon + "No login. Your data lives on this device — no account to create or password to lose." (verbatim, IDEA.md).
- `Button` "Next".

## States
- **Default.** As above — entirely static/explanatory, no live user data yet exists at this point in onboarding.
- **Loading / Empty / Error.** N/A — no data fetch or persistence beyond navigation; same silent-retry-on-skip handling as S02.

## Interactions
- **"Next"** → S04.
- **"Skip"** → persists onboarding-complete flag → S09.
- Worked-example card is inert (no tap target) — purely illustrative; screen reader reads it as one grouped region: "Example: Morning workout. Ideal: Full workout, 30 minutes, all 3 steps. Fallback: 10 pushups, the low bar on a hard day."
- Progress dots announced as "Step 2 of 5."

## Responsive
- Phones-only; desktop is review-only, no committed tablet/desktop layout.

## Copy (verbatim, IDEA.md Flow 1.2)
- "A plan A and a plan B for every habit."
- Example: Ideal "Full workout" / Fallback "10 pushups."
- "Too tired for the full thing? Do the fallback. You still showed up."
- "No login. Your data lives on this device — no account to create or password to lose." (F9 privacy promise, verbatim IDEA.md)

---

# S04 — Onboarding: Four ways to plan    route: /onboarding/types
Features: F9, F11

## Contents

Onboarding shell from S02 (Skip control, 5-dot progress — step 3 of 5 current).

- Headline: "Four ways to plan."
- Body copy: "Pick whatever fits the thing you're tracking — you'll choose per task."
- Four `Card` tiles:
  1. **Routines** — Lucide `Repeat` icon (informational only here, not a live signal). Label "Routines". Helper "Recurring, day to day."
  2. **Events** — Lucide `Calendar` icon. Label "Events". Helper "One-off, at a set time."
  3. **Courses** — Lucide `ListChecks` icon. Label "Courses". Helper "A run with an end date."
  4. **To-dos & Notes** — Lucide `StickyNote` icon. Label "To-dos & Notes". Helper "Loose tasks, no schedule." Small static `Tag` reading "NEW", matching IDEA's onboarding "NEW" callout.
- Note: this screen introduces the four **top-level types** only. As-needed routines (F27) are a Routine sub-variant surfaced later (Routines browse / Create Routine), never a fifth tile here.
- `Button` "Next".

## States
- **Default.** As above — four static informational tiles, no live task data.
- **Loading / Empty / Error.** N/A — static explanatory content only.

## Interactions
- Tiles are **inert** on this screen (informational only — no task-type selection happens here; selection happens later at S08/S15). Screen reader reads each tile as a grouped region: "Routines. Recurring, day to day." etc.
- **"Next"** → S05.
- **"Skip"** → persists onboarding-complete flag → S09.
- Progress dots announced as "Step 3 of 5."

## Responsive
- Phones-only; desktop is review-only, no committed tablet/desktop layout.

## Copy (verbatim + light connective tissue, IDEA.md Flow 1.3 + task-types list)
- "Four ways to plan."
- "Routines" / "Recurring, day to day."
- "Events" / "One-off, at a set time."
- "Courses" / "A run with an end date."
- "To-dos & Notes" / "Loose tasks, no schedule." + "NEW" tag

---

# S05 — Onboarding: Consistency, not perfection    route: /onboarding/consistency
Features: F9, F5

## Contents

Onboarding shell from S02 (Skip control, 5-dot progress — step 4 of 5 current).

- Lucide icon (`TrendingUp` glyph — deliberately NOT a flame/streak glyph).
- Headline: "Every day counts — ideal or fallback."
- Body copy: "Nothing to lose here. We count how often you show up — a fallback still counts."
- **Sample stat block** (illustrative, not live user data — labeled as a sample):
  - Eyebrow: "EXAMPLE"
  - Big numeral: "83%"
  - Sub-label: "5 of 6 days you showed up"
  - **`ConsistencyBreakdownBar`** (NEW component, F5): a stacked bar over a **7-day sample week: 3 ideal + 2 fallback + 1 missed + 1 off.** Per PRD §3.4/§3.5, off is excluded from BOTH sides of the % formula, so the stat is computed over the 6 non-off days (5 shown-up + 1 missed) → 5/6 = **83%** (matches IDEA's verbatim "83% / 5 of 6 days" headline under the current, non-superseded formula). The bar shows the full 7-day week for transparency (off days are "counted and shown separately," never hidden, per F4): ideal 3/7, fallback 2/7, off 1/7, followed by the bar's own unfilled/neutral track for the 1 missed day, never a colored/named "missed" slice, exactly per DESIGN.md → ConsistencyBreakdownBar. Legend: three swatch+label pairs ("Ideal", "Fallback", "Off") only — missed stays unnamed, matching F5's own display rule.
- `Button` "Next".

## States
- **Default.** As above — the stat block is explicitly a sample/illustration (eyebrow "EXAMPLE"), never wired to a real (empty, at this point in onboarding) user history.
- **Loading / Empty / Error.** N/A — nothing is fetched; the sample numbers are static copy, not computed.

## Interactions
- **"Next"** → S06.
- **"Skip"** → persists onboarding-complete flag → S09.
- Sample stat block is inert; screen reader reads it as one region: "Example: 83 percent, 5 of 6 days you showed up. Breakdown: ideal, fallback, off." (missed is never named in the announcement — consistent with F5's real dashboard, which also never names missed as its own slice; the 1 missed day among the 7 is present in the underlying composition and load-bearing to the 83% math, but is only ever communicated as the bar's unfilled remainder, never announced or labeled).
- Progress dots announced as "Step 4 of 5."

## Responsive
- Phones-only; desktop is review-only, no committed tablet/desktop layout.

## Copy (adapted from IDEA.md Flow 1.4, reworded per PRD's no-streak-language rule — see B4)
- "Every day counts — ideal or fallback."
- Sample stat: "83%" / "5 of 6 days" with ideal/fallback/off-day legend.
- "Nothing to lose here. We count how often you show up — a fallback still counts."

---

# S06 — Onboarding: Make it yours    route: /onboarding/personalize
Features: F9, F8, F14

## Contents

Onboarding shell from S02, progress dots only (5-dot progress — all 5 steps complete: this is the last screen of the core 5-step pitch tour). **No Skip control on this screen** — unlike S02–S05, SITEMAP's S06 Primary actions are limited to accent-pick / reminder-toggle / Next, and its Leads-to is S07/S08 only (no S09 edge); Skip taken on an earlier screen (S02–S05) bypasses S06 entirely, so S06 itself never needs its own Skip.

- Headline: "Make it yours."
- Body copy: "Pick an accent color and decide if you want a gentle nudge now and then."
- **Accent picker section:**
  - Section label: "Accent color"
  - Helper: "Only recolors buttons and progress — never the ideal, fallback, or off-day colors."
  - Row of 4 swatches (closed accent set, DESIGN.md F8): Forge Orange, Indigo, Berry, Plum. Selected state shows a check glyph. Default selection: Forge Orange (matches DESIGN.md's stated default).
  - Live mini-preview: a small `Button` reading "Preview" rendered in the currently-selected accent, so the effect is immediately visible (non-interactive, illustrative only).
- **Reminders section:**
  - Section label: "Reminders"
  - `Switch` row: label "Gentle nudges for due habits", `Switch` control off by default (opt-in, matching F14's "primed with rationale before the system prompt" — this in-app switch is the opt-in gate; the OS permission itself is only requested at S07, reached only if this switch is on).
  - Helper: "You can change this anytime in Settings."
- `Button` "Next".

## States
- **Default.** Forge Orange pre-selected, Reminders switch off.
- **Accent selected.** Tapping a swatch updates selection + preview button immediately; persists to Settings (F8) on Next.
- **Reminders toggled on.** Switch turns on. Determines the next screen (see Interactions).
- **Loading.** N/A — no fetch; hydrating a previously-chosen accent (if onboarding was interrupted and resumed) renders the swatches immediately from the persisted-so-far value, no skeleton needed (instant local read).
- **Error.** Persist failure on Next (rare: local write failure) → calm inline `Toast` "Couldn't save that — try again," selection reverts to last-saved value; user can retry Next. Never blocks navigation with a hard error screen.
- **Empty.** N/A — no list/data surface.

## Interactions
- Tap a swatch → selects that accent (single-select, radio-like behavior); screen reader announces "Forge Orange, selected" etc.
- Toggle "Gentle nudges for due habits" → on/off; `aria-checked` state announced.
- **"Next"** → persists accent (F8) + reminders preference (F14) → **S07** if reminders switch is **on**, else → **S08** directly (reminders declined; the OS permission primer is skipped entirely since there is nothing to prime for).
- Progress dots announced as "Step 5 of 5."

## Responsive
- Phones-only; desktop is review-only, no committed tablet/desktop layout.

## Copy (paraphrased connective copy + IDEA.md Flow 1.5 beat: "pick an accent, turn on reminders")
- "Make it yours."
- "Pick an accent color and decide if you want a gentle nudge now and then."
- "Accent color" / "Only recolors buttons and progress — never the ideal, fallback, or off-day colors."
- "Reminders" / "Gentle nudges for due habits" / "You can change this anytime in Settings."

---

# S07 — Notification Permission Primer    route: /onboarding/notifications-primer
Features: F9, F14

## Contents

**Not the S02–S06 shell** — no Skip button, no progress dots (this is a permission-rationale interstitial, not a numbered pitch step; F9 requires rationale-before-system-prompt, not a skippable-tour step, though the user can still opt out via "Not now").

- No back control (single-purpose interstitial reached only from S06 with reminders on).
- Lucide icon (`Bell` glyph).
- Headline: "Gentle nudges, never nagging."
- Body copy: "A quiet reminder when a habit is due, and one invitation back after an off day. That's it."
- **Sample notification preview `Card`**, resembling a system notification banner:
  - App-icon placeholder (Lucide `Bell` tile) + "Fallback" label, "now" timestamp.
  - Notification title: "Time for your evening walk"
  - Notification body: "Too tired? The fallback still counts."
- `Button` "Allow" and `Button` "Not now".

## States
- **Default.** As above, prior to the OS system permission dialog appearing.
- **Requesting (transient).** Tapping "Allow" triggers the native OS permission dialog (system-owned UI, outside this app's render — not mocked here beyond a brief disabled/loading state on the Allow button while the OS sheet is open, `aria-busy`).
- **Granted.** OS permission accepted → proceeds to S08. No confirmation toast needed here (S08 is the very next screen either way).
- **Declined (either via "Not now" or the OS dialog's own deny)** → proceeds to S08 identically — F9's acceptance criterion "fully usable if declined" means this is a non-blocking fork, not an error state. No calm-retry banner needed since nothing failed; it's a valid user choice.
- **Loading / Empty / Error.** No data fetch; no persistence failure mode beyond the generic F14 settings-write retry (same InlineRetryBanner-class handling as any settings toggle, surfaced later on S42 if it ever needs correction — not modeled as a distinct state here since this screen's only "write" is the permission request itself, which is OS-owned).

## Interactions
- **"Allow"** → triggers the OS notification-permission system prompt → regardless of the OS outcome (granted or denied by the user in that system dialog) → **S08**.
- **"Not now"** → declines without ever showing the OS system prompt → **S08**.
- Both buttons screen-reader labeled "Allow notifications, button" / "Not now, button".
- Killed mid-screen → relaunch resumes at S07 (same interruption-resume rule as the rest of onboarding).

## Responsive
- Phones-only; desktop is review-only, no committed tablet/desktop layout.

## Copy (verbatim, IDEA.md Flow 10.2)
- "Gentle nudges, never nagging. A quiet reminder when a habit is due, and one invitation back after an off day. That's it."
- Sample notification: "Time for your evening walk — Too tired? The fallback still counts."
- "Allow" / "Not now"

---

# S08 — Onboarding: First Task    route: /onboarding/first-task
Features: F9, F2

## Contents

Not the S02–S06 pitch shell (no Skip/progress-dots pattern) — this is the final, required onboarding step (F9's flow always resolves here before S09; there is no "Skip past creating a first task" — Skip taken on an earlier screen bypasses this entire remaining tour, including this screen, going straight to S09).

- No back control. Label: "Last step".
- Headline: "Add your first habit."
- Body copy: "We'll start with a routine — pick a type, then give it an ideal and a fallback."
- **Type picker row** (4 tiles, matches S04's language): Routines / Events / Courses / To-dos, same Lucide glyphs as S04. **Only "Routines" is enabled/selectable** in this mini-create (pre-selected); Events/Courses/To-dos render disabled (DESIGN.md's standard disabled treatment) with a small `Tag` "After setup" — this mini-create's scope is F2 (Routines) only; the other three types (F11) become available on Today via "+" once onboarding completes.
- **Mini routine form** (simplified — not the full S16 Create Routine builder: no icon/color picker, no importance/necessity picker, no per-occurrence sub-step toggles; cadence is fixed to "Every day" for this first routine, editable later via the Manage Task Sheet):
  - `Input` — label "Name", placeholder "Morning workout", helper "What do you want to build?"
  - `Input` — label "Ideal", placeholder "Full workout — 30 min", helper "The full version, on a good day."
  - `Input` — label "Fallback", placeholder "10 pushups", helper "The low bar — still counts as showing up."
  - Static line: "Runs every day — you can change that anytime."
- `Button` "Save routine", **disabled** until Name + Ideal + Fallback all have content (F2's "both required to save" rule, scoped here to trackable Routines — this mini-create never produces an as-needed routine).

## States
- **Default.** Routines tile pre-selected; three text inputs empty; Save disabled.
- **Filling.** As the user types, Save enables once all three fields are non-empty; live, no submit-time surprise.
- **Validation error.** If Save is somehow triggered with a gap (e.g. programmatic back-forward nav restoring a partial state) — `Input` `error` state on the empty field(s): inline helper text swapped to "Add a name to continue" / "Add an ideal version to continue" / "Add a fallback to continue", same visual class as F2's real create-flow validation (S16). Never a full-screen error; no data lost.
- **Saving (loading).** Save button shows its `loading` state (`aria-busy`) while the routine record persists (F1).
- **Persist failure.** Calm inline `Toast` "Couldn't save — try again," Save button reverts to its enabled default state, all typed field content preserved (never a false "saved").
- **Success.** On successful save, routine is created — cadence = daily, importance/necessity default to Medium/Recommended, **icon defaults to Lucide `Repeat`** (the same generic Routines-type glyph shown on the type-picker tile above, not a category-specific icon from S21's Fitness/Health/Work/Study grids), **color defaults to Forge Orange** (S21's closed four-color task-color set's own default, matching F8's accent default) — none of these four defaults are surfaced as a choice in this mini-create; all four (cadence, importance/necessity, icon, color) are editable later via the Manage Task Sheet (S20) / Icon & Color Picker (S21). → immediately routes to S09, where the new routine appears on Today (matches IDEA.md Flow 1.7's "Today · first habit set 🌱").
- **Empty.** N/A for this screen's own content (it IS the mechanism that populates Today's empty state) — but note Routines/Events/Courses/To-dos tiles carry no "empty" concept themselves, they're a type selector.

## Interactions
- Tap a type tile → only "Routines" responds (selects); tapping a disabled tile (Events/Courses/To-dos) does nothing but is still announced by screen reader as "Events, unavailable until after setup" etc. (not a silent dead tap).
- Fill Name / Ideal / Fallback → live-enables Save.
- **"Save routine"** → validates all three present → persists (F1) → **S09** (per Flow: "S08 → [creates first task, Save] → S09").
- No "Skip" control exists on this specific screen — reaching S08 at all means the user opted into the full tour through S06/S07; the only way to bypass first-task creation is Skip on an earlier screen (S02–S06), which routes straight to S09 and this screen is never shown.
- Killed mid-screen → relaunch resumes at S08 with any typed-but-unsaved field content lost (not yet persisted) — acceptable per F9's edge case ("resumes on next launch" means resumes at the *screen*, not mid-keystroke state).

## Responsive
- Phones-only; desktop is review-only, no committed tablet/desktop layout.

## Copy (paraphrased connective copy; type names/labels drawn from IDEA.md Flow 1.6/1.3; placeholders drawn from IDEA.md Flow 1.2's own worked example)
- "Add your first habit." / "We'll start with a routine — pick a type, then give it an ideal and a fallback."
- "Last step"
- Field labels: "Name", "Ideal", "Fallback"; placeholders "Morning workout", "Full workout — 30 min", "10 pushups"
- "Runs every day — you can change that anytime."
- "Save routine"

---

# S09 — Today    route: /today
Features: F3, F4, F5, F6, F14

## Contents

**Header**
- Page title: "Today"
- Date subline: "Thu, Jul 16"
- `IconButton` (ghost) cluster, three icons, `aria-label`s as noted — this is S09's hub role per SITEMAP (S09 is the sole entry to S31 and S41):
  - Assistant (mic glyph) — `aria-label="Fallback AI assistant"` → **S31 Assistant Home**.
  - Search (magnifying glass) — `aria-label="Search"` → **S14**, origin = Today.
  - Settings (gear glyph) — `aria-label="Settings"` → **S41 Settings Home**.
- `OffDayToggle` (NEW, whole-day grain): label "Mark today off" + toggle turning on to mark the whole day off. Tapping does NOT require confirmation (reversible, F4) — toggles immediately with a brief `Toast` ("Today marked off — nothing due counts against you" / "Today's mark removed").

**Stat & achievements**
- One `Card`, tappable: big numeral ("84%") and "26 of the last 31 days →" with a chevron `Icon`. Tap → S25.
- On zero-qualifying-data: chip instead reads "No data yet · see your dashboard →" (still tappable, still → S25).
- **Achievements teaser row (NEW)** — a second, slimmer `Card`, tappable: trophy `Icon` (never `--celebration-gold`/MilestoneBadge treatment — that gold/corner-slot motif is reserved exclusively for S27–S30 per DESIGN.md, and Today never populates a card's `corner` slot), label "See your achievements", trailing chevron `Icon`. Tap → **S27 Achievements**. Distinct purpose from the stat chip: the stat chip is the %-showed-up consistency metric (F5); this row is the Level/XP/badges entry point (F13/F29).

**Task list**
- One `Card` per task due today:
  - Leading `Icon` (task's chosen icon).
  - Name + meta line: task type + time if any + cadence hint (e.g. "Routine · daily", "Course · dose 2/2 today").
  - Trailing `StateChip` (NEW) — one of To do / Done / Fallback / Skip. **Rule-4 compliant rendering (cross-batch review B3 fix):** the filled states (Done/Fallback/Skip) render as an icon-only pill in the signal fill (`--icon-on-signal` glyph, no reversed text on the fill); the state's text label ("Done"/"Fallback"/"Skip"/"To do") sits with the pill on the card's neutral background, never on the fill itself. Tapping the chip cycles/opens a quick state picker and commits a log **without leaving Today** (see Interactions). Tapping anywhere else on the card row → S20.
  - A toggle-routine (F23) with a sub-step not due today shows no visual difference on Today (the row still represents the whole occurrence); which sub-steps are due is visible inside S20 only.
- Rows are grouped in due-time order where a time exists, undated routines first.

**Add affordance**
- `IconButton` (accent) floating, plus glyph. Tap → S15. **FAB-occlusion fix (cross-batch review B5):** the task list carries enough clearance below its last card that the FAB never overlaps a card's content (including its trailing StateChip) at any scroll position, including scrolled fully to the end — the FAB floats over blank clearance, never over a row.

**Primary nav**
- `BottomTabs`: Today (active) · Routines · Events · Courses · To-dos. Active = Today. Tapping another tab → S10/S11/S12/S13.

## States

- **Default / populated** — as above, 4 tasks shown with all four `StateChip` values represented (see Copy).
- **Loading (first paint)** — `Skeleton` rows (3) in place of task cards; stat chip shows a `Skeleton` bar; off-day toggle and tabs render immediately (chrome first).
- **Empty — blank slate (first run, F6/IDEA Flow 7.1 verbatim)** — no tasks exist anywhere yet. `EmptyState`: muted "sprout" `Icon`, headline "Nothing planned for today yet.", subcopy "A blank slate. Add one small thing — something beats nothing.", primary `Button` "Add your first task" → S15. Stat chip reads "No data yet".
- **Empty — nothing due today (routines exist, F6 edge case)** — headline "Nothing due right now.", subcopy "Enjoy the open day, or add something new.", secondary `Button` "+ Add a task" → S15. Off-day toggle and stat chip still render normally.
- **Whole day marked off** — every task row renders in its off-day state (meta row reads "Off today"), `StateChip`s render disabled (non-interactive while off — F4's off mark is a day-level override; per-task edits resume once un-marked). Off-day toggle shows "on". A `Toast` confirms "Today marked off — nothing due counts against your %."
- **Just added (first task saved, IDEA Flow 1.7 verbatim)** — transient banner: "Today, Thu, Jul 16 · your first habit is set 🌱" (reached once, right after S08). Single task card ("Movement") shown, state To do.
- **Re-entry — arrived via a missed-day encouragement notification (F14, IDEA Flow 5.2 verbatim)** — this is S09's F14 touchpoint: tapping an "Even a little keeps you growing" push notification deep-links here. A dismissible banner `Card`: headline "No workout yesterday — that's okay.", subcopy "Rest is part of the rhythm. One off day doesn't undo anything." The stat chip is re-worded for this context only: "Your consistency is intact — 84% · 26 of the last 31 days you showed up — ideal or fallback." A ghost `Button` CTA "Even 10 pushups counts →"; tapping it opens the relevant task's (here, "Movement") `StateChip` quick picker inline, highlighted — the same in-page log affordance as any other chip tap (see Interactions), not a navigation. This state never appears unprompted; it exists only as the landing state for an F14 notification tap.
- **Error / read failure** — task list region replaced by `InlineRetryBanner` ("Couldn't load today's tasks. Your data is safe on this device." + ghost "Retry"); stat chip and off-day toggle still attempt to render independently (partial-failure tolerant).
- **Persist failure on a chip tap** — chip reverts to its prior value (not the reward spring) + `Toast` "Couldn't save that — try again."

## Interactions

- Tap a `StateChip` → cycles/opens the 4-way picker inline → selecting Done or Fallback commits with the spring/reward motion, ticks any live XP numeral elsewhere in the app (not shown here), and — being a qualifying completion — presents the **S24 Completion Celebration** overlay before returning to S09. If that same completion also crosses an XP level-up or milestone threshold (F13/F29), **S28 Level-Up Celebration** presents next, immediately after S24's dismissal (SITEMAP: S28 `Reached from: S09, S20`, triggered by a qualifying completion) — S28 then returns to S27, per SITEMAP, rather than back to S09 directly. Selecting Skip or To do commits with the standard motion and no celebration. State persists immediately (F1) and F5 recomputes.
- Tap a task card (outside the chip) → S20 Manage Task Sheet.
- Tap "+" → S15 Add Task: Pick Type.
- Tap the stat chip → S25 Consistency Dashboard.
- Tap the Achievements teaser row → S27 Achievements.
- Tap the Assistant (mic) `IconButton` → S31 Assistant Home.
- Tap the Settings (gear) `IconButton` → S41 Settings Home.
- Tap the search `IconButton` → S14 Filter & Search, tagged with origin = Today so its own back action returns here.
- Toggle "Mark today off" → F4 whole-day mark; toggling back off restores every task's prior logged state exactly as it was before the mark (F4 edge case).
- Tap a `BottomTabs` item → corresponding browse screen (S10–S13).
- (Re-entry state only) Tap "Even 10 pushups counts →" → opens the highlighted task's `StateChip` picker inline, same effect as tapping that chip directly.

## Responsive

Phones-only product (DESIGN.md Rule 14 — no tablet/desktop layout committed in v1). There is no desktop variant to design; opening the mockup on a wide viewport does not reflow into a desktop layout, matching the phones-only scope.

## Copy

- Header: "Today" / "Thu, Jul 16"
- Off-day toggle label: "Mark today off"
- Off-day on toast: "Today marked off — nothing due counts against your %."
- Off-day un-mark toast: "Today's mark removed — your prior log is back."
- Stat chip: "84% · 26 of the last 31 days →" / no-data variant "No data yet · see your dashboard →"
- Achievements teaser: "See your achievements"
- Task examples: "Movement" (Routine · daily) — Done; "Read" (Routine · daily) — Fallback; "Studying" (Routine · Mon–Fri) — To do; "Antibiotics" (Course · dose 2/2 today) — Skip
- Blank-slate empty: "Nothing planned for today yet." / "A blank slate. Add one small thing — something beats nothing." / Button "Add your first task"
- Nothing-due empty: "Nothing due right now." / "Enjoy the open day, or add something new."
- First-task banner: "Today, Thu, Jul 16 · your first habit is set 🌱"
- Re-entry banner (F14, IDEA Flow 5.2 verbatim): "No workout yesterday — that's okay." / "Rest is part of the rhythm. One off day doesn't undo anything." / re-worded stat line "Your consistency is intact — 84% · 26 of the last 31 days you showed up — ideal or fallback." / CTA "Even 10 pushups counts →"
- Read-failure banner: "Couldn't load today's tasks. Your data is safe on this device." / ghost "Retry"
- Chip-revert toast: "Couldn't save that — try again."

## Display-format note (PRD §7 fork, resolved here)

PRD §7 leaves the F5/F30 "X of Y days" framing open under fractional credit (OWNER: spec-writer/designer, not human). This spec resolves it for S09's stat chip by keeping the "days" framing (PRD §7's first option): **X = the rounded Σ of each elapsed day's fractional ideal/fallback credit** (per Decision 18's proportional formula); **Y = Decision 18's own denominator — the count of elapsed days in the window with ≥1 due, non-off, resolved task** (PRD §3.5 scope 2) — NOT the raw elapsed-day count of the window. Off days, and any elapsed day with nothing due or nothing yet resolved, are excluded from Y exactly as they are excluded from X's numerator, so X/Y stays consistent with the % printed beside it and with the off-day exclusion promised elsewhere on this screen (an off day is never counted against the streak, in numerator or denominator). The "last N days" phrase in the display copy names the fixed lookback window itself (e.g. "the last 31 days"); it is a separate, descriptive suffix and is not folded into Y.

The "26 of the last 31 days" fixture used throughout this spec and its mockups is the **degenerate case** of this rule: every one of the 31 window days happens to have ≥1 qualifying (due, non-off, resolved) task, so no days are excluded and Y equals the window length exactly — which is why this fixture can use IDEA Flow 5.2's worked example verbatim. In any other window — one that actually contains an off day, or a day with nothing due or nothing yet resolved — Y would be smaller than the window length (e.g. a 31-day window with 3 off days yields Y = 28, not 31), and X/Y would be recomputed over that narrower denominator so it continues to approximate the displayed %.

---

# S10 — Routines Browse    route: /routines
Features: F2, F6, F27

## Contents

- Page title "Routines".
- Search `IconButton` → S14 (origin = Routines).
- Weekday strip (IDEA Flow 7.2 verbatim convention): seven read-only day tabs, Mon–Sun, current day pre-selected. This previews which weekday's due-set to badge — it does **not** hide any routine from the list (F6/F27 both require every routine, including as-needed, to stay visible in this browse).
- Section label "Due <Selected Day>" for the scheduled-and-due-that-day group.
- List with two sections, always both present:
  1. **"Due <Selected Day>"** — scheduled (cadenced) routines whose occurrence set includes the selected weekday. Each row is a `Card`:
     - Icon, name, meta line: cadence text ("Daily", "Mon–Fri") + ideal/fallback name pair as `Tag`s ("Ideal: Full workout" / "Fallback: 10 pushups"), Importance/Necessity `Tag`s.
     - A "Due" `Badge` (text-only — never color-coded per Tag rules).
     - No `StateChip` here (logging happens on Today or inside S20) — tap → S20.
  2. **"Other routines"** — every remaining routine: scheduled routines not due on the selected weekday (cadence text reads e.g. "Due Mon·Wed·Fri"), **and every as-needed routine**, rendered with the **`AsNeededCard`** (NEW) treatment: name + `Button` "Log used it" + a one-line reference-only history preview ("Last used Jul 2") — explicitly **no due-badge, no cadence text, no heatmap preview, no Importance/Necessity requirement** (ideal/fallback optional per F27). Tap the card (or the button) → S23.
- Add `IconButton` with plus glyph → S15. **FAB-occlusion fix (cross-batch review B5, shared shell with S09):** the list carries enough bottom clearance below its last row that the FAB never overlaps a card's content at any scroll position, including scrolled fully to the end.
- `BottomTabs`: Routines active.

## States

- **Default / populated** — both sections present, mixing scheduled + as-needed rows as above.
- **Loading** — `Skeleton` weekday strip + 3 skeleton rows.
- **Empty — no routines at all (F6 verbatim)** — `EmptyState`: headline "Create your first routine", subcopy "Routines are the day-to-day habits you show up for — give one an ideal and a fallback.", primary `Button` "New routine" → S15. Weekday strip still renders (inert).
- **Empty — nothing due on the selected day, but routines exist elsewhere (IDEA Flow 7.3 verbatim)** — scoped to the "Due <Day>" section only: headline "Nothing scheduled.", subcopy "No routines on Thursdays — enjoy the rest day, or add one to fill it." (day name matches the selected strip tab). The "Other routines" section still lists normally.
- **Error** — list region replaced by `InlineRetryBanner`; weekday strip still shown.

## Interactions

- Tap a weekday tab → re-badges the "Due <Day>" section (client-side re-partition, no navigation); does not remove any routine from the list.
- Tap a scheduled-routine card → S20 Manage Task Sheet.
- Tap an as-needed card (or its "Log used it" button) → S23 As-Needed Routine Detail.
- Tap "+" → S15 Add Task: Pick Type.
- Tap search → S14, origin = Routines.
- Tap a `BottomTabs` item → S09/S11/S12/S13.

## Responsive

Phones-only (no tablet/desktop layout per DESIGN.md).

## Copy

- Title: "Routines"
- Section labels: "Due Thursday" / "Other routines"
- Due badge: "Due"
- Scheduled example, due today: "Movement" — Daily — Ideal: 30-min workout / Fallback: 5-min walk — Importance High, Necessity Must-do; "Studying" — Mon–Fri — Ideal: Study block (+ "Finish weekly assignments" due Fridays only) / Fallback: Review notes 5 min
- Scheduled example, not due today (Thursday selected): "Yoga flow" — Sat·Sun — shown under "Other routines," meta text reads "Due Sat·Sun"
- As-needed example: "Emergency plan" — "Log used it" — "Last used Mar 3" (reference-only)
- Empty (no routines): "Create your first routine" / "Routines are the day-to-day habits you show up for — give one an ideal and a fallback." / Button "New routine"
- Empty (nothing due this day): "Nothing scheduled." / "No routines on Thursdays — enjoy the rest day, or add one to fill it."

---

# S11 — Events Browse    route: /events
Features: F11, F26

## Contents

- Page title "Events".
- Search `IconButton` → S14 (origin = Events).
- Chronological list: "Today" section, then "Upcoming" section (grouped by day, e.g. "Tomorrow", "Fri, Jul 17"). Only genuine Event-type tasks appear here — **no course-derived entries** (Courses live exclusively on S12; an earlier design pass explicitly removed a "read-only course-derived entries" idea from this screen and it must not be re-added).
- Each row is a `Card`:
  - Icon, name.
  - Meta line: time ("6:00 PM") + a recurrence `Badge` — "One-time" (default, non-recurring) or "Repeats · Weekly" style text for a repeating Event (F26).
  - If the Event carries optional ideal+fallback (F11), `Tag`s show both names; if not, no tags render (ideal/fallback is optional for Events, unlike trackable Routines).
  - No `StateChip` on the row — tap → S20.
- Add `IconButton` with plus glyph → S15. **FAB-occlusion fix (cross-batch review B5, shared shell with S09):** the list carries enough bottom clearance below its last row that the FAB never overlaps a card's content at any scroll position, including scrolled fully to the end.
- `BottomTabs`: Events active.

## States

- **Default / populated** — Today + Upcoming sections as above.
- **Loading** — `Skeleton` rows under both section headers.
- **Empty — no events today, but events exist upcoming (IDEA Flow 7.5 verbatim, scoped to the Today section)** — Today section shows: headline "No events today.", subcopy "Nothing on the calendar for Sunday. Schedule a one-off whenever you need to." (day name matches the current day). The Upcoming section still lists normally.
- **Empty — no events at all (F6-pattern, not explicitly quoted in source, authored consistent with it)** — `EmptyState` replaces both sections: headline "No events yet.", subcopy "Events are one-off or repeating plans at a set time — a dentist visit, a weekly dinner.", primary `Button` "New event" → **S17** (direct-create edge per SITEMAP: S11 Leads to S17; this button already knows the type, so it skips S15's pick-type step).
- **Error** — list region replaced by `InlineRetryBanner`.

## Interactions

- Tap an event card → S20 Manage Task Sheet.
- Tap "+" → S15 Add Task: Pick Type.
- Tap the "New event" empty-state button (no events at all) → **S17 Create Event** directly (SITEMAP direct-create edge, S11 → S17 — distinct from the general "+" FAB, which still goes through S15's pick-type step; S15 remains reachable from S11 via the FAB, per SITEMAP S15 Reached-from).
- Tap search → S14, origin = Events.
- Tap a `BottomTabs` item → S09/S10/S12/S13.
- Saving a new event on S17 returns here (S17 → S11) when this screen was the creation entry point.

## Responsive

Phones-only (no tablet/desktop layout per DESIGN.md).

## Copy

- Title: "Events"
- Section labels: "Today" / "Upcoming"
- Recurrence badges: "One-time" / "Repeats · Weekly"
- Populated examples: "Dentist visit" (one-time, Fri Jul 17, 2:30 PM), "Team dinner" (Repeats · Weekly, Fri 7:00 PM), "Call mom" (one-time, Fri 6:00 PM)
- Empty (no events today): "No events today." / "Nothing on the calendar for Sunday. Schedule a one-off whenever you need to."
- Empty (no events at all): "No events yet." / "Events are one-off or repeating plans at a set time — a dentist visit, a weekly dinner." / Button "New event"

---

# S12 — Courses Browse    route: /courses
Features: F11, F12

## Contents

- Page title "Courses".
- Search `IconButton` → S14 (origin = Courses).
- `Tabs`: Active / Past. Active selected by default.
- List, each row a `Card`:
  - Icon, name.
  - Progress line: a linear progress bar (course days elapsed ÷ total days — a generic progress read, not the signal-color F5 breakdown) + text "Day 8 of 10".
  - Meta `Badge`s: dose cadence ("2×/day") when the course has multiple doses (F12), and time remaining ("2 days left") for Active courses, or "Completed Jul 5" for Past courses.
  - Ideal/fallback name `Tag`s (courses are trackable, F11).
  - No `StateChip` on the row — tap → S20 (which hosts F12's per-dose completion UI).
- Add `IconButton` with plus glyph → S15. **FAB-occlusion fix (cross-batch review B5, shared shell with S09):** the list carries enough bottom clearance below its last row that the FAB never overlaps a card's content at any scroll position, including scrolled fully to the end.
- `BottomTabs`: Courses active.

## States

- **Default / populated (Active tab)** — as above.
- **Past tab** — same card content, progress bar shown full/final, badge reads "Completed <date>" instead of "days left", no live dose badge.
- **Loading** — `Skeleton` rows.
- **Empty — no active courses, but past courses exist** — Active tab shows: headline "No active courses right now.", subcopy "Start a new one whenever you're ready.", secondary `Button` "New course" → **S18** (direct-create edge, see Interactions). Past tab still lists normally.
- **Empty — no courses at all, either tab (IDEA Flow 7.7 verbatim)** — `EmptyState`: headline "Start your first course", subcopy "Courses are habits with an end date — a medication, a 30-day challenge. Start one when you're ready.", primary `Button` "New course" → **S18** (direct-create edge, see Interactions).
- **Error** — list region replaced by `InlineRetryBanner`.

## Interactions

- Tap Active/Past `Tabs` → switches list contents in place, no navigation.
- Tap a course card → S20 Manage Task Sheet.
- Tap "+" → S15 Add Task: Pick Type.
- Tap either "New course" empty-state button (no-active or no-courses-at-all) → **S18 Create Course** directly (SITEMAP direct-create edge, S12 → S18 — distinct from the general "+" FAB, which still goes through S15's pick-type step; S15 remains reachable from S12 via the FAB, per SITEMAP S15 Reached-from).
- Tap search → S14, origin = Courses.
- Tap a `BottomTabs` item → S09/S10/S11/S13.
- Saving a new course on S18 returns here (S18 → S12) when this screen was the creation entry point.

## Responsive

Phones-only (no tablet/desktop layout per DESIGN.md).

## Copy

- Title: "Courses"
- Tabs: "Active" / "Past"
- Populated examples (Active): "Antibiotics" — Day 8 of 10 — 2×/day — 2 days left — Ideal: Take with food / Fallback: Take late, don't skip; "Spanish practice" — Day 23 of 30 — ongoing — Ideal: 20-min lesson / Fallback: 5-min review
- Empty (no active, past exist): "No active courses right now." / "Start a new one whenever you're ready."
- Empty (no courses at all): "Start your first course" / "Courses are habits with an end date — a medication, a 30-day challenge. Start one when you're ready." / Button "New course"

---

# S13 — To-dos & Notes Browse    route: /todos
Features: F11

## Contents

- Page title "To-dos & Notes".
- Search `IconButton` → S14 (origin = To-dos).
- Segmented lens (IDEA Flow 7.8 verbatim): a segmented pill control, two options: "To-dos" / "Notes", on the same catch-all list (both types share one underlying list, this is a display lens, not a hard filter into separate screens).
- List, each row a `Card`:
  - **To-do row:** `Checkbox` (completion — a plain binary done/not-done control, **not** the 4-state `StateChip`, since To-dos/Notes carry no ideal/fallback per F11). Per DESIGN.md Rule 8 the tappable hit area is expanded to remain reachable. Name (strikethrough when checked), Importance `Tag` (e.g. "High") and Necessity `Tag` if set.
  - **Note row:** no checkbox (notes have nothing to complete), just name + a one-line preview of its content, Importance `Tag` if set.
  - No schedule/date field on either row type (F11: "no schedule").
- Add `IconButton` with plus glyph → S15. **FAB-occlusion fix (cross-batch review B5, shared shell with S09):** the list carries enough bottom clearance below its last row that the FAB never overlaps a card's content at any scroll position, including scrolled fully to the end.
- `BottomTabs`: To-dos active.

## States

- **Default / populated (To-dos lens)** — mixed-priority to-do list, some checked.
- **Notes lens** — same list filtered to Note-type items only, no checkboxes.
- **Loading** — `Skeleton` rows.
- **Empty — nothing yet (authored, on-brand; not verbatim-specified in source)** — `EmptyState`: headline "Nothing here yet.", subcopy "Jot down a to-do or note — no schedule required.", primary `Button` "New to-do or note" → **S19** (direct-create edge, see Interactions). (Notes lens empty variant: "No notes yet." / "Loose thoughts, reminders, anything that doesn't need a schedule." — same button, same S19 target.)
- **Error** — list region replaced by `InlineRetryBanner`.

## Interactions

- Tap the segmented pill → switches the lens in place (To-dos ⇄ Notes), no navigation.
- Tap a To-do's `Checkbox` → toggles done/not-done directly on the row (no chip picker, no S24 celebration — To-dos/Notes carry no XP eligibility per F13's due-occurrence rule, since they have no due occurrence at all).
- Tap anywhere else on a row (name/preview) → S20 Manage Task Sheet.
- Tap "+" → S15 Add Task: Pick Type.
- Tap the "New to-do or note" empty-state button (either lens) → **S19 Create To-do/Note** directly (SITEMAP direct-create edge, S13 → S19 — distinct from the general "+" FAB, which still goes through S15's pick-type step; S15 remains reachable from S13 via the FAB, per SITEMAP S15 Reached-from).
- Tap search → S14, origin = To-dos.
- Tap a `BottomTabs` item → S09/S10/S11/S12.
- Saving a new to-do/note on S19 returns here (S19 → S13) when this screen was the creation entry point.

## Responsive

Phones-only (no tablet/desktop layout per DESIGN.md).

## Copy

- Title: "To-dos & Notes"
- Segmented pill: "To-dos" / "Notes"
- Populated To-do examples: "Renew passport" (Importance High), "Return library books" (Importance Low, checked/done), "Call the plumber" (Importance Medium, Necessity Must-do)
- Populated Note example: "Gift ideas for Mom's birthday — scarf, the tea sampler, that pottery class" (Importance Medium)
- Empty (To-dos lens): "Nothing here yet." / "Jot down a to-do or note — no schedule required." / Button "New to-do or note"
- Empty (Notes lens): "No notes yet." / "Loose thoughts, reminders, anything that doesn't need a schedule."

---

# S14 — Filter & Search    route: /search
Features: F15

## Contents

- Back `IconButton` (chevron), labeled by origin — e.g. "‹ Today" / "‹ Routines" / "‹ Events" / "‹ Courses" / "‹ To-dos" — reflecting whichever of S09–S13 launched this screen (SITEMAP Decision 16).
- Page title "Search".
- `Input` (search variant), placeholder "Search tasks", live-filters as the user types.
- Filter chip groups (IDEA Flow 7.9 / Gallery G4 verbatim conventions):
  - **Type** — chips: Routine · Event · Course · To-do/Note. Multi-select (Radio-style single vocabulary but any number may be toggled on to broaden results — a closed set either way).
  - **Importance** — chips: High · Med · Low.
  - **Necessity** — chips: Must-do · Recommended · Optional.
  - Every chip feeds a one-tap filter per the design system's fixed filter convention. No free-form tag entry anywhere on this screen (fixed vocabularies only).
- Results: live-updating list, same `Card` row style as the originating browse tab (icon, name, meta, no `StateChip`). An "N results" count accompanies the list.
  - A Routine-type result may be either a scheduled (cadenced) routine or an **as-needed routine** (F27 sub-variant) — the Type filter's "Routine" chip covers both, per PRD §3.2. An as-needed result's meta line carries an "As-needed" `Tag` alongside the "Routine" type `Tag` so it's identifiable before it's tapped (see Interactions for its distinct destination).

## States

- **Default (no query, no filters)** — results show the full unfiltered set from the current search scope (all trackable + loose tasks across every type), most-relevant/most-recent first. The fixture set includes at least one as-needed routine result ("Emergency plan") alongside the scheduled/trackable results, so the S20/S23 branch is demonstrable, not just theoretical.
- **Query and/or filters active** — results narrow live; active filter chips indicate selection; a "Clear all" `Button` appears once ≥1 filter or a query is set.
- **Loading** — `Skeleton` rows while results recompute (only shown if a read takes >~150ms; typically instantaneous on-device).
- **Empty — no results (authored, on-brand)** — `EmptyState`: headline "No matches.", subcopy "Try a different search term, or clear a filter.", `Button` "Clear all filters".
- **Empty — nothing to search yet (no tasks exist anywhere)** — `EmptyState`: headline "Nothing to search yet.", subcopy "Once you add a task, it'll show up here."
- **Error** — results region replaced by `InlineRetryBanner`.

## Interactions

- Type in the search `Input` → live-filters results (debounced, on-device, no network).
- Tap a Type/Importance/Necessity chip → toggles that filter on/off, results recompute live.
- Tap "Clear all" → resets query + every filter chip to unselected.
- Tap a result row → **branches by routine variant, exactly mirroring S10's existing branch (SITEMAP Decision 17, cross-batch review B1):** a scheduled/trackable result (any Event, Course, To-do/Note, or scheduled Routine) → S20 Manage Task Sheet; an **as-needed routine** result → **S23 As-Needed Routine Detail** (S20's schedule/heatmap UI is undefined for as-needed routines, per SITEMAP Decision 2). S23's own back edge returns to S14 in this case (SITEMAP: S23 Leads to "S14 (back, if reached from S14)"), not to S10.
- Tap the back control → returns to **whichever of S09/S10/S11/S12/S13 this screen was reached from** — not a fixed destination. A static mockup cannot truly branch, so this mockup demonstrates the behavior with a small origin switcher (see mockup JS) that relabels the back control and changes where "back" is described as going; in the shipped app the origin is carried as navigation state, not a user-visible setting.

## Responsive

Phones-only (no tablet/desktop layout per DESIGN.md).

## Copy

- Title: "Search"
- Back control (origin-dependent): "‹ Today" / "‹ Routines" / "‹ Events" / "‹ Courses" / "‹ To-dos"
- Search placeholder: "Search tasks"
- Filter group labels: "Type" / "Importance" / "Necessity"
- Type chips: "Routine" · "Event" · "Course" · "To-do/Note"
- Importance chips: "High" · "Med" · "Low"
- Necessity chips: "Must-do" · "Recommended" · "Optional"
- Clear control: "Clear all"
- Populated result examples: "Movement" (Routine, High, Must-do), "Read" (Routine, Med, Recommended), "Studying" (Routine, Med, Recommended), **"Emergency plan" (Routine, As-needed — no Importance/Necessity, per F27; tapping it → S23, not S20)**, "Antibiotics" (Course, High, Must-do), "Dentist visit" (Event, Med, Must-do), "Renew passport" (To-do/Note, High, Optional)
- No-results empty: "No matches." / "Try a different search term, or clear a filter."
- Nothing-to-search empty: "Nothing to search yet." / "Once you add a task, it'll show up here."

---

# S15 — Add Task: Pick Type    route: /add

Features: F2, F11

## Contents

Presented as a native bottom sheet (Dialog component), triggered from the "+" affordance on S09/S10/S11/S12/S13. Not a full-page route on mobile — renders as a modal sheet regardless of which screen it was invoked from.

- Drag handle (decorative).
- Title: "What do you want to add?"
- `ghost` close (X) `IconButton`.
- Type list, 4 rows, each a tappable `Card` containing:
  - Lucide icon in a circle.
  - Title + one-line descriptor.
  - Chevron-right.
- Rows:
  1. **Routine** — "Recurring, day to day" → S16
  2. **Event** — "One-off, or repeats on a schedule" → S17
  3. **Course** — "A run with an end date — meds, a challenge" → S18
  4. **To-do / Note** — "A loose task, no schedule" → S19
- No primary CTA on this screen — tapping a row *is* the action. Sheet has no "Save"; it is pure navigation.

## States

- **default** — four rows as above, always available (no loading/empty variant; this is a static picker with no data dependency).
- **disabled: N/A** — no control on this screen is ever disabled; all four types are always creatable.

## Interactions

- Tap "Routine" row → navigates to S16 (/add/routine).
- Tap "Event" row → navigates to S17 (/add/event).
- Tap "Course" row → navigates to S18 (/add/course).
- Tap "To-do / Note" row → navigates to S19 (/add/todo).
- Tap close (X) or swipe-down / tap scrim → dismiss sheet, return to the screen that opened it (S09/S10/S11/S12/S13) with no changes.
- Screen reader: sheet announces as a modal; each row is a single-tap navigation button labeled with its title + descriptor.

## Responsive

Phones-only per PRD §5 device matrix; the desktop rendering is a review convenience, not a shipped breakpoint.

## Copy

- Sheet title: "What do you want to add?"
- Row 1: "Routine" / "Recurring, day to day"
- Row 2: "Event" / "One-off, or repeats on a schedule"
- Row 3: "Course" / "A run with an end date — meds, a challenge"
- Row 4: "To-do / Note" / "A loose task, no schedule"

---

# S16 — Create Routine    route: /add/routine

Features: F2, F23, F26, F27

This is the most complex create screen in the sitemap: it hosts two structurally different modes (trackable/cadenced vs. as-needed), the extended-cadence picker shared with S17/S18 (Decision 13), and F23's per-occurrence sub-step toggle grid with its save-time no-empty-run-occurrence validation. Presented as a full-screen form (not a sheet) given its length, pushed from S15.

## Contents

- `ghost` back (←) `IconButton` → returns to S15, discards unsaved changes with no confirm (nothing persisted yet).
- Title: "New Routine".
- Name Input, label "Routine name", placeholder "e.g. Studying", required (asterisk not used — required-ness communicated only via inline error copy, per "guidance not scolding").
- As-needed mode `Card` (Decision 11 / F27) containing:
  - Switch labeled **"As-needed routine"** (off by default).
  - Helper copy: "No schedule, no consistency tracking. Use this for something you'll trigger occasionally — an emergency plan, a rare situation — not a daily habit."
  - **This Switch is the single control that branches the rest of the form.** See States.

*(when As-needed is OFF — trackable/cadenced routine, the default)*

- Cadence region (F2 P0 + F26 extended, shared CadencePicker control):
  - Select, label "Repeats", options in order: `Daily`, `Specific weekdays`, `Weekly`, `Bi-weekly`, `Monthly`, `Bi-monthly`, `Yearly`.
  - Conditional sub-control by selection:
    - **Daily** — no further control; occurrence set = every day.
    - **Specific weekdays** — WeekdayPicker (Mon..Sun toggle chips); this selection defines the routine's own **occurrence set**, which every sub-step's toggle grid is constrained to. At least one day must be selected to save.
    - **Weekly / Bi-weekly** — a single weekday anchor Select: "Every {1|2} week(s) on {weekday}".
    - **Monthly / Bi-monthly** — a day-of-month Select: "Every {1|2} month(s) on the {1st..31st}".
    - **Yearly** — a month + day-of-month pair of Selects: "Every year on {Month} {day}".
    - For Weekly/Bi-weekly/Monthly/Bi-monthly/Yearly, the occurrence set is a **single occurrence per period** — per-occurrence sub-step subsetting is degenerate at this cadence (PRD §3B/F26), so the Sub-step schedule region is replaced with a static note rather than a toggle grid (see Interactions).
- Ideal steps region (ordered, required unless as-needed):
  - Label "Ideal — your full version".
  - Repeatable row list: drag handle + text Input (e.g. "Review notes (30 min)") + `ghost` delete `IconButton`. "+ Add step" `Button`.
  - At least one ideal step required to save (unless As-needed is on).
- Sub-step schedule region (F23 — toggle grid over the routine's own occurrence set):
  - Only rendered when cadence = Daily or Specific weekdays AND at least one ideal step exists.
  - Label: "When does each step apply?" with helper copy: "Every step runs on every day this routine is due, unless you narrow it below."
  - A **grid**: one row per ideal step (row label = step text), one column per day the parent routine is due (Daily → all 7 columns; Specific weekdays → only the selected weekdays' columns active, the remaining weekdays disabled with a lock glyph, per DESIGN.md's WeekdayPicker "days the parent doesn't run render disabled/unreachable" rule).
  - Each cell is a toggle chip (on/off). New steps default to **on for every parent day**.
  - An inline validation region (hidden unless triggered) — reserved for the no-empty-run-occurrence error (see States → error).
- Fallback region (whole-task, required unless as-needed):
  - Label "Fallback — your minimum-viable version". Helper: "This is a whole-routine fallback — it's available every day the routine runs, not scheduled per step."
  - Repeatable row list identical in mechanics to Ideal steps (drag/delete/add), but NOT subject to the sub-step schedule grid (F23 explicitly scopes toggling to ideal steps only).
  - At least one fallback step required to save (unless As-needed is on).

*(when As-needed is ON)*

- As-needed framing (replaces Cadence + Sub-step schedule regions entirely):
  - No cadence Select, no WeekdayPicker, no sub-step schedule grid rendered at all.
  - Ideal steps label changes to "Ideal (optional)"; Fallback label changes to "Fallback (optional)"; both sections stay visible (user MAY define them, F27) but carry no required-ness and no per-step toggle grid.
  - An inline note: "As-needed routines skip Today entirely — you'll log them from the Routines list whenever the situation comes up."

*(both modes)*

- Importance & Necessity — two Radio groups (fixed vocabularies, single-select each):
  - "Importance" — High / Med / Low.
  - "Necessity" — Must-do / Recommended / Optional.
- Footer:
  - `primary` Button "Save routine".
  - `ghost` Button "Cancel" → back to S15.

## States

- **default** — empty form, As-needed off, cadence defaulted to "Specific weekdays" with no days pre-selected, one blank ideal step row, one blank fallback step row, no importance/necessity selected.
- **as-needed toggled on** — Cadence and Sub-step-schedule regions disappear (per Decision 11); Ideal/Fallback become optional and their "required" validation is suppressed; the as-needed framing note appears. Demonstrated live in the mockup via the Switch.
- **populated (Studying fixture, §6)** — Name "Studying"; cadence = Specific weekdays, Mon–Fri selected; ideal steps = "Review notes (30 min)" (due all weekdays), "Practice problems" (due all weekdays), "Finish all weekly assignments" (due **Friday only**); fallback = "Skim notes for 5 minutes"; Importance = Med; Necessity = Recommended.
- **error — empty name**: Input shows `error` state, helper text replaced with "Give this routine a name to save it." Save is blocked; no other field's data is lost.
- **error — no cadence days selected** (Specific weekdays, zero days checked): WeekdayPicker shows inline validation: "Pick at least one day this routine runs."
- **error — missing ideal or fallback** (trackable mode only): the empty section shows inline text under its "+ Add step" button: "Add at least one ideal step to save this routine." / "Add a fallback — your minimum-viable version for a hard day."
- **error — no-empty-run-occurrence rejection (F23, PRD §3.10)**: triggered when every ideal-step toggle in a given day-column is off. Renders a banner: "Tuesday has no ideal step due — every step is toggled off. Turn at least one back on for Tuesday, or add a step that runs then." The offending day column header is also indicated as an error. Save is blocked until resolved.
- **loading (save in progress)**: "Save routine" Button enters `loading` state (spinner, `aria-busy`).

## Interactions

- Toggle "As-needed routine" Switch → shows/hides Cadence + Sub-step-schedule regions live; relabels Ideal/Fallback headers to "(optional)"; no data is lost if toggled back off mid-edit.
- Select a "Repeats" cadence value → reveals the matching sub-control (WeekdayPicker for Specific weekdays, single-anchor Selects for Weekly…Yearly); switching away from Daily/Specific-weekday to a coarser cadence collapses the sub-step grid to the static degenerate note.
- Toggle a day chip in the parent WeekdayPicker (Specific weekdays) → the sub-step grid's column set updates immediately to match (adding a day adds an "on by default" column for every existing step; removing a day drops that column from every step, per PRD §3.10 edge rule "dropping a parent occurrence auto-removes it from every sub-step's due-set").
- "+ Add step" (Ideal or Fallback) → appends a blank row, focuses its Input.
- Delete-row IconButton → removes that row (and its column-toggle state, for ideal steps).
- Toggle a grid cell → flips that step's due state for that day; live-validates: if a column now has zero ideal steps toggled on, the error for that day appears immediately (not only at save) as an early warning, but Save is what performs the authoritative block.
- "Save routine" →
  - validates name, (if trackable) cadence-days-selected, (if trackable) ≥1 ideal step, (if trackable) ≥1 fallback step, (if trackable) no-empty-run-occurrence across every parent day;
  - on failure → stays on S16, scrolls to first error, inline messages shown, no data lost;
  - on success → persists the routine, navigates to S09 (Today), where it appears if due today.
- Back (←) → S15, no confirmation (nothing saved yet).

## Responsive

Phones-only (no tablet/desktop layout per DESIGN.md); the desktop rendering is a review convenience only.

## Copy

- Title: "New Routine"
- As-needed helper: "No schedule, no consistency tracking. Use this for something you'll trigger occasionally — an emergency plan, a rare situation — not a daily habit."
- As-needed framing note: "As-needed routines skip Today entirely — you'll log them from the Routines list whenever the situation comes up."
- Ideal label (trackable): "Ideal — your full version" / (as-needed): "Ideal (optional)"
- Fallback label (trackable): "Fallback — your minimum-viable version" / (as-needed): "Fallback (optional)"
- Fallback helper: "This is a whole-routine fallback — it's available every day the routine runs, not scheduled per step."
- Sub-step schedule label: "When does each step apply?"
- Sub-step schedule helper: "Every step runs on every day this routine is due, unless you narrow it below."
- Degenerate-cadence note (Weekly/Bi-weekly/Monthly/Bi-monthly/Yearly, replaces the sub-step grid): "Single occurrence per period — nothing to subset. Every ideal step simply runs whenever this routine is due."
- Error — empty name: "Give this routine a name to save it."
- Error — no cadence days: "Pick at least one day this routine runs."
- Error — missing ideal: "Add at least one ideal step to save this routine."
- Error — missing fallback: "Add a fallback — your minimum-viable version for a hard day."
- Error — no-empty-run-occurrence: "Tuesday has no ideal step due — every step is toggled off. Turn at least one back on for Tuesday, or add a step that runs then." (day name substitutes for whichever column is empty; PRD §3.10 fixture names Tuesday.)
- Save button: "Save routine"
- Cancel button: "Cancel"

---

# S17 — Create Event    route: /add/event

Features: F11, F24, F26

## Contents

- Back IconButton (←) → S15 or S11 (whichever screen opened this — see Interactions), discards unsaved changes, nothing persisted yet.
- Title: "New Event".
- Input, label "Event name", placeholder "e.g. Dentist visit", required.
- Date picker Input, label "Date", required. Defaults to today.
- Time picker Input, label "Time" (optional — an all-day event is allowed).
- Recurrence (F26 — optional, default one-off): Radio pair "Does not repeat" (default, selected) / "Repeats". This is the one-off-by-default framing from F11/F26 — an Event never requires a cadence.
- If "Repeats" is selected, reveals the same shared CadencePicker control as S16/S18 (Decision 13): Select "Repeats every" with `Daily`, `Specific weekdays`, `Weekly`, `Bi-weekly`, `Monthly`, `Bi-monthly`, `Yearly`, plus the matching sub-control per option (WeekdayPicker for Specific weekdays; single-anchor Selects for Weekly…Yearly) — identical mechanics to S16's Cadence.
- Selecting "Repeats" and any cadence makes this a repeating Event (F26) without changing its type to Routine — copy nearby: "Still an Event — just one that repeats."
- Ideal + fallback (optional for Events — per SITEMAP S17's purpose line: "Define a one-off or repeating event, with optional ideal+fallback"). Note on sourcing: PRD F11's own sentence reads "Events and Courses are trackable → carry ideal+fallback (R2)" — grouping Events WITH Courses as always-tracked, and never stating Event optionality. SITEMAP S17's purpose line resolves this tension by making ideal+fallback tracking optional specifically for Events (Courses stay always-required, per S18). This spec follows SITEMAP's resolution; the optionality is a design decision documented upstream, not invented here.
- A single Switch: "Track with ideal + fallback" (off by default — SITEMAP S17 makes ideal+fallback optional for Events; only Routines/Courses require it always).
- When on, reveals the same Ideal/Fallback ordered-step-list mechanics as S16 (add/delete/reorder rows), both optional even when the switch is on — turning tracking on does not by itself force non-empty lists, but if the user starts either list, the "no-empty-run-occurrence" save-time rule below still applies once the event is recurring.
- Sub-step schedule (F24 — recurring Events only, optional, same subset/toggle model as F23). Only rendered when: Recurrence = "Repeats" AND cadence = Daily or Specific weekdays AND "Track with ideal + fallback" is on AND ≥1 ideal step exists. Identical grid mechanics to S16's Sub-step schedule: rows = ideal steps, columns = the event's own occurrence-set days; cells toggle a step's due state per occurrence; new steps default to due on all occurrences. Weekly/Bi-weekly/Monthly/Bi-monthly/Yearly recurring Events show the same static degenerate note as S16 (single occurrence per period — nothing to subset). A one-off Event ("Does not repeat") never shows this — it is the degenerate single-occurrence case (F24), with no toggle needed.
- Button "Save event".
- Button "Cancel".

## States

- **default** — Name empty, Date = today, Time empty, "Does not repeat" selected, ideal/fallback tracking off.
- **populated (repeating example)** — Name "Team check-in"; Recurrence = Repeats, cadence = Specific weekdays, Mon/Wed/Fri selected; tracking on; ideal = "Full 30-min sync", "Send recap notes" (recap notes toggled **on for Friday only** — a wrap-up step, mirroring the PRD's Mon–Fri wrap-up example); fallback = "Async status message".
- **populated (one-off example)** — Name "Dentist visit"; Date "Aug 4"; Time "2:30 PM"; "Does not repeat"; tracking off (a bare one-off Event, per F13's own anchor example of a one-off Event still earning XP on its due date — no ideal/fallback needed to do so).
- **error — empty name**: "Give this event a name to save it."
- **error — no cadence days selected** (Repeats + Specific weekdays, zero days): same WeekdayPicker inline validation as S16: "Pick at least one day this event repeats on."
- **error — no-empty-run-occurrence (F24, recurring event with sub-step scheduling)**: identical treatment to S16 — a banner naming the empty day, e.g. "Wednesday has no ideal step due — every step is toggled off for that day." Save blocked.
- **loading (save in progress)**: "Save event" Button in loading state.

## Interactions

- Toggle "Does not repeat" / "Repeats" Radio → shows/hides the CadencePicker live.
- CadencePicker interactions identical to S16's Cadence (Select → reveals matching sub-control; toggling parent days live-updates the sub-step grid's columns).
- Toggle "Track with ideal + fallback" Switch → shows/hides Ideal/Fallback (and, by extension, the Sub-step schedule if recurrence + steps both qualify).
- "+ Add step" / delete-row / toggle grid cell → identical mechanics to S16.
- "Save event" → validates name, date, (if repeating) cadence-days-selected, (if repeating + tracked + steps exist) no-empty-run-occurrence; on failure stays on S17 with inline errors, no data lost; on success persists the event and **always** navigates to **S09** (Today), where it appears when due, and the Event is also reachable from **S11** (Events Browse) per the sitemap's dual Leads-to.
- Back (←) → returns to whichever screen opened S17: S15 (via Pick Type) or S11 (via Events Browse "+"), no confirmation.

## Responsive

- Phones-only product; desktop is review-only, no committed tablet/desktop layout.

## Copy

- Title: "New Event"
- Recurrence radio labels: "Does not repeat" / "Repeats"
- Repeating-event note: "Still an Event — just one that repeats."
- Tracking switch: "Track with ideal + fallback"
- Tracking switch helper: "Optional for events — turn this on if you want the ideal/fallback logging model."
- Sub-step schedule label/helper: same as S16 — "When does each step apply?" / "Every step runs on every occurrence this event is due, unless you narrow it below."
- Degenerate-cadence note (Weekly/Bi-weekly/Monthly/Bi-monthly/Yearly recurring Events, replaces the sub-step grid): "Single occurrence per period — nothing to subset."
- Error — empty name: "Give this event a name to save it."
- Error — no cadence days: "Pick at least one day this event repeats on."
- Error — no-empty-run-occurrence: "Wednesday has no ideal step due — every step is toggled off for that day."
- Save button: "Save event"
- Cancel button: "Cancel"

---

# S18 — Create Course    route: /add/course

Features: F11, F12, F24, F26

## Contents

- Back IconButton (←) → S15 or S12 (whichever opened this screen), no confirmation.
- Title: "New Course".
- Input, label "Course name", placeholder "e.g. Antibiotics", required.
- Date picker Input, label "Start date" (defaults to today).
- Date picker Input, label "End date", required — the fixed run-length that distinguishes a Course from an open-ended Routine (F11).
- Stepper/Input, label "Doses per day" (F12 multi-dose), integer ≥1, default 1. When >1, a helper appears: "Each dose completes on its own — the day counts once every dose is handled."
- Cadence (F26 extended options, same shared CadencePicker control as S16/S17): Select "Repeats", identical option set/mechanics to S16: `Daily`, `Specific weekdays`, `Weekly`, `Bi-weekly`, `Monthly`, `Bi-monthly`, `Yearly` — the Course runs this cadence until its End date (F26). No "does not repeat" option here (unlike Events) — a Course always has a cadence; Daily is the natural default for a medication course.
- Ideal + fallback (required, like Routines — Courses are trackable, F11): Same ordered-step-list mechanics as S16: Ideal steps (required, ≥1) and Fallback steps (required, ≥1).
- Sub-step schedule (F24 — day-level, not per-dose, per R22×R5 composition): Only rendered when cadence = Daily or Specific weekdays AND ≥1 ideal step exists. Identical grid mechanics to S16/S17: rows = ideal steps, columns = the course's occurrence days. Explicitly day-level: toggling a cell marks the whole day due-or-not for that step — never one specific dose. Helper copy: "These toggles apply to the whole day, not a single dose." A day logs **ideal** only when every dose is handled AND every ideal step due that day is completed (R22×R5 composition) — stated as a note, not an interactive control. Weekly/Bi-weekly/Monthly/Bi-monthly/Yearly cadences show the same static degenerate note as S16/S17.
- Button "Save course".
- Button "Cancel".

## States

- **default** — Name empty, Start date = today, End date empty, Doses/day = 1, cadence defaulted to Daily, one blank ideal step, one blank fallback step.
- **populated (Antibiotics fixture, §6 IDEA reference — 2×/day, 10-day)** — Name "Antibiotics"; Start date today; End date = start + 10 days; Doses/day = 2; cadence = Daily; ideal = "Take with food, full glass of water"; fallback = "Take the dose, skip the water reminder"; no sub-step grid needed at Daily-with-one-step (shown, all days on).
- **populated (weekly-cadence course example)** — Name "Physical therapy homework"; Start today; End = start + 8 weeks; Doses/day = 1; cadence = Weekly, anchor = "Every week on Saturday" — sub-step schedule replaced by the static degenerate note (single occurrence per week, nothing to subset).
- **error — empty name**: "Give this course a name to save it."
- **error — missing end date**: "Set an end date — a course always runs for a fixed span."
- **error — no cadence days selected** (Specific weekdays, zero days): "Pick at least one day this course runs."
- **error — missing ideal or fallback**: "Add at least one ideal step to save this course." / "Add a fallback — your minimum-viable version for a hard day."
- **error — no-empty-run-occurrence (F24, day-level)**: a banner: "Saturday has no ideal step due — every step is toggled off for that day." Save blocked.
- **loading (save in progress)**: "Save course" Button in loading state.

## Interactions

- Doses-per-day stepper → increments/decrements the integer; helper copy about "day counts once every dose is handled" appears once value >1.
- Cadence Select/WeekdayPicker interactions identical to S16.
- "+ Add step" / delete-row / toggle grid cell → identical mechanics to S16, scoped day-level (not per-dose) per the description.
- "Save course" → validates name, end date present, cadence-days-selected (if Specific weekdays), ≥1 ideal step, ≥1 fallback step, no-empty-run-occurrence across every parent day (end-before-start ordering is not validated in this mockup — out of scope here); on failure stays on S18 with inline errors, no data lost; on success persists the course and **always** navigates to **S09** (Today), where it appears when a dose is due, and the course is also reachable from **S12** (Courses Browse) per the sitemap's dual Leads-to.
- Back (←) → returns to whichever screen opened S18 (S15 or S12), no confirmation.

## Responsive

- Phones-only product; desktop is review-only, no committed tablet/desktop layout.

## Copy

- Title: "New Course"
- Doses helper: "Each dose completes on its own — the day counts once every dose is handled."
- End date helper (if empty on blur): "Set an end date — a course always runs for a fixed span."
- Sub-step schedule label: "When does each step apply?"
- Sub-step schedule helper: "These toggles apply to the whole day, not a single dose."
- Sub-step schedule note (below grid): "A day logs ideal once every dose is handled and every step due that day is complete."
- Degenerate-cadence note (Weekly/Bi-weekly/Monthly/Bi-monthly/Yearly, replaces the sub-step grid): "Single occurrence per period — nothing to subset."
- Error — empty name: "Give this course a name to save it."
- Error — missing end date: "Set an end date — a course always runs for a fixed span."
- Error — no cadence days: "Pick at least one day this course runs."
- Error — missing ideal: "Add at least one ideal step to save this course."
- Error — missing fallback: "Add a fallback — your minimum-viable version for a hard day."
- Error — no-empty-run-occurrence: "Saturday has no ideal step due — every step is toggled off for that day."
- Save button: "Save course"
- Cancel button: "Cancel"

---

# S19 — Create To-do/Note    route: /add/todo

Features: F11

Keep this the fastest create flow in the app — a "loose task" per its framing: no schedule, no ideal/fallback, no cadence picker of any kind.

## Contents

- Back IconButton (←) → S15 or S13 (whichever opened this screen), no confirmation.
- Title: "New To-do / Note".
- Input, label "What is it?", placeholder "e.g. Renew passport", required. Auto-focused on screen entry (this is meant to be the fastest create path in the app).
- Textarea, label "Note (optional)", placeholder "Add a detail if it helps", multi-line, no character-count UI (kept low-friction).
- Static card reinforcing the "loose task" framing: "No ideal/fallback, no schedule — a to-do is a loose task. Just a name, an optional note, and Importance/Necessity if they help you filter later." Deliberately names the fixed Importance/Necessity vocabularies, not a banned free-form concept (F2/PRD §4 non-goal) — this framing is closed-vocabulary picker, never user-entered.
- Radio group "Importance" — High / Med / Low.
- Radio group "Necessity" — Must-do / Recommended / Optional.
- Explicitly **no** ideal/fallback fields and **no** recurrence/cadence control anywhere on this screen — a To-do/Note is schedule-less by definition (F11).
- Button "Save".
- Button "Cancel".

## States

- **default** — Name empty (autofocused), Note empty, no Importance/Necessity selected.
- **populated example** — Name "Renew passport"; Note "Expires next March — start early"; Importance = High; Necessity = Must-do.
- **populated example 2 (quick capture, unlabeled)** — Name "Call the vet about refill"; Note empty; Importance/Necessity left unset (both are optional on a To-do — nothing forces an Importance/Necessity pick for the "loose task" framing to hold).
- **error — empty name**: "Give this a name to save it."
- **loading (save in progress)**: "Save" Button in loading state.

## Interactions

- Type in Name / Note → live, no validation until Save is attempted (or blur, for the empty-name case, to catch it early without being naggy).
- Select an Importance/Recommended chip → single-select within its own Radio group.
- "Save" → validates only that Name is non-empty; on failure stays on S19 with inline error, no data lost; on success persists and navigates to **S09** (Today — a To-do/Note has no due date so it does not appear on Today's due list per F6, but the save still lands the user back on Today per the sitemap's Leads-to) and the item is reachable from **S13** (To-dos & Notes Browse).
- Back (←) → returns to whichever screen opened S19 (S15 or S13), no confirmation.

## Responsive

- Phones-only product; desktop is review-only, no committed tablet/desktop layout.

## Copy

- Title: "New To-do / Note"
- Name label: "What is it?"
- Note label: "Note (optional)"
- Scope note: "No ideal/fallback, no schedule — a to-do is a loose task. Just a name, an optional note, and Importance/Necessity if they help you filter later."
- Error — empty name: "Give this a name to save it."
- Save button: "Save"
- Cancel button: "Cancel"

---

# S20 — Manage Task Sheet    route: /task/:id
Features: F3, F4, F7, F12, F23, F24

## Contents

- Presented as a native bottom sheet (Dialog pattern) that dismisses to the screen it was opened from.
- Drag handle.
- **Sheet header.**
  - IconButton X, `aria-label="Close"` → dismisses sheet, returns to the screen it was opened from (default: S09 Today).
  - Icon avatar: button showing the task's current icon (Lucide) on its chosen color fill → opens **S21**.
  - Name: inline-editable `Input`-as-text; edits persist on blur (F1) and reflect immediately on Today/F5 (F7).
  - Meta tags: a static `Tag` "Routine · Mon–Sat" (type + cadence), `Tag` "High" (Importance), `Tag` "Recommended" (Necessity) — tapping a tag opens an inline `Radio` picker from the fixed vocabulary, stays on S20.
- **Today's occurrence `Card`.**
  - Date label: "Today, Thu Jul 16".
  - Rule line: "Steps set the state automatically — tap a state to override."
  - `StateChip`: single-select four-state control — To do / Done / Fallback / Skip — each an icon-only pill paired with its own text label ("To do"/"Done"/"Fallback"/"Skip"). Same component family as S09's StateChip and this screen's own CalendarHeatmap day-numeral fix (see the Fix log at the end of this spec).
  - Ideal steps checklist (`Checkbox` rows): "Warm-up · 5 min", "Main set · 20 min", "Heavy lifts · M·W·F" (carries a small weekday badge; on a non-M/W/F day it renders a "Not due today" caption and is excluded from that day's ideal count per F23), "Cool-down stretch".
  - Fallback sub-card: "Fallback — 10 pushups. The low bar on a hard day." with a "Log fallback" button (identical effect to tapping the Fallback chip).
- **Multi-dose occurrence variant (F12)** — when the task is a multi-dose Course, the single-dose steps checklist/fallback sub-card is replaced with:
  - A **day-level `StateChip`** (To do/Done/Fallback/Skip — the same four-state component as the single-dose card's chip, labeled "Whole day", same icon-pill-plus-label rendering). This is the F3 ideal/fallback override applied to the whole occurrence — PRD F3/F12 requires "partial-dose days log via F3," so a user must always be able to mark the whole day Fallback or Skip here, independent of how many doses are done.
  - Two dose sub-cards, each with its **own full four-state `StateChip`** (To do/Done/Fallback/Skip — not a reduced two-state control; per-dose rows commonly only reach Done/To do, but the component itself carries all four states, same as the day-level chip):
    - "Morning dose · 9:00a"
    - "Evening dose · 9:00p"
  - Rule line: "Doses set the day's state automatically once both are handled — tap the day chip to override (Fallback/Skip), the same F3 mechanic as any other task."
  - Copy: "1 of 2 doses done — the day isn't logged until both are handled, unless you override it with the day chip above."
  - (Mockup demonstrates both variants via a toggle; a real task instance is permanently one or the other, decided by its type.)
- **OffDayToggle** (task-scoped grain, distinct component instance from S09's whole-day one per Decision 10).
  - Label: "Off today (this task only)".
  - Helper: "Marks just this task's day off — your other tasks, and the whole-day toggle on Today, are unaffected. Turn it off to restore what was logged."
- **Sub-step scheduling editor** (collapsible section, F23/F24), header "Edit step schedule". Per ideal step, a nested `WeekdayPicker` constrained to the parent's own selected days — days the parent doesn't run (Sunday, in this fixture) render disabled/unreachable. Save-blocked: the check is the **union of every ideal step's due-days, per occurrence (day)** — an occurrence (e.g. Tuesday) is only rejected if literally **no** ideal step is due that day once all steps are considered together; toggling a single step off for every day it's ever scheduled is legal as long as at least one *other* ideal step still covers every occurrence (same logic as S16-create-routine's `validate()` occurrence-day check — replicate it, don't reinvent it). The inline validation note names the specific offending day, since the violation is a property of the day, not of any one row.
- **Actions.** IconButton + label, three: "Duplicate", "Snooze", "Move to another day".
- **Calendar (`CalendarHeatmap`, F7).**
  - Heading "Calendar", month nav "‹ July 2026 ›".
  - Monday-start day-of-week header (M T W T F S S, matching WeekdayPicker convention).
  - Grid cells with state fills for ideal / fallback / off / missed; pending-today = hollow dashed; not-due (Sundays) and future days = blank; each fill carries a distinct glyph (check/half-check/pause/none) — icon only, never text.
  - Day-of-month numeral for each cell, rendered as a caption rather than on the signal fill (Rule 4; see Fix log).
  - Legend (mandatory): Ideal, Fallback, Off, Missed, Pending today, Not due.
  - Stat line: "89% showed up — 8 of 9 days".
- **Delete** — `Button`, label "Delete routine" → opens **S22**.

## States

- **Default** — as above, populated history (see the worked July 2026 grid in the mockup: 8 shown-up + 1 missed + 4 off among 13 elapsed Mon–Sat days = 89%/8-of-9 exactly, today pending, Sundays/future blank). Every cell's day-of-month numeral renders in the caption regardless of fill state (ideal/fallback/off/missed/pending/blank) — the numeral treatment does not vary by state, only the cell fill does.
- **Loading** (first paint) — `Skeleton` shimmer for header fields, the `StateChip` row, and the heatmap grid (skeleton grid cells); respects reduced-motion (static block).
- **Empty history** (F7 §3.7, verbatim — NOT a generic `EmptyState` card): the CalendarHeatmap renders the **same blank grid as any not-due/future cell** — fully transparent, no missed fill, legend still shown, and day-of-month numerals still render for each blank cell exactly as in the default state (no fill to be on top of, so no Rule-4 concern here). Applies e.g. to a freshly duplicated task. A small caption may accompany the grid ("Your history will fill in as you log days.") but no EmptyState icon/headline replaces the grid.
- **Error (persist failure)** — the acted-on control (step checkbox, chip, off-toggle, name field) reverts to its prior value; a Toast reads "Couldn't save that — try again." Never a false "saved."
- **Error (heatmap read failure)** — `InlineRetryBanner` replaces the grid region inline (calm copy + Retry), legend and stat line hidden until retried.

## Interactions

- Close (X) → dismiss → back to the screen S20 was opened from (S09 by default; also S10–S14, S21, S22-cancelled, S24 per Sitemap).
- Icon avatar → **S21**.
- Name / Importance / Necessity → inline edit or picker, persists, stays on S20.
- `StateChip` "Done" or "Fallback" tap, or completing all due ideal steps (F3's counts-only-due-sub-steps rule), → logs the state → **S24** (ideal or fallback variant). On S24 dismiss, returns to S20. If the same completion also crosses an XP level-up/milestone threshold (F13), **S28** follows S24's dismissal (S28's own concern, not sequenced by S20).
- `StateChip` "Skip" tap → resolves missed immediately, calm neutral acknowledgment, stays on S20 (no celebration).
- `StateChip` "To do" tap → reverts to pending, stays on S20.
- "Log fallback" button → identical to tapping the Fallback chip.
- Multi-dose day-level `StateChip` (Course only) → same four-state behavior as the single-dose card's chip (Done/Fallback → **S24**, Skip → resolves missed inline, To do → reverts); per-dose `StateChip` rows log that dose only, and both doses reaching Done auto-logs the day-level chip Done (without leaving S20).
- OffDayToggle → marks/unmarks this task's day off, stays on S20; a prior log is preserved and restored on un-mark.
- Duplicate → copies definitions/metadata/toggle state with **empty history**, Toast "Duplicated — edit & save as new" (IDEA Flow 8.4 verbatim), opens the new task's own S20 instance.
- Snooze / Move to another day → inline pickers, stay on S20; affect the occurrence, not the cadence.
- Sub-step `WeekdayPicker` chip toggle → toggles that step's own due subset only (never outside the parent's own days); at save, any occurrence (day) whose union of every ideal step's due-days is empty — i.e. every ideal step is off for that specific day, not merely one step toggled off everywhere — is rejected with inline validation naming the offending day.
- Heatmap cell tap (past day) → drill-down popover to view/edit that day's log (in-sheet affordance, not a separate routed screen). Tap target covers the cell and its numeral caption together, not just the colored cell (Rule 8).
- Delete → **S22**. From S22: "Keep it" → back to S20 unchanged; confirmed delete → S09/S10/S11/S12/S13 (deleted, F5 recomputes).

## Responsive

- Phones-only product; no committed tablet/desktop layout (PRD §5). Desktop is review-only, rendering the same content as mobile with nothing reflowed into extra columns.

## Copy

- Date label: "Today, Thu Jul 16"
- Rule line: "Steps set the state automatically — tap a state to override."
- Ideal steps: "Warm-up · 5 min", "Main set · 20 min", "Heavy lifts · M·W·F", "Cool-down stretch"
- Fallback line: "Fallback — 10 pushups. The low bar on a hard day."
- Off toggle: "Off today (this task only)" / helper as above
- Multi-dose: "Morning dose · 9:00a", "Evening dose · 9:00p", day-level rule line "Doses set the day's state automatically once both are handled — tap the day chip to override (Fallback/Skip), the same F3 mechanic as any other task.", note "1 of 2 doses done — the day isn't logged until both are handled, unless you override it with the day chip above."
- Actions: "Duplicate", "Snooze", "Move to another day"
- Calendar heading: "Calendar"; stat line: "89% showed up — 8 of 9 days"
- Legend labels: "Ideal", "Fallback", "Off", "Missed", "Pending today", "Not due"
- Empty-history caption: "Your history will fill in as you log days."
- Duplicate toast: "Duplicated — edit & save as new."
- Save-failed toast: "Couldn't save that — try again."
- Delete button: "Delete routine"

## Open decision flagged

Task-icon color swatches (S21) have no dedicated DESIGN.md token set of their own; this batch reuses the closed F8 accent palette (Forge Orange / Indigo / Berry / Plum) as the only spec-compliant, already-tokenized non-signal hues available for that purpose — see S21's note.

## Fix log

- **Cross-batch review B3 (S20 portion), Rule 4 — heatmap day numerals on signal fills.** Originally the day-number span was rendered inside the same colored cell as the state glyph — a text label directly on a signal fill in both themes, which Rule 4 forbids outright (regardless of contrast achieved) and which also failed contrast in practice. Considered and rejected recoloring the numeral instead: it still fails the applicable text-contrast floor at one fill, and — independent of that — Rule 4 bans text-on-fill categorically, not just below some threshold, so recoloring the text in place would still be a rule violation even where the number happened to clear the floor. **Fix:** the numeral moved off the fill into a caption for each cell; the fill itself is now icon-only, unchanged from its already-compliant glyph treatment. Applied to both the populated and empty-history grids. No other item on this screen was touched.

- **Targeted follow-up fix (post-B3), Rule 4 — StateChip text labels on signal fills.** The B3 pass above fixed this screen's heatmap but left a parallel instance of the same defect in the four `StateChip` rows (Today's occurrence card, the Course day-level chip, and both dose rows): each filled option rendered its icon **and** its text label ("Done"/"Fallback"/"Skip") together inside the same signal-filled pill — a text label directly on a signal fill, which Rule 4 forbids categorically, and which also failed contrast in practice, the identical failure mode already fixed once on S09's StateChip. **Fix** (mirrors S09's own fix and this screen's B3 heatmap fix): each chip option is now an option (the tap target, always transparent — never itself takes a signal fill) containing an icon-only pill (filled with the signal color and glyph only when selected) beside a text label on the option's own neutral background. The label never touches the pill's fill, in any state. Applied to all four `StateChip` rows (Today's occurrence, Course day-level, Morning dose, Evening dose) in both the spec and the mockup; the heatmap/calendar work from B3 was not touched.

---

# S21 — Icon & Color Picker    route: /task/:id/icon
Features: F7

## Contents

- Header: IconButton "‹" labeled "Cancel"; title "Choose icon & color"; Button "Save" (disabled until a selection changes).
- Live preview: a circle showing the currently-selected icon on the currently-selected color fill, with a name label ("Morning workout").
- Search Input, placeholder "Search icons", with a clear (×) affordance once text is entered.
- Category sections (Fitness / Health / Work / Study, per IDEA Flow 8.5), each a header plus an icon grid (Lucide icons). The selected icon shows a selected-state outline.
- Color swatches, heading "Color" — four closed options: Forge Orange, Indigo, Berry, Plum. The selected swatch shows a check glyph.
- Footer actions mirroring the header actions: "Cancel" / "Save".

## States

- **Default** — as above.
- **Loading** (first paint) — `Skeleton` grid in place of icons.
- **Empty (search, no results)** — `EmptyState`: search icon, headline "No icons match “{query}.”", subcopy "Try a different word."
- **Error (persist failure on Save)** — reverts to the prior icon/color, Toast "Couldn't save that — try again," stays on S21.

## Interactions

- Search input types → live-filters every category's grid; a category with
  zero matches collapses; the `EmptyState` shows only when **no** category
  has a match.
- Tap a category header → scrolls to that section (in-page anchor).
- Tap an icon → selects it, updates the live preview, enables "Save".
- Tap a color swatch → selects it, updates the live preview fill, enables
  "Save".
- Tap "Save" → persists icon + color to the task (F7, reflects immediately
  on Today/F5), returns to **S20**.
- Tap "Cancel" / back gesture → discards the in-progress selection, returns
  to **S20** unchanged.

## Responsive

Phones-only product; desktop is review-only in the shared phone-frame, no committed tablet/desktop layout.

## Copy

- Title: "Choose icon & color"
- Search placeholder: "Search icons"
- Category headings: "Fitness", "Health", "Work", "Study"
- Color labels: "Forge Orange", "Indigo", "Berry", "Plum"
- Empty search: "No icons match “{query}.”" / "Try a different word."
- Buttons: "Save", "Cancel"

## Open decision flagged (screen-designer call, no DESIGN.md precedent)

DESIGN.md defines a **closed accent palette** (F8, four hues) but does not
separately define a per-task icon/color token set — task color is a
distinct customization from the app-wide accent (F2's "name, icon, color").
Rather than inventing new, untokenized hex values (which Rule 1 forbids),
this batch's S21 **reuses the same four closed accent hexes** as the only
available non-signal, already-tokenized decorative colors. This keeps every
color on this screen traceable to DESIGN.md at the cost of task color and
app accent sharing one palette. Flagging for the design-system agent to
confirm or supersede with a dedicated task-color token set.

---

# S22 — Delete Confirmation    route: /task/:id/delete
Features: F7

> **Load-bearing behavior (SITEMAP Decision 18, mirroring Decision 14's
> S48/S50 pattern):** this screen has exactly ONE route but TWO possible
> immediate origins — S20 (Manage Task Sheet, for scheduled/recurring tasks)
> and S23 (As-needed Routine Detail). Its **cancel** destination ("Keep it,"
> scrim tap, hardware back) must return to **whichever screen opened it**,
> never a single fixed destination: S20 if opened from S20, S23 if opened
> from S23. The origin must be carried as navigation state (e.g. a `from`
> param or the natural back-stack entry), never hardcoded to S20. This is
> independent of, and must not be conflated with, the separate **confirmed-
> delete** destination logic below (which routes to S09/S10/S11/S12/S13 and
> follows its own, already-origin-aware rule) — cancel and confirm are two
> different destinations from the same screen.

## Contents

A `Dialog` containing:

1. Alert-circle icon (Lucide) — muted, **not** red; the danger signal lives
   on the button only, never a full alarming icon, per the PRD's
   non-punitive NFR.
2. Headline: "Delete this routine?"
3. Body: "“Morning workout” and its history will be removed. This can't be
   undone."
4. Button row: `Button` "Delete routine"; `Button` "Keep it".

The task-type noun in the headline/body ("routine" / "event" / "course" /
"to-do") swaps per the task being deleted; copy shown here is the routine
instance (also the S23 as-needed-routine entry path, since that variant is
still type Routine — headline/body copy do not vary by origin, only the
cancel destination does).

## States

- **Default** — as above.
- **Loading** — "Delete routine" shows its `loading` state (label replaced
  by an inline spinner, `aria-busy`); "Keep it" disabled meanwhile.
- **Success (in this mockup, shown inline rather than navigating off-batch)**
  — dialog content swaps to a confirmation: headline "Deleted.",
  body "“Morning workout” and its history are gone.", caption naming the
  one deterministic destination (see Interactions below — "Navigates to
  Today (S09)." in the default fixture). In the full app this is a real
  navigation to S09/S10/S11/S12/S13, not an inline state — represented
  inline here only because those screens are outside this batch.
- **Error (delete failed)** — dialog stays open,
  `InlineRetryBanner`/Toast "Couldn't delete — try again," both buttons
  re-enabled, no partial write.

## Interactions

- "Delete routine" → loading → success (task + history removed, F5
  recomputes) → **one deterministic post-delete destination**: the screen
  S22 was opened from (S20 or S23) is not itself the destination — S22
  returns to wherever THAT screen was itself reached from:
  - Opened from S20, and S20 was itself opened from S09 (Today) or from a
    type browse tab (S10 Routines / S11 Events / S12 Courses / S13
    To-dos) → that same screen. This reproduces FLOWS.md's F7 edge
    (S09 → S20 → S22 → confirms → **S09**) and the SITEMAP S22 →
    S09/S10/S11/S12/S13 edges.
  - Opened from S20, but S20's own origin isn't a stable destination (e.g.
    S14 Filter & Search, or unknown) → falls back to the deleted task's
    type browse tab (S10/S11/S12/S13).
  - Opened from **S23** (the as-needed routine detail) → **S10** (Routines
    browse), regardless of whether S23 itself was opened from S10 or S14
    (SITEMAP Decision 21). S14 is never a stable post-delete destination —
    the same reasoning as the S20 bullet just above (it holds transient
    search/filter results that may not survive the round trip, and the
    just-deleted item may have been the sole match), and that reasoning
    applies with identical force regardless of whether S20 or S23 sits
    between S14 and the delete action. S23's task is always type Routine
    (F27's as-needed sub-variant), so this Decision-21 destination
    coincides with the type-tab fallback above. S23's delete link still
    forwards its own resolved origin (S10 or S14) through as this screen's
    `origin` param — harmless, but it no longer changes the outcome: an
    earlier implementation pass (since reverted) incorrectly redirected
    the S23-via-S14 case to S14 itself, which Decision 21 rules out.
  The two previously-conflicting rules ("returns to the list you came
  from" vs. "depends on task type") are replaced by this single rule; the
  mockup implements it via an `origin` query param (falling back to the
  type-based browse tab only when no origin is supplied) and a "Simulate
  origin" control set so a reviewer can exercise every destination: S09,
  S10, and the type-tab fallback (no origin supplied).
- "Keep it" → **conditional, per which screen opened S22** (SITEMAP
  Decision 18 — this is a *different* destination than the confirmed-delete
  rule above and must not be merged with it):
  - Opened from **S20** → returns to **S20** unchanged (cancelled), per
    SITEMAP's "S20 (cancelled, if reached from S20)" edge.
  - Opened from **S23** → returns to **S23** unchanged (cancelled), per
    SITEMAP's "S23 (cancelled, if reached from S23)" edge and S23's own
    spec ("Keep it → back to S23 unchanged"). It never falls through to
    S20 — S20's schedule/heatmap UI does not apply to an as-needed
    routine.
- Scrim tap / hardware back → identical behavior to "Keep it" (same
  origin-conditional destination: S20 or S23).
- Persist failure → dialog remains, calm retry, no navigation.

## Responsive

Phones-only product; desktop is review-only in the shared phone-frame.

## Copy (verbatim, IDEA Flow 8.9)

- Headline: "Delete this routine?"
- Body: "“Morning workout” and its history will be removed. This can't be
  undone."
- Buttons: "Delete routine" / "Keep it"
- Success (inline demo only): "Deleted." / "“Morning workout” and its
  history are gone."
- Retry: "Couldn't delete — try again."

## Mockup review note

Since a static HTML mockup can't carry a real navigation history, the
mockup exposes an explicit, clearly-labeled **reviewer control** ("Opened
from: S20 Manage Task Sheet / S23 As-needed Routine Detail") that is NOT
part of the shipped UI — it drives the `from` param already used for the
confirmed-delete origin logic, and additionally updates a caption
for "Keep it" ("Keep it returns to: S20 Manage Task Sheet" / "Keep it
returns to: S23 As-needed Routine Detail") so both conditional cancel
destinations are verifiable in one file, exactly mirroring S48's
reviewer-facing origin toggle and cancel-destination caption.

The separate "Simulate origin" control set (post-delete destination only)
offers **S09 / S10 / no-origin (type fallback)** — there is deliberately no
"S14" button. Per SITEMAP Decision 21, `origin=S14` is never a stable
post-delete destination for either the S20 or the S23 path; it always
falls back to the deleted task's type browse tab (S10, since S23's task is
always type Routine). A reviewer confirms this by toggling "Opened from"
between S20 and S23 while passing `?origin=S14` in the URL: both land on
the same S10/type-tab destination, never on S14. (An earlier implementation
pass briefly added an "S14 Filter & Search (S23 only)" button and a special
case that resolved `origin=S14` to S14 for the S23 path only — Decision 21
identifies that as a defect and reverts it; this file and the mockup no
longer expose that control or that code path.)

---

# S23 — As-Needed Routine Detail    route: /task/:id/as-needed
Features: F27

> **Load-bearing behavior (SITEMAP Decision 17, mirroring Decision 14's
> S48/S50 pattern, Decision 18's S22 pattern, and Decision 19's S25/S27/S29
> pattern):** this screen has exactly ONE route but TWO possible immediate
> origins — **S10** (Routines browse) and **S14** (Filter & Search, when a
> search result is an as-needed routine). Its back button (and hardware/
> gesture back) must return to **whichever screen opened it**, never a
> single fixed destination: S10 if opened from S10, S14 if opened from S14.
> The origin must be carried as navigation state (e.g. a `from` param or the
> natural back-stack entry), never hardcoded to S10.

## Contents

Deliberately leaner than S20 — no due-badge, no `StateChip`, no heatmap, no
multi-dose, no sub-step toggles, no Importance/Necessity row (kept out to
match F27's "simplified detail" framing; flagged as an open call below).

1. **Header.** IconButton "‹" → **origin-aware** (S10 Routines browse or
   S14 Filter & Search, whichever opened this screen — see the load-bearing
   behavior note above). Icon avatar (static — **not** tappable; S23's own
   leads-to list in SITEMAP.md has no edge to S21, so icon/color editing is
   out of this screen's scope by design). Name "Emergency plan". A neutral,
   static `Tag`: "As-needed routine".
2. **Optional ideal/fallback reference card** (`AsNeededCard`, shown only if
   the routine defined them — optional per F27):
   - "Ideal — Full checklist, in order"
   - "Fallback — Call the emergency contact"
3. **"Log used it"** — `Button`, the primary action. If ideal/fallback are
   defined, tapping opens an inline chooser first ("Which version did you
   do?" with Ideal / Fallback marker chips); if neither is defined, logs
   immediately with a plain checkmark marker.
4. **History** (`AsNeededCard`'s reference-only list — explicitly **not**
   `CalendarHeatmap`, per DESIGN.md's component assignment: F27 uses
   AsNeededCard, never the heatmap). Heading "History", rows: "Used · Mar
   3 · Ideal", "Used · Jan 18 · Fallback" — dates + optional marker `Tag`.
   Unused dates are never shown/implied; there is no "missed" concept here.
5. **Footer actions.** "Edit" (toggles inline edit mode: name + optional
   ideal/fallback text fields become editable in place, with Save/Cancel —
   no separate routed edit screen, matching S23's leaner scope) / "Delete
   routine" → **S22**.

## States

- **Default** — as above, history populated.
- **Empty history** — this DOES use the generic `EmptyState` component
  (unlike S20's CalendarHeatmap, which never does): icon + headline "Not
  used yet" + subcopy "This routine has no schedule and no consistency
  score — log it whenever the situation comes up." No button.
- **Edit mode** — name/ideal/fallback fields become `Input`s inline, "Save"
  / "Cancel" replace the header's static state.
- **Loading** (first paint) — `Skeleton` for name, reference card, and
  history rows.
- **Error (persist failure)** on "Log used it" or Edit-save → reverts,
  Toast "Couldn't save that — try again," never a false "saved."

## Interactions

- "‹" back → **origin-aware**: returns to **S10** if this screen was opened
  from Routines browse, or to **S14** if opened from Filter & Search
  (SITEMAP Decision 17) — never a single fixed destination.
- Ideal/fallback reference card → read-only display, no tap action (edit
  happens via the Edit toggle).
- "Log used it" → (if ideal/fallback defined) inline chooser → confirm →
  appends a new history entry, calm Toast **"Logged to history"** —
  explicitly carries **no XP (lifetime or Cycling), no achievement, no
  confetti** (F27/F13/F31) — stays on S23.
- Edit → inline edit mode → Save persists / Cancel discards → stays on
  S23.
- Delete → **S22**, forwarding S23's own resolved origin (S10 or S14,
  whichever opened this screen — see the back-navigation bullet above) as
  S22's `?origin=` param. "Keep it" → back to S23 unchanged; confirmed
  delete → **S10** (Routines browse), regardless of whether S23 itself was
  opened from S10 or S14 (SITEMAP Decision 21). S14 is never a stable
  post-delete destination — it holds transient search/filter results that
  may not survive the round trip, and the just-deleted item may have been
  the sole match — matching S20's existing "S14 is not a stable post-
  delete destination" rule; that reasoning is a property of S14 itself,
  not of whether S20 or S23 sits between S14 and the delete action, so it
  applies here with identical force. S23's delete link still forwards its
  own resolved origin through as S22's `origin` param (harmless — S22's
  own spec documents exactly how it's used), but that forwarded value no
  longer changes the confirmed-delete outcome when it's S14 (see S22's
  spec).

## Responsive

Phones-only product; desktop is review-only in the shared phone-frame.

## Copy

- Name: "Emergency plan"
- Badge: "As-needed routine"
- Reference card: "Ideal — Full checklist, in order" / "Fallback — Call
  the emergency contact"
- Log button: "Log used it"
- Chooser: "Which version did you do?" (Ideal / Fallback chips)
- Toast: "Logged to history"
- History heading: "History"
- History rows: "Used · Mar 3 · Ideal", "Used · Jan 18 · Fallback"
- Empty headline: "Not used yet"
- Empty subcopy: "This routine has no schedule and no consistency score —
  log it whenever the situation comes up."
- Footer: "Edit", "Delete routine"

## Open decision flagged

F27/PRD §7 leaves "the exact history treatment (used-dates list vs. sparse
marker calendar)" and "where the trigger/log-used-it control lives" open
(designer call). This batch resolves both as: a simple reverse-chronological
used-dates **list** (not a sparse marker calendar) and the "Log used it"
control placed as the screen's single primary action. Also treated as an
open call: whether Importance/Necessity apply to an as-needed routine at
all — this batch omits them to keep the screen as lean as F27's "no
schedule, no tracking" spirit implies; nothing in the PRD forbids them, so
a future pass could add them back without contradicting any acceptance
criterion.

## Mockup review note

Since a static HTML mockup can't carry a real navigation history, the
mockup exposes an explicit, clearly-labeled **reviewer control** ("Opened
from: Routines browse (S10) / Filter & Search (S14)") that is NOT part of
the shipped UI — it drives the back button's actual `href` and a caption
("Back returns to: Routines browse" / "Back returns to: Filter & Search")
together, so both conditional back destinations are verifiable in one file
and can never drift apart, exactly mirroring S22/S25/S48's reviewer-facing
origin toggle and destination caption. The same reviewer control also
drives the "Delete routine" link's `?origin=` param, forwarding S23's
currently-resolved origin (S10 or S14) through to S22. This forwarding is
harmless and stays as-is — it does not mean S22's confirmed-delete redirect
ever lands on S14: per SITEMAP Decision 21, that redirect always lands on
S10 (Routines browse) for the S23 path, regardless of which origin value
(S10 or S14) is forwarded (see S22's own spec/mockup-review-note for the
full "Simulate origin" behavior).

---

# S24 — Completion Celebration (overlay)    route: /task/:id/celebrate
Features: F3, F13

## Contents

An overlay over the screen S24 was opened from (S09 or S20) plus a
celebration `Card`. **No confetti** — per DESIGN.md's binding rule, S24
uses only the spring pop + XP-numeral tick; confetti is reserved for S28
(level-up) and milestone tenure-badge unlocks only.

1. Icon: a check (ideal) or half-check/circle-dash (fallback) glyph.
2. Headline: "Nice — ideal done!" (ideal) or "You showed up 💪" (fallback).
3. XP line: "+10 XP" (ideal) / "+6 XP" (fallback), with a spring tick-up
   animation that degrades to a plain cross-fade under reduced motion.
4. Body: ideal — "That's 6 of 7 days you've shown up. Consistency looking
   strong."; fallback — "Fallback counts. Your consistency holds — that's
   the win on a hard day."
5. `Button` "Continue" — dismisses, returns to the screen S24 was opened
   from.

## States

- **Ideal variant** — as above ("Nice — ideal done!").
- **Fallback variant** — as above ("You showed up 💪").
- No loading/error/empty states apply — S24 is a pure post-action overlay
  computed instantaneously from an already-persisted local log; it only
  ever renders after a successful F3 write.
- **Reduced motion** — the spring pop and XP tick both degrade to a plain
  cross-fade (no bounce, no counting animation).

## Interactions

- Appears automatically immediately after a qualifying ideal/fallback log
  (F3), from either S09 (tap a due task's chip on Today) or S20 (tap a
  chip / complete steps in the Manage Task Sheet).
- Tap "Continue" (or scrim tap / hardware back) → dismiss → returns to
  whichever screen opened it (S09 or S20).
- If the same completion also crosses an XP level-up or milestone
  threshold (F13/F29), **S28** (Level-Up Celebration) follows immediately
  after S24 is dismissed — sequencing belongs to S28, not this screen;
  S24 itself never shows gold/confetti/MilestoneBadge (those are reserved
  exclusively for F13/F29/F30/F31 contexts per DESIGN.md Rule 5).

## Responsive

Phones-only product; desktop is review-only in the shared phone-frame.

## Copy (verbatim, IDEA Flow 3.3a / 3.3b)

- Ideal: "Nice — ideal done! +10 XP. That's 6 of 7 days you've shown up.
  Consistency looking strong."
- Fallback: "You showed up 💪 +6 XP. Fallback counts. Your consistency
  holds — that's the win on a hard day."
- Button: "Continue"

---

# S25 — Consistency Dashboard    route: /progress
Features: F5

> **Load-bearing behavior (SITEMAP Decision 19, mirroring Decision 14's
> S48/S50 pattern and Decision 18's S22 pattern):** this screen has exactly
> ONE route but TWO possible immediate origins — S09 (Today, via the stat
> chip) and S41 (Settings Home). Its back chevron (and hardware/gesture
> back) must return to **whichever screen opened it**, never a single fixed
> destination: S09 if opened from S09, S41 if opened from S41. The origin
> must be carried as navigation state (e.g. a `from` param or the natural
> back-stack entry), never hardcoded to S09. (S26's own back edge to S25 is
> unaffected — returning from S26 lands on this same S25 instance already on
> the stack, not a fresh origin choice.)

## Contents

- **App bar** — a back chevron (IconButton) that is **origin-aware** (returns
  to S09 Today or S41 Settings, whichever opened this screen — see the
  load-bearing behavior note above; this mirrors the same origin-aware
  pattern carried on S27/S29's app bars); title "Your consistency"; no
  trailing action.
- **Scope switcher** — `Tabs`, two items: **Per-task** / **Aggregate**.
  Default selected: **Per-task**. Governs the data shown throughout the
  screen.
- **Task selector** (Per-task scope only) — `Select`, label "Task", value
  e.g. "Movement" with options drawn from the user's trackable tasks
  (Movement, Read — the PRD §6 demo fixture routines). Hidden entirely in
  Aggregate scope (aggregate has no single-task concept).
- **Window switcher** — `Tabs`, three items: **7 days** / **30 days** /
  **All time**. Default selected: **30 days**. **What a "7/30" window counts
  as a member day is a genuine PRD-silent point — see "Open item —
  window-membership semantics" below.** For this mockup, screen-designer has
  made a provisional choice (stated in full there) so the screen is
  demonstrable; it is **not** a resolved product decision.
- **Headline stat** — big numeral (a computed statistic, not a CTA), e.g.
  "87%". Below it: a one-line subcopy spelling out the "X of Y" framing
  (Per-task: exact whole-day counts, e.g. "22 ideal + 4 fallback = 26 of 30
  counted days"; Aggregate: the raw, unrounded Σf alongside the rounded
  counted-day denominator, e.g. "≈6.5 of 7 counted days, weighted by that
  day's tasks" — the aggregate breakdown-display fork, PRD §7, resolved here
  by screen-designer as: keep "X of Y counted days" with X = the exact Σf
  value (shown to one decimal place when not a whole number) — **this example
  now matches the live `aggregate|7` dataset verbatim** (previously carried a
  stale "≈5 of 7 days counted" example that matched no live dataset — fixed
  this pass).
- **ConsistencyBreakdownBar** — a stacked bar with **Ideal** / **Fallback** /
  **Off** segments; the remaining unfilled track = the load-bearing missed
  remainder (per DESIGN.md's ConsistencyBreakdownBar contract — Off **is** a
  filled/colored slice; only Missed is left as unfilled track). A legend names
  all four categories with counts, including a numeric **Missed** count
  (designer's call, PRD §7 — shown here since it's neutral, informational, and
  never a "current streak break").
  - **Unit note (Aggregate scope only):** the bar instead renders **summed
    fractional credit per category, rounded for display** (same designer-owned
    display fork). This means the legend's four numbers are **not all the same
    unit**: **Ideal** and **Fallback** are each a rounded sum of per-day
    fractional credit (their sum must land within ±1.0 of the underlying Σf —
    it will not always be an exact whole-number match to Σf, because each
    category is rounded independently); **Off** is a plain **count of
    fully-off days** (days where every due task was off — a day is never
    partially "off" in this tally, so this is a whole-number day-count, not a
    credit sum); **Missed** is the rounded remainder, `round(denominator −
    Σf)`, within ±0.5 of that value. **Rounding rule: round-half-up** (e.g., a
    remainder of 2.5 rounds to 3, not 2) — applied consistently everywhere a
    fractional credit is rounded for display (S25, S29, S30). The mockup's
    aggregate legend carries a caption stating this unit split, so the human
    reviewer isn't left to infer it.
- **Explainer microcopy** — one line reinforcing the
  consistency-not-perfection / fallback-counts framing (IDEA Flow 9.1 verbatim
  spirit).
- **Aggregate-only disclosure** — `Card`, collapsed by default, header "How
  the aggregate is calculated," expands to a day-by-day table (Day / due tasks
  / shown up / day fraction) — the PRD §3.5/§6 3-day worked anchor (2/2 → 1.0,
  1/3 → 0.33, fully-off → excluded), shown as a concrete, reproducible
  illustration of the fractional formula. Hidden in Per-task scope (nothing to
  disclose — each occurrence is already whole 0/1). **This table is a
  standalone illustrative fixture — a 3-day toy example from PRD §3.5/§6, not
  this screen's one continuous 240-raw-day demo-user history (Appendix A
  below) — and is independent of the live Aggregate scope's window datasets
  above, which show that same demo user's own genuine counted-day windows
  (7/30/All time), derived mechanically from Appendix A. It never doubles as a
  selectable live dataset.**
- **"See full history" link** — `Button` → S26 (`/progress/trend`). Per
  Decision 3 (SITEMAP), this is F28's placement.

## Fixture-island disclaimer (Ruling 1, binding)

**This screen's demo user is a standalone dashboard fixture — its own
240-raw-day history, materialized in Appendix A below — not the Maya
timeline used by S27/S29/S30, and not any of S26's simulated trend-graph
users either.** All three are deliberately disjoint fixtures; no arithmetic
reconciliation across them is ever in scope, on this pass or any future one.
This disclaimer appears on-screen as a footnote (see Copy) so no future
review re-opens a cross-island check.

## Open item — window-membership semantics (flagged for Gate 2 / architect)

**This is an unresolved upstream question, not a documented, PRD-supported
behavior.** PRD §3.5 defines the consistency *fraction* (numerator/
denominator = due, non-off, elapsed days) but never defines what makes a
calendar day a *member* of a "7 days" / "30 days" window preset — the PRD's
87%/100% worked examples are window-agnostic count fixtures (26/30, 26/26),
not a stated claim about what the "30 days" preset itself displays. §7 grants
the designer "which windows to offer, layout, and the missed-count display
choice **only**" — window membership is a step further than that, since it
changes the computed %, the storage query shape (a variable-length lookback
vs. a fixed calendar range), and qa-tester's window fixtures.

**Screen-designer's provisional choice (for this mockup only, not a product
decision):** a "**counted-day**" window — walk backward from the most recent
elapsed day; a day where the task (or, in Aggregate scope, at least one due
task that day) was marked **off** is *skipped* from the N-count but still
tallied in the Off category; a day that is still **pending** (due today, not
yet resolved) or has **zero due tasks** (task didn't exist yet / not
scheduled) is excluded entirely — not counted toward N, not tallied in any
category. The window keeps walking backward until N such counted days are
found, so a "30 days" window can span more raw calendar time than 30 days
when off days fall inside it. If the task's full history has fewer than N
countable days, the window **truncates to whatever history exists** — it
never fabricates days before the task/account existed. In **Aggregate**
scope, the same rule applies at the day level: a day is skipped (tallied as
Off) only if **every** due task that day was off (matches the PRD's 3-day
anchor exactly — Day 3, fully off, is excluded); a day with a mix of off and
non-off due tasks is still counted, with its fractional credit computed only
over the non-off subset per PRD §3.5. **This is also the rule that produces
Appendix A's `agg`/`f` columns mechanically — see the appendix's derivation
note.**

**Rejected alternative (named per Gate-2 practice):** a "**calendar-day**"
window — "last N calendar days," where off days are excluded from the
*fraction* (per §3.5) but still consume a slot in the window, so a "30 days"
window always spans exactly 30 raw calendar days and simply has a smaller
counted-day denominator when off days fall inside it. This is the reading
IDEA Flow 9.1's "Last 30 days" screen title (a calendar framing) would
support, and it requires no variable-length lookback query.

**This needs human/architect confirmation at Gate 2** — the two readings
produce different %s, different denominators, and different storage-query
shapes, and qa-tester cannot write window fixtures until one is picked. The
provisional counted-day choice is applied uniformly across every demo
dataset on this screen (see Copy) — including the Aggregate scope's own
7/30/All-time windows, all three of which are now genuine counted-day
readings for the screen's one 240-raw-day demo user — purely so the mockup
is internally demonstrable; it should not be read as the answer.

## Appendix A — demo-user day ledger (normative)

**This CSV is the single source of truth for every number displayed on this
screen.** It supersedes any prior hand-picked summary statistic. Day indices
are used (not calendar dates) — indices, not dates, are the unit of record,
per Ruling 1 (dates would invite a false cross-island reconciliation against
Maya's or S26's calendar-dated fixtures). Day 240 = the most recent elapsed
day (this fixture's "today"); day 1 = the earliest day of this demo user's
history.

**Columns:**
- `day` — 1–240, raw elapsed day index (not a calendar date).
- `movement` — this day's Movement-task outcome: `I` ideal, `F` fallback,
  `M` missed, `O` off. Defined for all 240 rows (Movement exists from day 1).
- `read` — this day's Read-task outcome: `I`/`F`/`M`/`O`, or `-` meaning the
  Read task didn't exist yet that day. Read exists only from day 211 onward
  (rows 211–240, a 30-row history); rows 1–210 are `-`.
- `agg` — this day's Aggregate-scope classification: `C` (counted) or `X`
  (excluded — every due task that day was off). Derived mechanically (see
  rule below), never hand-picked.
- `f` — this day's Aggregate fractional credit, defined on `C` rows only
  (blank on `X` rows): the mean, over this day's **due, non-off** tasks, of
  1 (shown up — ideal or fallback both count as a full "shown up" unit,
  per the PRD §3.5/§6 disclosure's own "1 of 3 shown up → 0.33" framing,
  which doesn't distinguish ideal from fallback) or 0 (missed). On a
  single-task day (rows 1–210, or any two-task day where one task is off)
  the non-off task alone determines `f` (1.0 or 0.0). On a two-task day
  where both Movement and Read are due and non-off, `f` is the average of
  their two individual shown-up/missed outcomes (so a day with one ideal +
  one missed reads `f = 0.5`).

**Derivation rule for `agg`/`f` (mechanical, not hand-picked):**
1. If Read is `-` (doesn't exist yet): `agg = X` iff Movement = `O`;
   otherwise `agg = C` and `f = 1` if Movement ∈ {I, F}, `f = 0` if
   Movement = `M`.
2. If Read exists: `agg = X` iff **both** Movement = `O` and Read = `O`.
   Otherwise `agg = C`. If exactly one of the two is `O` (a "rescue"), `f`
   is computed from the other (non-off) task alone: `1` if it's I/F, `0` if
   M. If neither is `O`, `f` = the average of the two tasks' individual
   1(shown-up)/0(missed) values.

**Ideal-credit / Fallback-credit sub-split (for legend display only):** each
`C` day's `f` is additionally decomposed by *which* task-occurrence(s)
produced it — a shown-up occurrence's share of `f` (1.0 on a single-task
day, 0.5 on a two-task day) is tallied into **Ideal-credit** if that
occurrence was `I`, or **Fallback-credit** if `F`. `Ideal-credit + Fallback-
credit = f` on every row, by construction.

**Column totals (verify against the CSV below — script-checkable):**
- `movement`: I=156, F=30, M=35, O=19 (sums to 240).
- `read` (rows 211–240 only): I=22, F=4, M=0, O=4 (sums to 30).
- `agg` (all 240 rows): C=222, X=18 (sums to 240).

```csv
day,movement,read,agg,f
1,I,-,C,1
2,I,-,C,1
3,I,-,C,1
4,I,-,C,1
5,O,-,X,
6,I,-,C,1
7,I,-,C,1
8,I,-,C,1
9,I,-,C,1
10,I,-,C,1
11,I,-,C,1
12,I,-,C,1
13,I,-,C,1
14,I,-,C,1
15,O,-,X,
16,I,-,C,1
17,I,-,C,1
18,I,-,C,1
19,I,-,C,1
20,I,-,C,1
21,I,-,C,1
22,I,-,C,1
23,I,-,C,1
24,I,-,C,1
25,O,-,X,
26,I,-,C,1
27,I,-,C,1
28,I,-,C,1
29,I,-,C,1
30,I,-,C,1
31,I,-,C,1
32,I,-,C,1
33,I,-,C,1
34,I,-,C,1
35,O,-,X,
36,I,-,C,1
37,I,-,C,1
38,I,-,C,1
39,I,-,C,1
40,I,-,C,1
41,I,-,C,1
42,I,-,C,1
43,I,-,C,1
44,I,-,C,1
45,O,-,X,
46,I,-,C,1
47,I,-,C,1
48,I,-,C,1
49,I,-,C,1
50,I,-,C,1
51,I,-,C,1
52,I,-,C,1
53,I,-,C,1
54,I,-,C,1
55,O,-,X,
56,I,-,C,1
57,I,-,C,1
58,I,-,C,1
59,I,-,C,1
60,I,-,C,1
61,I,-,C,1
62,I,-,C,1
63,I,-,C,1
64,I,-,C,1
65,O,-,X,
66,I,-,C,1
67,I,-,C,1
68,I,-,C,1
69,I,-,C,1
70,I,-,C,1
71,I,-,C,1
72,I,-,C,1
73,I,-,C,1
74,I,-,C,1
75,O,-,X,
76,I,-,C,1
77,I,-,C,1
78,I,-,C,1
79,I,-,C,1
80,I,-,C,1
81,I,-,C,1
82,I,-,C,1
83,I,-,C,1
84,I,-,C,1
85,O,-,X,
86,I,-,C,1
87,I,-,C,1
88,I,-,C,1
89,I,-,C,1
90,I,-,C,1
91,I,-,C,1
92,I,-,C,1
93,I,-,C,1
94,I,-,C,1
95,O,-,X,
96,I,-,C,1
97,I,-,C,1
98,I,-,C,1
99,I,-,C,1
100,I,-,C,1
101,I,-,C,1
102,I,-,C,1
103,I,-,C,1
104,I,-,C,1
105,O,-,X,
106,I,-,C,1
107,I,-,C,1
108,I,-,C,1
109,I,-,C,1
110,I,-,C,1
111,I,-,C,1
112,I,-,C,1
113,I,-,C,1
114,I,-,C,1
115,O,-,X,
116,I,-,C,1
117,I,-,C,1
118,I,-,C,1
119,I,-,C,1
120,I,-,C,1
121,I,-,C,1
122,I,-,C,1
123,I,-,C,1
124,I,-,C,1
125,O,-,X,
126,I,-,C,1
127,I,-,C,1
128,I,-,C,1
129,I,-,C,1
130,I,-,C,1
131,I,-,C,1
132,I,-,C,1
133,I,-,C,1
134,I,-,C,1
135,O,-,X,
136,I,-,C,1
137,I,-,C,1
138,I,-,C,1
139,I,-,C,1
140,I,-,C,1
141,I,-,C,1
142,I,-,C,1
143,I,-,C,1
144,I,-,C,1
145,O,-,X,
146,I,-,C,1
147,I,-,C,1
148,I,-,C,1
149,I,-,C,1
150,F,-,C,1
151,F,-,C,1
152,F,-,C,1
153,F,-,C,1
154,F,-,C,1
155,F,-,C,1
156,F,-,C,1
157,F,-,C,1
158,F,-,C,1
159,F,-,C,1
160,F,-,C,1
161,F,-,C,1
162,F,-,C,1
163,F,-,C,1
164,F,-,C,1
165,F,-,C,1
166,F,-,C,1
167,F,-,C,1
168,F,-,C,1
169,F,-,C,1
170,F,-,C,1
171,F,-,C,1
172,F,-,C,1
173,F,-,C,1
174,F,-,C,1
175,F,-,C,1
176,M,-,C,0
177,M,-,C,0
178,M,-,C,0
179,M,-,C,0
180,M,-,C,0
181,M,-,C,0
182,M,-,C,0
183,M,-,C,0
184,M,-,C,0
185,M,-,C,0
186,M,-,C,0
187,M,-,C,0
188,M,-,C,0
189,M,-,C,0
190,M,-,C,0
191,M,-,C,0
192,M,-,C,0
193,M,-,C,0
194,M,-,C,0
195,M,-,C,0
196,M,-,C,0
197,M,-,C,0
198,M,-,C,0
199,M,-,C,0
200,M,-,C,0
201,M,-,C,0
202,M,-,C,0
203,M,-,C,0
204,M,-,C,0
205,M,-,C,0
206,M,-,C,0
207,I,-,C,1
208,I,-,C,1
209,I,-,C,1
210,O,-,X,
211,I,I,C,1
212,I,I,C,1
213,I,I,C,1
214,I,I,C,1
215,O,O,X,
216,I,I,C,1
217,I,I,C,1
218,I,I,C,1
219,I,I,C,1
220,I,O,C,1
221,I,I,C,1
222,I,I,C,1
223,I,I,C,1
224,I,I,C,1
225,O,O,X,
226,I,I,C,1
227,F,I,C,1
228,F,I,C,1
229,F,F,C,1
230,M,O,C,0
231,M,F,C,0.5
232,M,F,C,0.5
233,I,F,C,1
234,I,I,C,1
235,I,I,C,1
236,O,I,C,1
237,F,I,C,1
238,M,I,C,0.5
239,I,I,C,1
240,I,I,C,1
```

**How the nine live datasets derive from this ledger (script-verifiable):**
- `movement|7/30/all`, `read|7/30/all` — walk the `movement`/`read` columns
  backward from day 240, skipping (but tallying) `O` rows, until N non-off
  rows are found (or history truncates for `read`, whose column only spans
  30 rows).
- `aggregate|7/30/all` — walk the `agg` column backward from day 240,
  skipping (but tallying) `X` rows as Off, until N `C` rows are found (or,
  for "all," simply every row 1–240). Σf = the sum of `f` over the counted
  `C` rows in that window; Ideal-credit/Fallback-credit = the sums of the
  same sub-split over that window, each independently rounded (round-half-
  up) for legend display.

## States

- **Default** — live worked-example data (see Copy).
- **Loading** — headline numeral, breakdown bar, and legend replaced by
  `Skeleton` blocks; scope/window tabs and the app bar remain interactive.
- **Empty ("no data yet")** — triggered when the selected task/window/scope
  has no due, non-off, elapsed days yet (brand-new user, an all-off window, or
  a window whose only due non-off day is a still-pending today). Shows
  `EmptyState`: calendar-style Lucide icon, headline "No data yet," subcopy
  "Once a due day resolves — ideal, fallback, or missed — your consistency
  will show up here." **Never renders "0%," never punitive.** Scope/window
  tabs stay live (switching to a window with data recomputes out of this
  state).
- **Error** — shows `InlineRetryBanner`: warning-tone icon, "Couldn't load
  your consistency right now." + "Retry" button.

## Interactions

- Tap a **scope** tab → swaps Per-task ⇄ Aggregate; task selector
  shows/hides; headline, bar, and legend recompute (demoed live in the
  mockup via the nine canned scope×window datasets, all mechanically
  derived from Appendix A per the walk rule above).
- Tap a **window** tab → recomputes the same scope's numbers for 7 / 30 /
  All time (demoed via canned datasets that equal Appendix A's own
  derivation — see Copy for exactly which window each PRD anchor now
  attaches to).
- Tap the **task Select** (Per-task only) → swaps between "Movement" and
  "Read" datasets (see Copy for exact numbers per window).
- Tap "How the aggregate is calculated" → expands/collapses the day-by-day
  illustrative table (Aggregate scope only; independent of the live 7/30/All
  time datasets and of Appendix A — see Contents).
- Tap "See full history →" → navigates to S26.
- Tap the back chevron (or hardware/gesture back) → **origin-aware**:
  returns to **S09** if this screen was opened from Today's stat chip, or to
  **S41** if opened from Settings — never a single fixed destination (see
  the load-bearing behavior note above, SITEMAP Decision 19).
- A dev-only state-toggle row (Default / Loading / Empty / Error) exists in
  the mockup only, to demo the four states — not part of the shipped screen.

## Responsive

Phones only in v1 (PRD §5 device matrix); no tablet/desktop layout committed —
desktop is review-only, with no new information architecture.

## Copy (exact strings)

- App bar title: "Your consistency"
- Scope tabs: "Per-task" · "Aggregate"
- Window tabs: "7 days" · "30 days" · "All time"
- Task select label: "Task" — options "Movement" · "Read"

**Per-task — Movement**
- 30 days (PRD 87% anchor): "87%" — "22 ideal + 4 fallback = 26 of 30
  counted days" — off-note "4 days were off — not counted either way" —
  legend "Ideal 22 · Fallback 4 · Off 4 · Missed 4"
- 7 days: "86%" — "5 ideal + 1 fallback = 6 of 7 counted days" — off-note
  "1 day was off — not counted either way" — legend "Ideal 5 · Fallback 1 ·
  Off 1 · Missed 1"
- All time: "84%" — "156 ideal + 30 fallback = 186 of 221 counted days" —
  off-note "19 days were off — not counted either way" — legend "Ideal 156 ·
  Fallback 30 · Off 19 · Missed 35"

**Per-task — Read**
- All time (PRD 100% anchor — Read's whole counted history to date is 26
  days): "100%" — "22 ideal + 4 fallback = 26 of 26 counted days" — off-note
  "4 days were off — not counted either way" — legend "Ideal 22 · Fallback
  4 · Off 4 · Missed 0"
- 30 days: "100%" — "22 ideal + 4 fallback = 26 of 26 counted days — this
  task's whole history so far is shorter than 30 days" — off-note "4 days
  were off — not counted either way" — legend "Ideal 22 · Fallback 4 · Off
  4 · Missed 0" (identical to All time — the counted-day window truncates
  when history is shorter than the preset, and says so)
- 7 days: "100%" — "7 ideal + 0 fallback = 7 of 7 counted days" — off-note
  "0 days were off — not counted either way" — legend "Ideal 7 · Fallback
  0 · Off 0 · Missed 0"

**Aggregate** (the same 240-raw-day demo user as Movement/Read above — every
window below is a genuine counted-day reading mechanically derived from
Appendix A, never a separate fixture)
- 7 days: "93%" — "≈6.5 of 7 counted days (weighted by that day's tasks)" —
  off-note "0 days were fully off — not counted either way" — legend "Ideal
  6 · Fallback 1 · Off 0 · Missed 1" — legend caption "Ideal/Fallback are
  rounded credit sums; Off is a day count; Missed is the rounded remainder."
- 30 days: "92%" — "≈27.5 of 30 counted days (weighted by that day's
  tasks)" — off-note "3 days were fully off — not counted either way" —
  legend "Ideal 24 · Fallback 4 · Off 3 · Missed 3" — **changed this pass
  from the pre-ledger 84%/Off 5/Σf≈25.2; see Deviation note below**
- All time: "85%" — "≈188.5 of 222 counted days (weighted by that day's
  tasks)" — off-note "18 days were fully off — not counted either way" —
  legend "Ideal 159 · Fallback 30 · Off 18 · Missed 34" — **counted/Off
  numbers (222/18) match the k=1 pinned outcome from the advisor exactly;
  Missed (34, not 33) differs slightly — see Deviation note below**

**Aggregate-only disclosure table (illustrative fixture — not a live
dataset; see Contents)**
- Disclosure table rows:
  - "Wed — 2 of 2 tasks shown up → counts as 1.0"
  - "Thu — 1 of 3 tasks shown up (2 missed) → counts as 0.33"
  - "Fri — every due task was off → not counted"
  - Total: "1.33 ÷ 2 counted days = 67%"

- Explainer line: "Nothing to lose here — off days are neutral, and a
  fallback still counts as showing up."
- History link: "See full history →"
- Fixture footnote: "This screen's demo user is a standalone dashboard
  fixture — not the Maya timeline used by Achievements/Cycle records
  (S27/S29/S30)."
- Empty headline: "No data yet"
  - Subcopy: "Once a due day resolves — ideal, fallback, or missed — your
    consistency will show up here."
- Error banner: "Couldn't load your consistency right now." Button: "Retry"

## Worked-example provenance (ledger-derived — citations only, no freestanding claims)

Per Ruling 2, every paragraph below cites specific Appendix A rows/ranges.
No claim is made here that Appendix A doesn't itself show.

- Per-task 100%: PRD §3.5 — 22 ideal + 4 fallback (26 shown-up), 4 off, 0
  missed → 26/26 = 100%. **Window attribution:** since Read's whole counted
  history to date (Appendix A rows 211–240) is exactly 26 non-off rows, this
  anchor is shown under Read's **All time** window (and, truncated, under
  its "30 days" window too) — not forced into a literal 30-day preset it
  can't fill.
- Per-task 87%: PRD §3.5 — 26 shown-up, 4 off, 4 missed → 26/30 = 87%. This
  is Movement's native **30 days** window, spanning Appendix A rows 207–240
  under the counted-day rule.
- Aggregate disclosure illustration (67%): PRD §3.5/§6 3-day mixed-day
  anchor — Day1 2/2 → f=1.0, Day2 1/3 → f≈0.333, Day3 fully-off → excluded;
  denominator = 2 days; Σf = 1.333; 1.333/2 × 100 = 66.67 → 67%. This is a
  **standalone 3-day toy fixture**, shown only inside the "How the aggregate
  is calculated" disclosure as a worked illustration of the fractional
  formula. It is **not** derived from Appendix A and is disjoint from this
  screen's demo user.
- **Aggregate 93% (7 days):** Appendix A rows 234–240 (7 raw rows, all
  `agg=C`, 0 excluded). Row 236 is the rescue cited by the advisor: Movement
  `O`, Read `I`, `f = 1` (Read alone determines the day, since Movement is
  off). The other six rows (234, 235, 237, 238, 239, 240) are two-task days:
  Movement reads I, I, F, M, I, I across them (4 ideal + 1 fallback + 1
  missed) while Read reads I on all six. Row-by-row `f`: 234=1.0, 235=1.0,
  236=1.0 (rescue), 237=1.0, 238=0.5 (Movement missed, Read ideal — the
  window's one partial-credit day), 239=1.0, 240=1.0. Σf = 6.5. Ideal-credit
  = 6.0 (0.5 per Read-ideal occurrence × 6 rows = 3.0, + 0.5 per Movement-
  ideal occurrence × 4 rows = 2.0, + 1.0 from row 236 = 6.0 total); Fallback-
  credit = 0.5 (row 237's Movement-fallback occurrence). Missed = round(7 −
  6.5) = round(0.5) = 1 (round-half-up); 6.5/7 × 100 = 92.86 → 93%.
  **Unchanged from the prior PASSed pass — carries forward without drift,**
  as required (this dataset is not touched this pass).
- **Aggregate 92% (30 days):** Appendix A rows 208–240 (33 raw rows: the 30
  most recent `agg=C` rows, plus 3 `agg=X` rows encountered while walking
  back — rows 210, 215, 225, each a fully-off day where Movement and Read
  — where it exists — were both off, or Movement alone was off before Read
  existed). Row 236, inside this same span, is again the Movement-off/
  Read-ideal rescue (row 236 is `C`, not one of the 3 excluded rows) — so
  the Off tally stays at 3, not 4. Σf summed over the 30 counted rows =
  27.5; Ideal-credit = round(23.5) = 24, Fallback-credit = round(4.0) = 4
  (sum 28, within ±1.0 of 27.5); Missed = round(30 − 27.5) = round(2.5) = 3;
  27.5/30 × 100 = 91.67 → 92%.
- **Aggregate 85% (All time):** all 240 Appendix A rows. `agg=C` on 222 of
  them, `agg=X` on 18 (rows 5, 15, …, 145 and 210 — sixteen Movement-only
  fully-off days before Read existed — plus rows 215/225, where Read also
  existed and was likewise off that day). Row 236 (Movement off, Read
  ideal) is the single rescued day the advisor's k=1 resolution requires —
  it is `agg=C`, not counted among the 18 `X` rows, which is exactly why
  counted lands at 222 and Off at 18 rather than 221/19. Σf summed over all
  222 counted rows = 188.5. Ideal-credit = round(158.5) = 159, Fallback-credit = round(30.0) =
  30 (sum 189, within ±1.0 of 188.5); Missed = round(222 − 188.5) =
  round(33.5) = 34; 188.5/222 × 100 = 84.91 → 85%.

## Deviation note (from the advisor's pinned example — permitted, per ADVICE Ruling 2's precedence rule)

The advisor's illustrative k=1 resolution cited example values of Missed 33
(not 34) and bar widths 66/13/8 (not 66/12/7) for `aggregate|all`, and left
`aggregate|30` provisionally at its pre-ledger 84%/Off 5/Σf≈25.2 pending
ledger construction. Building Appendix A honestly (per the binding
precedence rule: "if an honestly-constructed ledger cannot reproduce a
currently-displayed number, the display changes to match the ledger — never
the reverse") produces counted=222/Off=18 exactly as pinned, but a genuine
Σf of 188.5 (not the advisor's illustrative 189-as-Σf) — the advisor's "189"
was always the *legend-display sum* (Ideal-credit 159 + Fallback-credit 30),
not Σf itself, and that legend-sum still matches exactly. The 1-day gap
between Missed 33 and 34 and the 1-point gap in bar widths are artifacts of
this ledger's specific row-236-plus-238 construction (which also had to
independently satisfy the already-PASSed `aggregate|7`/`movement|7`/
`read|7` datasets) and are treated as the ledger's real, final numbers per
the precedence rule — not forced to match the advisor's illustrative
example. `aggregate|30` is fully replaced by the ledger's own derivation
(92%/Off 3/Σf 27.5), since the pre-ledger 84%/Off 5/Σf≈25.2 figures are not
witnessed by Appendix A's actual construction (in particular, row 236's
rescue reduces aggregate|30's Off count below Movement's own per-task Off
count of 4 within the same raw span, which the old figures did not account
for).

## Mockup review note

Since a static HTML mockup can't carry a real navigation history, the
mockup exposes an explicit, clearly-labeled **reviewer control** ("Opened
from: Today (S09) / Settings (S41)") that is NOT part of the shipped UI —
it drives the back chevron's actual destination and a caption ("Back
returns to: Today" / "Back returns to: Settings") so both conditional back
destinations are verifiable in one file, exactly mirroring S22/S48's
reviewer-facing origin toggle and destination caption.

---

# S26 — All-time Trend Graph    route: /progress/trend
Features: F28

## Contents

- **App bar** — back chevron → S25; title "All-time trend."
- **Intro line** — "Your % you showed up, over your whole history — the same
  math as your dashboard, just zoomed out." (reinforces F28 is additive,
  reusing F5's fractional formula per bucket, never a new calculation.)
- **Granularity indicator** — a `Tag`, e.g. "Monthly buckets," reflecting the
  **auto-coarsening** rule (week → month → year as history grows).
  **Screen-designer's chosen thresholds (PRD §7, open item; adapted from
  R26's own proposed numbers, which are stated there as approximate/tunable,
  not "verbatim"):** history **< 3 months** → weekly buckets; **3 months –
  ~3 years** → monthly buckets; **~3 years+** → yearly buckets. Not a user
  control in the shipped screen — shown here for transparency; a dev-only demo
  control simulates all three in the mockup (see Interactions).
- **TrendGraph** — line/area chart. X-axis: bucket labels ("Feb," "Mar," …
  or "Week of Jun 1" under weekly granularity). Y-axis: 0–100%. A scrub
  readout shows the focused bucket + its %, e.g. "Jun 2026 — 88%." **Only
  completed buckets plot** — the current in-progress bucket (partial
  week/month/year) is never shown as a point, since its % would be a moving
  target, not a settled recap; it reappears here only once it finalizes
  (mirrors S29/S30's finalized-vs-in-progress distinction).
- **Scrub control** — a horizontal range/slider lets the user drag through
  buckets; the chart's highlighted point and the readout move together
  (single source of truth, no separate "confirm").
- **"View as table" toggle** — `Button`. Ship-blocking accessibility
  requirement (PRD §5/§28): the chart is **never the only representation**.
  Tapping it swaps the chart for an accessible `<table>` — the identical
  bucket/%/breakdown data, screen-reader-navigable with real `<th>` headers.
  **Independently of that toggle**, the chart also carries a screen-reader-only
  text summary **at all times** (present in the DOM whether or not the table
  is showing, and regenerated whenever granularity/scrub changes) that
  enumerates every bucket's label and % in a sentence — a real, complete
  summary, not a pointer telling the user to go find the toggle — so
  VoiceOver/TalkBack users are never blocked on the toggle to get the data.
- **Data notes** — "Long gaps with nothing due show as a break in the line,
  not a fabricated 0%."
- **Fixture footnote** — "These demo datasets are simulated example users for
  illustrating weekly/monthly/yearly bucket shapes — not the Maya timeline
  shown on Achievements/Cycle records (S27/S29/S30), and not S25's
  dashboard-fixture user either. The three are independent, disjoint fixtures
  by design; no cross-screen arithmetic reconciliation is expected or
  intended."

## States

- **Default** — populated 12-point monthly trend, upward trajectory.
- **Loading** — `Skeleton` in place of the chart, plus a skeleton for the
  "View as table" toggle.
- **Empty** — history too short to fill even one bucket → reuses F5's own
  "no data yet" treatment: `EmptyState`, headline "No data yet," subcopy
  "Your trend will appear as history builds." Never an empty axis, never
  "0%."
- **Error** — `InlineRetryBanner` replaces the chart inline: calm copy
  "Couldn't load your trend right now." + "Retry."

## Interactions

- Tap back chevron → S25.
- Drag the scrub slider → moves the highlighted chart point + updates the
  readout line live.
- Tap "View as table" → swaps chart for the accessible data table (tap again
  to return to the chart — labeled "View as chart" once toggled).
- Dev-only demo control (mockup only): "Preview: Weekly / Monthly / Yearly" —
  simulates the auto-coarsening outcome for a short / medium / long history,
  swapping the underlying bucket data set. Not a real control in the shipped
  screen (granularity is automatic, not user-chosen).
- Dev-only state toggle (mockup only): Default / Loading / Empty / Error.

## Responsive

- Phones-only v1 (PRD §5); desktop is review-only, no new panes or
  side-by-side data.

## Copy (exact strings)

- Title: "All-time trend"
- Intro: "Your % you showed up, over your whole history — the same math as
  your dashboard, just zoomed out."
- Granularity tag (default demo): "Monthly buckets"
- Scrub readout example: "Jun 2026 — 88%"
- Toggle button: "View as table" / "View as chart"
- Table column headers: "Bucket" · "% shown up" · "Ideal" · "Fallback" ·
  "Off" · "Missed"
- Data note: "Long gaps with nothing due show as a break in the line, not a
  fabricated 0%."
- Fixture footnote: "These demo datasets are simulated example users for
  illustrating weekly/monthly/yearly bucket shapes — not the Maya timeline
  shown on Achievements/Cycle records (S27/S29/S30), and not S25's
  dashboard-fixture user either. The three are independent, disjoint
  fixtures by design; no cross-screen arithmetic reconciliation is expected
  or intended."
- Empty headline: "No data yet"
  - Subcopy: "Your trend will appear as history builds."
- Error banner: "Couldn't load your trend right now." Button: "Retry"

## Worked-example provenance

- Every plotted point reuses F5/R6 scope-2's aggregate fractional formula
  (`Σ f(D) ÷ count of qualifying days × 100`), windowed to that bucket —
  identical arithmetic to S25's Aggregate scope and to S29/S30's per-cycle %.
  No new formula introduced on this screen (PRD §3B F28, Decisions item 20).
- **Table/chart agreement is this screen's own acceptance criterion:** for
  every bucket in all three granularity demo datasets (weekly/monthly/
  yearly), the plotted % is the Ideal/Fallback/Off/Missed breakdown shown in
  the "View as table" row for that same bucket, run through the formula
  above (`(Ideal + Fallback) ÷ (Ideal + Fallback + Missed) × 100`, Off
  excluded from the denominator exactly as F5 excludes it) — within ±1 point
  for independent rounding, never contradicting it outright.
- **The true sum invariant (corrected this pass):** each bucket's four
  breakdown values (Ideal + Fallback + Off + Missed) sum to **at most** the
  bucket's own calendar length (7 per week; the month's day count; 365/366
  per year) — **exactly**, when the account existed for the whole bucket,
  and **less than** that when it didn't (days before the account existed,
  and zero-due days, are excluded from all four categories, never invented
  as Off or Missed). Weekly and monthly buckets below happen to sum exactly
  (the account already existed for the whole span in every shown week/month);
  the yearly buckets do **not** all sum exactly, and that's correct, not a
  bug: 2021 sums to 350, 2022 to 355, 2023 to 360, 2024 to 365 (2024 is a
  leap year, 366 calendar days, but the account's zero-due days that year
  reduce the tallied total to 365) — only 2025 (a year the account existed
  in full, no zero-due days) reaches an exact 365. The mockup's data comment
  states this real invariant plainly instead of a false "always sums exactly"
  claim.
- **Fixture-island note (Ruling 1):** this screen's three granularity demo
  datasets (weekly/monthly/yearly) are self-contained simulated users,
  chosen purely to make each bucket shape legible — they are not, and are
  never intended to be, the same underlying user as S25's dashboard fixture
  or S27/S29/S30's Maya timeline. No cross-screen reconciliation is in
  scope; see the Fixture footnote (Copy) for the human-facing version of
  this same disclaimer.

---

# S27 — Achievements    route: /achievements
Features: F13, F29, F31

> **Load-bearing behavior (SITEMAP Decision 19, mirroring Decision 14's
> S48/S50 pattern and Decision 18's S22 pattern):** this screen has exactly
> ONE route but TWO possible immediate origins — S09 (Today) and S41
> (Settings Home). Its back chevron (and hardware/gesture back) must return
> to **whichever screen opened it**, never a single fixed destination: S09
> if opened from S09, S41 if opened from S41. The origin must be carried as
> navigation state (e.g. a `from` param or the natural back-stack entry),
> never hardcoded to S09. (S28's dismiss → S27 and S29's own back → S27 are
> unaffected — both land on this same S27 instance already on the stack,
> not a fresh origin choice.)

## Contents

- **App bar** — back chevron, **origin-aware** (S09 Today or S41 Settings,
  whichever opened this screen — see the load-bearing behavior note above;
  mirrors the same origin-aware pattern carried on S25/S29's app bars);
  title "Achievements."
- **Lifetime XP Bar** (`XPBar`, lifetime) — Card: "Level 7 · Consistent ·
  620/1000 XP." Monotonic — never resets, no cycle-boundary language.
- **Cycling XP Bar** (`XPBar`, cycling) — a separate Card, kept distinct from
  the Lifetime bar (Decision 12). Label **follows the active cadence**:
  "Monthly XP" (default) or "Weekly XP" — must never read "Monthly" while
  weekly is active. Shows current value ("128 XP"), a "resets on `<date>`"
  subline, and starts at 0 each new cycle. **Reset-cadence control**: a
  `Select` (per DESIGN.md's Components → Select, which explicitly assigns
  "Cycling XP reset-cadence (weekly/monthly)" to this component — not a
  segmented control), options **Weekly / Monthly**, default **Monthly**
  selected — changing it takes effect immediately (F31; the mockup demos the
  label/date swap live, not the archive-then-reset side effect, which is a
  data event with no screen of its own).
- **"See cycle records" link** — a `Card`-style link row (per
  Interactions/SITEMAP's S27→S29 edge) → S29.
- **All / Earned / Locked tabs** (`Tabs`) — filters every badge category
  section simultaneously (a global filter, not per-category).
- **Badge category sections**, each a header + a set of `MilestoneBadge`
  pills:
  - **Showing up** (F13, cumulative participation counts) — "7 days," "30
    days," "50 shown up," "200 shown up."
  - **Fallback wins** (F13) — "Safety net," "Never zero," "Saved 25×,"
    "Comeback."
  - **Milestones** (F13, rare) — "100 done," "Course ×3," "Full week (7/7)."
    (IDEA's original "1 year" milestone is **reclassified into the Tenure
    section** per Decision 19 — not duplicated here.)
  - **Tenure** (F29, 11 calendar-elapsed tiers, **independent of
    consistency**) — First day, 1 week, 1 month, 2 months, 6 months,
    1 year, 2 years, 5 years, 10 years, 20 years, 50 years. Earned tiers and
    locked tiers are distinguished; locked tiers get no celebration (no
    confetti) — never implying a breakable streak, never showing a
    "current streak count."
- **Badge detail** — tapping any `MilestoneBadge` opens an inline expanding
  panel (same screen, no navigation) with: badge name, earned date (if
  earned) or "Locked — unlocks `<condition>`" (if locked), one-line
  description. Locked tenure badges show their **calendar** unlock
  condition ("Unlocks on `<anchor + tier>`"), never a consistency
  condition.

## Fixture-island disclaimer (Ruling 1, binding)

**This screen shares one Maya persona/timeline with S29/S30 (materialized
day-by-day in Appendix B below) — she is not S25's dashboard-fixture user,
and not any of S26's simulated trend-graph users.** All three are
deliberately disjoint fixtures; no arithmetic reconciliation across them is
ever in scope. Maya's first day is Jan 12, 2026 — at most ~185 elapsed days
by this fixture's mid-July 2026 "today," which is why she cannot be unified
with S25's 240-raw-day user even in principle.

## States

- **Default** — populated (an established user, several months in).
- **New user (low-data)** — reuses IDEA Flow 9.3's verbatim framing: Lifetime
  XP Bar reads "Level 1 · Getting started · 0/100 XP"; Cycling XP Bar reads
  "0" with the cadence-appropriate label; every F13 category shows all
  badges locked; **Tenure shows only "First day" earned**, the other 10
  locked (F29's own edge case — a brand-new user always holds exactly this
  one tier). A calm banner reads: "Show up once — ideal or fallback — and
  your first badge is on its way. Small counts."
- **Loading** — `Skeleton` blocks replace both XP bars and every badge grid.
- **Error** — `InlineRetryBanner` replaces the XP bars and badges:
  "Couldn't load your achievements right now." + "Retry."

## Interactions

- Tap back chevron (or hardware/gesture back) → **origin-aware**: returns
  to **S09** if this screen was opened from Today, or to **S41** if opened
  from Settings — never a single fixed destination (see the load-bearing
  behavior note above, SITEMAP Decision 19).
- Tap a Tab (All/Earned/Locked) → filters every category's badge grid live.
- Change the Weekly/Monthly `Select` → swaps the Cycling XP Bar's label +
  reset date live (demoing F31's cadence setting; the underlying
  archive-then-reset is a data event, not a visual transition on this
  screen).
- Tap a badge → expands its inline detail panel; tap again or tap another
  badge to collapse/switch.
- (Reached via S28 dismiss, or triggered by a qualifying completion from
  S09/S20 → S28 → here.) Leads to S29 via a "See cycle records" link/Card
  (per SITEMAP S27 → S29 edge).
- Dev-only state toggle (mockup only): Default / New user / Loading / Error.

## Responsive

- Phones-only v1 (PRD §5); desktop is review-only, no new panes.

## Copy (exact strings)

- Title: "Achievements"
- Lifetime XP: "Level 7 · Consistent · 620/1000 XP"
- Cycling XP (Monthly): "Monthly XP" / "128 XP" / "Resets on Jul 31"
- Cycling XP (Weekly, after toggle): "Weekly XP" / "34 XP" / "Resets on
  Sun, Jul 19"
- Cadence control label: "Reset cadence" — options "Weekly" / "Monthly"
- Tabs: "All" · "Earned" · "Locked"
- Category headers: "Showing up" · "Fallback wins" · "Milestones" ·
  "Tenure"
- Showing-up badges: "7 days" · "30 days" · "50 shown up" · "200 shown up"
- Fallback-wins badges: "Safety net" · "Never zero" · "Saved 25×" ·
  "Comeback"
- Milestones badges: "100 done" · "Course ×3" · "Full week"
- Tenure badges: "First day" · "1 Week" · "1 Month" · "2 Months" ·
  "6 Months" · "1 Year" · "2 Years" · "5 Years" · "10 Years" · "20 Years" ·
  "50 Years"
- Locked badge detail line (example): "Locked — unlocks on Jan 12, 2028
  (2 years from your first day)."
- Earned badge detail line (example): "Earned Jan 12, 2026."
- Showing-up locked detail lines (day-level, matching Ledger B's reading):
  "Locked — show up 7 days total, ideal or fallback." / "Locked — show up
  30 days total." / "Locked — show up 50 **days** total." / "Locked — show
  up 200 **days** total." (fixed this pass — previously "50 shown up"'s
  locked copy read "50 times total," inconsistent with "30 days total" and
  with the day-level cumulative reading Ledger B encodes; "times" would
  imply task-level fallback/ideal events, which cross 50 far earlier for a
  user logging multiple tasks a day.)
- New-user banner: "Show up once — ideal or fallback — and your first badge
  is on its way. Small counts."
- New-user headline: "Level 1 · Getting started · 0/100 XP"
- Error banner: "Couldn't load your achievements right now." Button: "Retry"
- Records link: "See cycle records →"
- Fixture footnote: "This is Maya's own demo timeline (Appendix B below) —
  independent of S25's dashboard-fixture user and S26's simulated
  trend-graph users."

## Appendix B — Maya show-up ledger (normative)

**This CSV is the single source of truth for every cumulative "shown-up
days" count and every dated Showing-up/Fallback-wins badge on S27/S29/S30.**
It supersedes any prior hand-picked date. One row per calendar day, from
Maya's first day (**Jan 12, 2026**) through this fixture's last elapsed day
(**Jul 15, 2026**, ~185 days — the mockups' displayed "today" is mid-July
2026; this appendix uses Jul 15 as a stated approximation of that "today,"
per the advisor's own "~Jul 15, 2026" framing).

**Columns:**
- `date` — calendar date (Island C uses real dates, unlike Island A's day
  indices, since Maya's badges/cycles are inherently calendar-anchored —
  tenure tiers, cycle boundaries — and no cross-island reconciliation is in
  scope regardless, per Ruling 1).
- `shown` — `Y` or `N`: did Maya show up (ideal **or** fallback) on **at
  least one** due task that day? This is a coarser, day-level reading than
  S29/S30's per-cycle fractional %/Ideal/Fallback/Off/Missed breakdown (a
  different, independently-governed statistic reused unchanged from prior
  passes per Ruling 4 — Ledger B is not required to, and does not, derive
  those fractional cycle numbers; it only witnesses the badge dates and
  cumulative counts below).
- `cum` — running total of `Y` rows through that date (this is literally
  what the "N days"/"N shown up" Showing-up badges count).
- `event` — badge earns and notable moments on that row, blank otherwise.

**This ledger is the complete, exhaustive show-up record for the demo — a
day not marked `Y` had no show-up.** (Not a hedged simplifying assumption:
the arrangement below genuinely is such a claim, and previous passes'
parenthetical hedge — "not a claim that nothing else happened" — was false
as written, since the cumulative counts below are load-bearing on exactly
this exhaustiveness. Fixed this pass.)

**Invariant (binding, script-checkable):** every dated Showing-up and
Fallback-wins badge earn date below sits on a `shown = Y` row.
Tenure/Milestone badges ("First day," "1 Week," … "6 Months," "100 done")
remain calendar/window-membership checks only, as in prior passes — no new
witnessing class is introduced for them, though "100 done" happens to fall
on a `Y` row (Jun 9) coincidentally, since Maya was highly consistent
through June.

**Column/count check (script-verifiable):** 185 rows (Jan 12 – Jul 15,
2026 inclusive); cumulative reaches exactly 7 on Feb 2, 8 on Apr 5, 15 on
Apr 12, 27 on Apr 30, 30 on May 3, 50 on May 30, and 88 on the last row
(Jul 15) — see the `cum` column throughout for the running proof.

```csv
date,shown,cum,event
2026-01-12,Y,1,Tenure — First day
2026-01-13,N,1,
2026-01-14,Y,2,
2026-01-15,N,2,
2026-01-16,Y,3,
2026-01-17,N,3,
2026-01-18,Y,4,
2026-01-19,N,4,Tenure — 1 Week
2026-01-20,Y,5,Fallback wins — Safety net (1st fallback)
2026-01-21,N,5,
2026-01-22,N,5,
2026-01-23,N,5,
2026-01-24,N,5,
2026-01-25,Y,6,
2026-01-26,N,6,
2026-01-27,N,6,
2026-01-28,N,6,
2026-01-29,N,6,
2026-01-30,N,6,
2026-01-31,N,6,
2026-02-01,N,6,
2026-02-02,Y,7,Showing up — 7 days; Fallback wins — Never zero (10th fallback)
2026-02-03,N,7,
2026-02-04,N,7,
2026-02-05,N,7,
2026-02-06,N,7,
2026-02-07,N,7,
2026-02-08,N,7,
2026-02-09,N,7,
2026-02-10,N,7,
2026-02-11,N,7,
2026-02-12,N,7,Tenure — 1 Month
2026-02-13,N,7,
2026-02-14,N,7,
2026-02-15,N,7,
2026-02-16,N,7,
2026-02-17,N,7,
2026-02-18,N,7,
2026-02-19,N,7,
2026-02-20,N,7,
2026-02-21,N,7,
2026-02-22,N,7,
2026-02-23,N,7,
2026-02-24,N,7,
2026-02-25,N,7,
2026-02-26,N,7,
2026-02-27,N,7,
2026-02-28,N,7,
2026-03-01,N,7,
2026-03-02,N,7,Missed day
2026-03-03,Y,8,Fallback wins — Comeback
2026-03-04,N,8,
2026-03-05,N,8,
2026-03-06,N,8,
2026-03-07,N,8,
2026-03-08,N,8,
2026-03-09,N,8,
2026-03-10,N,8,
2026-03-11,N,8,
2026-03-12,N,8,Tenure — 2 Months
2026-03-13,N,8,
2026-03-14,N,8,
2026-03-15,N,8,
2026-03-16,N,8,
2026-03-17,N,8,
2026-03-18,N,8,
2026-03-19,N,8,
2026-03-20,N,8,
2026-03-21,N,8,
2026-03-22,N,8,
2026-03-23,N,8,
2026-03-24,N,8,
2026-03-25,N,8,
2026-03-26,N,8,
2026-03-27,N,8,
2026-03-28,N,8,
2026-03-29,N,8,
2026-03-30,N,8,
2026-03-31,N,8,
2026-04-01,N,8,
2026-04-02,N,8,
2026-04-03,N,8,
2026-04-04,N,8,
2026-04-05,N,8,
2026-04-06,Y,9,
2026-04-07,Y,10,
2026-04-08,Y,11,
2026-04-09,Y,12,
2026-04-10,Y,13,
2026-04-11,Y,14,
2026-04-12,Y,15,Milestones — Full week (7/7)
2026-04-13,Y,16,
2026-04-14,Y,17,
2026-04-15,Y,18,
2026-04-16,N,18,
2026-04-17,Y,19,
2026-04-18,Y,20,
2026-04-19,N,20,
2026-04-20,Y,21,
2026-04-21,Y,22,
2026-04-22,N,22,
2026-04-23,Y,23,
2026-04-24,Y,24,
2026-04-25,N,24,
2026-04-26,Y,25,
2026-04-27,Y,26,
2026-04-28,N,26,
2026-04-29,Y,27,
2026-04-30,N,27,
2026-05-01,Y,28,
2026-05-02,Y,29,
2026-05-03,Y,30,Showing up — 30 days
2026-05-04,Y,31,
2026-05-05,Y,32,
2026-05-06,Y,33,
2026-05-07,Y,34,
2026-05-08,Y,35,
2026-05-09,Y,36,
2026-05-10,Y,37,
2026-05-11,Y,38,
2026-05-12,Y,39,
2026-05-13,Y,40,
2026-05-14,Y,41,
2026-05-15,Y,42,
2026-05-16,Y,43,
2026-05-17,Y,44,
2026-05-18,Y,45,
2026-05-19,Y,46,
2026-05-20,Y,47,
2026-05-21,Y,48,
2026-05-22,Y,49,
2026-05-23,N,49,
2026-05-24,N,49,
2026-05-25,N,49,
2026-05-26,N,49,
2026-05-27,N,49,
2026-05-28,N,49,
2026-05-29,N,49,
2026-05-30,Y,50,Showing up — 50 shown up
2026-05-31,N,50,
2026-06-01,Y,51,
2026-06-02,Y,52,
2026-06-03,Y,53,
2026-06-04,Y,54,
2026-06-05,N,54,
2026-06-06,Y,55,
2026-06-07,Y,56,
2026-06-08,Y,57,
2026-06-09,Y,58,Milestones — 100 done
2026-06-10,Y,59,
2026-06-11,Y,60,
2026-06-12,N,60,
2026-06-13,Y,61,
2026-06-14,Y,62,
2026-06-15,Y,63,
2026-06-16,Y,64,
2026-06-17,Y,65,
2026-06-18,Y,66,
2026-06-19,N,66,
2026-06-20,Y,67,
2026-06-21,Y,68,
2026-06-22,Y,69,
2026-06-23,Y,70,
2026-06-24,Y,71,
2026-06-25,Y,72,
2026-06-26,N,72,
2026-06-27,Y,73,
2026-06-28,Y,74,
2026-06-29,Y,75,
2026-06-30,Y,76,
2026-07-01,Y,77,
2026-07-02,Y,78,
2026-07-03,N,78,
2026-07-04,Y,79,
2026-07-05,Y,80,
2026-07-06,Y,81,
2026-07-07,Y,82,
2026-07-08,Y,83,
2026-07-09,Y,84,
2026-07-10,N,84,
2026-07-11,Y,85,
2026-07-12,Y,86,Tenure — 6 Months
2026-07-13,Y,87,
2026-07-14,Y,88,
2026-07-15,N,88,
```

## Shared demo timeline (S27/S29/S30 coherence)

This batch shares one Maya persona/timeline (Appendix B above) so badge-
earned dates, cycle boundaries, and cycle counts agree wherever they're
cross-referenced between screens:

- First day: Jan 12, 2026 (Tenure anchor, matches S27's tenure section and
  Appendix B row 1).
- Cadence history: **Monthly** from the start → switched to **Weekly** on
  Apr 6, 2026 (archiving a short Apr 1–5 monthly record — not part of S29's
  displayed 4-record list, but consistent history) → switched back to
  **Monthly** on Apr 13, 2026, immediately after the Apr 6–12 weekly cycle's
  natural end (archiving a short **Apr 13–30, 2026** monthly record — the
  one short cycle in S29's displayed list) → Monthly ever since, including
  the current in-progress July 2026 cycle. (This cadence-history fact is
  independent of Appendix B's Y/N schema — a cycle-boundary fact, not a
  show-up fact — and is unchanged from prior passes per Ruling 4.)
- S29's displayed records (newest first): June 2026 (full month), May 2026
  (full month), Apr 13–30, 2026 (short — cadence changed mid-month), Week of
  Apr 6–12, 2026 (full week). In progress: July 2026.
- **Every dated Showing-up/Fallback-wins badge sits on an Appendix B `Y`
  row (script-checkable invariant):**
  - **"Safety net"** — earned Jan 20, 2026 (Appendix B: `Y`, cum 5 — Maya's
    first fallback; a show-up, per the day-level reading).
  - **"7 days"** — earned Feb 2, 2026 (Appendix B: `Y`, cum reaches
    **exactly 7** on this row — the 7th `Y` row).
  - **"Never zero"** — **re-dated this pass to Feb 2, 2026** — "Earned
    Feb 2, 2026 — 10 fallbacks logged" (the same day as "7 days"; fallbacks
    are a task-level count, and multiple fallback occurrences on the same
    day, across the 7 shown-up days on or before Feb 2, are what bring the
    running fallback count to 10 by that date — arithmetically unproblematic
    since a single `Y` day can contain more than one fallback event across
    Maya's several tracked tasks). **This is the minimal-ripple fix:**
    re-dating "Never zero" onto an already-`Y` day (Feb 2) requires no
    change to any other badge date, whereas the previously-considered
    alternative (making Feb 14 a `Y` day) would have moved "30 days" to
    May 2 and "50 shown up" to May 29, forcing S29/S30 re-dating for no
    benefit — rejected for exactly that reason.
  - **"Comeback"** — earned Mar 3, 2026 (Appendix B: `Y`, cum 8 — the day
    after Mar 2, a non-`Y`/missed day; showing up the day after a missed
    day is itself a show-up, per this batch's own explainer).
  - **"Full week"** — earned Apr 12, 2026 (Appendix B: `Y`, cum 15 — inside
    the Apr 6–12 week, shown on that cycle's record).
  - **"30 days"** — earned May 3, 2026 (Appendix B: `Y`, cum reaches
    **exactly 30** on this row — inside May, shown on May's record).
  - **"50 shown up"** — earned May 30, 2026 (Appendix B: `Y`, cum reaches
    **exactly 50** on this row — inside May, shown on May's record
    alongside "30 days").
  - **"200 shown up"** — locked; Appendix B's cumulative never approaches
    200 within its 185-row span (max cum = 88, the last row), consistent
    with it remaining locked.
  - **"100 done"** (a Milestones badge, task-completion-count, not a
    Showing-up/Fallback-wins badge — a window-membership check only, per
    Ruling 2's scope) — earned Jun 9, 2026, inside June, shown on June's
    record — June's only badge.
  - The other Fallback-wins badge, "Saved 25×," is still **locked** in
    this demo (Maya's task-level fallback count hasn't reached 25) and so
    is trivially absent from every displayed cycle record; no earn date
    exists for it.
- **Cumulative "shown-up days" arrangement — now Appendix-B-derived, not
  independently narrated:** the `cum` column above is the literal running
  count; every cross-reference in this spec cites it directly rather than
  re-deriving it in prose. (Previously this section asserted a chain of
  additions in freestanding narrative form — replaced this pass with direct
  ledger citations, per Ruling 2's "provenance may only cite ledger rows"
  requirement.)

## Notes on celebration-motif compliance

- Celebration visuals (confetti-eligible) appear **only** on earned badges on
  this screen (never on locked ones, never implying a countdown/streak).
- No "current streak count" anywhere; tenure badges are explicitly framed
  as calendar-elapsed, not consecutive-usage.
- Locked badges match `MilestoneBadge`'s non-earned state — non-punitive,
  nothing implying failure.

## Mockup review note

Since a static HTML mockup can't carry a real navigation history, the
mockup exposes an explicit, clearly-labeled **reviewer control** ("Opened
from: Today (S09) / Settings (S41)") that is NOT part of the shipped UI —
it drives the back chevron's actual destination and a small caption
("Back returns to: Today" / "Back returns to: Settings") so both
conditional back destinations are verifiable in one file, exactly
mirroring S22/S48's reviewer-facing origin toggle and destination caption.

---

# S28 — Level-Up Celebration (overlay)    route: /achievements/celebrate
Features: F13, F29

## Contents

- **Scrim** — an overlay (presented as a modal/overlay per SITEMAP, not a full
  page navigation), dismissible by tapping the primary button only (no
  accidental tap-outside-dismiss, since this is a rewarding moment worth
  reading, not an accidental interstitial).
- **Confetti burst** — heavily rationed per DESIGN.md: fires **once**, only on
  this screen, only for a true level-up or a milestone tenure-badge unlock —
  never on a routine's ideal/fallback log (S24 uses a spring pop instead, no
  confetti). Degrades to a plain opacity cross-fade under OS "reduce motion."
- **MilestoneBadge** (celebratory).
- **Headline** — "You're now Level 8." (level-up variant) or "You've reached
  1 Year." (tenure-milestone variant).
- **Subhead** — new title line (level-up variant only): "New title:
  Dependable."
- **Body copy** — one or two calm sentences naming what was crossed, framed as
  earned consistency, not luck: "And you just crossed 100 tasks done — that's
  real consistency, not luck."
- **Forward-looking line** — "3 fresh badges now within reach."
- **Dismiss** — `Button`, "Nice!" → S27 (Achievements), where the newly earned
  badge/level is now visible in context.

## States

- **Level-up variant** — as above (adapted from IDEA Flow 9.4, reworded per PRD's no-streak-language rule — see B4).
- **Tenure-milestone variant** (F29) — same structure, headline swaps to
  the tenure tier crossed ("You've reached 1 Year."), body copy calls out
  the calendar-elapsed nature: "A full year with Fallback — however those
  days went. That's not a performance score, that's just time." No "New
  title" subhead
  (titles are a lifetime-XP/Level concept, not a tenure concept).
- **Reduced motion** — confetti replaced by a plain opacity cross-fade on
  entry; MilestoneBadge and copy appear identically otherwise.

## Interactions

- Tap "Nice!" → dismisses the overlay, returns to S27.
- Reached from S09 or S20 automatically, immediately after a qualifying
  completion crosses a level or tenure-tier boundary (never user-initiated
  navigation).
- Dev-only toggle (mockup only): Level-up variant / Tenure-milestone
  variant / Reduce motion.

## Responsive

- Phones-only v1 (PRD §5); desktop is review-only, presenting the identical overlay with no layout change.

## Copy (exact strings)

- Level-up headline: "You're now Level 8."
- Level-up subhead: "New title: Dependable."
- Level-up body: "And you just crossed 100 tasks done — that's real
  consistency, not luck."
- Forward line: "3 fresh badges now within reach."
- Tenure headline: "You've reached 1 Year."
- Tenure body: "A full year with Fallback — however those days went.
  That's not a performance score, that's just time."
- Dismiss button: "Nice!"

## Celebration-motif compliance

- Confetti fires **at most once per session**, only here or a tenure-tier
  unlock — matches DESIGN.md Motion → Confetti and Rule 5.
- **Confetti is decorative-only**: particles are never drawn from a signal
  role (ideal/fallback/off/missed) and never a hard-coded value outside the
  decorative roles. The fallback signal in particular is reserved and never
  decorative (IDEA masthead / DESIGN.md's whole signal-color discipline);
  confetti is a celebration/accent moment, not a place for signal hues to
  leak in as decoration.
- No streak language anywhere: the word never appears in rendered copy, not
  even in negation (a sentence like "no streak to break" still contains the
  banned token) — the "not luck" / "just time" framing conveys the same
  idea without it.
- MilestoneBadge label follows DESIGN.md's MilestoneBadge contrast rule.

---

# S29 — Cycle Records    route: /records
Features: F30, F31

> **Load-bearing behavior (SITEMAP Decision 19, mirroring Decision 14's
> S48/S50 pattern and Decision 18's S22 pattern):** this screen has exactly
> ONE route but TWO possible immediate origins — S27 (Achievements) and S41
> (Settings Home). Its back chevron (and hardware/gesture back) must return
> to **whichever screen opened it**, never a single fixed destination: S27
> if opened from S27, S41 if opened from S41. The origin must be carried as
> navigation state (e.g. a `from` param or the natural back-stack entry),
> never hardcoded to S27. (S30's own back → S29 is unaffected — it lands on
> this same S29 instance already on the stack, not a fresh origin choice.)

## Contents

- **App bar** — back chevron → **origin-aware** (S27 Achievements or S41
  Settings, whichever opened this screen — see the load-bearing behavior
  note above; mirrors the same origin-aware pattern carried on S25/S27),
  title "Cycle records."
- **In-progress cycle strip** — a non-archived `Card`, distinct from
  finalized records ("In progress" label, no "archived" tag, not tappable to
  a detail screen — it isn't a record yet). Shows the current cycle's live
  Cycling XP and a note naming when it finalizes.
- **Archived records list** — a `CycleRecordCard` per finalized cycle: cycle
  label (+ cadence-at-finalize, since a record keeps whatever cadence it was
  finalized under even after the user later changes it), consistency %
  (reusing F5 scope-2's fractional formula windowed to that cycle — §3B F30),
  a `ConsistencyBreakdownBar` (Ideal/Fallback/Off with the missed remainder
  as the unfilled remainder — same contract as S25/S30, never fully filled
  when missed days exist), the cycle's final Cycling XP value, and
  `MilestoneBadge` glyphs for badges unlocked that cycle. An "archived" label
  distinguishes it from the in-progress strip. A short cycle (finalized early
  or begun late by a mid-cycle cadence change, F31) carries a note: "Short
  cycle — cadence changed mid-month."
- **Empty (no finalized cycles yet)** — shown instead of the list when the
  very first cycle hasn't elapsed: `EmptyState`, "Your first recap arrives
  at the end of this month" (or "…this week" under weekly cadence).

## Fixture-island disclaimer (Ruling 1, binding)

This screen shares Maya's timeline with S27/S30 (materialized day-by-day in
S27 spec's "Appendix B — Maya show-up ledger"). Maya is not S25's
dashboard-fixture user, and not any of S26's simulated trend-graph users —
the three fixtures are deliberately disjoint; no arithmetic reconciliation
across them is in scope.

## Shared demo timeline (S27/S29/S30 coherence — see S27 spec for the full
narrative, including Appendix B's normative ledger)

The displayed list shows the 4 most recent archived records (older history
exists but isn't part of this truncated demo list) and is built on one
coherent Maya timeline: Monthly cadence from account start (Jan 12, 2026) →
Weekly from Apr 6, 2026 → Monthly again from Apr 13, 2026 (the switch back
happens exactly at the Apr 6–12 week's natural end, so it creates no short
*weekly* record — only a short *monthly* record, because that new monthly
cycle necessarily starts mid-month and runs only to the Apr 30 calendar
boundary) → Monthly ever since, including the current July 2026 in-progress
cycle. This yields, newest first: **June 2026** (full month), **May 2026**
(full month), **Apr 13–30, 2026** (short — the only short cycle in this
list), **Week of Apr 6–12, 2026** (full week) — no gaps between the oldest
displayed record and today, and exactly one cadence-change short record,
matching F31's "fresh cycle runs to the next natural calendar boundary of
the new cadence" mechanic (PRD §3B F31) exactly. Every badge shown on a
record's badge row has an earn date (per S27) that falls inside that
record's own cycle window — including "30 days," which S27's shared
cumulative-arrangement note now dates to **May 3, 2026** (inside May, not
June), so it appears on **May's** record alongside "50 shown up," and
June's record carries only "100 done."

## States

- **Default** — in-progress strip + 4 archived records (mixed monthly/
  weekly cadence, exactly one short cycle: Apr 13–30, 2026) as described
  above.
- **Loading** — `Skeleton` cards in place of the in-progress strip and each
  list row.
- **Empty** — as above (no finalized cycles yet; a brand-new user).
- **Error** — `InlineRetryBanner` in place of the list: "Couldn't load your
  cycle records right now." + "Retry."

## Interactions

- Tap back chevron (or hardware/gesture back) → **origin-aware**: returns
  to **S27** if this screen was opened from Achievements, or to **S41** if
  opened from Settings — never a single fixed destination (see the
  load-bearing behavior note above, SITEMAP Decision 19).
- Tap an archived `CycleRecordCard` → S30 (that cycle's full read-only
  detail; the mockup wires this to S30's June 2026 example regardless of
  which record card is tapped, since S30 demonstrates one representative
  detail view, not a fully dynamic per-record store).
- The in-progress strip is **not tappable** — it isn't a finalized record.
- Dev-only state toggle (mockup only): Default / Loading / Empty / Error.

## Responsive

- Phones-only v1 (PRD §5); desktop is review-only, presenting the identical list with no layout change.

## Copy (exact strings)

- Title: "Cycle records"
- In-progress strip: "In progress — July 2026" / "128 XP so far" /
  "Finalizes Jul 31, then archives here."
- Record 1: "June 2026 · Monthly" / "91%" / "Cycling XP: 412" / badge:
  "100 done" / "1 badge"
- Record 2: "May 2026 · Monthly" / "84%" / "Cycling XP: 180" / badges:
  "30 days," "50 shown up" / "2 badges"
- Record 3: "Apr 13–30, 2026 · Monthly — short cycle — cadence changed
  mid-month" / "80%" / "Cycling XP: 130" / "0 badges"
- Record 4: "Week of Apr 6–12, 2026 · Weekly" / "100%" / "Cycling XP: 95" /
  badge: "Full week" / "1 badge"
- "archived" tag text: "Archived"
- Empty headline: "No recaps yet"
  - Subcopy: "Your first recap arrives at the end of this month."
- Error banner: "Couldn't load your cycle records right now." Button:
  "Retry"

## Worked-example provenance

- Every record's % reuses F5/R6 scope-2's fractional formula windowed to
  that cycle (PRD §3B F30, Decisions item 19) — no new per-cycle formula.
  Underlying breakdown (Ideal/Fallback/Off/Missed, rounding round-half-up,
  same unit conventions as S25's Aggregate legend — Ideal/Fallback are
  rounded credit sums, Off is a day count, Missed is the rounded remainder):
  - June 2026: Ideal 20 · Fallback 6 · Off 2 · Missed 3 (Σf ≈ 25.5,
    denominator 28, 28 + 2 off = June's 30 days) → 91%. Breakdown ≈
    66/19/7, ~8% remains as Missed (matches S30's detail view exactly —
    same cycle, same numbers). Badge row: "100 done" (earned Jun 9, 2026,
    per S27) — "30 days" moved to May's record (see below).
  - May 2026: Ideal 18 · Fallback 5 · Off 4 · Missed 4 (denominator 27,
    27 + 4 off = May's 31 days) → 84%. Breakdown ≈ 58/16/13, ~13% remainder.
    Badge row: "30 days" (earned May 3, 2026) and "50 shown up" (earned May
    30, 2026), both per S27's cumulative-arrangement note — both genuinely
    fall inside May's window given the records' own Ideal+Fallback totals.
  - Apr 13–30, 2026: Ideal 9 · Fallback 3 · Off 3 · Missed 3 (denominator
    15, 15 + 3 off = the cycle's 18 days) → 80%. Breakdown ≈ 50/17/17,
    ~16% remainder.
  - Week of Apr 6–12, 2026: Ideal 6 · Fallback 1 · Off 0 · Missed 0
    (denominator 7 = the full week) → 100%. Breakdown 86/14, correctly
    **fully accounted since Missed is genuinely 0** — not an omission bug,
    a true 100%.

## Mockup review note

Since a static HTML mockup can't carry a real navigation history, the
mockup exposes an explicit, clearly-labeled **reviewer control** ("Opened
from: Achievements (S27) / Settings (S41)") that is NOT part of the shipped
UI — it drives the back chevron's actual destination and a small caption
("Back returns to: Achievements" / "Back returns to: Settings") so both
conditional back destinations are verifiable in one file, exactly mirroring
S22/S48's reviewer-facing origin toggle and destination caption.

---

# S30 — Cycle Record Detail    route: /records/:cycleId
Features: F30

## Contents

- **App bar** — back chevron → S29 only (SITEMAP: "Primary actions: none
  (read-only), back" — no edit/delete/share affordance anywhere on this
  screen). Title: "Cycle detail."
- **Cycle header** — cycle label + cadence-at-finalize + "Archived" tag,
  e.g. "June 2026 · Monthly · Archived."
- **Consistency %** — numeral, reusing F5 scope-2's fractional formula
  windowed to this cycle.
- **ConsistencyBreakdownBar** — with the same ideal/fallback/off legend
  (+ missed count) used on S25. Ideal/Fallback/Off with the missed remainder
  as the unfilled remainder — never fully filled when Missed > 0 (DESIGN.md's
  ConsistencyBreakdownBar contract).
- **Cycling XP final value** — a read-only XP row, no live ticking (this
  cycle is over): "Cycling XP this cycle: 412," no reset date (already reset).
- **Badges unlocked this cycle** — `MilestoneBadge` glyphs, each labeled, for
  every badge (including tenure milestones, F29) crossed during this cycle's
  window. Empty list → "No new badges this cycle" (neutral, not a failure).
- **Short-cycle note** (only when applicable) — same note as the S29 list
  row: "Short cycle — cadence changed mid-month."

## Fixture-island disclaimer (Ruling 1, binding)

This screen shares Maya's timeline with S27/S29 (materialized day-by-day in
S27 spec's "Appendix B — Maya show-up ledger"). Maya is not S25's
dashboard-fixture user, and not any of S26's simulated trend-graph users —
the three fixtures are deliberately disjoint; no arithmetic reconciliation
across them is in scope.

## Shared demo timeline

This screen's default example is the **June 2026** record from S29's list —
same Maya timeline (see S27/S29 specs), same numbers, so the two screens
never contradict each other for the same cycle: Ideal 20 · Fallback 6 ·
Off 2 · Missed 3, Σf ≈ 25.5 of 28 counted days (28 + 2 off = June's 30
days), 91%, Cycling XP 412, badge "100 done" (earned Jun 9, 2026) — inside
June's window. ("30 days," earned May 3, 2026 per S27's shared
cumulative-arrangement note, falls inside **May's** cycle instead and is
shown on S29's May record, not here — June carries only "100 done.")

## States

- **Default** — a fully populated archived cycle (June 2026 example from
  S29).
- **Loading** — `Skeleton` blocks for the numeral, bar, XP row, and badge
  row.
- **Error** — `InlineRetryBanner` in place of the body content: "Couldn't
  load this cycle right now." + "Retry."
- **No badges that cycle** — the badge section shows "No new badges this
  cycle" instead of an empty grid (never blank with no explanation).

## Interactions

- Tap back chevron → S29. No other interactive element exists on this
  screen (explicitly read-only per SITEMAP).
- Dev-only state toggle (mockup only): Default / Loading / Error / No
  badges.

## Responsive

- Phones-only v1 (PRD §5); desktop is review-only, presenting the identical layout with no new panes.

## Copy (exact strings)

- App bar title: "Cycle detail"
- Header: "June 2026 · Monthly · Archived"
- Consistency numeral: "91%"
- Subline: "≈25.5 of 28 counted days (weighted by that day's tasks)"
- Legend: "Ideal 20 · Fallback 6 · Off 2 · Missed 3" (Missed is
  `round(28 − 25.5) = round(2.5) = 3` — round-half-up, not down; see S25's
  stated rounding rule)
- Cycling XP row: "Cycling XP this cycle: 412"
- Badges header: "Badges unlocked this cycle"
- Badges: "100 done"
- No-badges copy: "No new badges this cycle"
- Error banner: "Couldn't load this cycle right now." Button: "Retry"

## Worked-example provenance

- The 91%/28-day figure carries the same fractional-formula lineage as
  S25's Aggregate scope and S29's list row for this cycle — reused, not
  recalculated (PRD §3B F30, Decisions item 19). Missed uses S25's stated
  round-half-up rule (2.5 → 3). Breakdown ≈ 66% Ideal / 19% Fallback / 7% Off,
  ~8% remains as Missed — the remainder is load-bearing, not an oversight
  (DESIGN.md ConsistencyBreakdownBar).
- Badge row: "100 done" only, earned Jun 9, 2026 (inside June). "30 days"
  is earned May 3, 2026 per S27's shared cumulative-arrangement note and so
  belongs to May's cycle record, not June's — kept in sync with S29's May
  row (which now carries "30 days" and "50 shown up").

---

# S31 — Assistant Home    route: /assistant

Features: F16

## Contents

- Reached by tapping the Fallback AI entry point from Today (S09).
- **Back-chevron IconButton** → returns to S09 (Today).
- No separate page title; identity is carried by the hero content ("Fallback
  AI").
- **Eyebrow label** — "Fallback AI".
- **Headline** — "What should I set up for you?".
- **Subcopy** — "Tap & speak — or type below.".
- **Mic button** (IconButton, mic Lucide glyph) — the primary CTA of the
  screen.
- **Mic caption** — "Audio is only processed when you tap.".
- **Suggestion chips** — tappable pill chips:
  - "Add a morning run"
  - "Water plants Mon & Thu"
  - "10-day meditation"
  - "Plan my week"
  - "Add a medication"
- **Text-entry footer**:
  - Input (text field, placeholder "Or type what you need…").
  - Send IconButton (arrow-up glyph), disabled until the input holds text.

## States

- **default** — as above; mic button and chips both active, entitlement + mic-permission
  status already resolved for this render.
- **loading** — brief skeleton on first mount only, while entitlement (F17/F18) and
  mic-permission status are read: headline/subcopy render as Skeleton, mic button
  as a disabled Skeleton, chips as Skeleton. Resolves in place — no
  spinner-only screen (Streakforge rule).
- **error** — entitlement/permission read fails: hero region replaced by
  InlineRetryBanner ("Couldn't load the assistant right now." + "Retry"); chips
  and text entry stay hidden until retry succeeds.
- **disabled: N/A** for chips/mic once loaded — always tappable; the *destination*
  differs by entitlement/permission, not the control's enabled state.

## Interactions

- Tap the mic button →
  - Not entitled (no active subscription F17, no BYO key F18) → **S38** (Paywall).
  - Entitled but OS mic permission never granted / currently off → **S37**
    (Microphone Permission Primer), framed as the first-time **primer**.
  - Entitled + mic already granted → **S32** (Assistant Conversation), entering
    directly into the **listening** state.
- Tap a suggestion chip → behaves exactly like typing that chip's text and submitting
  it (routes through **text** modality only — a chip tap never triggers a mic-permission
  check and never itself routes to S37): not entitled → S38; entitled → S32 with the
  chip text as the conversation's opening turn.
- Type in the footer input + tap send →
  - Not entitled → S38.
  - Entitled → S32, opened in **text-input** state with the typed message as the first
    turn. Never triggers S37.
- Tap back chevron → returns to S09 (Today). Visiting this screen alone creates no data.
- Screen reader: headline announced first; mic button labeled "Speak to Fallback AI,
  button"; each chip labeled "Suggestion: <chip text>, button"; text input labeled
  "Type your request"; send button's disabled state announced until text is present.

## Responsive

- Phones-only per PRD §5; desktop is review convenience only.

## Copy

- Eyebrow: "Fallback AI"
- Headline: "What should I set up for you?"
- Subcopy: "Tap & speak — or type below."
- Mic caption: "Audio is only processed when you tap."
- Chips: "Add a morning run" · "Water plants Mon & Thu" · "10-day meditation" ·
  "Plan my week" · "Add a medication"
- Text input placeholder: "Or type what you need…"
- Error: "Couldn't load the assistant right now." / "Retry"

---

# S32 — Assistant Conversation    route: /assistant/chat

Features: F16

## Contents

- The assistant's single persistent conversation view — entered from S31 (new
  chat), S35 (continuing a saved chat), S33 (clarification resolved, modal
  dismisses back onto this screen), S36 (New conversation), S37 (mic enabled,
  or "type instead" from mic-off recovery), S39 (purchase confirmed), S40
  (BYO key saved).
- **Close (X) IconButton** → triggers the **recap** state (see States) before
  dismissing.
- **Live modality indicator** — a mic or keyboard glyph + "Fallback AI"
  wordmark — reflecting whichever input mode is currently active.
- **Overflow ("⋯") IconButton** → opens **S36** (Assistant Options Menu) as a
  sheet over this screen.
- **Transcript**:
  - User turns (message bubbles).
  - Assistant turns (message bubbles with a "Fallback AI" avatar glyph).
  - **Task-created card** (inline, embedded in an assistant turn): a `Card`
    showing the task's icon, name, cadence/time summary, and ideal/fallback
    one-liners — e.g. "Morning workout — daily, 7:00 AM · Full workout /
    10 pushups." Never carries celebration chrome (Rule 5 — no celebration
    chrome here).
  - **Edit-with-Undo banner** (inline, embedded in an assistant turn):
    assistant line + an "Undo" `Button` + a caption ("Say 'undo' to put it
    back.").
  - Auto-scrolls to the newest turn as the conversation grows.
- **Input footer**:
  - Modality toggle: two IconButtons (mic / keyboard), only one active at a
    time — tapping the inactive one switches modality mid-conversation
    without losing transcript state.
  - **Voice mode:** a mic button + live waveform indicator + "Listening…"
    label while capturing; a "Transcribing…" label while the STT resolves.
  - **Text mode:** an Input (placeholder "Type your request…") + send
    IconButton, disabled until text present.

## States

- **loading** — on first mount (e.g. arriving fresh from S31 with a pending opening
  message): a single Skeleton assistant-turn bubble ("thinking…") while the
  first reply streams in.
- **listening** — voice mode, mic actively capturing: a live partial
  transcript appears as a user bubble that solidifies once finalized. Tapping
  the mic again ends capture early.
- **text-input** — text mode, keyboard open, user composing; send button enabled once
  text is present.
- **default / active chat** — the steady-state transcript mixing user
  turns, assistant turns, task-created cards, and edit/Undo banners, in either modality.
- **clarification** — a user turn is ambiguous (same-named tasks): the transcript
  pauses and **S33** (Assistant Clarification) opens as a modal over this screen (see
  S33 spec). Resolving it returns to this screen's transcript with a confirmation turn
  appended (e.g. "Got it — logged for Morning workout.").
- **offline / error** (Flow 4+.D) — the assistant becomes unreachable mid-conversation:
  the input footer is replaced by an InlineRetryBanner, `warning`-tone icon,
  copy: "Can't reach the assistant. You're offline. Everything
  you've made is safe on this device — try again in a moment." with two actions: "Try
  again" (re-attempts the last send) and "Add a task manually" — a concrete
  navigation, not a state: it dismisses this conversation via the same standard
  back-navigation as the header close (X) uses, EXCEPT the recap is skipped (there is
  nothing new to recap in the offline case, and the transcript is preserved so the
  conversation can be resumed once connectivity returns), and then opens **S15** (Add
  Task: Pick Type). This navigation edge, S32 → S15, scoped solely to this offline
  "Add a task manually" action, is formally part of SITEMAP.md's S32 entry per
  Decision 20 (S32's Leads-to set includes S15; S15's Reached-from set includes
  S32) — no other S32 behavior changes. The transcript remains visible and
  scrollable until this action or "Try again" is taken — this is a footer-level
  state, not a full-screen takeover, and does not itself constitute the navigation
  (only tapping "Add a task manually" does).
- **recap** — triggered by tapping the header close (X): the transcript view is
  replaced by a recap summarizing every task created or edited in this
  session ("All set — here's everything from this chat 👇" + a card per task/edit +
  "Close anytime — I'll save this conversation so you can pick it back up. 🌱" + a
  single "Done" Button). Tapping "Done" (or the close X again) dismisses the screen
  entirely, returning to whatever screen presented it (typically S31 or the app's
  previous screen in the navigation stack) via standard back-navigation.
- **mic-off mid-conversation** — tapping the mic toggle while the OS mic permission is
  off does not enter "listening"; instead it navigates to **S37**, framed as the
  **recovery** context, per the sitemap edge S32 → S37.

## Interactions

- Tap mic toggle (mic permission granted) → enters **listening**; tap again (or say
  nothing for a timeout) → finalizes the transcript, assistant responds.
- Tap mic toggle (mic permission off/never granted) → navigates to **S37** (recovery
  framing), per the "Leads to: S37 (mic-off recovery)" sitemap edge. No state change
  occurs on S32 itself until the user returns from S37.
- Tap keyboard toggle → switches to **text-input**; any transcript so far is retained
  unchanged — modality can be switched turn-by-turn.
- Type + tap send → appends a user turn; assistant streams a reply; a created/edited
  task renders as an inline card in that same reply turn.
- Tap "Undo" on an edit banner (Flow 4+.A) → reverts that specific edit, appends a
  confirmation turn ("Reverted — evening meds moved back to their previous time."),
  same class of calm confirmation used elsewhere for reverts. Saying "undo" by voice
  performs the identical action.
- An ambiguous request (e.g. "mark workout done" with two same-named tasks) → opens
  **S33** as a modal; resolving an option there (tap or voice) closes the modal and
  appends the resolved confirmation to this transcript. No separate navigation occurs —
  S33 renders "within" this route per the sitemap.
- Tap the overflow "⋯" → opens **S36** (Options Menu) as a sheet over this screen;
  "New conversation" from that sheet returns here with a cleared transcript (still the
  same S32 route).
- Tap header close (X) → shows the **recap** state (summary of this
  session's task effects) before dismissing. **This close action does NOT navigate to
  S09 (Today).** Any tasks the conversation created or edited already persisted at the
  moment each was confirmed in-chat (a data side-effect described in this screen's
  Purpose, per SITEMAP Decision 15) — they will simply be visible next time Today is
  opened, but closing this chat is not itself a route to S09 or any other screen beyond
  standard back-navigation to wherever this conversation was opened from.
- Offline banner "Try again" → re-attempts the last unsent message. "Add a task
  manually" → standard back-navigation out of this conversation (transcript saved,
  recap skipped since this is the offline path), landing on **S15** (Add Task: Pick
  Type) so the user can create the task by hand; this reuses the S32 → S15 edge
  declared above (offline-only, gap-resolution) and does not add any other route.
- Screen reader: each new assistant turn is announced via a live region; the
  listening/transcribing state announces "Listening" / "Transcribing" so a screen-reader
  user is never left in ambiguous silence; Undo buttons are labeled "Undo: <what
  changed>".

## Responsive

- Phones-only v1 (PRD §5); desktop is review convenience only.

## Copy

- Assistant (opening reply, Flow 4.3): "Done — created it, with a fallback for the
  days you're slammed 🌱"
- Follow-up prompt: "Want to add anything else — a course, an event, a reminder?"
- Course example (Flow 4.4), assistant: "I'll ramp it 5 → 15 min over 10 days, with a
  1-minute breathing fallback for hard days."
- User (text, Flow 4.5): "7:30am, right after the workout" / "also remind me to call
  mom friday at 6"
- Edit-with-Undo (Flow 4+.A): "Moved your evening meds to 9:00 PM." / Undo caption:
  "Say 'undo' to put it back."
- Recap headline (Flow 4.6): "All set — here's everything from this chat 👇"
- Recap footer: "Close anytime — I'll save this conversation so you can pick it back
  up. 🌱"
- Offline (Flow 4+.D): "Can't reach the assistant. You're offline. Everything you've
  made is safe on this device — try again in a moment." Actions: "Try again" / "Add a
  task manually"
- Listening label: "Listening…" / Transcribing label: "Transcribing…"
- Text input placeholder: "Type your request…"

---

# S33 — Assistant Clarification (modal)    route: within /assistant/chat

Features: F16

## Contents

- A Dialog (modal) presented over S32 (Assistant Conversation) when the assistant
  detects an ambiguous reference — most commonly two tasks sharing the same name. Does
  not have its own route; it renders within `/assistant/chat`.
- Drag handle (decorative).
- Assistant avatar glyph + "Quick check" label.
- Question text: "You have two 'workout' tasks — which one?"
- Two tappable option Cards, each with:
  - Task icon + name.
  - Meta subline (e.g. cadence/time, to disambiguate at a glance):
    - "Morning workout — daily, 7:00 AM"
    - "Evening workout — daily, 6:00 PM"
- Voice affordance: mic IconButton + caption "Or just say which one." — answering by
  voice resolves the same way as tapping.

## States

- **default** — two (or more) options rendered, awaiting a tap or a spoken answer.
- **listening** — triggered by tapping the mic or by the user simply speaking while the
  modal is open (voice modality was already active in S32): the footer caption is
  replaced by a "Listening for your answer…" label.
- **loading / resolving** — brief moment between an answer being given (tap or voice)
  and the modal closing: the chosen option is briefly acknowledged before dismissal.
- **unresolved / re-ask** — if a spoken answer doesn't clearly match either option, the
  modal stays open and the assistant appends a calm re-ask ("Sorry — which one did you
  mean?") rather than guessing or erroring; never an error treatment (this is a
  clarifying re-prompt, not a validation failure).
- **disabled: N/A** — both options are always tappable; there is no locked/disabled
  option state.

## Interactions

- Tap an option Card → resolves the disambiguation immediately; modal dismisses; S32's
  transcript receives an appended confirmation turn naming the resolved task (e.g. "Got
  it — logged for Morning workout.").
- Speak an answer (e.g. "the morning one") while the modal is open → same resolution
  path as tapping; the modal's voice affordance is always live regardless of which
  modality opened the underlying S32 conversation.
- Tap the scrim / swipe down → dismisses without resolving; S32 appends a calm
  assistant turn ("No worries — let me know which one whenever you're ready.") and the
  original ambiguous instruction is left unapplied (no task edited).
- Screen reader: modal announces as an alert-dialog with the question read first, each
  option announced as "<name>, <meta>, button," and the voice affordance announced as
  an alternative input method, not a required one.

## Responsive

- Phones-only; desktop is review convenience only, with no committed desktop layout.

## Copy

- Header label: "Quick check"
- Question: "You have two 'workout' tasks — which one?"
- Option 1: "Morning workout — daily, 7:00 AM"
- Option 2: "Evening workout — daily, 6:00 PM"
- Voice caption: "Or just say which one."
- Listening label: "Listening for your answer…"
- Re-ask (unresolved): "Sorry — which one did you mean?"
- Dismiss-without-resolving turn (appended to S32): "No worries — let me know which
  one whenever you're ready."
- Resolved confirmation (appended to S32): "Got it — logged for Morning workout."

---

# S34 — Assistant Conversation History    route: /assistant/history

Features: F16

## Contents

- Full-screen list surface. Reached from S36 (Options Menu → "Conversation history")
  and S41 (Settings, via the assistant's history entry point).
- Back-chevron IconButton → returns to whichever screen presented this (S36's sheet
  context or S41).
- Title: "Conversation history".
- Scrollable conversation list, ordered newest-first. Each row is a tappable Card with:
  - Date/time label — e.g. "Today, 8:14 AM".
  - Modality Tag (static, neutral, per Streakforge's "never colored" rule) — one of
    "Voice + text" / "Voice" / "Text", differentiated by label only.
  - Summary line — the assistant's own recap sentence for that chat.
  - Task-count Badge — e.g. "3 tasks".

## States

- **default** — populated list as above.
- **loading** — first-paint Skeleton rows.
- **empty** — no conversations saved yet: EmptyState (chat-bubble icon + headline +
  subcopy, no illustration). Reachable only for a user who has never completed a chat
  with the assistant (entitled but unused, or all history somehow cleared).
- **error** — list read fails: InlineRetryBanner replacing the list region, calm copy +
  ghost "Retry".

## Interactions

- Tap a conversation row → opens **S35** (Assistant Reopened Conversation) for that
  chat's id.
- Tap back chevron → returns to the presenting screen (S36 or S41); no data changes.
- Screen reader: each row announced as "<date/time>, <modality>, <summary>, <task
  count>, button — opens conversation."

## Responsive

- Phones-only; desktop is review convenience only, with no committed desktop layout.

## Copy

- Title: "Conversation history"
- Sample rows (Flow 4.7, verbatim):
  - "Today, 8:14 AM" · Voice + text · "Added a workout, a meditation course & a
    reminder to call mom" · "3 tasks"
  - "Yesterday, 6:40 PM" · Voice · "Moved the evening dose to 9 PM" · "1 task"
  - "Jul 12, 7:02 AM" · Text · "Built 5 dinners as a 5-day course" · "1 task"
- Empty headline: "No conversations yet"
- Empty subcopy: "Start a chat with Fallback AI and it'll show up here, ready to
  reopen anytime."
- Error: "Couldn't load your conversation history." / "Retry"

---

# S35 — Assistant Reopened Conversation    route: /assistant/history/:id

Features: F16

## Contents

- Full-screen surface. Reached from S34 by tapping a saved conversation row.
- Back-chevron IconButton → returns to **S34**.
- Title: the conversation's date/time label, plus its modality Tag (neutral, e.g.
  "Voice + text").
- Transcript replay (scrollable, read-only): same bubble content as S32 (user turns,
  assistant turns, task-created cards inline) but **non-interactive** — no Undo
  buttons, no live mic/waveform; this is a historical record.
- "Tasks created in this chat" section:
  - Section label: "Tasks created in this chat".
  - One compact task Card per task this conversation produced or edited: icon, name,
    cadence/time, ideal/fallback one-liners.
- "Continue this chat…" footer:
  - Input (placeholder "Continue this chat…") + send IconButton, plus a mic IconButton
    for continuing by voice — matches S32's modality-switching affordance.

## States

- **default** — full transcript + task list rendered as above.
- **loading** — Skeleton transcript bubbles + Skeleton task-card rows on first paint.
- **error** — transcript read fails: InlineRetryBanner replaces the transcript region,
  calm copy + ghost "Retry"; the footer input stays available regardless (a read
  failure on history shouldn't block starting a fresh continuation).
- **disabled: N/A** — this screen has no toggleable controls beyond the footer input,
  which follows the same enabled/disabled-on-empty-text rule as S32's send button.

## Interactions

- Tap back chevron → returns to **S34**.
- Type in the "Continue this chat…" input + send, or tap the mic to continue by voice
  → navigates to **S32** (Assistant Conversation), resuming this same conversation
  thread live (the reopened transcript becomes this thread's history, with the new
  turn appended going forward).
- Tap a task card in the "Tasks created" section → this is a read-only reference (no
  navigation away from S35 defined in the sitemap); the card is present for context
  only, not a drill-down link, keeping this screen's Leads-to strictly limited to S32.
- Screen reader: transcript announced as a read-only historical log ("Past
  conversation, read-only"); the "Continue this chat" input is announced as the point
  where the conversation becomes live again.

## Responsive

- Phones-only; desktop is review convenience only, with no committed desktop layout.

## Copy

- Header date/time: "Today, 8:14 AM" · modality: "Voice + text"
- Transcript (Flow 4.8, same content as S32's worked example): user "Add a workout
  every morning at 7, and give it an easy version for busy days." → assistant "Done —
  created it, with a fallback for the days you're slammed 🌱" → … → "Also start a
  10-day meditation course." → "I'll ramp it 5 → 15 min over 10 days, with a 1-minute
  breathing fallback for hard days." → "also remind me to call mom friday at 6" →
  "Done."
- Section label: "Tasks created in this chat"
- Task cards: "Morning workout — daily, 7:00 AM," "Meditation — 10-day course, 7:30
  AM," "Call mom — Fri, 6:00 PM"
- Footer placeholder: "Continue this chat…"
- Error: "Couldn't load this conversation." / "Retry"

---

# S36 — Assistant Options Menu (sheet)    route: within /assistant/*

Features: F16

## Contents

- A Dialog (bottom sheet) presented over the current assistant screen when the "⋯"
  overflow is tapped — most commonly from S32. Does not have its own route; it renders
  "within" whichever `/assistant/*` route triggered it.
- Drag handle (decorative).
- Title: "Fallback AI options".
- Close (X) IconButton → dismisses, returns to the underlying screen unchanged.
- Menu rows:
  1. **New conversation** — "message-square-plus" icon + label. → **S32**, with a
     freshly cleared transcript (same route, new thread).
  2. **Conversation history** — "history" icon + label. → **S34**.
  3. **Voice & language** — "languages" icon + label. Expands **inline** (an accordion
     within this same sheet, not a new screen — no Leads-to edge exists for it in the
     sitemap): reveals a Language Select (e.g. "English (US)") and a Voice Select (e.g.
     "Warm — default" / "Calm" / "Direct"), both closed-set pickers.
  4. **Manage subscription** — "credit-card" icon + label, subtitle showing current
     plan status ("Fallback AI · renews Aug 20"). → **S44**.
  5. **Account & sync** — "shield-check" icon + label. → **S45**.
  6. **Help** — "help-circle" icon + label. → **S49**.

## States

- **default** — six rows collapsed (Voice & language closed).
- **expanded** — "Voice & language" row expanded inline, showing its two Select
  controls; tapping the row again collapses it. Other rows remain tappable while
  expanded.
- **loading** — the "Manage subscription" subtitle (renewal date) is fetched
  asynchronously on first sheet-open: subtitle renders as a Skeleton bar until
  resolved, row itself remains tappable immediately (navigating to S44 doesn't need to
  wait on this subtitle).
- **disabled: N/A** — every row is always actionable; there is no locked state.

## Interactions

- Tap "New conversation" → dismisses sheet, navigates to **S32** with a cleared
  transcript.
- Tap "Conversation history" → dismisses sheet, navigates to **S34**.
- Tap "Voice & language" → toggles the inline accordion open/closed in place; no
  navigation. Changing the Language or Voice Select persists immediately (F16 setting)
  with a calm Toast ("Saved").
- Tap "Manage subscription" → dismisses sheet, navigates to **S44**.
- Tap "Account & sync" → dismisses sheet, navigates to **S45**.
- Tap "Help" → dismisses sheet, navigates to **S49**.
- Tap close (X) or scrim / swipe down → dismisses sheet, returns to the underlying
  assistant screen with no change.
- Screen reader: sheet announces as a modal menu; each row is a single-tap navigation
  button except "Voice & language," which is announced as an expandable/collapsible
  disclosure control.

## Responsive

- Phones-only; desktop is review convenience only, with no committed desktop layout.

## Copy

- Sheet title: "Fallback AI options"
- Rows: "New conversation" · "Conversation history" · "Voice & language" · "Manage
  subscription" (subtitle: "Fallback AI · renews Aug 20") · "Account & sync" · "Help"
- Voice & language expanded labels: "Language" (value: "English (US)"), "Voice"
  (value: "Warm — default")
- Saved toast: "Saved"

---

# S37 — Microphone Permission Primer    route: /assistant/mic-primer

Features: F16, F9

## Contents

- Full-screen surface. Serves **two distinct entry contexts** sharing one route and one
  template (per SITEMAP Decision 1: the mic primer is contextual, not part of core
  onboarding):
  - **Primer context** — first time the user reaches the assistant and taps the mic,
    reached from **S31**, before the OS permission prompt has ever been shown.
  - **Recovery context** — reached from **S32** mid-conversation when the user taps the
    mic toggle but the OS mic permission is currently off (previously denied or revoked
    in system settings).
  - Both contexts render the same elements; only the headline/body copy and primary
    action differ (see Copy).
- Back-chevron IconButton → returns to whichever screen presented this (S31 or S32),
  leaving that screen's state unchanged.
- Hero:
  - Mic icon.
  - Headline.
  - Body copy.
  - Reassurance line: "Audio is processed only when you tap the mic."
- Actions:
  - Primary Button: "Enable" (primer) / "Open Settings" (recovery).
  - Secondary Button: "Not now" (primer) / "Type instead" (recovery).

## States

- **primer** (default for the S31 entry): headline "Just say what you need," full
  rationale body copy, actions "Enable" / "Not now".
- **recovery** (default for the S32 entry): headline "Turn on the mic to talk,"
  shorter recovery-focused body copy, actions "Open Settings" / "Type instead".
- **requesting** (primer only, transient) — after tapping "Enable," the screen shows a
  brief calm waiting state ("Waiting for permission…") while the OS system prompt is
  in front; resolves automatically once the user responds to the OS dialog.
- **disabled: N/A** — both actions are always tappable; there is no locked variant.

## Interactions

- **Primer — tap "Enable"** → triggers the OS microphone permission system prompt.
  - Granted → navigates to **S32**, entering directly into the **listening** state.
  - Denied → navigates to **S32** anyway, entering **text-input** state instead (the
    assistant remains fully usable via text per F9's "app is fully usable if
    declined").
- **Primer — tap "Not now"** → navigates to **S32** in **text-input** state, mic
  permission left unresolved for next time.
- **Recovery — tap "Open Settings"** → deep-links to the OS Settings app's
  permission page for Fallback (external to the app). On return to the app: if the
  permission is now on, navigates to **S32** in **listening** state; if still off,
  returns to this same **recovery** framing of S37.
- **Recovery — tap "Type instead"** → navigates to **S32**, resuming the
  in-progress conversation in **text-input** state, transcript preserved exactly as
  it was when the user tapped the mic toggle.
- Tap back chevron (either context) → returns to the presenting screen (S31 or S32)
  unchanged; no permission state is altered by simply backing out.
- Screen reader: headline read first; both actions clearly labeled with their context-
  appropriate verb ("Enable microphone access, button" / "Open system settings,
  button" / "Not now, button" / "Type instead, button").

## Responsive

- Phones-only; desktop is review convenience only, with no committed desktop layout.

## Copy

**Primer framing (Flow 10.3, verbatim):**
- Headline: "Just say what you need."
- Body: "The microphone powers the voice assistant... Audio is processed only when
  you tap the mic."
- Secondary line: "Prefer typing? You can skip — the assistant takes text too."
- Actions: "Enable" / "Not now"

**Recovery framing (Flow 4+.C, verbatim):**
- Headline: "Turn on the mic to talk..."
- Body: "Enable the microphone in Settings — or just type instead."
- Actions: "Open Settings" / "Type instead"

**Shared reassurance line:** "Audio is processed only when you tap the mic."
**Transient (primer, requesting):** "Waiting for permission…"

---

# S38 — Paywall    route: /assistant/paywall
Features: F16, F17, F18

## Contents

- Full-page screen (not a sheet), scrollable if content exceeds viewport.
- Back IconButton, label "Back" → returns to S31 with no side effect.
- Eyebrow label with a small sparkle icon: "FALLBACK AI" — orients the user without
  implying a purchase has started.
- Store-connectivity banner (conditional — see States): `InlineRetryBanner`, hidden by
  default. When the platform store (Apple App Store / Google Play) can't be reached:
  copy "Can't reach the App Store right now. Your own AI key still works — no store
  connection needed," ghost "Retry" button. Deliberately calls out that the BYO path
  (below) is unaffected.
- Hero pitch:
  - Sparkle icon.
  - Headline: "Just say it. AI builds it."
  - Subcopy: "Speak naturally — Fallback AI turns it into routines, events & courses,
    each with an ideal and a fallback."
- Bullet list (3 rows), each a check-circle icon + label:
  1. "Voice-first — talk, no typing"
  2. "Drafts ideal + fallback for you"
  3. "Bulk-create a whole week at once"
- Two equal-weight choice cards (the core monetization decision for this screen — see
  note below), differentiated only by eyebrow tone and button variant, never by size
  emphasis beyond simple reading order (subscription first, matching the source's own
  ordering; BYO immediately after, with no demotion):
  - **Card A — Subscribe.**
    - Eyebrow: "SUBSCRIBE".
    - Heading: "Fallback AI Subscription".
    - Price row: "$4.99/mo" with secondary line "or $39.99/yr — save 33%".
    - `Badge`: "7-day free trial".
    - `Button` (the screen's one primary button): **"Start free trial"** → S39.
    - Fine print: "then $4.99/mo · cancel anytime · Restore Purchases".
  - **Divider** with an "or" label — signals a real fork, not a fallback link.
  - **Card B — Bring your own key.**
    - Eyebrow: "BRING YOUR OWN KEY".
    - Heading: "Use Your Own AI Key".
    - Description: "Already have an OpenAI-compatible API key? Connect it directly —
      free, no subscription. Your key stays on this device; calls go straight to your
      provider, never through Fallback's servers."
    - Two bullets: "Free — no subscription required" · "Works with OpenAI, Groq, local
      models & more".
    - `Button` (`secondary` variant): **"Use Your Own AI Key"** → S40.
    - Fine print: "If your endpoint can't transcribe audio, voice degrades gracefully
      to text."
- Footer disclosure: "While subscribed, your conversation messages are processed by
  our AI provider to generate responses — separate from your habit data, which never
  leaves this device."

## States
- **Default.** Both cards fully interactive as described.
- **Store unreachable (F17-side only).** Store-connectivity banner shown; Card A's
  "Start free trial" button renders `disabled` (no hue change per Button rules) with
  its fine print swapped to "Store unavailable — try again shortly." **Card B is
  entirely unaffected** — BYO requires no store connection, which the banner copy
  states explicitly. This is the concrete, testable expression of "equal alternative":
  a subscription-blocking outage never blocks the BYO path.
- **Loading (first paint).** Skeleton blocks for the hero icon, headline, and both
  cards while any entitlement/store-product check resolves; bullets render immediately
  (static copy, no dependency).
- **Empty/error beyond store-unreachable.** N/A — this screen has no list/data
  dependency beyond the store-connectivity check above.

## Interactions
- Tap back chevron → S31, no side effect.
- Tap "Start free trial" → S39 (Choose Plan & Confirm).
- Tap "Use Your Own AI Key" → S40 (BYO AI Key Setup).
- Tap "Retry" on the store banner → re-checks store connectivity; success dismisses the banner and re-enables Card A.
- Tap "Restore Purchases" (fine print under Card A) → triggers the platform's native restore flow with no login; success routes to S32 if an active entitlement is found, otherwise a calm toast: "No active subscription found." This navigation edge, S38 → S32, scoped solely to a successful Restore Purchases outcome, is formally part of SITEMAP.md's S38 entry per Decision 20 (S38's Leads-to set includes S32; S32's Reached-from set includes S38) — no other S38 behavior changes.
- Screen reader: hero headline is a heading; each card is grouped as a labeled region ("Subscribe to Fallback AI" / "Use your own AI key") so VoiceOver/TalkBack users hear the fork clearly as two comparably-weighted options, not a primary action plus an afterthought link.

## Responsive
- Phones-only ship target (DESIGN.md Rule 14); desktop is review convenience only, with no committed desktop layout.

## Copy (verbatim pitch from IDEA.md Flow 6.1, blended with the PRD's BYO addition)
- Headline: "Just say it. AI builds it."
- Subcopy: "Speak naturally — Fallback AI turns it into routines, events & courses, each with an ideal and a fallback."
- Bullets: "Voice-first — talk, no typing" / "Drafts ideal + fallback for you" / "Bulk-create a whole week at once"
- Card A CTA + fine print: "Start free trial" · "then $4.99/mo · cancel anytime · Restore Purchases" (source's exact trailing clause, split across button + fine print rather than one run-on CTA string, since this screen now has two CTAs, not one)
- Card B (new, PRD-directed BYO copy — no IDEA.md precedent since Flow 6 is pure-subscription): "Use Your Own AI Key" / "Already have an OpenAI-compatible API key? Connect it directly — free, no subscription. Your key stays on this device; calls go straight to your provider, never through Fallback's servers."
- Store-unreachable banner: "Can't reach the App Store right now. Your own AI key still works — no store connection needed."
- Footer disclosure: "While subscribed, your conversation messages are processed by our AI provider to generate responses — separate from your habit data, which never leaves this device."

## Placement note (monetization decision, binding for this build)
BYO is rendered as a **second, structurally identical card** to the subscription card — separated by an explicit "or" divider, not tucked into fine print or a ghost/text link under the subscription CTA. The only asymmetries are (a) reading order (subscription first, matching source Flow 6's own framing as the "front door"), (b) Card A's button uses the screen's one `primary` Button per DESIGN.md's "one primary per screen" component rule, while Card B's button uses the `secondary` variant (still a full-size, high-contrast filled button, never a ghost/link), and (c) Card A's eyebrow tone vs. Card B's neutral eyebrow tone. Nothing about Card B's copy depth or tap target is reduced relative to Card A. This directly implements the PRD's explicit instruction that BYO is "an equal alternative to paying," while still respecting the design system's one-primary-button constraint.

---

# S39 — Choose Plan & Confirm    route: /assistant/paywall/plan
Features: F17

## Contents

- Back IconButton → destination-aware: returns to whichever screen presented S39 —
  **S38** (Paywall) if this screen was reached via "Start free trial," or **S44**
  (Manage Subscription) if reached via "change plan" — per SITEMAP.md's declared S39
  Reached-from: S38, S44. No charge/side effect either way.
- Title: "Choose your plan".
- Plan cards (2, single-select — Radio semantics, Card-shaped). Selected state shows a
  filled accent Radio dot; unselected state shows an outline-only Radio dot. Full row
  is tappable, not just the dot.
  1. **Annual** (default-selected on entry — the incentivized plan):
     - `Badge`: "SAVE 33%".
     - Title: "Annual".
     - Price: "$3.33/mo", then "billed yearly".
     - Strike-through secondary line: "$59.88" → "$39.99/yr".
  2. **Monthly**:
     - Title: "Monthly".
     - Price: "$4.99/mo", then "billed monthly".
- Shared subcopy: "7 days free, then auto-renews. Cancel anytime."
- Confirm `Button` (`primary`) containing a platform-native biometric glyph + label:
  - **iOS:** Face ID glyph + "Confirm with Face ID".
  - **Android:** fingerprint glyph + "Confirm with fingerprint" (Android's
    `BiometricPrompt` — device/OS decides the exact modal chrome; this button is the
    app-side trigger, not a custom biometric UI).
- Fine print: "Payment will be charged to your [Apple ID / Google Play] account at
  confirmation. Auto-renews unless cancelled at least 24 hours before the trial ends.
  Manage or cancel anytime in [App Store / Google Play] Settings."

## States
- **Default.** Annual pre-selected, Monthly available, Confirm enabled.
- **Plan switching.** Tapping the unselected card moves the selection instantly (no confirmation step needed to merely select).
- **Verifying (post-tap-Confirm).** Confirm button shows a spinner + "Verifying…" (`aria-busy`), inputs/cards become non-interactive; the platform's own biometric system UI is what the user actually authenticates against — this state is the app waiting on that OS-level result, not a custom biometric prompt.
- **Success.** Confirm resolves → brief in-place success acknowledgment ("Trial started — 7 days free 🎉") before navigating to S32; entitlement now active.
- **Biometric failed / cancelled (calm, non-punitive).** Stays on S39; verifying state clears back to default; a calm inline banner appears: "Face ID didn't recognize you — try again, or use your device passcode." No charge occurs; plan selection is preserved.
- **Store/purchase error** (e.g., payment method issue, network drop mid-purchase). Stays on S39; `InlineRetryBanner`, warning tone (never `--state-error` red per PRD non-punitive NFR): "Couldn't complete the purchase. Nothing was charged — try again." Ghost "Retry" button re-attempts Confirm.
- **Loading (first paint).** Skeleton for both plan cards while store product pricing hydrates (defensive — in practice prices are static per F17, but the store connection itself may need a first read).

## Interactions
- Tap a plan card → selects it (single-select, radio behavior); the other deselects.
- Tap "Confirm with Face ID" / "Confirm with fingerprint" → invokes the OS-native biometric mechanism (Face ID / Touch ID on iOS, Android `BiometricPrompt`) as the store-purchase confirmation gate; on success, completes the store purchase/trial start and navigates to S32; on failure/cancel, returns to S39's default state with a calm retry affordance, never a punitive/red treatment.
- Tap back chevron → returns to the originating screen: **S38** if entered from the paywall pitch's "Start free trial," or **S44** if entered from Manage Subscription's "change plan" (SITEMAP.md S39 Reached-from: S38, S44); plan selection discarded, no charge in either case.
- Screen reader: each plan card is a radio-role element announcing "Annual, save 33%, $3.33 a month billed yearly, selected/not selected" (and equivalent for Monthly); the Confirm button announces its biometric method by platform.

## Responsive
- Phones-only ship target (DESIGN.md Rule 14); desktop is review convenience only, with no committed desktop layout. The primary mockup renders the iOS Face ID variant; the Android fingerprint variant is included as a toggle in the mockup for reviewer comparison, not a second shipped screen.

## Copy (verbatim, IDEA.md Flow 6.2)
- Header: "Choose your plan"
- Annual: "$3.33/mo billed yearly" · "$59.88" (struck through) → "$39.99/yr" · "SAVE 33%"
- Monthly: "$4.99, billed monthly"
- Shared: "7 days free, then auto-renews."
- Confirm (iOS): "Confirm with Face ID"
- Confirm (Android, PRD-directed platform-parity equivalent, no direct IDEA.md source string): "Confirm with fingerprint"
- Biometric-failure banner (PRD-directed, non-punitive framing; no IDEA.md source string): "Face ID didn't recognize you — try again, or use your device passcode."
- Purchase-error banner (PRD-directed non-punitive framing): "Couldn't complete the purchase. Nothing was charged — try again."

---

# S40 — BYO AI Key Setup    route: /assistant/paywall/byo
Features: F18

## Contents

- Back IconButton → S38, no side effect.
- Title: "Use Your Own AI Key".
- Intro: "Connect any OpenAI-compatible endpoint — OpenAI, Groq, a local model server,
  or another provider. Your key is stored only on this device; requests go straight to
  your provider, never through Fallback's servers."
- Form (2 fields, `Input` component):
  1. **API base URL**
     - Label: "API base URL".
     - `Input`, placeholder "https://api.openai.com/v1".
     - Helper (default): "The base URL of an OpenAI-compatible chat-completions API."
  2. **API key**
     - Label: "API key".
     - `Input` type password, placeholder "sk-…", with an eye/eye-off IconButton toggle
       to reveal/mask.
     - Helper (default): "Stored only on this device — never sent anywhere but your
       provider."
- Primary action: `Button` **"Save & Connect"**.
- Inline result area (conditional, see States): renders one of nothing (default), an
  error state under the fields (Input `error` treatment), a success banner, or a calm
  degraded-success banner. See States for exact per-state content.

## States
- **Default (empty).** Both fields empty, helper text as above, button enabled but a no-op tap re-triggers validation against empty fields (see Invalid below) — no separate "disabled while empty" treatment, since a blank submit is itself a validation case, not a distinct UI mode.
- **Filled, unvalidated.** Fields carry user input; no error/success shown yet — validation only runs on "Save & Connect".
- **Validating (loading).** Button shows an inline spinner + "Connecting…" (`aria-busy`), both fields render `disabled` for the duration of the check.
- **Invalid / unreachable endpoint (calm, non-punitive — never full-screen red, per PRD NFR).** Stays on S40. Both `Input`s switch to `error` state (the standard reserved-for-validation-failures treatment, not a full-screen treatment): "Couldn't verify this endpoint. Double-check the URL and key, then try again." Button reverts to its default enabled label. Fields retain the user's typed values (never cleared on failure).
- **Success — full capability.** The endpoint validates for both chat/completion and transcription. A `Toast`/banner, `success` tone, replaces the inline error area: "Connected — you're all set." with a subline "Taking you to Fallback AI…", then navigates to S32 after a brief calm pause (~600ms, respects reduced-motion by skipping the delay-animation, not the delay itself).
- **Success — degraded (text-only).** The endpoint validates for chat/completion but transcription is unsupported or fails its check. This is a **save-time detection outcome, not a question asked of the user on this screen** — the screen never asks the user to declare whether their endpoint supports voice; it tests and reports the result. Banner, `warning` tone (calm, not `error` — this is a capability note, not a failure): "Saved — this endpoint doesn't support voice, so you'll type instead. You can switch modality anytime in the assistant." Then navigates to S32 (key is saved; assistant will present in text-only mode for this key). If transcription support is ambiguous rather than cleanly detectable at save time, the same graceful-degradation framing may instead surface on first voice-attempt inside S32/S37 rather than blocking here — either point is acceptable per F18; this screen must never block a save merely because transcription capability is uncertain.

## Interactions
- Tap "Save & Connect" → validates base URL + key against the endpoint (a lightweight chat-completion probe) and, opportunistically, transcription capability:
  - Both fail or completion fails → **Invalid** state (stays on S40).
  - Completion succeeds, transcription succeeds → **Success — full** → S32.
  - Completion succeeds, transcription fails/unsupported → **Success — degraded** → S32 (text-only mode noted).
- Tap the eye/eye-off icon → toggles API key field between masked and plaintext display; does not affect validation.
- Tap back chevron → S38, no changes saved.
- Screen reader: field errors are announced via `aria-describedby` linking each `Input` to its error helper text the moment it appears; the success/degraded banners are `aria-live="polite"` regions so the outcome is announced without stealing focus mid-navigation.

## Responsive
- Phones-only ship target (DESIGN.md Rule 14); desktop is review convenience only, with no committed desktop layout.

## Copy
- Title: "Use Your Own AI Key"
- Intro: "Connect any OpenAI-compatible endpoint — OpenAI, Groq, a local model server, or another provider. Your key is stored only on this device; requests go straight to your provider, never through Fallback's servers."
- Field 1 label/placeholder/helper: "API base URL" / "https://api.openai.com/v1" / "The base URL of an OpenAI-compatible chat-completions API."
- Field 2 label/placeholder/helper: "API key" / "sk-…" / "Stored only on this device — never sent anywhere but your provider."
- Button: "Save & Connect" (default) / "Connecting…" (loading)
- Invalid: "Couldn't verify this endpoint. Double-check the URL and key, then try again."
- Success (full): "Connected — you're all set." / "Taking you to Fallback AI…"
- Success (degraded): "Saved — this endpoint doesn't support voice, so you'll type instead. You can switch modality anytime in the assistant."

---

# S41 — Settings Home    route: /settings
Features: F8, F13, F14, F17, F19, F20, F21, F25

## Contents

- IconButton back chevron → S09.
- Title "Settings".
- Profile summary Card:
  - Avatar showing initial "M".
  - Name: "Maya".
  - Subline: "Level 7 · Consistent" — plain text, no MilestoneBadge here (DESIGN.md restricts the gold treatment to F13/F29/F30/F31 screens only — S41 is not one of them).
  - Stat: "87% showing up" — a computed statistic (per DESIGN's ConsistencyBreakdownBar numeral rule).
  - The whole card is tappable → S25 (Consistency Dashboard).
- Grouped settings list — five Cards, each a labeled section of rows (Lucide icon + label + optional trailing status Badge/dot + chevron):
  1. **"Progress & Achievements"**
     - "Badges" → S27
     - "Records" (subcopy "Weekly & monthly recaps") → S29
  2. **"Preferences"**
     - "Notifications" (trailing Badge, neutral tone: "On" or "Off", reflecting F14's master toggle) → S42
     - "Theme & accent" (trailing swatch showing the user's current accent) → S43
     - "Widgets" → S46
  3. **"Fallback AI"**
     - "Fallback AI subscription" (trailing Badge: "Active", or "Free") → S44
     - "Conversation history" → S34
  4. **"Account & Data"**
     - "Account & sync" → S45
     - "Data" → S47
  5. **"Support"**
     - "Help & about" → S49

## States
- **default** — as above; every row is a static navigational entry (no per-row loading beyond the profile stat).
- **loading (first paint)** — Skeleton avatar + two Skeleton text bars in the profile card, Skeleton rows for the list; resolves near-instantly since this reads only local settings + a cached F5 stat.
- **error** — only the profile card's stat line can fail to read (F5 dependency); on failure it's replaced in place by an `InlineRetryBanner`-style single line: "Couldn't load your stats" + ghost "Retry". The rest of the settings list (all static navigation) remains fully usable regardless.
- **empty (new user)** — profile card renders "Level 1 · Getting started" and "no data yet" (F5's own empty-state string, never "0%"); all list rows still present and tappable — Settings Home has no "blank" state, since its rows are fixed navigation, not a data list.

## Interactions
- Tap profile card → F5 dashboard, state change: navigate to S25.
- Tap "Badges" row → navigate to S27.
- Tap "Records" row → navigate to S29.
- Tap "Notifications" row → navigate to S42.
- Tap "Theme & accent" row → navigate to S43.
- Tap "Widgets" row → navigate to S46.
- Tap "Fallback AI subscription" row → navigate to S44.
- Tap "Conversation history" row → navigate to S34.
- Tap "Account & sync" row → navigate to S45.
- Tap "Data" row → navigate to S47.
- Tap "Help & about" row → navigate to S49.
- Tap back chevron → navigate to S09.
- Screen reader: each row is a single-tap navigation button labeled "<row label>, opens <section name>"; the profile card announces as one composite button ("Maya, Level 7, Consistent, 87% showing up, opens your progress").

## Responsive
- Phones-only per PRD; desktop is review-only (phone-frame review convention), not a shipped breakpoint.

## Copy (IDEA.md Flow 11.1 verbatim, plus sitemap-driven section additions for S29/S34 edges)
- Header: "Settings"
- Profile: "Maya" / "Level 7 · Consistent" / "87% showing up"
- Section labels: "Progress & Achievements", "Preferences", "Fallback AI", "Account & Data", "Support"
- Rows: "Badges", "Records", "Notifications", "Theme & accent", "Widgets", "Fallback AI subscription", "Conversation history", "Account & sync", "Data", "Help & about"
- Status badges: "On" / "Off" (Notifications), "Active" / "Free" (Fallback AI subscription)

---

# S42 — Notifications Settings    route: /settings/notifications
Features: F14

## Contents

- Header — back chevron → S41, title "Notifications".
- Master toggle Card:
  - Switch row: label "Notifications" + Switch. Subcopy while on: "Reminders and encouragement, on your terms."
- Reminders Card (section label "Reminders") — visible whenever the master switch is on:
  - Switch rows: "Routine due", "Event starting", "Course dose", "Course ending soon".
- Encouragement Card (section label "Encouragement") — visible whenever the master switch is on:
  - Switch rows: "Gentle re-entry", "Milestone reached".
- Daily digest Card:
  - Switch row: "Daily digest".
  - When on: a time picker Select appears, default "8:00 AM".
- All-off empty state — has two distinct renderings depending on which of the two "fully off" triggers is active (this distinction is the fix for a prior dead-end defect: the empty state must never remove the controls a user needs to leave it):
  - **Trigger A — the master switch itself is off.** The EmptyState *replaces* the Reminders/Encouragement/Daily-digest sections entirely. This is safe because the master switch row (always visible) is itself the only control needed to leave this state — turning it on brings every section back.
  - **Trigger B — the master switch is on, but every individual sub-toggle (all Reminders, all Encouragement, and the digest) is off.** The Reminders/Encouragement/Daily-digest sections **stay fully visible and switchable** (every row rendered in its off position); the EmptyState renders as an additional informational banner, not in place of them. This is what lets a user actually act on the empty state's own promise ("turn on just the ones you want") without ever touching the master switch.
  - `EmptyState`: bell-off Lucide icon, headline "No notifications set", subcopy "You won't get reminders or nudges. You can turn on just the ones you want, anytime."

## States
- **default (some notifications on)** — master on, sections rendered, each sub-toggle independently switchable.
- **empty, master off (Trigger A)** — sections hidden, EmptyState alone shown; master switch row stays visible/toggleable.
- **empty, master on / all subs off (Trigger B)** — sections remain visible (every switch shown, off), EmptyState banner also rendered; toggling any single sub-switch back on immediately hides the EmptyState banner and returns to default, live, no navigation. Same rendered EmptyState copy as Trigger A — only whether it replaces or coexists with the sections differs.
- **loading (first paint)** — Skeleton switch rows while the persisted toggle state hydrates from the local store.
- **error (persist failure)** — a toggle reverts to its prior state with a `warning`-tone Toast: "Couldn't save — try again." Never a false "saved."

## Interactions
- Tap master Switch → on: reveals Reminders/Encouragement/Daily-digest sections; off: collapses to the empty-state copy, replacing the sections (Trigger A — master switch itself remains visible and re-toggleable, the sole path back).
- Tap any Reminders/Encouragement/Daily-digest sub-Switch → persists immediately (F1); if this action results in every sub-toggle being off while the master stays on, the EmptyState banner appears live while the sections stay visible and switchable (Trigger B — no navigation, no controls hidden, same screen); toggling any sub back on removes the banner immediately.
- Tap "Daily digest" Switch → reveals/hides the time-picker Select; also re-evaluates the Trigger B condition (digest counts as a sub-toggle for "all off" purposes).
- Tap the time-picker Select → opens the native time selection (mockup: a `<select>` of common times).
- Tap back chevron → navigate to S41.
- Screen reader: each Switch announces its label + current state ("Routine due, on/off, toggles routine-due reminders"); the empty-state region announces as a single informational block, not a control, in both Trigger A and Trigger B.

## Responsive
- Phones-only per PRD; desktop is review-only (phone-frame review convention), identical content.

## Copy (IDEA.md Flow 11.2–11.3, verbatim)
- Title: "Notifications"
- Master row label: "Notifications"
- Master-on subcopy: "Reminders and encouragement, on your terms."
- Reminders rows: "Routine due", "Event starting", "Course dose", "Course ending soon"
- Encouragement rows: "Gentle re-entry", "Milestone reached"
- Digest row: "Daily digest"
- Empty state: "You won't get reminders or nudges. You can turn on just the ones you want, anytime."
- Error toast: "Couldn't save — try again."

---

# S43 — Theme & Accent    route: /settings/theme
Features: F8

## Contents

- Header — back chevron → S41, title "Theme & accent".
- Theme selector Card:
  - Label "Appearance".
  - Three selectable options: "Light" / "Dark" / "Auto" — selected state shows a check icon.
- Accent picker Card:
  - Label "Accent color".
  - Four swatch circles from the **closed accent palette** (DESIGN.md, no others permitted): Forge Orange (default), Indigo, Berry, Plum. Selected swatch shows a check glyph.
  - Helper copy: "Accent only recolors CTAs & progress — never the signal colors."
- Live preview Card — the proof of the accent-immune signal rule:
  - A task Card mock: name "Morning workout" + meta "Full workout · 7:00 AM".
  - Four `StateChip`s, each labeled with a small caption: **Done/Ideal** (check icon), **Fallback** (half-check icon), **Skip** (x icon), **Off** (`OffDayToggle` on). These signal fills are hard-coded to the signal tokens and do **not** react to the accent/theme controls.
  - A primary `Button` "Log fallback" and a `ProgressRing`/bar reading "3 of 5 done today", both filled in the accent — these two visibly recolor live when a different swatch is tapped.
  - Caption: "Signal colors (ideal, fallback, off, missed) never change with your accent." (Deliberately scoped to accent only — DESIGN.md assigns different signal hexes per theme by design, so no theme-invariance claim is made here or anywhere else on this screen.)

## States
- **default** — Auto theme + Forge Orange accent pre-selected (DESIGN.md defaults).
- **live-update** — tapping a theme option or accent swatch applies immediately, app-wide (F8 "applies app-wide immediately"); the preview re-renders with no page transition.
- **persist failure** — selection reverts to the prior theme/accent with a `warning`-tone Toast: "Couldn't save — try again."
- **loading (first paint)** — brief Skeleton swatch row (settings read is local/instant, so this is momentary).

## Interactions
- Tap "Light" / "Dark" / "Auto" → sets theme immediately (persists via F1); "Auto" additionally tracks the OS theme live thereafter.
- Tap an accent swatch → sets the accent (and its dependent accent-hover/focus-ring) immediately; the preview's Button and ProgressRing recolor, the four StateChips do **not**.
- Tap back chevron → navigate to S41.
- Screen reader: theme options announce as a 3-option radio group ("Appearance, Auto selected"); accent swatches announce as a 4-option radio group by color name ("Accent color, Forge Orange selected"); the preview announces as a non-interactive illustrative example, not a control.

## Responsive
- Phones-only per PRD §5; desktop is review-only (phone-frame review convention), no desktop-specific multi-column reflow.

## Copy (IDEA.md Flow 11.4, verbatim)
- Title: "Theme & accent"
- "Light" / "Dark" / "Auto"
- "Accent color"
- Helper: "Accent only recolors CTAs & progress — never the signal colors."
- Preview task name: "Morning workout" / meta: "Full workout · 7:00 AM"
- Preview CTA: "Log fallback"
- Preview stat: "3 of 5 done today"
- Preview caption: "Signal colors (ideal, fallback, off, missed) never change with your accent."

---

# S44 — Manage Subscription    route: /settings/subscription
Features: F17

## Contents

- Header — back chevron → S41, title "Manage subscription". *(Note: this screen is also reached from S36 — the Assistant Options Menu — but per SITEMAP its only Leads-to edge is S41/S39; the back chevron always returns to S41 regardless of entry point. This is a deliberate simplification, not an oversight — flagged here for the builder.)*
- Plan status Card:
  - Status `Badge`: "Active" (subscribed) or "Free plan" (not subscribed).
  - Plan line: "Fallback AI · Monthly" or "Fallback AI · Annual".
  - Renewal/trial line: "Renews Aug 20" (active), or "Trial ends in 3 days, then $4.99/mo" (in trial), or, if unsubscribed: "You're on the free plan. Free tier keeps every core feature — Fallback AI is optional."
- Change plan Card — shown only when subscribed or in trial:
  - Segmented control: "Monthly · $4.99/mo" / "Annual · $39.99/yr · Save 33%".
  - `Button` "Confirm change" → S39 (Choose Plan & Confirm, for the platform-native biometric purchase confirmation).
- Cancel & manage via store Card — fulfills SITEMAP's "cancel" primary action; see "Note on scope" below:
  - Label: "Cancel subscription".
  - `Button`: "Manage in App Store" (iOS) / "Manage on Google Play" (Android) — platform-adaptive label, same component. This button is the sole realization of cancellation: it hands off to the platform's native subscription-management surface, where the store itself presents the actual Cancel control.
  - Helper copy: "Billing is handled by Apple/Google Play. Cancel anytime — access lasts through the paid period."
- Restore purchases Card:
  - `Button` "Restore purchases".
  - Helper: "Re-checks your store account for an active subscription — no sign-in needed."
- Start trial (alternate of "Change plan," shown only when on the free plan):
  - `Button` "Start free trial" → S39.

## States
- **subscribed-active** — plan status shows current plan + renewal date; Change-plan segment shows the *other* plan as the switchable option.
- **trial-active** — plan status shows trial countdown + post-trial price.
- **free / not-subscribed** — plan status shows the free-tier framing line; "Change plan" region replaced by "Start free trial" CTA.
- **restore-result** — Toast `success` "Restored — Fallback AI is active" or Toast `neutral` "No active subscription found on this account."
- **loading (first paint)** — Skeleton plan card while the store entitlement check resolves.
- **error (store read/purchase failure)** — calm `InlineRetryBanner`, `warning` tone: "Couldn't reach the store — try again," ghost Retry; never a full-screen failure (network-dependent per PRD §5 NFR).

## Interactions
- Tap Monthly/Annual segment → selects the target plan (selection only, no charge yet).
- Tap "Confirm change" → navigate to S39 to finalize via the platform's native biometric confirmation.
- Tap "Start free trial" (free-tier state) → navigate to S39.
- Tap "Manage in App Store"/"Manage on Google Play" → hands off to the platform's native subscription-management surface, where the user finds the actual cancel control (mockup: Toast "Opens the App Store" — this leaves the app in the shipped product).
- Tap "Restore purchases" → re-checks entitlement, shows the restore-result Toast.
- Tap back chevron → navigate to S41.

## Responsive
- Phones-only per PRD; desktop is review-only (phone-frame review convention).

## Copy (IDEA.md Flow 11.5 + F17, verbatim)
- Title: "Manage subscription"
- "Fallback AI · Active"
- "Monthly · $4.99/mo" / "Annual · $39.99/yr · Save 33%"
- "Cancel subscription"
- "Manage in App Store" / "Manage on Google Play"
- "Billing is handled by Apple/Google Play. Cancel anytime — access lasts through the paid period."
- "Restore purchases" / "Re-checks your store account for an active subscription — no sign-in needed."
- Free-tier framing: "You're on the free plan. Free tier keeps every core feature — Fallback AI is optional."

## Note on scope (deliberate placement decision)
SITEMAP.md lists "cancel" as one of this screen's three primary actions
("change plan, cancel, restore purchases"). Store-billed subscriptions on
both iOS and Android are cancelled exclusively through the platform's own
subscription-management surface — Fallback has no in-app cancellation API
to call instead, and F17's billing model is explicitly "handled by the
store." SITEMAP's "cancel" primary action is therefore deliberately
fulfilled by the "Manage in App Store"/"Manage on Google Play" row
(labeled with its own "Cancel subscription" heading so the action isn't
implicit) rather than by a separate in-app "Cancel" control that would
just re-route to the identical store surface. This mirrors the standard
S45 sets for declared scope deviations from IDEA/SITEMAP groupings.

---

# S45 — Account & Sync    route: /settings/sync
Features: F20

## Contents

- Header — back chevron → S41, title "Account & sync". *(Also reached from S36; back always returns to S41, matching SITEMAP's Leads-to edge — same convention as S44.)*
- No-login explainer Card:
  - Icon (Lucide `shield-check`).
  - Headline "No login.".
  - Body: "Your data lives on this device — no account to create or password to lose."
- Storage Card:
  - Row: "On-device (default)" — a static, non-toggleable description confirming local storage is always the baseline, with a small check/lock glyph (never a Switch — it's not an optional setting).
  - Switch row: "iCloud sync" (iOS) / platform-equivalent label — **off by default** (F20 "opt-in, off by default").
    - When **on**: status line "Last synced 2 min ago."
    - When **off**: helper line "Your data stays only on this device."
- Sync failure (conditional, only rendered when sync is on and a sync attempt fails):
  - `InlineRetryBanner`, `warning` tone (never `error`/red — non-destructive, best-effort tier per F20): "Couldn't sync right now. Your data is safe on this device — we'll try again automatically."

## States
- **sync-off (default)** — Switch off, "Your data stays only on this device" shown.
- **sync-on, healthy** — Switch on, "Last synced 2 min ago" shown, refreshing periodically.
- **sync-on, failed** — Switch stays on (local data untouched/authoritative on conflict per F20), the InlineRetryBanner renders instead of the "Last synced" line.
- **loading (first paint)** — Skeleton row while the sync-enabled flag hydrates from local settings.

## Interactions
- Toggle "iCloud sync" Switch on → persists (F1); after a brief simulated sync, status updates to "Last synced just now."
- Toggle "iCloud sync" Switch off → immediately reverts to on-device-only framing; no data is lost (F20 local-authoritative).
- Tap back chevron → navigate to S41.
- Screen reader: Switch announces "iCloud sync, on/off"; the explainer and storage rows announce as static informational text, not controls.

## Responsive
- Phones-only per PRD; desktop is review-only (phone-frame review convention).

## Copy (IDEA.md Flow 11.6, verbatim)
- Title: "Account & sync"
- "No login."
- "Your data lives on this device — no account to create or password to lose."
- "On-device (default)"
- "iCloud sync"
- "Last synced 2 min ago"
- Off-state helper: "Your data stays only on this device."
- Failure: "Couldn't sync right now. Your data is safe on this device — we'll try again automatically."

## Note on scope (deliberate placement decision)
IDEA.md's Flow 11.6 groups "Restore purchases" under Account & Sync. **SITEMAP.md explicitly assigns Restore Purchases to S44 (Manage Subscription)** as one of that screen's three primary actions ("change plan, manage/cancel via the store, restore purchases"). Per this batch's brief, SITEMAP/PRD scope wins over IDEA's grouping — Restore Purchases is **not** duplicated on this screen; S45 covers only the no-login explainer and the on-device/cloud-sync toggle.

---

# S46 — Widgets    route: /settings/widgets
Features: F21

## Contents

- Header — back chevron → S41, title "Widgets".
- Gallery — three tappable Cards, one per widget size:
  1. **"Small · Today"** — a miniature widget-frame preview showing "3/5 done" + a small ProgressRing.
  2. **"Small · One task"** — miniature preview showing a single task name + its `StateChip`.
  3. **"Medium · Up next"** — miniature preview showing the next 2 tasks with times.
  - Each gallery card has a trailing chevron; tapping expands that widget's **configuration panel** (accordion — only one panel open at a time).
- Widget configuration panel (for the selected gallery card):
  - Radio group: **"Fixed task"** vs **"Smart — next due"**.
    - "Fixed task" selected → reveals a `Select` listing the user's tasks (e.g. "Morning workout," "Meditate," "Read").
    - "Smart — next due" selected → hides the task Select, shows helper copy: "Always shows whichever task is due soonest."
  - `Button` "Save" (per-widget, confirms the configuration for that specific widget size).
- Footer note:
  - "Widgets refresh automatically and always match your current theme and accent."

## States
- **gallery-default** — no panel expanded, all three previews shown collapsed.
- **widget-selected** — one widget's config panel expanded (e.g. "Small · Today"), showing its current Fixed-task/Smart setting.
- **saved** — Toast `success`: "Widget updated."
- **persist failure** — calm `InlineRetryBanner`/Toast `warning`: "Couldn't save — try again," selection reverts to prior value.
- **loading (first paint)** — Skeleton gallery cards while per-widget config hydrates from local settings.

## Interactions
- Tap a gallery card → expands its config panel; tapping an already-open card collapses it; tapping a different card collapses the previous one and opens the new one.
- Tap "Fixed task" radio → reveals the task-picker Select.
- Tap "Smart — next due" radio → hides the task-picker Select, shows the helper line.
- Tap the task Select → choose a specific task (mockup: native-style dropdown).
- Tap "Save" → persists that widget's config, shows the success Toast.
- Tap back chevron → navigate to S41.
- Screen reader: each gallery card announces as an expandable section ("Small · Today widget, collapsed/expanded"); the radio group announces as a 2-option single-select.

## Responsive
- Phones-only per PRD; desktop is review-only (phone-frame review convention); mirrors the real single-column widget gallery on-device — no shipped desktop grid.

## Copy (IDEA.md Flow 11.7–11.8, verbatim)
- Title: "Widgets"
- "Small · Today" / "3/5 done"
- "Small · One task"
- "Medium · Up next" (next 2 tasks)
- Config options: "Fixed task" / "Smart — next due"
- Smart helper: "Always shows whichever task is due soonest."
- Footer: "Widgets refresh automatically and always match your current theme and accent."
- Save confirmation: "Widget updated."

---

# S47 — Data    route: /settings/data
Features: F19, F25

## Contents

- Header — back chevron → S41, title "Data".
- Backup Card:
  - `Button` "Back up now".
  - Subcopy: "Last backup: Jul 14, 2026 at 9:12 AM" — or, if none yet, "No backup yet."
- Restore Card:
  - `Button` "Restore from backup".
  - Subcopy: "Choose a backup file saved on this device."
  - **Inline failure state (conditional)** — an `InlineRetryBanner`, `warning` tone, shown with the restore row when a restore attempt fails: "We couldn't read the backup file. Your current data is untouched — nothing was overwritten." + ghost "Try a different file" and a dismiss affordance.
- Erase all data Card — a different class of action (not styled as an alarming block, per Rule 3's "danger button, calm copy"):
  - Row: "Erase all data" (trailing chevron) → S48.
  - Subcopy: "Permanently remove everything from this device."

## States
- **default** — backup/restore idle; last-backup timestamp shown (or "No backup yet" for a fresh install).
- **backup-in-progress** — "Back up now" Button shows its `loading` state (spinner, `aria-busy`, label preserved, not disabled-styled).
- **backup-success** — Toast `success`: "Backed up — Jul 16, 2026 at 8:03 AM"; the "Last backup" subcopy updates to match.
- **restore-in-progress** — "Restore from backup" Button shows its `loading` state.
- **restore-failure** — the inline failure banner described above renders with the Restore card (demoed via a toggle in the mockup).
- **restore-success** — Toast `success`: "Restored — your data is back."
- **erase entry always available** — the "Erase all data" row is present and tappable even on an already-empty store (F25's "erase on an already-empty store → no-op landing at the empty state, never an error").

## Interactions
- Tap "Back up now" → begins a local backup write → on success, updates the timestamp and shows the success Toast; on failure, calm retry Toast (`warning` tone, "Couldn't back up — try again"), no partial file left behind.
- Tap "Restore from backup" → opens a local file picker (mockup: simulated) → on success, success Toast; on failure, renders the inline failure banner (existing data explicitly stated as untouched).
- Tap "Try a different file" (within the failure banner) → re-opens the file picker.
- Tap "Erase all data" row → navigate to S48, **recording S47 as the origin** so S48's Cancel returns here (SITEMAP Decision 14).
- Tap back chevron → navigate to S41.

## Responsive
- Phones-only per PRD; desktop is review-only (phone-frame review convention).

## Copy (IDEA.md Flow 11.9, verbatim)
- Title: "Data"
- "Back up now" / "Last backup: Jul 14, 2026 at 9:12 AM"
- "Restore from backup" / "Choose a backup file saved on this device"
- Failure: "We couldn't read the backup file. Your current data is untouched — nothing was overwritten."
- "Erase all data" / "Permanently remove everything from this device."

---

# S48 — Erase-All Confirmation    route: /settings/data/erase
Features: F25

> **Load-bearing behavior (SITEMAP Decision 14):** this screen has exactly ONE route but TWO possible origins — S47 (Settings → Data, a working, readable store) and S50 (Data Recovery, a corrupt/unreadable store). Its Cancel action must return to **whichever screen it came from**, never a single fixed destination. The origin must be carried as navigation state (e.g., a `from` param or the natural back-stack entry), never hardcoded. Copy also differs by origin (see below), since the two contexts imply different things are true about the user's existing data.

## Contents

A confirmation screen — chosen deliberately so it reads identically whether it arrived from a settings list (S47) or a recovery surface (S50).

- Icon: Lucide `trash-2` or `refresh-cw` (**not** an alarm/warning-triangle glyph — calm per PRD's non-punitive NFR even though the confirming button itself signals error).
- Headline — **origin-dependent**:
  - From **S47**: "Erase all data?"
  - From **S50**: "Reset app data?"
- Body — **origin-dependent**:
  - From **S47**: "Every routine, event, course, to-do — and all your history — will be permanently removed from this device. This can't be undone."
  - From **S50**: "Your data on this device couldn't be read. Resetting clears everything and starts fresh. This can't be undone."
- `Button` `danger`: "Erase everything" — same label both origins.
- `Button` `ghost`/`secondary`: "Cancel" — same label both origins, **different destination**.

## States
- **default** — rendered per origin as above.
- **erasing (loading)** — "Erase everything" shows its `loading` state (spinner, `aria-busy`, label preserved); both buttons disabled for the duration (no double-submit).
- **erase-failure (mid-wipe)** — per F25's edge case, the store is left coherent (fully erased or fully intact, never half-wiped); a calm `InlineRetryBanner`, `warning` tone: "Something went wrong erasing your data. Nothing was lost — try again." The "Erase everything" button re-enables.
- No empty/read-failure state applies — this screen has no list/data surface of its own.

## Interactions
- Tap "Erase everything" → begins the destructive wipe → on success, navigate to **S01** (fresh-install state) regardless of origin (both the S47-initiated Flow: Erase-all-data and the S50-initiated Flow: On-device-persistence-recovery destructive path land on S01 per FLOWS.md).
- Tap "Cancel" → **conditional, per origin**:
  - Arrived from S47 → navigate back to **S47** (no change made).
  - Arrived from S50 → navigate back to **S50** (the calm recovery state; the store remains unresolved — never assumed readable, never routed to S47 which presupposes a working store).
- Hardware/gesture back → identical behavior to "Cancel" (same conditional destination).
- Screen reader: headline + body announce together as a single alert region on mount (so origin-specific copy is read once, correctly, regardless of entry path); buttons labeled plainly ("Erase everything, destructive action" / "Cancel").

## Responsive
- Phones-only per PRD; desktop is review-only (phone-frame review convention), identical content.

## Copy (both origin variants, calm/non-alarmist per PRD F25 — "irreversible" stated plainly, never a red scare)
- From S47: "Erase all data?" / "Every routine, event, course, to-do — and all your history — will be permanently removed from this device. This can't be undone."
- From S50: "Reset app data?" / "Your data on this device couldn't be read. Resetting clears everything and starts fresh. This can't be undone."
- Buttons: "Erase everything" / "Cancel"
- Mid-wipe failure: "Something went wrong erasing your data. Nothing was lost — try again."

## Mockup review note
Since a static HTML mockup can't carry a real navigation history, the mockup exposes an explicit, clearly-labeled **reviewer control** ("Preview origin: Data / Recovery") that is NOT part of the shipped UI — it swaps the headline/body copy and updates a small caption ("Cancel returns to Settings → Data" / "Cancel returns to Data Recovery") so both conditional-return paths are verifiable in one file.

---

# S49 — Help & About    route: /settings/help
Features: F9

## Contents

- Header — back chevron → S41, title "Help & about". *(Also reached from S36; back always returns to S41, same convention as S44/S45.)*
- Support Card (rows):
  - "Contact support" → hands off to the device's mail app.
  - "FAQ & guides" → hands off to an external help center (no dedicated in-app screen exists in SITEMAP; this is an external link, not a numbered screen).
  - "Rate Fallback" → hands off to the platform's app-store rating prompt.
- Legal Card (rows):
  - "Privacy policy" → external.
  - "Terms of service" → external.
- Privacy framing Card (plain text block, ties this screen to F9's R20 privacy framing per SITEMAP Decision 9):
  - "No login. Your data lives on this device — no account to create or password to lose."
- Footer:
  - Version stamp: "Fallback · version 1.0.0 (build 128)"
  - Tagline: "Made with care · Something beats nothing."

## States
- **default** — all rows are static, always-present content; no data dependency, so no loading/empty states beyond the screen's own first paint.
- **link-tap feedback** — since a static build can't verify a real external hand-off, tapping any Support/Legal row shows a calm `neutral`-tone Toast ("Opening…") acknowledging the action, per the same non-network-dependent, calm-feedback convention used elsewhere.

## Interactions
- Tap "Contact support" → opens the device mail composer (mockup: Toast "Opening your email app…").
- Tap "FAQ & guides" → opens the external help center (mockup: Toast "Opening FAQ & guides…").
- Tap "Rate Fallback" → opens the platform app-store listing (mockup: Toast "Opening the App Store…").
- Tap "Privacy policy" / "Terms of service" → opens the respective external page (mockup: Toast).
- Tap back chevron → navigate to S41.
- Screen reader: each row announces as a link/button with its destination type ("Contact support, opens email"); version/tagline footer announces as static text.

## Responsive
- Phones-only per PRD; desktop is review-only (phone-frame review convention).

## Copy (IDEA.md Flow 11.10, verbatim)
- Title: "Help & about"
- "Contact support"
- "FAQ & guides"
- "Rate Fallback"
- "Privacy policy"
- "Terms of service"
- "No login. Your data lives on this device — no account to create or password to lose."
- "Fallback · version 1.0.0 (build 128)"
- "Made with care · Something beats nothing."

---

# S50 — Data Recovery    route: /recovery
Features: F1

> **Non-punitive, ship-blocking NFR (PRD §5 / §3.1 edge case):** this is the calm recovery surface for a corrupt local store detected on launch. It must **never** read as an error/crash screen — no red, no alarm iconography, no technical error text, no "your data is lost" framing, and never a crash loop. It reuses `InlineRetryBanner`'s calm visual language at full scale (DESIGN.md, explicit binding note under `InlineRetryBanner`).

## Contents

- No header, back chevron, or tab bar — there is nothing to navigate back to; the store itself is unresolved.
- Icon: Lucide `refresh-cw` (or similar calm, neutral glyph) — explicitly **not** an alert-triangle/warning glyph, **not** an error/red glyph.
- Headline: "Let's get you back on track"
- Body: "We couldn't read your data on this device. Nothing is deleted — you can try again, or reset and start fresh."
- `Button` (non-destructive, calmer of the two options): "Try again" → S01.
- `Button` (the destructive path): "Reset app data" → S48 (carries `origin=S50`).

## States
- **default** — the single, calm rendering described above. This *is* the error state, rendered permanently the same way regardless of how many prior "Try again" attempts have failed — no escalating alarm, no visible retry counter, no stack trace, ever.
- **retrying (loading)** — "Try again" shows its `loading` state (spinner, `aria-busy`) while the local store re-read is attempted; on success, unmounts and pushes S01 (which then routes onward to S02/S09 per its own rule); on failure, silently returns to the same default rendering (no new copy, no "still failing" escalation).
- **returned-from-cancelled-erase** — identical to default. Landing back here after tapping "Cancel" on S48 is not a distinct visual state — the store is still unresolved, so the same calm recovery surface is correct.
- **empty** — N/A, no list/data surface on this screen.

## Interactions
- Tap "Try again" → re-attempts the local store read (F1) → on success, navigate to S01 (which re-evaluates: first-launch → S02, returning user → S09, still corrupt → back to S50).
- Tap "Reset app data" → navigate to S48 with origin recorded as S50, so S48's Cancel returns here (not to S47, which presupposes a working, readable store — SITEMAP Decision 14).
- No other tappable elements; no swipe-to-dismiss, no back gesture (there is no prior screen to return to — this is the terminal state for an unreadable store).
- Screen reader: headline + body announce as a single calm alert region on mount (`aria-live="polite"`, not `assertive` — deliberately non-alarming); both buttons plainly labeled.

## Responsive
- Phones-only per PRD; desktop is review-only (phone-frame review convention), identical content.

## Copy
- Headline: "Let's get you back on track"
- Body: "We couldn't read your data on this device. Nothing is deleted — you can try again, or reset and start fresh."
- Buttons: "Try again" / "Reset app data"

---
