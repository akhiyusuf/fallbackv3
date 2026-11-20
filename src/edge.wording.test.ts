/**
 * Edge campaign, round 4: wording consistency lock-in (static).
 *
 * Every string literal and JSX text node in the app's own code (`src/` and `app/`, not tests) is
 * read from the TypeScript syntax tree, so comments and identifiers are never checked. The rules
 * below lock in the decisions made in review/haiku/45-wording.md:
 *  - one name per concept: "task" (never "habit"), "Consistency" (never "Showing up" as a label),
 *    "Emergency day off", "Push to tomorrow", "Recently deleted", "Delete forever", "Try again"
 *    (never "Retry"), American "color" and "and" (never "&") in labels
 *  - toasts end with a full stop (or an ellipsis when something is still in progress)
 *  - straight apostrophes and straight quotes; no curly quotes, no dashes, no exclamation marks
 *  - no AI tells ("Let's", "Nice work", "seamless", "effortless", emoji) and no "Could not"
 */

// Node built-ins, typed by hand because the project does not load the node type package.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeFs = require('fs') as {
  existsSync(p: string): boolean;
  readdirSync(p: string): string[];
  readFileSync(p: string, encoding: string): string;
  statSync(p: string): { isDirectory(): boolean };
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodePath = require('path') as { join(...parts: string[]): string; resolve(...parts: string[]): string };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ts = require('typescript') as typeof import('typescript');

declare const __dirname: string;

const ROOT = nodePath.resolve(__dirname, '..');
const SCAN_DIRS = [nodePath.join(ROOT, 'src'), nodePath.join(ROOT, 'app')];

/** Code that is not shown to the person: tests, fixtures, migrations, model prompts and schemas. */
const NOT_SHOWN = /\.test\.|__tests__|testSupport|__fixtures__|\/db\/migrations\/|services\/ai\/(guardrails|toolSchemas|managedProvider)\.ts$|\.d\.ts$/;

