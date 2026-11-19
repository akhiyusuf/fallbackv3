/**
 * M1 test-only. Temporary database directories for the file-backed expo-sqlite double (see
 * `expoSqliteTestDouble.ts`'s `directory` option). Node's `fs`, `os` and `path` are reached
 * through `require` with the minimal shapes used here, because this project has no
 * `@types/node` to type them against (the same reason `node-sqlite.d.ts` exists).
 */
interface NodeFs {
  mkdtempSync(prefix: string): string;
  rmSync(target: string, options?: { recursive?: boolean; force?: boolean }): void;
  writeFileSync(file: string, data: string): void;
}
interface NodePath {
  join(...parts: string[]): string;
}
interface NodeOs {
  tmpdir(): string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs') as NodeFs;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path') as NodePath;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const os = require('os') as NodeOs;

/** A new, empty directory under the OS temp dir, for one test's database file(s). */
export function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function joinPath(...parts: string[]): string {
  return path.join(...parts);
}

export function removeDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

export function removeFile(file: string): void {
  fs.rmSync(file, { force: true });
}

export function writeTextFile(file: string, data: string): void {
  fs.writeFileSync(file, data);
}
