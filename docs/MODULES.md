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

## House testing pattern — read this before writing a component test

Wave 1 hit **three** breakages in the frozen test config and worked around them locally.
**All three are now fixed centrally.** Delete any local workaround you inherited for the
three named below — but read the `expo-router` note before deleting anything, because that
mock was correct until this fix landed and M0 was right to defend it.

**Use `@testing-library/react-native`. Do not drive `react-test-renderer` directly.** The
`test-renderer` peer dependency it needs is now installed and pinned.

**`render` is ASYNC in RNTL 14 — you must `await` it.** This is the single most likely thing
to trip you up: v14 made rendering async for React 19's concurrent renderer, so a
non-awaited `render` returns a Promise and every query fails with a confusing
`render function has not been called` or `r.getByText is not a function`.

```tsx
import { render, screen, userEvent } from '@testing-library/react-native';

it('renders the empty state', async () => {
  await render(<RoutinesBrowse />);            // await — always
  expect(screen.getByText('Create your first routine')).toBeTruthy();
});

it('logs a fallback from the chip', async () => {
  await render(<TodayScreen />);
  await userEvent.press(screen.getByLabelText('Log fallback'));
  expect(onLog).toHaveBeenCalledWith('fallback');
});
```

**Routing works out of the box — do NOT mock `expo-router`.** This one bit wave 1 and was
the most dangerous of the three, because the symptom points at the wrong package:
`Cannot use import statement outside a module`, thrown from `standard-navigation`, a
transitive dependency of `expo-router` that declares `"type": "module"` and ships raw ESM in
a **`.js`** file — so it slipped past the `.mjs` transform, past the lucide name mapping, and
past the transform whitelist. The whitelist now names it, and the preset's babel transform
handles it from there.

Verified working **unmocked**, by rendering rather than by importing: `useLocalSearchParams`,
`useRouter`, `router.push`, and `<Link>` all render and behave correctly **outside any
navigator** — which is how a screen test runs. `useLocalSearchParams` returns empty params
rather than throwing, so origin-aware screens (S14, S22, S23, S25, S27, S29, S48) test
cleanly with no navigation context.

To assert that a navigation happened, **spy — do not mock the module**:

```tsx
const push = jest.spyOn(router, 'push').mockImplementation(() => {});
await render(<TodayScreen />);
await userEvent.press(screen.getByLabelText('See your consistency'));
expect(push).toHaveBeenCalledWith('/progress');
push.mockRestore();
```

An un-spied `router.push` outside a navigator is also safe — it does not throw or fail the
test.

**Status of M0's existing mock:** it was correct and necessary when written, it is now
redundant, and it is **harmless** — it shadows a module that works. Removing it is optional
cleanup for whenever M0 is next open, **not** a defect and **not** grounds for reopening a
passed review. What matters is the forward rule: **M1, M2 and all five wave-2 modules must
not add an `expo-router` mock.** Five divergent hand-rolled router mocks in the reference
suite is exactly the outcome this fix exists to prevent.

**Icons work out of the box — do not mock `lucide-react-native`.** The config maps it to
lucide's prebuilt CJS output, so the ESM `.mjs` parse error is gone. (Note lucide icons do
not forward `testID` to the SVG root; assert on an accessible name or a wrapper, not on a
`testID` you passed to the icon.)

**Fixed centrally, for the record.** (1) `@testing-library/react-native@14.0.1` declares a
peer on a package named `test-renderer` — not `react-test-renderer`. It is real, it is by the
same author, and it is React 19's replacement for the deprecated `react-test-renderer`; it is
now an explicit devDependency. (2) `jest.config.js` pins lucide to its prebuilt CJS output.
(3) The transform whitelist now names `standard-navigation`, which is what makes `expo-router`
importable. The `.mjs` transform is also still there for any future ESM-only dependency —
though note it would **not** have caught `standard-navigation`, which ships ESM in a `.js`
file. If you ever meet `Cannot use import statement outside a module` from a new package,
that is the shape to look for, and it is an architect change request, not a local mock.

**`expo-crypto.randomUUID()` returns `undefined` under jest-expo's automock.** Any test that
reaches `newId()` needs a local mock — this one stays local because it is test-specific:

```ts
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000000' }));
```

Pure domain logic (`src/domain/**`) runs in the `domain` project with no RN renderer at all —
plain functions, plain assertions, no mocking required. Keep logic testable there wherever
you can; it is far faster and far less brittle than a component test.

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
  (§6.4), the delete-cascade split (SCHEMA §2.3), the **F7 move/snooze semantics
  (SCHEMA §4.2, R-rules / W-rules / C1–C8 incl. C4b)**, the design-pinned level titles and badge
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

