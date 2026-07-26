/**
 * M0. The ONE rounding function every percentage in this app passes through.
 * Pinned in docs/ARCHITECTURE.md §6.5 — round-half-up, single rounding at the very end.
 * Do not reimplement, do not inline `Math.round`.
 */

/** Snap to 9 decimal places so an exact .5 tie survives float representation. */
export function snap(value: number): number {
  return Number(value.toFixed(9));
}

/** round-half-up: 12.5 -> 13, 2.5 -> 3, 86.67 -> 87, 83.87 -> 84. Non-negative inputs only. */
export function roundHalfUp(value: number): number {
  return Math.floor(snap(value) + 0.5);
}

/**
 * The single percentage formula. `denominator === 0` returns null == "no data yet",
 * NEVER 0% (PRD §3.5 edge case).
 */
export function toPercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return roundHalfUp(snap((numerator * 100) / denominator));
}
