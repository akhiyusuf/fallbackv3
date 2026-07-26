# ARCHITECTURE — Fallback

Status: authoritative for Phase 3. Governed by `docs/PRD.md` (law) and the approved
design at `design-input/` (see the PROJECT OVERRIDE in `CLAUDE.md`).

Companion documents: `docs/SCHEMA.md` (data model), `docs/API.md` (service contracts),
`docs/MODULES.md` (who builds what, and which files they own).

> **How to read this.** Anything marked **PINNED** is a decision no builder, reviewer or
> qa-tester may re-open. Where the PRD left something to the architect (§7), the decision
> is recorded here with its rationale and the rejected alternative, so nobody re-litigates it.

---

## 1. Stack

| Layer | Choice | Version |
|---|---|---|
| Runtime | React Native | 0.86.0 |
| Framework | Expo (managed + prebuild for native targets) | ~57.0.8 |
| UI runtime | React | 19.2.3 |
| Language | TypeScript, `strict` + `noUncheckedIndexedAccess` | ~6.0.3 |
| Routing | expo-router (file-based, typed routes) | ~57.0.8 |
| Local store | expo-sqlite (SQLite, WAL, FK on) | ~57.0.1 |
| Server-state / caching | @tanstack/react-query | 5.101.4 |
| Ephemeral UI state | zustand | 5.0.14 |
| Dates | date-fns | 4.4.0 |
| Icons | lucide-react-native (+ react-native-svg) | 1.27.0 / 15.15.4 |
| Charts | hand-rolled `react-native-svg` polyline (F28) | — |
| Animation | react-native-reanimated + react-native-worklets | 4.5.0 / 0.10.0 |
| Notifications | expo-notifications (local only, no push tokens) | ~57.0.7 |
| Biometrics | expo-local-authentication | ~57.0.2 |
| Billing | expo-iap (StoreKit 2 / Google Play Billing) | 4.7.0 |
| Secrets | expo-secure-store (Keychain / Keystore) | ~57.0.1 |
| Audio capture | expo-audio | ~57.0.3 |
| Files / backup | expo-file-system, expo-document-picker | ~57.0.1 |
| Sync auth (Android only) | expo-auth-session | ~57.0.5 |
| Tests | jest-expo, @react-native/jest-preset, @testing-library/react-native | ~57.0.2 / 0.86.1 / 14.0.1 |

**Why this stack, against the PRD's constraints.** RN/Expo is fixed by the PRD (§2,
Decisions item 3) and both stores are v1 targets, so every platform capability had to
exist on iOS *and* Android from one codebase: Expo's module set covers all four
platform-native surfaces the PRD names (biometrics, store billing, widgets via prebuild
config plugins, cloud sync). The product is **offline-first with zero analytics** — that
rules out every SaaS SDK and pushes all state onto the device, and SQLite (not
AsyncStorage) is the only sane choice because F5/F28/F30 are aggregate queries over a
per-day ledger that will reach tens of thousands of rows over a multi-year history, F7's
heatmap is a range scan, and F1 demands an explicit schema version with a tested
migration path. React Query is used purely as a local read/invalidate cache — it gives us
the PRD's "chip tap → F5 recompute, ≤100 ms, no relaunch" for free through key
invalidation, with `networkMode: 'always'` so nothing ever waits on connectivity. No
styling framework (no NativeWind/Tamagui): the approved design ships as CSS custom
properties, and transcribing them into one TypeScript token module with `StyleSheet` is
both a smaller dependency surface and a *stricter* guarantee that the accent can never
leak into a signal colour. No charting library for F28 — a polyline over `react-native-svg`
is ~80 lines, and the ship-blocking accessibility rider (a screen-reader-readable table
and an always-present text summary) is work we'd have to do regardless of library.

**No dependency may be added by a builder.** `package.json` is frozen (§11). If your
module needs something that isn't listed, that is an architect change request.

### 1.1 Minimum OS versions — PINNED (PRD §7, OWNER: architect)

- **iOS 16.0+.** WidgetKit configurable widgets and StoreKit 2 both need 16 to behave
  predictably; Expo 57's own floor is lower but 16 removes two classes of widget bugs.
- **Android 8.0 / API 26+.** Notification channels, `BiometricPrompt`, and `java.time`
  are all API 26; below that the F14 notification model needs a second code path for no
  meaningful market share.
- No tablet or iPad layout in v1 (PRD §5). `supportsTablet: false`.

---

## 2. Project structure

