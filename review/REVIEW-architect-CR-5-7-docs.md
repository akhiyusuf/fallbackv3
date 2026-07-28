# Review — Architect CR-5/6/7 documentation updates (SCHEMA.md §1/§9, API.md §1/§1.1/§3/§8, MODULES.md post-wave-2 section) (pass 1)
VERDICT: CHANGES_REQUIRED

Scope per the coordinator's brief: the documentation portions of commit `9183d2c`
(`git show 9183d2c -- docs/SCHEMA.md docs/API.md docs/MODULES.md`), reviewed as
artifacts against `docs/PRD.md` (F16 §3.6, F18, F25) and the approved design under
`design-input/` (PROJECT OVERRIDE per `CLAUDE.md`): `ALLSCREENS_1.md` S32 (line 3153 ff.)
and S36 (line 3489 ff.). Code cross-checks (migration 004, `settingsRepository.patch`,
`lifecycle.ts`, `secureKeyStore.ts`, `voiceLanguagePrefs.ts`, `OptionsSheet.tsx`,
`app/_layout.tsx`, `backupEnvelope.ts`) were read to verify the docs' factual claims,
not to review the code — the code already cleared its own wave-2 loop.

**The technical content is accurate.** Every factual claim in the three docs checks out
against source and design (details in Verified). What fails is traceability: this commit
introduced a three-way CR-numbering scheme that collides with the *existing, heavily
referenced* CR-1/CR-2/CR-3 series, and MODULES.md — the doc whose job is to reconcile
numbering, and which already reconciles one of the three aliases — is silent about the
worst one. Plus one ownership misstatement that contradicts ARCHITECTURE.md.

## Blocking items

1. **MODULES.md, "Architect change requests applied after wave-2 code review" intro
   (line 337–338) — the CR-number alias to the *source code* is undisclosed, and it
   collides with the live post-wave-1 series.** The intro says the three CRs are
   "Numbered CR-5/6/7 to continue the post-wave-1 series above; `docs/STATE.md` lists
   the same three as '1/2/3'" — but the code comments landed *in this same commit* use a
   third numbering, `architect CR-1/CR-2/CR-3`, which is not mentioned:
   - `app/_layout.tsx:63` — "Architect CR-1 (wave-2 review, M7)" = CR-5
   - `src/db/migrations/004_assistant_voice_language.ts:2,23`, `src/types/settings.ts:23,74`,
     `src/db/repositories/settingsRepository.ts:76`, `src/db/schema.sql:27–28`,
     `src/features/assistant/voiceLanguagePrefs.ts:5`, `OptionsSheet.tsx:23`,
     `repositories.test.ts:195` — "architect CR-2" = CR-6
   - `src/db/lifecycle.ts:25`, `lifecycle.test.ts:89` — "Architect CR-3" = CR-7

   These collide head-on with MODULES.md's own top-matter CR-1 (cycle_state accessor),
   CR-2 (XP award retraction — also referenced as "CR-2" throughout SCHEMA.md §4.2/§7,
   lines 459/513/664, and across `src/queries/mutations.ts`, `progressRepository.ts`,
   `types/ports.ts`) and CR-3 (F7 snooze contract). A fresh agent reading migration 004's
   header "architect CR-2" and looking CR-2 up in MODULES.md lands on "add XP award
   retraction to `ProgressRepository` (M0)" — a flat mismatch, in the one document that
   claims to be the CR numbering authority. *Fix:* add one sentence to the section intro
   disclosing the third alias, e.g. "Source comments from the applying commit label these
   `architect CR-1/CR-2/CR-3 (wave-2 review)` — those refer to CR-5/CR-6/CR-7 here, NOT
   to the post-wave-1 CR-1/CR-2/CR-3 in the top matter." (Renumbering the code comments
   instead would also resolve it, but that is a code change outside this review; the doc
   must not leave the collision silent either way.) *Acceptance test:* a reader who greps
   `CR-2` in `src/`, hits migration 004, and opens MODULES.md finds an explicit
   disambiguation before reaching the post-wave-1 CR-2 section.

2. **MODULES.md CR-5 heading (line 342) — "(architect-owned `app/_layout.tsx`)"
   contradicts ARCHITECTURE.md's ownership rules.** ARCHITECTURE.md line 151:
   "`app/_layout.tsx` is M0's and **no other module may edit it**"; line 583:
   "`app/_layout.tsx` and `app/(tabs)/_layout.tsx` are **M0-owned**, not frozen …
   No other module may edit them." STATE.md's CR list (line 531) likewise says
   "M0-owned, frozen". File ownership is load-bearing in this pipeline (parallel
   builders, "two builders must never own the same file"), and MODULES.md is the
   ownership-defining document — it must not casually reassign a file the architect
   edited *once, as a sanctioned cross-module CR* (which the section intro already
   explains correctly). *Fix:* reword the heading/text to something like "boot-time
   bridge wiring in the app shell (M0-owned `app/_layout.tsx`; edited directly by the
   architect as a cross-module CR)". *Acceptance test:* no statement in MODULES.md
   assigns `app/_layout.tsx` to anyone but M0; the architect's one-time edit is framed
   as the CR mechanism, matching the intro paragraph and ARCHITECTURE.md §11.

