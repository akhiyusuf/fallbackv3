# SCHEMA — Fallback

The complete local data model. Storage is **SQLite via `expo-sqlite`**, one database file
`fallback.db`, opened with `PRAGMA journal_mode=WAL` and `PRAGMA foreign_keys=ON`.
Owned and implemented by **M1** (`src/db/**`); the TypeScript mirror of every entity lives
in `src/types/**` (M0) and is the only shape other modules see.

Conventions used below:

- `LocalDate` — `TEXT`, `'YYYY-MM-DD'`, **device-local** calendar date.
- `Instant` — `TEXT`, ISO-8601 UTC with ms, `'2026-07-16T08:03:11.412Z'`.
- `Id` — `TEXT`, UUIDv4 generated client-side (`expo-crypto`).
- Booleans are `INTEGER` 0/1.
- Enumerations are `TEXT` with a `CHECK` constraint — the closed vocabularies of PRD §6
  are enforced in the database, not just in TypeScript.

---

## 1. `settings` — singleton

Exactly one row, `id = 1`. Created by migration 1 together with the tenure anchor.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK CHECK(id = 1) | singleton guard |
| `theme` | TEXT CHECK IN ('light','dark','auto') | F8. Default `'auto'` |
| `accent` | TEXT CHECK IN ('forge-orange','indigo','berry','plum') | F8. Default `'forge-orange'` |
| `onboarding_completed_at` | Instant NULL | F9. NULL ⇒ S01 routes to S02 |
| `tenure_anchor_date` | LocalDate NOT NULL | **F29 anchor — see §7** |
| `cycle_cadence` | TEXT CHECK IN ('weekly','monthly') | F31. Default `'monthly'` |
| `notif_master` … `notif_daily_digest` | INTEGER 0/1 | F14, one column per toggle (see §6) |
| `notif_digest_time` | TEXT `'HH:mm'` | F14. Default `'08:00'` |
| `sync_enabled` | INTEGER 0/1 | F20. Default **0** (opt-in, off by default) |
| `sync_last_synced_at` | Instant NULL | F20 "Last synced …" |
| `sync_last_error` | TEXT NULL | F20 calm failure banner |
| `last_backup_at` | Instant NULL | F19 "Last backup: …" |
| `updated_at` | Instant NOT NULL | |

Validation: `theme`, `accent`, `cycle_cadence` are closed sets; `notif_digest_time`
matches `^([01]\d|2[0-3]):[0-5]\d$`.

**Not stored here:** the BYO API key and base URL. Those live **only in
`expo-secure-store`** (Keychain / Keystore) under `byo.baseUrl` / `byo.apiKey` and never
enter SQLite, never enter a backup file, and never leave the device (F18, PRD §5). The
*derived* facts (`hasByoKey`, `byoSupportsTranscription`) live in `entitlement` (§8).

---

## 2. `task`

One row per task of any of the four types. The as-needed variant is a **flag on a
Routine**, never a fifth type (PRD §3.2, Decisions item 17).

| Column | Type | Notes |
|---|---|---|
| `id` | Id PK | |
| `type` | TEXT CHECK IN ('routine','event','course','todo') | F11 |
| `name` | TEXT NOT NULL | non-empty after trim |
| `note` | TEXT NULL | To-do/Note body (S19) |
| `icon` | TEXT NOT NULL | Lucide name. Default `'Repeat'` for the S08 mini-create |
| `color` | TEXT CHECK IN ('forge-orange','indigo','berry','plum') | S21 closed set; default `'forge-orange'` |
| `is_as_needed` | INTEGER 0/1 | **F27.** May only be 1 when `type='routine'` |
| `cadence_kind` | TEXT NULL CHECK IN ('daily','specific-weekdays','weekly','bi-weekly','monthly','bi-monthly','yearly') | R23 closed set. **No custom/cron rules** (PRD §4) |
| `cadence_weekdays` | TEXT NULL | JSON array of ISO weekdays `[1..7]`, only for `specific-weekdays` |
| `cadence_weekday` | INTEGER NULL | weekly / bi-weekly anchor |
| `cadence_day_of_month` | INTEGER NULL 1–31 | monthly / bi-monthly / yearly |
| `cadence_month` | INTEGER NULL 1–12 | yearly |
| `cadence_anchor_date` | LocalDate NULL | period anchor for bi-weekly / monthly / bi-monthly / yearly |
| `event_date` | LocalDate NULL | F11 one-off Event's single due date |
| `time_of_day` | TEXT NULL `'HH:mm'` | optional; an all-day Event is allowed |
| `start_date` | LocalDate NULL | Course |
| `end_date` | LocalDate NULL | Course — **required** for a Course |
| `doses_per_day` | INTEGER NOT NULL DEFAULT 1 CHECK(>=1) | F12 |
| `is_tracked` | INTEGER 0/1 | carries ideal+fallback and logs via F3 |
| `snoozable` | INTEGER 0/1 NOT NULL DEFAULT 1 | **F7.** May this task's occurrences be snoozed one day forward? Set at create time (**default on**), editable post-creation from S20. When 0 the snooze slot renders **disabled, not hidden**. Turning it off does **not** retract an existing snooze (§4.2) |
| `importance` | TEXT NULL CHECK IN ('high','med','low') | fixed vocabulary; **no free-form tags** |
| `necessity` | TEXT NULL CHECK IN ('must-do','recommended','optional') | fixed vocabulary |
| `todo_done_at` | Instant NULL | F11 To-do binary completion. Never XP-eligible |
| `created_at` / `updated_at` | Instant | |
| `deleted_at` | Instant NULL | soft delete; see §2.3 |

Indexes: `idx_task_type_deleted (type, deleted_at)`, `idx_task_as_needed (is_as_needed)`.

### 2.1 Validation rules (enforced by `validateTaskDraft`, M2)

