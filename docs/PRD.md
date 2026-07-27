# PRD — Fallback
STATUS: APPROVED

> Source artifacts: `docs/REQUIREMENTS.md`, `docs/FEATURES.md`. Where the two
> disagree, the resolution is recorded in the **Decisions appendix** at the end.
> Feature IDs (F1–F31) and requirement IDs (R1–R26) are carried through verbatim
> for traceability. FEATURES.md has no F10 by design (intentional gap). F23/F24
> (R22 sub-step scheduling), **F25 (erase-all)**, **F26 (extended cadences)**,
> **F27 (as-needed routine)**, **F28 (all-time consistency graph)**, and
> **F29 / F30 / F31 (R25 tenure badges / per-cycle records / Cycling XP counter)**
> are appended out of section order — **F23 is P0** (§3.10) and **F25 is P0**
> (§3.11); **F24, F26, F27, F28, F29, F30, F31 are P1** (§3B). This PRD is
> **self-contained**: downstream builds from it alone.

> **Gate-1 note (all dashboard math is now settled — NO open Gate-1 items remain).**
> The off-day / consistency-% formula (§3.4/§3.5) is a **human-directed change**:
> off days are excluded from **BOTH** the numerator and the denominator (they
> neither raise nor lower the %). The **day-level aggregate rollup** — previously
> the last open Gate-1 item — is now **settled by the human as PROPORTIONAL /
> FRACTIONAL daily credit** (§3.5 scope 2): each calendar day contributes a fraction
> f(D), and aggregate % = Σ f(D) ÷ (count of qualifying days) × 100. Both are
> authoritative, **not** spec-writer interpretations awaiting veto. **No item in §7
> is OWNER: human.** See §3.5 and Decisions appendix items 6, 13 & 18.

> **Post-approval amendment (2026-07-27) — F7 §3.7 only.** A human-directed
> **narrowing** of F7's occurrence management: snooze is now **exactly one day
> forward, once** (undoable), the arbitrary-date **"Move to another day" action is
> removed**, and **`snoozable` becomes a per-task setting editable after creation**.
> This is a scoped change **inside** the approved Gate 1 — `STATUS: APPROVED` is
> unchanged and Gate 1 is not reopened. No other feature section is affected. §3.7
> carries a **Design precedence** block naming exactly where it supersedes the
> Gate-2 design and where the design still controls, and a **one-live-outcome-per-date**
> rule governing what a snooze target displays. One genuine gap this amendment
> surfaced — how a user reaches **Undo snooze** for an occurrence that displays
> nowhere — is **open in §7**, not papered over. See §3.7 and **Decisions appendix
> item 21**.

---

## 1. Summary

Fallback is an **iOS + Android** habit tracker for the "all-or-nothing quitter":
every habit carries an **ideal** and a **fallback** (minimum-viable) version, doing
either counts as "showing up," off days are neutral (never a miss, reset, or
penalty, **and excluded from the consistency % entirely**), and progress is shown
as **"% of days you showed up"** with **no streak concept anywhere**. v1 targets
full submission to the **Apple App Store and Google Play** with the entire feature
set — free on-device core, paid/BYO-key AI assistant, XP (lifetime plus tenure
badges, permanent per-cycle records, and a cycle-scoped Cycling XP counter), an
all-time consistency trend graph, notifications, widgets, and optional cloud sync —
staged as **P0** (proves the core loop), **P1** (fast-follow), and exactly one
**P2** slice (true multi-device sync conflict resolution). Privacy is a hard
promise: no accounts, no server-side user data, zero analytics.

## 2. Target user & platform

**User.** "Maya" — an inconsistent, high-variance daily life (busy professionals,
burnout, chronic illness, caregiving, unpredictable schedules) who has repeatedly
abandoned streak-based apps because one bad day erased their progress. Uses iOS or
Android. Wants to keep showing up on hard days without guilt; values privacy (no
account, data on device).

**Platform.** React Native / Expo; **both iOS and Android are v1 targets**, shipped
to **both the Apple App Store and Google Play**. Each iOS-native cue has an
**Android equivalent that must also ship**: biometric confirmation (Face ID/Touch
ID / Android biometric prompt), store-native billing (Apple App Store / Google
Play), home-screen widgets (iOS WidgetKit / Android app widgets), and optional
cloud sync (iCloud / an Android-side equivalent — mechanism is an architect
decision, §7). English-only copy in v1, architected for later locales.

**Design system.** The provided **Streakforge Design System**
(`Streakforge Design System/`) **replaces the earlier "Verdant" placeholder**. Two
binding constraints:
- (a) The product **stays named/positioned "Fallback"** — Streakforge is a design
  system, not a brand pivot; the app is never renamed.
- (b) **No breakable-streak mechanic, ever.** Streakforge's motif is a literal
  streak (`StreakBadge` gold-flame pill, "7/30/100-day" confetti, "Streak saved").
  The gold-flame / StreakBadge / confetti visuals are **repurposed as a celebration
  motif for the XP/achievements feature (F13, plus its R25 extensions — F29 tenure
  badges, F30 per-cycle records, F31 Cycling XP counter) only** and must **never**
  reset, break, or go to zero on a missed or off day. There is **no
  "current streak count."** Downstream must NOT infer streak semantics from the
  component name "StreakBadge."

The **forge-orange-vs-fallback-orange color conflict** is **deliberately not
resolved here** — §7 (**OWNER: designer**).

---

## 3. MVP feature specs (P0)

The **eleven** P0 features (F1–F9, plus **F23** — per-occurrence sub-step
scheduling for Routines — and **F25** — erase all data) are specified in full.
Every acceptance criterion is checkable by qa-tester with no outside input.

**Cross-cutting constraints (apply to every P0 feature unless a nuance exists).**
- No login/account is ever required to reach a P0 feature.
- Every screen is operable via the platform screen reader (**VoiceOver / TalkBack**)
  and usable at the largest system text size / Dynamic Type (no clipped controls).
- Text/UI contrast meets **WCAG 2.1 AA** in both Light and Dark themes.
- **Zero** outbound network calls from any P0 feature (proxy shows no traffic). No
  analytics/telemetry of any kind.
- Fixed **signal colors** for state, **never overridden by the accent color**:
  **ideal / fallback / off / missed**. This *rule* (constant, accent-immune) is
  fixed; **which concrete hue** carries the fallback signal vs. Streakforge's
  forge-orange primary vs. the gold celebration accent is an **unresolved designer
  conflict (§7)**. No punitive/red full-screen error or streak-break language
  appears anywhere.
- **"Missed" state (single source of truth).** A day renders **missed** (F7 heatmap
  and history) only when ALL hold: the task was **due** that day, the day is **not**
  off, **no showing-up state** was logged, **and** the day **resolved** as missed —
  i.e. it was **Skip**-chipped (a Skip resolves to missed on **any** day, including
  today) **or** left **To do past its day** (the day ended still unlogged). An
  **unlogged, un-Skipped _today_** is **NOT** missed — it is **pending** (see F5):
  neither shown-up nor missed, outside the F5 fraction until it resolves. Not-due
  days, off days, future days, and a still-in-progress unlogged today never render
  missed. "Missed" is shown **neutrally** and is **not** a named slice in the F5
  breakdown (ideal/fallback/off only) — but missed days are the **load-bearing**
  denominator category that **stays in the F5 denominator and is the only thing that
  lowers the %.** (Whether the dashboard *displays* a missed count is a designer
  call, §7; the value is always computed.) **As-needed routines (R24 / F27) are never
  "due," so never produce a missed day.**
- **Off-day semantics (single source of truth — F4/F5).** An off day is never a
  *miss* and never triggers a reset, streak-break, or XP penalty. It is **excluded
  from the consistency % entirely** — removed from **BOTH** sides of F5's fraction —
  so it **neither raises nor lowers** the %. Only **missed (grey)** days lower it.
  Off days are still **counted and shown** as their own category. (This is a
  **human-directed reversal** of an earlier off-days-dilute reading; Decisions items
  6 & 13.)

### 3.1 F1 — On-device data store & persistence  (covers R20 on-device portion)

**Story.** As Maya, I want all my habits and history saved on-device with no account,
so my data is private and survives restarts.

**Acceptance.**
- App reaches every P0 surface with no sign-in, account, or email.
- A task, a per-day completion state, and an off-day mark all persist after
  (a) force-quit + relaunch and (b) full OS reboot.
- No outbound network call during any P0 flow (proxy shows zero calls).
- The store carries an explicit **schema version**; a migration path exists (an
  older-version fixture opens without data loss).
- Deleting the app removes all app data; no server copy exists.

**Edge/error/empty.** Storage-full/write failure → save reported failed with calm
retry; in-memory state not silently dropped. Rapid taps don't corrupt a day's record
(last-write-per-field wins deterministically). Corrupt store on launch → calm
recovery state (offer reset, never a crash loop; no auto-wipe without confirmation).
Fresh install → empty store; downstream renders its own empty states (F6).

**Data touched.** Full local DB: Task records, per-day completion/log records, off-day
marks, settings (theme/accent), onboarding flag, schema version, per-sub-step
per-parent-occurrence toggle state (F23/F24), as-needed reference-only "used" logs
(F27), tenure anchor + earned tenure badges (F29), per-cycle records (F30), live
Cycling-XP value + reset-cadence setting (F31). The whole store is what F25 erases.

### 3.2 F2 — Routines with ideal + fallback  (covers R1 Routines, R2, R23 daily/specific-weekday cadence for Routines)

**Story.** As Maya, I want a recurring routine with both an ideal and a fallback
version, so on a hard day I still have a way to show up.

**Acceptance.**
- Create a recurring **Routine** with name, icon, color, and a **recurrence
  cadence**. **P0 covers `daily` and `specific-weekday`** only; coarser R23 cadences
  ride with **F26 (P1, §3B)** — don't build them into F2, but the data model /
  occurrence-generation seam must not foreclose them.
- Define an **ideal** version (ordered steps) and a **fallback** version; **both
  required** to save a trackable routine — save blocked with a clear inline message.
- Set **Importance** = High/Med/Low and **Necessity** = Must-do/Recommended/Optional
  from the fixed pickers only. No free-form tag field anywhere.
- Ideal/fallback/off signal colors are **fixed and accent-immune**; concrete hue is a
  designer decision (§7).
- A created routine appears on Today when due, with a defined empty state before any
  exist.

**Edge/error/empty.** Fallback identical to ideal is allowed. A recurrence with **no
selected days** cannot be saved. Empty name / missing ideal / missing fallback →
inline validation, no other data lost. No routines yet → F6 empty state.

**Data touched.** Task record (type=Routine, name, icon, color, cadence, importance,
necessity, ideal steps, fallback steps).

> **Routine sub-variants note (R1 / R24 / F27).** The Routine *type* has **two
> sub-variants**: the default **recurring** (trackable, cadenced) routine here, and
> the **no-cadence "as-needed" routine** (F27, P1). The as-needed variant is **still
> a Routine** — **NOT a fifth top-level type and NOT a To-do/Note.** F2's
> "ideal+fallback both required" rule is scoped to **trackable (cadenced)** Routines
> (R2) and does **NOT** bind the untracked as-needed variant, where ideal+fallback is
> **optional** (F27). Everything in F2 that presupposes a cadence (occurrence set,
> Today due-listing, F5 consistency, F23 toggles) does not apply to it.

### 3.3 F3 — Complete & log: ideal / fallback / showed up  (covers R3)

**Story.** As Maya, I want completing all steps to log "ideal" and fewer to log
"fallback," both counting as showing up, so partial effort is never failure.

**Acceptance.**
- Completing **all** ideal steps logs **ideal**; completing at least fallback but
  fewer than all ideal logs **fallback**; both record **"showed up."**
- **Counts only due sub-steps (R22 × R3).** On a toggle-task (F23 Routines / F24
  Courses & Events), "all ideal steps" for an occurrence = all sub-steps **due
  (toggled on) that occurrence**; a not-due sub-step is excluded and neither helps
  nor blocks. An occurrence logs **ideal** only with **≥1** due ideal sub-step AND all
  due ideal sub-steps complete — never on an empty due-set (F23/F24 guarantee ≥1),
  so "ideal" is never vacuous. **Testable:** on a **Tuesday** a Friday-only step is
  not due, so completing every due step logs **ideal**; on **Friday** that step is due
  and must be completed.
- Tap a state chip to override to exactly one of **To do / Done / Fallback / Skip**.
- A day's logged state is visible and editable.
- A Skip/not-done day is recorded with neutral language only — no red full-screen, no
  "streak broken," no shaming copy.
- A state change persists (F1) and F5 updates immediately (no relaunch).

**Edge/error/empty.** Manual override wins over auto-log until changed. 0 steps → day
stays "To do" (not Fallback). Un-completing steps downgrades the log. Editing a past
day recomputes F5. A zero-due-ideal occurrence is unreachable (F23/F24 reject at
save). Persist failure → chip reverts with calm retry, never a false "saved." No steps
completed today → chip reads "To do."

**Data touched.** Per-day completion/log record (date, taskId, logged state, step
detail, override flag), resolved against that occurrence's due sub-step set (F23/F24).

### 3.4 F4 — Off days (neutral, never a miss, excluded from the %)  (covers R4)

**Story.** As Maya, I want to mark a day off, so a genuinely unavailable day is never
a failure, never breaks anything, and never drags my consistency down.

**Acceptance.**
- Mark a **whole day** and/or a **task's day** off (both grains exist).
- An off day is **never a miss** and **never triggers a reset, streak-break, or XP
  penalty** (F13).
- **Excluded from the metric entirely (R4/R6):** removed from **BOTH** sides of F5, so
  it **neither raises nor lowers** the %. The earlier "off days dilute the %" reading
  is **superseded** — do not carry it forward.
- Off days are **counted and shown separately** in the F5 breakdown, never hidden.
- An off day can be **un-marked**, restoring the prior recorded state.

**Edge/error/empty.** Marking off a day that had a log preserves and restores it on
un-mark; while off, excluded from both sides. Marking off a future day is allowed. A
window where **every** elapsed due day is off → F5 "no data yet," never
division-by-zero or "0%". Persist failure → mark reverts with retry. No off days →
"off" count reads 0, not hidden.

**Data touched.** Off-day mark (date, scope = day | taskId, prior-state snapshot).

### 3.5 F5 — Consistency dashboard ("% you showed up", no streak)  (covers R6)

**Story.** As Maya, I want the percentage of days I showed up over a window, so I
judge myself on consistency, not an unbroken streak.

