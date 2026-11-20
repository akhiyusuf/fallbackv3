/**
 * Round 3 spec coverage (review/EDGE-BRIEF.md). PRD F5 and F13: "the word streak and any
 * longest-run or days-in-a-row concept appear nowhere (verifiable by copy inspection)". The grep was
 * clean when checked this round, but no test guarded it. This test reads the real source files.
 */
// The app's tsconfig has no Node types, so the few Node calls used here are typed by hand (as in
// src/edge.privacy.test.ts).
interface NodeFs {
  readdirSync(path: string): string[];
  readFileSync(path: string, encoding: 'utf8'): string;
  statSync(path: string): { isDirectory(): boolean };
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readdirSync, readFileSync, statSync } = require('fs') as NodeFs;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { join } = require('path') as { join(...parts: string[]): string };
declare const __dirname: string;

const ROOTS = ['src', 'app'].map((d) => join(__dirname, '..', d));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === '__tests__' || name === 'testSupport' || name === '__fixtures__') continue;
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const FILES = ROOTS.flatMap(sourceFiles);

function hitsFor(pattern: RegExp): string[] {
  const hits: string[] = [];
  for (const file of FILES) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line: string, i: number) => {
        // Only text a person can read: skip code comments and identifiers, keep string literals.
        if (pattern.test(line) && /['"`>]/.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line)) hits.push(`${file}:${i + 1}: ${line.trim()}`);
      });
  }
  return hits;
}

describe('F5 / F13 — no streak language in anything a person can read (spec coverage)', () => {
  it('scanned a real set of source files (guards against an empty scan passing)', () => {
    expect(FILES.length).toBeGreaterThan(150);
  });

  it('the word "streak" appears in no visible string in the app', () => {
    expect(hitsFor(/streak/i)).toEqual([]);
  });

  it('no "in a row" or "days running" phrasing appears in visible copy', () => {
    expect(hitsFor(/in a row|days running|run of \d/i)).toEqual([]);
  });
});
