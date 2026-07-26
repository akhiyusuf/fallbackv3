# Pipeline state — Fallback

_Updated after landing the human-supplied `docs/` bundle._

## Current position

**Phase 3 (BUILD) — wave 1 built and reviewed; all three modules reworking.**

## Phase status

| Phase | Status | Evidence |
|---|---|---|
| 0 — Intake | Carried over | `docs/IDEA.md`, `docs/REQUIREMENTS.md` |
| 1 — Planning | Carried over | `docs/FEATURES.md`, `docs/PRD.md` |
| **Gate 1** | **PASSED** | `docs/PRD.md` contains `STATUS: APPROVED` |
| 2 — Design | Carried over; read via the `CLAUDE.md` PROJECT OVERRIDE | `design-input/` (50 screens, specs + rendered handoff) |
| **Gate 2** | **PASSED** | `design/APPROVAL.md` — human approved in conversation 2026-07-26, transcribed verbatim |
| 3 — Build | **In progress** — wave 1 reworking after review | `review/REVIEW-M0.md` `REVIEW-M1.md` `REVIEW-M2.md`, all CHANGES_REQUIRED pass 1 |

Re-review complete: `docs/PRD.md` → artifact-reviewer → `review/REVIEW-PRD.md` = **PASS**.

## Artifacts present

Produced by a **previous run** of this pipeline and supplied by the human, not
generated in this repo:

- `docs/IDEA.md` — 336 lines
- `docs/REQUIREMENTS.md` — 1,013 lines (`STATUS: DRAFT`)
- `docs/FEATURES.md` — 1,265 lines, F1–F31
- `docs/PRD.md` — 1,425 lines, `STATUS: APPROVED`, §1–§7 + Decisions appendix
- `design-input/` — Verdant design system, `fallback-theme.css`, `ALLSCREENS_1.md`
  (S01–S50), and the rendered handoff document

Consistency between the design and the docs has been checked: every PRD section
the screen specs cite (§3–§7) exists; F10 is an intentional numbering gap per the
PRD; F22 is P2 and outside v1, so no v1 screen covers it.

## Two items raised before Phase 3 — both resolved by human decision

**1. Design not in canonical `design/` paths — RESOLVED: point builders at
`design-input/`.**
Human decided against regenerating Phase 2, to avoid drift from screens already
approved as rendered output. `CLAUDE.md` now carries a PROJECT OVERRIDE section
mapping each `design/*` contract row to its real location under `design-input/`.
ia-architect, design-system and screen-designer are **not** to be invoked for
this project. Briefs to architect/feature-builders must name the override paths
explicitly.

**2. No review record — RESOLVED: re-check the PRD only. Result: PASS.**
Human decided the carried-over artifacts are trusted as reviewed in their
original run, except `docs/PRD.md`, which every builder reads and where an error
would propagate through all of Phase 3. artifact-reviewer reviewed it against
`docs/REQUIREMENTS.md` + `docs/FEATURES.md` → **`review/REVIEW-PRD.md`: PASS**.
The PRD is safe for the architect and feature-builders to treat as law. The
other three docs and the design carry no PASS in this repo by explicit human
decision.

Verified clean: full R1–R26 and F1–F31 traceability with P0/P1/P2 matching
FEATURES.md; the off-day and fractional-rollup maths consistent across all nine
places it appears, with all five worked anchors re-verified arithmetically; §7's
"no item is OWNER: human" claim confirmed across all 14 open decisions.

### Carry into Phase 3 — advisory findings from REVIEW-PRD.md

None blocking, but they must reach the architect or they will resurface as
builder-vs-qa disagreements:

1. **Rounding ties are unpinned.** §3.5 says "nearest whole percent" but no
   worked example exercises a `.5` tie (e.g. 1/8 = 12.5%). The design already
   resolved it as **round-half-up** (`ALLSCREENS_1.md` line 2947). The architect
   must codify that so builders and qa-tester don't diverge.
2. **Done→ideal chip mapping is implicit** in §3.3/§6. Inferable, and the design
   resolved it, but it wants one explicit line in ARCHITECTURE/SCHEMA.
3. **Two §7 items name "spec-writer" as co-owner** of forks, though the PRD is
   the spec-writer's terminal artifact. Process wrinkle only — the display forks
   (S25, S29/S30) are in fact design-resolved; the F29 tenure-anchor event falls
   to the architect.
4. Trivial: §3.5 writes 26/31 as "83.9" (exact 83.87). The final 84% is correct.

## Architecture — delivered, under review

Stack: Expo SDK 57 / RN 0.86 / React 19 / TS 6, expo-router, expo-sqlite,
TanStack Query (read cache), zustand (ephemeral UI), tokens transcribed to TS.
Billing via expo-iap direct to StoreKit 2 / Play Billing — no RevenueCat, which
would put user data server-side.

Eight modules, two waves: **M0** kernel · **M1** data layer · **M2** domain
engine build first, then **M3** today/browse · **M4** task authoring · **M5**
progress · **M6** assistant/billing · **M7** first-run/settings. All 50 screens
assigned exactly once.

All four PRD-review findings resolved. Round-half-up is pinned to one function
and locked by 8 passing assertions (incl. 12.5→13 and the 67%-not-50% aggregate
anchor). `tsc --noEmit` clean, jest 8/8 green.

### Contract deviation — recorded, not hidden

The architect's output column is the four docs; `src/**` belongs to
feature-builders. It also wrote ~2,350 lines of scaffold (types, tokens, config,
route stubs). Not reverted, because every scaffolded file sits inside some
module's owned paths and will therefore be covered by code-reviewer when that
module is reviewed. Two follow-ups:

