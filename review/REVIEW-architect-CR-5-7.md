# Review — Architect CRs 5–7 (pass 1)
VERDICT: CHANGES_REQUIRED

Scope: commit `9183d2c` ("Architect CRs 5-7 from wave-2 code review") — architect-applied
cross-module changes touching `app/_layout.tsx` (M0), `src/db/**` (M1),
`src/features/assistant/**` + `app/assistant/**` (M6), `src/types/settings.ts`,
`src/queries/testSupport/fakeRepos.ts`, and docs (SCHEMA/API/MODULES).

**Headline: all three CRs are substantively correct, and every architect claim I could
execute checks out — both bridges are genuinely idempotent, the migration is valid SQLite
and exercised against v2 fixtures, `patch` merges `assistant` field-wise exactly like
`notifications`/`sync`, `eraseAll`'s key list now matches `secureKeyStore.ts` key-for-key
(all four keys, none missed), the old in-process prefs module is fully gone with zero stale
imports, and the suite/tsc numbers reproduce exactly as claimed. What blocks this pass is
one thing: the pre-v4-backup-restores-cleanly guarantee is asserted three times in
normative artifacts by this very commit and has zero covering tests.**

---

## Blocking items

### B1 — The "a pre-v4 backup still restores" contract has no covering test
`src/db/migrations/004_assistant_voice_language.ts:10-13`, `docs/SCHEMA.md` §9
(lines 864-866), `docs/MODULES.md` CR-6 — all three state that an older envelope whose
`settings` row lacks `assistant_language`/`assistant_voice` restores cleanly because
`applyBackupEnvelope` inserts only the columns the file carries.

I verified the mechanism by reading `src/db/backupEnvelope.ts:173-183`: the INSERT column
list is built per-row from `Object.keys(row)`, so a missing column is simply omitted and
SQLite fills the migration's NOT NULL DEFAULT. The claim is **true today**. But it is
**tested nowhere**: every restore-success test in `src/db/__tests__/backupRestore.test.ts`
round-trips an envelope built by `store.backup()` at the CURRENT schema version (lines
83-115, 121-166), and the only handcrafted envelopes in the file are rejection cases
(lines 172-239). A future "cleanup" that normalizes rows to a fixed column list — or a
migration 5 that adds a column WITHOUT a default — would silently break every pre-existing
backup file, and this suite would stay green.

This codebase's own standing rule (SCHEMA §9: "F1 requires a tested older-version fixture")
is that compatibility guarantees get pinned by tests; the migration fixtures
(`migrations.test.ts:32`, `crFourSnoozeMigration.test.ts`) honor it for `open()`, and this
commit introduces the equivalent guarantee for `restore()` without the equivalent pin.

**Fix:** one test in `backupRestore.test.ts` restoring a handcrafted valid envelope
(`schemaVersion: 3`, singletons present) whose `settings` row carries the full **v3**
column set but neither `assistant_*` column.
**Acceptance test:** `store.restore()` succeeds; `repos.settings.get()` afterwards returns
`assistant: { language: 'en-US', voice: 'warm' }` (the migration-4 defaults) and the
envelope's other settings values (e.g. a non-default `theme`) intact.

## Non-blocking notes

1. **`OptionsSheet.tsx:53-64` — `pending` is never cleared, so a FAILED save leaves the
   sheet displaying the unsaved value indefinitely.** The override-until-persisted pattern
   correctly fixes the stale-initializer bug (verified — see below), and the "Saved" toast
   is honestly gated on `result.ok` (`chat.tsx:81-86`). But on `save() → false`, `pending`
   keeps masking the persisted value for as long as S32 stays mounted, including across
   sheet close/reopen (the `Dialog` is visibility-toggled, not unmounted), with only the
   one-time warning toast as a cue. Suggest clearing `pending` when the save resolves
   false (snap back to the persisted value). Failure path only, so not blocking.
2. **Stale "CONTRACT GAP" comments now contradict CR-5.**
   `src/services/notifications/index.ts:210-215` still says "nothing currently calls this
   at app boot … needs an architect change request", and
   `src/services/widgets/index.ts:124-126` still says it "needs the same architect-owned
   `app/_layout.tsx` boot hook to run". Both are resolved by this very commit. Misleading
   for the next agent; delete or mark resolved.
3. **CR numbering collides.** In-code comments label these changes "Architect CR-1/CR-2/
   CR-3" (`app/_layout.tsx:63`, migration 004, `lifecycle.ts`, tests) while
   `docs/MODULES.md` names them CR-5/6/7 — and the CR-1..CR-4 namespace is already taken
   by the post-wave-1 series (`crFourSnoozeMigration.test.ts` cites "CR-4 (docs/MODULES.md
   top matter)"). MODULES.md acknowledges the STATE.md "1/2/3" alias, but a reader landing
   on "CR-2" in migration 004 will find a DIFFERENT CR-2 in MODULES.md's earlier series.
4. **`app/assistant/chat.test.tsx:117-127` — cross-test mutable fixture reset at the end
   of the test body.** `mockSettings.current` is restored on the last line of the `it`; if
   any assertion above it fails, the reset never runs and pollutes later-added tests.
   Belongs in `beforeEach`/`afterEach`.
5. Jest prints "A worker process has failed to exit gracefully" — pre-existing (not
   introduced by this commit), noting for the record.

