# Pipeline state — Fallback

_Updated after landing the human-supplied `docs/` bundle._

## Current position

**Phase 2 (DESIGN) — design work carried over, awaiting Gate 2.**

## Phase status

| Phase | Status | Evidence |
|---|---|---|
| 0 — Intake | Carried over | `docs/IDEA.md`, `docs/REQUIREMENTS.md` |
| 1 — Planning | Carried over | `docs/FEATURES.md`, `docs/PRD.md` |
| **Gate 1** | **PASSED** | `docs/PRD.md` contains `STATUS: APPROVED` |
| 2 — Design | Carried over; read via the `CLAUDE.md` PROJECT OVERRIDE | `design-input/` (50 screens, specs + rendered handoff) |
| **Gate 2** | **PENDING — human** | `design/APPROVAL.md` does not exist |
| 3 — Build | Blocked on Gate 2 | no `src/` |

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

## Next action

Human decision at Gate 2 — see the Visual Review Protocol in `CLAUDE.md`.
Approval means creating `design/APPROVAL.md` containing `STATUS: APPROVED`.
No agent, including the orchestrator, may write that file.
