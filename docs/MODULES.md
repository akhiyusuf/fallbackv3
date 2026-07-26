# MODULES — Fallback

The parallelism contract. **No path is owned by two modules.** If you need to change a
file you do not own, stop and raise it — do not edit it, do not copy it, do not shadow it.

Read first: `docs/PRD.md` (law) · `docs/ARCHITECTURE.md` (stack, conventions, the pinned
consistency algorithm) · `docs/SCHEMA.md` · `docs/API.md`.

Design inputs (**not** at the usual paths — see the PROJECT OVERRIDE in `CLAUDE.md`):

| Instead of | Read |
|---|---|
| `design/screens/*.md` | `design-input/fallback-handoff/uploads/ALLSCREENS_1.md` (S01–S50) |
| `design/DESIGN.md` | `design-input/fallback-handoff/_ds/verdant-design-system-*/` **plus** `design-input/fallback-handoff/fallback-theme.css` (**wins on conflict**) |
| `design/mockups/*.html` | `design-input/Fallback Handoff (standalone).html` |

`design-input/**` is human-owned — **read only, never write**. Ignore
`design-input/fallback-handoff/scraps/` entirely.

---

## Build order

```
WAVE 1  (3 builders in parallel — FREEZE at the end of this wave)
  M0  Kernel            M1  Data layer       M2  Domain engine

WAVE 2  (5 builders in parallel)
  M3  Today & browse    M4  Task authoring   M5  Progress
  M6  Assistant         M7  First-run & preferences
```

**Freeze rule.** At the end of Wave 1, the public surfaces of `src/types`, `src/theme`,
`src/ui`, `src/lib`, `src/navigation`, `src/db`, `src/domain` and `src/queries` are
**frozen**. Wave-2 builders import them and never modify them. A needed change to a frozen
surface is an architect change request, not an edit.

### Scaffold deference — pinned decisions are pinned, scaffolded bytes are not

The architect pre-wrote part of the tree (shared types, tokens, `src/lib/number.ts`, route
stubs) so every module starts from a compiling app. **That code is a starting point, not
scripture.**

- **If you find a genuine defect in scaffolded code inside a path YOU own — fix it.** Add a
  regression test, and say so in your result so the fix is visible. Do not preserve a bug
  out of deference, and do not work around it in your own code.
- **What you may not change without an architect change request:** a *pinned decision* —
  the round-half-up algorithm and its locked assertions (ARCHITECTURE §6.5), the
  consistency algorithm (§6), the chip→outcome mapping (§6.1), the counted-day window
  (§6.4), the delete-cascade split (SCHEMA §2.3), the design-pinned level titles and badge
  labels (SCHEMA §7) — or anything in a **frozen** or **unowned** path.
- The distinction: `roundHalfUp` returning the wrong value for 12.5 would be a defect worth
  fixing; changing it to banker's rounding would be re-opening a pin. The eight locked
  assertions in `src/lib/number.test.ts` are the arbiter, and they work in one direction
  only: **never edit a locked assertion's expected value** — a fix that requires editing one
  is re-opening the pin, so raise it instead. A code change that makes a locked assertion
  **fail that used to pass** is wrong. A code change that makes a **failing** locked
  assertion pass is exactly what a defect fix looks like — that is the good case, ship it.
- Same rule for `src/types`: extend it freely, restructure it freely **if it is wrong**;
  just don't silently change the shape of a contract another module is coding against
  without flagging it.

**Wave-1 sequencing note (the one real coupling).** M1's five screens need M0's component
kit. M1 must therefore deliver in this order: (1) `src/db` + migrations + repositories,
(2) `src/services/data` + `src/services/sync`, (3) its five screens last. Those screens
use only six kit components — `Button`, `Card`, `EmptyState`, `InlineRetryBanner`,
`Switch`, `Toast` — so M0 should land those six first. Nothing else in Wave 1 is coupled.

---

## Architect-frozen — owned by no module

