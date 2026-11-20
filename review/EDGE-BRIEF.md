# Edge-case campaign brief (2026-11-20)

The human is using the APK for a week and asked for rigorous edge-case testing across the
whole app, by Haiku and Sonnet agents. Eight agents run at the same time, one area each.

## The app
Fallback: a phones-only habit tracker (Expo SDK 57, RN 0.86, expo-router, TanStack Query,
zustand, expo-sqlite). "Every habit has an ideal and a fallback." Read `docs/DESIGN_DECISIONS.md`
(newest passes at the end of the Round 4 section: push to tomorrow is additive, emergency day off
replaces Skip, Recently deleted, End routine vs Delete) before testing behaviour.

Key facts:
- Occurrences are resolved per (task, date) in `src/queries/internal.ts` from logs, off marks and
  the pure domain in `src/domain/`. Push to tomorrow is ADDITIVE (`Occurrence.pushedFrom`; a second
  occurrence on D+1). XP is keyed by `occurrence.pushedFrom ?? date`.
- The record (consistency, trend, badges, cycle records) = live tasks + soft-deleted tasks up to
  their deletion day + anonymous `retired_day` rows (`resolveRecordOccurrences`). Today and lists
  read live tasks only. Ended tasks (`endedOn`) are due on nothing after their last day.
- DB writes are serialized (`DbClientProxy.serial`). Writes to a deleted task are refused.

## Rules (all agents)
- Do NOT commit or push. The main session integrates.
- Never write to `design-input/**`. Do not edit `CLAUDE.md` or config.
- Use they/them for the user. No em dashes in any visible wording you add or change.
- Stay in YOUR area. Write NEW test files named in your brief. You may fix a real bug in source
  files your brief says you own; for a bug elsewhere, write a failing test marked `it.failing(...)`
  or `it.skip` with a comment, and describe it in your report instead of editing that file.
- Never weaken an existing assertion to make it pass. If an existing test encodes old behaviour
  that a design decision changed on purpose, say so in the report, don't silently rewrite it.
- RNTL v14: `render`, `fireEvent`, `unmount`, `renderRouter` and `userEvent` calls are async and
  must be awaited. Reset jest mocks in `beforeEach` (`mockReset`), or mock-once values leak.
- Test harnesses to copy: fake repos `src/queries/testSupport/fakeRepos.ts` + clock mock (see
  `src/queries/endedAndRetired.test.tsx`), real SQLite (`src/db/__tests__/retiredDays.test.ts`,
  `recentlyDeleted.test.ts`), screens (`app/task/[id]/endRoutine.test.tsx`,
  `app/settings/data/deleted.test.tsx`).
- Run only your own files, with few workers, because seven other agents share the machine. PUT THE
  PATH FIRST (after `--selectProjects` jest reads it as a project name and runs everything):
  `timeout 500 npx jest <path> --selectProjects app --maxWorkers=1 --testTimeout=60000 --forceExit 2>&1 | tail -60`
  (domain-only tests: `--selectProjects domain`). Run `npx tsc --noEmit` before finishing; it must
  have no errors in your files.
- Think like a real person using the app all week: midnight passing with the app open, logging
  late, changing their mind, double taps, killing the app mid-save, leap days, month ends, time
  zone or clock changes, empty states, very long names, hundreds of habits, emoji in names.

## Report
Write `review/<haiku|sonnet>/<number>-<area>.md`: every test (one line each, grouped), the
result, each bug with cause, fix and file:line (or why you left it), and what you could not test
(say plainly what needs a real phone). Reply with a short summary: tests added, bugs fixed, bugs
left for the main session.

## Round 2 (2026-11-20, "do more tests")
Round 1 (reports 16-23) covered each area on its own. Round 2 looks ACROSS areas: long random
simulations with invariants, real-database runs, whole journeys through several screens, time
zones, scale, accessibility, settings and billing, privacy. Read the round-1 report for your
area first and do not repeat it; build on it. Reports are numbered 24-31. The file ownership in
your own brief overrides round 1's.

## Round 3 (2026-11-20, "do more tests" again)
Rounds 1 and 2 (reports 16-31) tested areas and cross-area journeys. Round 3 tests the TESTS
and the parts nothing has touched yet: mutation testing, the real rendered app in a browser,
fuzzing, native/Android configuration, whole assistant conversations, spec coverage, races
between screens and the cache, and app lifecycle (background, foreground, rollover). Read the
reports for your area (`review/haiku/*.md`, `review/sonnet/*.md`) and do not repeat them.
Reports are numbered 32-39. File ownership in your own brief overrides earlier rounds.
The full suite is now ~2140 tests; never run it whole while other agents work (it takes
over 10 minutes under load): run only your files.
