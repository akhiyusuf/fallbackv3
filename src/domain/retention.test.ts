/**
 * Recently deleted: the retention arithmetic (src/domain/retention.ts). Pure functions, all
 * instants are UTC ISO strings, so the device time zone must not change any answer.
 */
import { DELETED_KEEP_DAYS, daysLeft, purgeCutoff } from './retention';
import type { Instant } from '@/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const DELETED = '2026-03-01T09:00:00.000Z' as Instant;

function plusMs(instant: Instant, ms: number): Instant {
  return new Date(new Date(instant).getTime() + ms).toISOString() as Instant;
}

describe('DELETED_KEEP_DAYS', () => {
  it('is 30 days', () => {
    expect(DELETED_KEEP_DAYS).toBe(30);
  });
});

describe('purgeCutoff', () => {
  it('is exactly 30 x 24 h before now, as a UTC ISO string in the same format the app writes', () => {
    expect(purgeCutoff('2026-03-31T12:00:00.000Z' as Instant)).toBe('2026-03-01T12:00:00.000Z');
    expect(purgeCutoff('2026-03-31T12:00:00.001Z' as Instant)).toBe('2026-03-01T12:00:00.001Z');
  });

  it('spans a DST change in pure 24 h steps (no local-calendar drift)', () => {
    // Europe/London and America/* change clocks at the end of March; the cutoff must still be 720 h back.
    const now = '2026-04-30T12:00:00.000Z' as Instant;
    const cutoff = purgeCutoff(now);
    expect(new Date(now).getTime() - new Date(cutoff).getTime()).toBe(30 * DAY_MS);
    expect(cutoff).toBe('2026-03-31T12:00:00.000Z');
  });

  it('gives the same answer whatever the device time zone', () => {
    const original = process.env.TZ;
    try {
      const answers: string[] = [];
      for (const zone of ['UTC', 'Pacific/Kiritimati', 'America/Los_Angeles', 'Pacific/Pago_Pago']) {
        process.env.TZ = zone;
        answers.push(purgeCutoff('2026-03-31T00:30:00.000Z' as Instant));
      }
      expect(new Set(answers).size).toBe(1);
      expect(answers[0]).toBe('2026-03-01T00:30:00.000Z');
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it('writes the same shape the app writes (toISOString: milliseconds and a Z), so SQL string comparison matches time order', () => {
    const cutoff = purgeCutoff('2026-03-31T12:00:00.000Z' as Instant);
    expect(cutoff).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

describe('daysLeft', () => {
  it('is 30 at the instant of deleting', () => {
    expect(daysLeft(DELETED, DELETED)).toBe(30);
  });

  it('is still 30 one millisecond after deleting (ceil, not floor)', () => {
    expect(daysLeft(DELETED, plusMs(DELETED, 1))).toBe(30);
  });

  it('is 29 after exactly one day, and 1 on the last day', () => {
    expect(daysLeft(DELETED, plusMs(DELETED, DAY_MS))).toBe(29);
    expect(daysLeft(DELETED, plusMs(DELETED, 29 * DAY_MS))).toBe(1);
  });

  it('is 1 at 29.5 days (half a day left counts as one)', () => {
    expect(daysLeft(DELETED, plusMs(DELETED, 29.5 * DAY_MS))).toBe(1);
  });

  it('is 1 one millisecond before the last instant, and 0 at exactly 30 days', () => {
    expect(daysLeft(DELETED, plusMs(DELETED, 30 * DAY_MS - 1))).toBe(1);
    expect(daysLeft(DELETED, plusMs(DELETED, 30 * DAY_MS))).toBe(0);
  });

  it('is 0 after the time has passed, never negative', () => {
    expect(daysLeft(DELETED, plusMs(DELETED, 30 * DAY_MS + 1))).toBe(0);
    expect(daysLeft(DELETED, plusMs(DELETED, 400 * DAY_MS))).toBe(0);
  });

  it('never shows more than 30 days, even when the device clock was set back after deleting (deleted_at in the future)', () => {
    // A deletion stamped one day "in the future" (clock moved back since): the screen must not say 31.
    const future = plusMs(DELETED, DAY_MS);
    expect(daysLeft(future, DELETED)).toBeLessThanOrEqual(DELETED_KEEP_DAYS);
    expect(daysLeft(future, DELETED)).toBe(30);
  });

  it('does not depend on the device time zone', () => {
    const original = process.env.TZ;
    try {
      const answers: number[] = [];
      for (const zone of ['UTC', 'Pacific/Kiritimati', 'America/Los_Angeles']) {
        process.env.TZ = zone;
        answers.push(daysLeft(DELETED, plusMs(DELETED, 12 * DAY_MS + 1)));
      }
      expect(new Set(answers)).toEqual(new Set([18]));
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});