## Non-blocking notes

- **API.md §3 (line 212–214):** "there is NO separate voice/language hook or store" is
  true of the query layer (§3's scope) but reads as a repo-wide claim, and
  `src/features/assistant/voiceLanguagePrefs.ts` exports `useVoiceLanguagePrefs()` — a
  feature-layer convenience hook MODULES.md CR-6 itself documents. Suggest "no separate
  *query-layer* hook or storage — M6's `useVoiceLanguagePrefs()` is a thin composition
  of these two" next touch. Not blocking: MODULES.md CR-6, cross-referenced in the same
  commit, resolves the apparent conflict for a careful reader.
- **MODULES.md line 370:** "This closes wave-2 contract gap 5's sibling" is a dangling
  pointer — "contract gap 5" resolves ambiguously (REVIEW-M4.md has contract gaps
  5a–5c; REVIEW-M6.md pass-2 note 5 is the voiceLanguagePrefs item itself), and read
  against REVIEW-M6.md the sentence's direction is inverted (CR-6 closes note 5 itself;
  the still-open `conversationStore.ts` gap — REVIEW-M6.md pass-1 note 14 — is the
  sibling). The operative fact ("`conversationStore.ts` … unchanged and still open") is
  stated explicitly, so no agent can act wrongly; name the review file and note number
  next touch.
- **API.md §1.1 eraseAll row:** the CR-7 clause ("Clears **every** SecureStore key
  listed in `secureKeyStore.ts`") is behavior documentation placed in the *Errors*
  column of an errors table. Accurate, slightly misfiled; fine to leave.
- **CR-5 / ARCHITECTURE.md:** confirmed no ARCHITECTURE.md update is strictly required.
  §4.4 (event bus) remains accurate and non-contradictory; API.md §8 is the normative
  bridge contract and now carries the boot-call-site rule. Optional next touch:
  §11's line 583 description of what M0 "wires" in `_layout.tsx` (theme/accent) now
  understates the shell's responsibilities and could cross-reference API §8.
- **SCHEMA.md line 924–927:** the CR-7 insertion produces one long em-dash-nested
  sentence ("deletes every SecureStore key — **every one**: … — clears widget snapshot
  files"). Dense but parseable; style only.

## Verified

- **Migration accuracy (SCHEMA §1/§9 vs `src/db/migrations/004_assistant_voice_language.ts`):**
  exactly two `ALTER TABLE settings ADD COLUMN` statements, `assistant_language TEXT NOT
  NULL DEFAULT 'en-US'` and `assistant_voice TEXT NOT NULL DEFAULT 'warm'`, version 4,
  registered in `migrations/index.ts` (making `CURRENT_SCHEMA_VERSION` = 4; reference
  `schema.sql` header bumped to v4 in the same commit). No CHECK constraint, no table
  rebuild — all exactly as SCHEMA §1's two new rows and §9's Versioning paragraph state.
  Column position in SCHEMA §1's table (after `notif_digest_time`, before
  `sync_enabled`) matches `schema.sql` and the repository's `SETTINGS_COLUMNS` order.
- **Backup-compat claim (SCHEMA §9):** `backupEnvelope.ts:173–181` builds the INSERT
  column list from `Object.keys(row)` per row — a pre-v4 envelope whose settings row
  lacks the two keys inserts without them and SQLite fills the NOT NULL defaults. Claim
  verified true, not just plausible.
- **API contract accuracy (API §1/§3 vs source):** `Settings.assistant: AssistantPrefs`
  ({ language, voice }, both `string`) exists in `src/types/settings.ts:32–35,75`;
  `settingsRepository.patch` (line 143) merges `assistant: { ...merged.assistant,
  ...patch.assistant }` — field-wise, literally "exactly like `notifications` and
  `sync`" (lines 142, 144) as both API §1 and MODULES CR-6 claim. Read side is
  `useSettings().data.assistant`; write side `useUpdateSettings({ assistant })`
  (`voiceLanguagePrefs.ts:33–36`). Round-trip and default tests exist
  (`repositories.test.ts:195`).
- **CR-5 accuracy (API §8 vs source):** `initNotificationsBridge` is idempotent via a
  `bridgeInitialized` guard and returns a no-op disposer on second call
  (`src/services/notifications/index.ts:201,216–218`); `app/_layout.tsx:65–68` calls
  both bridges once from an `AppShell` `useEffect` with no teardown returned. API §8's
  "single boot-time call site … a call after the shell's is a no-op" and MODULES CR-5's
  prose (including "the second call returns a no-op disposer") are accurate.
- **CR-7 accuracy (SCHEMA §9 / API §1.1 vs source):** `lifecycle.ts:33`
  `SECURE_STORE_KEYS = ['byo.baseUrl', 'byo.apiKey', 'byo.supportsTranscription',
  'byo.model']` exactly mirrors `secureKeyStore.ts:24–27` key-for-key. The four keys
  enumerated in SCHEMA §9 match both files. Erase test exists (`lifecycle.test.ts:89`).
- **Design fidelity (S36, `ALLSCREENS_1.md:3489–3554`):** persisted values map cleanly
  to the design — default `'en-US'` ↔ copy "English (US)", default `'warm'` ↔ "Warm —
  default"; `OptionsSheet.tsx:29–33` offers exactly the design's example set
  (`warm`/`calm`/`direct` ↔ "Warm — default"/"Calm"/"Direct") as stable ids with
  display labels in `copy.ts` (verbatim-copy rule respected). S36's "persists
  immediately (F16 setting) with a calm Toast ('Saved')" is precisely the requirement
  CR-6 satisfies; S32 as the owning screen passing the value down matches S36 being a
  sheet "within /assistant/*" with no route of its own.
- **The no-CHECK-constraint call — judged reasonable, not a design violation.** S36
  specifies "closed-set pickers" as *UI* behavior, and its option lists are explicitly
  illustrative ("e.g. …"). Pinning `('warm','calm','direct')` into a CHECK would freeze
  an example list into the storage layer and force a migration per added voice —
  disproportionate for a cosmetic preference with a documented, non-corrupting
  degradation path ("picker shows no selection", consistent with a Select whose value
  matches no option). The closed set stays enforced where the design places it: the
  picker. SCHEMA §1's contrast with the genuinely closed sets (`theme`, `accent`,
  `cycle_cadence`) is stated explicitly rather than left implicit. No change requested.