## Open architect change requests (post-wave-1)

Wave 1 surfaced contract gaps in architect-owned files. The test-config ones are fixed in
the frozen files directly (see "House testing pattern" above). The rest are recorded here,
because they touch **M0-owned** source or pin semantics the architect owns.
**All three are approved.** CR-1 and CR-2 are port changes: M0 applies them, M1 and M2 then
align. **CR-3 is spec-only** — no source change, no schema change — and is already binding
on M2 through `review/ADVICE-M2.md`; it is recorded here so **M4** and the qa-tester read a
contract instead of a review trail.

### CR-1 — add the `cycle_state` accessor to the `Repositories` port (M0)

`SCHEMA.md` §8 defines a `cycle_state` singleton that F31 reads on every launch and
foreground, but `src/types/ports.ts` exposed no accessor for it. That was an architect
defect. M1 correctly worked around it additively (`repos.cycleState` as an intersection
type) rather than skipping the table; M2 correctly avoided the missing pointer by deriving
the window instead. Both are sound; the port is still wrong.

- **M0** — in `src/types/progress.ts` add:
  `export interface CycleState { currentCycleId: Id; cadence: CycleCadence; startDate: LocalDate; endDate: LocalDate }`.
  In `src/types/ports.ts` add `CycleStateRepository` (`get(): Promise<CycleState | null>`,
  `set(state: CycleState): Promise<Result<void>>`) and a
  `readonly cycleState: CycleStateRepository` member on `Repositories` — a first-class
  member, matching how the other singleton (`settings`) is handled, **not** a member of
  `ProgressRepository`.
- **M1** — drop the `Repositories & { cycleState: … }` intersection in `src/db/index.ts`;
  `repos` now satisfies `Repositories` plainly. Import `CycleState` from `@/types` instead
  of declaring it locally in `cycleStateRepository.ts`. The SQL and method bodies are
  already correct and do not change.
- **M2** — the pointer is **authoritative**: read `repos.cycleState.get()` on the hot path.
  Keep the walk-forward derivation, but only as the `null` fallback (fresh store, or a
  restored backup predating the pointer), and **write the pointer back** with `set()` so it
  runs at most once. Do not derive per read — that is O(records) where the pointer is O(1).

### CR-2 — add XP award retraction to `ProgressRepository` (M0)

`SCHEMA.md` §7 requires that un-setting a showing-up state on a **live** task retracts that
occurrence's XP award, but the port had no call for it, making the documented behaviour
undeliverable. The §7 wording is correct; the port was incomplete.

- **M0** — add to `ProgressRepository`:
  `retractXpAward(taskId: Id, date: LocalDate): Promise<Result<void>>`.
- **M1** — implement it as a delete of the `(task_id, date)` award row; a no-op when no row
  exists must return `ok`, not `NOT_FOUND`.
- **M2** — call it from the log mutation when an occurrence stops carrying a showing-up
  state. This is the **only** sanctioned reduction of lifetime XP. It must **not** fire on a
  missed day, an off day, a cycle boundary, or a task deletion.

### CR-3 — F7 move/snooze semantics are now a contract, in `SCHEMA.md` §4.2 (spec only)

**Origin:** M2 hit ADVISOR_REQUIRED on the move feature. The advisor's root cause was **an
architect spec gap, not a builder failure** — F7's move semantics existed upstream as one
sentence and one column note (PRD §3.7, SCHEMA §4, ALLSCREENS S20), and nothing anywhere
defined *composition*: un-move, same-day, chains, merges, or moves involving already-vacated
dates. M2 was implementing against review prose because there was no contract to implement
against. That gap is mine, and `SCHEMA.md` §4.2 closes it.

**No schema change.** `day_log.moved_to_date` keeps its exact shape; only its semantics are
pinned. §4.2 mirrors `review/ADVICE-M2.md` **verbatim** — R-rules, W-rules, the case table,
the D-rule and the boundary notes.

**Updated for Supplement A (2026-07-27).** The ADVICE now has two parts, and §4.2 mirrors
both, already merged. M2 flagged a genuine ambiguity in R-1's `effectiveLog` rather than
guessing, and the advisor rejected the literal reading: under it, moving a **completed**
occurrence onto an unlogged natural due date — possibly today or a future date — made that
date resolve `ideal` off the imported chip and minted **XP for a day the user never
touched**. In a product whose whole premise is never manufacturing credit the user did not
earn, that was the deciding fact. The amendment:

- **R-1's `effectiveLog` is now three clauses** — (a) a live own log wins *(unchanged)*;
  (b) **new** — a naturally-due date with **no row** resolves to `null`, so a merge keeps the
  target's blank state and the visitor's data lies dormant at its source per the D-rule,
  reviving on un-move; (c) otherwise the moved-in record *(unchanged — this is what C6
  relies on, and C6 is unchanged)*.