| Rule | Applies to | Message source |
|---|---|---|
| name non-empty | all | S16–S19 error copy |
| ≥1 ideal step **and** ≥1 fallback step | tracked Routines and **all** Courses | F2 / S18 |
| ideal + fallback **optional** | as-needed Routines (F27), Events, To-dos | F27 / S17 SITEMAP resolution |
| cadence required | Routine (non-as-needed), Course | F2 / F11 |
| `specific-weekdays` needs ≥1 weekday | all cadenced types | F2 edge |
| Course requires `end_date` | Course | S18 |
| `doses_per_day >= 1` | Course | F12 |
| **no-empty-run-occurrence** | any tracked task with sub-step scheduling | F23/F24 — see §3.1 |
| as-needed ⇒ no cadence, no occurrence set, no sub-step grid | Routine | F27 |
| To-do ⇒ no cadence, no ideal/fallback, no schedule | To-do | F11 |

### 2.2 Type/variant matrix

| | cadence | occurrence set | ideal+fallback | due on Today | in consistency | XP-eligible |
|---|---|---|---|---|---|---|
| Routine (trackable) | required | yes | **required** | yes | yes | yes |
| Routine (**as-needed**, F27) | **none** | **none** | optional | **never** | **never** | **zero, both kinds** |
| Event (one-off) | none | **one** (its date) | optional | yes | yes | **yes** — the anchor case |
| Event (repeating, F26) | required | yes | optional | yes | yes | yes |
| Course | required | yes | **required** | yes | yes | yes |
| To-do / Note | none | **none** | never | no | no | no |

The XP-eligibility boundary is **having a due occurrence at all**, never carrying a
cadence. A one-off "Dentist visit" Event earns XP; an as-needed routine's "used it" log
earns nothing (PRD Decisions item 17 — get this right).

### 2.3 Delete cascade — PINNED

Delete is a **soft delete** (`deleted_at`) so an in-flight undo and any open sheet stay
coherent. The hard cascade runs when the undo window closes — concretely, on the **next
store open**: `StoreLifecycle.open()` hard-deletes every row already soft-deleted at open
time. There is no separate "compaction" job, no schedule and no background task; M1 owns
this sweep and nothing else triggers it.

**The cascade is deliberately split, and the split is load-bearing:**

| Cascaded (removed) | Never cascaded (permanent) |
|---|---|
| `step` | `xp_award` — `task_id` is set to NULL, the row and its `amount` survive |
| `day_log` | `achievement_unlock` — upsert-only, never revoked |
| `off_day_mark` (task-scoped rows) | `cycle_record` — a past recap is permanent |
| `as_needed_use` | |

This matches PRD F7's own cascade, which names **only** "log + off-day records" (PRD §3.7,
Data touched) and never mentions XP, and it keeps the lifetime layer monotonic: F13's
no-loss clause ("no XP loss, no decaying levels", also PRD §4) and MODULES M5's "nothing
lifetime ever resets" both survive a legal user action. Consequently `xp_award.task_id` is
**nullable with `ON DELETE SET NULL`**, not `ON DELETE CASCADE` — the XP was genuinely
earned; the task it came from may be gone.

**The asymmetry is intentional, not an oversight.** F5 is a *windowed view of current
history*, so PRD F7 requires deleting a task to remove its records from the F5 recompute —
and it does. Lifetime XP, badges and archived recaps are *permanent records of what
happened*, so they do not move.

**Required test (M1 + M2 must agree on this answer).** Create a task, log 10 ideal days
(100 XP), then delete it:
- lifetime XP **unchanged at 100**; level **unchanged**; earned badges **unchanged**;
- the current cycle's Cycling XP **unchanged**;
- those 10 days leave the F5 denominator at both scopes and the % recomputes without them;
- the task disappears from every browse surface and from Today;
- reopen the store so the hard sweep runs: the 10 `xp_award` rows are still present with
  `task_id = NULL`, and lifetime XP is still 100;
- **then back up (F19) and restore into a fresh store:** those orphaned `task_id = NULL`
  awards survive the round trip intact and lifetime XP is still 100. The backup envelope
  serialises `xp_award` rows independently of `task`, so a null `task_id` must not be
  treated as a broken reference and must not be dropped, rewritten or restored as 0 XP.

---

## 3. `step`

| Column | Type | Notes |
|---|---|---|
| `id` | Id PK | |
| `task_id` | Id NOT NULL FK → task(id) ON DELETE CASCADE | |
| `role` | TEXT CHECK IN ('ideal','fallback') | |
| `text` | TEXT NOT NULL | |
| `position` | INTEGER NOT NULL | ordering within the role |
| `due_weekdays` | TEXT NULL | **F23/F24.** JSON array of ISO weekdays, or **NULL = due on every parent occurrence** (the default for a new step) |

Index: `idx_step_task (task_id, role, position)`.

### 3.1 The F23/F24 invariant — the single fact everything else rests on

- `due_weekdays` is always a **subset of the parent task's own occurrence weekdays**. A
  sub-step can **never** be due on a day the parent doesn't run. A new step defaults to
  `NULL` (all parent occurrences).
- It governs **ideal** steps only. The **fallback** is the whole-task minimum-viable
  alternative, available on every run-occurrence, never per-occurrence toggled.
- **No empty run-occurrence.** A configuration that leaves **any** parent occurrence with
  **zero** due ideal steps is **rejected at save**, with inline validation naming the
  offending weekday. The check is over the **union of every ideal step's due-days per
  day** — toggling one step off everywhere is legal as long as some other ideal step still
  covers every occurrence.
- Consequently `parent-occurrence ⟺ due ⟺ ≥1 ideal sub-step due` holds, so "ideal" is
  never vacuous, the toggle-all-off free-ideal-day exploit is unreachable, and every
  "missed" is a real miss.
- Dropping a parent occurrence auto-removes it from every step's due-set; adding one is
  subject to the no-empty rule. Changes apply **going forward**; past days keep their
  logged state and F5 recomputes past days against the due-set that applied then.
- Coarser cadences (weekly…yearly) have one occurrence per period, so subsetting is
  degenerate: the grid is replaced by the design's static note and `due_weekdays` stays
  `NULL`.

---

## 4. `day_log`

One row per `(task_id, date)` that has ever been touched. An absent row means "never
touched", which is not the same as `To do` — see §4.1.