```
app/                      expo-router route tree — one file per screen route (S01–S50)
  _layout.tsx             root providers + Stack                              [M0]
  (tabs)/_layout.tsx      BottomTabs shell                                    [M0]
  …                       every other route file is owned by its feature module
src/
  types/                  the shared type surface — imported everywhere       [M0]
  theme/                  design tokens, palettes, useTheme()                 [M0]
  ui/                     the component kit (Verdant primitives + Fallback customs) [M0]
  lib/                    date, rounding, id, event bus                       [M0]
  navigation/             route constants + origin-aware back                 [M0]
  app-shell/              boot sequence                                       [M0]
  db/                     SQLite client, migrations, repositories             [M1]
  domain/                 pure engine: occurrences, outcomes, %, XP, cycles   [M2]
  queries/                React Query read hooks + write mutations            [M2]
  features/<area>/        screen bodies, per-screen copy, feature components  [M3–M7]
  services/               data · sync [M1] · ai · billing [M6] · notifications · widgets [M7]
native/                   iOS WidgetKit + Android AppWidget sources           [M7]
plugins/                  Expo config plugins                                 [M7]
server/                   thin managed-assistant backend                      [M6]
docs/ design/ design-input/ review/    artifacts
```

**The dependency rule (enforced by review):**

```
app/**  →  src/features/**  →  src/queries/**  →  src/domain/**  →  src/types/**
                    ↘                 ↘                              ↗
                     src/ui, src/theme, src/lib  ────────────────────
                                      ↘
                                       src/db  (M1) — reachable ONLY from src/queries
```

- `src/domain/**` imports **nothing** but `src/types` and `src/lib`. No React, no SQL, no
  `expo-*`, no `new Date()`. This is what makes the PRD's worked examples runnable as
  plain unit tests.
- A feature module never imports `src/db` or another feature module. Cross-feature reads
  go through `src/queries`; cross-feature reactions go through the event bus (§4.4).
- `src/services/**` may be imported by feature modules and by `src/queries`, never by
  `src/domain`.

---

## 3. State management

Three tiers, and nothing else. A builder who invents a fourth is wrong.

1. **Persisted state — SQLite, read through React Query.** All tasks, logs, off-days,
   XP, achievements, cycle records and settings. Read with `src/queries` hooks; write with
   `src/queries` mutations. `staleTime: 0` because a local read is microseconds and the
   PRD requires immediate recompute.
2. **Ephemeral global UI state — zustand.** Exactly four stores, all owned by M0:
   `themeStore` (resolved theme + accent, hydrated from settings), `toastStore`,
   `entitlementStore` (mirrors the store/BYO entitlement so the paywall gate is
   synchronous), `assistantSessionStore` (live transcript, modality, undo stack — the one
   place where an in-flight conversation lives before it is persisted).
3. **Local component state — `useState`.** Form drafts, expanded accordions, scroll
   positions. A form draft is *never* lifted into zustand.

**Cache invalidation contract.** Every mutation in `src/queries/mutations.ts` declares the
key set it invalidates. The keys are fixed in `src/queries/index.ts` (`QUERY_KEYS`) and
owned by M2. Logging a day invalidates `today`, `task(id)`, `consistency(*)`, `trend`,
`progress`. That single rule is what makes the "≤100 ms, no relaunch" NFR hold everywhere
without any screen re-implementing refresh.

---

## 4. Navigation

### 4.1 Route map
File-based, one file per `route:` line in `ALLSCREENS_1.md`. All 48 routed screens exist
in `app/` today and resolve (`.expo/types/router.d.ts`). S33 (clarification modal) and S36
(options sheet) have no route of their own by design — they render *within*
`/assistant/chat` and `/assistant/*` as components under `src/features/assistant/`.

### 4.2 Presentation — PINNED convention
`app/_layout.tsx` is M0's and **no other module may edit it**. A screen that needs modal
or sheet presentation declares it **in its own file**:

```tsx
import { Stack } from 'expo-router';
…
<Stack.Screen options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
```

Sheet-presented screens per the design: S15, S20, S22, S24, S28, S33, S36.

### 4.3 Origin-aware back — PINNED
Seven screens have **one route but two legitimate back destinations**: S14, S22, S23,
S25, S27, S29, S48. The design calls this "load-bearing behaviour" and it is.

- The origin travels as a search param: `?from=<ScreenOrigin>` (`src/navigation`).
- Use `useOriginAwareBack(fallbackHref)` from `@/navigation`. **Never hardcode a back
  destination on those seven screens.** A hardcoded `router.push('/today')` on S25 is an
  automatic code-review rejection.
- **S22 carries TWO different origin rules and they must not be merged** (the design calls
  this out explicitly, `ALLSCREENS_1.md` S22 lines 1155–1166 and 1202–1247):
  - **Cancel** ("Keep it", scrim tap, hardware back) → whichever screen *opened* S22:
    S20 if opened from S20, S23 if opened from S23. Never falls through to S20.
  - **Confirmed delete** → **not** the screen that opened S22, but wherever *that* screen
    was itself reached from — a two-level lookup, and it is still origin-dependent:
    1. Opened from S20, and S20's own origin is **S09 or a browse tab (S10–S13)** → **that
       same screen**. The design reproduces this verbatim as a FLOWS.md edge:
       **S09 → S20 → S22 → confirms → S09.** Deleting from Today returns to Today.
    2. Opened from S20, but S20's origin is **not a stable destination** (S14 Filter &
       Search, or unknown) → fall back to the deleted task's **type browse tab**
       (S10/S11/S12/S13).
    3. Opened from **S23** → always **S10** (Routines browse), whether S23 came from S10
       or S14. S23's task is always type Routine, so this coincides with rule 2's fallback.
  S14 is never a stable post-delete destination on either path — it holds transient
  results and the just-deleted item may have been the sole match.