- **C4b** is a new required case: merge onto a naturally-due, never-logged date, asserted
  **with a completed visitor** so that **no XP award materialises at the target**.
- **C8's data clause** is reworded for the same reason.

**Updated again for Supplement B (2026-07-27).** The pass-4 reviewer found a real defect the
whole prior contract missed: reads resolve a **carrier** for a date, but writes addressed
storage by **date-key**, so a chip tap could land on the wrong row — invisible to the user
and corrupting data belonging to a departed occurrence. §4.2 now carries the **T-rules
(write-side carrier selection)**: resolve the tapped date first; **reject** the write if
nothing resolves there (`VALIDATION_FAILED`); otherwise write to whichever carrier the
read's own clause selection designates, never to a residue row. Plus a second D-rule
sentence (residue is immutable except via `useMoveOccurrence`) and rows **C9/C10/C11**.

Two things wave 2 should note. One variant of this bug has **nothing to do with moves**:
writing to an untouched not-due date fabricates a row that a *later, unrelated* move-in
adopts as truth — phantom credit. That is why T-1 is a general rule, not a move patch. And
**M4 is directly exposed**: S20's heatmap drill-down writes to arbitrary past dates, so T-1
is load-bearing product surface there, not defence-in-depth. `docs/API.md` §3 flags the new
rejection case on `useLogState` / `useToggleStep` / `useLogDose`.

Supplement A's **S2/S3/S4** and Supplement B's **B2** (invariant P8, the F2 harness
extension) are harness rulings under Ruling 2 and are deliberately **not** in §4.2 — they
bind M2 and the reviewer, not the schema. Where the ADVICE and §4.2 ever disagree the ADVICE
wins, and the latest supplement wins within it.

The contract has **two halves and both are required**:
- **Read precedence** — a moved-in record confers due-ness **before** the vacate check
  (R-1 precedes R-2); a vacated own log is **residue**: it never annihilates a moved-in
  occurrence and never supplies its data.
- **Write normalisation** — a move *from* a date carrying inbound pointers operates on
  **those pointers only**; the own-log pointer is written only when no inbound exists.

Implementing only the read half still ships **C6** (task due A and B; B→C then A→B
annihilates A's occurrence), which no source-pointer normalisation can reach.

- **M2** — already implementing; the ADVICE copy is binding now and M2 does **not** wait on
  this CR. §4.2 exists so the contract is findable outside a review trail.
- **M4** — build the S20 snooze/move UI against §4.2, not against this summary. See M4's
  non-negotiables.
- **qa-tester** — C1–C8 are required tests, asserted end-to-end through the public surface
  (hooks + reads), never through internals.

**Not proposed: a transaction primitive on `Repositories`.** The advisor confirmed none
exists and deliberately designed W-3's ordered single-row writes so that **every
intermediate state is legal** under the R-rules, with no compensation logic. I agree, and I
am **not** proposing to add one: it would reopen the frozen M0 port and both PASSED M1
surfaces to buy atomicity the algorithm does not need. If a future mutation genuinely needs
cross-repository atomicity, that is a separate architect change request with its own
justification — do not assume it exists.

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
- **Apply CR-1 and CR-2** (top matter) once M0 has landed the port changes: drop the
  `Repositories & { cycleState }` intersection, import `CycleState` from `@/types`, and
  implement `retractXpAward`.
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
- **Apply CR-1 and CR-2** (top matter): read the cycle pointer via `repos.cycleState.get()`
  on the hot path with derivation only as the `null` fallback, and call `retractXpAward`
  when an occurrence stops carrying a showing-up state.
- **Lifetime XP and level are monotonic against every loss-shaped event — a missed day, an
  off day, a cycle boundary, and task deletion.** The sole sanctioned reduction is
  `retractXpAward` for an undone mis-tap on a live task (SCHEMA §7).
- `reconcileAchievements` is upsert-only and never revokes. Required test: log 10 ideal
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
- Snooze/move affects the **occurrence**, not the cadence. **Build it against
  `SCHEMA.md` §4.2 (F7 move semantics), which is a pinned contract with a C1–C8 case
  table** — read precedence (a moved-in record confers due-ness before the vacate check) and
  write normalisation (a move from a date with inbound pointers redirects *those*, never the
  own-log pointer). Undo-a-snooze, same-day, chained, merged and un-merged moves are all
  specified there. Do not infer move behaviour from the S20 interaction line or from
  ARCHITECTURE §6.1's outcome table alone — both are summaries, and this class of bug
  annihilates occurrences irrecoverably (see CR-3).
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
