/**
 * M1 test-only double for `expo-file-system/legacy`. Same rationale as
 * `expoSqliteTestDouble.ts`: the native module resolves every call to `undefined` under
 * jest, which would let `StoreLifecycle.backup()`/`restore()` "succeed" without ever
 * actually persisting bytes — hiding real bugs rather than exercising them. This is a
 * trivial in-memory `Map<uri, string>`, deterministic, no native or npm dependency.
 */
const files = new Map<string, string>();

export const documentDirectory = 'file:///test-documents/';

export async function writeAsStringAsync(uri: string, contents: string): Promise<void> {
  files.set(uri, contents);
}

export async function readAsStringAsync(uri: string): Promise<string> {
  const content = files.get(uri);
  if (content === undefined) throw new Error(`ENOENT: no such file: ${uri}`);
  return content;
}

export async function deleteAsync(uri: string): Promise<void> {
  files.delete(uri);
}

export function __reset(): void {
  files.clear();
}
