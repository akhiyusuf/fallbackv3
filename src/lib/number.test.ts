/**
 * Architect-seeded golden test. Locks the PINNED rounding decision
 * (docs/ARCHITECTURE.md §6.5) from day one.
 *
 * M0 owns this file. It may be EXTENDED, never weakened — if a change here makes a
 * case pass that used to fail, the change is wrong.
 */
import { roundHalfUp, toPercent } from './number';

describe('roundHalfUp — round-half-up, pinned', () => {
  it('rounds an exact .5 tie UP', () => {
    expect(roundHalfUp(12.5)).toBe(13); // 1/8 = 12.5% -> 13%
    expect(roundHalfUp(2.5)).toBe(3); // an aggregate missed remainder of 2.5
    expect(roundHalfUp(0.5)).toBe(1);
  });

  it('rounds normally either side of the tie', () => {
    expect(roundHalfUp(86.67)).toBe(87);
    expect(roundHalfUp(83.87)).toBe(84);
    expect(roundHalfUp(84.4)).toBe(84);
    expect(roundHalfUp(66.666666667)).toBe(67);
  });
});

describe('toPercent — the PRD §3.5 worked anchors', () => {
  it('26 shown up / 26 counted (4 off, 0 missed) = 100%', () => {
    expect(toPercent(26, 26)).toBe(100);
  });

  it('26 shown up / 30 counted (4 off, 4 missed) = 87%', () => {
    expect(toPercent(26, 30)).toBe(87);
  });

  it('Flow-5: 26/31 then 27/32 both read 84%', () => {
    expect(toPercent(26, 31)).toBe(84); // 83.87..., never the stale "83.9"
    expect(toPercent(27, 32)).toBe(84); // 84.375
  });

  it('aggregate 3-day anchor: Sigma f = 1 + 1/3 over 2 counted days = 67%, NOT 50%', () => {
    const sigmaF = 2 / 2 + 1 / 3; // day 3 is fully off -> excluded from the denominator
    expect(toPercent(sigmaF, 2)).toBe(67);
    expect(toPercent(sigmaF, 2)).not.toBe(50);
  });

  it('a zero denominator is NO DATA (null), never 0%', () => {
    expect(toPercent(0, 0)).toBeNull();
    expect(toPercent(0, 0)).not.toBe(0);
  });

  it('float accumulation does not drift a tie', () => {
    // Sigma of ten 0.1-ish fractions must still land on an exact half and round up.
    const sigmaF = Array.from({ length: 5 }, () => 0.1).reduce((a, b) => a + b, 0); // 0.5 in float
    expect(toPercent(sigmaF, 4)).toBe(13); // 12.5 -> 13
  });
});
