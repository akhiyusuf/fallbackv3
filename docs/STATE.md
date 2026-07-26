# Pipeline state — Fallback

_Updated after landing the human-supplied `docs/` bundle._

## Current position

**Phase 3 (BUILD) — architect done; its four docs under review.**

## Phase status

| Phase | Status | Evidence |
|---|---|---|
| 0 — Intake | Carried over | `docs/IDEA.md`, `docs/REQUIREMENTS.md` |
| 1 — Planning | Carried over | `docs/FEATURES.md`, `docs/PRD.md` |
| **Gate 1** | **PASSED** | `docs/PRD.md` contains `STATUS: APPROVED` |
| 2 — Design | Carried over; read via the `CLAUDE.md` PROJECT OVERRIDE | `design-input/` (50 screens, specs + rendered handoff) |
| **Gate 2** | **PASSED** | `design/APPROVAL.md` — human approved in conversation 2026-07-26, transcribed verbatim |
| 3 — Build | **In progress** — architect done, docs under review | `docs/ARCHITECTURE.md` `SCHEMA.md` `API.md` `MODULES.md` + scaffold |

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

## Next action

artifact-reviewer on the four architect docs → `review/REVIEW-ARCHITECTURE.md`.
Loop to PASS, then launch one feature-builder per module — wave 1 (M0/M1/M2) in
parallel, freeze, then wave 2 (M3–M7) in parallel.

After builders: code-reviewer per module (loop to PASS on all), then qa-tester,
then visual-qa, then **Gate 3** — human reviews screenshots + TEST_REPORT.md.