- **No contradictions with frozen wave-1/wave-2 content:** SCHEMA §1's untouched rows,
  §9's fixture requirements (F7-rescope shapes), the BYO "not stored here" paragraph
  (still consistent with the expanded key list), API §1.1's other lifecycle rows, and
  MODULES.md's post-wave-1 CR-1–CR-4 sections are all unmodified and remain consistent
  with the new text — except the two numbering/ownership items above. STATE.md's
  "1/2/3" alias claim (MODULES line 338) verified against `docs/STATE.md:527–543`.
- **PRD:** F16 (§3.6) does not itself pin voice/language persistence; the requirement
  originates in the approved design (S36 "persists immediately") — the docs cite F16/S36
  as the source, which is the correct provenance under the PROJECT OVERRIDE.

---

# Review — Architect CR-5/6/7 documentation updates (pass 2)
VERDICT: PASS

Scope: fix commit `88b534a`, reviewed against this file's pass-1 blocking items, plus
`docs/ARCHITECTURE.md` §4.2/§11, `docs/MODULES.md` top matter, and the actual code the
docs now cite (`src/db/__tests__/backupRestore.test.ts`, migration 004, the renamed
comment sites).

## Blocking items

None.

## Pass-1 blocking items — resolution verified

1. **CR-number collision — RESOLVED, by the stronger of the two offered fixes.** The
   architect renumbered every wave-2 in-code label rather than merely disclosing the
   alias: `app/_layout.tsx:63` now reads "Architect CR-5"; migration 004 (header +
   `name` field), `schema.sql:27–28`, `types/settings.ts:23,74`,
   `settingsRepository.ts:76`, `voiceLanguagePrefs.ts:5`, `OptionsSheet.tsx:23`,
   `chat.tsx`/`chat.test.tsx`, `repositories.test.ts:195` all read CR-6;
   `lifecycle.ts:25` and `lifecycle.test.ts:89` read CR-7. Repo-wide grep for
   `architect CR-1/2/3` finds zero stale labels in code — the only remaining hits are
   this review file, `REVIEW-architect-CR-5-7.md`, and MODULES.md's new disambiguation
   paragraph, all of which describe the old labels as history. The pre-existing
   post-wave-1 series is untouched: MODULES.md headings CR-1 (line 189, cycle_state),
   CR-2 (line 213, XP retraction), CR-4 (line 227), CR-3 (line 263, F7 snooze) are
   unmodified, and every surviving `CR-1`/`CR-2` reference in `src/` (`mutations.ts`,
   `progressRepository.ts`, `cycleStateRepository.ts`, `cycleWindowSeed.ts`,
   `types/ports.ts`, `types/progress.ts`, `db/index.ts`, `repositories.test.ts:240`,
   `moveSemantics.test.ts:426`) genuinely refers to the post-wave-1 items. The new
   MODULES.md disambiguation paragraph (lines 340–349) passes the pass-1 acceptance
   test and goes further: it names the colliding series on both sides, records the
   rename, and states the forward rule ("any surviving CR-1/2/3 comment in `src/`
   refers to the post-wave-1 series in the top matter, never to these three").

2. **`app/_layout.tsx` ownership misstatement — RESOLVED.** The CR-5 heading (line 353)
   now reads "`app/_layout.tsx`, **M0-owned and frozen to every other module**", and a
   new lead paragraph states "Ownership is unchanged by this CR", quotes ARCHITECTURE.md
   §4.2 (line 151, "no other module may edit it") and §11 (line 583, "M0-owned … No
   other module may edit them") accurately, frames the architect's single edit as the
   cross-module CR mechanism "not as a transfer of ownership", and closes with "No
   builder may take this as licence to edit the shell." Pass-1 acceptance test met: no
   statement in MODULES.md now assigns the file to anyone but M0. The companion stale
   comment in `src/services/widgets/index.ts` ("architect-owned `app/_layout.tsx`") was
   also corrected to "M0-owned" in the same commit; a repo-wide grep for
   "architect-owned" now hits only the genuinely architect-frozen scaffold files.

## Non-blocking notes

- **MODULES.md CR-5 heading wording vs ARCHITECTURE §11's "not frozen".** ARCHITECTURE
  line 583 says the layouts are "M0-owned, **not frozen**" — there "frozen" is the term
  of art for the architect-frozen/no-owner list in the preceding paragraph. MODULES.md's
  "frozen to every other module" uses the word in its plain sense with an explicit
  qualifier, so meaning is unambiguous; still, a future editor grepping "frozen" will
  see apparently opposite claims about the same file. Style only.
- **MODULES.md CR-6 bullet (line ~381)** puts quote marks around "compatibility claims
  get a tested older-version fixture" and attributes it to SCHEMA §9, but that is a
  paraphrase — §9's actual sentences are the new standing rule and the F1 fixture
  requirement. The gloss is faithful; drop the quote marks next touch.
- Pass-1 non-blocking notes 1 (API §3 repo-wide-sounding claim) and 2 (dangling
  "contract gap 5's sibling" pointer) were both addressed although not required:
  API §3 now says "NO separate QUERY-LAYER hook" and names `useVoiceLanguagePrefs()` as
  a thin composition; MODULES.md now cites `review/REVIEW-M6.md` pass-2 note 5 (closed
  by CR-6) and pass-1 note 14 (`conversationStore.ts`, still open) — both verified
  against REVIEW-M6.md (lines 527 and 260 respectively, correct direction this time).
  Notes 3–5 (eraseAll clause placement, ARCHITECTURE §11 cross-ref, SCHEMA em-dash
  sentence) remain open as optional next-touch items; none blocks.

## Verified

- **`git show 88b534a`** in full, against the pass-1 review and against
  `docs/ARCHITECTURE.md` §4.2 (line 151) / §11 (line 583) — both quoted passages exist
  verbatim at the cited sections.
- **Grep sweeps:** `architect CR-[123]` (case-insensitive, repo-wide) — no stale code
  labels; `CR-[123]\b` in `src/` — every hit is a legitimate post-wave-1 reference;
  `CR-*` in `app/` — only CR-5/CR-6; "architect-owned" repo-wide — only scaffold files
  and review history.
- **SCHEMA.md §9 (section starts line 859):** the reworked backup-compat paragraph names
  `src/db/__tests__/backupRestore.test.ts` and describes the fixture accurately, and the
  claimed **standing rule** is actually present in the doc, verbatim: "any migration
  that adds a column must either give it a non-NULL default or carry its own
  pre-migration-version restore fixture". Not just claimed in the commit message.
- **`src/db/__tests__/backupRestore.test.ts` (new test, lines 117–212):** exists and
  matches every doc claim — handcrafted `schemaVersion: 3` envelope with the literal v3
  `settings` column set (no `assistant_*` keys), asserts restore succeeds, defaults
  materialise (`en-US`/`warm`), the file's own non-default values survive
  (theme `dark`, accent `plum`, digest `21:30`, tenure anchor), and a subsequent
  `patch({ assistant })` merges field-wise. Migration 004's header cross-references the
  test by file and title ("a pre-v4 (v3-shaped) backup ...") — title matches the `it()`
  at line 128. MODULES.md CR-6's bullet carries the same cross-reference.
- **MODULES.md structural integrity:** heading scan confirms the post-wave-1 section
  (lines 177–332) is byte-identical per the diff; only the post-wave-2 section (line 334
  ff.) changed.

The three documentation artifacts are now internally consistent, consistent with
ARCHITECTURE.md's ownership rules, and every compatibility claim they make is pinned by
a named, existing test. PASS.
