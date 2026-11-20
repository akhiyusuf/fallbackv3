# 34. Fuzzing the pure functions (round 3, Haiku)

Scope: `src/domain/**`, `src/lib/**`, `src/db/backupEnvelope.ts` (owned, may fix). Bugs elsewhere
are written as `it.failing` tests and listed below, not fixed.

New test files:
- `src/domain/edge.fuzz.test.ts`: 23 tests (domain project).
- `src/edge.fuzz.test.ts`: 52 tests (app project).

Method: a seeded mulberry32 generator (no new packages). Each property runs a fixed number of
seeded cases; each case has its own seed, and a failure reports `[property] seed=N (case i)`, so
it can be replayed. Oracles are independent of the code under test: Date.UTC arithmetic for dates,
and a from-the-spec reference for `isDue`.

## Results at a glance

- 75 tests in the two files, 0 failing. Three of them are `it.failing` (they pass by proving a bug
  exists, see "Bugs left for the main session").
- Fixed 3 real bugs (XP level hang and NaN, validation throwing on junk, backup envelope accepting
  structurally wrong files). Each has a regression case in the fuzz files.
- Existing tests re-run and green: `validation`, `xp`, `consistency`, `occurrence`, `dayState`,
  `edge.numbers`, `monotonicity`, `edge.schedule`, `backupRestore`, `upgradePaths`,
  `edge.spec.routines`, `CelebrationHost`, `sse`, `guardrails`, all after the fixes.
- `npx tsc --noEmit`: no errors in my files (remaining errors are in other agents' test files,
  `src/features/assistant/__tests__/edge.conversations.test.tsx`).

## Tests, grouped

### Domain (`src/domain/edge.fuzz.test.ts`)

dateMath (oracle: Date.UTC):
- addDays round-trips, matches the UTC oracle, daysBetween consistent, 1970-2100 plus ±137 years. 3000 cases. PASS
- weekdayOf matches the oracle and advances one weekday per day. 3000 cases. PASS
- addMonths/addYears clamp the day into the target month like the oracle. 3000 cases. PASS
- start/end of week and month bracket the date, Monday/Sunday, 6-day span. 3000 cases. PASS
- eachDay ascending, gap-free, empty when inverted. 500 cases. PASS

occurrence (oracle: from-the-spec `isDue`):
- occurrencesBetween equals the oracle; inside range; ascending; deterministic; never before `notBefore` (except course and dated events) or after `endedOn`. 500 cases. PASS
- isDue agrees with the oracle and with occurrencesBetween for one day. 3000 cases. PASS
- as-needed, to-do and ended tasks are never due after their end. 2000 cases. PASS
- dueIdealStepIds is a subset of the task's steps, weekday-correct, empty when not due. 2000 cases. PASS

resolveOccurrence:
- outcome always in the union; `pending` only on/after today; `missed` on/after today only from an explicit manual skip; `off` only with a matching mark; completed ids subset of due ids. 4000 cases. PASS
- deterministic; a moved-in (pushed) occurrence keeps `pushedFrom` = source date. 2000 cases. PASS

consistency:
- percent is an integer 0-100 or null (null iff denominator 0); numerator within denominator; countedDates length equals denominator, ascending, not after today; cap for last-7/last-30; both scopes and DateRange windows. 3000 cases. PASS
- aggregate result independent of input order. 1500 cases. PASS
- dayFractions in [0,1], ascending, shown-up ids subset of resolved ids. 1500 cases. PASS
- `it.failing`: aggregate breakdown reconciles (see Bug B1).

XP:
- levelFor on random finite XP: level ≥ 1, remainder in range, sum of spent levels plus remainder equals the input exactly, title never "undefined". 5000 cases. PASS
- levelFor monotonic in XP. 2000 cases. PASS
- levelFor on NaN, -0, negatives, fractions, MAX_SAFE, Infinity, -Infinity: finite result, no hang. PASS (after fix F1)

validation:
- validateTaskDraft never throws on any junk shape (null, undefined, NaN, huge strings, arrays, `__proto__`/`constructor` keys, nested junk) and always returns a Result. 10000 cases. PASS (after fix F2)
- emptyRunOccurrences never throws on junk cadences and step lists. 3000 cases. PASS (after fix F2)
- a well-formed tracked routine is accepted unless its name is blank (blank, whitespace, tab/newline names rejected; 500-char and emoji names accepted). 2000 cases. PASS

