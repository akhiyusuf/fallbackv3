# Review — F7 rescope implementation: M2 (domain/queries) + M1 (db migration) (pass 1)
VERDICT: CHANGES_REQUIRED

Scope: commits `39b50e3` (M2) and `c02ce77` (M1), reviewed together against
`docs/PRD.md` §3.7, `docs/SCHEMA.md` §4.2/§9, `docs/MODULES.md` CR-4, and the two
binding advisor rulings (`review/ADVICE-PRD-F7.md`, `review/ADVICE-SCHEMA-F7.md`).
Nothing here relitigates either advisor ruling; all three blocking items are
enforcement of the pinned contract, not new taste.

Overall: this is strong work. The migration's four-branch SQL is correct against
every shape I could construct, the runtime carrier discipline held up under
adversarial grep, and three of my four deliberate sabotage mutations of the
migration were caught by exactly the fixture SCHEMA designed for each. The three
blocking items are: one genuine runtime defect (denominator fabrication through a
non-carrier-routed snooze guard), and two test gaps against pinned case/branch
tables — the same non-probative-fixture defect class that already cost this
cascade a review pass and an advisor escalation at spec time.

---

## Blocking items

### 1. (M2 — defect, worst first) `snoozeOccurrence`'s W-1s guard is not carrier-routed: snoozing a visitor-carried date fabricates a `day_log` row born with a pointer and turns ONE real occurrence into TWO displayed `missed` days

`src/queries/mutations.ts:634-644`. The mutation resolves due-ness at `D`
(`resolveOneOccurrence`, line 634) and then checks "already snoozed" against
`ownLog(D).movedToDate` only (lines 641-644). When the occurrence resolving at
`D` is a **visitor** (clause c — its own row lives at `D − 1` and is already
snoozed), all three W-1s checks pass: the visitor's outcome is not `not-due`,
`task.snoozable` is true, and `ownLog(D)` is absent. The write at lines 649-660
then **creates a fresh `ownLog(D)` with `movedToDate = D + 1`** — a row for an
occurrence that does not exist.

