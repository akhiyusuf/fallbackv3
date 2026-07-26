# Requirements — Fallback
STATUS: DRAFT

## Problem
People bounce off habit trackers that punish imperfection: a missed day breaks a
streak, the streak loss demotivates, and they quit. Fallback's premise is
"something beats nothing" — every habit has an **ideal** version and a **fallback**
(minimum-viable) version, doing the fallback still counts as showing up, and off
days are treated as **neutral, never as a miss** (no reset, no streak-break, no XP
penalty). Consistency is measured as "% of days you showed up" (see R6 for the
exact formula) rather than as an unbroken streak.

## Target user (specific)
The all-or-nothing quitter: someone with an inconsistent, high-variance daily
life (busy professionals, people managing burnout, chronic illness, caregiving,
or unpredictable schedules — *these life-context specifics per human Q&A, not from
the source mockup*) who has repeatedly abandoned streak-based habit apps because
one bad day erases their progress. They want to keep showing up on hard days
without guilt, and they value privacy (no account, data on their device).
Represented in the mockups by "Maya." Uses iOS or Android (v1 ships to both).

## Platform & justification
Cross-platform **React Native / Expo**, shipping to **both the Apple App Store and
Google Play — iOS and Android are both v1 targets** (not iOS-first with Android
deferred). RN/Expo was chosen partly because it does not foreclose Android, so
covering both platforms in v1 is the same stack, not a change. The source mockup's
platform cues are all iOS-specific (Face ID checkout, App Store billing, iCloud
sync, home-screen widgets); each of these must be met with the equivalent native
capability on Android as well (see Constraints), and screen-designer/architect
own the platform-specific realizations.

## Must-have capabilities (testable)
Core (free):
- **R1** User can create four task types: Routines (recurring — see R24 for the
  no-cadence **as-needed** sub-variant), Events (scheduled at a set time —
  **one-off by default but optionally recurring on a cadence**, see R23), Courses
  (fixed end date / a run, optionally multi-dose/day), and To-dos & notes (no
  schedule). **Routines have two variants:** the default **recurring** routine (on
  an R23 cadence) and an **as-needed** routine that has no cadence and no
  consistency tracking (R24) — the as-needed variant is still a **Routine**, not a
  To-do/Note (it keeps the routine's step/ideal-fallback structure; it only drops
  the schedule and tracking). The three scheduled types (recurring Routines,
  Events, Courses) each carry a **recurrence cadence** per R23; the **as-needed
  routine (R24) carries none** and is the deliberate exception.
- **R2** Every trackable task carries an **ideal** version and a **fallback**
  version; user can define both. (The **as-needed routine** variant, R24, is
  **non-trackable** — having no cadence it is excluded from consistency tracking —
  so this requirement does not force ideal+fallback on it; there they are
  **optional**, see R24.)
