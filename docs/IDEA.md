# Fallback — App Idea

Source: `Fallback - User Flows v2.dc.html` — a complete screen-by-screen UI
flow mockup (12 flows + a states gallery), built in a design system called
"Verdant." This document transcribes the substantive content of that file
verbatim (concept, screen copy, structure) with presentational markup/CSS
stripped out. Nothing below is the orchestrator's paraphrase — where the
source gives exact copy, it's quoted exactly.

## One-line pitch

"Something beats nothing." Fallback is a habit-tracking app whose core
mechanic is that every habit/task has an **ideal** version and a **fallback**
(minimum-viable) version. Doing the fallback still counts as showing up.
There are no streaks to lose — consistency is tracked as "% of days you
showed up" (ideal or fallback), and off days are neutral, never punished.

## Masthead framing (verbatim)

> Twelve journeys covering every screen in the sitemap — onboarding, create,
> complete/fallback, AI, re-entry, subscribe, the browse tabs, task
> management, progress, permissions and settings — plus a states gallery.
> Built in the Verdant system: real components, warm surfaces, tactile
> leaf-green CTAs. Each screen is a step; each arrow is the tap or event that
> advances it.

- Primary = leaf green · CTAs & progress
- Orange = the fallback signal (reserved — never decorative)
- Consistency, not streaks
- Arrow label = the trigger (each transition is annotated with the user
  action or system event that causes it)

## Task types ("four ways to plan")

- **Routines** — recurring, day to day
- **Events** — one-off, at a set time
- **Courses** — a run with an end date (e.g. a 10-day medication course, a
  30-day challenge; can be multi-dose per day, e.g. antibiotics 2×/day)
- **To-dos & notes** — loose tasks, no schedule (marked "NEW" in onboarding)

## Design system signals

"Verdant" design system: warm surfaces (`#f4f2ee` background), leaf-green
accent for CTAs/progress, orange used exclusively as the fallback/showed-up
(fallback) signal color — never decorative. Light / Dark / Auto themes;
accent color is user-customizable but "only recolors CTAs & progress — never
the signal colors" (ideal/fallback/off-day colors stay fixed and meaningful).
Two closed tag vocabularies used everywhere: **Importance** (High / Medium /
Low) and **Necessity** (Must-do / Recommended / Optional) — "no free-form
tags to fragment the list."

## Platform signals

iOS-style chrome throughout (status bar, "9:41" mockup time, Face ID at
checkout, "Manage in App Store", Apple-handled billing, home-screen widgets,
iCloud sync option). No login/account system — "No login. Your data lives on
this device — no account to create or password to lose," with on-device
storage as default and optional iCloud sync. Strongly implies a native-feel
mobile app (iOS first, per the App Store/Face ID/widgets references).

## Monetization

Core app (routines/events/courses/to-dos, tracking, progress dashboard,
achievements) is free. "Fallback AI" — the voice-first conversational
assistant for creating/editing tasks — is a paid subscription:
- Monthly: $4.99/mo
- Annual: $39.99/yr ($3.33/mo billed yearly, "SAVE 33%", vs. $59.88 monthly-equivalent)
- 7-day free trial, cancel anytime, Restore Purchases supported, billing via Apple/App Store.

## The 12 flows + gallery (screen-by-screen, verbatim copy retained)

### Flow 1 — Onboarding
*first launch → sells the idea → first task → Today*
1. **Hook** — "Something beats nothing. Build habits that survive your worst
   days — not just your best ones." (Skip / Next)
2. **The idea — ideal + fallback** — "A plan A and a plan B for every habit."
   Example: Ideal "Full workout" / Fallback "10 pushups." "Too tired for the
   full thing? Do the fallback. You still showed up."
3. **Four ways to plan** — introduces Routines / Events / Courses / To-dos &
   notes (NEW).
4. **Consistency, not perfection** — "Every day counts — ideal or fallback."
   Sample stat: 83% / "5 of 6 days" with ideal/fallback/off-day legend. "No
   streaks to lose. We count how often you show up — a fallback still
   counts."
5. **Make it yours** — pick an accent, turn on reminders.
6. **Add your first task** — pick Routine / Event / Course / To-do; picks
   Routine, saves → lands home.
7. **Today · first habit set** — "Today, Wed, Jul 10 · your first habit is
   set 🌱" showing "Morning workout" (Full workout / 10 pushups, 7:00a) and
   the tab bar: Today / Routines / Events / Courses.

### Flow 2 — Create a task
*Today → choose a type → ideal + fallback → saved*
1. **Today · tap add** — existing tasks (Meditate/ideal, Read/fallback,
   Evening walk), taps "+".
