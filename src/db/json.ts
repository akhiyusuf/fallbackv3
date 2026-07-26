/** M1. Small JSON (de)serialisation helpers shared by the row <-> domain mappers. */

export function parseJsonArray<T>(raw: string | null | undefined, fallback: readonly T[] = []): T[] {
  if (!raw) return [...fallback];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [...fallback];
  } catch {
    return [...fallback];
  }
}

export function toJsonArray(value: readonly unknown[] | null | undefined): string {
  return JSON.stringify(value ?? []);
}