function listFiles(dir: string): string[] {
  const out: string[] = [];
  if (!nodeFs.existsSync(dir)) return out;
  for (const name of nodeFs.readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = nodePath.join(dir, name);
    if (nodeFs.statSync(full).isDirectory()) out.push(...listFiles(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

interface Literal {
  file: string;
  text: string;
}

/** Every string literal and JSX text node in one file, from the syntax tree. */
function literalsOf(file: string): Literal[] {
  const source = nodeFs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: Literal[] = [];
  const visit = (node: import('typescript').Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node)) {
      const text = ts.isJsxText(node) ? node.getText(sf).trim() : node.text;
      if (text.length > 0) out.push({ file, text });
    } else if (ts.isTemplateExpression(node)) {
      out.push({ file, text: node.head.text });
      for (const span of node.templateSpans) out.push({ file, text: span.literal.text });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

const SHOWN: Literal[] = SCAN_DIRS.flatMap(listFiles)
  .map((f) => nodePath.join(f))
  .filter((f) => !NOT_SHOWN.test(f.split(ROOT + '/')[1] ?? f))
  .flatMap(literalsOf)
  .filter((l) => /[A-Za-z]/.test(l.text));

/** Each rule is a phrase for the report and the test that must find no matches. */
const BANNED_IN_COPY: { phrase: string; test: (text: string) => boolean }[] = [
  { phrase: 'the word "habit" (the app says task)', test: (t) => /\bhabits?\b/i.test(t) },
  { phrase: 'British "colour" (the app says color)', test: (t) => /colour/i.test(t) },
  { phrase: '"Retry" (the app says Try again)', test: (t) => /^Retry\b/.test(t) },
  { phrase: '"Could not" (the app says Couldn\'t)', test: (t) => /Could not/.test(t) },
  { phrase: 'an en dash or em dash', test: (t) => /[–—]/.test(t) },
  { phrase: 'a curly quote or apostrophe', test: (t) => /[‘’“”]/.test(t) },
  { phrase: 'an exclamation mark', test: (t) => /\w!/.test(t) },
  { phrase: 'three dots (use the ellipsis character)', test: (t) => /\.\.\./.test(t) },
  { phrase: 'an emoji', test: (t) => /\p{Extended_Pictographic}/u.test(t) },
  { phrase: 'an ampersand between words (use "and")', test: (t) => /\w & \w/.test(t) },
  { phrase: 'a double space', test: (t) => /\S {2,}\S/.test(t) },
  { phrase: '"Let\'s" (an AI tell)', test: (t) => /\bLet's\b/.test(t) },
  { phrase: '"Nice work" or "Great job" (an AI tell)', test: (t) => /Nice work|Great job/i.test(t) },
  { phrase: '"seamless" or "effortless" (an AI tell)', test: (t) => /seamless|effortless/i.test(t) },
  { phrase: '"Settings, Data" (the app says Settings > Data)', test: (t) => /Settings, Data\b/.test(t) },
  { phrase: 'the old "for good" (the app says forever)', test: (t) => /\bfor good\b/.test(t) },
];

describe('round 4 wording: the same thing has the same words and marks everywhere', () => {
  it('finds the visible text of the app (the scan is not empty)', () => {
    expect(SHOWN.length).toBeGreaterThan(500);
  });

  it.each(BANNED_IN_COPY.map((r) => [r.phrase, r.test] as const))('no visible text uses %s', (_phrase, test) => {
    const hits = SHOWN.filter((l) => test(l.text)).map((l) => `${nodePath.relative(ROOT, l.file)}: ${l.text.slice(0, 90)}`);
    expect(hits).toEqual([]);
  });

  it('every toast ends with a full stop, or an ellipsis when it is still in progress', () => {
    const bad: string[] = [];
    const tails = (expr: import('typescript').Expression): string[] => {
      if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return [expr.text];
      if (ts.isTemplateExpression(expr)) return [expr.templateSpans[expr.templateSpans.length - 1]?.literal.text ?? expr.head.text];
      if (ts.isConditionalExpression(expr)) return [...tails(expr.whenTrue), ...tails(expr.whenFalse)];
      return [];
    };
    for (const file of SCAN_DIRS.flatMap(listFiles).filter((f) => !NOT_SHOWN.test(f.split(ROOT + '/')[1] ?? f))) {
      const sf = ts.createSourceFile(file, nodeFs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const visit = (node: import('typescript').Node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'showToast' && node.arguments[0]) {
          for (const text of tails(node.arguments[0])) {
            if (!/[.…]$/.test(text)) bad.push(`${nodePath.relative(ROOT, file)}: "${text}"`);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
    expect(bad).toEqual([]);
  });

  it('keeps the settled names on the screens that show them', () => {
    // Imported lazily so a copy file that fails to load shows up as one failing test, not a crash.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const today = require('@/features/today/copy') as { S09_COPY: { statLabel: string; offToggleLabel: string; firstHabitBannerPrefix: string } };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data = require('@/features/data/copy') as { S47_COPY: { recentlyDeleted: string }; S50_COPY: { headline: string } };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const settings = require('@/features/settings/copy') as { S49_COPY: { title: string } };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dataCopy = require('@/features/data/copy') as { S45_COPY: { title: string } };
    expect(today.S09_COPY.statLabel).toBe('Consistency');
    expect(today.S09_COPY.offToggleLabel).toBe('Emergency day off');
    expect(today.S09_COPY.firstHabitBannerPrefix).toBe('Your first task is set.');
    expect(data.S47_COPY.recentlyDeleted).toBe('Recently deleted');
    expect(data.S50_COPY.headline).toBe("We couldn't read your data on this device.");
    expect(dataCopy.S45_COPY.title).toBe('Account and sync');
    expect(settings.S49_COPY.title).toBe('Help and about');
  });
});