2. **Pick a type** — Routine / Event / Course / To-do sheet; picks Routine.
3. **New routine · ideal + fallback** — Repeat (M T W T F S S), Time (7:00
   AM), Reminder, Ideal ("Full workout · 30 min"), Fallback ("10 pushups"),
   Importance (High), Necessity (Recommended), "Save routine."
4. **Today · added** — "Routine added — starts tomorrow 7:00 AM," shown on
   the Today list alongside existing tasks.

### Flow 3 — Complete vs. Fallback (the core differentiator)
*all steps done = ideal · any step left = fallback, still counts*
1. **Today · tap the task** — opens "Morning workout" (Full workout / 10
   pushups).
2. **Task · steps decide the state** — "You've shown up 5 of 6 days." Ideal
   steps (0/3: 5-min warm up, 20-min main set, cool-down stretch) vs.
   Fallback ("10 pushups — the low bar on a hard day"). Rule stated
   verbatim: "All 3 steps → logged ideal · fewer → logged fallback." "Mark
   done."
3a. **Celebrate · ideal** — "Nice — ideal done! +10 XP. That's 6 of 7 days
   you've shown up. Consistency looking strong."
3b. **Celebrate · fallback** — "You showed up 💪 +6 XP. Fallback counts.
   Your consistency holds — that's the win on a hard day."

### Flow 4 — Create with AI
*voice-first · the assistant talks back, creates tasks mid-chat & saves every
conversation · (subscription-gated)*
1. **Tap mic · idle** — "Fallback AI — What should I set up for you? Tap &
   speak — or type below." Suggestions: "Add a morning run," "Water plants
   Mon & Thu," "10-day meditation."
2. **Listening** — transcribes: "Add a workout every morning at 7, and give
   it an easy version for busy days."
3. **Assistant replies + adds it — mid-chat** — "Done — created it, with a
   fallback for the days you're slammed 🌱" → creates "Morning workout"
   (daily 7:00 AM routine; Full workout / 10 pushups). Assistant asks "Want
   to add anything else — a course, an event, a reminder?"
4. **Handles any task type — a course** — user: "Also start a 10-day
   meditation course." Assistant: "I'll ramp it 5 → 15 min over 10 days,
   with a 1-minute breathing fallback for hard days." Then asks for session
   time.
5. **Same chat, now by text** — user switches to typing mid-conversation
   ("7:30am, right after the workout" / "also remind me to call mom friday
   at 6") and the assistant keeps creating tasks (an event: "Call mom," Fri
   6:00 PM).
6. **Recap — chat saved on ✕** — "All set — here's everything from this
   chat 👇" (Morning workout, Meditation, Call mom). "Close anytime — I'll
   save this conversation so you can pick it back up. 🌱"
7. **Conversation history** — list of past chats with summaries ("Added a
   workout, a meditation course & a reminder to call mom," "Moved the
   evening dose to 9 PM," "Built 5 dinners as a 5-day course") tagged by
   modality (voice+text / voice / text) and task counts.
8. **Reopened — voice + text + tasks** — reopening a saved chat shows the
   full transcript plus the tasks it created, with a "Continue this chat…"
   input.

### Flow 4+ — Assistant: edit, clarify & recover
*same voice-first UI, not the chat view — the assistant does more than
create*
- **A. Edit an existing task by voice** — "Moved your evening meds to 9:00
  PM." with an inline "Undo" and "Say 'undo' to put it back."
- **B. Clarify — one quick check** — disambiguation when two tasks share a
  name: "You have two 'workout' tasks — which one?" (Morning workout vs.
  Evening workout, offered as tappable options or by voice.)
- **C. Mic is off — recover** — "Turn on the mic to talk... Enable the
  microphone in Settings — or just type instead." (Open Settings / Type
  instead)
- **D. Offline — gentle recovery** — "Can't reach the assistant. You're
  offline. Everything you've made is safe on this device — try again in a
  moment." (Try again / Add a task manually)
- **E. Options menu** — reachable via "⋯" from any assistant screen: New
  conversation, Conversation history, Voice & language, Manage subscription
  ("Fallback AI · renews Aug 20"), Account & sync, Help.

### Flow 5 — Missed-day re-entry
*the highest-churn moment · invitation, not loss · consistency stays intact*
1. **Nudge · invitational tone** — push notification style: "Even a little
   keeps you growing 🌱 No time for the full workout? Do the 10-pushup
   fallback and keep showing up."
2. **Re-entry · consistency intact** — "No workout yesterday — that's okay.
   Rest is part of the rhythm. One off day doesn't undo anything." Shows
   "Your consistency is intact — 84% · 26 of the last 31 days you showed up
   — ideal or fallback." CTA: "Even 10 pushups counts →"
