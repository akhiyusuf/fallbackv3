/**
 * Round 3 fuzzing, app project (review brief 34). Seeded generators, thousands of cases per
 * property; each failure names the property, seed and case so it can be replayed.
 * Covers: the SSE parser (every chunk boundary), the guardrail classifier (random unicode),
 * backup envelope validation (junk JSON, prototype keys, structural mutations), the lib/date
 * versus domain date math agreement (including DST zones), cadence labels, and rounding.
 */
import { CURRENT_SCHEMA_VERSION } from '@/db/migrations';
import { BACKUP_TABLES, validateBackupEnvelope } from '@/db/backupEnvelope';
import { cadenceLabel } from '@/features/browse/format';
import { cadenceSummary } from '@/features/task/cadenceLabel';
import * as lib from '@/lib/date';
import { roundHalfUp, toPercent } from '@/lib/number';
import { classifyGuardrail } from '@/services/ai/guardrails';
import { parseEventStream } from '@/services/ai/sse';
import * as dm from '@/domain/dateMath';
import type { Cadence, LocalDate, Weekday } from '@/types';

/* ----------------------------------------------------------------- seeded generator */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo: number, hi: number): number => lo + Math.floor(next() * (hi - lo + 1)),
    bool: (p = 0.5): boolean => next() < p,
    pick: <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)] as T,
  };
}
type Rng = ReturnType<typeof mulberry32>;

/** Runs `cases` seeded cases; a failure is re-thrown with its seed for replay. */
function property(name: string, cases: number, body: (r: Rng, i: number) => void | Promise<void>): Promise<void> {
  return (async () => {
    for (let i = 0; i < cases; i++) {
      const seed = (0xfa11b000 + i * 104729) >>> 0;
      try {
        await body(mulberry32(seed), i);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`[${name}] seed=${seed} (case ${i}): ${msg}`);
      }
    }
  })();
}

/* ================================================================= SSE parser */

const FRAMES: unknown[] = [
  { type: 'text-delta', delta: 'héllo 🔥 日本語 "quoted" \\ back' },
  { type: 'tool', name: 'addTask', input: { name: 'Stretch 🧘', notes: 'line\nbreak   sep' } },
  { type: 'text-delta', delta: '' },
  { type: 'done', summary: 'ok ✅' },
];

const te = new TextEncoder();

function streamOf(chunks: readonly Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (const chunk of chunks) c.enqueue(chunk);
      c.close();
    },
  });
}

async function collect(chunks: readonly Uint8Array[]): Promise<unknown[]> {
  const out: unknown[] = [];
  for await (const e of parseEventStream(streamOf(chunks))) out.push(e);
  return out;
}

const LF_STREAM = `: keep-alive\n\n${FRAMES.map((f) => `data: ${JSON.stringify(f)}\n\n`).join('')}`;
const CRLF_STREAM = `: keep-alive\r\n\r\n${FRAMES.map((f) => `data: ${JSON.stringify(f)}\r\n\r\n`).join('')}`;
const JUNK_FRAME_STREAM = `data: {not json}\n\n${LF_STREAM}data:\n\n`;

