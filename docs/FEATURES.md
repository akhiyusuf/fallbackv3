# Feature plan — Fallback

Traceability: every feature lists the R-IDs it covers. Every R-ID (R1–R26) is
covered by at least one P0/P1 feature or explicitly deferred with a reason.

## Scope note (read first)
The human's stated v1 appetite is "everything in the doc" — all 12 flows,
including the AI assistant, achievements/XP, and widgets — shipping to **both the
Apple App Store and Google Play** (iOS and Android are both v1 targets, same
RN/Expo stack). That appetite shapes the **ordering below**: almost nothing is
pushed to "Later (P2)"; the expensive extras are staged as **P1 fast-follow** so
v1 can still reach submission on both stores. But the MVP line is drawn on merit,
not appetite.

**MVP thesis:** the single thing v1 must prove is that Fallback's core
mechanic — every habit has an *ideal* and a *fallback* version, doing the
fallback still "counts," off days are neutral (never a miss **and excluded from
the consistency %**), and consistency is *"% of days you showed up"* with **no
streak** — actually keeps the all-or-nothing quitter showing up on hard days.
Only features that directly serve validating that loop are P0. The assistant,
billing, XP, the **tenure/anniversary badges, per-cycle records, and cycle-scoped
Cycling XP counter (F29 / F30 / F31)**, the **all-time consistency trend graph
(F28)**, widgets, cloud sync, three of the four task types, the coarser
recurrence cadences (weekly … yearly), and the **no-cadence "as-needed" Routine
sub-variant** (which opts out of the loop entirely — F27) do not gate that proof,
so they sit below the line. The P0 recurrence surface is deliberately just
**daily + specific weekdays** — enough to exercise the whole loop (see F2, F26).