- **R3** User can complete a task's steps; completing all ideal steps logs it
  **ideal**, completing fewer logs it **fallback**, and both count as "showed up."
  (On a task with per-occurrence sub-step toggles, "all ideal steps" for a given
  occurrence means all sub-steps **due that occurrence** — a sub-step not due that
  occurrence is excluded from that occurrence's completion set; see R22.) User can
  tap a state chip (To do / Done / Fallback / Skip) to override.
- **R4** User can mark a day an **off day**. An off day is **neutral: it is never
  counted as a miss and never triggers a reset, streak-break, or XP penalty.**
  **Off days are excluded from the consistency metric entirely** — an off day is
  removed from R6's denominator (the days you were "supposed to show up"), so it
  **neither raises nor lowers the %.** Off days are still counted and shown as
  their own category (ideal / fallback / **off**) in the breakdown; they simply do
  not affect the percentage.
  **CHANGE NOTE (human-directed, reverses the prior reading):** an earlier
  artifact-review pass had off days sitting *in* the denominator (diluting the %).
  The human has now explicitly redefined the formula so that off days are truly
  neutral to the % (see R6 verbatim quote). This reversal is authoritative.
  Consequently IDEA.md's own worked examples that depend on off days living in the
  denominator (Flow 9.1: 26/30 = 87% with 4 off days) **no longer hold and are
  superseded** — see R6 for the recomputed numbers.
- **R5** For multi-dose courses, each occurrence completes independently and the
  day counts once all doses are handled.
- **R6** User can view a consistency dashboard showing **% of days you showed up**
  over a window, plus the breakdown into ideal / fallback / off counts, with **no
  streak** concept. The metric is defined by the human (verbatim, response of
  record):
  > "the denominator is the number of days I'm supposed to have shown up (i.e the
  > days that I set to show up), and the nominator is the days that I actually
  > showed up (ideal or fallback, (green or orange)), make sure to subtract the
  > missed ones from the denominator to give you the nominator (the grey ones)"

  Formalized:
  **consistency % = (ideal days + fallback days) / (due days you were scheduled to
  show up, EXCLUDING off days) × 100.**
  Equivalently: **numerator = days shown up (ideal or fallback); denominator =
  shown-up days + missed days; off days are excluded from BOTH.** This is
  algebraically consistent with the human's "subtract the missed from the
  denominator to get the numerator," because every due, non-off day is either
  shown-up or missed, so `numerator = denominator − missed`.
  - **Off days do not appear in the fraction at all** (this is what makes them
    truly neutral — see R4). **Missed days (grey) DO stay in the denominator** and
    pull the % down; that is the only thing that lowers it.
  - **As-needed routines (R24) contribute nothing to this metric at either
    scope.** Having **no cadence**, they have **no "due" days**, so they never
    enter the numerator or the denominator (per-task or overall) and never produce
    a "missed" day. They are excluded **not** by the off-day rule (R4) but for a
    prior reason: they are never "due" at all. (See R24.)
  - **Scope — this metric exists at BOTH levels (IDEA.md uses both framings):**
    1. **Per-task** (IDEA Flow 3, "you've shown up 5 of 6 days"): denominator =
       that single task's own due, non-off, **elapsed** occurrences; numerator =
       occurrences on which it was shown up (ideal or fallback). Each occurrence is
       a whole **0-or-1** outcome. **This scope is unchanged and is NOT affected by
       the aggregate rule below** (the human confirmed the fractional change is the
       aggregate/overall dashboard only, not a single task's own %, and not F23's
       sub-step-due-that-day rule — both of those are already settled and untouched
       here).
    2. **Overall/aggregate dashboard** (IDEA Flow 9.1, "26 of 30 days") —
       **SETTLED by the human as PROPORTIONAL / FRACTIONAL credit** (this closes the
       last open Gate-1 item). Instead of classifying a mixed calendar day as a
       single all-or-nothing shown-up/missed bucket, **each calendar day contributes
       a FRACTION** to the aggregate:

       **day fraction f(D) = (D's due, non-off, resolved tasks that were shown up)
       ÷ (D's due, non-off, resolved tasks).**

       **aggregate % = ( Σ f(D) over every elapsed day D that has ≥1 due, non-off,
       resolved task ) ÷ ( count of elapsed days that have ≥1 due, non-off,
       resolved task ) × 100**, rounded to the nearest whole percent.

       So the **numerator becomes a SUM of per-day fractions** (not a count of whole
       days), while the **denominator stays a day-COUNT** (days that have ≥1 due,
       non-off, resolved task). Example: a day with 2 of 3 due tasks shown up
       contributes **2/3 ≈ 0.667**, not a binary 0 or 1.
       - **Sanity check — reduces to the per-task shape.** When every counted day has
         **exactly one** due, non-off task, each f(D) is either 0 (missed) or 1
         (shown up); Σ f(D) equals the count of shown-up days, and the denominator
         equals the count of days with a due task = (shown-up + missed) days. The
         aggregate formula then **degenerates exactly to the discrete per-task
         formula** `(shown-up days) / (shown-up + missed days) × 100`. Confirmed: the
         one-task-per-day case IS the old discrete bucket rule as a special case, so
         the two scopes agree whenever a day is uniform.
       - **Zero-due and all-off days are excluded from the denominator entirely.**
         A day with **no** due, non-off, resolved tasks — because nothing was due,
         or every due task that day was marked off, or every due task is still
         pending — contributes **nothing** and is **removed from the denominator**
         (it can neither raise nor lower the aggregate %). This is the day-level
         analogue of the per-task off-day exclusion (R4): off/absent tasks never sit
         in a denominator. Off-ness is applied **per task within the day** — a day
         with 2 due tasks where 1 is off and 1 was shown up has f(D) = 1/1 = **1.0**
         (the off task is dropped from **both** the day's numerator and its
         denominator), not 1/2.
       - **Pending-today composes per-task, not per-day.** Consistent with the
         per-task "pending today" rule (an unlogged, un-Skipped due occurrence that
         is still *today* sits outside BOTH sides of the fraction until it resolves),
         a **pending** task is excluded from **both** the numerator and the
         denominator of its day's fraction f(D) — the fraction is taken over that
         day's **resolved** (shown-up + missed) due, non-off tasks only. So a day
         with 2 due tasks where 1 is done and 1 is pending-today contributes
         **1/1 = 1.0** (full credit, the pending task ignored), **not** 1/2, and the
         whole day does **not** stay pending waiting on it. **Reasoning:** the
         per-task rule already treats each occurrence independently and forbids a
         pending occurrence from lowering the %; letting one pending task drag down
         credit already earned by a resolved task the same day would contradict that
         rule and make the aggregate momentarily *lower* than the truth, then jump —
         exactly the mid-day instability the per-task pending rule exists to prevent.
         If **every** due, non-off task on a day is pending, the day has zero
         resolved tasks and is (per the exclusion above) simply not yet in the
         denominator — it enters once any of its tasks resolves.
       - **Ideal vs. fallback breakdown for a fractional day — DEFAULT proposed, but
         this sub-point is a genuine design fork (see Open Questions), NOT forced by
         the human's answer.** The human settled the **%** (proportional credit);
         they did **not** settle how the ideal / fallback / off *breakdown* display
         (per F5, IDEA Flow 9.1's "22 ideal / 4 fallback / 4 off") is expressed once
         a single day can mix ideal, fallback, off and missed tasks. Under the
         discrete model the breakdown was a count of **whole** ideal-days /
         fallback-days / off-days; under fractional credit a day is generally a
         **mix**, so a whole-day ideal/fallback/off label is no longer well defined.
         Proposed default (most consistent with the fractional model): drop the
         day-level ideal/fallback/off *labelling* and report the breakdown as
         **proportional sums** — Σ(that day's ideal-shown fraction),
         Σ(fallback-shown fraction), Σ(missed fraction) across the counted days (a
         day with 2 ideal + 1 fallback all shown, f = 1.0, splits into 2/3
         ideal-credit + 1/3 fallback-credit), with off/excluded shown separately as
         context. The **ideal-vs-fallback distinction may instead be kept purely
         per-task**, the aggregate showing only an overall % plus a shown-up/missed
         split. Because this is a real fork the human's answer does not decide, it is
         **flagged for spec-writer/designer confirmation** (OWNER: spec-writer/
         designer — a product/display call, **not** OWNER: human), not silently
         chosen here.
       - **"X of Y days" display framing — flag, a copy/display call (OWNER:
         spec-writer/designer, NOT human).** Because the numerator is now a **sum of
         fractions**, not a whole count of shown-up days, IDEA Flow 9.1's literal
         "26 of 30 days" framing is no longer strictly accurate for a mixed history
         (you cannot in general show up a fractional number of whole "days"). The
         denominator **is** still a whole day-count (days with ≥1 due, non-off,
         resolved task), so a truthful "days" line can name **Y** ("30 days tracked")
         but not a whole **X**. Recommended default: **lead with the "%"** and either
         drop the "X of Y days" phrasing or express X as the rounded Σ f(D). Which
         framing the dashboard uses is a display/copy decision left to spec-writer/
         designer; this requirement pins only the **fact** that X is no longer a
         whole day-count, so the framing must not silently imply it is.
  - **Worked examples:**
    - **Per-task and whole-day aggregate cases (unchanged — every counted day is a
      whole 0-or-1 outcome, i.e. the degenerate one-task-or-uniform-day case;
      spec-writer and qa-tester must assert THESE, not the old off-in-denominator
      numbers):**
      - **Supersedes Flow 9.1:** 26 shown-up days (22 ideal + 4 fallback), 4 off,
        **0 missed** → 26 / 26 = **100%** (off days excluded, so they do NOT dilute).
        The source's "26/30 = 87%" is superseded — that exact breakdown reads 100%.
      - 26 shown-up, 4 off, **4 missed** → 26 / (26 + 4) = 26/30 = **87%** (off
        excluded; the 4 *missed* days are what sit in the denominator).
      - **Flow 5 partial survival:** "26 of 31 → 27 of 32" holds **only if** those
        non-shown days are **missed** (grey), not off. A genuine off day would be
        excluded from the 31/32 entirely. Downstream must treat Flow 5's numbers as
        valid only under the missed-not-off reading.
    - **NEW mixed-day aggregate example (the anchor for the fractional rule —
      qa-tester must assert this exact arithmetic, the way the per-task formula has
      its 26/30 anchor):** a 3-day window.
      - **Day 1:** 2 due, non-off tasks, **both shown up** → f = 2/2 = **1.0**.
      - **Day 2:** 3 due, non-off tasks, **1 shown up, 2 missed** → f = 1/3 ≈
        **0.333**.
      - **Day 3:** every due task marked **off** (zero due, non-off resolved tasks)
        → **excluded from the denominator entirely.**
      - Denominator = **2** (days 1 and 2 qualify; day 3 excluded). Numerator =
        Σ f = 1.0 + 0.333… = **1.333…**. Aggregate % = 1.333… / 2 × 100 =
        **66.67 → 67%** (nearest whole).
      - **Contrast (why the human's choice matters):** the previously-proposed
        all-or-nothing default would score Day 1 = shown-up, Day 2 = missed (not
        every due task shown), giving 1 / 2 = **50%**. Proportional credit yields
        **67%** because Day 2's partial effort is credited, not erased. qa-tester
        must assert **67%** (proportional), not 50% (the superseded all-or-nothing).
    - **Pending-today mixed example:** a day with 2 due, non-off tasks — 1 logged
      shown-up, 1 still **pending today** (unlogged, un-Skipped) — contributes
      f = **1/1 = 1.0** (the pending task excluded from both sides), identical to
      what the day would contribute if the pending task did not exist, until it
      resolves.
- **R7** User can view and earn a Level/XP achievement system (Showing up,
  Fallback wins, Milestones categories; All / Earned / Locked tabs). Streakforge's
  gold flame/badge visual language may decorate this system as a celebration motif,
  but it must carry **no breakable-streak semantics** (see Constraints).
  R7's XP/Level is the **lifetime, monotonic** tally: XP is earned from **every
  completion of a trackable (due, occurrence-bearing — recurring or one-off) task**
  — fallback completions earn XP too, not only ideal ones — while an **as-needed
  routine's (R24) reference-only "done/triggered" log earns NO lifetime XP** (it is
  not a trackable, scheduled completion; XP is bound to the occurrence-based
  showing-up mechanic an as-needed routine does not participate in — see R24). The
  operative property is having a **due occurrence at all** — whether recurring (any
  R23 cadence) or a **one-off Event's single due date** — NOT specifically carrying
  a recurrence cadence: a one-off "Dentist visit" Event is scheduled, has a due
  occurrence that enters R6, and carries ideal+fallback, so completing it earns
  lifetime XP. Per this system's no-loss clause the lifetime XP/Level **never
  resets, breaks, or goes to zero** on any missed or off day, at any cycle boundary,
  ever.
  **This system is EXTENDED by R25**, which adds (a) **tenure/anniversary badges**
  measured by calendar time since first use, (b) **per-cycle records**, and (c) a
  **cycle-scoped "Cycling XP" counter** (user-facing label **"Monthly XP"** by
  default / **"Weekly XP"** when the weekly cadence is selected) that accumulates
  the same way lifetime XP does but is windowed to the current cycle (a calendar
  **month by default**, or a calendar **week** if the user sets a weekly reset
  cadence) and resets to 0 at each cycle boundary — a separate figure that runs
  *alongside* (never replacing or zeroing) lifetime XP/Level. All three are
  core/free and bound by the same no-streak/no-reset constraint on everything
  *lifetime* (nothing lifetime earned here ever resets, breaks, or goes to zero;
  only the deliberately cycle-scoped Cycling XP counter cycles, and it is
  non-punitive — see R25). See R25 for the tenure-badge tiers, the disambiguation
  from R7's cumulative "Showing up" count badges, the per-cycle record, and the
  Cycling XP counter's mechanics (incl. its user-configurable weekly/monthly reset
  cadence).
- **R8** User can browse Today, Routines, Events, Courses tabs plus a To-do/Notes
  lens, each with defined empty states; user can filter/search by Type, Importance
  (High/Med/Low) and Necessity (Must-do/Recommended/Optional) using these two
  fixed vocabularies (no free-form tags).
- **R9** User can manage any task from one sheet: edit, duplicate, pick an
  icon/color, view a per-day calendar heatmap, snooze, move to another day, and
  delete (with confirmation).
- **R10** User can receive gentle, invitational notifications: reminders (routine
  due, event starting, course dose, course ending) and encouragement (missed-day
  re-entry, milestone), all individually toggleable, plus a daily digest.
- **R11** User can add home-screen widgets (Small · Today, Small · One task,
  Medium · Up next) and configure a fixed task vs. "Smart — next due." Widgets
  must be provided via each platform's native mechanism (iOS WidgetKit, Android
  app widgets).
- **R12** User can set theme (Light/Dark/Auto) and an accent color; the accent
  recolors only CTAs & progress, never the **fixed, semantically-meaningful
  ideal / fallback / off signal colors** (these three stay constant so the metric
  stays legible). Which concrete hue plays each role is a design-system decision
  (see Constraints and Open Questions re: Streakforge's forge-orange).

Assistant (Fallback AI):
- **R13** User can create and edit tasks conversationally via a voice-first
  assistant using **real speech-to-text and a real LLM** (not scripted); the
  assistant creates/edits tasks mid-conversation, handles all four task types,
  and drafts ideal+fallback pairs.
- **R14** User can switch between voice and text within one conversation; the
  assistant disambiguates same-named tasks, supports Undo on edits, and saves
  every conversation to a browsable, reopenable history.
- **R15** The assistant applies **basic safety guardrails**: it refuses clearly
  harmful requests and gives no medical/dosing advice, while still logging tasks
  literally (e.g. "antibiotics 2×/day" as a task without advising on dosing).
  (The concrete boundary of "clearly harmful" is deferred to the spec-writer —
  it must be defined before PRD acceptance criteria, not silently re-decided.)

Access & billing:
- **R16** Free tier includes all core capabilities (R1–R12, R22, R23, R24, R25,
  R26). The assistant (R13–R15) is gated behind either a paid subscription **or** a
  user-supplied key (R18). **Tenure badges, per-cycle records, AND the cycle-scoped
  "Cycling XP" counter (all of R25), AND the all-time consistency graph (R26) are
  part of R7's / R6's free feature set — core/free, never gated behind the assistant
  subscription.**
- **R17** User can subscribe to Fallback AI at $4.99/mo or $39.99/yr with a 7-day
  free trial, billed via the platform's own app store (**Apple App Store on iOS,
  Google Play on Android**), cancel anytime, with Restore Purchases that re-checks
  the store account (no login). Managed inference uses **Groq** via the thin
  backend (Groq is an invisible backend vendor — the user-facing product name is
  "Fallback AI").
- **R18** User can instead **bring their own AI** to fully unlock the assistant
  with no subscription: a single OpenAI-compatible **base URL + API key** field.
  **NOTE — new relative to the IDEA.md source: this option does not exist in the
  source mockup. IDEA.md's Flow 6 paywall is fully specified as pure-subscription
  (7-day trial → $4.99/mo, Annual/Monthly chooser, biometric confirm) with no BYO
  path. Requiring BYO to appear on the paywall as an equal alternative to paying
  therefore MODIFIES an already-designed screen and is a material monetization
  change (any user with an OpenAI-compatible key can bypass the subscription
  entirely). OWNER: screen-designer — exact placement, visual treatment, and how
  it coexists with the existing CTA copy are a design decision, not settled here.
  Also manageable in Settings (Flow 11).**
- **R19** A BYO key is stored **on-device only** and calls the provider directly
  from the app; it never touches Fallback's backend. If the BYO endpoint can do
  speech transcription it powers voice; otherwise the assistant gracefully
  degrades to text-only for that user.

Data & sync:
- **R20** No login/accounts. Data lives on-device by default; user can enable
  **optional cloud sync** and see last-synced status. The source shows iCloud on
  iOS; Android requires an equivalent (e.g. a platform cloud-drive or a
  cross-platform sync layer). The concrete sync mechanism and cross-device conflict
  resolution are deferred to the architect (see Open Questions).
- **R21** User can back up, restore from backup (with a non-destructive failure
  state), and erase all data.
  - **PRIORITY SIGNAL FOR product-planner (human-directed, not the interviewer's
    own call):** the human has **promoted "erase all data" out of the P1 slice of
    F19 and into P0.** REQUIREMENTS does not own P0/P1 assignment, but this is
    flagged here exactly as prior Gate-1 priority changes were, so product-planner
    **must** re-slice F19 to place **erase-all in the P0 MVP** (backup/restore may
    remain P1). This is a scope-priority instruction, not a suggestion.

Scheduling (core, free):
- **R22** For a Routine, Event, or Course, user can control **which of the parent
  task's own recurrence occurrences each sub-step occurs on**. A sub-step's active
  occurrences are a **subset of the parent task's own occurrence set** (the days/
  dates the parent is due, per R23) — a per-occurrence **on/off (toggle)
  selection** over the parent's schedule, **NOT** an independent or arbitrary
  recurrence rule. Each sub-step can be toggled to occur on **all** of the parent's
  occurrences, or **limited to a subset** of them; consequently a sub-step can
  **never** be due on a day the parent does not run.
  - **Generalized from "weekdays" to "occurrences" (per R23):** the source
    (IDEA Flow 8.1, "Heavy lifts M·W·F") only showed sub-step subsetting over
    literal **weekdays**, which is the special case where the parent's cadence is
    daily / specific-weekdays and a week contains several occurrences. The concept
    now generalizes to **any** cadence in R23: the toggle set is the parent's own
    occurrence set, whatever produces it — not literally "weekdays." For a
    weekday-based cadence this is unchanged (toggle over Mon–Fri). For coarser
    cadences (weekly / bi-weekly / monthly / bi-monthly / yearly) that produce **one
    occurrence per period**, per-occurrence subsetting is largely degenerate (a
    sub-step is effectively on every occurrence); how — or whether — a subset is
    even exposed for those single-occurrence cadences is a design/architect detail
    (see Open Questions), but the underlying rule (subset of the parent's own
    occurrences, never outside them) is unchanged.
  - **Does NOT apply to the as-needed routine variant (R24).** A no-cadence
    routine (R24) has **no occurrence set**, and R22 subsets a parent's occurrence
    set — with **no occurrences there is nothing to subset**, so R22 sub-step
    scheduling **does not apply** to an as-needed routine. Its steps are simply all
    present whenever it is triggered; the per-occurrence toggle and the
    no-empty-run-occurrence save-time invariant below (both of which presuppose an
    occurrence set) are **inapplicable** to this variant. (Reasoning stated here so
    the exclusion is auditable rather than left as a silent gap.)
  - Testable example (weekday special case): a "Studying" routine whose parent runs
    **Mon–Fri** has a "finish all weekly assignments" sub-step **toggled ON for
    Friday only** — so that sub-step is due **only on Friday**, while the routine's
    other sub-steps remain due every weekday (a reader can name the exact due-days
    from the toggle state).
  - **Ideal/fallback on occurrences a sub-step isn't due (R22 × R3):** an
    occurrence's ideal/fallback determination (R3) counts **only the sub-steps that
    are due (toggled on) for that occurrence**. A sub-step not due that occurrence
    is not part of its completion set — it neither helps nor blocks the
    ideal/fallback result. Testable: on a **Tuesday** the Friday-only "weekly
    assignments" step is not due, so completing **every due step** that Tuesday logs
    the day **ideal**; on **Friday** that step is due and must be completed for the
    day to log ideal.
  - **No empty run-occurrence (save-time invariant, generalized):** a toggle
    configuration that leaves **any** parent occurrence with **zero** due ideal
    sub-steps is rejected at save (same class of rule as "a recurrence with no
    selected days cannot be saved"). So the equivalence *"D is a parent
    occurrence"* ⟺ *"the task is due on D"* ⟺ *"≥1 ideal sub-step is due on D"*
    holds for every cadence — "ideal" is never vacuous and every "missed" is a real
    miss.
  - **Granularity on multi-dose courses (R22 × R5):** sub-step scheduling operates
    at the **occurrence/day level**, not per individual dose. For a Course with
    multiple doses per day (R5), a sub-step toggle applies to **the day as a whole**
    (due that day or not, across all of that day's occurrences), not to one specific
    dose. R5's "day counts once all doses are handled" rule is unchanged; it
    combines with the due-sub-steps rule above to set the day's ideal/fallback state.
  This exists implicitly for Routines in IDEA.md Flow 8.1 and is now a first-class
  requirement **extended to Events and Courses** and **to all R23 cadences**, which
  the source did not show.
- **R23** User can set a scheduled task's **recurrence cadence** to any of:
  **daily, specific weekdays, weekly, bi-weekly (every 2 weeks), monthly,
  bi-monthly (every 2 months), and yearly.** (NEW relative to IDEA.md, which showed
  only daily and specific-weekday recurrence; human-directed and authorized.)
  - **Recurring Routines and Courses** always recur on one of these cadences (a
    Course runs its cadence until its end date — e.g. a 10-**day** medication course
    is the daily cadence; a 10-**week** course is the weekly cadence). The
    **as-needed Routine variant (R24) is the exception** — it has **no** cadence
    (see next bullet).
  - **The as-needed routine variant (R24) has NO cadence** — it is on **none** of
    these cadences and produces **no occurrence set**. It exists in a
    **triggered/on-demand** state, not on a recurrence. Because R6 (consistency) and
    R22 (sub-step scheduling) both operate over an occurrence set, and an as-needed
    routine has none, **neither applies to it** (see R24).
  - **Events** are **one-off by default** (a single set date/time) but may
    **optionally** take any of these cadences, becoming **repeating events** (e.g. a
    weekly team dinner, a monthly review, a yearly checkup). **This EXTENDS R1's
    original one-off Event definition rather than contradicting it:** a
    non-recurring event is simply the "does not repeat" option; the type stays
    "Event" (scheduled at a set time), it is not silently merged into "Routine."
    Distinguishing when a repeating Event vs. a Routine is the right type is a
    product/UX judgment left to design — the data model must support a cadence on
    both.
  - Each cadence produces the task's **occurrence set** (the specific days/dates it
    is due). **R6** (consistency) and **R22** (sub-step scheduling) both operate over
    that occurrence set, whatever the cadence — the denominator of R6 is "due, non-off
    occurrences," and R22 toggles are a subset of the occurrence set.
  - Trackable recurring Events and Courses still carry ideal+fallback (R2) and log
    via the same completion mechanic (R3).
- **R24** User can create a Routine as an **as-needed routine** (user-facing name
  **human-confirmed as "As-needed routine"**) — a Routine sub-variant (of R1/F2)
  that **has no recurrence cadence** (none of R23's cadences), therefore **no
  occurrence set**, and is **excluded from consistency tracking**. It exists in a
  **triggered / on-demand** state, to be used **whenever the situation it plans for
  actually occurs — or never.** The human's examples: an **emergency** plan, a
  **bankruptcy** plan, a **camping** routine — i.e. contingency/preparedness plans
  set up once and triggered rarely or never, not a recurring daily/weekly habit.
  - **It is a Routine, NOT a To-do/Note.** It stays under the Routine type and
    keeps the routine's **step structure**; it differs from a To-do/Note (R1/F11,
    "loose tasks, no schedule," no ideal/fallback) in that a To-do/Note is
    unstructured, whereas an as-needed routine may keep the ideal+fallback step
    structure. What the as-needed variant drops relative to a normal Routine is the
    **schedule (cadence)** and the **consistency tracking**, not the structure. R1's
    Routine definition is amended above to name this sub-variant explicitly, so it
    is not a silent contradiction of "Routines — recurring, day to day."
  - **No consistency tracking (the human's defining property — "doesn't need
    consistency tracking").** Because it has no cadence and thus no "due" days, it
    is **excluded from R6's consistency metric entirely, at BOTH scopes** (per-task
    and overall): it never contributes to the numerator or the denominator, never
    produces a "missed" day, and never appears in the %-shown-up figure. This is a
    **different mechanism from the off-day rule (R4)**: an off day is a *due day
    removed from the denominator*; an as-needed routine has **no due days in the
    first place**. (Under the aggregate proportional-credit rule in R6, an as-needed
    routine's tasks are simply never among a day's "due, non-off, resolved tasks,"
    so they enter neither f(D) nor the day count.)
  - **Ideal + fallback is OPTIONAL for this variant — human-confirmed decision.**
    (A reasoned relaxation of F2's hard "both required to save a trackable routine"
    rule: R2 scopes the ideal+fallback requirement to **trackable** tasks, and an
    as-needed routine is non-trackable, so the hard requirement does not bind here.)
    The user **MAY** define ideal+fallback versions — so "something beats nothing"
    still applies when the event hits (do the full plan, or the minimum) — but is
    **not forced to**. This is settled: ideal+fallback is **optional** (neither
    required nor forbidden) for the as-needed variant; downstream must not re-open
    or re-decide it.
  - **Manual "done"/"triggered" logging is exposed and reference-only —
    human-confirmed decision.** The user **MAY** manually mark an as-needed routine
    as done/triggered on the date the event occurs (and, if ideal+fallback is
    defined, as ideal or fallback per R3's step rule), so a **history/reference**
    exists (e.g. "used the emergency plan on Mar 3"). Such a log is
    **reference-only**: it **never** appears as "due," **never** feeds R6's % (no
    numerator/denominator entry), and **never** creates a "missed" day — it has
    **zero effect on the consistency %**. It **also earns ZERO XP — neither lifetime
    XP (R7) nor the cycle-scoped Cycling XP (R25 C)** — and it unlocks no
    achievement, milestone, or celebration/confetti. **Reasoning:** XP is bound to
    the **occurrence-based "showing up" mechanic** — a *due*, ideal-or-fallback
    completion of a scheduled task — which an as-needed routine, having no cadence
    and no due occurrences, does not participate in by design; a schedule-less,
    freely-repeatable manual "used it" log therefore carries the **same zero weight
    for XP as it already does for the consistency %**, which is exactly what keeps it
    from becoming a self-serve grinding surface. This is settled: manual logging is
    **exposed, reference-only, and XP-free** (this matches the already-approved
    FEATURES.md F27 resolution); downstream must not re-open or re-decide it.
  - **R22/R23 do not apply.** With no cadence (R23) it has no occurrence set, and
    R22 sub-step scheduling subsets a parent's occurrence set — so there is nothing
    to subset. Its steps are simply all present whenever it is triggered; there is
    no per-occurrence toggle and no no-empty-run-occurrence rule for this variant
    (both concepts presuppose an occurrence set). See R22 and R23.
  - **Still core/free** (part of R16's free tier). It is a variant of an existing
    free capability, not a paid one.
- **R25** User can earn **tenure (anniversary) badges**, view **per-cycle
  records**, and see a **cycle-scoped "Cycling XP" counter** (default label
  "Monthly XP") — a **human-directed extension of the R7 achievements system**,
  added together in one instruction (verbatim): *"let's also include a monthly
  reset, and record for each month, that way badges can be unlocked at first day,
  week, month, 2 months, 6 months, a year, 2 years, 5 years, 10 years and 20 years
  and 50 years."* The human has since **confirmed** (through the orchestrator) that
  the "monthly reset" is a **real cycle-scoped counter that resets to 0 each cycle**
  — and has further **amended the reset interval to be user-configurable, weekly or
  monthly** (verbatim: *"instead of counter that resets each month, let the user set
  how often it resets (be it week or month)"*), **default monthly** — see (C). All
  parts are **core/free** (part of R7 / R16's free tier) and bound by the
  **no-streak / no-reset** constraint on everything *lifetime* — nothing *lifetime*
  earned here ever resets, breaks, or goes to zero; the only thing that cycles is
  the deliberately cycle-scoped Cycling XP counter (C), which is non-punitive (its
  final value is archived permanently before it resets). R25 has three parts, **all
  now settled**: (A) tenure badges, (B) per-cycle records, (C) the Cycling XP
  counter.

  - **(A) Tenure badges — CALENDAR-TIME-SINCE-FIRST-USE, independent of consistency
    (settled reading; the only reading compatible with the no-streak thesis).**
    User unlocks a badge at each of these elapsed-time tiers, measured from a single
    **first-use anchor date** (the human's list, verbatim — **11 tiers**):
    **first day, 1 week, 1 month, 2 months, 6 months, 1 year, 2 years, 5 years,
    10 years, 20 years, 50 years.**
    - **Design constraint (PINNED): a tenure badge is earned purely by CALENDAR TIME
      ELAPSED since first use — entirely independent of how consistently, or whether
      at all, the user showed up.** A user who ignores the app for 11 months and
      reopens on day 366 **still earns the 1-year badge**. Tenure badges are **NOT**
      consecutive-usage streaks and **NOT** cumulative occurrence counts — they
      measure only wall-clock time since first use. This is exactly what makes them
      compatible with "no streaks, off days neutral": time elapsed is **unlosable**.
      A "show up every day for a year" badge would violate the thesis and is
      explicitly **NOT** what these are.
    - **Anchor date** = the user's first use of the app on this device (install /
      first launch / first-task creation). It **must** be a single fixed calendar
      date, consistency-independent. The precise anchor event (install vs. first
      task) is a minor spec-writer/designer detail, but it must be one fixed date and
      may not depend on usage. Because data is on-device with optional sync and can
      be wiped (R21's erase-all) or is per-install, the anchor is **device-local**;
      a genuine erase-all / reinstall starts a **fresh** anchor (consistent with
      onboarding re-showing) — a deliberate consequence of the no-account model, not
      a bug. (Whether an enabled cloud sync (R20) should carry the anchor across
      devices is a minor architect detail, not decided here.)
    - Once earned, a tenure badge is **permanent** and, like all of R7, **never
      resets, breaks, or goes to zero** on a missed or off day (binding no-streak
      constraint).
    - **Disambiguation from R7's existing badges (must NOT conflate — different
      axes):** R7 / IDEA's "Showing up" badges ("7 days," "30 days," "50×," "200×")
      are **cumulative showing-up / occurrence counts** (you *showed up* or completed
      that many times) — measuring *participation*, not elapsed time. The tenure
      **"1 week" / "1 month"** tiers are **calendar-elapsed** and are a **different
      badge** from the "7 days" / "30 days" showing-up-count badges; both may exist
      and downstream must keep them distinct (a user can hold the 1-month tenure
      badge with near-zero consistency). IDEA / R7's existing **"1 year"** milestone
      badge is **reclassified as the 1-year tenure tier here** — one badge, not a
      duplicate.

  - **(B) Per-cycle records ("record for each month," generalized to the chosen
    cadence) — settled.** User can view a **permanent, browsable per-cycle record (a
    "recap")**: for each elapsed cycle — a **calendar month by default, or a calendar
    week if the user selected the weekly cadence (C)** — the app finalizes a record
    summarizing that cycle: its **consistency %**, its ideal / fallback / off /
    missed breakdown, the **Cycling XP counter's final value for that cycle** (per
    (C)), and **badges (incl. tenure milestones) unlocked during that cycle**.
    Records are **permanent, accumulate into a history the user can look back on, and
    are never overwritten or lost** — a past cycle is archived, never "reset away."
    - **The cycle consistency % MUST reuse R6's aggregate proportional/fractional
      formula, windowed to that cycle (calendar month or calendar week) — NOT a new
      ad-hoc calculation.** Concretely it is **R6 scope-2 with the window = that
      cycle**: `cycle % = ( Σ f(D) over the cycle's elapsed days with ≥1 due, non-off,
      resolved task ) ÷ ( count of those days ) × 100`, rounded to the nearest whole
      percent, with **off days, pending tasks, and as-needed routines (R24) excluded
      exactly as R6 defines**. Spec-writer / qa-tester **reuse R6's mechanics and
      worked-example arithmetic**; they do **not** reinvent a per-cycle formula. (A
      calendar month or week is simply a specific window; R6 already supports a
      selectable window.)
    - **The ideal/fallback/off breakdown fork (R6 scope-2 sub-point) applies here
      too** — a per-cycle record's breakdown display inherits the same
      proportional-sums-vs-per-task-only fork flagged in R6 (OWNER: spec-writer/
      designer), since a cycle's days can mix ideal/fallback/off/missed exactly as
      the all-time dashboard's do.

  - **(C) Cycling XP counter (the human's "monthly reset," now with a
    USER-CONFIGURABLE reset interval) — SETTLED (human-confirmed a real cycle-scoped
    counter, then amended to a user-set weekly/monthly cadence).** The human
    confirmed, through the orchestrator, that "monthly reset" means a genuine
    **cycle-scoped tracking counter that resets to zero each cycle** — not just an
    archived recap where nothing actually resets — and has since amended the reset
    interval to be **user-configurable**.
    - **Cadence setting (exactly two options — NOT an open-ended interval).** In
      settings the user picks the reset cadence: **weekly** or **monthly**. These are
      the only two options (the human's words: "be it week or month"); there is **no
      custom/arbitrary interval** (e.g. no "every 10 days," no "quarterly").
      **Default cadence = monthly** — chosen because the human's original phrasing
      led with "monthly" and monthly is the more natural default for a habit recap.
    - **Naming (cadence-following label).** The mechanic is cadence-neutral
      internally ("Cycling XP counter"); the **user-facing label follows the selected
      cadence — "Monthly XP" when monthly (the default), "Weekly XP" when weekly.**
      The label must **not** read "Monthly" while a weekly cadence is active. (Exact
      copy is a spec-writer/designer detail; the pinned rule is only that the label
      matches the live cadence.)
    - **What it is / what it tracks (concrete, testable):** a counter that
      **accumulates XP the same way R7's lifetime XP does** — every completion of a
      **trackable (due, occurrence-bearing — recurring or one-off) task**, **ideal or
      fallback**, earns Cycling XP on the day it is logged, by the exact same XP rules
      as lifetime XP — but is **scoped to the current cycle only** (the current
      calendar week or calendar month, per the user's cadence). It **starts at 0 at
      the first instant of each cycle** and counts up across it. Because Cycling XP
      draws on the **same completions as lifetime XP** (R7), it earns from exactly the
      trackable completions lifetime XP earns from and from nothing else — in
      particular an **as-needed routine's (R24) reference-only "done/triggered" log
      earns NO Cycling XP**, identically to how it earns no lifetime XP (R7); "every
      task completion" here means every completion of a **trackable, scheduled** task
      (one with a due occurrence, recurring OR one-off — e.g. a one-off Event earns
      Cycling XP on its single due date), and explicitly **excludes** R24's
      cadence-less, never-due reference-only logs.
    - **Reset mechanic (identical for either cadence):** at the end of each cycle
      (each calendar **week** if weekly, each calendar **month** if monthly), the
      Cycling XP counter's **final value is permanently archived** as that cycle's
      figure in the (B) per-cycle record (shown alongside that cycle's consistency %,
      which (B) computes via R6's windowed fractional formula), and **then the
      counter resets to 0** for the new cycle and begins accumulating fresh. **A
      record is created at the end of EACH cycle** (week or month), whichever cadence
      the user picked — the archive-then-reset mechanic works **identically** for
      weekly and monthly. The reset is **non-punitive**: nothing is lost, because the
      value is archived before it zeroes; the fresh 0 is a new cycle's tally, not an
      erasure of past progress.
    - **Changing the cadence mid-cycle (settled, testable rule — chosen deliberately
      over the alternative):** switching the cadence setting takes effect
      **immediately**. The **in-progress cycle is finalized on the spot** — its
      partial counter value is archived as a (possibly short) per-cycle record,
      exactly as a normal boundary would archive it — the counter **resets to 0**,
      and a **fresh cycle begins under the new cadence**, running from the moment of
      the change to the **next natural calendar boundary of the new cadence** (the
      next calendar-week end if now weekly, the next calendar-month end if now
      monthly). So the first cycle after a cadence change may itself be short; that
      short record is **permanent like any other**. Past records keep whatever
      cadence they were finalized under; only future cycles follow the new cadence.
      **Why this rule (vs. "apply only from the next boundary"):** immediate archive
      is fully deterministic and testable — there is no ambiguity about *which*
      boundary a deferred switch would wait for (e.g. switching monthly→weekly
      mid-month has no well-defined "next weekly boundary" under the old cadence) —
      and it stays non-punitive because the partial value is archived, never lost.
    - **What the reset does NOT touch (three separate, non-resetting mechanisms —
      PINNED):** the Cycling XP reset has **zero effect** on (1) **lifetime XP /
      Level (R7)**, which never resets by its no-loss clause and keeps climbing
      monotonically; (2) the **tenure-badge clock and every earned tenure badge
      (A)**, which measure calendar time since first use and also never reset; and
      (3) the **all-time consistency % / history (R6), including the R26 graph**.
      Cycling XP is a **fourth, distinct, deliberately-cycling** figure that runs
      **in parallel** with these three lifetime mechanisms — it neither feeds them
      nor is fed by them. Lifetime XP and Cycling XP are computed from the **same**
      completions (each completion increments both), but they are **separate
      counters**: the same completion adds to lifetime XP permanently and to Cycling
      XP only until the cycle ends.
    - **Purely descriptive / archival — NOT a gate on tenure-badge unlocking
      (explicit non-conflation, the most likely downstream confusion).** The human's
      phrasing ("that way badges can unlock at first day, week, month…") does **not**
      mean the Cycling XP counter or the per-cycle record gates how tenure badges are
      earned. Tenure badges (A) are earned by **calendar time elapsed only** — the
      settled, no-streak-compatible reading (a user absent 11 months still gets the
      1-year badge). The Cycling XP counter and the per-cycle record (B) are a
      **separate, purely descriptive/archival "look back at your cycle" mechanism**
      and are **NOT a prerequisite, threshold, or gate** for any tenure-badge tier.
      The two systems **run in parallel; neither feeds the other.** Reaching any
      Cycling XP value **unlocks nothing** on its own — Cycling XP is a
      descriptive/archival figure, not an achievement gate. (Whether hitting a
      Cycling XP value fires a *celebration animation* is a harmless display detail
      for spec-writer/designer, but it grants no badge and gates nothing.)
    - **Still core/free** (part of R7 / R16's free tier), like the rest of R25.

  - **Not a farm-exploit concern (unlike a naive reading of R24):** tenure badges
    accrue from wall-clock time (unfarmed — time just passes), per-cycle records are
    computed from history (not user-triggerable), and Cycling XP accrues from the
    **same real trackable completions as lifetime XP** — the very same set, adding no
    new grinding surface. None of R25 introduces a self-serve grinding surface. The
    one place such a surface could otherwise have opened — an as-needed routine's
    freely-repeatable, never-due manual "used it" log (R24) — is explicitly closed:
    that log earns **zero XP of either kind** (settled in R24, and reinforced in R7
    and R25 C above), so marking an as-needed routine "done" any number of times
    grants no lifetime XP, no Cycling XP, no badge, and no record entry. Lifetime XP
    and Cycling XP both increment on the same **trackable** completion (see R7's
    no-loss mechanic); this is consistent, not double-counting, because they are two
    views of the same events.
- **R26** User can view an **all-time consistency trend graph** — a historical
  visualization of how the consistency % (R6) has moved over time, plotted across
  time buckets, as a richer complement to R6's single-number windows. **This is a
  NEW requirement (human-directed), separate from R6 and R25** (verbatim: *"I also
  mentioned an all time consistency graph (measured by the week, month, or years
  depends on how much data there is), hidden deeper inside the app, which would be
  better than an all time consistency percentage"*).
  - **Same underlying mechanic as R6 — NOT a new/different calculation.** Each
    plotted point is the **R6 scope-2 aggregate FRACTIONAL %** (`Σ f(D) ÷ count of
    qualifying days × 100`) windowed to that point's time bucket — the **identical
    arithmetic** to R6 and to R25(B)'s per-cycle record %, just one point per bucket
    strung into a series across the whole history. Off days, pending tasks, and
    as-needed routines (R24) are excluded exactly as R6 defines. Downstream must
    **reuse R6's mechanics**, not invent a graph-specific formula.
  - **Auto-granularity by data volume (adaptive time bucket).** The graph's bucket
    size adapts to how much history exists, so a long history stays readable rather
    than plotting years at daily/weekly density:
    - **< ~3 months of history → weekly buckets** (one point per calendar week).
    - **~3 months to ~3 years → monthly buckets** (one point per calendar month —
      each the R6 %-windowed-to-that-month, the same math a monthly (B) record uses).
    - **≥ ~3 years → yearly buckets** (one point per calendar year).
    - **The graph's granularity is driven by total history volume and is INDEPENDENT
      of the user's (C) reset cadence** (a user on a weekly Cycling-XP cadence can
      still see a monthly- or yearly-bucketed all-time graph, and vice-versa).
    - **These exact thresholds are a designer/architect judgment call.** The
      **pinned rule** is only that granularity **coarsens as history grows**
      (week → month → year) to keep the chart readable; the precise cutovers may be
      tuned. (OWNER: screen-designer / architect.)
  - **"Hidden deeper" — a SECONDARY surface, NOT a primary/Today-adjacent one.**
    Per the human's "hidden deeper inside the app," this graph is explicitly **not**
    the first thing a user sees and is **not** on the Today surface. It lives one
    level below the primary R6 consistency dashboard — e.g. a "See full history"
    affordance from the R6 dashboard, or under Settings → Progress/Badges. **Exact
    placement is a screen-designer decision**; the pinned requirement is only that
    it is a secondary, deeper view consistent with "hidden deeper."
  - **Relationship to R6's simple % — SETTLED as ADDITIVE (human-confirmed).** The
    human said the graph "would be better than an all time consistency percentage,"
    and has since **confirmed (through the orchestrator) that the graph is ADDITIVE**:
    it is an **ADDITIONAL, deeper, secondary view that does NOT remove or replace any
    of R6's primary dashboard windows.** R6's existing dashboard — its simple
    7 / 30 / **all-time** %-window quick-glance surface — stays **completely
    unchanged**; the all-time simple % specifically **remains** the primary
    at-a-glance number. **R26 is a new, separate surface** layered beneath it, not a
    substitute for it. **Reasoning (as confirmed):** IDEA Flow 9.1 shows a simple
    headline "%" as the primary progress screen, and a single at-a-glance number and
    a historical trend line serve **different jobs** (current status vs. trajectory);
    keeping both is the settled decision. This is **no longer an open question** —
    downstream (product-planner, spec-writer) must treat the additive relationship as
    fixed and must not re-open or re-ask it.
  - **Core/free**, like R6 and R25 (part of R16's free tier); it is a view over
    already-free consistency data, not a paid capability.

## Constraints
- Managed AI provider is **Groq** (server-side secret, wired at implementation
  time — not requested or stored in any artifact now).
- **Thin backend only**: it exists solely to proxy managed (Groq) AI/voice
  requests; **no user accounts and no server-side storage of user data**. BYO-key
  traffic bypasses the backend entirely (R19).
- Voice/text sent to the managed assistant leaves the device to reach Groq; the
  "data stays on this device" promise applies to habit data and identity, not to
  the content a user chooses to send the assistant.
- **Billing is store-native on both platforms**: Apple App Store on iOS and Google
  Play on Android. No third-party or custom payment processing (this is what the
  "no other payment rails" non-goal means — the platform's own store is not a
  departure from it).
- **Biometric/sensitive confirmation** should use each platform's native mechanism
  (Face ID / Touch ID on iOS, biometric prompt on Android); the specific
  realization is an implementation detail for the architect.
- **Accessibility is required to ship**: screen-reader support (VoiceOver on iOS,
  TalkBack on Android), dynamic/adjustable text size, and sufficient color contrast
  across the surface palette and both themes. (The R26 consistency graph must have
  an accessible, non-color-only representation — e.g. screen-reader-readable data
  points — since a chart cannot rely on color/shape alone.)
- **English-only** copy in v1, but architected so additional locales can be added
  later.
- **Zero analytics**: no usage, retention, or telemetry tracking of any kind.
- **Design system = the provided "Streakforge Design System"** (at
  `Streakforge Design System/`), which **replaces the earlier "Verdant" placeholder**
  that had been derived from IDEA.md. Streakforge is adopted purely as the
  visual/component system: cream/white surfaces, forge-orange primary, gold accent,
  Bricolage Grotesque / Inter / Space Grotesk type, its spacing/radius/motion rules,
  and its component set (Button, Card, Dialog, StreakBadge, XPBar, ProgressRing,
  CompleteCheck, etc.). Note Streakforge was built generically ("Duolingo meets
  Notion"), not for Fallback.
- **App identity is unchanged: the product stays named and positioned as
  "Fallback," NOT renamed to "Streakforge."** Streakforge is a design system, not a
  brand pivot.
- **No breakable-streak mechanic, ever (binding).** Streakforge's core visual
  motif is a literal streak — a `StreakBadge` gold flame pill and confetti at
  "7/30/100-day" streak milestones, with copy like "Streak saved." Fallback's
  no-streak non-goal stands: the gold flame/badge/XP visuals are **repurposed as a
  celebration motif for the existing XP/achievements system (R7, including R25's
  tenure badges, per-cycle records, and Cycling XP counter)** and must **never
  reset, break, or go to zero on a missed or off day.** (The Cycling XP counter's
  cycle-boundary reset — weekly or monthly per the user's setting — is the sole
  deliberate, non-punitive exception: it archives before it zeroes and never touches
  lifetime figures; it is a cycle-scoped tally, not a breakable streak.) There is no
  "current streak count." Any downstream agent (design-system, feature-builder) that
  sees "StreakBadge" must NOT infer streak-break semantics from the component name.
- Offline/error states are calm and non-punitive (never a full-screen red error);
  the two fixed tag vocabularies (Importance, Necessity) remain closed sets.

## Explicit non-goals (v1)
- User accounts, passwords, or server-side user data storage.
- Any analytics/telemetry.
- Localization beyond English.
- **Streaks or any punitive/loss-based mechanic** (reinforced by the Streakforge
  constraint above — the streak visuals are decorative-only for XP, never a
  breakable counter).
- **Any punitive "reset" that zeroes or breaks LIFETIME progress (R25).**
  The cycle-scoped **Cycling XP counter (R25 C)** does reset to 0 at each cycle
  boundary (weekly or monthly per the user's setting), but it is **non-punitive**:
  its final value is archived permanently into the per-cycle record (R25 B) before
  it zeroes, and it runs *alongside* — never replacing or zeroing — the lifetime
  figures. The **lifetime XP/Level (R7)**, the **tenure-badge clock and earned
  tenure badges (R25 A)**, and the **all-time consistency %/history (R6, incl. the
  R26 graph)** are **never** reset per cycle. It is a non-goal for the cycle reset to
  touch any lifetime figure.
- **XP, achievements, milestones, or confetti for an as-needed routine's (R24)
  reference-only log.** A cadence-less as-needed routine's manual "done/triggered"
  log earns **no lifetime XP (R7) and no Cycling XP (R25 C)** and unlocks no
  achievement, milestone, or celebration — XP is bound to the occurrence-based
  showing-up mechanic these logs do not participate in. It is a non-goal to award
  any XP or achievement for such logs, precisely to avoid a schedule-less self-serve
  grinding surface (consistent with FEATURES.md F27).
- **A custom/arbitrary Cycling-XP reset interval beyond weekly or monthly (R25 C).**
  The user picks exactly one of **weekly** or **monthly** (default monthly); it is a
  non-goal to support "every N days," quarterly, or any open-ended custom interval.
- **Tenure badges as consistency/streak achievements (R25 A), OR gated on the
  Cycling XP counter / per-cycle record (R25 B/C).** Tenure badges are
  calendar-time-elapsed only; it is a non-goal to gate them on consecutive usage,
  cumulative occurrence counts, any consistency threshold, or any Cycling XP value —
  the Cycling XP counter and tenure badges run in parallel and neither feeds the
  other.
- **Replacing R6's primary quick-glance % windows with the R26 graph.** The R26
  all-time graph is an additional, deeper view (see R26); it is a non-goal to remove
  the primary dashboard's simple 7 / 30 / all-time % (human-confirmed ADDITIVE — the
  primary windows, including the all-time %, stay unchanged).
- Free-form tags (only the fixed Importance and Necessity vocabularies).
- Payment methods other than the platforms' own app stores (no Stripe/custom
  processing).
- Named per-provider BYO integrations beyond a single OpenAI-compatible endpoint.
- Renaming or re-branding the app away from "Fallback."
- **Custom/arbitrary recurrence rules beyond the R23 cadence set** (e.g. "every
  3rd Tuesday," "2nd and 4th weekends," cron-style rules). v1 supports exactly the
  R23 cadences (daily, specific weekdays, weekly, bi-weekly, monthly, bi-monthly,
  yearly) — no free-form recurrence editor.
- **Consistency tracking / a %-shown-up figure for as-needed routines (R24).** The
  as-needed variant is deliberately untracked; it is a non-goal to compute, show,
  or "gamify" a consistency % for it (that is the whole point of the variant).

## Success criteria
- All 12 flows in the source doc (onboarding, create, complete/fallback, AI
  create, AI edit/clarify/recover, missed-day re-entry, subscribe, browse tabs,
  manage task, progress, first-launch/permissions, settings) plus the states
  gallery work end-to-end on **both iOS and Android**.
- A user can create a task by voice through the real assistant (via the paid
  Fallback AI subscription (Groq-backed) OR a BYO OpenAI-compatible key) and have
  it appear correctly.
- Completing all due ideal steps logs ideal; completing fewer logs fallback; both
  raise the "% showed up" figure. **An off day never counts as a miss, never resets
  anything, AND is excluded from the consistency % entirely (R4/R6) — it does not
  dilute the figure.** The dashboard reproduces the R6 worked examples: the
  breakdown 22 ideal + 4 fallback + 4 off + 0 missed reads **100%** (26/26), and
  22 ideal + 4 fallback + 4 off + 4 missed reads **87%** (26/30). (These replace
  IDEA.md's stale 26/30 = 87% example, which assumed off days in the denominator.)
- **The overall/aggregate dashboard uses proportional (fractional) daily credit
  (R6 scope 2):** a mixed day contributes its shown-up-fraction f(D), and the
  aggregate % = Σ f(D) / (count of elapsed days with ≥1 due, non-off, resolved
  task) × 100, rounded to the nearest whole percent. qa-tester asserts the 3-day
  anchor: Day 1 = 2/2 → 1.0, Day 2 = 1/3 → 0.333, Day 3 fully off → excluded, giving
  1.333 / 2 = **67%** (not the superseded all-or-nothing 50%). A day with a done
  task and a pending-today task contributes 1/1 = **1.0** (pending excluded from
  both sides). With exactly one due task per day the aggregate reduces to the
  per-task formula (the whole-day 100% / 87% examples above).
- **Tenure badges + per-cycle records + Cycling XP counter (R25):** a user unlocks a
  tenure badge purely by calendar time elapsed since first use — e.g. a user who did
  **not** show up for 11 months still gets the **1-year** badge on day 366 (tenure is
  consistency- and streak-independent, and is NOT gated on any Cycling XP value); the
  ladder is first day / 1 week / 1 month / 2 months / 6 months / 1 year / 2 years /
  5 years / 10 years / 20 years / 50 years; an earned tenure badge never resets or
  breaks. The app also produces a **permanent per-cycle record** whose consistency %
  is R6's aggregate fractional formula windowed to that cycle (same arithmetic, not a
  new formula).
- **Cycling XP counter cadence (R25 C):** the counter accumulates XP from the same
  **trackable** completions as lifetime XP (ideal or fallback) but scoped to the
  current cycle; the user can set the reset cadence to **weekly or monthly** (default
  **monthly**), and the user-facing label reads **"Monthly XP"** when monthly /
  **"Weekly XP"** when weekly. qa-tester asserts that at a cycle boundary (week-end
  if weekly, month-end if monthly) its final value is archived into that cycle's
  record and the live counter resets to **0**, while **lifetime XP/Level (R7), the
  tenure clock (R25 A), and all-time consistency % (R6) are unchanged by that reset**
  (they never reset per cycle). qa-tester also asserts the **mid-cycle
  cadence-change rule**: switching cadence immediately archives the in-progress cycle
  as a (short) record, zeroes the counter, and starts a fresh cycle under the new
  cadence to the next calendar boundary. The Cycling XP counter gates no badge — it
  is descriptive/archival only.
- **XP is trackable-only (R7 / R25 C / R24):** qa-tester asserts that marking an
  **as-needed routine (R24) "done/triggered" any number of times** (e.g. 50× in one
  day) earns **0 lifetime XP and 0 Cycling XP**, unlocks no achievement/milestone,
  produces no confetti, and creates no per-cycle-record entry — the log is
  reference-only and affects neither the consistency % nor any XP figure — while
  completing **any task with a due occurrence — a recurring Routine, a recurring
  Event, a one-off Event, or a Course** — at ideal or fallback earns both lifetime
  and Cycling XP.
- **All-time consistency graph (R26):** a user can open a secondary (not
  Today-adjacent) all-time consistency trend graph whose points reuse R6's fractional
  formula windowed to each time bucket; the bucket granularity coarsens as history
  grows (weekly for a short history, monthly for a medium one, yearly for a long one)
  so a multi-year history stays readable; and R6's primary quick-glance % windows
  (7 / 30 / all-time) still exist alongside it (human-confirmed ADDITIVE — the
  primary windows, including the all-time %, are unchanged).
- A user can set any R23 recurrence cadence (daily / specific weekdays / weekly /
  bi-weekly / monthly / bi-monthly / yearly) on a Routine, an Event (one-off by
  default, optionally recurring), and a Course; the task's occurrence set matches
  the chosen cadence, and consistency (R6) and sub-step toggles (R22) compute over
  that occurrence set.
- A user can create an **as-needed routine (R24)** with no cadence: it never
  appears as "due" on any day, it never enters the consistency % (numerator or
  denominator) at either scope, it never produces a "missed" day, and R22 sub-step
  scheduling is not offered for it. If the user manually marks it done/triggered on
  a date, that log is recorded as reference-only history and still does not affect
  the % (per R24's human-confirmed rules: optional ideal+fallback, exposed
  reference-only logging).
- A user can toggle a sub-step on/off per parent occurrence (R22): a sub-step
  limited to Friday appears only on the parent's Fridays and never on a day the
  parent does not run; and an occurrence's ideal/fallback state counts only the
  sub-steps due that occurrence (so completing every due step on a Tuesday, when a
  Friday-only step isn't due, logs the day ideal); and a configuration leaving any
  parent occurrence with zero due ideal sub-steps is rejected at save.
- Subscription purchase, 7-day trial, cancel, and Restore Purchases all function
  through both Apple App Store and Google Play billing.
- Accessibility check passes: full screen-reader navigation (VoiceOver/TalkBack),
  text scaling, and contrast on both themes.
- No network calls carry analytics/telemetry; BYO key never reaches Fallback's
  backend.
- App is submittable to both the Apple App Store and Google Play.

## Open questions (deferred / to confirm downstream)
- **RESOLVED (human-confirmed) — "monthly reset" scope, now with a
  user-configurable cadence (R25 C).** The human asked for "a monthly reset, and
  record for each month," confirmed "reset" means a **real cycle-scoped counter**
  (not merely a recap window), and has since **amended the reset interval to be
  user-configurable: weekly or monthly, default monthly** ("let the user set how
  often it resets (be it week or month)"). All parts remain settled: the **per-cycle
  record** (R25 B, default monthly / weekly if selected), the **tenure badges**
  (R25 A), and the **Cycling XP counter** itself (R25 C — a "Monthly XP"/"Weekly XP"
  counter accumulating the same XP as lifetime XP, archived into the per-cycle record
  and reset to 0 at each cycle boundary, purely descriptive/archival, gating no
  tenure-badge tier). The **mid-cycle cadence-change rule** (immediate archive of the
  partial cycle + fresh cycle under the new cadence) is settled in R25(C).
  **Pinned and unaffected by the reset:** the lifetime XP/Level (R7), the tenure
  clock and earned tenure badges (R25 A), and the all-time consistency %/history
  (R6, incl. the R26 graph) never reset per cycle. Spec-writer may **freeze R25(C)
  acceptance criteria** from R25(C)'s settled body. **Nothing under this item remains
  OWNER: human.**
- **RESOLVED (human-confirmed, no longer open) — R26 all-time graph is ADDITIVE, not
  a replacement.** The human called the graph "better than an all time consistency
  percentage," which was ambiguous between "an additional, richer view" and "a
  replacement for the all-time %-window." The human has **confirmed it is ADDITIVE**:
  the graph is a secondary, deeper view, and R6's primary dashboard windows
  (7 / 30 / **all-time** simple %) stay **completely unchanged** — the all-time %
  specifically is **not** removed or replaced. Settled in R26's body; downstream
  (product-planner, spec-writer) should treat the additive relationship as fixed and
  read the decision in R26 — it is recorded here only as an audit trail, not as a
  pending question. **Nothing under this item remains OWNER: human.**
- **Minor (OWNER: screen-designer/architect, NOT human) — R26 graph placement and
  granularity thresholds.** Exact "hidden deeper" placement (from the R6 dashboard
  vs. Settings → Progress/Badges) is a screen-designer call; the requirement pins
  only that it is a secondary, non-Today surface. The exact data-volume cutovers for
  weekly→monthly→yearly bucketing (R26 proposes ~3 months and ~3 years) are a
  designer/architect judgment call; the pinned rule is only that granularity
  coarsens as history grows to keep the chart readable.
- **Minor (OWNER: spec-writer/designer, NOT human) — R25 first-use anchor event.**
  Which concrete event fixes the tenure anchor date (install vs. first launch vs.
  first-task creation) is a small design detail; the requirement pins only that it
  is **one fixed calendar date, consistency-independent, and device-local** (a
  genuine erase-all/reinstall restarts it). Whether an enabled cloud sync (R20)
  carries the anchor across devices is a minor architect detail.
- **RESOLVED (human-confirmed, no longer open) — three as-needed routine (R24)
  items now settled in R24's body:** (1) user-facing **name = "As-needed routine"**;
  (2) ideal+fallback is **optional** for the variant; (3) manual "done/triggered"
  logging is **exposed and reference-only, with zero effect on the consistency %**
  **and earning zero XP of either kind** (no lifetime XP, no Cycling XP, no
  achievement/milestone — matching FEATURES.md F27). Downstream (product-planner,
  spec-writer) should treat these as fixed and read the decisions in R24 — they are
  recorded here only as an audit trail, not as pending questions.
- **RESOLVED (human-confirmed, no longer open) — overall-dashboard day-level rollup
  rule (R6 aggregate scope). This was the LAST open Gate-1 item.** After a
  clarifying exchange confirming the human meant the **aggregate/overall** dashboard
  (IDEA Flow 9.1's "87% / 26 of 30 days" screen — explicitly distinct from any
  single task's own % and from F23's sub-step-due-that-day rule, both already
  settled and unaffected), the human settled it as **PROPORTIONAL / FRACTIONAL
  credit**, superseding the previously-proposed all-or-nothing default: each
  calendar day contributes a fraction f(D) = (its due, non-off, resolved tasks shown
  up) ÷ (its due, non-off, resolved tasks), and the aggregate % = Σ f(D) ÷ (count of
  elapsed days with ≥1 due, non-off, resolved task) × 100. The previously-offered
  all-or-nothing default is **superseded and must not be carried forward.** Full
  mechanics — the reduce-to-per-task sanity check, zero-due/all-off exclusion, the
  per-task pending-today composition (pending tasks excluded from both sides of
  f(D)), and the worked mixed-day example (67%, not the superseded 50%) — are in R6
  scope 2 above. **Nothing under this item remains OWNER: human.**
- **Two residual DESIGN/DISPLAY forks the human's answer does NOT decide (OWNER:
  spec-writer/designer — NOT OWNER: human; do not re-escalate to the Gate-1 human
  queue).** The human settled the aggregate **%**; these two are downstream
  display/copy calls, flagged so they are resolved deliberately, not silently:
  1. **Ideal / fallback / off breakdown under fractional credit** — whether the
     aggregate dashboard reports the breakdown as **proportional sums** (the
     recommended default in R6 scope 2: Σ ideal-credit / Σ fallback-credit /
     Σ missed-credit) or keeps the ideal-vs-fallback distinction purely per-task and
     shows only overall % + shown-up/missed at the aggregate. A single day can now
     mix ideal, fallback, off and missed tasks, so the old whole-day
     ideal/fallback/off day-count label no longer applies as-is. **(This same fork
     applies to R25 B's per-cycle-record breakdown, which reuses the R6 window.)**
  2. **"X of Y days" framing** — whether to keep any "days" framing (and if so,
     expressing X as the rounded Σ of fractional credits, with Y the whole
     denominator day-count) or switch to a pure "%" display, given the numerator is
     no longer a whole count of days. R6 pins the underlying fact (X is not a whole
     day-count); the framing choice itself is display/copy.
- **R22 sub-step subsetting for single-occurrence cadences (R23 interaction) —
  design/architect detail.** For weekly / bi-weekly / monthly / bi-monthly / yearly
  cadences that produce one occurrence per period, per-occurrence sub-step toggling
  is largely degenerate. Whether the UI even exposes a subset control for those
  cadences (vs. only for daily/weekday cadences where a period has several
  occurrences), and how any subset is expressed for an unbounded future occurrence
  stream, is left to design/architect. The rule (subset of the parent's own
  occurrences; never outside them; no empty run-occurrence) is fixed; only its
  surfacing for coarse cadences is open. (Does not touch as-needed routines, R24,
  which have no occurrence set at all — R22 simply does not apply there.)
- **Streakforge color semantics vs. the fallback-orange rule (Phase 2
  design-system decision — NOT resolved here):** Fallback requires "orange reserved
  as the fixed *fallback* signal color, never decorative," but Streakforge's
  forge-orange (`#E8590C`) is its app-wide *primary/CTA* color, and Streakforge
  also reserves gold for XP/streak visuals. These token semantics conflict.
  Reconciling them — which hue carries the fallback signal vs. the primary CTA vs.
  the celebration accent — is an explicit decision for the Phase 2 design-system
  agent.
- **Cloud sync mechanism & depth (both platforms):** what provides sync on Android
  (iCloud has no Android equivalent) — a platform cloud-drive, a cross-platform
  sync layer, or none — and whether real multi-device conflict resolution is
  required in v1 or single-device is the practical target. Architect to resolve.
- **STT for the managed tier**: whether Groq provides the speech-to-text used on
  the subscription path, or a separate transcription service is needed — an
  architecture detail for the architect to resolve.
- Exact Groq model(s) for the managed assistant (implementation-phase decision).