describe('fuzz: SSE parser (services/ai/sse.ts)', () => {
  it.each([
    ['LF', LF_STREAM],
    ['CRLF', CRLF_STREAM],
    ['with a malformed frame and an empty data line', JUNK_FRAME_STREAM],
  ])('splitting a %s stream at every single byte position yields the same events', async (_label, text) => {
    const bytes = te.encode(text);
    expect(await collect([bytes])).toEqual(FRAMES);
    for (let cut = 0; cut <= bytes.length; cut++) {
      const got = await collect([bytes.slice(0, cut), bytes.slice(cut)]);
      if (JSON.stringify(got) !== JSON.stringify(FRAMES)) {
        throw new Error(`two-chunk split at byte ${cut} of ${bytes.length} changed the events`);
      }
    }
  });

  it('one byte per chunk yields the same events', async () => {
    const bytes = te.encode(LF_STREAM);
    const chunks = Array.from(bytes, (b) => new Uint8Array([b]));
    expect(await collect(chunks)).toEqual(FRAMES);
  });

  it('random multi-way splits (cuts placed anywhere, including inside multi-byte characters) keep the events (400 cases)', async () => {
    const bytes = te.encode(LF_STREAM);
    await property('sse random splits', 400, async (r) => {
      const cuts = Array.from({ length: r.int(1, 40) }, () => r.int(0, bytes.length)).sort((a, b) => a - b);
      const chunks: Uint8Array[] = [];
      let prev = 0;
      for (const c of cuts) {
        chunks.push(bytes.slice(prev, c));
        prev = c;
      }
      chunks.push(bytes.slice(prev));
      expect(await collect(chunks)).toEqual(FRAMES);
    });
  });

  it('random garbage byte streams never throw and only ever yield parsed JSON values (300 cases)', async () => {
    await property('sse garbage', 300, async (r) => {
      const n = r.int(0, 3000);
      const bytes = new Uint8Array(n);
      for (let i = 0; i < n; i++) bytes[i] = r.bool(0.3) ? 0x0a : r.int(0, 255);
      const events = await collect([bytes]);
      for (const e of events) expect(e === null || ['object', 'number', 'string', 'boolean'].includes(typeof e)).toBe(true);
    });
  });

  it('a large (1 MB) frame survives being cut into 64 KB pieces', async () => {
    const big = { type: 'text-delta', delta: '🔥'.repeat(300_000) };
    const bytes = te.encode(`data: ${JSON.stringify(big)}\n\n`);
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < bytes.length; i += 65536) chunks.push(bytes.slice(i, i + 65536));
    expect(await collect(chunks)).toEqual([big]);
  });
});

/* ================================================================= guardrail classifier */

const CATEGORIES = [null, 'self-harm', 'harm-to-others', 'illegal-activity', 'medical-advice', 'disordered-eating'];

/** Random code units across the whole BMP, lone surrogates included, plus astral and combining marks. */
function randomUnicode(r: Rng, len: number): string {
  const pool = [
    () => r.int(0x20, 0x7e),
    () => r.int(0, 0xffff),
    () => r.pick([0xd800, 0xdbff, 0xdc00, 0xdfff, 0x200d, 0x0301, 0x202e, 0x0000, 0xfeff, 0x00a0]),
    () => r.int(0x1f300, 0x1faff), // emoji, as surrogate pairs
  ];
  let s = '';
  for (let i = 0; i < len; i++) {
    const cp = r.pick(pool)();
    s += String.fromCodePoint(cp >= 0 && cp <= 0x10ffff ? cp : 0xfffd);
  }
  return s;
}