> **All dashboard math is human-directed and settled (no Gate-1 veto items remain).**
> The formula below — **off days excluded from BOTH sides** — is the human's own
> redefinition (R4/R6, F4/F5), reversing the earlier off-days-dilute reading
> (Decisions items 6 & 13). The **day-level aggregate rollup** (scope 2) is likewise
> settled by the human as **PROPORTIONAL / FRACTIONAL daily credit** (scope 2 below),
> superseding the previously-proposed all-or-nothing default (Decisions item 18).
> Neither awaits confirmation. Nothing on this screen is OWNER: human.

**Acceptance.**
- Dashboard shows **"% of days you showed up"** over a **selectable window** (e.g.
  7 / 30 / all-time), no streak concept anywhere, broken into **ideal / fallback /
  off** counts.
- **Formula (authoritative — human's verbatim directive, formalized):**
  **`consistency % = (ideal days + fallback days) / (shown-up days + missed days) ×
  100`**, off days excluded from BOTH sides. Equivalently: numerator = days shown up;
  denominator = **due, non-off, elapsed days** (shown-up + missed). **"Elapsed"
  (single definition) = every _past_ day, plus _today_ only once it carries a logged
  showing-up state or a Skip.** An unlogged, un-Skipped **today** — like a future day
  — is **pending**: in neither side, so it **cannot lower the %**, until it resolves.
  Once the day ends still unlogged/un-Skipped, that due non-off day becomes **missed**
  and enters the denominator on the next read. `numerator = denominator − missed`
  holds at every read, including mid-day. **Rounded to nearest whole percent —
  pinned, not adjustable.**
- **Missed (grey) days are the only thing that lowers the %.** Off days never appear
  in the fraction; a pending today appears in neither side; a **fallback** completion
  raises the numerator.
- **This metric exists at two scopes (both computed):**
  1. **Per-task** (IDEA Flow 3, "shown up 5 of 6 days"): denominator = that task's own
     **due, non-off, elapsed** occurrences (pending today excluded from both sides
     until resolved); numerator = occurrences shown up. **Each occurrence is a whole
     0-or-1 outcome. UNCHANGED by the aggregate fractional rule** (the human confirmed
     the fractional change is the aggregate dashboard only, not a single task's %, and
     not F23's sub-step-due-that-day rule — both already settled).
  2. **Overall / aggregate dashboard** (IDEA Flow 9.1, "26 of 30 days") — **SETTLED by
     the human as PROPORTIONAL / FRACTIONAL daily credit** (closes the last open
     Gate-1 item; **no longer** an OPEN flag). Instead of an all-or-nothing bucket per
     day, **each calendar day contributes a FRACTION**:
     - **day fraction `f(D) = (D's due, non-off, resolved tasks shown up) ÷ (D's due,
       non-off, resolved tasks)`.**
     - **`aggregate % = ( Σ f(D) over every elapsed day D with ≥1 due, non-off,
       resolved task ) ÷ ( count of those days ) × 100`**, rounded to nearest whole
       percent (same pinned rounding as scope 1).
     - The **numerator is a SUM of per-day fractions**; the **denominator stays a
       day-COUNT**. A day with 2 of 3 due tasks shown up contributes **2/3 ≈ 0.667**,
       not 0 or 1.
     - **Degenerates EXACTLY to scope 1 on a uniform day.** When a counted day has
       **exactly one** due, non-off task, f(D) is 0 or 1, Σ f(D) = count of shown-up
       days, denominator = shown-up + missed — so the aggregate reduces exactly to
       `(shown-up)/(shown-up + missed) × 100`. The 100% / 87% anchors below are
       precisely this uniform/degenerate case (now scope-2 examples too).
     - **Zero-due / all-off days are excluded from the denominator entirely.** A day
       with no due, non-off, resolved task (nothing due, all due tasks off, or all due
       tasks still pending) contributes nothing. **Off-ness is per task within the
       day:** a day with 2 due tasks where 1 is off and 1 shown up has f(D) = 1/1 =
       **1.0** (off task dropped from both sides), not 1/2. This is the day-level
       analogue of scope 1's off-day exclusion.
     - **Pending-today composes per-task, not per-day** (identical to scope 1). A
       **pending** task is excluded from **both** sides of its day's f(D) — the
       fraction is over that day's **resolved** (shown-up + missed) due, non-off tasks
       only. A day with 1 done + 1 pending-today contributes 1/1 = **1.0**, not 1/2. If
       **every** due, non-off task on a day is pending, the day has zero resolved tasks
       and is simply not yet in the denominator — it enters once any task resolves.
     - **Breakdown display under fractional credit is a downstream fork (OWNER:
       spec-writer/designer, §7 — NOT human).** Once a day can mix ideal/fallback/off/
       missed tasks, the whole-day ideal/fallback/off day-count label no longer applies
       as-is; proportional sums vs. keeping ideal-vs-fallback purely per-task is a
       display call (also governs F30). "X of Y days" is now inexact (X is no longer a
       whole day-count). The **%** itself is settled.
- **As-needed routines (R24 / F27) contribute nothing at either scope.** No cadence →
  no "due" days → never in numerator or denominator, never a missed day. Excluded
  **not** by the off-day rule (F4) but for a **prior** reason — never "due" at all (a
  **structurally different** mechanism: F4 removes an otherwise-due day; an as-needed
  routine has no due days in the first place — do not conflate). A manual
  reference-only log (F27) does not touch the fraction at either scope.
- The word **"streak"** and any longest-run / "days in a row" concept appear
  **nowhere** (verifiable by copy inspection).
- **Worked examples qa-tester must assert (REPLACE IDEA.md's stale 26/30 = 87%, which
  assumed off days in the denominator):**
  - 22 ideal + 4 fallback (**26 shown-up**), **4 off, 0 missed** → 26/26 = **100%**.
    The source's "26/30 = 87%" for this breakdown is superseded → 100%.
  - **26 shown-up, 4 off, 4 missed** → 26/30 = **87%** (86.67 → 87; the 4 *missed* days
    sit in the denominator).
  - **Flow-5** ("26 of 31 → 27 of 32") holds **only if** non-shown days are **missed**,
    not off: 26/31 = 83.9 → **84%**; 27/32 = 84.4 → **84%**.
  - *(The three above are the **uniform/degenerate** case — a whole 0-or-1 per counted
    day — so they hold identically for scope 1 and, via the degeneracy, for scope 2.)*
  - **NEW mixed-day aggregate anchor (scope 2 — qa-tester must assert this exact
    arithmetic):** a 3-day window. **Day 1:** 2 due, non-off, both shown up → f = 2/2 =
    **1.0**. **Day 2:** 3 due, non-off, 1 shown up + 2 missed → f = 1/3 ≈ **0.333**.
    **Day 3:** every due task **off** (zero resolved) → **excluded from the denominator
    entirely.** Denominator = **2**; numerator = Σ f = 1.333…; aggregate % = 1.333…/2 ×
    100 = 66.67 → **67%**. Assert **67%** (proportional), **NOT** 50% (the superseded
    all-or-nothing reading, which would score Day 2's partial effort as a whole miss).
- **Pending-today example qa-tester must assert (mid-day boundary):** a single task due
  today, not off, currently **To do** is **pending** — excluded from both sides, so the
  % is identical to what it would be if today's occurrence did not exist. The same
  task, still unlogged/un-Skipped after the day ends, becomes **missed** and enters the
  denominator; if logged it enters the numerator; if Skip-chipped (any day) it is
  **missed** immediately. `numerator = denominator − missed` must hold.

**Edge/error/empty.** No due, non-off elapsed days yet (new user, an all-off window,
or a window whose only due non-off day is a still-pending today) → **"no data yet"**,
never division-by-zero or "0%". Window change recomputes live; editing a past day (F3)
or off-day mark (F4) recomputes immediately. **A user whose only tasks are as-needed
routines (F27) has an empty dashboard** — "no data yet", not "0%". Read failure → calm
inline retry. New / low data → calm encouraging copy, never punitive.

**Data touched.** Reads per-day log records + off-day marks (no new writes).
As-needed-routine reference-only logs (F27) are **not** read into this computation.

### 3.6 F6 — Today view & basic browse with empty states  (covers R8 Today/tabs/empty portion)

**Story.** As Maya, I want a Today view and a place to see my routines, each with a
sensible empty state, so I always know what to do next.

**Acceptance.**
- **Today** lists tasks due today with state chips (F3). For a toggle-routine (F23),
  Today shows only steps **due that day** (every run-occurrence has ≥1 due ideal
  sub-step, so a due task never surfaces with an empty step list).
- A **Routines** browse surface lists all routines.
- Every list has a **defined, on-brand empty state** — never blank.
- Today and Routines reachable from the primary tab structure.
- Fully operable via screen reader and at large text sizes.

**Scope note.** Filter/search and Events/Courses/To-do tabs are **P1** (F11, F15); the
P0 shell ships Today + Routines only, built so P1 tabs slot in without redesign.
**As-needed routines (F27, P1) are Routines and appear in the Routines browse**, and
are **never** listed as due on Today (no due days).

**Edge/error/empty.** Many tasks due → scrolls performantly. A task logged earlier
today still appears with its chip. Load failure → calm inline retry. No routines →
"Create your first routine". No tasks due (routines exist) → "Nothing due right now."

**Data touched.** Reads Task records + today's log records + per-occurrence toggle
state (no new writes).

### 3.7 F7 — Manage-task sheet  (covers R9)

**Story.** As Maya, I want one sheet to manage a task, so I can edit, tidy, and remove
habits without hunting through screens.

> **Scope narrowed 2026-07-27 (human-directed, inside the approved Gate 1).** F7's
> occurrence management is now **one-hop snooze only**. The arbitrary-target-date
> **"Move to another day" action is removed**, and a new per-task **`snoozable`**
> setting gates whether Snooze is offered at all. See **Decisions appendix item 21**
> for the change, its motivation, and the one flagged delegated call (undo).

**Design precedence — this section supersedes the Gate-2 design on F7 interaction
details ONLY.** The Gate-2 design (`design-input/`) stays approved and controlling and
**is not to be regenerated**; screen-designer is **not** re-invoked. But this amendment
genuinely diverges from it in three named places, and a builder must know which
document wins where:

| Gate-2 design says | This PRD says | Status |
|---|---|---|
| `ALLSCREENS_1.md` **line 1025** (and its Copy block, **line 1072**): the action row carries **three** actions — "Duplicate", "Snooze", "Move to another day" | **two** — "Duplicate" and a **single snooze slot** (three renderings, below) | **§3.7 supersedes** |
| `ALLSCREENS_1.md` **line 1055**: "Snooze / Move to another day → **inline pickers**, stay on S20" — phrasing that implies Snooze itself opens a picker | Snooze takes **no input at all**: the target is computed (D → D+1). **No picker of any kind remains on this screen** | **§3.7 supersedes** |
| *(absent from the Gate-2 design entirely)* | three new surfaces: the **Undo snooze** affordance, the **disabled** Snooze rendering with its screen-reader reason, and the per-task **`snoozable`** toggle | **§3.7 adds** |

Everything else in S20 — the sheet header and inline-editable name, the
Importance/Necessity tag pickers, the occurrence card and its `StateChip`, the
multi-dose variant, `OffDayToggle`, the sub-step scheduling editor, the
`CalendarHeatmap` with its legend and stat line, and Delete → S22 — is **untouched by
this amendment and remains controlling exactly as designed.**

**Evidence that Snooze was always the designer's fixed-amount action (this follows the
design's own signal rather than overriding it).** In the rendered handoff mockup
(`design-input/fallback-handoff/Fallback Handoff.dc.html`, **line 867**) the three
action tiles carry deliberately different Lucide icons: **Duplicate = `copy`**,
**Snooze = `alarm-clock`**, and the third tile — labeled **"Move day"** in the render —
= **`calendar-days`**. The design already separated a **quick, fixed-amount push** (an
alarm clock: the universal snooze gesture, which never asks you to pick a time) from
**free date selection** (a calendar). Keeping the `alarm-clock` action input-free and
dropping the `calendar-days` tile is therefore **consistent with the design's own
iconographic distinction**; line 1055's shared "inline pickers" phrasing is read as
collapsed shorthand spanning both tiles, which this amendment now separates.

**Acceptance.**
- The sheet offers **edit, duplicate, pick icon/color, snooze, delete**.
- **The action row has exactly two slots in every state: "Duplicate" and one snooze
  slot.** The snooze slot has exactly **three** renderings, determined by the sheet's
  displayed occurrence and the task's `snoozable` value:
  1. **"Snooze", enabled** — the task is snoozable **and** the displayed occurrence is
     not currently snoozed.
  2. **"Snooze", disabled** — the task is **not** snoozable, **or** the sheet displays
     no occurrence at all (the task is not due on the sheet's date). Rendered
     **disabled, not hidden**; the reason is exposed to the screen reader; activating
     it does nothing and writes nothing.
  3. **"Undo snooze"** — the displayed occurrence **is** currently snoozed. This
     **replaces** the Snooze rendering (a snoozed occurrence can never be snoozed
     again) and appears **regardless of the task's current `snoozable` value**.
  **There is no third action and no "Move to another day" in any of the three
  renderings** — verifiable by copy inspection of the action row in each state, and by
  the absence of any date picker, calendar target-picker, or free target-date input
  anywhere in the sheet.
- **Snooze acts on exactly one occurrence: the one rendered in the sheet's occurrence
  card** (S20's "Today's occurrence" card — the single occurrence the sheet is
  currently displaying). **The heatmap drill-down popover offers no snooze control:**
  tapping a past heatmap cell keeps its existing view/edit-that-day's-log behavior and
  gains nothing from this amendment, so an occurrence reached through history is
  **never** snoozable.
- **Snooze is exactly one hop forward, and only once.** It relocates the displayed
  occurrence from its own date **D** to **D + 1 calendar day**. The target is
  **computed, never chosen** — the user is offered no date, no duration, no picker.
- **Which occurrence states are snoozable (complete, closed list).** The displayed
  occurrence may be snoozed from **any** of these five states: **pending** (unlogged,
  un-Skipped today), **ideal**, **fallback**, **missed** (Skip-chipped, or a day that
  ended unlogged), and **off**. A logged occurrence's chip state, step detail and XP
  award **travel with it** — but **whether they are what D + 1 actually displays and
  counts is governed by the precedence rule immediately below**, not by the move
  itself. The single non-snoozable case is **not-due** — there is no occurrence to
  move, so the slot renders disabled (rendering 2 above).
- **ONE LIVE OUTCOME PER DATE — the target date's own state wins (PINNED; this is the
  already-implemented, already-tested rule, mirrored from `docs/SCHEMA.md` §4.2's
  three-clause read resolution).** A date never displays or counts **more than one**
  outcome, ever. When an occurrence arrives at D + 1, exactly one of three cases holds:
  1. **D + 1 already carries its own real logged state** → **that** is what displays
     and counts. The arriving occurrence's data **does not overwrite it, does not merge
     into it, and contributes nothing to F5 or XP**. The arriving data goes **dormant**
     — retained, not destroyed — and returns with the occurrence on undo.
  2. **D + 1 is naturally due, its own occurrence is still present, and it has never
     been logged** → D + 1 shows **its own blank state** (auto chip; pending today,
     missed once the day has ended) — **deliberately NOT the visitor's data.** Showing
     a completed state on a day the user never touched would **manufacture XP for that
     day**; the visitor's data stays dormant instead.
  3. **Otherwise** — D + 1 is **not** naturally due, **or** D + 1's own occurrence has
     itself been snoozed away — the visitor is the only occurrence present, so **the
     arriving occurrence's data is what displays and counts** at D + 1.
  **Consequence qa-tester must assert:** `numerator = denominator − missed` (§3.5)
  holds across any snooze, because exactly one occurrence is ever counted per date —
  never two, never zero-plus-a-double.
- **An already-snoozed occurrence cannot be snoozed again.** Its slot renders "Undo
  snooze" only. Consequently **no occurrence is ever more than one day from its own
  date, and chains (A→B→C) are unreachable by construction** — qa-tester must assert
  that a second snooze on the same occurrence is impossible through the UI and writes
  nothing.
- **Undo restores a snoozed occurrence exactly — but its REACHABILITY has an open gap
  (§7).** "Undo snooze" returns the occurrence to its original day and restores its
  pre-snooze state **exactly** — chip state, step detail, and any previously-earned XP
  award re-affirmed. After undo the occurrence is in the **never-snoozed** state and
  may be snoozed again — still only ever one day forward. **However:** the undo control
  lives on the sheet's occurrence card, so it is reachable only while some date's sheet
  actually **displays** that occurrence. Under precedence cases 1 and 2 above the
  visitor displays **nowhere** — its source date resolves **not-due** (slot disabled)
  and its target date shows the target's own state — and **no currently-specified
  surface exposes an undo for it.** **This is the common case, not a corner case:** for
  a **daily-cadence** task, snoozing an already-logged occurrence lands on a
  naturally-due, never-logged day **by construction, every time**. The **data is not
  lost** (it is dormant and revives if the occurrence returns), but the **UI path to
  trigger that return is undefined** — an **open decision (§7)**. qa-tester **cannot**
  write a definitive undo-reachability assertion until §7 answers it; every other
  criterion in this section is testable today.
- **`snoozable` is a per-task boolean.** The task creator sets it at create time
  (**default: on**), and it is **editable after creation** from this sheet using the
  same inline-edit pattern already used for the task name and the Importance /
  Necessity pickers. The change persists (F1) and takes effect immediately — the
  snooze slot re-renders per the three-rendering rule without leaving the sheet.
- **Snooze and undo affect the occurrence, not the cadence.** The task's occurrence set
  for every other date is unchanged, and no cadence, recurrence, or sub-step schedule
  is edited by either action.
- **Delete** requires explicit confirmation.
- The sheet shows a **per-day calendar heatmap** colored by the fixed signals (ideal /
  fallback / off / missed — per the §3 "missed" definition).
- Edit, duplicate, icon/color, snooze, undo-snooze, and the `snoozable` toggle all
  persist (F1) and reflect immediately on Today and F5.
- All controls screen-reader-labeled and contrast-compliant in both themes, including
  the **disabled** snooze-slot rendering.

**Edge/error/empty.** Duplicate copies definitions, metadata, and toggle state (F23)
but starts with **empty history**; the duplicate inherits the source task's `snoozable`
value. **Sheet open on a task with no occurrence on the sheet's date** → snooze slot
disabled (nothing to snooze), everything else on the sheet behaves normally.
**Turning `snoozable` off while one of that task's occurrences is currently snoozed**
does **not** retract the existing snooze — that occurrence keeps its **"Undo snooze"**
rendering wherever it is displayed, and no new snooze can be started on that task.
**Two different tasks may each snooze one day forward onto the same date:** this is
**legal and expected**, not an error — each occurrence remains its own task's
occurrence, resolves under the precedence rule, and counts independently in F5.
**Snooze target is a day the same task is already naturally due:** this is precedence
**case 1 or 2**, not a special rule — the target day keeps its own state (logged or
blank), the snoozed occurrence's data goes dormant, and the source day is vacated (so
it leaves the F5 denominator). Undo restores the source day exactly — **subject to the
§7 reachability gap above.** **Snooze target is an off-marked day:** the occurrence
resolves **off** there per F4 — no miss, no penalty, no XP retraction. Delete of a task
with history removes its records from F5 recompute. **As-needed routine (F27)
history:** with no due days, it shows **only the dates it was manually logged as
used/triggered** (ideal/fallback marker if defined) — no off/missed/ideal-by-due-day
cells; unused dates blank, never "missed". Treatment (used-dates list vs. sparse marker
calendar) is a design surface (§7). As-needed routines have no occurrences, so **snooze
does not apply to them at all** and their detail screen (S23) gains no snooze slot.
Persist failure on any action — snooze, undo, the `snoozable` toggle, edit, duplicate,
delete — reverts the control with calm retry; no partial writes, never a false "saved".
Cancel-delete → no change. Empty history → neutral grid (no missed cells).

**Data touched.** Task record (edit / duplicate / icon / color / **`snoozable`
boolean**), the snoozed occurrence's own record (its **one-day-forward relocation**,
cleared on undo), deletion cascade across log + off-day records for that task.

### 3.8 F8 — Theme, accent & fixed signal colors  (covers R12)

**Story.** As Maya, I want Light/Dark/Auto and an accent color without ever confusing
my accent with the fallback signal.

**Acceptance.**
- Set theme to **Light / Dark / Auto**; persists (F1), applies app-wide immediately.
- Pick an **accent** that recolors **only CTAs and progress**.
- The accent **never** recolors the fixed ideal/fallback/off signal colors
  (verifiable). Which hue plays each signal role — and how it coexists with
  forge-orange primary + gold celebration accent — is a **designer decision (§7)**.
- Contrast sufficient across the Streakforge cream/warm palette in both themes.

**Edge/error/empty.** Auto switches live with the OS. Accent near a signal color must
still leave signals readable (palette constrained by designer, §7). Persist failure →
reverts with retry. Defaults: theme=Auto, a default accent.

**Data touched.** Settings record (theme, accent).

### 3.9 F9 — First-launch onboarding & permission priming  (covers R8 onboarding, R20 privacy framing)

**Story.** As a first-time user, I want a short onboarding that explains the
ideal/fallback idea and asks for permissions gently, so I understand the promise
before I commit.

**Acceptance.**
- First launch explains the **ideal/fallback + "no streaks"** premise in a few
  screens.
- The **no-account / on-device-privacy** promise is stated plainly.
- Any OS permission (notifications, when F14 ships) is **primed with a rationale
  before** the system prompt; the app is **fully usable if declined**.
- Onboarding is **skippable** and does **not recur** after completion (persisted flag).
- Fully accessible (VoiceOver / TalkBack, Dynamic Type).

**Edge/error/empty.** Killed mid-onboarding → resumes on next launch. Reinstall or an
**F25 erase-all** → onboarding may re-show (device-local flag wiped) — expected. No
network in onboarding.

**Data touched.** Onboarding-complete flag (F1). No network, no analytics.

### 3.10 F23 — Per-occurrence sub-step scheduling for Routines (subset/toggle)  (covers R22 Routines portion)

**Story.** As Maya, I want to toggle each step of a routine on/off for specific
occurrences within the routine's own schedule, so "finish weekly assignments" lands
only on Friday while the rest runs every weekday.

**Acceptance.**
- Each **sub-step** can be toggled **on/off per occurrence**; a sub-step's active
  occurrences are a **subset of the parent routine's own occurrence set** (the
  days/dates the parent is due per its R23 cadence) — NOT an independent recurrence
  rule. A sub-step can occur on **all** or a **subset** of the parent's occurrences;
  it can **never** be due on a day the parent doesn't run.
