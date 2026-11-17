# Brief for the Haiku test-and-bug agents (wave 2)

You are working in `/home/user/fallbackv3`: "Fallback", a phones-only habit tracker (React Native 0.86,
Expo SDK 57, expo-router, TanStack Query, zustand, SQLite). Its idea: every habit has an ideal and a fallback.
Dependencies are installed. Run every command from `/home/user/fallbackv3`.

## Where things stand
A large design rework was merged into `src/` and `app/`: a new look, new wording, and some new features
(Priorities, agent access settings, sounds, onboarding pictures, a bundled typeface). The human has approved
how the app now looks and reads. A first agent already fixed the shared groundwork: read its report,
`review/haiku/00-foundations.md`, before you start (10 minutes well spent). The app type-checks. About 46 test
files under `app/` and `src/features/` still fail, mostly because they describe the old screens.

Several agents work at the same time, each on its own area. **Stay inside your area** (given in your task).

## Your job, in this order
1. **Make every test in your area pass.** Run only your area: `npx jest <your paths> --maxWorkers=2`.
2. **Hunt for bugs in your area's code.** Read every screen and helper in your area. Look for: crashes, wrong
   logic, states that cannot be reached or left, missing null or empty handling, a button that does nothing,
   wrong navigation targets, wording that contradicts what the code does, things that only work in a browser
   (`window`, `document`, `localStorage`) and would break on a phone, text that would be cut off, and missing
   accessibility labels on things you can press. Fix what is clearly a bug, with the smallest change.
3. **Add tests for what has none.** New features and anything you fixed should have a test. Keep them plain:
   render the screen, do the thing, check the result.
4. **Clear the lint errors in your area** (`npx eslint <your paths> --quiet`). Recipes:
   - `react-hooks/refs` on an animated value: replace `useRef(new Animated.Value(x)).current` with
     `useState(() => new Animated.Value(x))[0]`. Do not change timing, values or styles.
   - `react/display-name`: name the component. `react/no-unescaped-entities`: use `&apos;` / `&quot;` or a
     `{'...'}` string, keeping the visible text identical.
   - `react-hooks/set-state-in-effect`: fix only when the fix is obviously safe and behaviour stays the same.
     Otherwise leave it and list it in your report.
5. Finish with `npx tsc --noEmit` (must print nothing) and your area's tests and lint once more.

## Rules
- **Never change how the app looks, reads or sounds to make a test pass.** No edits to styles, colours, layout
  or wording in non-test files, unless the wording or layout is itself the bug (then say so in the report).
  When a test fails because a screen or its copy was deliberately changed, update the TEST to assert what the
  app does now.
- **Never delete, skip (`.skip`, `xit`, `xdescribe`) or hollow out a test.** Replace an outdated assertion with
  an equivalent one for the current behaviour. If a test covers something that no longer exists at all, you
  may delete it and must list it in the report with the reason.
- **A real bug in app code** (wrong logic, a crash, a missing null check) is fixed in the code and reported
  with file and line. Do not "fix" it by changing the test.
- **Shared code** (`src/ui`, `src/theme`, `src/queries`, `src/domain`, `src/db`, `src/services`, `src/lib`,
  `src/app-shell`, `src/navigation`, `__mocks__`, test helpers used by other areas): edit it only for a real
  bug, as small as possible, no reformatting, and list every such edit under "Shared files touched". Another
  agent may be reading the same file.
- Tests that mock `@/queries` with a partial factory fail with "useX is not a function": add the hooks the
  screen now uses, or spread `jest.requireActual('@/queries')`.
- Do not touch: `design-input/`, `docs/`, `assets/`, `app.config.ts`, `package.json`, `package-lock.json`,
  `jest.config.js`, `eslint.config.js`, `tsconfig.json`, `CLAUDE.md`, other agents' areas.
- No new dependencies. No git command that changes state (no add, commit, checkout, stash, reset, restore).
  Read-only git is fine: `git show 047f32d~1:<path>` shows a file as it was before the rework, and
  `git log -p -- <path>` shows how it changed.
- Why did something change? `docs/DESIGN_DECISIONS.md` records the design decisions. It is long: search it
  (`grep -n`), do not read it whole. The screens' original spec is
  `design-input/fallback-handoff/uploads/ALLSCREENS_1.md`; where the two disagree, DESIGN_DECISIONS.md and
  the current code win.

## Report (required, be thorough — the human asked for detailed reporting)
Write `review/haiku/<your file name>.md` with these sections:
1. **Summary**: suites and tests passed/failed in your area before and after; lint errors before and after.
2. **Every file you changed**, one line each: what and why.
3. **Every failing test you dealt with**: file, test name, why it failed (deliberate design change / mock out
   of date / real bug / test setup), what you did.
4. **Bugs found in app code**: file:line, what was wrong, how a person would hit it, the fix. Include bugs you
   found but did NOT fix, marked as such, with why.
5. **Tests added**: file and what each checks.
6. **Shared files touched**: file, lines, why.
7. **What you read and found fine**: the list of files you actually read for the bug hunt.
8. **Not done / unsure**: anything unfinished, anything you doubt, anything that needs a person's decision.

Your final message back: a short summary of the report and its path. Report honestly. If something still
fails, say so and paste the output.