3. **Back on track** — "You're back 🌱 Fallback · +6 XP. Those 10 pushups
   count. Consistency back up to 27 of 32 days — that's the whole point."

### Flow 6 — Subscribe to AI
*tap the mic on free plan → paywall → plan → unlocked (leads into flow 4)*
1. **Paywall · the pitch** — "Just say it. AI builds it. Speak naturally —
   Fallback AI turns it into routines, events & courses, each with an ideal
   and a fallback." Bullets: "Voice-first — talk, no typing," "Drafts ideal
   + fallback for you," "Bulk-create a whole week at once." CTA: "Start
   7-day free trial — then $4.99/mo · cancel anytime · Restore."
2. **Choose a plan** — Annual ($3.33/mo billed yearly, $59.88 → $39.99,
   "SAVE 33%") vs. Monthly ($4.99, billed monthly). "7 days free, then
   auto-renews." Confirms via Face ID.
3. **Unlocked → into flow 4** — "Trial active · 7 days free. You're in —
   what should I set up?" (drops straight into the AI create flow).

### Flow 7 — Browse the tabs
*Today · Routines · Events · Courses · the mic — every surface & its empty
state*
1. **Today · empty (first run)** — "A blank slate. Nothing planned for today
   yet. Add one small thing — something beats nothing."
2. **Routines · 2 of 4** — weekday strip (Mon–Fri), per-task ideal/fallback
   badges.
3. **Routines · empty** — "Nothing scheduled. No routines on Thursdays —
   enjoy the rest day, or add one to fill it."
4. **Events · 1 of 2** — one-offs (Dentist visit, Team dinner) plus
   read-only course-derived entries (Antibiotics · 2 days left, Course
   deadline Fri).
5. **Events · empty** — "No events today. Nothing on the calendar for
   Sunday. Schedule a one-off whenever you need to."
6. **Courses · 2 active** — Antibiotics (8/10, 2×/day, 2 days left), Spanish
   practice (day 23, ongoing).
7. **Courses · empty** — "Courses are habits with an end date — a
   medication, a 30-day challenge. Start one when you're ready."
8. **To-do / Notes lens** — segmented "To-do / Notes" pill on the same
   catch-all list; tasks carry Importance tags (e.g. "High").
9. **Filter & search** — filters by Type (Routine/Event/Course/To-do),
   Importance (High/Med/Low), Necessity (Must-do/Recommended/Optional).
10. **AI entry · voice-first** — "What should I set up? Tap & speak —
    'add a run every Mon, Wed, Fri'." Suggestions: "Plan my week," "Add a
    medication."

### Flow 8 — Manage a task
*one sheet for every change · state machine · steps · duplicate · icon ·
calendar · delete*
1. **Task detail · steps & day badges** — State chips: To do / Done /
   Fallback / Skip. "Steps set the state automatically — tap a state to
   override." Ideal steps can have different day-cadences per step (e.g.
   "Heavy lifts" only M·W·F). Row actions: Snooze to later, Move to another
   day, Delete.
2. **Lifecycle · fallback logged** — "Fallback logged — that still counts.
   You showed up today. Off days stay neutral; nothing resets." Includes
   "Mark today an off day (neutral)."
3. **Multi-dose · 1 of 2 done** — course occurrences (Antibiotics, Morning
   dose 9:00a / Evening dose 9:00p) — "Each occurrence completes on its own
   — the day counts once both are handled."
4. **Duplicate · editable copy** — "Duplicated — edit & save as new."
5. **Icon picker** — searchable icon set grouped by category (Fitness,
   Health, Work, Study) plus color.
6. **Guided create · step by step** — multi-step routine builder: name,
   Ideal task steps (add step), Fallback task, schedule (Daily/Weekly/
   Custom), times/day, reminder time.
7. **Calendar · routine heatmap** — month grid with per-day ideal/fallback/
   off coloring; monthly stat ("89% showed up, 8 of 9 days").
8. **Card style preview** — shows how the same task card renders across
   tabs ("Same card component on every tab — only the meta row changes").
9. **Delete · confirm** — "Delete this routine? '[name]' and its history
   will be removed. This can't be undone." (Delete routine / Keep it)

### Flow 9 — Progress & consistency
*the streak is retired · rewards showing up · entered from the Today stat
chip*
1. **Consistency dashboard** — Last 30 days: 87% / "26 of 30 days," broken
   into 22 ideal / 4 fallback / 4 off. "No streak to lose — off days are
   neutral, and a fallback still counts as showing up."
2. **Achievements · showing-up milestones** — Level/XP system (Level 7 ·
   "Consistent" · 620/1000 XP). Badge categories: "Showing up" (7 days, 30
   days, 50×, 200×), "Fallback wins" (Safety net / Never zero, Saved 25×,
   Comeback), "Milestones · rare" (100 done, Course ×3, Full week, 1 year).
   Tabs: All / Earned / Locked.