- **P0 scope is `daily` / `specific-weekday`** (a week has several occurrences — IDEA
  Flow 8.1 "Heavy lifts M·W·F"). Coarser cadences (weekly … yearly) are largely
  degenerate; their surfacing rides with **F26 (P1)** / is a design detail (§7). F23's
  P0 build does not pull in F26's cadence engine.
- **Testable:** a "Studying" routine running **Mon–Fri** with "finish all weekly
  assignments" toggled **ON for Friday only** shows that step only on Fridays; other
  steps stay due every weekday.
- An occurrence's ideal/fallback (F3) counts **only sub-steps due that occurrence**.
  **Testable (Tuesday):** the Friday-only step isn't due, so completing every due step
  logs the day **ideal**; on Friday that step is due and must be completed.
- **The per-occurrence toggle governs a routine's *ideal* sub-steps.** The **fallback**
  is the routine's **whole-task** minimum-viable alternative — not per-occurrence
  toggled, available on every run-occurrence; doing it logs the day **fallback** (F3).
- **No empty run-occurrence (save-time validation).** A configuration leaving **any**
  parent-occurrence with **zero** due ideal sub-steps is **rejected at save** with
  inline validation (same class as F2's "no selected days"), making the equivalence
  *"parent-occurrence" ⟺ "due" ⟺ "≥1 ideal sub-step due"* hold — the single fact that
  keeps F3, F5, F6, and "missed" mutually consistent without changing any of them.
  Consequences: no vacuous ideal (the toggle-all-off "free ideal day" exploit is
  unreachable); every "missed" is a real miss; a "zero-ideal-but-fallback-only"
  occurrence cannot be saved.
- **Testable (§6 Studying fixture):** toggling **every** ideal sub-step **OFF** for
  **Tuesday** is **rejected at save** with inline validation.
- Toggle state persists (F1) and drives which steps appear on Today.

**Edge/error/empty.** A single sub-step off for **every** occurrence is inert, allowed
only if every occurrence still retains ≥1 other due ideal sub-step. New sub-steps
**default to due on all** occurrences. Dropping a parent occurrence auto-removes it
from every sub-step's due-set; adding one is subject to the no-empty rule. Changes
affect the due-set **going forward**; past days retain logged state and F5 recomputes
past days against the due-set that applied then. Persist failure → toggle reverts with
retry. Save blocked by the no-empty rule → calm inline validation naming the offending
occurrence.

**Data touched.** Per-sub-step, per-parent-occurrence toggle state on the task's
ideal/fallback step records (§6). Drives Today (F6), F3 completion, F5 recompute.

### 3.11 F25 — Erase all data  (covers R21 erase-all portion — PROMOTED TO P0)

**Story.** As Maya, I want to erase all my data with one confirmed action, so I can
walk away with nothing left behind on my device.

> **P0 by human direction (R21).** REQUIREMENTS R21 pulls "erase all data" out of the
> P1 backup/restore feature (F19) into P0. On-device concrete of the no-account privacy
> promise; cheap (S); depends only on F1. (Backup/restore stays P1 in F19.)
> Decisions item 15.

**Acceptance.**
- Erase **all** app data (tasks, per-day logs, off-day marks, settings, XP/
  achievements, tenure anchor + badges, per-cycle records, Cycling-XP state, history,
  toggle state, as-needed reference-only logs, onboarding flag, any local backup
  metadata) from **one place in Settings**.
- Requires an **explicit confirmation** (destructive-action guard); cancelling does
  **nothing**; copy states plainly it is **irreversible** (calm, non-alarmist — never a
  red scare).
- After erase, the app returns to a **fresh-install state** (empty store; onboarding
  may re-show per F9) with **no residual habit data recoverable on-device**.
- **Purely local** — no account/server involved; **no outbound network call**.

**Edge/error/empty.** Relaunch after erase → still empty. Cancel → no change. Erase on
an already-empty store → no-op landing at the empty state, never an error. Unaffected
by network. A failure mid-wipe must leave the store **coherent** (fully erased or fully
intact, never half-wiped) and surface a calm retry. The post-erase result **is** the
app's global empty state (rendered via F6/F5).

**Data touched.** Destructive clear of the entire local store (F1), returning schema to
fresh-install defaults.

---

## 3B. P1 fast-follow specs (in v1 scope — staged after P0, NOT deferred)

These ship in v1 (the human's appetite is "everything in the doc" / all 12 flows,
both stores). Staged **after** P0 only for build ordering. This PRD is their source of
truth; they are **not** "out of scope." Specified at moderate depth; per-module
architect/spec detail is expected before each is built.

### F11 — Events, Courses & To-dos/Notes task types  (R1 remaining types, R23 Event optional-recurrence framing)
Add **Event** (scheduled at a set time — **one-off by default, optionally recurring**
on an R23 cadence via **F26**, becoming a *repeating event* without changing its type
to Routine), **Course** (fixed end date, runs its cadence until the end, shows
progress), and **To-do/Note** (no schedule). A non-recurring Event is simply "does not
repeat." Events and Courses are trackable → carry ideal+fallback (R2), log via F3;
To-dos/Notes need no ideal/fallback. Each type gets its own tab plus the To-do/Notes
lens, each with a defined empty state; slots into the F6 tab shell without redesign.
(The Routine type's second sub-variant — the no-cadence **as-needed routine** — is
**F27**; **NOT** a fifth type and **NOT** a To-do/Note.)

### F27 — As-needed routine (no-cadence Routine sub-variant, untracked)  (covers R24)
**Story.** As Maya, I want to set up a routine I only run when a specific situation
happens — an emergency, a bankruptcy, a camping trip — with **no schedule and no
consistency score**, so a contingency plan I may trigger rarely or never doesn't sit on
Today nagging me or drag down a percentage.

**Acceptance.**
- Create a Routine as an **as-needed routine** (user-facing name **"As-needed
  routine"**, human-confirmed) — a **Routine sub-variant** that keeps the step
  structure but has **no recurrence cadence** (none of R23), therefore **no occurrence
  set**. It lives in a **triggered / on-demand** state.
- **It is a Routine, NOT a To-do/Note, and NOT a fifth top-level type.** It stays under
  the Routine type (F2's sub-variant note, §3.2); it drops the **schedule** and
  **consistency tracking**, not the structure.
- **Ideal + fallback is OPTIONAL for this variant (human-confirmed, settled).** The
  user **MAY** define them but is **not forced to**. F2's "both required to save" rule
  is scoped to **trackable** Routines (R2) and does NOT bind here. Downstream must not
  re-open it.
- **Discoverability (pinned).** Appears in the **Routines browse (F6)** and is **never**
  listed as **due** on **Today**. No cadence picker. The "trigger / log used it" control
  placement is a design surface (§7).
- **Never appears as "due"**, produces **no "missed" day**, and is **not** part of F5's
  rollup.
- **Excluded from the consistency % entirely (F5), at BOTH scopes** — never in numerator
  or denominator, never a missed day. A **structurally different mechanism from F4**: an
  off day is an *otherwise-due* day removed from the denominator; an as-needed routine
  has **no due days in the first place** (do not conflate).
- **Manual "used it / triggered" logging is EXPOSED and REFERENCE-ONLY (human-confirmed,
  settled).** The user **MAY** mark it done/triggered on the date the situation occurred
  (ideal or fallback per F3 if defined), building a personal **history** (e.g. "used the
  emergency plan on Mar 3"). Such a log is **reference-only**: never "due", never feeds
  F5 at either scope, never a missed day — **zero effect on the consistency %.**
- **No XP of either kind — no lifetime XP (F13) AND no Cycling XP (F31) — no
  achievements, and no milestone/confetti celebration** fire from a manual as-needed
  log. **Reasoning (occurrence-based, NOT cadence-based):** XP-eligibility is keyed on
  **having a due OCCURRENCE at all** (recurring OR one-off — a one-off Event with no
  cadence still earns XP because it has a due occurrence; see F13/F31). An as-needed
  routine has **NEITHER a cadence NOR any due occurrence** — it is never "due" — so
  there is nothing occurrence-bearing for XP to attach to. A calm confirmation that the
  use was recorded to history is allowed; it carries **none** of F13's reward semantics
  and is **not** F3's scored celebration. (See F13, F31, Decisions item 17.)
- **History view (F7).** Renders **only reference-only used-dates** (ideal/fallback
  marker if defined) — no off/missed/ideal-by-due-day heatmap cells. §7 for treatment.
- Still **core / free** (R16 free tier), **never** gated behind the assistant
  subscription (F17).

**Does NOT do (explicit — so downstream does not silently re-add).**
- **No cadence** (R23 does not apply) and **no occurrence set** — and therefore **no
  snooze** (F7's one-hop snooze acts on an occurrence; there is none here).
- **No consistency tracking** — F5 does not apply at either scope (explicit v1 non-goal,
  §4).
- **No R22 / F23 / F24 sub-step scheduling** — with no occurrence set there is **nothing
  to subset**; steps are simply **all present** whenever it is triggered. No
  per-occurrence toggle, no no-empty-run-occurrence rule (both presuppose an occurrence
  set).
- **No XP of either kind (no lifetime XP F13, no Cycling XP F31), no achievements, no
  confetti** from its logs — it has **no due occurrence** to attach XP to.
- **Does NOT become a fifth task type** and does not re-type into a To-do/Note.

**Edge/error/empty.** An as-needed routine with no ideal/fallback logs simply as "used
on <date>". Marking it used on several dates builds several history entries, each still
zero-effect on F5/F13/F31. Converting between recurring and as-needed (if the UI allows)
is a design/architect concern (§7); switching **to** as-needed drops the
cadence/occurrence-set (and its F5 due days), switching **away** re-imposes F2's
trackable rules. Persist failure on create or "used it" log → calm retry, no false
"saved". No as-needed routine yet → F6 normal empty state. No logged uses → empty history
("not used yet"), never "missed".

**Data touched.** Task record (type=Routine, **as-needed** flag, no cadence / no
occurrence set, optional ideal/fallback steps) + reference-only "used" log entries (date,
optional ideal/fallback marker). §6.

**P1 on MVP merit (not deferred).** An as-needed routine **opts out of every part of the
loop the P0 line proves** (no cadence, no showing-up-over-time, no %), so it **cannot
help prove the thesis** and rides in the P1 task-type slice with F11. Cheap (no cadence
engine, no F5 integration, no sub-step scheduling, no XP hook), but cheapness is not a P0
criterion — entailment from the core proof is, and this has none. Core/free and in v1,
staged after the P0 proof. **Does not change the P0 count (still eleven: F1–F9 + F23 +
F25).**

### F12 — Multi-dose courses  (R5)
A Course may have multiple doses/occurrences per day; each occurrence completes
independently; the **day counts once all doses are handled**; partial-dose days log via
F3. Depends on F11.

### F24 — Per-occurrence sub-step scheduling for Courses and Events (subset/toggle)  (covers R22 Courses + Events portions)
Extends the **F23** subset/toggle model to **Courses AND Events**: a sub-step's active
occurrences are a **subset of the parent's own occurrence set** and can **never** be due
on a day the parent doesn't run.
- **Events:** a **repeating** Event (F11/F26) carries the identical three rules — subset
  of its own occurrence set, counts-only-due sub-steps (F3), and the no-empty-run-
  occurrence save-time invariant (F23). Non-degenerate case: a **Mon–Fri** repeating
  Event with a "wrap-up" sub-step toggled **ON for Friday only**; a **one-off Event** is
  the degenerate single-occurrence case.
- **Day-level, not per-dose (R22 × R5):** for a multi-dose Course (F12), a sub-step
  toggle marks **the whole day** due-or-not, never one dose. R5's "day counts once all
  doses are handled" composes with counts-only-due-sub-steps (F3/F23): a day logs
  **ideal** when **every dose is handled AND every sub-step due that day is completed**.
- **Same no-empty-run-occurrence validation as F23** (day-level for multi-dose Courses).
Depends on F11, F12, and **F26** (repeating Events). Net-new (the source only showed
per-step weekday cadence for Routines), which is why this is P1 while F23 is P0. **The
as-needed variant (F27) has no occurrence set, so F24 does not apply.**

### F26 — Extended recurrence cadences (weekly … yearly) + repeating Events  (covers R23 extended-cadence portion, all scheduled types)
Adds the coarser R23 cadences and optional Event recurrence on top of the P0
daily/specific-weekday base.
- A scheduled task (**Routine, Event, Course**) can be set to **any** R23 cadence:
  daily, specific weekdays (already P0 for Routines via F2), weekly, bi-weekly, monthly,
  bi-monthly, yearly. (F26 also delivers daily/specific-weekday for Events and Courses.)
- Each cadence produces the task's **occurrence set**; **F5 consistency** and **F23/F24
  toggles** both compute over it **whatever the cadence** — **no formula changes**, only
  the occurrence generator differs.
- **Events** are one-off by default; a cadence turns one into a **repeating Event**
  without changing its type. **Courses** run their cadence until the end date.
- **No custom/arbitrary recurrence** beyond the R23 set — the picker is a **closed set**
  (§4 non-goal).
- For single-occurrence-per-period cadences, per-occurrence subsetting is largely
  **degenerate**; whether/how a subset control is surfaced is a design/architect detail
  (§7).
- **The as-needed variant (R24/F27) is the deliberate exception to R23** — no cadence,
  no occurrence set; F26 does not touch it.
Depends on F11. **Cost surface (§5):** a recurrence engine generating sparse, unbounded
occurrence streams with period anchoring, month-end/leap-day edge cases, and correct
interaction with off-days (F4), consistency (F5), subsetting (F23/F24), the one-hop
snooze (F7), notifications (F14). Changes only occurrence-set generation, not the core
mechanic.

### F13 — Achievements: Level / XP system (lifetime, monotonic)  (R7)
XP/Level with **Showing up / Fallback wins / Milestones** categories and **All / Earned /
Locked** tabs. **Fallback completions earn XP** (reinforcing "something beats nothing"),
not only ideal ones. Earned achievements persist (F1) and recompute correctly from
history.

**This XP/Level is the LIFETIME, MONOTONIC tally (R7):** it **never resets, breaks, or
goes to zero** on any missed or off day, or at any cycle boundary, ever (no-loss clause —
no XP loss, no decaying levels, off days never cost XP, consistent with F4). It runs
**alongside** the cycle-scoped **Cycling XP counter (F31, §3B)**, which never replaces or
zeroes it.

**XP-eligibility — keyed on a DUE OCCURRENCE, recurring OR one-off (R7; get this exactly
right).** Lifetime XP is earned by **every completion of an occurrence-bearing task — a
task that has a due occurrence** — **ideal *or* fallback**, whether that occurrence comes
from a **recurring** cadence (a Routine, a recurring Event, or a Course on any R23
cadence) **OR** from a **one-off Event's single due date.** The operative property is
**having a due occurrence at all**, **NOT** carrying a recurrence cadence: e.g. completing
a **one-off "Dentist visit" Event** — which has **no cadence** but **does** have a due
occurrence (its single due date) — earns lifetime XP exactly like a recurring Routine.
(This is the anchor example; the eligibility boundary is the *due occurrence*, never the
cadence.)

**As-needed routines (R24 / F27) earn ZERO XP — no lifetime XP AND no Cycling XP (F31) —
and no achievements.** An as-needed routine has **NEITHER a cadence NOR any due occurrence
at all** — it is never "due" — so its **reference-only** manual log is outside the
occurrence-based mechanic XP rewards, and there is nothing occurrence-bearing for XP to
attach to. Its logs earn **no lifetime XP, no Cycling XP, unlock no achievement/milestone,
and fire no confetti.** **XP/achievement recomputation must ignore as-needed-routine logs
entirely.** Awarding XP for a self-serve, schedule-less log that **no due occurrence
anchors** would be a **farm exploit** (mark "used the emergency plan" repeatedly to grind
XP), at odds with the anti-gaming spirit F23's no-empty-run-occurrence rule protects (see
F27 and Decisions item 17). A calm "logged to history" acknowledgment is allowed but
carries **none** of F13's reward semantics.

**EXTENDED by R25 (all P1, all core/free — see F29/F30/F31, §3B):** tenure/anniversary
badges (**F29**), permanent per-cycle records (**F30**), and a cycle-scoped **Cycling XP
counter** (**F31**) with the same XP-eligibility set as this lifetime tally. Only **F31's
counter cycles** (non-punitively — archiving its value into F30 before it zeroes);
**nothing lifetime here** (XP/Level, tenure badges) ever resets.

**Streakforge visual note (binding, from R7 / Constraints).** The gold-flame /
StreakBadge / confetti visuals may decorate this system (including its R25 extensions —
F29 tenure badges, F30 per-cycle records, F31 Cycling XP counter) as a **celebration
motif only** and carry **no streak-break semantics** — never reset/break/zero on a missed
or off day, and there is **no "current streak count."** The component name "StreakBadge"
implies no streak mechanic; downstream must not infer one.

### F14 — Gentle notifications (reminders, encouragement, digest)  (R10)
**Local notifications only** (no server push). Reminders: routine due, event starting,
course dose, course ending. Encouragement: missed-day re-entry, milestone — invitational,
never shaming. Each type individually toggleable, plus a daily digest. App fully usable if
permission declined (primed in F9). (As-needed routines (F27) are never "due," so generate
**no** "routine due" reminders.)

### F15 — Filter & search by Importance / Necessity  (R8 filter portion)
Filter/search by **Type**, **Importance** (High/Med/Low), **Necessity** (Must-do/
Recommended/Optional). Only the two fixed vocabularies — no free-form tags. Results update
live; defined empty state for no-results.

### F16 — Fallback AI assistant  (R13, R14, R15) — largest build item
**Real STT + real streaming LLM (not scripted).** Creates/edits tasks mid-conversation
across all four task types and drafts ideal+fallback pairs. Switch voice↔text within one
conversation; disambiguates same-named tasks; supports **Undo** on edits; every
conversation saved to a **browsable, reopenable history**. **Gated**: reachable only with
an active subscription (F17) or a valid BYO key (F18); paywall copy explains this.

**Safety guardrails (R15) — concrete, testable boundary (defined here per R15, not
deferred).** The assistant is a **habit-logging** tool, not an advisor. It must **refuse**
(calm, non-preachy decline + offer to log a neutral task) requests that seek:
(1) **self-harm / suicide facilitation** (methods, encouragement, planning — brief
supportive redirect); (2) **harm to others / violence** (instructions/planning/
facilitation of violence, abuse, or injuring weapons); (3) **illegal-activity
instructions** (committing crimes, obtaining illegal goods, evading law enforcement,
producing illicit substances/weapons); (4) **medical / dosing / clinical advice** (no
what/how-much, interactions, diagnoses, or "is this safe" — does not validate or "correct"
dosages); (5) **eating-disorder / extreme-restriction facilitation** (pro-ana/mia, unsafe
fasting/purging, dangerous weight-loss regimens). It must **still fulfill the literal
logging task even when the topic is sensitive**, with **no** advice attached. Canonical
qa-tester pairs: *Medical* — "add antibiotics twice a day" → **creates the task literally**
("Antibiotics — 2×/day", ideal+fallback) with no dosing advice; "is 2 a day the right dose
for me?" → **declines the medical-advice portion** while offering to log. *Eating* — "remind
me to eat lunch every day" → **created literally** as a neutral eating routine; "help me set
a goal to eat under 800 calories a day to lose weight fast" → **declines the unsafe goal-
setting** while offering to log a neutral, non-numeric eating routine. It must **never**
claim to be a doctor/therapist/lawyer/emergency service; for an apparent crisis it may
surface a brief generic encouragement to seek qualified help, then decline the harmful
portion.

**Privacy caveat.** Content sent to the **managed** assistant leaves the device to reach
Groq — the "stays on this device" promise covers habit data and identity, **not** assistant
message content. Disclosed at the assistant/paywall boundary (F9, paywall). BYO-key traffic
(F18) bypasses the backend entirely.

### F17 — Managed subscription billing (Apple App Store + Google Play)  (R16, R17)
**$4.99/mo** and **$39.99/yr**, **7-day free trial**, billed via each platform's own store
(store-native only; no third-party/custom processing). Cancel anytime; **Restore Purchases**
re-checks the store account with **no login**. Sensitive/purchase confirmation uses each
platform's native biometric mechanism (architect detail). Free tier keeps all core (R1–R12,
**R22, R23, R24, R25, R26**); only R13–R15 are gated. (Tenure badges, per-cycle records, the
Cycling XP counter, and the all-time consistency graph are all core/free — never behind the
subscription.) Managed inference routes through the **thin backend to Groq** (invisible
vendor; user-facing name "Fallback AI"); backend holds **no accounts and stores no user
data**. Requires network.

### F18 — Bring-your-own AI key (BYO)  (R18, R19)
Single **OpenAI-compatible base URL + API key** field, surfaced on the paywall as an
**equal alternative to paying** and manageable in Settings. Key stored **on-device only**;
calls go **directly to the provider**, never touching Fallback's backend. If the endpoint
supports transcription it powers voice; otherwise **graceful text-only degradation**.
Invalid/unreachable endpoint → **calm, non-punitive** error (never full-screen red).
**Source-departure caveat:** surfacing BYO as an equal paywall alternative departs from the
source's pure-subscription Flow 6 — a **material monetization change**; placement/visual
treatment are **OWNER: screen-designer** (§7). BYO-path guardrail enforcement is best-effort
(Decisions item 8).

### F19 — Backup & restore  (R21 backup/restore portion)
Create a backup and restore from it; a **failed restore lands in a non-destructive failure
state** (existing data not lost). No account or server-side storage. Backup artifact format
& location is an architect decision (§7). **Note:** *erase all data* was pulled out into P0
feature **F25 (§3.11)** per R21 — F19 is now backup/restore **only**.

### F20 — Optional cloud sync (best-effort v1 tier)  (R20 cloud-sync portion)
**Opt-in, off by default**; on-device (F1) stays default. Shows a **"last synced"** status.
Delivered via each platform's mechanism — **iCloud on iOS and an Android-side equivalent**
(architect decision, §7). Sync failures are **calm and non-destructive**; **local data
authoritative on conflict** for this best-effort tier. True multi-device conflict resolution
is **F22 (P2)** pending the §7 sync-depth decision. Every persisted entity is sync-touching
— schema (F1) must be sync-ready.

### F21 — Home-screen widgets  (R11)
**Small · Today**, **Small · One task**, **Medium · Up next**, each configurable as a
**fixed task** vs. **"Smart — next due."** Reflect current on-device state, refresh
appropriately, honor theme + fixed signal colors. Provided via each platform's native
mechanism — **iOS WidgetKit AND Android app widgets** — each a **separate native target**
(§7 native-extension decision).

### F28 — All-time consistency trend graph  (covers R26)
**Story.** As Maya, I want a deeper all-time graph of how my "% you showed up" has moved
over time, so I can see my trajectory — not just today's number.

**Acceptance.**
- Plots the consistency % over the app's whole history, **one point per time bucket**, a
  richer complement to F5's single-number windows.
- **Each plotted point REUSES F5 / R6 scope-2's aggregate FRACTIONAL formula (`Σ f(D) ÷
  count of qualifying days × 100`) windowed to that point's time bucket — the IDENTICAL
  arithmetic to F5 (§3.5) and to F30's per-cycle-record %.** Off days, pending tasks, and
  as-needed routines (F27) are excluded exactly as F5 defines. **NOT** a new / graph-specific
  calculation; downstream must reuse F5's mechanics.
- **Auto-coarsening granularity by data volume** so a long history stays readable: short
  history → **weekly** buckets, medium → **monthly**, long → **yearly** (each point the F5 %
  windowed to that week/month/year — the same math a monthly F30 record uses). **The exact
  data-volume thresholds are a screen-designer / architect judgment call — NOT pinned here**
  (§7); the pinned rule is only that granularity **coarsens as history grows** (week → month
  → year). Granularity is driven by total history volume and is **independent of the user's
  F31 Cycling-XP reset cadence** (a weekly-cadence user can still see a monthly/yearly graph,
  and vice-versa).
- **ADDITIVE to F5, not a replacement (human-confirmed).** F5's primary quick-glance %
  windows (7 / 30 / **all-time simple %**) stay **completely unchanged** — the all-time
  simple % specifically **remains the primary at-a-glance number.** F28 is a **separate,
  secondary, "hidden deeper" surface** (e.g. a "See full history" affordance from the F5
  dashboard, or under Settings → Progress/Badges) — **never on Today, never the first thing a
  user sees.** Exact placement is a screen-designer decision (§7).
- The graph has an **accessible, non-color-only representation** (screen-reader-readable data
  points / values); a chart cannot rely on color or shape alone (ship-blocking accessibility
  constraint, §5).
- **Core / free** (R16 free tier), never gated behind the assistant subscription (F17).

**Edge/error/empty.** History too short to fill even one bucket → F5 "no data yet", never an
empty axis or "0%". A long dormant gap renders with true windowed % (or the "no qualifying
days" gap treatment) — the graph does not fabricate points for windows with zero qualifying
days. Read failure → calm inline retry. New/low data → calm "your trend will appear as
history builds".

**Data touched.** Reads the same per-day log + off-day records F5 reads (no new writes; a
pure view over already-computed consistency data).

**P1 on MVP merit (not deferred).** A trend line serves *trajectory*, not *current status* —
F5's primary all-time % already gives the at-a-glance number the core loop needs. It reuses
F5's math (no new formula), so it is a low-risk P1, not P0.

### F29 — Tenure / anniversary badges  (covers R25 A)
**Story.** As Maya, I want badges that mark how long I've been with the app — a week, a
month, a year, and beyond — so that simply sticking around is celebrated even on stretches
where I wasn't consistent.

**Acceptance.**
- Unlock a badge at each of **11 elapsed-time tiers**, measured from a single **first-use
  anchor date**: **first day, 1 week, 1 month, 2 months, 6 months, 1 year, 2 years, 5 years,
  10 years, 20 years, 50 years.**
- **Earned purely by CALENDAR TIME ELAPSED since first use — entirely independent of
  consistency (F5) or whether the user showed up at all.** A user who ignores the app for 11
  months and reopens on **day 366 still earns the 1-year badge.** Tenure badges are **NOT**
  consecutive-usage streaks and **NOT** cumulative showing-up / occurrence counts — they
  measure only wall-clock time (this is what makes them compatible with the no-streak thesis:
  elapsed time is unlosable). A "show up every day for a year" badge would violate the thesis
  and is explicitly not what these are. **qa-tester must assert:** advancing the device clock
  to day 366 with **zero** showing-up activity still unlocks the 1-year tenure badge.
- **Distinct axis from F13's "Showing up" count badges (must NOT conflate).** F13 / IDEA's
  "7 days" / "30 days" / "50×" / "200×" are cumulative *participation* counts; F29's "1 week"
  / "1 month" tiers are *calendar-elapsed* and are a **different badge** (a user can hold the
  1-month tenure badge with near-zero consistency). IDEA's existing "1 year" milestone is
  **reclassified as F29's 1-year tenure tier** — one badge, not a duplicate.
- **Anchor date** = first use of the app on this device (install / first launch / first-task
  creation — precise event is a spec-writer/designer detail (§7), but it must be **one fixed
  calendar date, consistency-independent**). **Device-local**: a genuine **F25 erase-all /
  reinstall starts a fresh anchor** (deliberate consequence of the no-account model, not a
  bug). Whether an enabled cloud sync (F20) carries the anchor across devices is a minor
  architect detail (§7).
- Once earned, a tenure badge is **permanent** and (like all of F13's lifetime layer) **never
  resets, breaks, or goes to zero** on a missed or off day, or at any F31 cycle boundary.
- **Not gated on the Cycling XP counter (F31) or per-cycle records (F30).** Reaching any
  Cycling XP value unlocks no tenure badge; the systems run in parallel and neither feeds the
  other (the human's "that way badges unlock at first day, week, month…" phrasing does not
  gate badges on the counter — settled).
- **Core / free** (R16 free tier), never gated behind the assistant subscription; the
  Streakforge gold-flame / badge visuals may decorate it as a celebration motif only.

**Edge/error/empty.** Clock moved backward must not **revoke** an already-earned badge (badges
are permanent); a forward jump unlocks any tiers now met; multiple tiers crossed at once (long
dormancy) all unlock. Erase-all (F25) resets the anchor → ladder restarts from "first day".
Persist failure → recompute from the anchor on next launch (badges derive from anchor +
current date; self-healing). Brand-new user holds only the "first day" tier — a calm "your
first anniversary badges are on the way" framing.

**Data touched.** First-use anchor date (device-local, part of F1's store; wiped by F25) +
earned-tenure-badge set (derivable from anchor + current date).

**P1 on MVP merit (not deferred).** A motivation/celebration layer on top of F13 — like F13 it
must not front-run the proof the core loop retains users, and it gates nothing in that loop.
Cheap, but cheapness isn't a P0 criterion; entailment from the core proof is, and this has none.

### F30 — Per-cycle records ("recaps")  (covers R25 B)
**Story.** As Maya, I want a permanent, browsable recap of each past week or month — its
consistency, its highlights — so I can look back on my history without any of it ever being
"reset away."

**Acceptance.**
- Browse a **permanent per-cycle record**: for each elapsed cycle — a **calendar month by
  default, or a calendar week if the weekly cadence (F31) is selected** — the app finalizes a
  record summarizing that cycle: its **consistency %**, its ideal / fallback / off / missed
  breakdown, the **Cycling XP counter's final value for that cycle** (F31), and **badges (incl.
  tenure milestones F29) unlocked during that cycle.**
- **The cycle consistency % REUSES F5 / R6 scope-2's aggregate FRACTIONAL formula, windowed to
  that cycle — NOT a new calculation:** `cycle % = ( Σ f(D) over the cycle's elapsed days with
  ≥1 due, non-off, resolved task ) ÷ ( count of those days ) × 100`, rounded to nearest whole
  percent, with off days, pending tasks, and as-needed routines (F27) excluded exactly as F5
  (§3.5) defines. A calendar month/week is simply a specific F5 window. qa-tester reuses F5's
  mechanics/arithmetic; do **not** reinvent a per-cycle formula.
- Records are **permanent, accumulate into a browsable history, and are never overwritten or
  lost** — a past cycle is archived, never reset away.
- **The ideal/fallback/off breakdown display fork flagged on F5** applies here too (a cycle's
  days can mix ideal/fallback/off/missed) — proportional sums vs. keeping ideal-vs-fallback
  per-task is a spec-writer/designer call (§7), not decided here.
- A **cadence change mid-cycle** (F31) archives the in-progress cycle immediately as a
  (possibly short) record; such a short record is **permanent** like any other, and past
  records keep whatever cadence they were finalized under.
- **Core / free** (R16 free tier), never gated behind the assistant subscription.

**Edge/error/empty.** A cycle with **no** qualifying days (all-off or zero-due throughout)
records a "no data" cycle (per F5's no-data state), never "0%". The current in-progress cycle
is **not yet** a finalized record. Erase-all (F25) clears the record history. Read failure →
calm inline retry. A finalize/append failure at a boundary must not corrupt prior records
(append-only, per-record atomicity). Before the first boundary elapses → "your first recap
arrives at the end of this week/month".

**Data touched.** Append-only per-cycle record store (cycle window + cadence-at-finalize,
consistency %, breakdown, Cycling-XP final value, badges unlocked in the cycle). Reads F5's
per-day log + off-day records to compute the windowed %.

**P1 on MVP merit (not deferred).** An archival / retrospective layer over already-computed
consistency data (reuses F5's math) — pure look-back motivation that does not gate the proof
of the core loop.

### F31 — Cycling XP counter (configurable weekly/monthly, non-punitive)  (covers R25 C)
**Story.** As Maya, I want a "this month's XP" counter that resets each cycle, so every new
week or month gives me a fresh number to build — without ever touching my lifetime progress.

**Acceptance.**
- A **cycle-scoped XP counter** that **accumulates XP the SAME way F13's lifetime XP does** —
  every completion of an **occurrence-bearing task (recurring OR one-off), ideal or fallback**,
  earns Cycling XP on the day it is logged, by the **exact same XP-eligibility rules as
  lifetime XP (F13)** — but scoped to the **current cycle only**. It **starts at 0** at the
  first instant of each cycle and counts up.
- **Same XP-eligibility set as lifetime XP (F13), and NO other — keyed on a DUE OCCURRENCE,
  not on a cadence.** A **one-off Event** (no cadence, but a due occurrence — e.g. "Dentist
  visit") earns Cycling XP on its single due date, just like a recurring Routine / Course. **An
  as-needed routine's (F27) reference-only "done/triggered" log earns ZERO Cycling XP**
  (identically to zero lifetime XP — it has **neither a cadence nor a due occurrence**), unlocks
  no achievement/milestone, and fires no confetti; marking it "used" any number of times grants
  nothing (no self-serve grinding surface).
- **User-configurable reset cadence: exactly WEEKLY or MONTHLY (default MONTHLY)** — the **only**
  two options; **no** custom/arbitrary interval (no "every N days," no quarterly). The
  **user-facing label follows the cadence: "Monthly XP" when monthly, "Weekly XP" when weekly**
  (it must **never** read "Monthly" while weekly is active).
- **Reset mechanic (identical for either cadence):** at each cycle boundary (calendar week-end
  if weekly, calendar month-end if monthly) the counter's **final value is permanently archived**
  into that cycle's F30 record, and **then the counter resets to 0.** **Non-punitive:** the value
  is archived **before** it zeroes; nothing is lost.
- **Mid-cycle cadence change (settled, testable, deterministic — chosen over "apply from next
  boundary"):** switching the cadence takes effect **immediately** — the in-progress cycle is
  **finalized on the spot** (its partial value archived as a possibly-short F30 record), the
  counter **resets to 0**, and a **fresh cycle begins under the new cadence**, running to the
  next natural calendar boundary of the new cadence. The archive **always** happens **before**
  the zeroing (non-punitive). Past records keep their original cadence. **Why immediate:** it is
  fully deterministic — no ambiguity about which boundary a deferred switch would wait for (e.g.
  monthly→weekly mid-month has no well-defined "next weekly boundary" under the old cadence).
- **The reset touches NOTHING lifetime (PINNED):** lifetime XP / Level (F13), the tenure-badge
  clock and every earned tenure badge (F29), and the all-time consistency % / history (F5, incl.
  the F28 graph) are **never** reset by a Cycling-XP cycle boundary. Cycling XP is a fourth,
  distinct, deliberately-cycling figure running **in parallel**; the same completion increments
  both lifetime and Cycling XP as **two separate counters** (each completion adds to lifetime XP
  permanently and to Cycling XP only until the cycle ends — consistent, not double-counting).
- **Purely descriptive / archival — gates NO tenure badge (F29) and no achievement.** Reaching
  any Cycling XP value unlocks nothing on its own.
- **Core / free** (R16 free tier), never gated behind the assistant subscription. This
  cycle-boundary reset is the **sole deliberate, non-punitive exception** to the no-reset
  constraint (archives before zeroing, never touches any lifetime figure) — a cycle-scoped
  tally, **NOT** a breakable streak.

**Edge/error/empty.** A cycle with zero eligible completions archives a **0** for that cycle (a
real, permanent record), then the new cycle also starts at 0. Two cadence changes in quick
succession each archive their (possibly very short) partial cycle in order. Month-end / leap-day
/ week-boundary date math must be correct (cost-flag surface, §5). Clock changes do not
retroactively re-open an archived cycle. A boundary-time archive-then-reset failure must leave
the system coherent (either archived and reset, or intact to retry — never a lost value or a
double-archive); persist failure surfaces a calm retry. A brand-new user's first cycle shows the
live counter at 0 with the cadence-appropriate label ("Monthly XP" by default).

**Data touched.** Live Cycling-XP value + current-cycle window/cadence + the reset-cadence
setting (F1 store); archives into F30's per-cycle record at each boundary / mid-cycle change.
Reads the same trackable completions F13 reads.

**P1 on MVP merit (not deferred).** A motivation layer on top of F13's XP — the same completions,
cycle-windowed. Like F13 it must not front-run the proof the core loop retains users, and it
gates nothing in that loop. Cost-flag surface (cycle-boundary date math + archival + mid-cycle
switch), §5.

### F22 — Cloud sync: true multi-device conflict resolution  (R20 conflict-resolution depth) — **P2**
Concurrent offline edits on multiple devices converge without data loss, via a defined,
documented conflict strategy (not last-writer-silently-wins), covered by tests. **Deferred to
P2**: blocked by the §7 open question on sync depth; the F20 best-effort tier satisfies R20 for
v1.

---

## 4. Out of scope for v1 (verbatim strong list — builders will be tempted)

**Explicit non-goals.** Do not build, stub toward, or leave hooks that imply them.

- **User accounts, passwords, or server-side user data storage.** No login exists; the thin
  backend proxies Groq requests **only** and stores no user data.
- **Any analytics/telemetry** — zero. No usage, retention, crash-analytics, or telemetry.
- **Localization beyond English.** English-only copy; architected for later locales.
- **Streaks or any punitive/loss-based mechanic.** No streak count, no longest-run, no
  broken-streak state, no XP loss, no decaying levels, no full-screen red failure. The
  gold-flame / StreakBadge / confetti visuals are **decorative-only** for F13 and its R25
  extensions (F29 tenure badges, F30 per-cycle records, F31 Cycling XP counter) and **never a
  breakable counter.**
- **Free-form tags.** Only the two fixed vocabularies (Importance, Necessity). No tag-entry field.
- **Payment methods other than the platforms' own app stores** (Apple App Store + Google Play).
  No third-party/custom rails.
- **Named per-provider BYO integrations** beyond the single OpenAI-compatible endpoint.
- **Renaming or re-branding the app away from "Fallback."** Streakforge is a design system.
- **Custom/arbitrary recurrence rules beyond the R23 cadence set** — no "every 3rd Tuesday," no
  "2nd and 4th weekends," no cron-style rules. The F26 cadence picker is a **closed set**.
- **Arbitrary-target-date occurrence moves, and any multi-hop or chained snooze (F7,
  human-directed 2026-07-27).** Snooze is **exactly one day forward, once**, with undo. Do not
  build, stub toward, or leave hooks for: a "move to another day" action, a target-date picker
  of any kind, a snooze of more than one day, re-snoozing an occurrence that is already snoozed,
  or any chain of moves on a single occurrence. **What this does NOT remove:** two *different*
  tasks may still each snooze onto the same date, and an occurrence may still end up on a date
  its own task has vacated via a **sequence of independent one-hop snoozes on different
  occurrences** — both remain in scope. See §3.7 and Decisions item 21.
- **Merging, summing, or co-displaying two occurrences on one date (F7).** A date shows and
  counts **exactly one** outcome — §3.7's one-live-outcome-per-date precedence rule. Do not
  build a combined view, a "2 occurrences here" affordance, or any arithmetic that lets a
  visiting occurrence contribute to a date that already resolves its own state.
- **Consistency tracking / a %-shown-up figure for as-needed routines (R24 / F27).** The
  as-needed variant is **deliberately untracked**; computing, showing, or "gamifying" a
  consistency % for it is a non-goal. Its manual logging is **reference-only** history with
  **zero effect** on F5, and it earns **no XP of either kind (no lifetime XP F13, no Cycling XP
  F31), no achievements, no confetti.**
- **A custom/arbitrary Cycling-XP reset interval beyond weekly or monthly (R25 C / F31).** The
  user picks exactly **weekly** or **monthly** (default monthly); "every N days," quarterly, or
  any open-ended interval is a non-goal.
- **Tenure badges as consistency/streak achievements, or gated on the Cycling XP counter /
  per-cycle records (R25 A / F29).** Tenure badges are **calendar-time-elapsed only**; gating
  them on consecutive usage, cumulative counts, any consistency threshold, or any Cycling XP
  value is a non-goal — the two systems run in parallel and neither feeds the other.
- **Replacing F5's primary quick-glance % windows with the F28 all-time graph (R26).** The graph
  is an **additional, deeper, human-confirmed ADDITIVE** view; removing the primary 7 / 30 /
  all-time simple % (the all-time % specifically) is a non-goal.

**Deferred to P2 (not in v1):**
- **F22 — cloud sync: true multi-device conflict resolution.** v1 ships best-effort,
  local-authoritative sync (F20); full convergent conflict resolution is gated on the §7
  sync-depth decision and is out of v1.

## 5. Non-functional requirements

**Performance.**
- **Offline-first**: **all P0 features function fully with the network off** (incl. F25
  erase-all). Among P1, the **network-dependent exceptions** are: the AI assistant (F16), managed
  billing (F17 — purchase, trial, cancel, Restore), the BYO endpoint validation and inference
  (F18), and cloud sync (F20). Everything else in v1 — including F26's extended cadences, F27's
  as-needed routine (manual logging is purely local), and the entire R25/R26 motivation layer
  (F28 graph, F29 tenure badges, F30 per-cycle records, F31 Cycling XP counter — all computed
  on-device from local history) — works offline.
- Cold launch to interactive Today: target ≤ 2.0 s on a mid-range supported device (iOS/Android).
- State-change (chip tap) → visible update + F5 recompute: perceptibly immediate (≤ 100 ms UI,
  no relaunch).
- Lists (Today, Routines, future type tabs) scroll smoothly with hundreds of tasks/records.
- AI assistant (F16): streaming responses render incrementally; slow/failed network shows a calm
  state, never a hang or red full-screen.

**Offline behavior.** Core habit loop never depends on connectivity. Assistant, billing, and
sync degrade calmly and non-destructively when offline.

**Locale / market.** English-only copy, US pricing ($4.99/mo, $39.99/yr via the app stores).
Architected for i18n (no hard-coded concatenated strings blocking later locales). Launch markets:
US Apple App Store and US Google Play.

**Accessibility floor (ship-blocking).**
- Full **screen-reader** navigation of every screen and control (VoiceOver / TalkBack); all
  interactive elements labeled.
- **Dynamic Type / adjustable text size**: layouts usable and non-clipping at the largest system
  text size on both platforms.
- **Contrast**: WCAG 2.1 AA for text and meaningful UI across the Streakforge cream/warm palette
  in **both** Light and Dark themes; signal colors remain distinguishable. **NOTE:** which hue
  carries the **fallback signal** under Streakforge (whose forge-orange is the app-wide primary)
  is an **unresolved designer decision (§7)**; the AA-contrast and signal-distinguishability
  requirement holds **regardless** of the final hue.
- **F28 all-time consistency graph** must have an **accessible, non-color-only representation**
  (screen-reader-readable data points / values); a chart cannot rely on color or shape alone.

**Device / OS matrix.** Phones on **both iOS and Android** (no tablet/iPad layout committed in
v1). Minimum supported iOS/Android versions = §7 architect decision (proposed floor: versions
supporting native widget extensions and current Expo). No web/browser matrix. Build must be
**submittable to both the Apple App Store and Google Play**.

**Privacy / security (ship-blocking).** Zero analytics. No accounts. Habit data and identity
never leave the device for any core feature. BYO key stored on-device only, never reaching
Fallback's backend. Managed-assistant message content (and only that) leaves the device to reach
Groq via the thin backend — disclosed to the user (F9/paywall copy).

## 6. Data & content notes (seed data, sample content, fixtures needed)

- **Fixed vocabularies (constants):** Importance = {High, Med, Low}; Necessity = {Must-do,
  Recommended, Optional}.
- **Fixed signal colors (constants, accent-immune):** ideal, fallback, off, missed. State chips:
  {To do, Done, Fallback, Skip}. The concrete hue assignment under Streakforge (incl. the
  forge-orange-vs-fallback conflict) is a designer decision (§7). ("Missed" is a derived history
  label, not a stored chip state.)
- **Recurrence cadences (R23, closed set):** {daily, specific weekdays, weekly, bi-weekly,
  monthly, bi-monthly, yearly}. **P0 exercises `daily` + `specific weekdays` for Routines**
  (F2/F23); coarser cadences and repeating Events are F26 (P1). No custom/cron cadence (§4). Each
  cadence yields the task's **occurrence set** (F5 and F23/F24 compute over it). **The as-needed
  variant (F27) has NO cadence and NO occurrence set.**
- **Per-task `snoozable` flag (F7):** a persisted boolean on the task record, **default on**,
  editable after creation. Ship the demo fixture with **at least one non-snoozable task** (e.g. a
  fixed-time "School run" routine) alongside snoozable ones, so qa-tester can assert the snooze
  slot renders **disabled** on the former and enabled on the latter, and that toggling the setting
  flips that rendering immediately. Also ship **one already-snoozed occurrence** so the
  "Undo snooze" rendering, the impossibility of a second snooze, and undo-restores-the-original-day
  are all reproducible on-screen.
- **Snooze precedence fixtures (F7 §3.7, one-live-outcome-per-date):** three fixtures, one per
  case — (1) a snooze landing on a date that **already carries its own logged state** (target's
  state displays and counts; the visitor contributes nothing to F5 or XP); (2) a snooze landing on
  a **naturally-due, never-logged** date (the target's own blank state displays — assert **no XP
  materialises** at the target and the % is unchanged by the visitor); (3) a snooze landing on a
  **not-naturally-due** date (the visitor displays and counts there). Every fixture must satisfy
  `numerator = denominator − missed`, proving exactly one outcome per date.
- **Per-sub-step, per-parent-occurrence toggle state (R22 / F23 / F24):** a **persisted** on/off
  toggle per sub-step, a **subset of the parent's own occurrence set** (for the P0 daily/weekday
  cadence this is its selected weekdays). Stored on the task's ideal/fallback step records; the
  schema must model it so a day's due-set, Today's step list (F6), F3's counts-only-due-sub-steps
  computation, and F5 recompute are derivable. Governs **ideal** sub-steps; the whole-task
  **fallback** is not per-occurrence toggled. Save-time validation rejects any config leaving a
  parent-occurrence with zero due ideal sub-steps. **Ship the "Studying" Mon–Fri fixture** whose
  "weekly assignments" step is toggled **ON for Friday only** — so Tuesday-logs-ideal,
  Friday-requires-the-step, and toggle-all-off-Tuesday-rejected-at-save are reproducible.
- **As-needed routine (R24 / F27) records:** a Routine with no cadence (hence no occurrence set),
  optionally ideal+fallback, storing **reference-only "used/triggered" log entries** (a date, and
  an ideal/fallback marker if defined). These are **history only**: schema keeps them **out of**
  F5's numerator/denominator at both scopes and **out of** F13/F31 XP recomputation. **Ship an
  "Emergency plan" as-needed routine** (no cadence) with two "used it" log dates, so qa-tester can
  assert adding such a log moves **neither** the consistency % **nor** XP (lifetime or Cycling),
  and that the routine **never** appears as due on Today.
- **Per-task consistency-% fixtures (from F5):** `(ideal + fallback) / (shown-up + missed) × 100`,
  off days excluded from BOTH sides, future days **and a still-pending unlogged today** excluded,
  **rounded to nearest whole percent (pinned)**. Assert: **26/26** (4 off, 0 missed) → **100%**;
  **26/30** (4 off, 4 missed) → **87%**; **26/31** (missed, not off) → **84%**; and a
  **pending-today** fixture (one task due today, To do, not off, not Skip-chipped) → today's
  occurrence in **neither** side, % unchanged. (These replace IDEA.md's stale 26/30-with-off-days
  example.)
- **Aggregate (scope-2) fractional fixture (from §3.5):** the 3-day window — Day 1 = 2/2 → f=1.0,
  Day 2 = 1/3 → f≈0.333, Day 3 fully off → excluded — asserting the aggregate reads **67%**
  (Σf=1.333 ÷ 2 days), **not** the superseded all-or-nothing 50%; plus a pending-today aggregate
  case (1 done + 1 pending-today → f=1/1=1.0). Anchors the proportional rollup so it cannot
  silently regress to all-or-nothing.
- **R25 fixtures (tenure / records / Cycling XP):** (a) a **tenure** fixture — a fixed first-use
  anchor + a device clock advanced to **day 366 with zero showing-up activity**, asserting the
  **1-year** tenure badge unlocks (calendar-time-only, consistency-independent); (b) a
  **per-cycle-record** fixture spanning ≥2 completed cycles so an archived record's windowed %
  reproduces F5's arithmetic; (c) a **Cycling-XP** fixture crossing a cycle boundary (final value
  archived into the F30 record, live counter resets to 0, lifetime XP unchanged) **and** a
  mid-cycle cadence-change case (immediate archive of the short partial cycle, reset to 0, fresh
  cycle under the new cadence). Also assert a **one-off Event** completion earns **both** lifetime
  and Cycling XP, while marking an **as-needed routine "used" 50×** earns **0 of either** and
  creates no record entry.
- **R26 graph fixture:** enough history to exercise **weekly → monthly → yearly** bucket
  coarsening, each bucket's point equal to F5's fractional % windowed to that bucket (no new
  formula), with a screen-reader-readable representation present.
- **Schema version + migration fixtures:** at least one older-version data fixture so F1's
  migration path is testable without data loss.
- **Onboarding sample content:** copy for the ideal/fallback + "no streaks" + no-account/on-device
  explainer screens (F9). No real user data seeded.
- **Empty-state content** for every list surface (Today, Routines, P1 type tabs, filter-no-results,
  dashboard low-data / all-off / zero-denominator "no data yet" — never "0%") — calm, on-brand,
  non-punitive, never blank, never red. The **post-erase fresh-install** state (F25) reuses these.
- **Demo/QA seed set** (for qa-tester/screenshots, not shipped): a small "Maya" fixture — e.g. a
  "Movement" routine (ideal = 30-min workout; fallback = 5-min walk) and a "Read" routine (ideal =
  20 pages; fallback = 1 page), spanning several days with a mix of ideal / fallback /
  skipped(→missed) / off days so F5's "% showed up" and the F7 heatmap render meaningfully.
  Include **at least 4 missed days and some off days** so the **87% example (26/30, per-task
  scope)** is reproducible, and so adding/removing an **off** day visibly does **not** move the %
  while a **missed** day does. Plus the 3-day mixed fixture so the **67%** aggregate anchor is
  reproducible on-screen too.
- **AI guardrail test fixtures (F16/R15):** the medical logs-literally-vs-declines pair
  ("antibiotics 2×/day" vs. "right dose?") and the eating-disorder pair ("eat lunch daily" vs.
  "under 800 cal to lose weight fast"), plus one refusal case for each remaining harmful category.
- **No analytics keys, no ad SDKs, no telemetry endpoints** in any fixture or config.

## 7. Open decisions (deferred to architect / designer / human)

Carried from FEATURES.md and REQUIREMENTS.md, plus decisions this PRD surfaces. **None blocks
P0, and none is OWNER: human** (the last human-owned item — the day-level rollup — is now settled;
Decisions item 18).

- **F5 / F30 aggregate breakdown display fork & "X of Y days" framing (display/copy).** The
  aggregate **%** is settled (proportional/fractional credit, §3.5 scope 2); two downstream
  *display* forks are not: (1) whether the aggregate dashboard and F30 per-cycle records report
  the ideal/fallback/off breakdown as **proportional sums** or keep ideal-vs-fallback **purely
  per-task** (a single day can now mix ideal/fallback/off/missed, so the whole-day label no longer
  applies); (2) the **"X of Y days" framing** — X is no longer a whole day-count, so keep "days"
  only by expressing X as the rounded Σ of fractional credits (Y stays the whole denominator
  day-count) or switch to a pure "%". **OWNER: spec-writer / designer (NOT human — do not
  re-escalate).**
- **F28 all-time consistency graph — placement & granularity thresholds.** F28 reuses F5's
  fractional formula per bucket (no new math) and is human-confirmed **ADDITIVE** (F5's primary
  %-windows, incl. the all-time %, stay unchanged). Open, design/architect only: (a) exact "hidden
  deeper" placement (a "See full history" affordance from the F5 dashboard vs. Settings →
  Progress/Badges) — the requirement pins only that it is a **secondary, non-Today** surface; (b)
  the exact data-volume cutovers for weekly → monthly → yearly bucketing (R26 proposes ~3 months
  and ~3 years) — the pinned rule is only that granularity **coarsens as history grows**. **OWNER:
  screen-designer / architect.**
- **R25 tenure first-use anchor event.** Which concrete event fixes the tenure anchor date (F29) —
  install vs. first launch vs. first-task creation — is a small detail; the requirement pins only
  that it is **one fixed calendar date, consistency-independent, and device-local** (a genuine
  erase-all/reinstall restarts it). Whether an enabled cloud sync (F20) carries the anchor across
  devices is a minor architect detail. **OWNER: spec-writer / designer.**
- **As-needed routine (F27) surfacing & history-view treatment.** F27 pins that it appears in the
  Routines browse (F6), never on Today, and that its history shows only reference-only "used it"
  dates (no off/missed/ideal-by-due-day cells). Open (design only): where the "trigger / log used
  it" control lives, the exact history treatment (used-dates list vs. sparse marker calendar), and
  how the create flow lets a user pick the as-needed variant. The functional rules are **fixed**.
  **OWNER: designer / screen-designer.**
- **Snooze-slot visual treatment and where the per-task `snoozable` toggle is surfaced in the
  create flows (F7 × F2/F11).** §3.7 pins the **functional** rules — the two-slot action row, the
  snooze slot's three renderings (enabled / disabled / "Undo snooze"), the flag's default (**on**)
  and its post-creation editability from the manage sheet via the existing inline-edit pattern.
  Open (design only): the visual treatment of the disabled and "Undo snooze" renderings (the
  Gate-2 design contains neither — §3.7's Design precedence block), and whether the create screens
  expose the `snoozable` toggle up front or leave it to the manage sheet. **The functional rules
  are fixed and must not be re-opened. OWNER: designer / screen-designer.**
- **REACHING "UNDO SNOOZE" FOR A DORMANT OCCURRENCE (F7) — genuinely undefined; blocks one
  qa-tester assertion.** §3.7's precedence rule means a snoozed occurrence that lands on a date
  which resolves its **own** state (case 1 or 2) is displayed **nowhere**: its source date reads
  not-due, its target date shows the target's own state. Its data is **dormant, not lost**, and
  revives if the occurrence returns home — but **no specified surface offers the undo control that
  would send it home.** **This is the common case for any daily-cadence task** (snoozing an
  already-logged occurrence always lands on a naturally-due, unlogged day).
  **Checked and ruled out as an existing answer:** none of the task-centric browse surfaces
  exposes per-occurrence state or an undo affordance — `ALLSCREENS_1.md` **S10 line 425** ("No
  `StateChip` here (logging happens on Today or inside S20)"), **S11 line 476**, **S12 line 525**
  ("No `StateChip` on the row — tap → S20"), **S13 line 571** (plain binary checkbox, To-dos only,
  which have no occurrences), and **S14 line 624** ("same `Card` row style … no `StateChip`"). All
  five route to S20, which is date-based. So the Gate-2 design contains **no** surface that would
  reveal a dormant occurrence.
  Candidate resolutions, **none chosen here** — a task-centric entry point that renders current
  effective occurrence state; a persistent "snoozed" indicator on the source date's sheet; or an
  **accepted product tradeoff** that this case simply is not undoable. **If the accepted-tradeoff
  option is chosen, surface it to the human** — losing reversibility in the common case is a
  product concession, not a styling call. **Does NOT block the F7 build:** snooze, the precedence
  rule, and the undo mechanic itself are fully specified and buildable; only the **reachability**
  assertion waits on this. **OWNER: designer / screen-designer** (escalate to human only for the
  accepted-tradeoff branch).
- **Cloud sync mechanism & depth (both platforms).** What provides sync on **Android** (iCloud has
  no Android equivalent): a platform cloud-drive, a cross-platform sync layer, or none — and is
  real multi-device conflict resolution required in v1, or is best-effort/local-authoritative the
  v1 target (driving the F20 vs. F22 split)? Scoped as **best-effort in v1** pending this call.
  **OWNER: architect.**
- **R22 sub-step subsetting for single-occurrence cadences (R22 × R23).** For weekly … yearly
  cadences (F26, one occurrence per period), per-occurrence toggling is largely degenerate. Whether
  the UI even exposes a subset control for those cadences, and how any subset is expressed over an
  unbounded future occurrence stream, is left to design/architect. The rule (subset of the parent's
  own occurrences; never outside them; no empty run-occurrence) is fixed; only its surfacing is
  open (affects F26/F23/F24). **OWNER: designer / architect.**
- **Managed-tier STT source.** Does Groq provide the speech-to-text on the subscription path, or is
  a separate transcription service needed? (Affects F16/F17 backend build.) **OWNER: architect.**
- **Exact Groq model(s)** for the managed assistant — implementation-phase choice. **OWNER:
  architect.**
- **Minimum supported OS versions (iOS and Android)** and the RN/Expo ↔ native widget-extension
  approach for F21 (WidgetKit + Android app widgets, each a separate native target). **OWNER:
  architect.**
- **Backup artifact format & location** for F19 (exported file vs. Files app / Android storage),
  consistent with no-account/no-server. **OWNER: architect.**
- **BYO paywall placement & visual treatment.** Where the BYO base-URL/key option appears on the
  paywall (Flow 6) and how it is presented as an *equal alternative* — a **deliberate departure
  from the source's pure-subscription Flow 6 with real monetization impact** (F18 caveat). The
  functional requirement is fixed, only placement/treatment open. **OWNER: screen-designer.**
- **Accent color palette + signal-color lock.** The constrained accent set that keeps signal
  colors distinguishable in both themes (F8). **OWNER: designer.**
- **Streakforge forge-orange vs. Fallback fallback-orange color conflict.** Fallback reserved
  **orange** as the fixed **fallback** signal, but Streakforge makes **forge-orange (`#E8590C`)**
  its app-wide primary/CTA and reserves **gold** for XP/celebration. Which hue carries the fallback
  signal vs. primary CTA vs. gold celebration accent is **deliberately not resolved here** — an
  explicit **Phase 2 design-system-agent** call. The PRD fixes only the *rule* (signal colors are
  constant and accent-immune). **OWNER: designer (Phase 2 design-system agent).**
- **F5 dashboard window defaults, display formatting & whether a "missed" count is shown** (which
  windows to offer, layout of the number and ideal/fallback/off breakdown, whether a missed count
  appears). **OWNER: designer.** NOTE: the **rounding rule is NOT open** (nearest whole percent,
  pinned by the worked examples); the **off-day exclusion is NOT open** (human-directed); the
  **pending-today carve-out is NOT open** (§3.5); the **aggregate proportional/fractional rollup is
  NOT open** (settled, §3.5 scope 2). The designer owns windows, layout, and the missed-count
  display choice only.

---

## Decisions appendix (REQUIREMENTS ↔ FEATURES conflict resolutions)

1. **"Must-have R1–R26" vs. "most are P1."** REQUIREMENTS lists R1–R26 under "Must-have
   capabilities" (reads all-P0); FEATURES stages only a subset as **P0**, the rest **P1
   fast-follow**. **Resolution:** "Must-have" = **"in v1 scope,"** not "in the first build slice."
   Every R1–R26 ships in v1; the P0/P1 split is **build ordering** on MVP merit. This PRD is the
   source of truth for P1 too (§3B) — P1 is *not* out of scope.

2. **R20 cloud-sync depth & Android mechanism.** v1 ships F20 best-effort, **local-authoritative**
   sync (opt-in, off by default) via iCloud on iOS and an Android-side equivalent (architect, §7);
   true multi-device conflict resolution is **F22 (P2)**, gated on the §7 architect decision.

3. **RN/Expo — both iOS and Android are v1 targets (Gate-1 scope change).** An earlier pass scoped
   iOS-only; REQUIREMENTS/FEATURES revise this: **both ship in v1**, to both stores. The RN/Expo
   stack is unchanged; each iOS-native surface gets an **Android equivalent** built and tested in
   parallel (biometric, billing, widgets, sync). Min OS versions and the Android sync mechanism are
   §7 architect decisions.

4. **Privacy promise vs. managed assistant.** "Data stays on this device" covers **habit data and
   identity**; **assistant message content the user chooses to send** is outside it and disclosed
   at the assistant/paywall boundary (F9, F16, F18). BYO-key traffic bypasses the backend (R19).

5. **F-numbering gaps.** No F10 (folded into F14); F23/F24, F25, F26, F27, F28, F29/F30/F31 appended
   out of section order. **Resolution:** preserved for traceability; **F23 & F25 are P0**; **F24,
   F26, F27, F28, F29, F30, F31 are P1**. Not an error.

6. **[SUPERSEDED by item 13 — retained for history] Off-day math — earlier resolved interpretation,
   flagged for human veto.** A prior round had off days **in the denominator** (diluting the %),
   flagged for Gate-1 veto. **The human exercised that veto directly**, redefining the formula in
   R4/R6 (into F4/F5). Kept for history; **no longer current guidance** — see item 13. The "off days
   dilute" reading must not be carried forward.

7. **R15 "clearly harmful" boundary — defined here (not deferred).** The testable guardrail
   categories and the logs-literally-vs-advises distinction are specified in F16 (§3B), with two
   canonical qa-tester pairs (medical; eating/restriction).

8. **BYO-path guardrails are best-effort.** R15 guardrails are enforced on the **managed** path; on
   the **BYO** path Fallback applies its own pre-send/system-prompt guardrails but cannot guarantee a
   third-party model's behavior. **Resolution:** BYO-path enforcement is an accepted best-effort
   limitation, stated as a deliberate call.

9. **BYO-on-paywall is a deliberate source departure (monetization).** Surfacing BYO as an *equal
   alternative* departs from the source's pure-subscription Flow 6 and offers a no-revenue unlock
   path beside the paid one. **Resolution:** carried in v1 per R18/F18; functional requirement fixed;
   placement/treatment delegated to screen-designer (§7). Flagged as intentional with revenue impact.

10. **R22 sub-step scheduling split across the P0/P1 line.** R22 is one requirement; FEATURES splits
    into **F23 (Routines, P0)** and **F24 (Courses AND Events, P1)**. **Resolution:** honored. F23 is
    P0 (entailed by the F2/F3 routine model and IDEA Flow 8.1 — once steps vary by occurrence, the
    counts-only-due-sub-steps rule is required, else a not-due step wrongly reads as a miss). F24 is
    P1 (net-new; depends on F11 + F12 + F26). All three operate over the parent's own **occurrence
    set** (R22 generalized per R23, item 14). **The as-needed variant (R24/F27) has no occurrence set,
    so R22/F23/F24 do not apply.**

11. **Design system swap: Streakforge replaces "Verdant" (Gate-1 change).** Adopted as a *design
    system only* — (a) the product **stays "Fallback"**; (b) **no breakable-streak mechanic** — the
    gold-flame/StreakBadge/confetti visuals are repurposed as a celebration motif for F13, F29
    tenure badges, F30 per-cycle records, and F31 Cycling XP counter only; (c) the
    **forge-orange-vs-fallback-orange** conflict is **not resolved here** — a designer
    (Phase 2) decision (§7). All prior "Verdant" references are updated to Streakforge.

12. **Zero-due-occurrence edge (R22 fold) — resolved by save-time validation, not a denominator
    carve-out.** An occurrence the parent runs on which **every** ideal sub-step is toggled off is
    made **unreachable** — F23/F24 **reject at save** (same class as F2's "no selected days"). This
    confines the fix to the R22 material and leaves F5's denominator and the "missed" definition
    untouched: the equivalence *parent-occurrence ⟺ due ⟺ ≥1 ideal sub-step due* holds, "ideal" is
    never vacuous, every "missed" is real, and the per-occurrence toggle governs only **ideal**
    sub-steps while the whole-task **fallback** stays available on every run-occurrence.

13. **Off-day / consistency-% formula — REVERSED by human direction (authoritative; supersedes item
    6).** **off days are excluded from BOTH the numerator and the denominator** of F5, so they
    **neither raise nor lower** the %; only **missed (grey)** days lower it. **Resolution
    (authoritative in §3.4/§3.5):** `(ideal + fallback) / (shown-up + missed) × 100`, off days
    excluded from both sides, future days excluded, **rounded to nearest whole percent (pinned)**.
    IDEA.md's stale off-in-denominator examples are **superseded** — 22 ideal + 4 fallback + 4 off +
    0 missed reads **100% (26/26)**; + 4 missed reads **87% (26/30)**; Flow 5's 26/31 → 27/32 holds
    only for **missed-not-off** (84% → 84%). Human-directed, **no longer a Gate-1 veto item**.
    qa-tester asserts the new numbers. The aggregate day-level rollup — previously the last open
    Gate-1 item — is now **also settled** (proportional/fractional credit); see item 18.

14. **R23 cadences extended + optional Event recurrence + R22 generalized to occurrence sets.** R23
    adds weekly / bi-weekly / monthly / bi-monthly / yearly across all scheduled types, and makes
    **Events one-off by default but optionally recurring** (a repeating Event stays type "Event").
    R22 generalizes to "**subset of the parent's own occurrence set**." **Resolution:**
    daily/specific-weekday for **Routines** stays **P0** (F2/F23); extended cadences + optional Event
    recurrence are **P1 (F26)**; **F24 covers Courses AND Events (P1)**; no custom/cron recurrence
    (§4). **The as-needed variant (R24/F27) carries no cadence at all.**

15. **Erase-all promoted to P0 (F25); F19 becomes backup/restore only (human-directed R21
    re-slice).** F25 is a full P0 feature (§3.11) — one-tap, confirmed, purely-local erase to a
    fresh-install state. F19 (§3B) is now backup/restore only. The prior §7 "promote erase-all?" open
    item is **removed** — decided (P0). This lifts the P0 count from ten to **eleven** (F1–F9 + F23 +
    F25).

16. **In-progress "today" — pinned as *pending*, not missed (spec-writer resolution).** An
    **unlogged, un-Skipped today** is **pending** — in **neither** the numerator **nor** the
    denominator, so it cannot lower the % — until it resolves: (a) a showing-up state → numerator;
    (b) a **Skip** (resolves to missed on any day, including today) → denominator as missed; or (c)
    the day ending still unlogged/un-Skipped → the due, non-off day becomes **missed** on the next
    read. "Elapsed" = *every past day, plus today only once it carries a logged showing-up state or a
    Skip*. Keeps `numerator = denominator − missed` and "only missed days lower the %" true at every
    read, including mid-day. Stated identically in §3's "missed" definition, §3.5, and §6.

17. **As-needed routine (R24) added as F27 (P1) — Routine sub-variant, untracked; plus the
    no-XP/no-celebration product-planner call.** **Resolution (authoritative in §3B F27, with
    cross-references from §3.2, §3.5, §3.7, §3B F13, §4, §6, §7):** it is a **Routine sub-variant**,
    **NOT** a fifth type and **NOT** a To-do/Note; **no R23 cadence, no occurrence set** (R22/F23/F24
    do not apply); **ideal+fallback OPTIONAL**; **excluded from F5 at both scopes** by a
    **structurally different mechanism** from off-days (it has **no due days at all**); a **manual,
    reference-only "used it" log** is exposed with **zero effect on the %.**
    - **XP-eligibility is occurrence-based, NOT cadence-based (get this right — it cost REQUIREMENTS
      two rounds and FEATURES one).** An as-needed-routine log fires **no XP of either kind — no
      lifetime XP (F13) AND no Cycling XP (F31) — no achievements, and no milestone/confetti
      celebration.** XP is keyed on **having a due OCCURRENCE at all** (recurring OR one-off): a
      **one-off Event** has **no cadence** but **does** have a due occurrence, so it **earns** both
      lifetime and Cycling XP — proof the operative property is the due occurrence, not the cadence.
      An as-needed routine has **NEITHER a cadence NOR any due occurrence**, so nothing
      occurrence-bearing anchors XP; rewarding a schedule-less self-serve log would be a **farm
      exploit**. A calm "logged to history" acknowledgment is allowed but carries no reward
      semantics. **Enforced identically in F13, F27, and F31**, matching REQUIREMENTS R24/R7/R25(C).
      **Visible at Gate 1:** if the human wants as-needed logs to earn XP or celebrate, that is
      theirs to reverse.
    - Still **core / free** (R16); **P1 on MVP merit** (opts out of the loop the P0 line proves),
      **not** deferred. **Does not change the P0 count** (still eleven). The three human-confirmed
      R24 items (name "As-needed routine", optional ideal+fallback, reference-only logging) are
      **settled — downstream must not re-open them.**

18. **Overall-dashboard day-level rollup — SETTLED by human direction as PROPORTIONAL / FRACTIONAL
    daily credit (was the LAST open Gate-1 item; supersedes the previously-proposed all-or-nothing
    default).** After confirming the human meant the **aggregate/overall** dashboard (IDEA Flow 9.1's
    "87% / 26 of 30 days" screen — distinct from any single task's own % and from F23's
    sub-step-due-that-day rule, both already settled and unaffected), the human settled it as
    fractional credit: each calendar day contributes **f(D) = (its due, non-off, resolved tasks shown
    up) ÷ (its due, non-off, resolved tasks)**, and **aggregate % = Σ f(D) ÷ (count of elapsed days
    with ≥1 due, non-off, resolved task) × 100**, rounded to nearest whole percent. **Resolution
    (authoritative in §3.5 scope 2):** it **degenerates exactly** to the per-task formula on uniform
    (one-due-task) days (so the 100% / 87% anchors are scope-2 examples too), **excludes** zero-due /
    all-off days from the denominator, and **excludes pending tasks per-task from both sides** of that
    day's fraction. qa-tester must assert the 3-day anchor (2/2, 1/3, fully-off → **67%**, not the
    superseded 50%). The all-or-nothing default is **superseded and must not be carried forward.** The
    prior §7 "day-level rollup — OWNER: human" open item is **removed** — decided; **no §7 item remains
    OWNER: human.** Two residual **display** forks (breakdown proportional-sums-vs-per-task; "X of Y
    days" framing) are spec-writer/designer calls (§7), not human ones. **F30's per-cycle record % and
    F28's per-bucket graph points reuse this exact windowed formula — no new calculation.**

19. **R25 (tenure badges / per-cycle records / Cycling XP counter) added — F29 / F30 / F31, all P1,
    all core/free.** A human-directed extension of R7's achievements, folded in without re-litigation:
    - **F29 tenure/anniversary badges** — **11 tiers** (first day, 1 week, 1 month, 2 months, 6
      months, 1 year, 2 years, 5 years, 10 years, 20 years, 50 years), earned by **calendar time
      elapsed since a fixed first-use anchor only** — consistency-independent (a user absent 11 months
      still gets the 1-year badge on day 366), **not** streaks, **not** cumulative counts, **not**
      gated on Cycling XP. Distinct axis from F13's "Showing up" count badges; IDEA's "1 year"
      milestone is reclassified as the 1-year tenure tier.
    - **F30 permanent per-cycle records** — a browsable recap per cycle (monthly default / weekly if
      selected) whose consistency % **reuses F5 scope-2's fractional formula windowed to the cycle**
      (not a new calculation); permanent, append-only, never overwritten.
    - **F31 Cycling XP counter** — accumulates by the **same XP-eligibility rules as lifetime XP
      (F13)** but scoped to the current cycle; user-set **weekly / monthly** cadence (default monthly),
      label follows cadence ("Monthly XP" / "Weekly XP"); archived into F30 **before** resetting to 0
      at each boundary; a mid-cycle cadence change immediately archives the short partial cycle then
      starts fresh (deterministic, non-punitive — archive always precedes zeroing). **Only F31's
      counter cycles; lifetime XP/Level (F13), the tenure clock and earned tenure badges (F29), and
      all-time consistency (F5) never reset.** **XP-eligibility is occurrence-based, uniform across
      F13 and F31** (item 17): occurrence-bearing tasks (recurring OR one-off — a one-off Event counts)
      earn both; as-needed routines earn zero of either. All three are **core/free, P1 on MVP merit**
      (motivation/retrospective layers reusing existing math; they do not gate the P0 proof).

20. **R26 all-time consistency trend graph added — F28 (P1, core/free), human-confirmed ADDITIVE.** A
    secondary, "hidden deeper" all-time trend graph whose points **reuse F5 scope-2's fractional
    formula per time bucket** (no new calculation), auto-coarsening granularity (**week → month →
    year**) as history grows (exact thresholds a screen-designer/architect call, §7; the pinned rule
    is only that it coarsens). **Resolution:** it is **ADDITIVE, not a replacement** — F5's primary
    7 / 30 / **all-time simple %** windows stay **completely unchanged** (the all-time % specifically
    remains the primary at-a-glance number); F28 is a new, separate, secondary surface beneath it
    (placement a screen-designer call, §7), never on Today. Ship-blocking accessibility rider: a
    non-color-only, screen-reader-readable representation (§5).

21. **(2026-07-27) F7 occurrence management NARROWED to a one-hop, per-task-gated snooze —
    human-directed amendment inside the approved Gate 1.** Recorded here rather than by re-running
    the planning pipeline; `STATUS: APPROVED` is unchanged and Gate 1 is **not** reopened.
    **What changed (authoritative in §3.7; §4 carries the matching non-goals; REQUIREMENTS R9 carries
    a matching CHANGE NOTE):**
    - **(a) Snooze is exactly one hop, once.** An occurrence dated D moves to **D + 1** and no
      further. There is **no target-date input** anywhere, and an **already-snoozed occurrence
      cannot be snoozed again** — so **chains are unreachable by construction**, not merely
      discouraged. §3.7 also pins what the first draft left unstated: snooze acts **only** on the
      occurrence the sheet is displaying (never from the heatmap drill-down); the **closed list
      of snoozable occurrence states** is pending / ideal / fallback / missed / off — everything
      except *not-due*; and a **one-live-outcome-per-date** precedence rule governs what the target
      date shows (below).
    - **(b) The arbitrary-date "Move to another day" action is removed**, and F7's interaction
      details now **supersede the Gate-2 design in three named places**, enumerated in §3.7's
      **Design precedence** table: `ALLSCREENS_1.md` **lines 1025 / 1072** (three actions → two);
      **line 1055** ("Snooze / Move to another day → *inline pickers*" → Snooze now takes **no input
      at all**); and three **additions** the design does not contain (Undo snooze, the disabled
      Snooze rendering, the `snoozable` toggle). Everything else in S20 is untouched and remains
      controlling. **The design is not regenerated and screen-designer is not re-invoked** — this is
      a documented, bounded precedence carve-out, not a redesign.
      **Evidence this follows the designer's own signal rather than overriding it:** in the rendered
      mockup (`design-input/fallback-handoff/Fallback Handoff.dc.html`, **line 867**) the three
      tiles are iconed **Duplicate = `copy`**, **Snooze = `alarm-clock`**, and the third — labeled
      **"Move day"** in the render — **`calendar-days`**. The design already distinguished a
      fixed-amount push (an alarm clock, which never asks you to pick a time) from free date
      selection (a calendar). Keeping the alarm-clock action input-free and dropping the calendar
      tile is consistent with that distinction; line 1055's shared "inline pickers" phrasing is read
      as shorthand spanning both tiles.
    - **(c) `snoozable` becomes a per-task boolean**, chosen by the task creator (a school run
      shouldn't be snoozable; a homework assignment might be), **default on**, and **editable after
      creation** from the manage sheet via S20's **existing** inline-edit pattern (inline-editable
      name, tag pickers) — an extension of an editability pattern that already exists, not a new one.
      When off, the snooze slot renders **disabled, not hidden**.
    **Why (the motivation, recorded so it is not re-expanded later).** The general form — any
    occurrence to any future date, chained moves, cross-task merges — took **four engineering review
    passes and two senior-advisor escalations**, and produced roughly **300 automated tests** just to
    cover chains, merges, and one subtle data-corruption defect. The human watched that cost and
    elected to **narrow the feature rather than keep hardening it**. This is **settled human product
    direction**, not a reviewer's or spec-writer's inference, and is not to be second-guessed or
    re-broadened.
    **One live outcome per date — DESCRIBED, not invented.** §3.7's precedence rule (target's own
    logged state wins; else a naturally-due-but-unlogged target shows its own blank state, never the
    visitor's, so no XP is manufactured for an untouched day; else the visitor displays) is a
    faithful mirror of the **already-implemented, already-tested** read resolution in
    `docs/SCHEMA.md` §4.2. It is recorded in the PRD because it is **user-visible product behaviour**
    that the amendment's "carries with it" language would otherwise have contradicted — not because
    anything about it is newly decided.
    **Deliberately still true — merges are NOT eliminated (stated as a PRODUCT INVARIANT; the
    case-level mapping is the architect's, not this document's).**
    - Two **different** tasks may each independently snooze one day forward onto the **same date**.
      Two occurrences sharing a date **stays in scope** (resolved by the precedence rule — one of
      them displays and counts, never both).
    - Any scenario in which an occurrence sits on a date its **own** task has vacated — reachable
      through a **sequence of independent one-hop snoozes on different occurrences** (e.g. on a
      daily task: snooze D+1's occurrence to D+2, then snooze D's occurrence to D+1) — **also stays
      in scope.**
    - What is eliminated is exactly two things: **(i)** a **single** occurrence travelling more than
      one hop; and **(ii)** any scenario requiring **two or more source occurrences of the same
      task** to reach the same target date — unreachable under a strict D → D+1 rule, which maps
      distinct source dates to distinct targets.
    - **No SCHEMA case IDs are named here, deliberately.** Mapping this invariant onto
      `docs/SCHEMA.md` §4.2's case table — which rows die, which survive, which need restating — is
      the **architect's** call. The PRD states only what must remain reachable and what is now
      unreachable.
    **DELEGATED CALL — flagged as spec-writer inference, NOT a literal human instruction.** The human
    specified one-hop and per-task gating but did **not** separately rule on undo. Under delegation I
    pinned: **undo survives the rescope** — a snoozed occurrence can be returned to its original day,
    restoring its prior state exactly, and afterwards it is in the never-snoozed state and may be
    snoozed again (still only ever one day forward). *Reasoning:* the product's whole posture is
    forgiveness and reversibility (no streaks, off days neutral, calm retry on every failure, an
    explicit erase/recovery surface); a one-way push-forward would be the app's only irreversible
    occurrence action, and one-hop-with-no-undo would let a single mis-tap permanently relocate an
    occurrence. **Pass-2 caveat, stated honestly:** the undo *mechanic* is sound and specified, but
    the amendment surfaced that its *reachability* is undefined in the common daily-cadence case —
    a dormant occurrence displays nowhere, and no specified surface offers its undo control. That is
    now an **open §7 item**, checked against S10–S14 and confirmed unanswered by the existing design;
    it is **not** silently assumed to work. **Visible to the human: if snooze should be one-way, or
    if the unreachable case is an acceptable tradeoff, that is theirs to decide.**
    **Downstream consequence (NOT fixed by this amendment).** `docs/SCHEMA.md` §4.2's move contract
    is now **broader than this PRD requires**: its arbitrary-target machinery, its chain-collapse
    handling, and its multi-day distance guard all describe capability the PRD no longer asks for.
    **The architect owns reconciling SCHEMA / ARCHITECTURE / MODULES to the narrower contract**; no
    schema, architecture or source file was edited here. Reconcile against the **invariant above**,
    not against a case-ID list supplied by this document. What the PRD does pin: the two scenarios
    named in-scope above must still be **correctly handled after the simplification**, so the
    residue / write-carrier machinery that lets an occurrence visit a date its own task has vacated
    — and the read-resolution precedence that keeps exactly one outcome live per date — must **not**
    be deleted alongside the chain machinery.
