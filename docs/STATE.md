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
| 2 — Design | Carried over, not in canonical paths | `design-input/` (50 screens, specs + rendered handoff) |
| **Gate 2** | **PENDING — human** | `design/APPROVAL.md` does not exist |
| 3 — Build | Blocked on Gate 2 | no `src/` |

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

## Two things to settle before Phase 3

**1. The design is not in the canonical `design/` paths.**
The artifact contract has feature-builders read `design/DESIGN.md` and
`design/screens/*.md`. What exists instead is one consolidated
`design-input/fallback-handoff/uploads/ALLSCREENS_1.md` plus a single rendered
handoff. There is no `design/SITEMAP.md`, `design/FLOWS.md`, `design/DESIGN.md`,
or `design/mockups/*.html`. Builders will not find the files the contract points
them at unless this is reorganised or they are pointed at `design-input/`.

**2. No artifact in this repo has a review record.**
The pipeline's hard rule is that nothing reaches a downstream consumer without a
PASS from the applicable reviewer. These artifacts were presumably reviewed in
the run that produced them, but `review/` does not exist here, so there is no
PASS on record for any of them.

## Next action

Human decision at Gate 2 — see the Visual Review Protocol in `CLAUDE.md`.
Approval means creating `design/APPROVAL.md` containing `STATUS: APPROVED`.
No agent, including the orchestrator, may write that file.