3. **Achievements · empty** — Level 1 · "Getting started" · 0/100 XP. "Show
   up once — ideal or fallback — and your first badge is on its way. Small
   counts."
4. **Milestone · level up (dark theme)** — "You're now Level 8. New title:
   Dependable. And you just crossed 100 tasks done — that's real
   consistency, not a lucky streak." "3 fresh badges now within reach."

### Flow 10 — First launch & permissions
*wraps around the Flow 1 tour — splash, then two primers*
1. **Splash** — "Fallback — Something beats nothing. Loading your day…"
2. **Notifications primer** — "Gentle nudges, never nagging. A quiet
   reminder when a habit is due, and one invitation back after an off day.
   That's it." Sample notification: "Time for your evening walk — Too
   tired? The fallback still counts." (Allow / Not now)
3. **Microphone primer** — "Just say what you need. The microphone powers
   the voice assistant... Audio is processed only when you tap the mic."
   "Prefer typing? You can skip — the assistant takes text too." (Enable /
   Not now)

### Flow 11 — Settings & system
*profile, notifications, theme, subscription, account, widgets, data, help,
design-system ref*
1. **Settings** — profile summary (Maya, Level 7 · Consistent · 87%),
   entries: Badges, Notifications (On), Theme & accent, Widgets, Fallback AI
   subscription (Active), Account & sync, Data, Help & about, Design system
   (internal/DEBUG only).
2. **Notifications** — master toggle; sub-toggles for Reminders (Routine
   due, Event starting, Course dose, Course ending soon) and Encouragement
   (Gentle re-entry, Milestone reached); Daily digest (time picker).
3. **Notifications · empty** — all off state: "You won't get reminders or
   nudges. You can turn on just the ones you want, anytime."
4. **Theme & accent** — Light / Dark / Auto; accent color swatches; live
   preview on a real task card. "Accent only recolors CTAs & progress —
   never the signal colors."
5. **Manage subscription** — plan details, "Change plan" (Monthly/Yearly
   toggle), "Manage in App Store," "Billing is handled by Apple. Cancel
   anytime — access lasts through the paid period." Cancel subscription.
6. **Account & sync** — "No login. Your data lives on this device — no
   account to create or password to lose." On-device storage (default) vs.
   iCloud sync ("Last synced 2 min ago"). Restore purchases ("re-checks your
   App Store account for an active Fallback AI subscription — no sign-in
   needed").
7. **Widgets gallery** — home-screen widget sizes: Small · Today (3/5 done),
   Small · One task, Medium · Up next (next 2 tasks).
8. **Widget config** — choose what a widget shows: fixed task vs. "Smart —
   next due."
9. **Data · restore failed** — Back up now (with last-backup timestamp),
   Restore from backup, an inline failure state ("We couldn't read the
   backup file. Your current data is untouched — nothing was overwritten."),
   Erase all data.
10. **Help / about** — Contact support, FAQ & guides, Rate Fallback, Legal
    (Privacy policy, Terms of service), Design system ref (internal/DEBUG),
    version stamp ("Fallback · version 1.0.0 (build 128)"), tagline "Made
    with care · Something beats nothing."

### Gallery — states & system screens (Zone G)
*not steps in one journey — conditions any screen can enter*
- **G1 Loading · skeleton** — placeholder blocks in the surface color, one
  calm spinner in the accent. "No spinners-only screens."
- **G2 Error · offline** — "Offline — showing your last synced day. Can't
  sync right now. Your tasks are safe on this device. We'll sync
  automatically when you're back online." Design rule (verbatim):
  "Non-punitive: leads with what still works. Never a full-screen red
  error — offline is a calm neutral note; orange stays reserved for the
  fallback signal."
- **G3 Form validation · inline** — "Fix 2 fields to save," field-level
  errors. Design rule (verbatim): "Errors are guidance, not scolding —
  helpful copy in danger red, the valid field affirmed in green."
- **G4 Tags · fixed sets** — Importance (High/Medium/Low) and Necessity
  (Must-do/Recommended/Optional) as filterable chips. Design rule
  (verbatim): "Two closed vocabularies (Importance, Necessity). Selected
  chip = accent outline; each feeds a one-tap filter." "Fixed sets only —
  no free-form tags to fragment the list."

## What this source does NOT specify

The flow doc is UI/UX-complete but says nothing about: backend architecture,
data sync/conflict resolution beyond "iCloud sync," AI provider/model,
Android support (every platform cue is iOS-specific), team/business model
beyond the one subscription tier shown, localization, accessibility
requirements, analytics, or content moderation for the AI assistant. These
are open questions for the interviewer to raise.