## Verified

- **Read the full diff** (`git show 9183d2c`, 17 files) plus current state of every
  touched source file and doc.
- **CR-5 idempotency:** read both inits — `src/services/notifications/index.ts:216-218`
  and `src/services/widgets/index.ts:128-130` guard on a module-level `bridgeInitialized`
  and return a no-op disposer on repeat calls. Genuine.
- **CR-5 remount/teardown reasoning:** `ErrorBoundary` is INSIDE `AppShell`
  (`app/_layout.tsx:76-78`), so an error-boundary reset cannot remount the shell; dev Fast
  Refresh re-runs are absorbed by the guard. Checked every other call site (S06, S07, S41,
  S42, S46 — `app/settings/{index,notifications,widgets}.tsx`,
  `src/features/onboarding/{PersonalizeScreen,NotificationsPrimerScreen}.tsx`): all
  call-and-discard the disposer, so even when a child screen's effect wins the init race
  against the parent shell's (React runs child effects first), the real disposer is
  discarded and the bridge stays armed for app lifetime. No double-registration, no
  accidental teardown path.
- **CR-5 ordering:** the shell effect subscribes both bridges synchronously on mount;
  `store:ready` is emitted only after `useAppBootstrap`'s async `open()` resolves, i.e.
  after subscription. The inits' immediate `void publishSnapshot()` / `void reschedule()`
  are try/catch-wrapped `Result` returns (`widgets/index.ts:96-98`,
  `notifications/index.ts:73-74`), so a pre-open call cannot unhandled-reject.
- **CR-6 migration:** two `ADD COLUMN ... NOT NULL DEFAULT '<const>'` statements — valid
  SQLite (constant default satisfies the NOT-NULL-requires-default rule; no
  PK/UNIQUE). Multi-statement `up` runs via `execAsync` → `node:sqlite` `exec()` in the
  test double (`expoSqliteTestDouble.ts:38-40`) and real expo-sqlite's `execAsync`, both
  multi-statement-capable. Existing-database path exercised: `crFourSnoozeMigration.test.ts`
  opens v2 fixtures that migrate 3→4; `migrations.test.ts:32` covers v1. `schema.sql`
  reference DDL matches the migration exactly.
- **CR-6 merge pattern:** `settingsRepository.ts:139-146` — `assistant: {
  ...merged.assistant, ...patch.assistant }` sits exactly beside the `notifications`/`sync`
  spreads inside the existing read-merge-write transaction; partial patches preserve
  untouched fields, and the new repositories test asserts neighbor non-disturbance.
- **CR-6 backup/restore mechanism:** read `applyBackupEnvelope`
  (`backupEnvelope.ts:162-193`) — per-row `Object.keys` column lists, so absent columns
  fall back to migration defaults. Claim true; coverage missing (B1).
- **CR-6 hook pattern:** `useVoiceLanguagePrefs` composes only `useSettings()` +
  `useUpdateSettings()` from `@/queries` — no new query hook, no `@/db` import, no module
  state. `useUpdateSettings().mutateAsync` resolves with a `Result` (mutationFn
  `mutations.ts:728-739` returns `err(...)` instead of throwing), so `save() → result.ok`
  → conditional toast is sound. Grepped `getVoiceLanguagePrefs|setVoiceLanguagePrefs`
  repo-wide: zero matches — old module fully replaced, no dead code.
- **CR-6 stale-initializer fix:** `OptionsSheet.tsx:53-55` derives display from
  `pending ?? voiceLanguage` prop per render — the persisted prop shows through once the
  query resolves, unlike a `useState` initializer. The new chat test pins this by seeding
  the mock with non-default `'calm'` and asserting `'Voice, Calm'` renders, then asserting
  `useUpdateSettings` is called with the exact `{ assistant: { language, voice } }` patch.
  Both claimed tests are real and assert behavior (chat.test.tsx:113-128,
  repositories.test.ts:195-206 — the latter re-opens the store to prove durability).
- **CR-7 completeness:** read all of `src/services/ai/secureKeyStore.ts` — exactly four
  key constants (`byo.baseUrl`, `byo.apiKey`, `byo.supportsTranscription`, `byo.model`),
  no other `SecureStore` key usage in that file; `lifecycle.ts:34`'s list matches
  key-for-key. (M7's onboarding resume pointer is a separately-owned SecureStore key,
  handled by M7's own `store:erased` consumer per its review — correctly out of scope for
  this list.) `lifecycle.test.ts:86-97` asserts all four are deleted.
- **Docs accuracy:** SCHEMA §1 (columns/defaults/open-set note), §9 (migration 4, erase-all
  key rule), API §1/§1.1/§3/§8 all cross-checked against the code above — accurate.
- **Spec fidelity:** ALLSCREENS_1.md S36 ("persists immediately (F16 setting) with a calm
  Toast ('Saved')", closed-set pickers, expanded labels) — persistence now real, toast
  gated on the actual write landing, UI option lists remain the closed set while storage
  stays open per SCHEMA's stated rationale.
- **Commands run:** `npx tsc --noEmit` → exit 0, clean. `npx jest` → **99 suites passed,
  695 tests passed** (matches claim). `cd server && npm test` → **23 pass / 0 fail**
  (matches claim).