rounding:
- toPercent equals exact integer half-up (integer formula) for all small n ≤ d. 2000 cases. PASS
- toPercent is null for zero or negative denominators; roundHalfUp exact on .5 ties (k+0.5 → k+1) up to 1e6. 1000 cases. PASS

### App (`src/edge.fuzz.test.ts`)

SSE parser (`services/ai/sse.ts`):
- A stream with a keep-alive comment, unicode, escaped quotes, embedded newline/U+2028, and a malformed frame yields the same events when split at EVERY byte position (two chunks), for LF, CRLF and junk-frame variants. 3 tests. PASS
- One byte per chunk yields the same events. PASS
- 400 random multi-way splits (cuts inside multi-byte characters too). PASS
- 300 random garbage byte streams never throw; every event is a JSON value. PASS
- A 1 MB frame cut into 64 KB pieces parses intact. PASS

Guardrails (`services/ai/guardrails.ts`):
- 3000 random unicode strings (BMP incl. lone surrogates, astral emoji, ZWJ, combining marks, RTL override, NUL, up to 20k chars): never throws; category is in the union. PASS
- 2000 neutral habit texts with no keyword are never flagged. PASS
- 1000 literal logging phrases surrounded by random unicode are detected as literal. PASS
- Long inputs with no keyword (50k) finish under 2 s. PASS
- `it.failing`: a 150 KB "is " input is classified in under 2 s (Bug B2).

Backup envelope (`db/backupEnvelope.ts`):
- baseline envelope accepted. PASS
- 5000 junk JSON documents (round-tripped through JSON.parse, so the literal `__proto__` key is real): never throw. PASS (after fix F3)
- 500-deep nested array and a `__proto__`/`constructor`-keyed document: no throw, no Object.prototype pollution. PASS
- a 20,000-row table validates in under 1 s. PASS
- 23 structural mutations, each must be rejected: missing/foreign format, formatVersion as string/0/2, schemaVersion as string/0/-1/1.5/newer than app, createdAt as number, tables null/array, table not an array, table row null/number/string/array, settings 0 or 2 rows, settings id as string or 2, cycle_state missing or empty. PASS (after fix F3)
- 1000 valid envelopes with junk extra top-level fields still validate. PASS

lib/date vs domain/dateMath (agreement in device-local calendar):
- In UTC, America/New_York, Europe/London, Australia/Lord_Howe (30-minute DST), America/Santiago (midnight DST), Asia/Tehran: 300 random dates each, addDays (±40000), addMonths, addYears, weekdayOf, start/end of week and month, and diffDays sign (opposite by design). PASS

Cadence labels:
- ordinal suffixes right for 1-31 (1st, 2nd, 3rd, 11th-13th, 21st...). PASS
- cadenceSummary never empty and never shows undefined/NaN/null, 3000 cases across types. PASS
- browse `cadenceLabel` never empty for valid cadences, 2000 cases. PASS
- `it.failing`: browse label does not repeat a duplicated weekday (Bug B3).

Rounding:
- toPercent(n, d) is an integer in [0,100] for 0 ≤ n ≤ d, 3000 cases. PASS

## Bugs fixed (in files I own)

F1. `src/domain/xp.ts:57` (`levelFor`). `Infinity` hung the level loop forever (`while (remaining >= xpForLevel(level))` never ends). `NaN` returned `xpIntoLevel: NaN`. Cause: `Math.max(0, x)` does not clamp `NaN` or `Infinity`. Fix: non-finite or negative input is treated as 0 XP. Regression: "levelFor never throws or returns NaN for junk numbers".

F2. `src/domain/validation.ts` (`validateTaskDraft` line 57, `emptyRunOccurrences` line 22-48). Threw a TypeError on a null draft, a missing or non-string `name`, non-array `idealSteps`/`fallbackSteps`, a non-array `cadence.weekdays`, and a null or malformed step (`stepCovers`, line 30). A save from the form cannot send these, but a corrupt or future caller could crash the save path. Fix: each shape is a validation failure (`fields`) or "covers nothing", never a throw. The valid-draft behaviour is unchanged; `validation.test.ts`, `edge.schedule.test.ts` and `monotonicity.test.ts` pass.