| Column | Type | Notes |
|---|---|---|
| `id` | Id PK | |
| `task_id` | Id NOT NULL FK → task(id) ON DELETE CASCADE | |
| `date` | LocalDate NOT NULL | the occurrence's own date |
| `chip_state` | TEXT NULL CHECK IN ('todo','done','fallback','skip') | the four chip states of PRD §6. **"missed" is NOT a chip state** |
| `is_manual_override` | INTEGER 0/1 | a manual chip wins over step auto-log until changed |
| `completed_step_ids` | TEXT | JSON array of ideal step ids completed on this occurrence |
| `doses_completed` | INTEGER DEFAULT 0 | F12 |
| `moved_to_date` | LocalDate NULL | **F7 one-hop snooze.** Non-null ⇒ this occurrence is snoozed to the very next day. Constrained: `CHECK (moved_to_date IS NULL OR moved_to_date = date(date, '+1 day'))`. Affects the occurrence, not the cadence. Semantics: §4.2 |
| `created_at` / `updated_at` | Instant | |

`UNIQUE (task_id, date)`. Indexes: `idx_log_date (date)`, `idx_log_task_date (task_id, date)`.

### 4.1 Derived outcome — never stored
`OccurrenceOutcome` (`ideal | fallback | missed | off | pending | not-due`) is **computed**
by `src/domain/dayState.ts`, never persisted. Persisting it would let a clock change or a
cadence edit desynchronise history from the rules. The mapping is pinned in
ARCHITECTURE.md §6.1:

```
Done → ideal      Fallback → fallback      Skip → missed (any day, incl. today)
To do / no row → pending while the date is today; missed once the day has ended
```

"Missed" is a derived **history label**, shown neutrally, and is not a named slice of the
F5 breakdown (ideal/fallback/off only) — but missed days are the load-bearing denominator
category and the only thing that lowers the %.

### 4.2 `moved_to_date` semantics (F7 one-hop snooze) — PINNED

> **Provenance.** `docs/PRD.md` **§3.7** (amended 2026-07-27, human-directed, inside the
> approved Gate 1) is **authoritative**; this section conforms to it. §3.7 narrowed F7 from
> arbitrary-target moves to a **one-hop, once, per-task-gated snooze** and removed "Move to
> another day" (PRD §4, Decisions item 21). `review/ADVICE-M2.md` remains the historical
> record of the read/write-carrier machinery that **survives** below — §3.7 mirrors it rather
> than replacing it — but where the ADVICE describes capability §3.7 no longer asks for
> (chains, arbitrary distance, same-task double-inbound), **the PRD wins and this section is
> the current contract.** The old-case-table mapping was delegated to the architect
> (Decisions item 21) and is recorded at the end.

**Storage shape.** `day_log.moved_to_date` keeps its type and gains
`CHECK (moved_to_date IS NULL OR moved_to_date = date(date, '+1 day'))`. A non-null pointer
now means exactly one thing: **this occurrence is snoozed to the very next day** — chains are
unreachable at the *storage* layer, not merely discouraged in the UI. The per-task gate is
`task.snoozable` (§2).

**Migration ownership — M1 (CR-4).** M1 adds the constraint in the same forward migration
that adds `task.snoozable`. SQLite cannot add a CHECK to an existing table in place, so this
is a table-rebuild migration (create-new / copy / drop / rename) inside one transaction, per
§9's forward-only discipline.