- One genuine exception where the destination is *not* origin-dependent: S48's
  **successful erase** always lands on S01, from both origins.

### 4.4 Cross-module reactions — the event bus
`src/lib/events.ts` (M0) is a tiny synchronous emitter. M2's mutations emit
(`day:logged`, `task:changed`, `xp:awarded`, `level:up`, `badge:unlocked`,
`cycle:finalized`, `settings:changed`); M7's notification scheduler and widget bridge
subscribe. This is what keeps M2 from importing M7 and creating a cycle. It is **not** a
general-purpose message bus — the event list in `src/types/ports.ts` is closed.

---

## 5. Design-system conventions

The approved design is Verdant + `fallback-theme.css`, and **the Fallback layer wins on
any conflict**. Note the PRD §2/§7 "Streakforge" naming and the forge-orange-vs-fallback
colour conflict are **already resolved by the approved design** and are not open:

- **Accent = Forge Orange `#F2601A`.** It recolours CTAs, progress, the active tab and
  the add button — nothing else.
- **Signal colours are accent-immune by construction.** `ideal #8FBC6B`,
  `fallback #7FB2D4`, `off #A8A294`, `celebration gold #DCB863` (S27–S30 only),
  `danger #FF4B4B`. In `src/theme/tokens.ts` no signal value is derived from `accent`, in
  either palette — the immunity is structural, not a convention someone must remember.
- **"Missed" has no colour.** It is only ever the *unfilled remainder* of a bar or an
  empty heatmap cell. This is what keeps the framing non-punitive. Do not invent a missed
  hue.
- **Dark mode has its own signal hexes** (transcribed in `tokens.ts`). No theme-invariance
  claim is made anywhere in copy — only accent-invariance.
- **Rule 4 — no text on a signal fill, ever.** Not "no low-contrast text": *no text*.
  StateChips render an icon-only pill in the signal fill with the text label beside it on
  the neutral background; heatmap cells render the day numeral as a caption below the
  cell. Both were review defects in the design pass; do not regress them.
- **Rule 1 — no raw colour literal outside `src/theme/tokens.ts`.** No hex, no `rgba()`,
  no named colour, anywhere in `app/**` or `src/features/**`.