F3. `src/db/backupEnvelope.ts` (`validateBackupEnvelope`, lines 90-134). It accepted structurally wrong files:
- any `formatVersion` number (0, 2, a future version) → now only `BACKUP_FORMAT_VERSION` (1) is readable (line 96).
- `schemaVersion` 0, -1 or 1.5 → now a positive integer (line 102).
- table rows that were `null`, numbers, strings or arrays → now every row must be a record (line 130).
- an error message built with `String(v.format)` could throw for an object with a broken prototype. That cannot come from JSON, but the message now uses `typeof` (line 91).
All existing `backupRestore.test.ts` and `upgradePaths.test.ts` cases still pass (they all use `formatVersion: 1`).

## Bugs left for the main session (each has an `it.failing` test)

B1. `src/domain/consistency.ts:110` (`aggregateConsistency`), breakdown rounding. A counted day with one ideal task and one fallback task has `denominator` 1, but the rounded breakdown is `ideal: 1, fallback: 1, missed: 0`, so the parts sum to 2. Cause: each half is rounded up separately (`roundHalfUp(0.5)` = 1). The comment at that spot promises "ideal + fallback + missed reconciling against the rounded denominator", and that is not true for ties. Test: `src/domain/edge.fuzz.test.ts`, "aggregate breakdown reconciles". Not fixed because §6.5 pins this rounding and the fix changes numbers the human has seen on the S25 disclosure table. A possible fix is largest-remainder rounding so the three parts sum to the denominator. This needs a decision.

B2. `src/services/ai/guardrails.ts:71` (medical rule `/is .* the right dose/`). Each "is " restarts a scan to the end of the input, so cost grows with the square of the length: about 1 s at 72 KB, several seconds at 150 KB (measured with the same regex in Node). A long paste in the chat composer can freeze the JS thread. Test: `src/edge.fuzz.test.ts`, "a 150 KB input of 'is ' ...". Suggested fix: bound the gap (`.{0,200}`) or check for "the right dose" before running the regex. Not fixed (not my file).

B3. `src/features/browse/format.ts:42` (`formatWeekdaySet`). It does not de-duplicate weekdays, so `[1, 1, 2]` reads "Mon·Mon·Tue". The task-side label (`src/features/task/cadenceLabel.ts`) de-duplicates and says why. Test: `src/edge.fuzz.test.ts`, "browse cadenceLabel does not repeat a weekday". Low impact: the save path rejects an empty set, and the UI makes unique chips, so this needs corrupt data. Also noted, not tested: an empty weekday set gives an empty browse label (`''`); the save path rejects it first.

## Not bugs, but noted

- SSE: a final frame that never gets a newline is dropped at end of stream. The SSE spec also discards an incomplete event at EOF, so this is consistent. Bare CR line endings are not supported; the providers do not send them.
- `src/domain/occurrence.ts` `isMonthDay` builds `new Date(y, m, 0)`, which maps years 0-99 to 1900-1999. The app's range (1970-2100) is unaffected. Latent only.
- `src/domain/dateMath.ts` `addDays` with huge offsets (well beyond ±50,000 days) can produce a malformed string. Tested only inside ±50,000 days, the range the app can reach.
- `lib/date` vs `dateMath` in Pacific/Apia (2011-12-30 does not exist on that device). Not tested. The device calendar really skips that day, so this is a calendar fact more than a bug.

## Not fuzzed (and why)

- `cycles.ts`, `achievements.ts` and `retention.ts`: left to round 1/2 coverage. Time budget.
- `applyBackupEnvelope` (needs the SQL double; its behaviour is covered by `backupRestore.test.ts`).
- `features/assistant/toolExecutor.ts`: not in my area.
- Real network SSE: the parser was tested with in-memory streams only.

## Could not test here (needs a real phone)

- Real-device timing of the guardrail scan on a long paste in the composer (B2 is measured in Node, not on Hermes).
- A real stream from the managed backend split by the OS network stack.
- Timezone changes while the app is open (the zone switch was simulated with `process.env.TZ` only).