**Task-type shape (so nobody counts a fifth type):** there are **four** top-level
task types — **Routines, Events, Courses, To-dos/Notes.** The **Routine** type has
**two sub-variants**: the default **recurring** routine (on an R23 cadence — F2 at
P0, extended cadences via F26) and the **as-needed** routine (no cadence, no
tracking — F27 at P1). The as-needed variant is **still a Routine** (it keeps the
routine's step / ideal-fallback structure), **not a fifth top-level type** and
**not** a To-do/Note. See F2's sub-variant note and F27.

Accessibility (screen reader — VoiceOver on iOS / TalkBack on Android — Dynamic
Type / adjustable text size, contrast on both themes) and "zero analytics / no
telemetry" are ship-blocking **constraints**, not features. They are properties
of every feature below and appear in each acceptance list where relevant — they
are never a line item. (Note: the F28 all-time consistency graph carries a
specific accessibility rider — a chart needs a non-color-only, screen-reader-
readable representation — see F28.)

**Design system:** the visual/component system is the provided **Streakforge
Design System** (it replaces the earlier "Verdant" placeholder). Adopting it does
NOT rename the product — the app stays named and positioned as **"Fallback."**
Two binding Streakforge constraints ride into the features below: (a) the gold
flame / StreakBadge / confetti visuals are a **celebration motif for the XP /
achievements feature (F13, plus R25's tenure badges F29 / records F30 / Cycling XP
F31) only** and carry **no breakable-streak semantics** (see F13); (b) the
Streakforge forge-orange-vs-Fallback-fallback-orange color conflict is an explicit
**Phase 2 design-system-agent** decision and is NOT resolved here (see F8).

**Feature numbering:** there is no F10 — the number was retired during planning
(a candidate feature was folded into F14). The F9 → F11 gap is intentional; no
feature is missing. F23/F24 (R22 sub-step scheduling), **F25 (erase-all, P0)**,
**F26 (extended recurrence cadences, P1)**, **F27 (as-needed routine, P1)**,
**F28 (all-time consistency graph, P1)**, and **F29 / F30 / F31 (R25 tenure badges
/ per-cycle records / Cycling XP counter, all P1)** are appended out of section
order — the IDs are not section-ordered.

---

## MVP (P0)

### F1 — On-device data store & persistence  [M]  covers: R20 (on-device default portion)
Story: As Maya, I want all my habits and their history saved on my device with
no account, so that my data is private and survives app restarts.
Acceptance:
- App requires no login/account to reach any P0 feature.
- Tasks, per-day completion states, and off-day marks persist across app
  restart and OS reboot.
- No data leaves the device for any P0 feature; no analytics/telemetry call is
  ever emitted (verifiable by inspecting outbound network traffic — zero calls).
- Data model is versioned/migratable so later features (XP, sync, extended
  cadences) can extend it without data loss.
- Deleting the app removes all data (no residual server copy exists to remove).
P0 justification: nothing else can be tested or trusted if habit data doesn't
reliably persist locally with the promised no-account privacy.

### F2 — Routines with ideal + fallback  [M]  covers: R1 (Routines only), R2, R23 (daily / specific-weekday cadence for Routines)
Story: As Maya, I want to create a recurring routine that has both an ideal
version and a fallback version, so that on a hard day I still have a way to show
up.
Acceptance:
- User can create a recurring Routine with a name, icon, color, and a
  **recurrence cadence**. P0 covers the **daily** and **specific-weekday**
  cadences (the R23 subset the whole core loop is proven with); the coarser R23
  cadences (weekly / bi-weekly / monthly / bi-monthly / yearly) ride with F26 (P1).
- User can define an **ideal** version (its steps) and a **fallback**
  (minimum-viable) version for the same routine; both are required to save a
  trackable routine.
- User can set Importance (High/Med/Low) and Necessity (Must-do/Recommended/
  Optional) from the two fixed vocabularies — no free-form tags accepted.
- Ideal/fallback/off signal colors are fixed and are not affected by the accent
  color (which concrete hue plays each signal role is a Phase 2 design decision —
  see F8).
- Created routines appear on Today when due (per the cadence's occurrence set),
  with a defined empty state before any exist.
P0 justification: the ideal+fallback recurring habit is the atomic unit the
entire product thesis rests on — there is no MVP without it; daily/weekday
recurrence is all the cadence the core loop needs to be validated.

> **Routine sub-variants note (R1 / R24) — read alongside F27.** The Routine
> *type* has two sub-variants: the default **recurring** routine specified here (a
> **trackable**, cadenced routine) and the no-cadence **as-needed** routine
> (F27, P1). The as-needed variant is **still a Routine** — it keeps the step /
> ideal-fallback structure — **not a fifth top-level task type** and **not** a
> To-do/Note. F2's hard **"ideal+fallback both required to save"** rule above is
> deliberately scoped to **trackable (cadenced)** Routines (per R2, which binds
> only trackable tasks); it does **NOT** bind the untracked as-needed variant,
> where ideal+fallback is **optional** (F27). Everything else in F2 that
> presupposes a cadence — the occurrence set, Today due-listing, F5 consistency,
> F23 sub-step toggles — simply does not apply to the as-needed variant.

### F3 — Complete & log: ideal / fallback / showed up  [M]  covers: R3
Story: As Maya, I want completing all steps to log "ideal" and completing fewer
to log "fallback," with both counting as showing up, so that a partial effort is
never treated as failure.
Acceptance:
- Completing all ideal steps logs the day **ideal**; completing at least the
  fallback but fewer than ideal logs **fallback**; both record as "showed up."
- **Counts only due sub-steps (R22 × R3):** on a task with per-occurrence
  sub-step toggles (F23 for Routines, F24 for Courses and Events), "all ideal
  steps" for a given occurrence means all sub-steps **due that occurrence** — a
  sub-step not due that occurrence is excluded from that occurrence's completion
  set and neither helps nor blocks the ideal/fallback result. (Testable: on a
  Tuesday, a Friday-only step is not due, so completing every due step that
  Tuesday logs the day **ideal**; on Friday that step is due and must be completed
  for the day to log ideal.)
- User can tap a state chip to override to any of: To do / Done / Fallback /
  Skip.
- Logged state for a day is visible and editable for that day.
- A skipped/not-done day is recorded without any punitive language, red
  full-screen, or streak-break messaging.
- State changes persist (F1) and immediately update the consistency figures
  (F5).
P0 justification: the completion mechanic is how "something beats nothing" is
actually experienced; without it the ideal/fallback distinction is inert.

### F4 — Off days (neutral, never a miss, excluded from the %)  [S]  covers: R4
Story: As Maya, I want to mark a day as an off day, so that a genuinely
unavailable day is never treated as a failure, never breaks anything, and never
drags my consistency down.
Acceptance:
- User can mark a day (or a task's day) as an **off day**.
- An off day is neutral: it is **never counted as a miss and never triggers a
  reset, streak-break, or XP penalty** (mirrors R4's exact scope).
- **An off day is excluded from the consistency metric entirely (R4/R6):** it is
  removed from **BOTH** the numerator and the denominator of F5's formula, so it
  **neither raises nor lowers** the %. (This is the human-directed, authoritative
  reading. The earlier reading that had off days sitting *in* the denominator and
  *diluting* the % is **superseded** — do not carry it forward.)
- Off days are still **counted and shown separately** as their own category
  (ideal / fallback / **off**) in the breakdown; they simply do not affect the
  percentage.
- An off day can be un-marked, restoring the day to its prior state.
P0 justification: an off day that is truly neutral to the % — never a miss and
never a drag — is the explicit anti-streak promise, the core differentiator
quitters are told they can trust; getting its math right is load-bearing for F5.

### F5 — Consistency dashboard ("% you showed up," no streak)  [M]  covers: R6
Story: As Maya, I want to see the percentage of days I showed up over a window,
so that I judge myself on consistency rather than an unbroken streak.
Acceptance:
- Dashboard shows "% of days you showed up" over a selectable window, broken
  down into ideal / fallback / off counts, with **no streak** concept anywhere.
- The metric is computed exactly as R6 (human, verbatim response of record)
  defines it:
  **consistency % = (ideal days + fallback days) / (shown-up days + missed days)
  × 100**, where **off days are excluded from BOTH the numerator and the
  denominator.** Equivalently: numerator = days shown up (ideal or fallback);
  denominator = due, non-off days that have elapsed (shown-up + missed). Every
  due, non-off elapsed day is either shown-up or missed, so
  `numerator = denominator − missed`.
- **Missed (grey) days are the only thing that lowers the %** — they stay in the
  denominator but not the numerator. **Off days never appear in the fraction at
  all.** Fallback completions raise the numerator (never treated as misses).
- **This metric exists at two scopes (both must be computed):**
  1. **Per-task** (IDEA Flow 3, "shown up 5 of 6 days"): denominator = that
     single task's own due, non-off, **elapsed** occurrences; numerator =
     occurrences it was shown up (ideal or fallback). **Each occurrence is a whole
     0-or-1 outcome. This scope is UNCHANGED by the aggregate fractional rule below**
     (the human confirmed the fractional change is the aggregate/overall dashboard
     only, not a single task's own %, and not F23's sub-step-due-that-day rule —
     both already settled and untouched).
  2. **Overall / aggregate dashboard** (IDEA Flow 9.1, "26 of 30 days") — **SETTLED
     by the human as PROPORTIONAL / FRACTIONAL daily credit** (this closes the last
     open Gate-1 item; it is **no longer** an OPEN flag). Instead of classifying a
     mixed calendar day as a single all-or-nothing shown-up/missed bucket, **each
     calendar day contributes a FRACTION** to the aggregate:
     - **day fraction f(D) = (D's due, non-off, resolved tasks that were shown up) ÷
       (D's due, non-off, resolved tasks).**
     - **aggregate % = ( Σ f(D) over every elapsed day D with ≥1 due, non-off,
       resolved task ) ÷ ( count of elapsed days that have ≥1 due, non-off, resolved
       task ) × 100**, rounded to the nearest whole percent.
     - So the **numerator is a SUM of per-day fractions** (not a count of whole
       days), while the **denominator stays a day-COUNT**. A day with 2 of 3 due
       tasks shown up contributes **2/3 ≈ 0.667**, not a binary 0 or 1.
     - **Degenerates exactly to the per-task formula.** When every counted day has
       **exactly one** due, non-off task, each f(D) is 0 (missed) or 1 (shown up);
       Σ f(D) = the count of shown-up days and the denominator = shown-up + missed
       days, so the aggregate reduces **exactly** to the discrete per-task formula
       `(shown-up) / (shown-up + missed) × 100`. The whole-day 100% / 87% anchors
       below are precisely this uniform/degenerate case.
     - **Zero-due / all-off days are excluded from the denominator entirely.** A day
       with **no** due, non-off, resolved task (nothing due, every due task marked
       off, or every due task still pending) contributes **nothing** and is removed
       from the denominator (it can neither raise nor lower the %). Off-ness is
       applied **per task within the day**: a day with 2 due tasks where 1 is off and
       1 was shown up has f(D) = 1/1 = **1.0** (the off task dropped from **both**
       sides), not 1/2.
     - **Pending-today composes per-task, not per-day.** A **pending** (unlogged,
       un-Skipped, still-today) task is excluded from **both** sides of its day's
       f(D) — the fraction is over that day's **resolved** (shown-up + missed) due,
       non-off tasks only. A day with 1 done + 1 pending-today task contributes
       1/1 = **1.0**, not 1/2, and the day does not stay pending waiting on it. If
       **every** due, non-off task on a day is pending, the day has zero resolved
       tasks and is (per the exclusion above) simply not yet in the denominator — it
       enters once any of its tasks resolves.
     - **Breakdown display under fractional credit is a downstream fork (OWNER:
       spec-writer/designer, NOT settled here).** Once a single day can mix ideal,
       fallback, off and missed tasks, the old whole-day ideal/fallback/off day-count
       label no longer applies as-is; whether the aggregate reports the breakdown as
       proportional sums or keeps ideal-vs-fallback purely per-task is a display call
       (it also governs F30's per-cycle-record breakdown). Likewise the "X of Y days"
       framing is now inexact (X is no longer a whole day-count). See "Flags carried
       to Gate 1."
- **As-needed routines (R24 / F27) contribute nothing to this metric at either
  scope.** Having **no cadence**, they have **no "due" days**, so they never
  enter the numerator or the denominator (per-task or overall) and never produce
  a "missed" day. They are excluded **not** by the off-day rule (F4) but for a
  prior reason — they are never "due" at all. Under the aggregate proportional rule,
  an as-needed routine's tasks are simply never among a day's "due, non-off,
  resolved tasks," so they enter neither f(D) nor the day count. A manual
  reference-only log on an as-needed routine (F27) still does not touch this fraction.
- **Testable worked examples qa-tester must assert (these REPLACE the stale
  IDEA.md 26/30 = 87% example, which assumed off days in the denominator):**
  - *(Uniform/degenerate case — every counted day is a whole 0-or-1 outcome:)*
    22 ideal + 4 fallback (26 shown-up), **4 off, 0 missed** → 26 / 26 = **100%**
    (off days excluded, so they do NOT dilute). The source's "26/30 = 87%" for
    this exact breakdown is superseded and now reads 100%.
  - *(Uniform case:)* 26 shown-up, **4 off, 4 missed** → 26 / (26 + 4) = 26/30 =
    **87%** (off excluded; the 4 *missed* days are what sit in the denominator).
  - **NEW mixed-day aggregate anchor (the fractional rule — qa-tester must assert
    this exact arithmetic, the way the per-task formula has its 26/30 anchor):** a
    3-day window. **Day 1:** 2 due, non-off tasks, both shown up → f = 2/2 = **1.0**.
    **Day 2:** 3 due, non-off tasks, 1 shown up, 2 missed → f = 1/3 ≈ **0.333**.
    **Day 3:** every due task marked **off** (zero due, non-off, resolved tasks) →
    **excluded from the denominator entirely.** Denominator = **2** (days 1–2
    qualify; day 3 excluded); numerator = Σ f = 1.0 + 0.333… = **1.333…**; aggregate
    % = 1.333… / 2 × 100 = 66.67 → **67%**. qa-tester must assert **67%**
    (proportional credit), **NOT** 50% (the superseded all-or-nothing reading, which
    would score Day 2's partial effort as a whole miss).
  - **Pending-today mixed example:** a day with 2 due, non-off tasks — 1 logged
    shown-up, 1 still pending today — contributes f = 1/1 = **1.0** (pending excluded
    from both sides), identical to what the day would contribute if the pending task
    did not exist, until it resolves.
  - Flow-5 partial survival ("26 of 31 → 27 of 32") holds **only if** the
    non-shown days are **missed** (grey), not off; a genuine off day would be
    excluded from the 31/32 entirely.
- Empty/low-data state reads as calm and encouraging, never punitive; a window
  with zero due, non-off elapsed days (including an all-off window) shows the "no
  data yet" state (never a division-by-zero, never "0%").
P0 justification: this is the scoreboard that replaces streaks — the payoff
screen that makes the whole mechanic legible, and the primary success-criterion
check; the exact (now human-settled, including the aggregate fractional rule)
formula is load-bearing and can reach the spec-writer only via this feature.

### F6 — Today view & basic browse with empty states  [M]  covers: R8 (Today/tabs/empty-state portion)
Story: As Maya, I want a Today view and a place to see my routines, each with a
sensible empty state, so that I always know what to do next.
Acceptance:
- Today lists tasks due today with their current state chips.
- A Routines browse surface lists all routines.
- Every list has a defined, on-brand empty state (never a blank screen).
- Navigation between Today and Routines is reachable via the app's primary tab
  structure.
- Fully operable via the platform screen reader (VoiceOver / TalkBack) and at
  large Dynamic Type / adjustable text sizes.
P0 justification: without a Today surface the user has no daily entry point to
the loop; browse+empty-states are the minimum shell the mechanic lives inside.
(Filter/search and the Events/Courses/To-do tabs are P1 — see F11/F15.)

### F7 — Manage-task sheet  [M]  covers: R9
Story: As Maya, I want one sheet to manage a task, so that I can edit, tidy, and
remove habits without hunting through screens.
Acceptance:
- One sheet offers: edit, duplicate, pick icon/color, snooze, move to another
  day, and delete.
- Delete requires an explicit confirmation.
- The sheet shows a per-day calendar heatmap of that task's history (ideal /
  fallback / off / missed).
- Edits, duplicates, and moves persist (F1) and reflect immediately on Today and
  the dashboard.
- All controls are screen-reader-labeled (VoiceOver / TalkBack) and
  contrast-compliant on both themes.
P0 justification: routines that can't be edited, moved, or deleted become dead
weight fast — basic lifecycle management is table stakes for daily use.

### F8 — Theme, accent & fixed signal colors  [S]  covers: R12
Story: As Maya, I want Light/Dark/Auto and an accent color, so that the app is
comfortable to look at without ever confusing my accent with the fallback
signal.
Acceptance:
- User can set theme to Light, Dark, or Auto (follows system).
- User can pick an accent color that recolors only CTAs and progress.
- Accent never recolors the fixed ideal / fallback / off signal colors; the
  three signal colors stay constant so the metric stays legible.
- Contrast is sufficient across the (Streakforge cream/warm) surface palette in
  both themes (accessibility gate).
P0 justification: the ideal/fallback/off color signal is how state is read at a
glance — locking it against accent bleed protects the core mechanic's legibility
and is a ship-blocking accessibility concern, so it can't wait.

> **Phase-2 design-system-agent decision (from R12 / REQUIREMENTS Open Questions —
> NOT resolved here):** Fallback's convention reserves orange as the fixed
> *fallback* signal, but Streakforge's forge-orange (`#E8590C`) is its app-wide
> *primary/CTA* color and Streakforge also reserves gold for XP/celebration
> visuals — these token semantics conflict. **Which concrete hue carries the
> fallback signal vs. the primary CTA vs. the gold celebration accent is an
> explicit Phase 2 design-system-agent call.** This feature fixes the *rule*
> (signal colors are constant and immune to the user accent); it deliberately does
> not fix the hues, and downstream must not silently resolve the conflict.

### F9 — First-launch onboarding & permission priming  [S]  covers: R8 (onboarding/first-launch flow), R20 (privacy framing)
Story: As a first-time user, I want a short onboarding that explains the
ideal/fallback idea and asks for permissions gently, so that I understand the
promise before I commit.
Acceptance:
- First launch explains the ideal/fallback + "no streaks" premise in a few
  screens.
- The no-account / on-device-privacy promise is stated plainly.
- Any OS permission (e.g. notifications, when F14 ships) is primed with a
  rationale before the system prompt, and the app is fully usable if declined.
- Onboarding is skippable and does not recur after completion.
- Fully accessible (VoiceOver / TalkBack, Dynamic Type).
P0 justification: the core mechanic is unusual enough that an unonboarded user
misreads "fallback" as failure — the framing is part of the product, not
decoration.

### F23 — Per-occurrence sub-step scheduling for Routines (subset/toggle)  [M]  covers: R22 (Routines portion)
Story: As Maya, I want to toggle each step of a routine on or off for specific
occurrences within the routine's own schedule, so that a step like "finish weekly
assignments" lands only on Friday while the rest of the routine runs every
weekday.
Acceptance:
- For a Routine, each sub-step can be toggled on/off per **occurrence**; a
  sub-step's active occurrences are a **subset of the parent routine's own
  occurrence set** (the days/dates the parent is due, per its R23 cadence) — a
  per-occurrence on/off (toggle) selection over the parent's schedule, NOT an
  independent or arbitrary recurrence rule.
- A sub-step can be set to occur on **all** of the parent's occurrences or
  **limited to a subset**; consequently it can **never** be due on a day the
  parent routine does not run.
- **P0 scope is the daily / specific-weekday cadence** (the case where a week
  contains several occurrences and subsetting is meaningful — the IDEA Flow 8.1
  "Heavy lifts M·W·F" case). Subsetting over coarser single-occurrence-per-period
  cadences (weekly … yearly) is largely degenerate and its surfacing rides with
  F26 (P1) / is a design-architect detail (see Open questions); the underlying
  rule (subset of the parent's own occurrences, never outside them) is identical.
- Testable (weekday case): a "Studying" routine running **Mon–Fri** with a
  "finish all weekly assignments" sub-step toggled **ON for Friday only** shows
  that step only on Fridays; the routine's other steps remain due every weekday,
  and a reader can name the exact due-days from the toggle state.
- An occurrence's ideal/fallback determination (F3) counts **only the sub-steps
  due that occurrence** — a not-due sub-step neither helps nor blocks (so on a
  Tuesday, completing every due step logs the day **ideal** even though the
  Friday-only step exists).
- **No empty run-occurrence (save-time invariant):** a toggle configuration that
  leaves any parent occurrence with **zero** due ideal sub-steps is rejected at
  save (same class of rule as "a recurrence with no selected days cannot be
  saved"), so the equivalence *"D is a parent occurrence" ⟺ "the task is due on D"
  ⟺ "≥1 ideal sub-step is due on D"* holds — "ideal" is never vacuous and every
  "missed" is a real miss.
- Toggle state persists (F1) and drives which steps appear on Today for that
  occurrence.
P0 justification: the routine model in F2/F3 (and IDEA Flow 8.1's "Heavy lifts
M·W·F") already has steps that vary by weekday, and once they do the
counts-only-due-steps rule is *required* — otherwise a not-due step reads as a
miss, breaking the anti-punitive metric the entire P0 line rests on. (This P0
call was reviewed with the advisor: it holds on entailment from the F2/F3 routine
model and the source's own Flow 8.1, not on appetite. The generalization from
"weekdays" to "occurrences" per R23 does not change the P0 case — daily/weekday
routines are exactly where subsetting is non-degenerate.) **Does not apply to the
as-needed variant (R24/F27):** with no occurrence set there is nothing to
subset — see F27.

---

## Fast-follow (P1)
Ordered ahead of "Later" deliberately, because the human wants all 12 flows in
v1 and targets submission to both the Apple App Store and Google Play. These are
real fast-follows, not the MVP.

### F11 — Events, Courses & To-dos/Notes task types  [M]  covers: R1 (remaining types), R23 (Event optional-recurrence framing)
Story: As Maya, I want Events (one-off by default, optionally repeating),
fixed-end-date Courses, and unscheduled To-dos/Notes, so that Fallback holds more
than just recurring routines.
Acceptance:
- User can create an **Event** (scheduled at a set time — **one-off by default**,
  but **optionally recurring** on an R23 cadence, becoming a repeating event; the
  repeating-event capability and the coarse cadences themselves ride with F26), a
  **Course** (fixed end date, runs its cadence until the end date), and a
  **To-do/Note** (no schedule).
- A non-recurring Event is simply the "does not repeat" option; turning on a
  cadence does **not** change its type to Routine — it stays an Event.
- Trackable types (Events, Courses) carry ideal+fallback (R2) and log via the
  same completion mechanic (F3); To-dos/Notes need no ideal/fallback.
- Each type appears under its own tab plus the To-do/Notes lens, each with a
  defined empty state.
- Courses show progress toward their end date.
P0-demotion reason: the ideal/fallback thesis is fully provable with Routines
alone; the other three types broaden coverage but don't gate the proof, and each
adds scheduling/end-date surface. Fast-follow because the human wants full type
coverage in v1.

### F27 — As-needed routine (no-cadence Routine sub-variant, untracked)  [S]  covers: R24
Story: As Maya, I want to set up a routine I only run when a specific situation
actually happens — an emergency, a bankruptcy, a camping trip — with no schedule
and no consistency score, so that a contingency plan I may trigger rarely or never
doesn't sit on Today nagging me or drag down a percentage.
Acceptance:
- User can create a Routine as an **as-needed routine** (user-facing name
  **"As-needed routine"**, human-confirmed) — a Routine sub-variant that keeps the
  routine **step structure** but has **no recurrence cadence** (none of R23's
  cadences), therefore **no occurrence set**. It lives in a **triggered / on-demand**
  state, used whenever the situation it plans for occurs — or never.
- It is a **Routine, NOT a To-do/Note**: it stays under the Routine type and keeps
  the step / ideal-fallback structure; what it drops relative to a normal Routine is
  the **schedule (cadence)** and the **consistency tracking**, not the structure. (A
  To-do/Note, by contrast, is unstructured with no ideal/fallback.) It is **not a
  fifth top-level task type** — see the Task-type shape note and F2's sub-variant
  note.
- **Ideal + fallback is OPTIONAL for this variant (human-confirmed).** The user
  **MAY** define ideal+fallback versions (so "something beats nothing" still applies
  when the situation hits — do the full plan, or the minimum) but is **not forced
  to**. F2's hard "both required to save a trackable routine" rule is scoped to
  **trackable** Routines (R2) and does **NOT** bind here. Neither required nor
  forbidden — settled; downstream must not re-open it.
- **Never appears as "due"** on any day: it does not surface on Today as a scheduled
  item, produces no "missed" day, and is not part of F5's day-level rollup.
- **Excluded from the consistency % entirely (F5), at BOTH scopes** — it never
  enters the numerator or denominator (per-task or overall) and never produces a
  "missed" day. This exclusion is a **different mechanism from the off-day rule
  (F4):** an off day is a *due* day removed from the denominator; an as-needed
  routine has **no due days in the first place**.
- **Manual "used it / triggered" logging is EXPOSED and REFERENCE-ONLY
  (human-confirmed).** The user **MAY** manually mark it done/triggered on the date
  the situation occurred (and, if ideal+fallback is defined, as ideal or fallback
  per F3's step rule), building a personal **history** (e.g. "used the emergency plan
  on Mar 3"). Such a log is **reference-only**: it never counts as "due," never feeds
  F5's %, and never creates a "missed" day — **zero effect on the consistency %.**
  Settled; downstream must not re-open it.
- Manual logging fires **no XP / achievements (F13), no Cycling XP (F31), and no
  milestone/confetti celebration** — see the XP/celebration resolution below. A calm
  confirmation that the use was recorded to history is allowed; it carries none of
  F13's reward semantics.
- Still **core / free** (part of R16's free tier) — a variant of an existing free
  capability, not a paid one; never gated behind the assistant subscription.

Does NOT do (explicit, so downstream does not silently re-add):
- **No cadence** (R23 does not apply) and **no occurrence set**.
- **No consistency tracking** — R6 / F5 does not apply; it never appears in the
  %-shown-up figure at either scope. (It is an explicit v1 non-goal to compute,
  show, or "gamify" a consistency % for it.)
- **No R22 / F23 / F24 sub-step scheduling** — with no occurrence set there is
  nothing to subset; its steps are simply all present whenever it is triggered.
  There is no per-occurrence toggle and no no-empty-run-occurrence rule (both
  presuppose an occurrence set).

P0-demotion reason (the call — P1): the MVP line is drawn on one test — does the
ideal+fallback / something-beats-nothing / off-days-neutral / "% you showed up" loop
keep the all-or-nothing quitter showing up. An as-needed routine deliberately
**opts out of every part of that loop**: no cadence, no showing-up-over-time, no
consistency %. It therefore **cannot help prove the thesis**, and — cheap as it is —
it fails the P0 test the same way the other non-Routine task types (F11) do.
Cheapness is not a P0 criterion; **entailment from the core proof is, and this has
none.** It rides with F11 in the P1 task-type slice (structurally a Routine, but
functionally closest to the untracked To-do/Note that is itself P1). Being
structurally simpler than a trackable Routine — no cadence engine, no F5
integration — it is a small, low-risk P1, but P1.

XP / celebration resolution (product-planner's call — the human settled only the
consistency %, not XP/celebration): **no XP (neither lifetime F13 nor Cycling F31)
and no achievements fire from an as-needed routine log, and no milestone/confetti
celebration.** Reasoning: XP-eligibility is keyed on **having a due OCCURRENCE at
all** — a *due*, ideal-or-fallback completion of a scheduled task, whether the
occurrence comes from a **recurring** cadence (Routine, recurring Event, Course) or
a **one-off Event's single due date** — NOT on carrying a recurrence cadence. This
is the exact eligibility boundary F13 (lifetime) and F31 (Cycling) use, and matches
R7/R24/R25(C). An as-needed routine is excluded because it has **NEITHER a cadence
NOR any due occurrence at all** — it is never "due," so there is nothing occurrence-
bearing for XP to attach to. Contrast the **one-off Event**, which likewise carries
**no cadence** but **DOES have a due occurrence** (its single due date), and for
exactly that reason **earns** both lifetime and Cycling XP (F13/F31) — proof that the
operative property is the due occurrence, not the cadence. The as-needed log is,
additionally, explicitly reference-only with zero effect on consistency; minting XP
off a self-serve "I used it" log that **no due occurrence anchors** would create a
**farm exploit** (mark "used the emergency plan" repeatedly to grind XP), directly at
odds with the anti-gaming spirit that F23's no-empty-run-occurrence rule protects. So
the reward layer stays off. What IS allowed is a calm, purely **confirmational**
acknowledgment that the use was recorded to history (humane, and consistent with the
reference-only framing) — it is not F3's scored celebration and carries none of F13's
reward semantics. **(This matches REQUIREMENTS R24/R7/R25(C), which key XP-eligibility
on a *due occurrence* — recurring or one-off — and state the same
zero-XP-of-either-kind rule for the no-cadence, no-due-occurrence as-needed variant
verbatim — no regression, and no contradiction with F13/F31.)**

### F12 — Multi-dose courses  [M]  covers: R5
Story: As Maya, I want a course that has several doses per day, so that
something like a medication or multi-session course tracks each occurrence.
Acceptance:
- A Course can be configured with multiple doses/occurrences per day.
- Each occurrence completes independently.
- The day counts once all doses for that day are handled.
- Partial-dose days log via the ideal/fallback mechanic consistently with F3.
P0-demotion reason: depends on Courses (F11) existing and is the most complex
scheduling case; not needed to validate the core loop. Fast-follow with F11.

### F24 — Extend sub-step scheduling to Courses and Events  [M]  covers: R22 (Courses + Events portions)
Story: As Maya, I want the same per-occurrence sub-step toggling on Courses and
(repeating) Events, so that a course or event sub-step can be limited to certain
of the parent's own occurrences.
Acceptance:
- The same subset/toggle model as F23 applies to Courses **and Events**: a
  sub-step's active occurrences are a **subset of the parent's own occurrence
  set** (the days/dates the Course or Event is due per its R23 cadence), and it
  can never be due on a day the parent does not run.
- **Events (R22 Events portion):** a repeating Event (F11/F26) carries the
  identical three rules — subset of the Event's own occurrence set,
  counts-only-due sub-steps (F3), and the no-empty-run-occurrence save-time
  invariant (F23). The non-degenerate case is a **specific-weekdays** Event: e.g.
  a **Mon–Fri** repeating Event with a "wrap-up" sub-step toggled **ON for Friday
  only** shows that step only on the Event's Fridays, its other steps stay due
  every weekday, and a Tuesday on which every due step is completed logs the day
  **ideal** even though the Friday-only step exists; a configuration that leaves
  any of the Event's occurrences with zero due ideal sub-steps is rejected at
  save. A **one-off Event** is the degenerate single-occurrence case (its
  sub-steps are simply all due on its single occurrence).
- Sub-step scheduling is **day-level, not per-dose (R22 × R5):** for a multi-dose
  Course (F12), a sub-step toggle marks the whole day as due-or-not for that step,
  across all of that day's occurrences — never one specific dose.
- R5's "day counts once all doses are handled" is unchanged; it combines with the
  counts-only-due-steps rule (F3) to set the day's ideal/fallback state.
- An occurrence's ideal/fallback state counts only the sub-steps due that
  occurrence, consistent with F3 and F23; the no-empty-run-occurrence save-time
  rule (F23) applies to Courses and Events too.
P0-demotion reason: sub-steps on Courses and Events are net-new — the source only
showed per-step weekday cadence for Routines (Flow 8.1), never for Courses or
Events — and this depends on Courses/Events (F11), multi-dose (F12), and repeating
Events (F26) existing. Fast-follow with F11/F12/F26. (Placement rationale:
sub-step subsetting stays consolidated in the F23/F24 pair — F23 Routines at P0,
F24 the two P1 scheduled types at P1 — rather than folding into F26. F26 owns
*occurrence-set generation* per cadence; the R22 subset/toggle rule is identical
across all three types and belongs with its sibling F23, so Events sit here, not
in F26.)

### F26 — Extended recurrence cadences (weekly … yearly) + repeating Events  [M]  covers: R23 (extended-cadence portion, all scheduled types)
Story: As Maya, I want to schedule a routine, event, or course on a weekly,
bi-weekly, monthly, bi-monthly, or yearly cadence — and turn a one-off event into
a repeating one — so that habits that don't recur daily still fit Fallback.
Acceptance:
- A scheduled task (Routine, Event, Course) can be set to any R23 cadence:
  **daily, specific weekdays** (already P0 for Routines via F2), **weekly,
  bi-weekly (every 2 weeks), monthly, bi-monthly (every 2 months), yearly.**
- Each cadence produces the task's **occurrence set** (the specific due
  days/dates). F5 consistency (denominator = due, non-off occurrences) and
  F23/F24 sub-step toggles (subset of the occurrence set) both compute over that
  occurrence set, **whatever the cadence** — no formula changes, only the
  occurrence generator differs.
- **Events** are one-off by default; enabling a cadence turns an Event into a
  **repeating Event** (weekly dinner, monthly review, yearly checkup) without
  changing its type to Routine. Courses run their cadence until the end date
  (a 10-day medication course = daily cadence; a 10-week course = weekly).
- **No custom/arbitrary recurrence** beyond the R23 set (no "every 3rd Tuesday,"
  no cron-style rules) — the cadence picker is a closed set (explicit non-goal).
- Trackable recurring Events and Courses still carry ideal+fallback (R2) and log
  via the same completion mechanic (F3).
- For single-occurrence-per-period cadences (weekly … yearly), per-occurrence
  sub-step subsetting (R22) is largely degenerate; whether/how a subset control is
  surfaced for those cadences is a design/architect detail (see Open questions).
  The rule (subset of the parent's own occurrences; never outside them; no empty
  run-occurrence) is unchanged.
- **The as-needed Routine variant (R24/F27) is the deliberate exception to R23** —
  it carries **none** of these cadences and produces no occurrence set. F26 does
  not touch it.
P0-demotion reason: the core loop is fully provable with the daily/specific-
weekday cadence already baked into P0 (F2/F23). The coarser cadences and
repeating Events change only **occurrence-set generation** — not the completion,
consistency, or off-day mechanic — and they add a real recurrence-engine surface
(sparse/unbounded occurrence streams, period anchoring, "every N weeks/months
from date X"). They ride with the very task types (Events/Courses, F11) that most
need them, all of which are P1. **In v1 per R16** (the free tier includes R23),
staged after the P0 proof — this is the same MVP-merit cut as the original P0
line, not appetite. Flagged as a build-cost surface below.

### F13 — Achievements: Level / XP system (lifetime, monotonic)  [M]  covers: R7
Story: As Maya, I want to earn levels and achievements for showing up, so that
consistency feels rewarded.
Acceptance:
- XP/Level system with Showing up, Fallback wins, and Milestones categories.
- All / Earned / Locked tabs.
- **This XP/Level is the LIFETIME, MONOTONIC tally (R7):** it **never resets,
  breaks, or goes to zero** on any missed or off day, or at any cycle boundary,
  ever (no-loss clause). It runs *alongside* the cycle-scoped Cycling XP counter
  (F31), which never replaces or zeroes it.
- **XP is earned by completions of OCCURRENCE-BEARING tasks — recurring OR one-off
  (R7).** Every completion of a **trackable task that has a due occurrence** earns
  lifetime XP, **ideal *or* fallback** — whether the occurrence comes from a
  recurring cadence (Routine, recurring Event, Course) or a **one-off Event's single
  due date**. The operative property is *having a due occurrence at all*, NOT
  carrying a recurrence cadence: e.g. completing a one-off "Dentist visit" Event
  earns lifetime XP just like a recurring Routine. Fallback completions earn XP too,
  not just ideal ones (reinforcing "something beats nothing").
- **As-needed routines (R24/F27) earn ZERO XP and no achievements** — their
  reference-only logs are outside the occurrence-based showing-up mechanic XP
  rewards (they have no due occurrence), so they earn **no lifetime XP AND no
  Cycling XP (F31)**, unlock no achievement/milestone, and fire no confetti.
  Awarding XP for a self-serve, schedule-less log would be a farm exploit (see F27's
  XP/celebration resolution). XP/achievement recomputation must ignore
  as-needed-routine logs entirely.
- Earned achievements persist (F1) and are recalculated correctly from history.
- No punitive/loss mechanic (losing XP, decaying levels, or off-day XP penalty)
  is introduced on the lifetime figure.
- **EXTENDED by R25 (all P1, all core/free):** tenure/anniversary badges (**F29**),
  permanent per-cycle records (**F30**), and a cycle-scoped **Cycling XP counter**
  (**F31**). Only F31's counter cycles (non-punitively, archiving before it zeroes);
  nothing *lifetime* here (XP/Level, tenure badges) ever resets. See F29/F30/F31.
- **Streakforge visual note (binding, from R7 / Constraints):** Streakforge's
  gold-flame / StreakBadge / confetti visuals may decorate this XP/achievements
  system (including F29's tenure badges) as a **celebration motif only** and carry
  **no streak-break semantics** — they must never reset, break, or go to zero on a
  missed or off day, and there is no "current streak count." The component name
  "StreakBadge" implies no streak mechanic; downstream (design-system,
  feature-builder) must not infer one.
P0-demotion reason: gamification amplifies motivation but the mechanic must be
shown to retain users *before* layering rewards on it — XP on top of an
unproven loop is polish on sand. Fast-follow per the human's appetite; flagged
as a build-cost surface below.

### F14 — Gentle notifications (reminders, encouragement, digest)  [M]  covers: R10
Story: As Maya, I want gentle, invitational reminders and re-entry nudges, so
that I'm invited back without guilt after a missed day.
Acceptance:
- Reminders: routine due, event starting, course dose, course ending.
- Encouragement: missed-day re-entry and milestone — invitational, never
  shaming, tone.
- Each notification type is individually toggleable, plus a daily digest.
- Local notifications only (no server push, consistent with the no-backend-for-
  user-data constraint); app fully usable if permission declined.
P0-demotion reason: the missed-day re-entry nudge is emotionally central, but
the loop can be validated in-app without push, and the full toggle matrix is
real surface. Strong fast-follow — arguably the first P1 to ship.

### F15 — Filter & search by Importance / Necessity  [S]  covers: R8 (filter/search portion)
Story: As Maya, I want to filter and search by Type, Importance, and Necessity,
so that I can find tasks as my list grows.
Acceptance:
- Filter/search by Type, Importance (High/Med/Low), and Necessity (Must-do/
  Recommended/Optional).
- Only the two fixed vocabularies are used — no free-form tag entry.
- Results update live and have a defined empty state.
P0-demotion reason: filtering matters only once a user has many tasks; a P0
tester with a handful of routines doesn't need it.

### F16 — Fallback AI assistant (voice + text, create/edit, history, guardrails)  [L]  covers: R13, R14, R15
Story: As Maya, I want to create and edit tasks by talking or typing to a real
assistant, so that setup is effortless and conversational.
Acceptance:
- Real speech-to-text + real LLM (not scripted); assistant creates/edits tasks
  mid-conversation across all four task types and drafts ideal+fallback pairs.
- User can switch between voice and text within one conversation; assistant
  disambiguates same-named tasks and supports Undo on edits.
- Every conversation is saved to a browsable, reopenable history.
- Safety guardrails: refuses clearly harmful requests, gives no medical/dosing
  advice, while still logging tasks literally (e.g. "antibiotics 2×/day" as a
  task, no dosing advice).
- **Deferred, carried verbatim from R15 (do not silently re-decide):** "The
  concrete boundary of 'clearly harmful' is deferred to the spec-writer — it must
  be defined before PRD acceptance criteria, not silently re-decided." The PRD
  rework must turn this into concrete, testable acceptance criteria, not restate
  "refuses clearly harmful requests" as an undefined hand-wave.
- Gated: only reachable with an active subscription (F17) or a valid BYO key
  (F18); reachable copy explains this on the paywall.
P0-demotion reason: the entire paid assistant sits behind the paywall by design
(R16) — the free core ships and is validated without it. Fast-follow because the
human wants it in v1; this is the single largest build item — see Cost flags.

### F17 — Managed subscription billing (Apple App Store + Google Play)  [L]  covers: R16, R17
Story: As Maya, I want to subscribe to Fallback AI through my platform's app
store with a free trial and cancel anytime, so that unlocking the assistant is
simple and trustworthy.
Acceptance:
- $4.99/mo and $39.99/yr with a 7-day free trial, billed via the platform's own
  store — **Apple App Store on iOS, Google Play on Android** (store-native only;
  no third-party or custom payment processing).
- Cancel anytime; Restore Purchases re-checks the store account (App Store or
  Google Play) with no login.
- Sensitive/purchase confirmation uses each platform's native mechanism (Face ID
  / Touch ID on iOS, biometric prompt on Android); the specific realization is an
  architect implementation detail.
- Free tier retains all core capabilities (R1–R12, R22, R23, **R24**, **R25**,
  **R26**); only R13–R15 are gated. (Tenure badges, per-cycle records, the Cycling
  XP counter, and the all-time consistency graph are all core/free — never behind
  the subscription.)
- Managed inference routes through the thin backend to Groq (an invisible
  backend vendor; the user-facing name is "Fallback AI"); the backend stores no
  user data and holds no accounts.
P0-demotion reason: billing exists only to gate the assistant, which is itself
P1; no revenue path is needed to prove the core mechanic. Fast-follow; flagged
as high-cost below.

### F18 — Bring-your-own AI key (BYO)  [M]  covers: R18, R19
Story: As Maya, I want to unlock the assistant with my own OpenAI-compatible key
instead of subscribing, so that I can avoid a subscription and keep my traffic
private.
Acceptance:
- Single OpenAI-compatible **base URL + API key** field, surfaced on the paywall
  as an equal alternative to paying and manageable in Settings (Flow 11).
- Key stored on-device only; calls go directly to the provider and never touch
  Fallback's backend.
- If the BYO endpoint supports transcription it powers voice; otherwise the
  assistant gracefully degrades to text-only for that user.
- Invalid/unreachable endpoint shows a calm, non-punitive error (never
  full-screen red).
- **Ownership caveat, carried from R18:** BYO-on-the-paywall does **not** exist
  in the IDEA.md source (Flow 6 is pure-subscription there); putting it on the
  paywall MODIFIES an already-designed screen and is a material monetization
  change (any user with an OpenAI-compatible key can bypass the subscription).
  **OWNER: screen-designer** — exact placement, visual treatment, and how it
  coexists with the existing CTA copy are a design decision, not settled here.
  This feature specifies the functional requirement (equal-alternative unlock),
  not the layout.
P0-demotion reason: an alternative unlock path for a P1 feature (the assistant)
is itself P1. Ships alongside F16/F17.

### F19 — Backup & restore  [M]  covers: R21 (backup/restore portion)
Story: As Maya, I want to back up and restore my data, so that I control my
information with no account in the loop.
Acceptance:
- User can create a backup and restore from it.
- A failed restore lands in a **non-destructive** failure state (existing data
  is not lost).
- No backup/restore path introduces an account or server-side user storage.
- Backup artifact format & location (exported file vs. Files app / Android
  storage) is an architect decision, consistent with no-account/no-server.
P0-demotion reason: on-device persistence (F1) already protects day-to-day data;
explicit backup/restore is a control users want but don't need to experience the
core loop. Fast-follow. (**Erase-all was pulled out of this feature into its own
P0 feature — see F25** — per the human-directed R21 priority signal.)

### F20 — Optional cloud sync  [L]  covers: R20 (cloud-sync portion)
Story: As Maya, I want optional cloud sync with a last-synced status, so that my
data can follow me across my devices.
Acceptance:
- Cloud sync is opt-in and off by default; on-device (F1) remains the default.
- User can see a "last synced" status.
- Sync is delivered via each platform's appropriate mechanism — **iCloud on iOS
  and an Android-side equivalent** (a platform cloud-drive or a cross-platform
  sync layer). **The concrete sync mechanism and cross-device conflict resolution
  are deferred to the architect** (iCloud has no Android equivalent — see Open
  questions).
- Sync failures are calm and non-destructive (local data authoritative on
  conflict for the best-effort v1 tier).
- **Scope pending open question** — see Cost flags: v1 delivers best-effort
  single-device-primary sync; true multi-device conflict resolution is deferred
  to P2 until the architect confirms depth.
P0-demotion reason: optional, off by default, and single-device is the stated
practical v1 target; the core loop works entirely on-device without it. High
cost (see below).

### F21 — Home-screen widgets  [L]  covers: R11
Story: As Maya, I want home-screen widgets, so that I can see and act on my
habits without opening the app.
Acceptance:
- Small · Today, Small · One task, and Medium · Up next widgets.
- Configurable as a fixed task vs. "Smart — next due."
- Widgets are provided via each platform's native mechanism — **iOS WidgetKit and
  Android app widgets**.
- Widgets reflect current on-device state and refresh appropriately.
- Widgets honor theme and the fixed signal colors.
P0-demotion reason: widgets are native platform extensions (iOS WidgetKit + Android
app widgets — real added build cost, roughly doubled across two native surfaces)
and a retention amplifier, not part of proving the core mechanic. Fast-follow per
the human's appetite; flagged below.

### F25 — Erase all data  [S]  covers: R21 (erase-all portion) — PROMOTED TO P0
> Placement note: **F25 is a P0 feature**, listed here beside its sibling F19
> (backup/restore, P1) only to keep the R21 slice legible in one place. It counts
> as part of the MVP line; the MVP (P0) section above plus F25 is the full P0 set.

Story: As Maya, I want to erase all my data with one confirmed action, so that I
can walk away completely with nothing left behind on my device.
Acceptance:
- User can erase all app data (tasks, per-day logs, off-day marks, settings, XP,
  history) from one place in Settings.
- Erase requires an explicit confirmation step (destructive-action guard);
  cancelling performs no change, and the copy states plainly that it is
  irreversible (calm, non-alarmist tone).
- After erase, the app returns to a fresh-install state (empty store; onboarding
  may re-show per F9's device-local flag) with no residual habit data recoverable
  on-device.
- Erase is purely local — no account or server is involved (consistent with the
  no-backend-for-user-data constraint); there is nothing to erase server-side
  because nothing was ever stored there.
P0 justification: **human-directed promotion (R21).** "Erase all" is the
on-device concrete of the no-account privacy promise — a privacy-first app that
can't demonstrate a one-tap, no-server wipe undercuts its central trust claim.
It is cheap (S) and depends only on F1, so there is no cost reason to defer it.

### F28 — All-time consistency trend graph  [M]  covers: R26
Story: As Maya, I want a deeper all-time graph of how my "% you showed up" has
moved over time, so that I can see my trajectory — not just today's number.
Acceptance:
- A historical trend graph plots the consistency % over the app's whole history,
  **one point per time bucket**, as a richer complement to F5's single-number
  windows.
- **Each plotted point REUSES F5/R6 scope-2's aggregate fractional formula
  (`Σ f(D) ÷ count of qualifying days × 100`) windowed to that point's time
  bucket — the IDENTICAL arithmetic to F5 and to F30's per-cycle record %.** Off
  days, pending tasks, and as-needed routines (F27) are excluded exactly as F5
  defines. This is **NOT** a new / graph-specific calculation; downstream must
  reuse F5's mechanics, not invent one.
- **Auto-coarsening granularity by data volume** so a long history stays readable:
  short history → **weekly** buckets, medium → **monthly** buckets, long →
  **yearly** buckets. (Interviewer's proposed cutovers: `< ~3 months` weekly,
  `~3 months – ~3 years` monthly, `≥ ~3 years` yearly.) **The exact thresholds are a
  screen-designer / architect judgment call** — the pinned rule is only that
  granularity **coarsens as history grows** (week → month → year). Granularity is
  driven by total history volume and is **independent of the user's F31 Cycling-XP
  reset cadence** (a weekly-cadence user can still see a monthly/yearly graph, and
  vice-versa).
- **ADDITIVE to F5, not a replacement (human-confirmed).** F5's primary
  quick-glance % windows (7 / 30 / all-time simple %) stay **completely unchanged**;
  the all-time simple % specifically remains the primary at-a-glance number. F28 is
  a **separate, secondary, "hidden deeper" surface** (e.g. a "See full history"
  affordance from the F5 dashboard, or under Settings → Progress/Badges) — never on
  Today, never the first thing a user sees. Exact placement is a screen-designer
  decision.
- The graph has an **accessible, non-color-only representation** (screen-reader-
  readable data points / values), since a chart cannot rely on color or shape alone
  (ship-blocking accessibility constraint from the Constraints section).
- Core / free (part of R16's free tier) — a view over already-free consistency
  data, never gated behind the assistant subscription.
P0-demotion reason (the call — P1): F28 is a secondary visualization layered on
the aggregate dashboard (itself P1-adjacent), explicitly "hidden deeper" and
human-confirmed **ADDITIVE** — F5's primary all-time % already gives the
at-a-glance number the core loop needs. A trend line serves *trajectory*, not
*current status*; it enriches motivation but does not gate the proof that the loop
retains users. It reuses F5's math (no new formula), so it is a low-risk P1, not P0.

### F29 — Tenure / anniversary badges  [S]  covers: R25 (A)
Story: As Maya, I want badges that mark how long I've been with the app — a week,
a month, a year, and beyond — so that simply sticking around is celebrated even on
stretches where I wasn't consistent.
Acceptance:
- User unlocks a badge at each of **11 elapsed-time tiers**, measured from a single
  **first-use anchor date**: **first day, 1 week, 1 month, 2 months, 6 months,
  1 year, 2 years, 5 years, 10 years, 20 years, 50 years.**
- **Earned purely by CALENDAR TIME ELAPSED since first use — entirely independent
  of consistency (F5) or whether the user showed up at all.** A user who ignores
  the app for 11 months and reopens on **day 366 still earns the 1-year badge.**
  Tenure badges are **NOT** consecutive-usage streaks and **NOT** cumulative
  showing-up / occurrence counts — they measure only wall-clock time (this is what
  makes them compatible with the no-streak thesis: elapsed time is unlosable). A
  "show up every day for a year" badge would violate the thesis and is explicitly
  not what these are.
- **Distinct axis from F13's existing "Showing up" count badges (must NOT
  conflate).** F13 / IDEA's "7 days" / "30 days" / "50×" / "200×" badges are
  cumulative *participation* counts; F29's "1 week" / "1 month" tiers are
  *calendar-elapsed* and are a **different badge** (a user can hold the 1-month
  tenure badge with near-zero consistency). F13 / IDEA's existing "1 year" milestone
  is **reclassified as F29's 1-year tenure tier** — one badge, not a duplicate.
- **Anchor date** = the user's first use of the app on this device (install /
  first launch / first-task creation — the precise event is a spec-writer/designer
  detail, but it must be **one fixed calendar date, consistency-independent**). It
  is **device-local**: a genuine F25 erase-all / reinstall starts a **fresh** anchor
  (a deliberate consequence of the no-account model, not a bug). Whether an enabled
  cloud sync (F20) carries the anchor across devices is a minor architect detail.
- Once earned, a tenure badge is **permanent** and, like all of F13, **never
  resets, breaks, or goes to zero** on a missed or off day, or at any F31 Cycling-XP
  cycle boundary.
- **Not gated on the Cycling XP counter (F31) or per-cycle records (F30).** Reaching
  any Cycling XP value unlocks no tenure badge; the systems run in parallel and
  neither feeds the other (the human's "that way badges unlock at first day, week,
  month…" phrasing does not gate badges on the counter — settled).
- Core / free (part of R16's free tier), never gated behind the assistant
  subscription; the Streakforge gold-flame / badge visuals may decorate it as a
  celebration motif only (no streak-break semantics).
P0-demotion reason (the call — P1): tenure badges are a motivation / celebration
layer on top of F13's achievements — like F13 they must not front-run the proof
that the core loop retains users, and they gate nothing in that loop. Cheap, but
cheapness isn't a P0 criterion; entailment from the core proof is, and this has
none. P1 with F13.

### F30 — Per-cycle records ("recaps")  [M]  covers: R25 (B)
Story: As Maya, I want a permanent, browsable recap of each past week or month —
its consistency, its highlights — so that I can look back on my history without any
of it ever being "reset away."
Acceptance:
- User can browse a **permanent per-cycle record**: for each elapsed cycle — a
  **calendar month by default, or a calendar week if the weekly cadence (F31) is
  selected** — the app finalizes a record summarizing that cycle: its **consistency
  %**, its ideal / fallback / off / missed breakdown, the **Cycling XP counter's
  final value for that cycle** (F31), and **badges (incl. tenure milestones F29)
  unlocked during that cycle.**
- **The cycle consistency % REUSES F5 / R6 scope-2's aggregate fractional formula,
  windowed to that cycle — NOT a new calculation:** `cycle % = ( Σ f(D) over the
  cycle's elapsed days with ≥1 due, non-off, resolved task ) ÷ ( count of those
  days ) × 100`, rounded to the nearest whole percent, with off days, pending tasks,
  and as-needed routines (F27) excluded exactly as F5 defines. qa-tester reuses F5's
  mechanics / arithmetic; do not reinvent a per-cycle formula.
- Records are **permanent, accumulate into a browsable history, and are never
  overwritten or lost** — a past cycle is archived, never reset away.
- **The ideal / fallback / off breakdown display fork flagged on F5** (aggregate
  scope) applies here too — a cycle's days can mix ideal/fallback/off/missed, so the
  whole-day label no longer applies as-is; whether to show proportional sums vs.
  keep ideal-vs-fallback per-task is a spec-writer/designer call, not decided here.
- A **cadence change mid-cycle** (F31) archives the in-progress cycle immediately as
  a (possibly short) record; such a short record is **permanent** like any other,
  and past records keep whatever cadence they were finalized under.
- Core / free (part of R16's free tier), never gated behind the assistant
  subscription.
P0-demotion reason (the call — P1): per-cycle records are an archival / retrospective
layer over already-computed consistency data (they reuse F5's math) — pure look-back
motivation that does not gate the proof of the core loop. P1 with F13.

### F31 — Cycling XP counter (configurable weekly/monthly, non-punitive)  [M]  covers: R25 (C)
Story: As Maya, I want a "this month's XP" counter that resets each cycle, so that
every new week or month gives me a fresh number to build — without ever touching my
lifetime progress.
Acceptance:
- A **cycle-scoped XP counter** that **accumulates XP the SAME way F13's lifetime XP
  does** — every completion of a **trackable, occurrence-bearing task (recurring OR
  one-off), ideal or fallback**, earns Cycling XP on the day it is logged, by the
  exact same rules as lifetime XP — but scoped to the **current cycle only**. It
  **starts at 0** at the first instant of each cycle and counts up.
- **Same XP-eligibility set as lifetime XP (F13), and no other:** a **one-off Event**
  earns Cycling XP on its single due date, just like a recurring Routine / Course.
  **An as-needed routine's (F27) reference-only "done/triggered" log earns ZERO
  Cycling XP** (identically to zero lifetime XP), unlocks no achievement / milestone,
  and fires no confetti — marking it "used" any number of times grants nothing (no
  self-serve grinding surface).
- **User-configurable reset cadence: exactly WEEKLY or MONTHLY (default MONTHLY)** —
  the only two options; **no** custom / arbitrary interval (no "every N days," no
  quarterly). The **user-facing label follows the cadence: "Monthly XP" when monthly,
  "Weekly XP" when weekly** (it must never read "Monthly" while weekly is active).
- **Reset mechanic (identical for either cadence):** at each cycle boundary (calendar
  week-end if weekly, calendar month-end if monthly) the counter's **final value is
  permanently archived** into that cycle's F30 record, and **then the counter resets
  to 0** for the new cycle. **Non-punitive:** the value is archived before it zeroes;
  nothing is lost.
- **Mid-cycle cadence change (settled, testable):** switching the cadence takes
  effect **immediately** — the in-progress cycle is **finalized on the spot** (its
  partial value archived as a possibly-short F30 record), the counter **resets to 0**,
  and a **fresh cycle begins under the new cadence**, running to the next natural
  calendar boundary of the new cadence. Past records keep their original cadence.
- **The reset touches NOTHING lifetime (PINNED):** lifetime XP / Level (F13), the
  tenure-badge clock and every earned tenure badge (F29), and the all-time
  consistency % / history (F5, incl. the F28 graph) are **never** reset by a
  Cycling-XP cycle boundary. Cycling XP is a fourth, distinct, deliberately-cycling
  figure running **in parallel**; the same completion increments both lifetime and
  Cycling XP as **two separate counters**.
- **Purely descriptive / archival — gates NO tenure badge (F29) and no achievement.**
  Reaching any Cycling XP value unlocks nothing on its own.
- Core / free (part of R16's free tier), never gated behind the assistant
  subscription. This cycle-boundary reset is the **sole deliberate, non-punitive
  exception** to the no-reset constraint (it archives before zeroing and never
  touches any lifetime figure) — it is a cycle-scoped tally, **NOT** a breakable
  streak.
P0-demotion reason (the call — P1): Cycling XP is a motivation layer on top of F13's
XP — the same completions, cycle-windowed. Like F13 it must not front-run the proof
that the core loop retains users, and it gates nothing in that loop. P1 with F13.
Flagged as a build-cost surface below (cycle-boundary date math + archival +
mid-cycle switch).

---

## Later (P2)
Kept intentionally thin because the human wants full v1 coverage; only genuinely
depth-deferred slices live here.

### F22 — Cloud sync: true multi-device conflict resolution  [L]  covers: R20 (conflict-resolution depth)
Story: As Maya using two devices, I want edits made offline on each to merge
correctly, so that I never silently lose a change.
Acceptance:
- Concurrent edits on multiple devices converge without data loss.
- Conflicts resolve by a defined, documented strategy (not last-writer-silently-
  wins).
- Merge behavior is covered by tests against realistic offline-edit scenarios.
Why P2: blocked by the open question on sync depth (below). The best-effort tier
in F20 satisfies R20 for v1; full conflict resolution is a distinct, heavier
build the requirements explicitly leave to downstream confirmation.

---

## Deferred requirements (with reasons)
No must-have requirement (R1–R26) is fully deferred out of v1 — all are covered
by a P0 or P1 feature above. Notable intra-requirement notes:
- **R20 (cloud sync), conflict-resolution depth only** → P2 (F22), because the
  requirements' own open question leaves single-device best-effort as the
  practical v1 target and defers real multi-device conflict strategy downstream.
  The opt-in sync surface + last-synced status (the requirement's explicit UI)
  ships in P1 (F20).
- **R21** is split: **erase-all is P0 (F25)** per the human-directed priority
  signal; backup/restore stays **P1 (F19)**.
- **R22** is fully covered across all three scheduled types — **Routines** sub-step
  scheduling is **P0 (F23)** (entailed by the F2/F3 routine model and IDEA Flow
  8.1); the **Courses and Events** extensions are both **P1 (F24)** (net-new, not
  in the source — an Event becomes a real multi-occurrence case once it repeats on
  an R23 cadence, e.g. a Mon–Fri repeating Event with a Friday-only sub-step,
  while a one-off Event is the degenerate single-occurrence case). All three types
  now operate over the parent's *occurrence set* (per R23), not literally weekdays.
  **R22 does not apply to the as-needed Routine variant (R24/F27)** — with no
  occurrence set there is nothing to subset (F27).
- **R23 (recurrence cadences)** is split on MVP merit: the **daily / specific-
  weekday** cadence for Routines is **P0 (F2)** — all the cadence the core loop
  needs to be proven. The **extended cadences (weekly / bi-weekly / monthly /
  bi-monthly / yearly)** across all scheduled types, plus **optional Event
  recurrence**, are **P1 (F26)**, in v1 per R16 but staged after the P0 proof
  because they change only occurrence-set generation, not the core mechanic. The
  **as-needed Routine variant (R24/F27) is the deliberate exception** — it carries
  no cadence at all.
- **R24 (as-needed routine)** is fully covered by **F27 (P1)** — an untracked,
  no-cadence Routine sub-variant. It is **core / free** (part of R16's free tier)
  but **P1 on MVP merit**, not deferred: it deliberately opts out of the entire
  consistency loop the P0 line exists to prove (no cadence, no showing-up-over-time,
  no %), so it cannot gate that proof (see F27's P0-demotion reason). Its manual
  logging is reference-only (zero effect on F5), it earns no XP/achievements (F13)
  and no Cycling XP (F31), and it takes no R22/R23 scheduling. It is a Routine
  sub-variant, **not** a fifth top-level task type.
- **R25 (tenure badges / per-cycle records / Cycling XP counter)** extends R7's
  achievements and is fully covered at **P1**: **F29** (tenure/anniversary badges),
  **F30** (per-cycle records), **F31** (Cycling XP counter). All are **core/free**
  (part of R16's free tier) but **P1 on MVP merit** — like F13 they are a
  motivation/celebration/retrospective layer over the core loop and do not gate its
  proof (F30 and F31 additionally reuse F5's already-built consistency math). **XP
  eligibility is uniform across lifetime (F13) and Cycling (F31):** both are earned
  only by completions of **occurrence-bearing** tasks (recurring OR one-off — a
  one-off Event counts); an as-needed routine (R24/F27) earns **zero XP of either
  kind**, no achievements, no confetti. Only F31's counter cycles (non-punitively);
  lifetime XP, tenure badges, and all-time consistency never reset.
- **R26 (all-time consistency trend graph)** is fully covered by **F28 (P1)** — a
  secondary, "hidden deeper," human-confirmed **ADDITIVE** view that reuses F5/R6
  scope-2's fractional formula **per time bucket** (no new calculation) and
  auto-coarsens granularity (week → month → year) as history grows. It does **not**
  remove or replace F5's primary 7 / 30 / all-time %-windows. Core / free.

Everything the requirements list as an **explicit non-goal** (accounts/passwords/
server user storage, analytics, non-English localization, streaks, free-form tags,
payment methods other than the platforms' own app stores, named per-provider BYO
integrations, renaming/re-branding the app away from "Fallback,"
**custom/arbitrary recurrence rules beyond the R23 cadence set**,
**consistency tracking / a %-shown-up figure for as-needed routines (R24)**,
**a custom/arbitrary Cycling-XP reset interval beyond weekly or monthly (R25 C)**,
**tenure badges as consistency/streak achievements or gated on the Cycling XP
counter / per-cycle records (R25 A)**, and **replacing R6's primary %-windows with
the R26 graph — R26 is additive, not a replacement**) remains out of scope and is
not planned as a feature. **Android is no longer a non-goal — it is a v1 target**
(see the platform framing and Cost flags).

---

## Flags carried to Gate 1 (human veto — must appear in PRD.md)
The spec-writer reads only this file, so any human-facing flag omitted here never
reaches PRD.md and the human never sees it at Gate 1. Carry the following into
PRD.md explicitly:

- **Off-day / consistency-% math — SETTLED by human direction (no longer a veto
  item).** The earlier plan flagged the off-day formula as a "resolved
  interpretation awaiting human veto at Gate 1" (off days sitting in the
  denominator and *diluting* the %). **The human has since exercised that veto
  directly**, reworking REQUIREMENTS (R4/R6) to the authoritative formula now
  encoded in F4/F5: **off days are excluded from BOTH the numerator and the
  denominator, so they neither raise nor lower the %; only missed (grey) days
  lower it.** IDEA.md's stale worked examples that assumed off days in the
  denominator (Flow 9.1: 26/30 = 87% with 4 off, 0 missed) are **superseded** —
  under the settled formula that exact breakdown reads **100%** (26/26), and 26
  shown-up + 4 off + 4 missed reads **87%** (26/30). This is **no longer open**;
  it is carried here only so PRD.md/spec-writer record it as human-directed and do
  not re-open it. qa-tester must assert the new numbers, not the old ones.

- **Day-level dashboard rollup rule (R6 aggregate scope) — SETTLED by human
  direction (no longer an open Gate-1 veto item; this was the LAST open Gate-1
  item).** The human has settled the overall/aggregate dashboard as **PROPORTIONAL /
  FRACTIONAL daily credit** (see F5 scope 2). The previously-proposed all-or-nothing
  default (a day counts as shown-up only if **every** due, non-off task was shown up)
  is **superseded and must not be carried forward.** Under the settled rule each
  calendar day contributes a fraction **f(D) = (its due, non-off, resolved tasks
  shown up) ÷ (its due, non-off, resolved tasks)**, and **aggregate % = Σ f(D) ÷
  (count of elapsed days with ≥1 due, non-off, resolved task) × 100**, rounded to the
  nearest whole percent. It **degenerates exactly** to the per-task formula on
  uniform (one-due-task) days, **excludes** zero-due / all-off days from the
  denominator, and **excludes pending tasks per-task from both sides** of that day's
  fraction. qa-tester must assert the 3-day anchor (Day 1 = 2/2 → 1.0, Day 2 = 1/3 →
  0.333, Day 3 fully off → excluded → 1.333 / 2 = **67%**, **not** the superseded
  50%). Per-task scope 1 and F23's sub-step-due-that-day rule are unchanged. Carried
  here only so PRD.md/spec-writer record it as human-directed and do not re-open it.
  - **Two residual DISPLAY forks the human's answer does NOT decide (OWNER:
    spec-writer/designer, NOT human — do not re-escalate to the Gate-1 human queue):**
    (1) the **ideal/fallback/off breakdown** under fractional credit — proportional
    sums vs. keeping ideal-vs-fallback purely per-task (a single day can now mix
    ideal/fallback/off/missed; the whole-day label no longer applies as-is — this same
    fork governs F30's per-cycle-record breakdown); (2) the **"X of Y days" framing**
    — X is no longer a whole day-count, so keep "days" only by expressing X as the
    rounded Σ of fractional credits (Y stays the whole denominator day-count) or switch
    to a pure "%". Flagged so they are resolved deliberately, not silently.

- **As-needed routine (R24/F27) — SETTLED, recorded so the human sees the
  product-shape calls (not a veto item, but visible at Gate 1).** Three items were
  human-confirmed and are implemented in F27 without re-litigation: (1) user-facing
  name = **"As-needed routine"**; (2) ideal+fallback is **optional** for the
  variant; (3) manual "done/triggered" logging is **exposed and reference-only,
  with zero effect on the consistency %.** **One item the human did NOT decide was
  resolved here by product-planner within remit** (a product-shape call, not
  punted): **an as-needed routine log fires no XP/achievements (F13), no Cycling XP
  (F31), and no milestone/confetti celebration** — XP is bound to the
  occurrence-based showing-up mechanic this variant opts out of, and rewarding a
  schedule-less self-serve log would be a farm exploit; a calm confirmational
  acknowledgment to history is allowed but carries no reward semantics (see F27's
  XP/celebration resolution). This zero-XP-of-either-kind rule now also appears
  verbatim in REQUIREMENTS R24/R7/R25(C) — no regression. If the human wants
  as-needed logs to celebrate/earn XP, that is their call to reverse at Gate 1.

- **R25 & R26 (tenure badges / per-cycle records / Cycling XP counter / all-time
  graph) — SETTLED by human direction, recorded so the human sees the P1 scope calls
  (not veto items).** All four are **core/free** and placed at **P1** (F29/F30/F31,
  F28) as motivation/retrospective layers that reuse existing math and do not gate
  the P0 proof. Human-confirmed points implemented without re-litigation: tenure
  badges are **calendar-time-elapsed only** (11 tiers, consistency-independent, not
  gated on Cycling XP); the Cycling XP counter has a **user-set weekly/monthly reset
  cadence (default monthly)**, archives before it zeroes, and **never touches any
  lifetime figure**; the R26 graph is **ADDITIVE** (F5's primary %-windows,
  including the all-time %, stay unchanged). If the human wants any of these at P0,
  or the Cycling reset to behave differently, that is their call at Gate 1.

---

## Cost flags (the expensive choices, made explicit)
These create disproportionate build cost or risk; the human should see them as
deliberate spend, not incidental.

- **Android as a full v1 target roughly doubles the native-surface work.** Every
  iOS-specific native capability now needs an Android equivalent built and tested
  in parallel: home-screen widgets (WidgetKit + Android app widgets, F21), store
  billing (StoreKit / App Store + Play Billing, F17), biometric/sensitive
  confirmation (Face ID/Touch ID + Android biometric prompt, F17), and cloud sync
  (iCloud + an Android-side mechanism, F20). The shared RN/Expo layer is not
  doubled, but each of these native surfaces is a second implementation and a
  second store-review path. This is a deliberate v1 choice (both stores from day
  one), not incidental.
- **F16 Fallback AI assistant [L] — the single biggest item.** Real STT + real
  streaming LLM, mid-conversation task create/edit across four types,
  disambiguation, Undo, persisted conversation history, and safety guardrails.
  This is effectively a product inside the product.
- **F17 + backend — app-store subscription billing (Apple App Store + Google
  Play) + thin proxy backend.** Two separate IAP integrations (StoreKit and Play
  Billing), each with trial, cancel, and Restore-without-login, are notoriously
  fiddly and gate both stores' review; the thin Groq proxy is the *only* server
  component in an otherwise serverless, no-account app, so it carries outsized
  ops/security weight (must hold no user data, no accounts).
- **F18 BYO key — direct-to-provider path with capability detection.** A second,
  divergent inference path (bypasses the backend entirely) plus graceful
  voice→text degradation when the endpoint can't transcribe. Doubles the
  assistant's integration/test matrix. Also a material monetization change to an
  already-designed paywall (placement is screen-designer's call).
- **F26 extended recurrence cadences — a recurrence engine is a classic cost/edge
  sink.** Weekly / bi-weekly / monthly / bi-monthly / yearly cadences (plus
  repeating Events) mean generating and persisting **sparse, unbounded occurrence
  streams** with period anchoring ("every 2 weeks/months from date X"), month-end
  and leap-day edge cases, and correct interaction with off-days (F4), consistency
  windows (F5), sub-step subsetting (R22/F23/F24), snooze/move (F7), and
  notifications (F14). The daily/weekday P0 case sidesteps most of this; the coarse
  cadences do not. Real surface even though it changes no formula.
- **F20 / F22 cloud sync — data-sync is a classic cost sink.** Even best-effort
  sync touches every persisted entity, and there is no single cross-platform
  mechanism (iCloud is iOS-only, so Android needs its own); true conflict
  resolution (F22) is a substantial, separately-scoped effort.
- **F21 Widgets — native widget extensions on both platforms (iOS WidgetKit +
  Android app widgets).** Two separate targets/implementations, each with its own
  rendering/refresh model and store review surface; real cost beyond the RN/Expo
  app.
- **F13 Achievements/XP + R25 (F29/F30/F31) — a second stateful system** over the
  same history (recomputation, categories, three tabs); moderate but non-trivial,
  and pure motivation-layer. **R25 adds real date/state surface on top:** the
  Cycling XP counter (F31) needs **cycle-boundary date math** with a
  user-configurable weekly/monthly cadence and a deterministic **mid-cycle
  cadence-change → archive-and-reset** rule (a mini recurrence/rollover engine of its
  own), and per-cycle records (F30) need permanent, append-only archival that must
  never be overwritten. Tenure badges (F29) are cheap (elapsed-time checks against a
  fixed anchor), but the anchor's device-local / erase-all / sync semantics are a
  small correctness surface. (Streakforge's flame/badge/confetti visuals decorate all
  of it as a celebration motif only — see F13 — carrying no streak-break semantics.)
- **F28 All-time consistency graph — a charting surface with an accessibility
  rider.** The math is free (it reuses F5's fractional formula per bucket), but it
  adds a **charting/visualization component** with adaptive week/month/year bucketing
  **and** a ship-blocking requirement for a **non-color-only, screen-reader-readable**
  representation (a chart can't rely on color/shape alone). Moderate, not large.
- **F14 Notifications — permission + scheduling matrix.** Four reminder types,
  two encouragement types, per-type toggles, and a digest — a lot of scheduling
  logic even though it's local-only.

**Not a cost flag (called out so it isn't mistaken for one):** **F27 as-needed
routine [S]** is deliberately *cheap* — it adds no cadence engine, no F5/consistency
integration, no R22 sub-step scheduling, and no XP hook; it is a small variant of
the existing Routine model (drop the schedule, expose a reference-only manual log).
Its P1 placement is on MVP merit (it opts out of the loop the P0 line proves), not
on cost.

### Open questions carried to the architect / designer (NOT scoping blockers)
None of these blocked drawing the MVP line — they are internal to single
features and are explicitly marked "deferred / to confirm downstream" in the
requirements. Flagging them so the owner resolves them before build:
- **Cloud sync mechanism & depth (both platforms)** — what provides sync on
  Android (iCloud has no Android equivalent): a platform cloud-drive, a
  cross-platform sync layer, or none — and whether real multi-device conflict
  resolution is required in v1 or single-device best-effort is the practical
  target. (Drives the F20 vs. F22 split above; scoped as best-effort in v1 pending
  confirmation.) OWNER: architect.
- **R22 sub-step subsetting for single-occurrence cadences (R22 × R23) —
  design/architect detail.** For weekly … yearly cadences (one occurrence per
  period), per-occurrence sub-step toggling is largely degenerate. Whether the UI
  even exposes a subset control for those cadences (vs. only for daily/weekday,
  where a period has several occurrences), and how any subset is expressed over an
  unbounded future occurrence stream, is left to design/architect. The rule
  (subset of the parent's own occurrences; never outside them; no empty
  run-occurrence) is fixed; only its surfacing for coarse cadences is open.
  (Does not touch as-needed routines, R24/F27, which have no occurrence set at
  all — R22 simply does not apply there.) OWNER: designer/architect (affects
  F26/F23/F24).
- **R26 graph placement & granularity thresholds (F28)** — exact "hidden deeper"
  placement (a "See full history" affordance from the F5 dashboard vs. Settings →
  Progress/Badges) is a screen-designer call; the requirement pins only that it is a
  secondary, non-Today surface. The exact data-volume cutovers for
  weekly→monthly→yearly bucketing (R26 proposes ~3 months and ~3 years) are a
  designer/architect judgment call; the pinned rule is only that granularity
  coarsens as history grows. OWNER: screen-designer/architect.
- **R25 first-use anchor event (F29)** — which concrete event fixes the tenure
  anchor date (install vs. first launch vs. first-task creation) is a small design
  detail; the requirement pins only that it is **one fixed calendar date,
  consistency-independent, and device-local** (a genuine erase-all/reinstall restarts
  it). Whether an enabled cloud sync (F20) carries the anchor across devices is a
  minor architect detail. OWNER: spec-writer/designer.
- **Managed-tier STT source** — does Groq provide the speech-to-text on the
  subscription path, or is a separate transcription service needed? (Affects
  F16/F17 backend build.) OWNER: architect.
- **Exact Groq model(s)** — implementation-phase decision; no feature-scope
  impact. OWNER: architect.
- **Backup artifact format & location (F19)** — exported file vs. Files app /
  Android storage, consistent with no-account/no-server. OWNER: architect.

(Separately, the **day-level rollup rule** is **now SETTLED** by human direction as
proportional/fractional daily credit — it is **no longer** an open Gate-1 flag; it
is recorded in "Flags carried to Gate 1" above only so spec-writer does not re-open
it, and the two residual **breakdown / "X of Y days" display forks** noted there are
spec-writer/designer calls, not human ones. The **Streakforge
forge-orange-vs-fallback-orange color conflict** is neither of these: it is an
explicit **Phase 2 design-system-agent** decision — see F8. The **off-day math** is
no longer any kind of open flag — it was settled by human direction, per the Gate-1
section above. The **as-needed routine (R24/F27)** decisions — name, optional
ideal+fallback, reference-only logging, and the no-XP/no-celebration sub-rule — are
settled; the no-XP/no-celebration call was a product-planner decision within remit,
recorded in the Gate-1 section for the human's visibility.)