Reproduced against the real mutation functions (probe since deleted; task due
**only** Wed 2024-06-05, then `snooze(D3)` → ok, then `snooze(D4)` — the viewed
date, not the occurrence's own date):

```
second snooze result: ok:true
rows: [ {date: 06-05, movedToDate: 06-06}, {date: 06-06, movedToDate: 06-07} ]  ← fabricated
occurrences: [ 06-05 not-due, 06-06 MISSED, 06-07 MISSED ]                       ← one task
                                                     occurrence, TWO missed days
```

Consequences: F5 denominator inflated (the % drops — a direct violation of the
non-punitive doctrine), a `day_log` row born with a pointer for a nonexistent
occurrence, and "no occurrence is ever more than one day from its own date"
(PRD §3.7 / C13's invariant) violated in spirit — the *displayed* occurrence at
`D` was already snoozed, and PRD rendering 3 says its slot must read "Undo
snooze". No XP is fabricated (the rows are blank), so this is denominator
corruption, not ledger corruption.

Why this is blocking and not a caller-contract shrug: (a) SCHEMA §4.2's standing
principle — a bare date-keyed **write** of `day_log` in snooze logic is
presumptively a blocking defect unless carrier-routed, and this upsert consults
no carrier; W-2's "upsert ownLog(D)" sanction holds only under the preamble's
"D is the occurrence's OWN date", which this call path does not establish;
(b) C13 sets the explicit precedent that the sibling direct-call shape must be
`VALIDATION_FAILED, zero writes` — the mutation layer is required to be
defensive here, not just the UI; (c) the P1-P7 enumeration *executes* this exact
sequence today (`[snooze(D3), snooze(D4)]` over the 5-date domain) and its
invariants are blind to it — P7 only asserts pointer targets resolve non-not-due,
and P2 (`numerator = denominator − missed`) is true by definition even on a
fabricated denominator.

**What good looks like:** W-1s's "already snoozed" precondition evaluated against
the carrier the R-rules designate at `D` — i.e. reject when
`designateCarrier(D).kind === 'visitor'` (the displayed occurrence's own row is
at `D − 1` and its pointer is non-null by construction), keeping
`designateCarrier` the single answerer rather than adding a fourth ad-hoc check.
**Acceptance test:** the probe sequence above returns
`{ok: false, VALIDATION_FAILED}` with zero rows written; add it as a named
regression test (it is the C13 shape reached through the viewed date); ideally
extend section (a)'s invariants with a denominator-conservation check so the
enumeration would have caught this class.

### 2. (M2 — required test missing) C4r is not actually tested: the test labeled "C4r" undoes from a case-**2** target, not the case-**1** target SCHEMA pins

SCHEMA §4.2's case table, C4r row: "**undo from a case-1 target** — clears
`ownLog(D)` only; D due again with prior data; **D+1's own occurrence
untouched** — exact restore", and the table's own header: "each row is a
required test."

`src/queries/moveSemantics.test.ts:231` claims C4r inside the C4b test — but
that undo runs against a naturally-due, never-logged `D + 1` (case 2). The only
undo against a target that *has* its own live row is C9's final step
(`moveSemantics.test.ts:377-383`), where the target's own row is **blank** with
**no award** — so the load-bearing half of C4r (undo's `reconcileOccurrence(τ,
D+1)` must leave the target's own *logged* data and its *existing award*
untouched — row byte-unchanged, award `id`/`cycle_id` unchanged) is asserted
nowhere. A bug in the target-side reconcile that clobbers or re-stamps the
host's award would pass every current test.

**What good looks like:** C4's exact fixture (daily task; log `D2 'fallback'`;
log `D1 'done'`; snooze `D1`) + `undo(D1)`, asserting: `D1` back to
`ideal`/`'done'` with its award re-affirmed at `D1`; `D2`'s `day_log` row
byte-identical to its pre-undo snapshot; `D2`'s award still present with its
original `id`, `kind`, `amount`, `cycle_id`; exactly two awards total.

### 3. (M1 — required branch has no discriminating test) Deleting the migration's entire B3 block passes all 8 migration tests — B3 is an XP-**inflation** guard with zero regression coverage

Proven by mutation: I removed the whole "Branch B3" INSERT
(`src/db/migrations/003_snoozable_and_one_hop_check.ts:99-109`) and the suite
stayed green (8/8). Cause: in the mixed-C6 fixture, the kill of the kept
visitor's award at B is **doubly** covered — B3 *and* the destination-clear both
enqueue it (B is also the B1 relocation destination for the `(τ, C)` award) — so
destination-clear alone satisfies the fixture. SCHEMA §9's branch-coverage note
("B3 … by mixed C6's `(τ, B)` target") is factually imprecise on this point; the
five pinned fixtures are necessary but not sufficient.

This matters because B3 is the one branch whose absence produces **inflation**:
a kept visitor's award surviving at a `T` whose own (possibly ineligible) row
revives is a leftover award the doctrine forbids ("the residual is an
under-count, never inflation" — SCHEMA §4.2 / §7 carve-out), and unlike the
under-count it does not self-heal unless the user happens to touch `T`. Given
this cascade already burned a review pass (SCHEMA pass 4) on a fixture that
could not distinguish correct from broken, a required decision-table branch with
no discriminating test is not shippable.

**What good looks like:** a sixth fixture — pure B3, no B1 relocation into `T`:
`S = T − 1 → T` KEPT with the visitor's award at `T`; `T`'s own row LONG
(`T → X`, far) with an **ineligible** chip (e.g. `'todo'`, so the surviving
award is unambiguous inflation, not coincidentally re-affirmable) and **no**
award at `X`. Post-migration assert: the `(τ, T)` award **deleted**; `T`'s
pointer cleared; `S`'s KEPT pointer intact. Verify the new test fails when the
B3 block is removed (the mutation I ran). This *adds* to the five pinned
fixtures; it strikes nothing the advisor ruled.

---

## Non-blocking notes

1. `src/queries/testSupport/fakeRepos.ts:63-71` — doc comment for
   `failLogsUpsertAfterCalls` still explains itself in terms of
   `useMoveOccurrence`'s W-3 redirect branch and "C8's double inbound", both
   dead. Doc drift into deleted machinery the contract says not to reintroduce;
   reword.
2. `src/db/migrations/003_snoozable_and_one_hop_check.ts:36` — header says the
   fixtures live in `src/db/__tests__/migrations.test.ts`; they live in
   `crFourSnoozeMigration.test.ts`.
3. CR-4's M2 line says "`validateTaskDraft` defaults `snoozable` to `true`"; the
   default actually lives in `useCreateTask`'s Task construction
   (`src/queries/mutations.ts:354`, `draft.snoozable ?? true`).
   `src/domain/validation.ts` never mentions `snoozable`. Behaviourally
   equivalent (validation doesn't normalize drafts); align the letter one way or
   the other when convenient.
4. `src/queries/internal.ts:80-81 / 97-98 / 131-132` — the movedInLog
   ("inbound") lookup construction is repeated three times. It is plumbing, not
   clause selection, so it is not a single-answerer violation — but extracting
   it would make the "one lookup construction" claim structural instead of
   copy-discipline.
5. `src/queries/mutations.ts:576-577` — `markOffDay`'s `priorChipState` snapshot
   is a bare date-keyed `ownLog(D)` read. This is SCHEMA §4.2's own first-listed
   *watch site*, it predates this CR (unchanged in either commit — verified via
   diff), and it is currently inert (nothing restores from `priorChipState`;
   off-resolution is derived). Recording it here so the watch-site trail stays
   warm; not a CR-4 finding.
6. When fixing blocking item 1, consider a denominator-conservation invariant in
   `mutations.invariants.test.ts` section (a): for this fixed-cadence domain, a
   task's resolved non-`not-due` occurrence count must never exceed its natural
   due-date count. P2/P7 as written cannot see fabricated occurrences.

---

## Verified (what I checked and how)

- **Toolchain:** `npx tsc --noEmit` → clean (exit 0). `npx jest` → **39 suites /
  308 tests, all passing** on the clean tree. (One jest worker-teardown warning,
  pre-existing, unrelated.)
- **Scope discipline (item 7):** `git diff --stat 4f40d4f HEAD` — M2 touched only
  `src/queries/**`, `src/domain/**` (+1-line `snoozable: true` fixture updates)
  and the flagged `src/types/task.ts`; M1 touched only `src/db/**`. No other
  files.
- **`src/types/task.ts` touch (item 5):** full diff read — 9 lines, additive
  only (`readonly snoozable: boolean` on `Task`, `snoozable?: boolean` on
  `TaskDraft`), text matching CR-4's M0 spec verbatim, no restructuring. **No M0
  re-review needed.** (Formally CR-4 assigns this edit to M0; M2 carried it —
  recorded, accepted as the coordinator's explicit CR-4 arrangement.)
- **Single-answerer discipline (item 1 of the brief), adversarially:** grepped
  every non-test use of `movedToDate` / `listForTask` / `listRange` /
  `listXpAwards` across `src/domain/**` + `src/queries/**`. Clause selection
  exists exactly once (`src/domain/dayState.ts:133-144`); `resolveOccurrence`
  (read) and `resolveWriteTarget` (write, `internal.ts:126-141`) both consume
  it; `reads.ts` touches `day_log` only through `resolveTaskOccurrences` /
  `resolveAllOccurrences`. The second `movedToDate === null` check in
  `undoSnooze` (`mutations.ts:691`) is confirmed a legitimate W-1u precondition
  (pointer-null ⇒ nothing to undo) — it reads one pointer, it does not select a
  carrier; the coordinator's judgment call stands. The `reconcileOccurrence`
  award lookup keyed `(taskId, date)` (`mutations.ts:255`) is the ledger's own
  sanctioned key (T-3: awards key on the displayed date), not a carrier bypass.
  The one place the discipline actually breaks is blocking item 1's *write*.
- **Runtime ↔ migration outcome consistency, hand-traced on two non-trivial
  shapes:** (a) **mixed C6** — post-migration rows (A→B KEPT, B live with data,
  single award `award-C` at B): runtime `designateCarrier(B)` → `own-live`
  (clause a) ⇒ B's own data carries, award at `(τ,B)` — agrees; A reads
  `none`/vacated, C rowless not-due — agrees. (b) **C8-b** — post-migration
  (S2→T KEPT, award left at T, T rowless/non-natural): runtime at T →
  `movedInLog = S2`, `log = null`, `natural = false` ⇒ clause (c) visitor ⇒ the
  award at `(τ,T)` is exactly what reconcile would affirm — agrees. The two
  independently-implemented answerers concur.
- **Migration mutation testing (fixtures are probative — items 2 and 3 of the
  brief):** four sabotage mutations applied to `003_…ts`, migration suite run,
  file restored via `git checkout` each time (final `git status` clean):
  - **A. pointer-clearing hoisted before the worklist build** → V, C8-a and
    mixed-C6 **fail** (3/8). The step-5-after-steps-1-4 ordering is load-bearing
    and observably pinned, exactly as the advisor escalation demanded.
  - **B. carrier scan over LONG rows only** → C8-b alone **fails**, exactly the
    divergence SCHEMA §9's "Why C8-b pins S1 < T−1" predicts. The pass-4 fixture
    repair is genuinely probative.
  - **C. unconditional relocation (B1's `live(T)` guard dropped)** → fixture M
    alone **fails** — the award-theft shape is caught.
  - **D. entire B3 block deleted** → **8/8 pass** ⇒ blocking item 3.
- **Migration SQL vs SCHEMA §4.2 predicates, line-by-line:** `LONG`/`KEPT`/
  `live`/`inbound`(over **all** pointers, KEPT included)/`carrier`(=`MAX(date)`
  per `(task, target)`)/`revived` all match; B1/B3/destination-clear WHERE
  clauses match the decision table including the A-branch residue subtlety (a
  KEPT-residue own row at T does not count as `live`); DELETE(KILL + RELOC
  sources)-then-INSERT, never UPDATE (all three DML statements checked);
  snapshot preserves `id`/`kind`/`amount`/`cycle_id`/`created_at` (asserted in
  fixture V, line 116); only LONG pointers cleared (C8-b asserts the KEPT
  pointer survives); rebuild DDL compared column-for-column against
  `001_initial.ts` — identical plus the one-hop CHECK, both indexes recreated,
  FK re-asserted by test; `schema.sql` updated in sync; runner
  (`src/db/migrate.ts`) wraps each migration in one transaction. NULL-`task_id`
  awards untouched (worklists join through `day_log.task_id`, NOT NULL).
- **C5 inversion (item 4):** `moveSemantics.test.ts:245-292` matches SCHEMA's C5
  row exactly — case-1 merge first (dormant, lifetime dips 16→6, asserted), then
  the host's own snooze onward, then **revival** (`D2` reads `ideal`/`'done'`
  from the visitor's data) **and re-materialisation** (award at `D2` back at
  10/`ideal`, host's data + fresh award at `D3`, lifetime back to 16). The
  ordering, the revival and the award are all asserted, not just the setup.
- **13-case suite:** C1, C4, C4b, C6, C7, C9, C10, C11, C12, C13, C14 all
  genuinely end-to-end through `useSnoozeOccurrence`/`useUndoSnooze`/
  `useLogState` + real reads, with byte-identity and zero-event assertions where
  the table demands them; C4b's no-award assertion is explicit
  (`xpAwards()).toHaveLength(0)` + lifetime 0). C4r is the exception — blocking
  item 2. Dead cases C2/C3/C8 absent, as required.
- **W-1s/W-1u/W-2/W-3 conformance:** snooze rejects not-due / non-snoozable /
  already-snoozed (C13, C14 tests); undo rejects **only** pointer-null, ignores
  `snoozable` (C14's second half proves an already-snoozed task with the flag
  turned off still undoes); both write one row preserving chip/step/dose data;
  both reconcile both dates; `day:logged` emitted once with `D+1` (snooze) / `D`
  (undo). Dead machinery (±60-day guard, same-day guard, redirect-inbound
  branch, tie-break) confirmed absent from source (grep) — only doc-comment
  references remain (non-blocking note 1).
- **Enumeration suite:** counts asserted inside the tests themselves (1,110 and
  550, `mutations.invariants.test.ts:241,340`); P1 read-back equality, P4
  award uniqueness, P6 single-emit, P7 pointer sanity, P8 residue immutability
  all real assertions against the fakes' row snapshots.
- **CR-4 repository work:** `snoozable` mapped in `taskRepository.ts` (row↔type,
  insert, update, duplicate-by-spread); covered by
  `repositories.test.ts:64-79` — default true, round-trip, edit to false,
  duplicate inherits false.
- **Dormant-undo reachability gap (item 6):** grepped for any invented
  surface — no new read hook enumerates snoozed/dormant occurrences, no
  navigation or UI resolution anywhere in either commit; `@/queries` exports
  only reads + the documented mutations. Both builders left PRD §7's open
  decision genuinely open.
- **Error handling:** every repo write's `Result` checked before proceeding in
  both new mutations; fail-injection tests cover snooze/undo single-write
  failure + retry (`mutations.invariants.test.ts:425-453`).