**Legacy rows.** Pre-rescope data may hold a `moved_to_date` more than one day out, which
would fail the new constraint and abort the migration. **Normalise before adding the
constraint, in the same transaction:** for every row where `moved_to_date` is non-null and
not exactly `date + 1`, **clear the pointer** (`moved_to_date = NULL`), returning that
occurrence to its own date with its chip/step data intact. This is the conservative
direction — it can only restore an occurrence to where the user originally put it, never
invent a snooze the user did not perform, and never destroys logged data (the D-rule already
guarantees the row's data revives when the occurrence resolves there again).

**F5 recomputes on read; the XP ledger does NOT — the migration must move the award too.**
Consistency is derived, so F5 is correct the moment the pointer is cleared. `xp_award` is a
**ledger, written only inside mutations** (API.md §3, step 3): **no read path ever reconciles
an award.** So clearing a legacy pointer `S → T` without touching the ledger would strand the
award at T while the occurrence displays at S.

**Award policy for normalised rows — PINNED: the award moves with the occurrence**, in the
same transaction, `UPDATE xp_award SET date = S WHERE task_id = τ AND date = T`. This is not
a new rule: **C7 already pins that XP travels home with the occurrence on undo**, and
normalising a legacy long-distance pointer *is* an undo of a snooze the current contract can
no longer express — so it must land in the same end state. Lifetime XP is unchanged (a
relocation, never a reduction), and both dates are left coherent, so the next mutation
touching either is a no-op rather than a surprise. **Conflict rule:** in the rare case
inconsistent legacy data already holds an award at S, keep S's and delete the orphan at T —
that is removing a second award for one occurrence, which **P4** (at most one `xp_award` per
`(task, date)`) forbids anyway, not a penalty.

*Rejected: leaving the stale award in place as uncorrected lifetime history.* It reads as the
conservative option but is not. It leaves **two** latent faults, and reconcile is per-`(task,
date)` so neither self-heals: a later mutation touching **T** finds no showing-up occurrence
and **retracts** the award — a silent lifetime-XP drop; and a later mutation touching **S**
finds `ideal` with no award and **mints a new one** — a silent **double count** for a single
occurrence. That is the award/outcome incoherence class **C4b exists to forbid**, reached
through the migration instead of through runtime.

**Definitions** (for task τ, date D):
- `ownLog(D)` — the `day_log` row keyed `(τ, D)`, if any.
- `pointer(D)` — `ownLog(D).movedToDate` when non-null; necessarily `D + 1`. A row with a
  non-null pointer is **RESIDUE** for its own date: its chip/step data belongs to the
  occurrence that left. It neither vacates a date that has a moved-in record nor supplies
  data to one.
- `inbound(D)` — the row `r` of τ with `r.movedToDate === D`. **At most one can exist:**
  `r.movedToDate = r.date + 1`, so only `r.date === D − 1` qualifies, and `day_log` is
  `UNIQUE (task_id, date)`. *(The old latest-source tie-break is therefore dead — there is
  never anything to break a tie between. `inbound` is per-task; two **different** tasks each
  snoozing onto D is unaffected and fully supported.)*
- `natural(D)` — `isDue(τ, D, notBefore)`.

#### ONE LIVE OUTCOME PER TASK PER DATE (read resolution)

The name is PRD §3.7's, adopted verbatim so the two documents stay aligned. For a **given
task**, a date never displays or counts more than one of **that task's** outcomes. Different
tasks resolve independently — a date shows one outcome *per task*, as Today always has.

```
R-1  if a moved-in record exists for D:
       D IS due — regardless of natural(D); off-marks still resolve `off` as today.
     effectiveLog :=
       a. ownLog(D), if it exists and pointer(D) is null        [PRD case 1 — the target's
          own real logged state wins; the visitor contributes nothing and goes dormant]
       b. else null, if natural(D) and ownLog(D) is absent      [PRD case 2 — target is
          naturally due and never logged: it keeps its OWN blank state (auto chip;
          pending today, missed once past, off if off-marked). Deliberately NOT the
          visitor's data: showing a completed state on a day the user never touched
          would manufacture XP for that day]
       c. else the moved-in record                              [PRD case 3 — the visitor
          is the only occurrence present: a non-natural D, or a D whose own occurrence
          has itself been snoozed away]
       A vacated own log (pointer non-null) NEVER annihilates a moved-in occurrence
       and NEVER supplies its data — it is residue.
R-2  else if pointer(D) is non-null: not-due (vacated).
R-3  else: the ordinary natural resolution.
```

With no snooze in play this must be byte-equivalent to the un-snoozed behaviour.

#### WRITE — `useSnoozeOccurrence(τ, D)` and `useUndoSnooze(τ, D)`

Both act on **exactly the occurrence the sheet is displaying** (S20's occurrence card). The
heatmap drill-down offers no snooze control — an occurrence reached through history is never
snoozable (PRD §3.7).

```
     In both operations D is the occurrence's OWN date — the date of the row that carries
     (or will carry) the pointer. The caller resolves which occurrence the sheet is
     displaying and passes that occurrence's own date, never the date being viewed.

W-1s SNOOZE preconditions. Reject with VALIDATION_FAILED, zero writes, zero reconciles,
     zero events, if ANY holds:
       - the occurrence at D resolves `not-due` (nothing to snooze); or
       - `task.snoozable` is 0 (the slot renders disabled; activating it writes nothing);
         or
       - the occurrence is ALREADY snoozed (pointer(D) non-null) — its slot renders
         "Undo snooze" instead, and a snoozed occurrence can never be snoozed again.
     Snoozable states are exactly: pending, ideal, fallback, missed, off. `not-due` is the
     sole non-snoozable case.

W-1u UNDO preconditions — DIFFERENT, and deliberately narrower. Reject with
     VALIDATION_FAILED, zero writes, zero reconciles, zero events, only if:
       - pointer(D) is null (nothing to undo).
     Nothing else rejects. In particular:
       - D resolving `not-due` is NOT a rejection — it is the NORMAL case. A snoozed
         occurrence's own date always reads not-due via R-2 (it is vacated); requiring a
         due source would make every legal undo impossible.
       - `task.snoozable` is IRRELEVANT to undo. Per PRD §3.7 rendering 3, "Undo snooze"
         is offered regardless of the task's current `snoozable` value, so turning the
         flag off never strands an already-snoozed occurrence.

W-2  Snooze writes ONE row: upsert ownLog(D).movedToDate = D + 1, preserving existing
     chip/step/dose data. Undo writes ONE row: set ownLog(D).movedToDate = null,
     preserving that row's chip/step/dose data so the occurrence returns with its state.
     The target is COMPUTED, never chosen — there is no target-date input anywhere.
W-3  Both operations reconcile BOTH dates (D and D + 1) through reconcileOccurrence, and
     emit `day:logged` EXACTLY ONCE, for the date the occurrence now lives at:
       - snooze → `day:logged` carries **D + 1**;
       - undo   → `day:logged` carries **D**.
     XP follows the reconciles: a vacated showing-up source retracts (CR-2 boundary), and
     undo re-affirms the restored award at D.
```

Both operations touch **one row**, so the absence of a cross-repository transaction
primitive on the `Repositories` port is no longer a concern here.

**Deleted from the previous contract, deliberately:** the same-day no-op guard (the target
is computed as `D + 1` and can never equal `D`), the ±60-day distance guard (there is no
distance to guard), and the redirect-inbound-pointers write branch (reachable only via
chains). Do not reintroduce them.

#### Write-side carrier selection (occurrence-data mutations)

Unchanged, and load-bearing. Applies to `logState`, `toggleStep`, `useLogDose`.

```
T-1  Resolve D through the R-rules first. If the occurrence at D resolves `not-due` — a
     vacated source (R-2), or a plainly not-due date — REJECT: VALIDATION_FAILED, zero
     writes, zero reconciles, zero events. This protects residue rows from the write side,
     and closes the fabrication path where an inert row written on a not-due date is later
     adopted as clause-(a) truth by a snooze-in.
T-2  Otherwise write to the occurrence's data carrier, designated by the SAME clause
     selection the read uses:
       clause-(a) shape → update ownLog(D).
       clause-(b) shape (and the plain R-3 rowless case) → create ownLog(D) fresh,
         pointer null.
       clause-(c) shape → update the moved-in row at its source date, changing only its
         chip/step/dose/override fields and PRESERVING its movedToDate. ownLog(D), if
         present as residue, is NOT touched.
T-3  Reconcile and emit against D, the resolved date: the XP award keys on (task, D);
     `day:logged` carries D. Only the addressed row changes.
```

**Structural requirement — the single-answerer discipline (unchanged, and it survives the
rescope intact).** ONE pure carrier-designation function,
`designateCarrier` (`src/domain/dayState.ts`), returns
`own-live | own-create | visitor(row) | none` for a `(log, movedInLog, natural)` triple. Both
`resolveOccurrence` (read) and `resolveWriteTarget` (`src/queries/internal.ts`, write) consume
it. **No second implementation of the clause selection may exist anywhere** — reads and writes
answering "which row is this occurrence?" independently is exactly what caused the F1
data-corruption defect class, and the narrower snooze rule does not make it safe to reintroduce.

#### Named cases — each row is a required test, end-to-end through the public surface

| # | Sequence | Required end state |
|---|---|---|
| C1 | snooze D, then undo | `ownLog(D).movedToDate = null`; no pointer anywhere; D due with its prior chip/step data and any previously-earned award re-affirmed; D+1 back to its own state; denominator restored |
| C4 | snooze D onto a naturally-due D+1 that **has** its own log (PRD case 1) | D+1 keeps its own logged state and count; the visitor contributes nothing to F5 or XP and goes dormant; D vacated (leaves the denominator) |
| C4b | snooze D onto a naturally-due D+1 that has **never** been logged (PRD case 2) | D+1 keeps its **own blank state** (auto chip; pending today, missed past, off if off-marked); the visitor's data contributes nothing — **assert with a completed visitor that NO XP award materialises at D+1**; undo restores D with its data and re-affirms its award |
| C4r | undo from a case-1 target | clears `ownLog(D)` only; D due again with prior data; D+1's own occurrence untouched — exact restore |
| C5 | **merge-then-vacate.** Snooze D onto a D+1 that **has** its own logged data (case 1, so the visitor goes dormant — this is C4). Then, separately, snooze **D+1's own displayed occurrence** forward to D+2 | reachable through the UI, and the old LIFO reading is **inverted**: once D+1 vacates, its residue pointer no longer supplies data, so the dormant visitor **REVIVES** at D+1 via R-1 clause (c) and its XP **re-materialises** through reconcile. End state matches C6's shape and PRD case 3. Assert the ordering, the revival, and the award re-materialising — a dormant visitor is never destroyed by its host leaving |
| C6 | daily task: snooze D+1's occurrence to D+2, then snooze D's occurrence to D+1 (two independent one-hop snoozes on **different** occurrences — explicitly in scope, PRD Decisions 21) | D's occurrence is DUE at D+1 via its moved-in record (R-1 clause (c)) — D+1's residue pointer does not annihilate it; D+1's own occurrence stays at D+2 |
| C7 | snooze D, complete at D+1, then undo — **fixture constraint: D+1 must be NON-natural** (off-cadence), so the visitor is the only occurrence there and clause (c) is what is under test; a naturally-due D+1 would exercise clause (a)/(b) instead, which is C4/C4b | the tap writes to D's OWN row (the visitor), pointer preserved — no row is fabricated at D+1 (T-2 clause-(c)); the award keys on D+1 while the occurrence shows there (T-3). On undo the completion travels home WITH the occurrence: D due `ideal` with its chip data; D+1 not-due; exactly one award, re-affirmed at D — not lost, not duplicated |
| C9 | C6's shape, then a chip/step tap on D+1 | tap VISIBLE at D+1 (outcome per tap; XP for (task, D+1) iff eligible); the write landed on D's row (the visitor), its pointer intact; residue `ownLog(D+1)` byte-unchanged. Undoing D+1's own occurrence home then shadows the visitor per clause (a), its award at D+1 retracted by reconcile (sanctioned, CR-2) and revived by the visitor's own undo |
| C10 | snooze D, then any occurrence-data write on D | VALIDATION_FAILED; `ownLog(D)` byte-identical; zero events, zero XP delta; undo afterwards revives D exactly as pre-snooze |
| C11 | any occurrence-data write on a rowless not-due date | VALIDATION_FAILED, zero writes — so a later snooze-in finds no fabricated clause-(a) row |
| C12 | **two different tasks** each snooze one day forward onto the same date | legal and expected; each resolves independently under its own task's precedence rule; **both display and count** — one outcome *per task*, and F5's per-day fraction sees both |
| C13 | snooze an already-snoozed occurrence | impossible through the UI (its slot reads "Undo snooze"); if attempted directly → VALIDATION_FAILED, zero writes. **No occurrence is ever more than one day from its own date** |
| C14 | snooze on a task with `snoozable = 0` | slot renders **disabled, not hidden**, with the reason exposed to the screen reader; activating it writes nothing. Turning `snoozable` off while one of that task's occurrences is already snoozed does **not** retract it — that occurrence keeps its "Undo snooze" rendering |

**D-rule (dormant data, pinned so it is not relitigated):** a `day_log` row's chip/step data
is per-date state. It is inert while no occurrence resolves at that date and revives if an
occurrence returns there. Residue rows are immutable to every mutation except snooze/undo;
dormant data can change only by the occurrence returning home — and data a tap writes to a
visitor's row is the visiting occurrence's own state, travelling with it. This mirrors F4's
"restore what was logged" and is intended behaviour, not a defect.

**Boundary notes.** D + 1 may be today, the past, or the future — it resolves under the
ordinary rules for its own date (an unlogged past target reads missed; that is coherent, not
a bug). A snooze onto an off-marked day resolves `off` there with no retraction (F4).
Snooze and undo affect the **occurrence, not the cadence**: no cadence, recurrence or
sub-step schedule is edited by either. As-needed routines (F27) have no occurrences, so
snooze does not apply to them at all.

**Architect note — finalized cycle records are deliberately NOT rewritten by a snooze.** A
snooze across a cycle boundary does not alter an already-finalized `cycle_record`; §8 pins
those as permanent and append-only. Consequently an archived record's stored
`consistency_percent` may no longer equal a fresh recomputation of that window. **Assert
archived records against their stored values, never against a recomputation.**

**Architect note — OPEN (PRD §7): reaching "Undo snooze" for a dormant occurrence.** Under
precedence cases 1 and 2 the visitor displays **nowhere** — its source reads not-due, its
target shows the target's own state — and no currently-specified surface offers its undo
control. For a daily-cadence task this is the **common** case, not a corner case. The **data
is not lost** (dormant, and revives if the occurrence returns), and the undo *mechanic* is
settled; only its *reachability* is undefined. **This is a human/designer decision (PRD §7)
— do not invent a UI for it here or in a module brief.** qa-tester cannot write a definitive
undo-reachability assertion until §7 answers it; every other criterion above is testable
today.

**Case-ID mapping from the pre-amendment contract.** **Survive** (restated in one-hop terms):
C1, C4, C4b, C4r, C6, C7, C9, C10, C11. **C5 survives with INVERTED content** — its old
chain-of-one-visitor reading is dead, but its *slot* now covers merge-then-vacate, which is
still reachable and whose outcome flips from the old LIFO assumption (the dormant visitor
revives rather than staying buried). **Dead:** C2 (target is computed — source and target can
never coincide), C3 (a chain, unreachable once a snoozed occurrence cannot be re-snoozed),
C8 (`D → D+1` is injective, so two source dates of the *same* task can never reach one
target — `|inbound(D)| ≤ 1` is now an invariant). **New:** C12, C13, C14.

---

## 5. `off_day_mark`, `as_needed_use`

### `off_day_mark` (F4)

| Column | Type | Notes |
|---|---|---|
| `id` | Id PK | |
| `date` | LocalDate NOT NULL | |
| `task_id` | Id NULL FK → task(id) ON DELETE CASCADE | **NULL ⇒ whole day off**; otherwise the one task marked off |
| `prior_chip_state` | TEXT NULL | snapshot so un-marking restores exactly what was logged |
| `created_at` | Instant | |

`UNIQUE (date, task_id)` — with SQLite's NULL semantics M1 must additionally enforce at
most one whole-day row per date via a partial unique index.

Semantics (PRD §3.4 — human-directed, non-negotiable): an off day is **never a miss**,
never triggers a reset/streak-break/XP penalty, and is **excluded from BOTH sides** of the
consistency fraction, so it neither raises nor lowers the %. It is still **counted and
shown** as its own category. Marking a future day off is allowed. Un-marking restores the
prior state.

### `as_needed_use` (F27)

| Column | Type | Notes |
|---|---|---|
| `id` | Id PK | |
| `task_id` | Id NOT NULL FK → task(id) ON DELETE CASCADE | must be an as-needed Routine |
| `date` | LocalDate NOT NULL | the date the situation occurred |
| `marker` | TEXT NULL CHECK IN ('ideal','fallback') | NULL when the routine defined neither |
| `created_at` | Instant | |

**Reference-only, by construction.** These rows are read by S23's history list and by
nothing else. They are **never** joined into the consistency computation at either scope,
and **never** into XP or achievement recomputation. Marking one "used" 50× must move
neither the % nor either XP counter, and must create no cycle-record entry.

---

## 6. Notification preference columns (F14)

Stored as flat columns on `settings` (not a table — the set is closed):
`notif_master`, `notif_routine_due`, `notif_event_starting`, `notif_course_dose`,
`notif_course_ending_soon`, `notif_gentle_reentry`, `notif_milestone_reached`,
`notif_daily_digest`, plus `notif_digest_time`. All default to 0 except `notif_master`
(0 until the user accepts the S07 primer) — the app is fully usable if permission is
declined.

`widget_config` is a separate small table: `(size TEXT PK CHECK IN
('small-today','small-one-task','medium-up-next'), mode TEXT CHECK IN
('fixed-task','smart-next-due'), fixed_task_id Id NULL)`.

---

## 7. Progress: XP, achievements, tenure

### `xp_award` — append-only ledger

| Column | Type | Notes |
|---|---|---|
| `id` | Id PK | |
| `task_id` | Id **NULL** FK → task(id) **ON DELETE SET NULL** | nulled, not deleted, when the task is deleted (§2.3) |
| `date` | LocalDate NOT NULL | the occurrence date the award is anchored to |
| `kind` | TEXT CHECK IN ('ideal','fallback') | |
| `amount` | INTEGER NOT NULL | **10 for ideal, 6 for fallback** (S24) |
| `cycle_id` | Id NOT NULL | the cycle live when the award was granted |
| `created_at` | Instant | |

`UNIQUE (task_id, date)` — one award per occurrence, so re-logging the same day cannot
farm XP. (SQLite treats NULLs as distinct in a unique index, which is what we want:
orphaned awards from deleted tasks never constrain new ones.)

Downgrading a log (ideal → fallback) updates the row's `kind`/`amount`; un-setting a
showing-up state on a **live** task retracts its row via
`ProgressRepository.retractXpAward(taskId, date)` — that is a correction to something that
turned out not to have happened, not a penalty. **Deleting a task never retracts its
awards** (§2.3).

**This is the ONLY sanctioned reduction of lifetime XP, and it is narrow.** It fires only
when a specific occurrence stops carrying a showing-up state — a mis-tap being undone. It
is not triggered by a missed day, an off day, a cycle boundary, or a task deletion, all of
which leave XP untouched. The port originally had no retraction call, which made §7
undeliverable; MODULES.md carries the change request that adds it.

**Lifetime XP** = `SUM(amount)` over all rows. **Cycling XP** = `SUM(amount) WHERE
cycle_id = <current>`. The same completion increments both; they are two counters over one
ledger, not double counting. Neither can be reduced by deleting a task, by a cycle
boundary, by an off day, or by a missed day.

**Eligibility (F13 = F31, identical set).** An award exists **iff** the occurrence is a
due occurrence of an occurrence-bearing task (recurring **or** one-off) that resolved to
`ideal` or `fallback`. Excluded, with zero of either kind: as-needed routine "used it"
logs, To-do checkbox completions, off days, skips, pending days.

### Levels — PINNED table
```
xpForLevel(L) = 100 + 150 * (L - 1)          // XP needed to leave level L
level 1 → 100, level 7 → 1000                // both anchors from S27's copy
```
**Titles — the design pins THREE, not two:**

| Level | Title | Source |
|---|---|---|
| 1 | **Getting started** | **design-pinned** — S27 lines 2354 / 2417, S41 line 3883 |
| 2 | Warming up | architect-authored |
| 3 | Finding your rhythm | architect-authored |
| 4 | Steady | architect-authored |
| 5 | Reliable | architect-authored |
| 6 | Resilient | architect-authored |
| 7 | **Consistent** | **design-pinned** — S27 lines 2301 / 2389, S41 lines 3859 / 3905 |
| 8 | **Dependable** | **design-pinned** — S28 "Copy (exact strings)" line 2800, "New title: Dependable." |
| 9 | Unshakeable | architect-authored |
| 10 | Enduring | architect-authored (11+ reuse "Enduring") |

The three design-pinned titles are **not** swappable — S27, S28 and S41 render them as
exact copy, so changing them would desynchronise the constant from the screens.
The seven architect-authored titles live in the same constant (owned by M2,
`src/domain/xp.ts`) and a designer may swap any of them without touching logic.

**There is exactly one source for a rendered level title: this constant.** S28's
"New title: Dependable." is satisfied *by* the constant returning "Dependable" at level 8 —
M5 renders `levelFor(xp).title`, it does not hardcode the string. That is what keeps the
verbatim-copy rule and the constant from disagreeing.

*(L3 was moved off "Showing up" deliberately: "Showing up" is also the name of a badge
category on S27, and both would render on the same screen.)*

**XP never decays and a level never goes down** — including when a task is deleted (§2.3).

### `achievement_unlock`

| Column | Type | Notes |
|---|---|---|
| `key` | TEXT PK | catalogue key |
| `unlocked_on` | LocalDate NOT NULL | the **true** calendar date the condition was met |
| `created_at` | Instant | the date it was observed |

Upsert-only, never deleted. `unlocked_on` is the true condition date (for tenure,
`anchor + tier`), not the observation date — that makes long dormancy, multi-tier
catch-up, and F30's "badges unlocked in this cycle" attribution all deterministic, and a
backward clock can never revoke a badge.

### Achievement catalogue (S27)

Labels are **exact copy from S27** (lines 2397–2403) — take them verbatim, do not
re-case or re-word. Conditions marked *(design-witnessed)* are confirmed by S27's own
Appendix B ledger and its badge-provenance block; the rest are architect-authored.

| Category | Key | Label (exact) | Condition |
|---|---|---|---|
| Showing up | `showing-up-7` / `-30` / `-50` / `-200` | "7 days" · "30 days" · "50 shown up" · "200 shown up" | cumulative **shown-up days** reaches 7 / 30 / 50 / 200 *(design-witnessed — S27 lines 2407–2414 explicitly fixed these to be **day**-level, not event-level)* |
| Fallback wins | `fallback-safety-net` | "Safety net" | first fallback occurrence ever logged *(design-witnessed, line 2480)* |
| | `fallback-never-zero` | "Never zero" | 10 fallback occurrences logged *(design-witnessed, line 2493 / 2686)* |
| | `fallback-saved-25` | "Saved 25×" | 25 fallback occurrences logged *(design-witnessed, line 2714)* |
| | `fallback-comeback` | "Comeback" | shown up on the day immediately after a missed day *(design-witnessed, lines 2697–2699)* |
| Milestones | `milestone-100-done` | "100 done" | 100 completed occurrences, ideal or fallback *(design-witnessed as a task-completion count, line 2710)* |
| | `milestone-course-x3` | "Course ×3" | 3 Courses run through to their end date *(architect-authored)* |
| | `milestone-full-week` | "Full week" | an ISO week where all 7 days are qualifying days and every `f(D) = 1.0` *(design-witnessed as 7/7, lines 2324 / 2562)* |
| Tenure (F29) | `tenure-first-day` … `tenure-50-years` | "First day" · "1 Week" · "1 Month" · "2 Months" · "6 Months" · "1 Year" · "2 Years" · "5 Years" · "10 Years" · "20 Years" · "50 Years" | 11 tiers, **calendar-elapsed only** |

Fallback-wins counts are **task-level occurrence counts**; showing-up counts are **day
counts** (a day is shown-up if any due non-off task on it resolved to ideal or fallback).
The design fixed this distinction deliberately — do not collapse the two.

Note the tenure labels are **title-cased after the first tier** ("First day", then
"1 Week", "1 Month", …), per S27's exact-copy block. The PRD's prose lower-cases them;
S27's rendered copy wins.

### F29 tenure — anchor decision (PRD §7, genuinely OWNER-delegated to the architect)

**PINNED: the anchor is the device-local calendar date on which the local store is first
created — i.e. first launch.** Written by migration 1 into `settings.tenure_anchor_date`.

*Why not the alternatives.* Install date is not reliably observable on both platforms from
RN without extra native code; first-task creation would punish a user who explores before
committing and is not "one fixed calendar date" independent of behaviour. First store
creation is observable, deterministic, consistency-independent, device-local, and happens
exactly once.

Tiers (rendered labels, exact per S27): `First day, 1 Week, 1 Month, 2 Months, 6 Months,
1 Year, 2 Years, 5 Years, 10 Years, 20 Years, 50 Years`, measured from the anchor in
**calendar time only**, wholly
independent of whether the user showed up at all — a user absent for 11 months still earns
the 1-year badge on day 366. These are **not** streaks and **not** cumulative counts, and
they are **not** gated on Cycling XP or cycle records. A brand-new user holds exactly
`tenure-first-day`.

An F25 erase-all or a reinstall mints a **fresh anchor** — a deliberate consequence of the
no-account model. A **sync restore carries the anchor**, because the anchor is a store
field and F20 replicates the whole store.

---

## 8. Cycles and entitlement

### `cycle_record` (F30) — append-only, permanent

| Column | Type | Notes |
|---|---|---|
| `id` | Id PK | |
| `cadence` | TEXT CHECK IN ('weekly','monthly') | the cadence **at finalize** — past records keep it |
| `start_date` / `end_date` | LocalDate | inclusive |
| `consistency_percent` | INTEGER NULL | F5 scope-2 fractional formula windowed to this cycle. **NULL = a "no data" cycle**, never 0 |
| `breakdown_ideal` / `_fallback` / `_off` / `_missed` | REAL / INTEGER | display units per ARCHITECTURE.md §6.5 |
| `cycling_xp_final` | INTEGER NOT NULL | archived **before** the counter zeroes |
| `badge_keys_unlocked` | TEXT | JSON array; from `achievement_unlock.unlocked_on` inside the window |
| `is_short_cycle` | INTEGER 0/1 | a mid-cycle cadence change finalized it early |
| `finalized_at` | Instant | |

Records are **never overwritten or lost**. The current in-progress cycle is not a record.
Erase-all clears them along with everything else.

### `cycle_state` — singleton

`(id=1, current_cycle_id Id, cadence TEXT, start_date LocalDate, end_date LocalDate)`.

**Accessor contract — PINNED.** This table is read on every launch and every foreground,
so it needs a real accessor. It is a **first-class member of `Repositories`**, exactly like
the other singleton (`settings`), not a member of `ProgressRepository`:

```ts
interface CycleStateRepository {          // src/types/ports.ts
  get(): Promise<CycleState | null>;      // null on a fresh store, before the first seed
  set(state: CycleState): Promise<Result<void>>;
}
interface Repositories { …; readonly cycleState: CycleStateRepository; }
```

`CycleState` (`{ currentCycleId, cadence, startDate, endDate }`) lives in
`src/types/progress.ts`. The port originally omitted this accessor — that was an architect
defect, not a hint that the pointer was optional. M1 already implements exactly this shape
additively; the change request in MODULES.md promotes it into the port proper.

**The pointer is authoritative; derivation is the fallback.** M2 must read `cycleState.get()`
as the O(1) source of the current cycle. Only when it returns `null` (fresh store, or a
backup restored from before the pointer existed) may M2 fall back to deriving the window by
walking forward from `settings.tenureAnchorDate` and de-duplicating against
`listCycleRecords()`, then **write the pointer back** via `set()` so the fallback runs at
most once. Do not derive on the hot path — it is O(records) where the pointer is O(1).

**Boundary reconciliation (F31)** runs at launch and on app foreground, is idempotent, and
is wrapped in one transaction per boundary:

```
while (currentCycle.end_date < today):
    compute the cycle's windowed % + breakdown        (same F5 scope-2 formula)
    APPEND the cycle_record  (archive)                ← always first
    reset the live counter to 0                       ← only after the archive commits
    start the next cycle at the next calendar boundary of the current cadence
```

A **mid-cycle cadence change takes effect immediately**: the in-progress cycle is
finalized on the spot as a possibly-short record, the counter resets to 0, and a fresh
cycle begins under the new cadence running to that cadence's next natural boundary. The
archive **always** precedes the zeroing — non-punitive, nothing is lost. A failure at a
boundary leaves the system coherent (either archived-and-reset, or intact to retry) —
never a lost value, never a double archive.

**The reset touches nothing lifetime:** lifetime XP/level (F13), the tenure clock and every
earned tenure badge (F29), and all-time consistency (F5/F28) are never reset by a cycle
boundary. This is the sole deliberate, non-punitive exception to the no-reset constraint —
a cycle-scoped tally, not a breakable streak.

### `entitlement` — singleton (F17/F18)

`(id=1, source TEXT CHECK IN ('none','subscription','byo-key'), plan TEXT NULL CHECK IN
('monthly','annual'), status TEXT CHECK IN ('none','trial','active','expired'),
renews_on LocalDate NULL, trial_ends_on LocalDate NULL, has_byo_key INTEGER,
byo_supports_transcription INTEGER, updated_at Instant)`.

This is a **cache of the store's own answer**, not a source of truth and not an account.
It is refreshed from StoreKit / Play Billing on launch, on foreground, and after any
purchase or restore. There is no user id anywhere in it. The BYO key itself is never here.

### `assistant_conversation` / `assistant_message` (F16)

`assistant_conversation (id PK, started_at, updated_at, modality TEXT CHECK IN
('voice','text','voice+text'), summary TEXT, task_ids_touched TEXT JSON)`
`assistant_message (id PK, conversation_id FK ON DELETE CASCADE, role TEXT CHECK IN
('user','assistant'), text TEXT, tool_calls TEXT JSON, created_at)`

Stored locally so S34/S35 can browse and reopen. Erased by F25 with everything else.

---

## 9. Migrations, backup, erase

**Versioning.** SQLite's `user_version` is the schema version. Migrations are numbered,
forward-only, and each runs in a single transaction; a failure rolls back fully and the
store reports `STORE_CORRUPT` → S50. Migration 1 creates every table above **and** writes
`tenure_anchor_date = today()`. F1 requires a tested older-version fixture that opens
without data loss — that fixture is mandatory in M1's test suite.

**Backup artifact (F19) — PINNED.** A single JSON envelope, written with
`expo-file-system` and handed to the OS share/document picker:

```jsonc
{
  "format": "fallback-backup",
  "formatVersion": 1,
  "schemaVersion": 3,          // illustrative — write the live CURRENT_SCHEMA_VERSION
  "createdAt": "2026-07-16T08:03:11.412Z",
  "tables": { "settings": [...], "task": [...], "step": [...], "day_log": [...],
              "off_day_mark": [...], "as_needed_use": [...], "xp_award": [...],
              "achievement_unlock": [...], "cycle_record": [...], "cycle_state": [...],
              "widget_config": [...] }
}
```
Filename `fallback-backup-<ISO-date>.fallbackbak`. **The BYO key, the store receipt and
the entitlement row are excluded** — a backup must never carry a secret or a purchase
credential. Restore is transactional into a staging schema and swapped atomically; a
failed restore leaves existing data **untouched** and lands in the non-destructive failure
state (S47's inline banner), never a partial write.

**Restore validation must accept a NULL `xp_award.task_id`.** It is a legal, expected state
(§2.3 — the award outlived its task), not a broken reference. Do not drop, rewrite or
zero those rows on restore; do not fail the restore over them.

**Erase-all (F25).** Closes the connection, deletes the database file, deletes every
SecureStore key, clears widget snapshot files and backup metadata, then recreates an empty
schema — as one guarded sequence. Fully erased or fully intact, never half-wiped. The
post-erase result **is** the app's global empty state. Relaunch is still empty. Erase on an
already-empty store is a no-op landing at the empty state, never an error. Purely local:
no network call, no server copy exists.

---

## 10. Entity relationship summary

```
settings (1) ─────────────── singleton, wiped by F25
cycle_state (1) ──────────── singleton
entitlement (1) ──────────── singleton (cache of the store's answer)

task 1──n step                         (ideal + fallback; due_weekdays = F23/F24 subset)
task 1──n day_log                      (unique per date; chip + step detail + doses)
task 1──n off_day_mark                 (task-grain; whole-day marks have task_id NULL)
task 1──n as_needed_use                (F27, reference-only, read by S23 alone)
task 0──n xp_award                     (unique per occurrence; cycle_id stamps the cycle;
                                        ON DELETE SET NULL — awards OUTLIVE their task)

achievement_unlock ──────── keyed by catalogue key, upsert-only
cycle_record ───────────── append-only; every finalized cycle, permanently

assistant_conversation 1──n assistant_message
widget_config ──────────── one row per widget size
```

Every persisted entity above is **sync-touching**: F20 replicates the whole store as one
snapshot, so any new table a builder is tempted to add is an architect change request.
