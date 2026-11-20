/**
 * Edge campaign, round 2: static wording sweep.
 *
 * Every exported `*_COPY` object under `src/` and `app/` is discovered from the source tree (not a
 * hand-kept list), imported, and every string value inside it is checked. The copy builders
 * (functions that turn copy and numbers into a sentence) are imported by name and called with a
 * grid of sample inputs, and each output is checked too.
 *
 * What fails the sweep, in user-visible text:
 *  - an em dash (U+2014) or en dash (U+2013), anywhere (the human dislikes em dashes; an en dash in
 *    a range such as "Mon-Sat" is replaced with "to" or a plain hyphen, consistently)
 *  - two spaces in a row
 *  - a trailing space (a fragment meant to be concatenated is exempt: keys ending Prefix / Suffix,
 *    and the builders are checked on their final output instead)
 *  - a space before a full stop (" .")
 *  - placeholder leftovers: TODO, FIXME, XXX, lorem, ipsum, undefined, null, NaN, [object Object],
 *    or an unfilled {template} token
 */

import { importanceLabel, necessityLabel, cadenceLabel, cadenceHintLower, formatHeaderDate, formatTimeOfDay, formatWeekdaySet, taskTypeLabel } from '@/features/browse/format';
import { dueSectionLabel } from '@/features/browse/copy';
import { tenureBodyFor, formatOneDecimal } from '@/features/progress/copy';
import { resultsCountLabel } from '@/features/search/copy';
import { reentryStatLine, statLine } from '@/features/today/copy';
import { cadenceSummary } from '@/features/task/cadenceLabel';
import { dayLongLabel, shortDateLabel, todayLongLabel } from '@/features/task/dateLabel';
import type { Cadence, Importance, LocalDate, Necessity, TaskType, Weekday } from '@/types';

// Node built-ins, typed here because the project does not load the node type package.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeFs = require('fs') as {
  existsSync(p: string): boolean;
  readdirSync(p: string): string[];
  readFileSync(p: string, encoding: string): string;
  statSync(p: string): { isDirectory(): boolean };
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodePath = require('path') as {
  join(...parts: string[]): string;
  relative(from: string, to: string): string;
  resolve(...parts: string[]): string;
};
const { existsSync, readdirSync, readFileSync, statSync } = nodeFs;
const { join, relative, resolve } = nodePath;

declare const __dirname: string;

const ROOT = resolve(__dirname, '..');
const SCAN_DIRS = [join(ROOT, 'src'), join(ROOT, 'app')];

/** Every problem with one piece of user-visible text, as a readable phrase. Empty when it is clean. */
export function wordingProblems(text: string): string[] {
  const problems: string[] = [];
  if (/—/.test(text)) problems.push('em dash');
  if (/–/.test(text)) problems.push('en dash');
  if (/ {2}/.test(text)) problems.push('double space');
  if (/\s$/.test(text)) problems.push('trailing space');
  if (/\s\./.test(text)) problems.push('space before full stop');
  if (/\b(TODO|FIXME|XXX|undefined|NaN|null)\b/.test(text)) problems.push('placeholder word');
  if (/lorem|ipsum/i.test(text)) problems.push('lorem ipsum');
  if (/\[object Object\]/.test(text)) problems.push('[object Object]');
  if (/\{[a-zA-Z_][a-zA-Z0-9_]*\}/.test(text)) problems.push('unfilled {template} token');
  return problems;
}