- `MODULES.md` tells builders the scaffold is settled ("already written, do not
  change the algorithm"). Builder briefs must state it is a **starting point,
  not law** — a builder who finds a real defect fixes it and says so.
- artifact-reviewer has been asked to flag any place that deference would
  suppress a legitimate fix.

## Architecture review — 3 passes to PASS

| Pass | Verdict | What it caught |
|---|---|---|
| 1 | CHANGES_REQUIRED | S22 confirmed-delete went to the wrong screen, contradicting the approved design; L8 title collided with S28's exact copy; the delete cascade destroyed XP rows, letting a level drop; scaffold deference left builders no path to fix a defect |
| 2 | CHANGES_REQUIRED | The scaffold-deference fix inverted its own locked-assertion rule, forbidding the exact fix it authorized one sentence earlier |
| 3 | **PASS** | Rule survives adversarial reading both ways; the architect's unrequested SCHEMA §9 restore clause verified correct and conflict-free |

Path ownership and screen assignment were verified clean in pass 1 and unchanged
since: no two modules own the same path, all 50 screens assigned exactly once.

Two non-blocking observations left, neither impeding a builder: ARCHITECTURE §14's
"extended by M0/M2" sits askew of M0's ownership, and the assertions-as-arbiter
rule leans on the adjacent §6.5 pin.

## Wave 1 — built, reviewed, reworking

All three landed green (tsc clean, 32 suites / 213 tests) and all three came back
CHANGES_REQUIRED on code-review pass 1. Each reviewer verified the module's
highest-stakes surface **before** reporting defects, and re-derived rather than
trusting the module's own tests.

| Module | Verified clean | Blocking |
|---|---|---|
| M0 kernel | 39 real components; both palettes exact against `fallback-theme.css`; `number.ts` byte-identical | 9 — design-fidelity and a11y |
| M1 data layer | Cascade re-executed in `node:sqlite` outside M1's harness: XP survives, sum unchanged. Restore never inspects references | 2 |
| M2 domain engine | Every golden row re-derived; 67% test asserts numerator and denominator separately so it cannot pass all-or-nothing; `dateMath` vs date-fns over 3,000 days, 0 mismatches | 10 |

**M0's nine share one root cause worth remembering:** the builder reasoned signal
renderings from ARCHITECTURE prose where the approved rendered handoff already
settles them differently. The design is controlling; prose describing it is not.

**The worst individual defects found:** a snoozed task silently becoming a
*missed* day (M2 — F7 no-op); a UTC date-slice breaking the creation-day boundary
in opposite directions depending on hemisphere (M2); an all-empty backup envelope
passing validation and wiping data while reporting success (M1); and
`store:erased` never firing, which would leave pre-erase habits on the home-screen
widget after an erase-all (M1).

## Architect change requests — resolved, approved, in `docs/MODULES.md`

- **Test config was broken for component tests.** `test-renderer` turned out to be
  a real package — React 19's replacement for the deprecated `react-test-renderer`
  — never installed because `--legacy-peer-deps` skipped it. Installing it exposed
  a third failure the builders' workarounds had masked: **RNTL 14's `render`
  returns a Promise**, so every query fails without `await`. `lucide-react-native`
  pinned to its prebuilt CJS (13s vs 44s for the transform route). A **House
  testing pattern** section now sits at the top of `MODULES.md`; wave 2 follows it
  and deletes inherited workarounds.
- **CR-1 `cycle_state`** — becomes a first-class `Repositories` member. M2's
  correctness reasoning won, M1's structure won: the pointer is authoritative and
  O(1); M2's derivation survives only as the `null` fallback and must write the
  pointer back. M0 lands the port change; M1 and M2 align.
- **CR-2 `retractXpAward`** — added to `ProgressRepository`. Fires **only** for an
  undone mis-tap on a live task; never for a missed day, off day, cycle boundary,
  or deletion.
- **F20 cloud sync — KNOWN GAP, recorded in `ARCHITECTURE.md` §9.2.1** with a
  per-platform cost table. iOS is the harder half (custom native Swift module,
  ~150–250 LOC, provisioned iCloud container); Android needs credentials and
  configuration only. M1's `isAvailable() → false` is endorsed and must not be
  "fixed" into fake success. F20 is P1 fast-follow, so this does not block the MVP.

## Commit-record correction

Commit `407ede2`, titled "Code review pass 1: M1 and M2 both CHANGES_REQUIRED",
also contains `review/REVIEW-M0.md` and the architect's entire config and docs
work (`package.json`, `jest.config.js`, `app.config.ts`, `API.md`,
`ARCHITECTURE.md`, `SCHEMA.md`, `MODULES.md`). A `git add -A` swept them in
mid-flight. The message is incomplete, not wrong; history was not rewritten
because it was already pushed.

## Carry to Gate 3 — product calls, not builder calls

- Exported `.fallbackbak` files survive erase-all in the app's Documents
  directory. Judged defensible, escalated as a product decision.
- F20 sync ships visibly unavailable unless the §9.2.1 gap is funded.

## Next action

All three wave-1 builders are reworking against their reviews. Then: code-reviewer
re-review each, loop to PASS → freeze wave 1 → wave 2 (M3–M7) in parallel →
code-reviewer each → qa-tester → visual-qa → **Gate 3**, where the human reviews
screenshots + `review/TEST_REPORT.md`.