- **One primary Button per screen** (the paywall's Card B uses `secondary`, deliberately).
- Sentence case everywhere except UPPERCASE eyebrows. Copy is **verbatim from
  `ALLSCREENS_1.md`** — each module keeps its screens' strings in
  `src/features/<area>/copy.ts` and never paraphrases.

### 5.1 Accessibility floor (ship-blocking, PRD §5)
Every interactive element carries an `accessibilityLabel` and `accessibilityRole`;
layouts survive the largest Dynamic Type setting without clipping (no fixed heights on
text containers, no `numberOfLines` on primary copy); WCAG 2.1 AA contrast in both themes;
F28's chart carries a screen-reader-only text summary **at all times** plus a real
`<table>`-equivalent toggle; reduced-motion degrades every spring to a cross-fade.

---

## 6. The consistency algorithm — PINNED

This is the most-copied piece of logic in the app. It is implemented **exactly once**, in
`src/domain/consistency.ts` (M2). F5, F7's per-task stat line, F28's per-bucket points and
F30's per-cycle % all call the same function with a different window. No module may
re-derive it.

### 6.1 Occurrence outcomes
Each `(task, date)` resolves to exactly one `OccurrenceOutcome`:

| Outcome | When |
|---|---|
| `not-due` | the task has no occurrence on that date (incl. every as-needed routine, every day) |
| `off` | due, but a whole-day mark or a task-day mark covers it (F4) |
| `ideal` | due, not off, chip = **Done** (or auto-logged ideal) |
| `fallback` | due, not off, chip = **Fallback** (or auto-logged fallback) |
| `missed` | due, not off, and either chip = **Skip** (resolves missed on *any* day, including today) **or** the date is in the past with no showing-up chip |
| `pending` | due, not off, date **is today**, no chip or chip = **To do** |

> **Move/snooze footnote (F7).** When a `moved_to_date` pointer is in play the check order
> above is not sufficient: **a moved-in record confers due-ness BEFORE the vacate check**
> (R-1 precedes R-2), and a vacated own log is **residue** — it never annihilates a moved-in
> occurrence and never supplies its data. Full contract, including the C1–C8 case table:
> **SCHEMA.md §4.2**. Do not implement move semantics from this table alone.

**Chip → outcome mapping — PINNED** (the PRD left this implicit in §3.3/§6; this is the
explicit line the review asked for):

```
Done → ideal      Fallback → fallback      Skip → missed      To do → pending (today) / missed (past)
```

`ideal ∪ fallback = "shown up"`. `ideal ∪ fallback ∪ missed = "resolved"`.

**Auto-log rule (F3).** On a tracked task, completing **all** ideal steps *due that
occurrence* logs `ideal`; completing ≥1 but not all logs `fallback`; completing 0 leaves
`To do`. A manual chip override wins until the user changes it again. F23/F24 guarantee
every due occurrence has ≥1 due ideal step, so `ideal` is never vacuous. For a multi-dose
Course (F12) the day logs `ideal` only when **every dose is handled AND every ideal step
due that day is complete**; the day-level chip can still override to Fallback/Skip.

### 6.2 Per-task scope (scope 1)
Each occurrence is a whole 0-or-1 outcome. Unchanged by the fractional aggregate rule.

```
denominator = |{ o : outcome(o) ∈ {ideal, fallback, missed} }|
numerator   = |{ o : outcome(o) ∈ {ideal, fallback} }|
percent     = denominator === 0 ? null : roundHalfUp(numerator * 100 / denominator)
```

`numerator === denominator − missed` must hold at every read, including mid-day.

### 6.3 Aggregate scope (scope 2) — proportional / fractional daily credit
```
for each calendar day D in the window:
    R(D) = the day's DUE, NON-OFF, RESOLVED task-occurrences
    if |R(D)| === 0:  D is excluded from the denominator entirely
    f(D) = |{ o ∈ R(D) : outcome(o) ∈ {ideal, fallback} }| / |R(D)|

denominator = count of days with |R(D)| > 0        (a day COUNT)
numerator   = Σ f(D)                               (a SUM of fractions)
percent     = denominator === 0 ? null : roundHalfUp(Σ f(D) * 100 / denominator)
```

- Off-ness is **per task within the day**: a day with 2 due tasks, 1 off and 1 shown up,
  has `f(D) = 1/1 = 1.0`, not `1/2`.
- Pending composes **per task**, not per day: a day with 1 done + 1 pending contributes
  `1/1 = 1.0`. A day where *every* due non-off task is pending has zero resolved tasks and
  is simply not yet in the denominator.
- A **multi-dose Course counts once per day**, not once per dose. `R(D)` is a set of
  task-days.
- As-needed routines (F27) never appear in `R(D)` at all — they are never due. This is a
  *structurally different* exclusion from off-days; do not conflate the two in code or
  tests.
- Degenerates exactly to scope 1 on uniform (one-due-task) days.

### 6.4 Window membership — PINNED: counted-day

**Delegation source:** *not* PRD §7 — the PRD contains no window-membership item and is
simply silent on it. The delegation comes from the approved design:
`ALLSCREENS_1.md` S25, "Open item — window-membership semantics" (lines 1582–1630),
which states the question is "a genuine PRD-silent point", records the screen-designer's
provisional counted-day choice, and flags it explicitly **for Gate 2 / architect**. This
section is the architect discharging that delegation.

The PRD defines the fraction but never what makes a day a *member* of a "7 days" /
"30 days" preset. **Counted-day** is what ships:

> Walk backward from the most recent elapsed day. A day counts toward N only if it is a
> **qualifying day** — per-task scope: that task's occurrence that day is due, non-off and
> resolved; aggregate scope: `|R(D)| > 0`. Off days are **skipped without consuming a
> slot** (but are still tallied in the Off breakdown category). Days that are pending, or
> have nothing due, are excluded entirely — neither counted nor tallied. Keep walking
> until N counted days are found, or history runs out (then **truncate** — never
> fabricate days before the task existed). "All time" is the whole history.

Consequence: a "30 days" window may span more than 30 raw calendar days. That is intended.
The "last N days" phrase in display copy names the lookback; Y is the counted-day
denominator.

**Evidence this is what was approved:** S25's Appendix A is a normative 240-raw-day ledger
whose `agg` / `f` columns are stated to be produced *mechanically by this rule* ("This is
also the rule that produces Appendix A's `agg`/`f` columns — see the appendix's derivation
note", lines 1611–1613), and every live dataset on the approved S25 mockup is derived from
it. Choosing the alternative would invalidate that ledger. *(S09's "26 of the last 31 days"
stat-chip copy is **not** evidence either way — S09's own display-format note declares that
fixture degenerate, with all 31 days qualifying, so it reads identically under both rules.)*

*Rejected alternative:* the calendar-day window (last N raw days, off days consuming a
slot). Simpler query, and it is the reading IDEA Flow 9.1's "Last 30 days" title would
support, but it produces different percentages from the approved screens and would
silently invalidate Appendix A. Rejected on design-fidelity grounds, not technical ones.

F28 buckets and F30 cycles are **not** counted-day windows — they are explicit calendar
`DateRange`s (a week / month / year), with the same fraction applied inside.

### 6.5 Rounding — PINNED: round-half-up (closes the review's advisory finding 1)

One rounding, at the very end, through **one function** in `src/lib/number.ts`:

```ts
export function snap(v: number): number { return Number(v.toFixed(9)); }
export function roundHalfUp(v: number): number { return Math.floor(snap(v) + 0.5); }
export function toPercent(n: number, d: number): number | null {
  if (d <= 0) return null;
  return roundHalfUp(snap((n * 100) / d));
}
```

- `1/8 → 12.5 → 13`. A remainder of `2.5 → 3`. `86.67 → 87`. `83.87 → 84`. `84.4 → 84`.
- **No intermediate rounding of `f(D)` is permitted.** `Σ f(D)` is carried at full double
  precision; `snap()` at 9 dp is what makes an exact `.5` tie survive float representation
  deterministically across two independent implementations.
- `denominator === 0` returns **`null` = "no data yet"**, and the UI must render the
  no-data copy — **never `0%`** (PRD §3.5 edge case, and the S25/S26/S41 empty states).
- Do not hardcode `83.9` anywhere: `26/31` is `83.87…`, and only the displayed `84` is a
  constant worth asserting.

**Display rounding for the aggregate breakdown legend** (S25 "Unit note", also S29/S30):
`Ideal` and `Fallback` are each `roundHalfUp` of their own summed fractional credit; `Off`
is a plain **whole count of fully-off days**; `Missed` is `roundHalfUp(denominator − Σ f)`.
The four numbers are deliberately not all the same unit, and the legend caption says so.

### 6.6 Golden tests — mandatory (M2)
These are not suggestions; qa-tester asserts the same numbers.

| Case | Expected |
|---|---|
| 22 ideal + 4 fallback, 4 off, 0 missed | **100%** (26/26) |
| 26 shown up, 4 off, 4 missed | **87%** (26/30, 86.67) |
| 26/31 missed-not-off; then 27/32 | **84%**, then **84%** |
| Aggregate 3-day: 2/2, 1/3, all-off | **67%** (Σf 1.333 ÷ 2) — explicitly **not** 50% |
| Aggregate day: 1 done + 1 pending | f = **1.0** |
| Aggregate day: 2 due, 1 off, 1 shown up | f = **1.0** |
| Pending today, single due task, not off | % identical to today not existing |
| Same task after day end, still unlogged | becomes missed, enters denominator |
| Skip chip today | missed **immediately** |
| 1/8 | **13%** (round-half-up tie) |
| Only as-needed routines exist | **"no data yet"**, never 0% |
| Every elapsed due day off | **"no data yet"**, never 0% / never divide-by-zero |
| `numerator === denominator − missed` | holds at every read above |

---

## 7. Time and the clock — PINNED

- The app has exactly **one** notion of "today": the **device-local calendar date**.
- All dates at rest are `LocalDate` = `'YYYY-MM-DD'` strings in device-local time. All
  instants are ISO-8601 UTC. Never store a raw epoch for a calendar concept — a DST shift
  or a timezone move must not silently reassign a day.
- **No module calls `new Date()` for business logic.** Everything goes through
  `src/lib/date.ts` (`today()`, `now()`), which qa-tester can freeze. This is what makes
  the F29 "advance the clock to day 366" fixture testable.
- Day rollover is handled by a `useDayRollover()` hook (M0) that re-evaluates `today()` on
  app foreground and on an interval, and invalidates date-scoped query keys. A pending
  today becoming missed happens **on the next read**, not via a background job.
- Clock moved **backward** must never revoke an earned badge or re-open an archived cycle.
  All progress reconciliation is upsert-only and monotonic.
- **Monotonicity is a property of the lifetime layer, and it survives task deletion.**
  Deleting a task cascades to its logs and off-day marks (so F5 recomputes without it, per
  PRD F7) but **never** to its XP awards, achievement unlocks or cycle records. Lifetime XP
  and level cannot go down as a result of any user action. See SCHEMA.md §2.3.

---

## 8. Local persistence

- **expo-sqlite**, one database file `fallback.db`, opened with `PRAGMA journal_mode=WAL`,
  `PRAGMA foreign_keys=ON`.
- **Schema version** = SQLite's `user_version`. Forward-only numbered migrations in
  `src/db/migrations/`, each applied inside one transaction. A failed migration rolls back
  and the store reports `STORE_CORRUPT` → S50 recovery. Never half-apply.
- **No ORM.** Typed repositories in `src/db/repositories/` implement the `Repositories`
  port from `src/types/ports.ts`. Nothing outside `src/db` writes SQL.
- **Corrupt-store handling.** S01 opens the store; on throw or failed integrity check it
  routes to **S50** — calm, never a crash loop, never an auto-wipe without confirmation.
- **Write failures never lie.** Every mutation returns `Result`; on failure the optimistic
  UI reverts and shows the screen's own retry copy. There is no "saved" toast on a failed
  write, anywhere.
- **Rapid taps** are safe: writes are last-write-per-field within a single upsert
  statement, so a double tap cannot interleave into a corrupt row.
- **Erase-all (F25) is atomic**: close → delete the database file and the SecureStore keys
  and any backup metadata → recreate an empty schema in one guarded sequence. Fully erased
  or fully intact, never half-wiped.

---

## 9. Offline, sync, notifications, widgets, billing

### 9.1 Offline posture
Every P0 feature works with the radio off, and the app makes **zero outbound requests**
outside four opt-in surfaces: the managed assistant (F16), store billing (F17), BYO
inference (F18), and cloud sync (F20). There is **no analytics, no crash reporting, no
telemetry SDK, and no ad SDK** anywhere in the dependency tree — `AD_ID` is explicitly
blocked in `app.config.ts`. A proxy watching a P0 session must see nothing.

### 9.2 Cloud sync (F20) — PINNED (PRD §7, OWNER: architect)
Opt-in, off by default, **best-effort, local-authoritative**. Whole-store snapshot
replication behind the `SyncProvider` port:

- **iOS — iCloud Documents (ubiquity container).** No sign-in; uses the device's existing
  Apple ID. Entitlements are already declared in `app.config.ts`.
- **Android — Google Drive `appDataFolder` via `expo-auth-session` + REST.** The user
  signs into **their own** Google account, and only when they turn sync on. Fallback still
  has no accounts and no server; the app-data folder is invisible to the user's Drive UI
  and inaccessible to any other app. Declining sign-in leaves sync off and changes nothing
  else.
- **Conflict:** local always wins. A remote snapshot is pulled only when the local store
  has no unsynced changes. True convergent multi-device resolution is **F22, P2, out of
  v1** — do not build toward it, do not leave hooks implying it.
- Failure is calm and non-destructive: the toggle stays on, local data is untouched, and
  S45 shows the warning-tone retry banner.
- The F29 tenure anchor is a store field, so a sync restore carries it; a genuinely fresh
  store (install or post-erase) mints a new one.

#### 9.2.1 KNOWN GAP — F20 has no transport under the currently declared dependencies

**Status after wave 1: the port is built, the transport is not.** M1 implemented
`SyncProvider` honestly — `isAvailable()` returns `false`, failures surface as calm
`NETWORK_UNAVAILABLE`, and S45 renders the real warning banner. Nothing fabricates success.
That is the correct behaviour and it stays. But the two transports I specified above cannot
be built from the dependency set I pinned, and I did not catch that when I pinned it:

| Platform | What is missing | What it actually costs |
|---|---|---|
| **iOS** | `expo-file-system` exposes **no** iCloud ubiquity-container API (verified: zero references in the package). There is no JS path to `NSFileManager.url(forUbiquityContainerIdentifier:)` or to the coordinated read/write that safe iCloud file access requires. | A **custom native Expo module** (Swift, roughly 150–250 LOC: resolve the container URL, `NSFileCoordinator` read/write, a metadata query for change detection) shipped via a local config plugin. The entitlements are already declared, so no app-config work — but a provisioned iCloud container on a real Apple Developer account is required to test it at all. |
| **Android** | No Google OAuth client ID is declared anywhere, and `expo-auth-session` cannot start a flow without one. The Drive `appDataFolder` scope is not requested. | A Google Cloud project with an **Android OAuth client** (package name + release/debug SHA-1 fingerprints) and a Web client for token exchange; the `drive.appdata` scope; then plain REST calls (no extra dependency). `extra.googleOAuthClientId` is now declared in `app.config.ts` as `null` so the gap is explicit and checkable rather than hidden. |

**Consequences, stated plainly.** F20 is **P1 fast-follow, not P0**, so this blocks neither
the MVP nor wave 2 — every P0 feature is on-device and unaffected. But F20 **cannot ship in
its specified form** without the two work items above, and the iOS one is a native-module
build, not a configuration tweak. My earlier note that Android sync was "the highest-risk P1
item in the plan" understated it: iOS is the harder half, because Android needs credentials
and configuration while iOS needs native code that does not exist yet.

`SyncProvider.isAvailable()` returning `false` is the honest, shipping-safe expression of
this state, and it is wired to the real cause: no iOS native module, and a null OAuth client
ID on Android. **Do not "fix" it by making sync appear to work.**

**This is a costed, known gap, not a surprise for Gate 3.** If the iCloud module and the
Google credentials are not funded, the honest options are (a) ship v1 with sync visibly
unavailable — S45 already renders correctly for this, or (b) narrow F20 to local
export/import only, which F19 already delivers. Either is a product call, not an
architecture one. **Do not expand v1 scope to close this gap.**

### 9.3 Notifications (F14)
`expo-notifications`, **local only** — no push tokens, no server, no notification service
extension. Scheduling is a **rolling 7-day horizon** re-armed on app foreground, on any
task change, and after the daily digest fires; this keeps us well under iOS's 64-pending
limit with hundreds of tasks. Every notification type is individually toggleable and the
app is fully usable if permission is declined (primed in S07 before the OS prompt). The
"gentle re-entry" notification deep-links to S09's re-entry state. As-needed routines are
never due, so they generate no reminders.

### 9.4 Widgets (F21)
Two separate native targets, added by `plugins/withFallbackWidgets.js` at `expo prebuild`:
iOS **WidgetKit** extension and Android **AppWidgetProvider**. The bridge is a small JSON
snapshot the JS side writes on every relevant mutation (`WidgetBridge.publishSnapshot`)
into the shared container — iOS App Group `group.com.fallback.app`, Android
SharedPreferences. Widgets read the snapshot only; they never open the database. `ios/`
and `android/` are generated and gitignored — the sources live in `native/`.

### 9.5 Billing (F17)
`expo-iap` against StoreKit 2 / Google Play Billing. Store-native only; no third-party
rails, and deliberately **no RevenueCat or equivalent** — an entitlement service would
store user data server-side and break the privacy promise. Purchase confirmation is gated
on the platform's own biometric prompt via `expo-local-authentication`. Restore Purchases
re-checks the store account with **no login**. Entitlement is mirrored into
`entitlementStore` so the S31/S38 gate is synchronous.

---

## 10. Error handling — PINNED pattern

- **Services return `Result<T, AppError>`. They do not throw across a module boundary.**
  Throwing is reserved for genuine programmer error (a violated invariant), which the
  root error boundary catches.
- `AppError.message` is **developer-facing and never rendered.** User-facing copy comes
  from the screen's own `copy.ts`, verbatim from `ALLSCREENS_1.md`.
- Four rendering patterns, and no others:
  1. **Inline retry banner** for a failed read of a region (list, heatmap, chart, stat).
     The rest of the screen keeps working — partial-failure tolerance is explicit in the
     design (S09, S41).
  2. **Revert + toast** for a failed write. The control returns to its prior value.
  3. **Calm full-surface recovery** only for an unreadable store (S50).
  4. **Field-level inline validation** for form errors, naming the offending thing (F23's
     no-empty-run-occurrence names the weekday).
- **Never** a full-screen red failure, never "streak broken" language, never an alarm
  glyph. The `danger` token is reserved for **destructive-action confirm buttons** — S22's
  "Delete routine" and S48's "Erase everything" — and never spreads to a surrounding icon,
  banner or background. S22's own spec is explicit: "the danger signal lives on the button
  only, never a full alarming icon." The copy beside it stays calm.
- The word **"streak"** appears nowhere in shipped copy, comments-in-UI, or accessibility
  labels. `StreakBadge`-style naming from any upstream system is not carried over; our
  component is `MilestoneBadge`.

---

## 11. Conventions

**Naming.** Files: `PascalCase.tsx` for components, `camelCase.ts` for everything else,
`kebab-case` for route segments. Types: `PascalCase`, no `I` prefix. Booleans read as
predicates (`isAsNeeded`, `hasByoKey`). Query keys come from `QUERY_KEYS` only.

**Where types live.** `src/types/**` — one shared surface, owned by M0, imported as
`@/types`. **No module redeclares a shared type.** A module may declare a *local, private*
type in its own folder if it never crosses a module boundary. If two modules need it, it
belongs in `src/types` and that is an architect change request.

**Imports.** Absolute via `@/*`. No deep imports into another module's internals — import
from its documented entry point (`@/domain`, `@/queries`, `@/ui`, `@/theme`, `@/types`).

**Copy.** Verbatim from `ALLSCREENS_1.md`, in `src/features/<area>/copy.ts`. No string
concatenation that would block later locales (PRD §5): use whole sentences with
placeholders, not glued fragments.

**Comments.** Explain *why*, and cite the governing rule (`// PRD §3.5 scope 2` /
`// S20 Fix log, Rule 4`). Do not restate the code.

**Architect-frozen files — owned by NO module.** `package.json`, `package-lock.json`,
`app.config.ts`, `tsconfig.json`, `babel.config.js`, `metro.config.js`, `jest.config.js`,
`eslint.config.js`, `.gitignore`, `app/index.tsx`. Every plugin, permission, entitlement
and dependency v1 needs is **already declared**, so no builder should need to touch these.
If you believe you do, stop and raise it — do not edit.

`app/_layout.tsx` and `app/(tabs)/_layout.tsx` are **M0-owned**, not frozen: M0 wires the
persisted theme/accent into the provider stack. No other module may edit them.

---

## 12. Testing strategy

| Layer | Tool | Owner | Bar |
|---|---|---|---|
| Domain engine | `jest --selectProjects domain`, plain TS | M2 | Every table row in §6.6, plus cadence/occurrence, XP eligibility, tenure ladder, cycle boundaries. This is the highest-value test surface in the project. |
| Repositories & migrations | jest-expo, in-memory SQLite | M1 | CRUD round-trips, the delete cascade, an **older-version fixture opening without data loss** (F1), erase-all atomicity. |
| Components & screens | @testing-library/react-native | M3–M7 | Each screen's states from its spec (default / loading / empty / error), a11y labels present, no raw colour literals. |
| End-to-end | qa-tester's own harness | qa-tester | The PRD §6 fixtures, driven through the UI. |

**Seed fixtures (M2 owns `src/domain/__fixtures__/`, everyone reuses).** The PRD §6 set is
mandatory: the **Studying** Mon–Fri routine with "finish weekly assignments" toggled
Friday-only; the **Emergency plan** as-needed routine with two "used it" dates; the Maya
demo set (Movement + Read, ≥4 missed days and some off days so 87% reproduces); the 3-day
mixed-day set so **67%** reproduces; a fixed tenure anchor with the clock advanced to day
366 and zero activity; ≥2 completed cycles; a schema-v0 migration fixture. **No analytics
keys, no ad SDKs, no telemetry endpoints in any fixture or config.**

---

## 13. Architect decisions on delegated open items

Rows marked *(design-delegated)* were handed to the architect by the approved design, not
by PRD §7.

| Open item | Decision | Where |
|---|---|---|
| Cloud sync mechanism & depth (both platforms) | iCloud Documents / Drive appDataFolder behind one port; best-effort, local-authoritative; F22 stays P2 | §9.2 |
| Managed-tier STT source | **Groq provides both** — `whisper-large-v3-turbo` for STT, no separate vendor | API.md §4 |
| Exact Groq model(s) | `llama-3.3-70b-versatile` for chat, server-configurable | API.md §4 |
| Min supported OS + widget-extension approach | iOS 16 / Android API 26; two native targets via one config plugin at prebuild | §1.1, §9.4 |
| Backup artifact format & location (F19) | Single JSON envelope `fallback-backup-<ISO>.fallbackbak`, written via `expo-file-system` and shared through the OS document picker | SCHEMA.md §9 |
| R25 tenure first-use anchor event | **First store creation** (first launch), stored as `settings.tenure_anchor_date` | SCHEMA.md §7 |
| R22 subsetting for single-occurrence cadences | Not surfaced — the grid is replaced by the design's static degenerate note | §6.1, MODULES.md M4 |
| F28 placement + granularity thresholds | "See full history" on S25; `<3 months` weekly, `3 months–3 years` monthly, `3 years+` yearly | design-resolved (S25/S26) |
| Rounding ties | round-half-up | §6.5 |
| Window membership semantics *(design-delegated — S25's open item)* | counted-day | §6.4 |
| Done→ideal chip mapping | pinned mapping table | §6.1 |
| F5/F30 breakdown display fork, "X of Y days" | design-resolved (S09 display-format note, S25 unit note) | §6.5 |
| BYO paywall placement, accent palette, signal-colour lock | design-resolved (S38 placement note, S21/S43) | §5 |

---

## 14. Build & verification

```bash
npm install --legacy-peer-deps    # expo-iap declares optional Amazon peers
npm run typecheck                 # tsc --noEmit
npm test                          # jest (domain + app projects)
npm run build:check               # typecheck + full Metro bundle
npx expo start                    # dev
npx expo prebuild                 # generates ios/ + android/ incl. widget targets
```

**Scaffold verification, run at authoring time:**

```
$ npx tsc --noEmit            → clean (exit 0)
$ npx expo export --platform ios
  iOS Bundled 26636ms node_modules/expo-router/entry.js (1646 modules)
  › ios bundles (1): _expo/static/js/ios/entry-*.hbc (3.7MB)
  Exported: .expo-export-check
$ .expo/types/router.d.ts     → 48 shipped routes + / + /_sitemap, all 50 screens covered
$ npm test
  PASS app src/lib/number.test.ts
  Tests: 8 passed, 8 total        ← the pinned round-half-up + PRD §3.5 anchors, locked in code
```

`src/lib/number.test.ts` is architect-seeded and asserts 12.5→13, 26/26→100%, 26/30→87%,
26/31→84%, 27/32→84%, the 3-day aggregate anchor →67% (explicitly not 50%), and
`toPercent(0,0) === null`. It may be extended by M0/M2, never weakened.