/** Every string value inside a copy object, with the path to it, for readable failure messages. */
function stringsIn(value: unknown, path: string, out: { path: string; text: string }[]): void {
  if (typeof value === 'string') {
    out.push({ path, text: value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => stringsIn(v, `${path}[${i}]`, out));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) stringsIn(v, `${path}.${k}`, out);
  }
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Discovers every module that exports at least one `*_COPY` object, and returns those exports. */
function discoverCopyObjects(): { file: string; name: string; value: Record<string, unknown> }[] {
  const found: { file: string; name: string; value: Record<string, unknown> }[] = [];
  for (const dir of SCAN_DIRS) {
    for (const file of listSourceFiles(dir)) {
      const source = readFileSync(file, 'utf8');
      if (!/export const [A-Za-z0-9_]+_COPY\b/.test(source)) continue;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(file) as Record<string, unknown>;
      for (const [name, value] of Object.entries(mod)) {
        if (name.endsWith('_COPY') && value && typeof value === 'object') {
          found.push({ file: relative(ROOT, file), name, value: value as Record<string, unknown> });
        }
      }
    }
  }
  return found;
}

const COPY_OBJECTS = discoverCopyObjects();

describe('copy sweep: every *_COPY object', () => {
  it('discovers the copy objects (a new copy file cannot slip past the sweep)', () => {
    // 50 found at round 2; a drop means a copy object stopped being exported or moved.
    expect(COPY_OBJECTS.length).toBeGreaterThanOrEqual(50);
    const names = COPY_OBJECTS.map((c) => c.name);
    for (const must of ['S09_COPY', 'S28_COPY', 'S41_COPY', 'PUSH_COPY', 'DAY_OFF_COPY', 'DELETE_COPY', 'END_COPY', 'DELETED_COPY', 'ENDED_COPY']) {
      expect(names).toContain(must);
    }
  });

  it.each(COPY_OBJECTS.map((c) => [`${c.file} :: ${c.name}`, c] as const))('%s has clean wording', (_label, c) => {
    const strings: { path: string; text: string }[] = [];
    stringsIn(c.value, c.name, strings);
    expect(strings.length).toBeGreaterThan(0);
    const bad: string[] = [];
    for (const s of strings) {
      // Fragments meant to be joined (prefix / suffix) may end or start with a space by design.
      const isFragment = /(Prefix|Suffix)$/.test(s.path);
      const problems = wordingProblems(s.text).filter((p) => !(isFragment && (p === 'trailing space' || p === 'double space')));
      if (problems.length) bad.push(`${s.path} [${problems.join(', ')}]: ${JSON.stringify(s.text)}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('copy sweep: copy builders, called over a grid of inputs', () => {
  const WINDOW = 30;
  const numbers = [0, 1, 2, 7, 29, 30, 31, 100, 1000];

  it('the builders in copy files produce clean sentences for every sample', () => {
    const outputs: { label: string; text: string }[] = [];
    for (const day of ['Mon', 'Thu', 'Sun']) outputs.push({ label: `dueSectionLabel(${day})`, text: dueSectionLabel(day) });
    for (const key of [undefined, 'tenure-first-day', 'tenure-1-week', 'tenure-1-year', 'tenure-50-years', 'not-a-badge']) {
      outputs.push({ label: `tenureBodyFor(${key})`, text: tenureBodyFor(key) });
    }
    for (const n of [0, 1, 2, 2.5, 3.14159, 100]) outputs.push({ label: `formatOneDecimal(${n})`, text: formatOneDecimal(n) });
    for (const n of numbers) outputs.push({ label: `resultsCountLabel(${n})`, text: resultsCountLabel(n) });
    for (const x of [0, 1, 17]) {
      for (const counted of [0, 1, 5, WINDOW]) {
        if (x > counted && counted > 0) continue;
        outputs.push({ label: `statLine(${x}, ${counted}, ${WINDOW})`, text: statLine(x, counted, WINDOW) });
        outputs.push({ label: `reentryStatLine(50, ${x}, ${counted}, ${WINDOW})`, text: reentryStatLine(50, x, counted, WINDOW) });
      }
    }
    const bad = outputs.flatMap((o) => {
      const p = wordingProblems(o.text);
      return p.length ? [`${o.label} -> ${JSON.stringify(o.text)} [${p.join(', ')}]`] : [];
    });
    expect(bad).toEqual([]);
  });

  it('formatOneDecimal never prints NaN or Infinity', () => {
    for (const n of [0, -0, 0.05, 1 / 3, 99.95, 1e9]) {
      expect(formatOneDecimal(n)).not.toMatch(/NaN|Infinity/);
    }
  });
});

/** Builders that live in feature label files (not copy files). Their wording is checked the same way. */
describe('copy sweep: label builders outside the copy files', () => {
  const DATE = '2026-11-20' as LocalDate;
  const weekdays: readonly Weekday[][] = [[1], [1, 2], [1, 2, 3], [1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 6, 7], [6, 7], [1, 1, 2]];
  const importances: Importance[] = ['high', 'med', 'low'];
  const necessities: Necessity[] = ['must-do', 'recommended', 'optional'];
  const types: TaskType[] = ['routine', 'event', 'course', 'todo'];
  const cadences: Cadence[] = [
    { kind: 'daily' },
    ...weekdays.map((w) => ({ kind: 'specific-weekdays' as const, weekdays: w })),
    { kind: 'weekly', weekday: 3 },
    { kind: 'bi-weekly', weekday: 3 },
    { kind: 'monthly', dayOfMonth: 1 },
    { kind: 'monthly', dayOfMonth: 22 },
    { kind: 'bi-monthly', dayOfMonth: 2 },
    { kind: 'yearly', month: 2, dayOfMonth: 29 },
  ] as Cadence[];

  function collect(): { label: string; text: string }[] {
    const out: { label: string; text: string }[] = [];
    for (const v of importances) out.push({ label: `importanceLabel(${v})`, text: importanceLabel(v) });
    for (const v of necessities) out.push({ label: `necessityLabel(${v})`, text: necessityLabel(v) });
    for (const t of types) out.push({ label: `taskTypeLabel(${t})`, text: taskTypeLabel(t) });
    for (const w of weekdays) out.push({ label: `formatWeekdaySet(${w})`, text: formatWeekdaySet(w) });
    for (const c of cadences) {
      out.push({ label: `cadenceLabel(${c.kind})`, text: cadenceLabel(c) });
      out.push({ label: `cadenceHintLower(${c.kind})`, text: cadenceHintLower(c) });
    }
    for (const t of types) {
      for (const c of cadences.slice(0, 3)) {
        out.push({ label: `cadenceSummary(${t}, ${c.kind})`, text: cadenceSummary({ type: t, cadence: c, isAsNeeded: false, eventDate: null }) });
      }
    }
    out.push({ label: 'formatHeaderDate', text: formatHeaderDate(DATE) });
    out.push({ label: 'formatTimeOfDay(0900)', text: formatTimeOfDay('09:00') });
    out.push({ label: 'shortDateLabel', text: shortDateLabel(DATE) });
    out.push({ label: 'todayLongLabel', text: todayLongLabel(DATE) });
    out.push({ label: 'dayLongLabel', text: dayLongLabel(DATE) });
    return out;
  }

  it('every label builder output is clean (the en dash ranges are covered by the KNOWN test below)', () => {
    const bad = collect().flatMap((o) => {
      const p = wordingProblems(o.text).filter((x) => x !== 'en dash');
      return p.length ? [`${o.label} -> ${JSON.stringify(o.text)} [${p.join(', ')}]`] : [];
    });
    expect(bad).toEqual([]);
  });

  // Known, out of this round's file ownership (src/features/browse/format.ts and
  // src/features/task/cadenceLabel.ts). Each joins a contiguous weekday run with an en dash, e.g.
  // "Mon–Sat". Written as it.failing so the suite stays green; once the main session replaces the
  // dash with "to" (or a hyphen) in both files, this turns red and must be changed to a plain it().
  // Their existing assertions (src/domain/edge.schedule.test.ts, 'Mon–Sat' / 'Mon–Sun' / 'Sat–Sun'
  // / 'Mon–Tue') encode the en dash and need the same change.
  it.failing('KNOWN: contiguous weekday ranges use an en dash (formatWeekdaySet, cadenceLabel)', () => {
    const bad = collect().filter((o) => /–/.test(o.text));
    expect(bad).toEqual([]);
  });
});