`package.json` · `package-lock.json` · `app.config.ts` · `tsconfig.json` ·
`babel.config.js` · `metro.config.js` · `jest.config.js` · `eslint.config.js` ·
`.gitignore` · `app/index.tsx` · `docs/**` · `design/**` · `design-input/**` ·
`review/**` · `CLAUDE.md`

Every plugin, permission, entitlement and dependency v1 needs is **already declared**.
**Builders may not add dependencies.** If you think you must, that is an architect change
request.

---

## M0 — Kernel: types, tokens, component kit, shell

**Owns paths**
```
src/types/**
src/theme/**
src/ui/**
src/lib/**
src/navigation/**
src/app-shell/**
app/_layout.tsx
app/(tabs)/_layout.tsx
```

**Implements** — no screens directly; every screen depends on it.
Features touched: F8 (theme/accent plumbing), plus the design-system layer for all 50.

**Scope**
- The shared type surface (scaffolded — extend it; restructure or correct it if it is
  actually wrong, and flag any contract-shape change in your result — see "Scaffold
  deference" above).
- Design tokens transcribed from Verdant + `fallback-theme.css`, light **and** dark
  palettes, the four-accent closed set, `useTheme()`, `resolveScheme()`.
- The full component kit. Verdant primitives: `Button` (primary/secondary/ghost/danger,
  with the tactile bottom shadow), `IconButton`, `Card`, `Input`, `Textarea`, `Select`,
  `Switch`, `Radio`, `Checkbox`, `Badge`, `Tabs`, `Dialog`/sheet, `Toast`, `ProgressRing`.
  Fallback-custom: `StateChip`, `OffDayToggle`, `BottomTabs`, `ConsistencyBreakdownBar`,
  `ConsistencyRing`, `MilestoneBadge`, `EmptyState`, `Skeleton`, `InlineRetryBanner`,
  `Tag`, `CalendarHeatmap`, `WeekdayPicker`, `CadencePicker`, `SubStepScheduleGrid`,
  `XPBar`, `TrendGraph`, `AsNeededCard`.
- `src/lib`: `date.ts` (the app's only clock — see ARCHITECTURE.md §7), `number.ts`
  (scaffolded; the **round-half-up algorithm and the eight assertions in
  `number.test.ts` are pinned** — the implementation bytes are yours to correct if they are
  defective, the algorithm is not yours to change), `events.ts`, `id.ts`.
- `src/navigation`: route constants, `useOriginAwareBack`, `withOrigin`.
- Root providers, `useDayRollover`, root error boundary, the four zustand stores.

**Depends on contracts** — none. M0 is the base.

**Non-negotiables**
- **Rule 4: no text on a signal fill, ever.** `StateChip` = icon-only pill in the signal
  fill + text label beside it on the neutral background. `CalendarHeatmap` = icon-only
  fill + day numeral as a caption below. Both were fixed defects in the design pass; do
  not regress them.
- **Rule 1: no raw colour literal outside `src/theme/tokens.ts`.**
- No signal colour may be derived from `accent`, in either palette.
- Every kit component takes `accessibilityLabel`/`accessibilityRole` and survives the
  largest Dynamic Type setting without clipping or fixed heights.
- The word "streak" appears nowhere — not in a component name, prop, comment or a11y label.

**May NOT touch** — anything outside the owned paths. In particular: no `src/db`, no
`src/domain`, no `src/features`.

**Size:** L (largest single module by component count; zero screens).

---

## M1 — Data layer & data lifecycle

**Owns paths**
```
src/db/**
src/services/data/**
src/services/sync/**
src/features/data/**
app/splash.tsx                 (S01)
app/recovery.tsx               (S50)
app/settings/sync.tsx          (S45)
app/settings/data/index.tsx    (S47)
app/settings/data/erase.tsx    (S48)
```

**Implements** F1 (S01, S50), F19 (S47), F20 (S45), F25 (S47, S48).

**Scope**
- SQLite client (WAL, foreign keys on), the full DDL of `docs/SCHEMA.md`, numbered
  forward-only migrations with `user_version`, and typed repositories implementing the
  `Repositories` port.
- `StoreLifecycle`: `open` (with corrupt detection → S50), atomic `eraseAll`, `backup`,
  non-destructive `restore`.
- `SyncProvider`: iCloud Documents (iOS) and Drive `appDataFolder` (Android), best-effort,
  local-authoritative.
- Its five screens.

**Depends on contracts** — `docs/SCHEMA.md` (every table, every CHECK), `docs/API.md` §1,
`src/types/ports.ts`, M0's kit for the five screens.

**Non-negotiables**
- **Nothing outside `src/db` writes SQL.** Repositories are the only door.
- **The delete cascade is split and the split is load-bearing** (SCHEMA.md §2.3): remove
  `step`, `day_log`, `off_day_mark`, `as_needed_use`; **never** remove `xp_award`
  (`ON DELETE SET NULL`), `achievement_unlock` or `cycle_record`. This matches PRD F7's own
  cascade, which names only log + off-day records, and it is what keeps lifetime XP
  monotonic. The hard sweep runs on the next `open()`; there is no compaction job.
- `eraseAll` is **atomic**: fully erased or fully intact, never half-wiped. It clears
  SecureStore keys and widget snapshot files too.
- A failed `restore` leaves existing data **untouched** and lands in the non-destructive
  failure state — never a partial write.
- A backup **never** contains the BYO key, the store receipt, or the entitlement row.
- Corrupt store on launch → S50, calm, never a crash loop, **never an auto-wipe without
  confirmation**.
- S48 is **origin-aware**: copy *and* Cancel destination differ between origin S47
  (working store) and S50 (unreadable store). Never hardcode either.
- **F22 (true multi-device conflict resolution) is P2 — out of v1.** Do not build toward
  it; do not leave hooks implying it.
- Mandatory test: an older-version fixture opens without data loss (F1).

**May NOT touch** — `src/domain`, `src/queries`, any other feature folder, any other
`app/settings/*` file.

**Size:** L.

---

## M2 — Domain engine + query/mutation layer

**Owns paths**
```
src/domain/**
src/queries/**
```

**Implements** the computational core of F3, F4, F5, F12, F13, F23, F24, F26, F27, F28,
F29, F30, F31. No screens.

**Scope**
- `occurrence.ts` — all seven R23 cadences → occurrence sets, plus F23/F24 due-step
  resolution. As-needed routines and To-dos are never due.
- `dayState.ts` — the single chip→outcome mapping and the "missed" definition.
- `consistency.ts` — **one** implementation of the pinned algorithm, used by F5 (both
  scopes), F7's stat line, F28's buckets and F30's cycle %.
- `xp.ts`, `achievements.ts`, `cycles.ts`, `validation.ts`.
- `src/queries` — every read hook and every mutation, including the fixed seven-step
  mutation sequence in `docs/API.md` §3 and the `QUERY_KEYS` map.
- `src/domain/__fixtures__/` — the PRD §6 seed set, reused by everyone.

**Depends on contracts** — `docs/ARCHITECTURE.md` §6 (the algorithm, verbatim),
`docs/API.md` §2–§3, `@/types`, `@/lib`, and `repos` from `@/db` (typed by the M0 port —
you can write and typecheck against it before M1 finishes).

**Non-negotiables**
- `src/domain/**` imports **nothing** but `@/types` and `@/lib`. No React, no SQL, no
  `expo-*`, **no `new Date()`**.
- Implement ARCHITECTURE.md §6 exactly. Do not re-derive, do not "simplify", do not add an
  intermediate rounding step. Every row of the §6.6 golden table is a required test.
- `percent === null` when the denominator is 0 — **never `0`**.
- Off-ness and pending-ness compose **per task within a day**, never per day.
- As-needed logs and To-do checkboxes award **zero XP of either kind**, unlock nothing,
  and celebrate nothing — no matter how many times they are logged.
- XP eligibility is keyed on **having a due occurrence** (recurring *or* one-off), never on
  a cadence. A one-off Event earns XP.
- Cycle boundaries: **archive always precedes zeroing.** A mid-cycle cadence change
  finalises immediately. Nothing lifetime ever resets.
- **Lifetime XP and level are monotonic under every user action, task deletion included.**
  `reconcileAchievements` is upsert-only and never revokes. Required test: log 10 ideal
  days on a task (100 XP), delete the task → lifetime XP still 100, level unchanged, badges
  unchanged, and those 10 days leave the F5 denominator (SCHEMA.md §2.3).
- The level-title constant lives here (`src/domain/xp.ts`). **L1 "Getting started",
  L7 "Consistent" and L8 "Dependable" are design-pinned** — S27/S28/S41 render them as
  exact copy. The other seven are architect-authored defaults.
- `validateTaskDraft` / `emptyRunOccurrences` are written **once** here and called by both
  the create forms and the manage sheet. S20's spec says "replicate it, don't reinvent it."

**May NOT touch** — `src/db` internals (import the public `repos` only), `src/ui`,
`src/features/**`, any `app/**` file.

**Size:** L (highest-risk module; also the highest-value test surface).

---

## M3 — Today, browse & search

**Owns paths**
```
src/features/today/**
src/features/browse/**
src/features/search/**
app/(tabs)/today.tsx      (S09)
app/(tabs)/routines.tsx   (S10)
app/(tabs)/events.tsx     (S11)
app/(tabs)/courses.tsx    (S12)
app/(tabs)/todos.tsx      (S13)
app/search.tsx            (S14)
```

**Implements** F3 (chip logging from Today), F4 (whole-day off toggle), F5 (the stat chip),
F6 (S09–S13), F11 (browse surfaces), F15 (S14), F27 (as-needed rows in the Routines browse).

**Depends on contracts** — `@/queries` hooks, `@/ui`, `@/theme`, `@/navigation`.

**Non-negotiables**
- Chip tap logs **without leaving Today**, persists immediately, recomputes F5 immediately,
  and on a qualifying completion presents **S24** (route `/task/:id/celebrate`, owned by M4).
- **Whole day off** disables every row's chip and shows the off-day toast; un-marking
  restores every task's prior logged state exactly.
- An as-needed routine appears in the **Routines browse** and **never** on Today. Its row
  is `AsNeededCard` (no due badge, no cadence text, no heatmap) and taps through to
  **S23**, not S20 — the same branch applies to an as-needed result in S14.
- S14's back control is **origin-aware** across S09–S13.
- Stat chip on zero data reads the no-data copy, **never "0%"**.
- Every list has its specified empty state — never blank. Two distinct Today empties
  (blank slate vs. nothing due today).
- FAB clearance: the add button must never overlap a card at any scroll position.
- Copy verbatim from `ALLSCREENS_1.md`, including the F14 re-entry banner state on S09.

**May NOT touch** — `app/add/**`, `app/task/**`, any other feature folder.

**Size:** M.

---

## M4 — Task authoring & management

**Owns paths**
```
src/features/task/**
app/add/index.tsx            (S15)
app/add/routine.tsx          (S16)
app/add/event.tsx            (S17)
app/add/course.tsx           (S18)
app/add/todo.tsx             (S19)
app/task/[id]/index.tsx      (S20)
app/task/[id]/icon.tsx       (S21)
app/task/[id]/delete.tsx     (S22)
app/task/[id]/as-needed.tsx  (S23)
app/task/[id]/celebrate.tsx  (S24)
```

**Implements** F2, F3 (logging inside the manage sheet), F4 (task-day off), F7, F11, F12,
F13 (S24's XP line), F23, F24, F26, F27.

**Depends on contracts** — `@/queries` (esp. `useCreateTask`, `useUpdateTask`,
`useLogState`), `@/domain`'s `validateTaskDraft` / `emptyRunOccurrences`, `@/ui`'s
`CadencePicker` / `WeekdayPicker` / `SubStepScheduleGrid` / `CalendarHeatmap` / `StateChip`.

**Non-negotiables**
- **Call M2's validator. Do not write a second one.** The no-empty-run-occurrence check is
  over the **union of every ideal step's due-days per day**; the inline error names the
  offending weekday.
- The as-needed switch on S16 branches the whole form: no cadence, no sub-step grid, ideal
  and fallback become **optional**. Toggling it back must not lose data.
- Weekly…yearly cadences replace the sub-step grid with the static degenerate note —
  no toggle control for those cadences.
- The sub-step grid governs **ideal** steps only. The fallback is whole-task and available
  on every run-occurrence.
- Duplicate copies definitions, metadata and toggle state but starts with **empty history**.
- Snooze/move affects the **occurrence**, not the cadence.
- **S22 carries two SEPARATE origin rules — implement both, do not merge them**
  (ARCHITECTURE §4.3; `ALLSCREENS_1.md` S22 lines 1155–1166 and 1202–1247):
  - **"Keep it" / scrim / back** → the screen that *opened* S22: S20 if from S20, S23 if
    from S23. Never falls through to S20 from the S23 path.
  - **Confirmed delete** → wherever *that* screen was itself reached from, a two-level
    lookup: S20's own origin if it is stable (**S09 or S10–S13**) → **that same screen**;
    if unstable (S14 or unknown) → the deleted task's **type browse tab**; from **S23** →
    always **S10**. The most common path must work: **S09 → S20 → S22 → confirm → S09.**
    Deleting from Today returns to Today, not to the Routines tab.
  - S14 is never a stable post-delete destination on either path.
- S23 is **origin-aware** on back (S10 or S14, whichever opened it).
- S22's "Delete routine" is the `danger` Button variant; the icon beside it stays muted and
  is **not** red (ARCHITECTURE §10).
- S23 is deliberately lean: no StateChip, no heatmap, no sub-step toggles. Its history is a
  reverse-chronological used-dates **list**, and there is no "missed" concept on it. The
  "Log used it" toast is **"Logged to history"** and carries **no XP, no achievement, no
  confetti**.
- S24 uses the spring pop + XP tick only — **no confetti, no gold, no MilestoneBadge**.
  Those are reserved for S27–S30. If the completion crossed a level-up or milestone,
  navigate to `/achievements/celebrate` (S28, M5's) **after** S24 is dismissed.
- Empty-history heatmap renders the same blank grid as not-due/future cells — **no missed
  fills**, legend still shown.

**May NOT touch** — `app/(tabs)/**`, `app/achievements/**`, any other feature folder.

**Size:** XL (10 screens, the most complex forms in the app).

---

## M5 — Progress & motivation

**Owns paths**
```
src/features/progress/**
app/progress/index.tsx      (S25)
app/progress/trend.tsx      (S26)
app/achievements/index.tsx  (S27)
app/achievements/celebrate.tsx (S28)
app/records/index.tsx       (S29)
app/records/[cycleId].tsx   (S30)
```

**Implements** F5 (the dashboard), F13, F28, F29, F30, F31.

**Depends on contracts** — `@/queries` (`useConsistency`, `useProgress`, `useTrend`,
`useCycleRecords`), `@/ui`'s `ConsistencyBreakdownBar` / `XPBar` / `MilestoneBadge` /
`TrendGraph`.

**Non-negotiables**
- **Render M2's numbers. Compute nothing.** No percentage arithmetic in this module.
- S25's aggregate legend units differ by category and the caption must say so:
  Ideal/Fallback are rounded credit sums, Off is a whole day-count, Missed is the rounded
  remainder. Rounding is round-half-up.
- The breakdown bar is **never fully filled when Missed > 0** — missed is the unfilled
  remainder and has no colour of its own.
- No-data renders the no-data copy, **never "0%"**, never an empty axis.
- S26 is **additive**: it never replaces S25's primary 7 / 30 / all-time numbers, and it is
  never on Today. Only **completed** buckets plot; a gap is a break in the line, never a
  fabricated 0%. Granularity coarsens automatically (`<3 months` weekly, `3 months–3 years`
  monthly, `3 years+` yearly) and is not a user control.
- **Ship-blocking a11y:** S26 carries a screen-reader-only text summary of every bucket at
  **all times**, plus the "View as table" toggle. A chart may never be the only
  representation.
- S27's Cycling XP label **follows the cadence** — it must never read "Monthly" while
  weekly is active. Tenure badges show a **calendar** unlock condition, never a consistency
  one, and are never gated on Cycling XP.
- S28 is the **only** confetti surface, fired once, for a true level-up or a milestone
  tenure unlock. Locked badges get no celebration.
- S28's "New title: Dependable." is rendered from `levelFor(xp).title`, **not hardcoded** —
  the constant returns "Dependable" at level 8, so the exact-copy rule and the constant
  agree by construction. Same for "Level 7 · Consistent" on S27/S41. There is exactly one
  source for a level title.
- S25, S27 and S29 are **origin-aware**.
- Nothing lifetime ever resets. There is no "current streak count" anywhere.

**May NOT touch** — `src/domain`, `src/queries`, any other feature folder.

**Size:** L.

---

## M6 — Assistant, billing & BYO (+ backend)

**Owns paths**
```
src/features/assistant/**
src/services/ai/**
src/services/billing/**
server/**
app/assistant/index.tsx           (S31)
app/assistant/chat.tsx            (S32)
app/assistant/history/index.tsx   (S34)
app/assistant/history/[id].tsx    (S35)
app/assistant/mic-primer.tsx      (S37)
app/assistant/paywall/index.tsx   (S38)
app/assistant/paywall/plan.tsx    (S39)
app/assistant/paywall/byo.tsx     (S40)
app/settings/subscription.tsx     (S44)
```
S33 (clarification modal) and S36 (options sheet) have no route and live at
`src/features/assistant/ClarificationModal.tsx` / `OptionsSheet.tsx`.

**Implements** F16 (S31–S37), F17 (S38, S39, S44), F18 (S38, S40).

**Depends on contracts** — `docs/API.md` §4–§5 and §7, `@/queries` mutations (for applying
tool calls), `@/domain`'s `validateTaskDraft`.

**Non-negotiables**
- **Tool calls are proposals, not actions.** The model never touches the database. Validate
  every call with M2's validator and apply it through M2's mutations. A malformed call is
  dropped and restated — never a half-written task.
- The BYO key lives **only in SecureStore** — never SQLite, never a backup, never a log,
  never an outbound request to Fallback's backend.
- `ManagedAssistantProvider` and `ByoAssistantProvider` implement the **same port**, so no
  screen knows which path it is on.
- The backend stores **no user data and holds no accounts** — receipt-based entitlement,
  verified per request, persisted never. No logging of message content.
- Guardrails: the five R15 categories, **injected on both paths**, enforced server-side on
  the managed path, best-effort on BYO. The literal logging task is **always still
  fulfilled** with no advice attached — build the four canonical fixtures from `API.md` §4.
- S38: BYO is a **structurally identical second card**, not a fine-print link. When the
  store is unreachable, Card A disables and **Card B is entirely unaffected** — and the
  banner says so.
- Purchase confirmation goes through the OS biometric prompt. Restore Purchases needs **no
  login**. Cancellation hands off to the platform's own surface (there is no in-app cancel).
- Every failure is calm: offline shows the retry footer with "Add a task manually" → S15;
  a biometric cancel or purchase error is non-punitive and charges nothing; an invalid BYO
  endpoint keeps the typed values and never goes full-screen red.
- **Uncertain transcription support must never block a BYO save** — degrade to text-only.
- Privacy copy is verbatim: assistant message content leaves the device; habit data never
  does.

**May NOT touch** — `app/settings/*` other than `subscription.tsx`, any other feature
folder.

**Size:** XL (10 screens + a backend; the largest build item per PRD §3B).

---

## M7 — First run, preferences, notifications & widgets

**Owns paths**
```
src/features/onboarding/**
src/features/settings/**
src/services/notifications/**
src/services/widgets/**
native/**
plugins/**
app/onboarding/hook.tsx                   (S02)
app/onboarding/concept.tsx                (S03)
app/onboarding/types.tsx                  (S04)
app/onboarding/consistency.tsx            (S05)
app/onboarding/personalize.tsx            (S06)
app/onboarding/notifications-primer.tsx   (S07)
app/onboarding/first-task.tsx             (S08)
app/settings/index.tsx                    (S41)
app/settings/notifications.tsx            (S42)
app/settings/theme.tsx                    (S43)
app/settings/widgets.tsx                  (S46)
app/settings/help.tsx                     (S49)
```

**Implements** F8 (S43, S06), F9 (S02–S08, S49), F14 (S07, S42), F21 (S46 + both native
targets).

**Depends on contracts** — `@/queries`'s `useSettings`/`useUpdateSettings`, `@/theme`,
`docs/API.md` §8.

**Non-negotiables**
- Onboarding is **skippable**, does **not recur** after completion (persisted flag), and
  resumes if killed mid-way. **No network in onboarding.**
- Every OS permission is **primed with a rationale before** the system prompt, and the app
  is **fully usable if declined**.
- S08's mini-create applies the four defaults silently (cadence daily, Medium/Recommended,
  icon `Repeat`, colour Forge Orange) — none surfaced as a choice, all editable later.
- S43's live preview is the proof of the accent-immune rule: the Button and ProgressRing
  recolour with the accent, the four StateChips **do not**. Do not claim theme-invariance —
  only accent-invariance.
- S42's all-off empty state has **two** renderings: master-off replaces the sections;
  master-on-with-all-subs-off keeps every section visible and switchable and adds the
  banner. Never hide the controls a user needs to leave the state.
- Notifications are **local only** — no push tokens, no server, no notification service
  extension. Rolling 7-day horizon, re-armed on foreground and on task change.
  As-needed routines generate **no** "routine due" reminders.
- Widgets are two separate native targets fed by a shared-container JSON snapshot. They
  read the snapshot only and never open the database. They honour theme + the fixed signal
  colours.
- `plugins/withFallbackWidgets.js` is currently a pass-through stub — fill it in; do not
  change its path or its reference in the frozen `app.config.ts`.

**May NOT touch** — `app/settings/sync.tsx`, `app/settings/data/**`,
`app/settings/subscription.tsx`, any other feature folder, `app.config.ts`.

**Size:** L.

---

## Coverage check

**All 50 screens, exactly once.**

| Module | Screens | Count |
|---|---|---|
| M0 | — (shell + kit) | 0 |
| M1 | S01, S45, S47, S48, S50 | 5 |
| M2 | — (no UI) | 0 |
| M3 | S09–S14 | 6 |
| M4 | S15–S24 | 10 |
| M5 | S25–S30 | 6 |
| M6 | S31–S40, S44 | 11 |
| M7 | S02–S08, S41, S42, S43, S46, S49 | 12 |
| | **total** | **50** |

**All in-scope features.** F1 M1 · F2 **M2**/M4 *(M2 owns `validateTaskDraft`, which
implements F2's save rules)* · F3 M2/M3/M4 · F4 M2/M3/M4 · F5 M2/M3/M5 · F6 M3 · F7 M4 ·
F8 M0/M7 · F9 M7 · F11 M3/M4 · F12 M2/M4 · F13 M2/M4/M5 · F14 **M3**/M7 *(M3 owns S09's
re-entry banner, the F14 notification-tap landing state)* · F15 M3 · F16 M6 · F17 M6 ·
F18 M6 · F19 M1 · F20 M1 · F21 M7 · F23 M2/M4 · F24 M2/M4 · F25 M1 · F26 M2/M4 ·
F27 M2/M3/M4 · F28 M2/M5 · F29 M2/M5 · F30 M2/M5 · F31 M2/M5.
*(F10 does not exist — an intentional PRD numbering gap. F22 is P2, deliberately out of v1.)*

---

## Definition of done, per module

1. `npm run typecheck` clean.
2. `npm test` passes, including every test your module owns.
3. Every screen you own renders all the states its spec lists (default / loading / empty /
   error / the named variants) with **verbatim copy** from `ALLSCREENS_1.md`.
4. Every interactive element has an `accessibilityLabel` and `accessibilityRole`; nothing
   clips at the largest Dynamic Type setting.
5. No raw colour literal outside `src/theme/tokens.ts`. No text on a signal fill.
6. No file outside your owned paths is modified. `git status` proves it.
7. No dependency added.
8. The word "streak" appears nowhere in your diff.