describe('fuzz: guardrail classifier (services/ai/guardrails.ts)', () => {
  it('never throws on random unicode and always returns a well-formed result (3000 cases)', async () => {
    await property('classifyGuardrail random unicode', 3000, (r) => {
      const text = randomUnicode(r, r.int(0, r.bool(0.05) ? 20000 : 200));
      const res = classifyGuardrail(text);
      expect(CATEGORIES).toContain(res.category);
      expect(typeof res.hasLiteralLoggingRequest).toBe('boolean');
    });
  });

  it('neutral habit talk with no keywords is never flagged (2000 cases)', async () => {
    const WORDS = ['tea', 'walk', 'read', 'water', 'music', 'garden', 'sleep', 'plan', 'stretch', 'lunch', 'bread', 'today'];
    await property('neutral text not flagged', 2000, (r) => {
      const text = Array.from({ length: r.int(0, 30) }, () => r.pick(WORDS)).join(r.pick([' ', ', ', '. ', '\n']));
      expect(classifyGuardrail(text)).toEqual({ category: null, hasLiteralLoggingRequest: false });
    });
  });

  it('a literal logging phrase is flagged as literal whatever surrounds it (1000 cases)', async () => {
    const LITERAL = ['add', 'create', 'remind me', 'log', 'set up', 'schedule'];
    await property('literal request detected', 1000, (r) => {
      const before = randomUnicode(r, r.int(0, 20)).replace(/[a-z]/gi, '');
      const after = randomUnicode(r, r.int(0, 20)).replace(/[a-z]/gi, '');
      expect(classifyGuardrail(`${before} ${r.pick(LITERAL)} ${after}`).hasLiteralLoggingRequest).toBe(true);
    });
  });

  it('long inputs without a keyword finish quickly', () => {
    for (const text of ['a'.repeat(50_000), ' '.repeat(50_000) + 'hurt', 'is '.repeat(4_000)]) {
      const started = Date.now();
      classifyGuardrail(text);
      expect(Date.now() - started).toBeLessThan(2000);
    }
  });

  // Found by this fuzzing round (review 34), guardrails.ts (not owned here). The medical rule
  // /is .* the right dose/ restarts a scan at every "is " in the message, so the cost grows with the
  // square of the input length: about 1 s at 72 KB of "is " and several seconds at 150 KB. A long
  // paste in the chat composer can freeze the JS thread. Expected fix: bound the gap (e.g. .{0,200})
  // or test for "the right dose" first.
  it.failing('a 150 KB input of "is " is classified in under 2 seconds (no quadratic scan)', () => {
    const started = Date.now();
    classifyGuardrail('is '.repeat(50_000));
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

/* ================================================================= backup envelope */

function baseEnvelope(): Record<string, unknown> {
  const tables: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) tables[t] = [];
  tables.settings = [{ id: 1, theme: 'system' }];
  tables.cycle_state = [{ id: 1 }];
  return {
    format: 'fallback-backup',
    formatVersion: 1,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: '2026-01-01T00:00:00.000Z',
    tables,
  };
}

/** A tree of random JSON-ish values, deep and wide where asked, with prototype-shaped keys. */
function junkJson(r: Rng, depth: number): unknown {
  const keys = ['format', 'formatVersion', 'schemaVersion', 'createdAt', 'tables', '__proto__', 'constructor', 'settings', 'task', 'x'];
  if (depth > 6) return r.pick([null, 1, 'a', true]);
  switch (r.int(0, 7)) {
    case 0:
      return null;
    case 1:
      return r.pick([0, -1, 1, 1.5, 8, 9, 1e308, '1', '8', 'fallback-backup', '']);
    case 2:
      return r.bool();
    case 3:
      return Array.from({ length: r.int(0, 6) }, () => junkJson(r, depth + 1));
    default: {
      const o: Record<string, unknown> = {};
      for (let i = 0, n = r.int(0, 6); i < n; i++) o[r.pick(keys)] = junkJson(r, depth + 1);
      return o;
    }
  }
}

describe('fuzz: validateBackupEnvelope (db/backupEnvelope.ts)', () => {
  it('the baseline envelope is accepted', () => {
    expect(validateBackupEnvelope(baseEnvelope()).ok).toBe(true);
  });

  it('never throws on random JSON shapes and always returns a Result (5000 cases)', async () => {
    await property('validateBackupEnvelope junk', 5000, (r) => {
      // Round-trip through JSON so the input is exactly what a backup file can hold (no
      // null-prototype objects, no functions), including the literal "__proto__" key.
      const parsed: unknown = JSON.parse(JSON.stringify(junkJson(r, 0)));
      let res: ReturnType<typeof validateBackupEnvelope> | undefined;
      expect(() => {
        res = validateBackupEnvelope(parsed);
      }).not.toThrow();
      expect(typeof res!.ok).toBe('boolean');
    });
  });

  it('never throws on a deeply nested or prototype-keyed document, and does not pollute Object.prototype', () => {
    const deep = JSON.parse('['.repeat(500) + ']'.repeat(500));
    expect(validateBackupEnvelope(deep).ok).toBe(false);
    const proto = JSON.parse(
      '{"format":"fallback-backup","formatVersion":1,"schemaVersion":8,"createdAt":"x","tables":{"__proto__":{"polluted":true},"constructor":[],"settings":[{"id":1}],"cycle_state":[{"id":1}]}}',
    );
    expect(() => validateBackupEnvelope(proto)).not.toThrow();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted')).toBe(false);
  });

  it('accepts a 20,000-row table quickly', () => {
    const env = baseEnvelope();
    (env.tables as Record<string, unknown[]>).task = Array.from({ length: 20_000 }, (_, i) => ({ id: `t${i}` }));
    const started = Date.now();
    expect(validateBackupEnvelope(env).ok).toBe(true);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  // Each mutation makes the envelope structurally wrong. None of them may be accepted.
  const MUTATIONS: readonly [string, (e: Record<string, any>) => void][] = [
    ['no format', (e) => delete e.format],
    ['foreign format', (e) => (e.format = 'other-app')],
    ['formatVersion as a string', (e) => (e.formatVersion = '1')],
    ['formatVersion 0', (e) => (e.formatVersion = 0)],
    ['formatVersion from a future format', (e) => (e.formatVersion = 2)],
    ['schemaVersion as a string', (e) => (e.schemaVersion = '8')],
    ['schemaVersion 0', (e) => (e.schemaVersion = 0)],
    ['schemaVersion negative', (e) => (e.schemaVersion = -3)],
    ['schemaVersion fractional', (e) => (e.schemaVersion = 1.5)],
    ['schemaVersion newer than the app', (e) => (e.schemaVersion = CURRENT_SCHEMA_VERSION + 1)],
    ['createdAt as a number', (e) => (e.createdAt = 1700000000)],
    ['tables null', (e) => (e.tables = null)],
    ['tables an array', (e) => (e.tables = [])],
    ['a table not an array', (e) => (e.tables.task = { id: 'x' })],
    ['a table row that is null', (e) => (e.tables.task = [null])],
    ['a table row that is a number', (e) => (e.tables.task = [7])],
    ['a table row that is a string', (e) => (e.tables.task = ['row'])],
    ['a table row that is an array', (e) => (e.tables.task = [[1, 2]])],
    ['settings with no rows', (e) => (e.tables.settings = [])],
    ['settings with two rows', (e) => (e.tables.settings = [{ id: 1 }, { id: 1 }])],
    ['settings id as a string', (e) => (e.tables.settings = [{ id: '1' }])],
    ['settings id 2', (e) => (e.tables.settings = [{ id: 2 }])],
    ['cycle_state missing', (e) => delete e.tables.cycle_state],
    ['cycle_state with no rows', (e) => (e.tables.cycle_state = [])],
  ];

  it.each(MUTATIONS)('rejects a structurally wrong envelope: %s', (_label, mutate) => {
    const env = baseEnvelope();
    mutate(env);
    expect(validateBackupEnvelope(env).ok).toBe(false);
  });

  it('a valid envelope with random extra fields still validates or fails cleanly (1000 cases)', async () => {
    await property('extra fields', 1000, (r) => {
      const env = baseEnvelope();
      env[r.pick(['x', 'extra', '__proto__'])] = junkJson(r, 0);
      expect(validateBackupEnvelope(env).ok).toBe(true);
    });
  });
});

/* ================================================================= lib/date vs domain date math */

const ZONES = ['UTC', 'America/New_York', 'Europe/London', 'Australia/Lord_Howe', 'America/Santiago', 'Asia/Tehran'];

describe('fuzz: lib/date (date-fns, device local) agrees with domain/dateMath (pure)', () => {
  const originalTz = process.env.TZ;
  afterAll(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it.each(ZONES)('in %s, every calendar operation agrees (300 cases per zone)', async (zone) => {
    process.env.TZ = zone;
    await property(`lib vs domain in ${zone}`, 300, (r) => {
      const y = r.int(1970, 2100);
      const m = r.int(1, 12);
      const d = r.int(1, new Date(Date.UTC(y, m, 0)).getUTCDate());
      const date = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` as LocalDate;
      const n = r.int(-40000, 40000);
      expect(lib.addDays(date, n)).toBe(dm.addDays(date, n));
      expect(lib.addMonths(date, n % 400)).toBe(dm.addMonths(date, n % 400));
      expect(lib.addYears(date, n % 90)).toBe(dm.addYears(date, n % 90));
      expect(lib.weekdayOf(date)).toBe(dm.weekdayOf(date));
      expect(lib.startOfWeek(date)).toBe(dm.startOfWeek(date));
      expect(lib.endOfWeek(date)).toBe(dm.endOfWeek(date));
      expect(lib.startOfMonth(date)).toBe(dm.startOfMonth(date));
      expect(lib.endOfMonth(date)).toBe(dm.endOfMonth(date));
      // The two diffs have opposite sign by design (see dateMath.ts's SIGN WARNING).
      expect(lib.diffDays(date, lib.addDays(date, n))).toBe(-n);
    });
    process.env.TZ = originalTz ?? 'UTC';
  });
});

/* ================================================================= cadence labels */

const ordinalSuffix = (n: number): string => {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  return ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
};

function randomValidCadence(r: Rng): Cadence {
  const anchorDate = '2026-03-01' as LocalDate;
  const weekday = () => r.int(1, 7) as Weekday;
  switch (r.int(0, 6)) {
    case 0:
      return { kind: 'daily' };
    case 1:
      return { kind: 'specific-weekdays', weekdays: Array.from({ length: r.int(1, 7) }, weekday) };
    case 2:
      return { kind: 'weekly', weekday: weekday(), anchorDate };
    case 3:
      return { kind: 'bi-weekly', weekday: weekday(), anchorDate };
    case 4:
      return { kind: 'monthly', dayOfMonth: r.int(1, 31), anchorDate };
    case 5:
      return { kind: 'bi-monthly', dayOfMonth: r.int(1, 31), anchorDate };
    default:
      return { kind: 'yearly', month: r.int(1, 12), dayOfMonth: r.int(1, 31), anchorDate };
  }
}

describe('fuzz: cadence labels', () => {
  it('ordinal suffixes are right for every day of the month', () => {
    for (let n = 1; n <= 31; n++) {
      const label = cadenceSummary({ type: 'routine', cadence: { kind: 'monthly', dayOfMonth: n, anchorDate: '2026-01-01' as LocalDate }, isAsNeeded: false, eventDate: null });
      expect(label).toBe(`Routine · Monthly · ${n}${ordinalSuffix(n)}`);
    }
  });

  it('cadenceSummary is never empty and never shows undefined, NaN or null (3000 cases)', async () => {
    await property('cadenceSummary', 3000, (r) => {
      const type = r.pick(['routine', 'event', 'course', 'todo'] as const);
      const cadence = type === 'todo' ? null : r.bool(0.1) ? null : randomValidCadence(r);
      const label = cadenceSummary({ type, cadence, isAsNeeded: type === 'routine' && r.bool(0.2), eventDate: null });
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toMatch(/undefined|NaN|null/);
    });
  });

  it('browse cadenceLabel is never empty for any valid cadence and never shows undefined (2000 cases)', async () => {
    await property('browse cadenceLabel', 2000, (r) => {
      const label = cadenceLabel(randomValidCadence(r));
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toMatch(/undefined|NaN|null/);
    });
  });

  // Found by this fuzzing round (review 34). The task label de-duplicates a repeated weekday
  // (its own comment says so); the browse label does not, so a repeated weekday shows twice.
  it('browse cadenceLabel does not repeat a weekday when the set contains a duplicate', () => {
    expect(cadenceLabel({ kind: 'specific-weekdays', weekdays: [1, 1, 2] })).not.toMatch(/Mon.*Mon/);
  });
});

/* ================================================================= rounding (lib/number) */

describe('fuzz: percentage rounding never leaves 0-100 for a numerator within the denominator', () => {
  it('toPercent(n, d) is an integer in [0, 100] for 0 <= n <= d (3000 cases)', async () => {
    await property('toPercent range', 3000, (r) => {
      const d = r.int(1, 5000);
      const n = r.int(0, d);
      const p = toPercent(n, d);
      expect(Number.isInteger(p)).toBe(true);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
      expect(roundHalfUp(n)).toBe(n);
    });
  });
});
