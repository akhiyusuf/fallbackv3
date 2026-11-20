/**
 * Round 3 spec coverage (review/EDGE-BRIEF.md). PRD F27 and F13/F31: an as-needed routine's
 * "used it" log is reference-only and earns NO XP of either kind, never becomes "due", and is
 * refused once the routine is deleted. No test drove the as-needed log path through its hook.
 * The harness mirrors src/queries/edge.logging.test.tsx.
 */
jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: jest.fn(() => {
      counter += 1;
      return `00000000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`;
    }),
  };
});
jest.mock('@/db', () => require('@/queries/testSupport/dbMock'));
jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  const { clock } = require('@/queries/testSupport/clockMock');
  return { ...actual, today: () => clock.today, now: () => clock.now };
});

import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Id, Instant, LocalDate, Step, TaskWithSteps } from '@/types';
import { resolveTaskOccurrences } from '@/queries/internal';
import { fake, repos } from '@/queries/testSupport/dbMock';
import { clock } from '@/queries/testSupport/clockMock';
import { useLogAsNeededUse, useLogState } from '@/queries/mutations';

const D = (s: string) => s as LocalDate;

function at(date: string) {
  clock.today = date;
  clock.now = `${date}T12:00:00.000Z`;
}

let n = 0;
function task(overrides: Partial<TaskWithSteps> = {}): TaskWithSteps {
  n += 1;
  const id = (overrides.id ?? `asn-${n}`) as Id;
  const ideal: Step = { id: `${id}-ideal` as Step['id'], taskId: id, role: 'ideal', text: 'Do it', position: 0, dueWeekdays: null };
  const fb: Step = { id: `${id}-fallback` as Step['id'], taskId: id, role: 'fallback', text: 'Min version', position: 0, dueWeekdays: null };
  return {
    id,
    type: 'routine',
    name: 'Emergency plan',
    note: null,
    icon: 'Repeat',
    color: 'forge-orange',
    isAsNeeded: true,
    cadence: null,
    eventDate: null,
    timeOfDay: null,
    startDate: null,
    endDate: null,
    dosesPerDay: 1,
    isTracked: false,
    importance: null,
    necessity: null,
    todoDoneAt: null,
    priorityRank: null,
    isNote: false,
    snoozable: false,
    endedOn: null,
    createdAt: '2024-05-20T08:00:00.000Z' as Instant,
    updatedAt: '2024-05-20T08:00:00.000Z' as Instant,
    deletedAt: null,
    idealSteps: [ideal],
    fallbackSteps: [fb],
    ...overrides,
  } as TaskWithSteps;
}

function wrapperFor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

beforeEach(() => {
  fake.reset();
  at('2024-06-01');
});

describe('F27 — as-needed "used it" logs (spec coverage)', () => {
  it('logging the emergency plan many times earns no lifetime XP and no XP award row', async () => {
    const t = task();
    fake.seedTask(t);
    const { result } = await renderHook(() => useLogAsNeededUse(), { wrapper: wrapperFor() });
    for (let i = 0; i < 12; i++) {
      at(`2024-06-${String(1 + i).padStart(2, '0')}`);
      await act(async () => {
        await result.current.mutateAsync({ taskId: t.id, date: clock.today as LocalDate, marker: 'ideal' });
      });
    }
    expect(await repos.progress.lifetimeXp()).toBe(0);
    expect(fake.xpAwards().filter((a) => a.taskId === t.id)).toEqual([]);
  });

  it('a use logged as "fallback" earns no XP either: the reference-only log ignores the marker for XP', async () => {
    const t = task();
    fake.seedTask(t);
    const { result } = await renderHook(() => useLogAsNeededUse(), { wrapper: wrapperFor() });
    await act(async () => {
      await result.current.mutateAsync({ taskId: t.id, date: D('2024-06-01'), marker: 'fallback' });
    });
    expect(await repos.progress.lifetimeXp()).toBe(0);
    expect(fake.xpAwards()).toEqual([]);
  });

  it('a plain "used it" is kept as a reference row, not as a completion', async () => {
    const t = task();
    fake.seedTask(t);
    const { result } = await renderHook(() => useLogAsNeededUse(), { wrapper: wrapperFor() });
    await act(async () => {
      await result.current.mutateAsync({ taskId: t.id, date: D('2024-06-01'), marker: null });
    });
    const uses = await repos.asNeeded.listForTask(t.id);
    expect(uses).toHaveLength(1);
    expect(fake.xpAwards()).toEqual([]);
  });

  it('an as-needed routine is never due, so its uses never appear as an occurrence to count', async () => {
    const t = task();
    fake.seedTask(t);
    const { result } = await renderHook(() => useLogAsNeededUse(), { wrapper: wrapperFor() });
    await act(async () => {
      await result.current.mutateAsync({ taskId: t.id, date: D('2024-06-01'), marker: 'ideal' });
    });
    const occs = await resolveTaskOccurrences(repos, (await repos.tasks.get(t.id))!, D('2024-06-01'), D('2024-06-01'));
    expect(occs).toEqual([]);
  });

  it('a use on a deleted as-needed routine is refused and writes nothing', async () => {
    const t = task({ deletedAt: '2024-05-31T08:00:00.000Z' as Instant } as Partial<TaskWithSteps>);
    fake.seedTask(t);
    const { result } = await renderHook(() => useLogAsNeededUse(), { wrapper: wrapperFor() });
    let out: { ok: boolean } | undefined;
    await act(async () => {
      out = (await result.current.mutateAsync({ taskId: t.id, date: D('2024-06-01'), marker: 'ideal' })) as { ok: boolean };
    });
    expect(out?.ok).toBe(false);
    expect(await repos.asNeeded.listForTask(t.id)).toHaveLength(0);
  });

  it('uses of an as-needed routine leave a real routine\'s XP exactly as it was', async () => {
    const routine = task({ id: 'daily-1' as Id, isAsNeeded: false, cadence: { kind: 'daily' }, isTracked: true, name: 'Walk' } as Partial<TaskWithSteps>);
    fake.seedTask(routine);
    const emergency = task();
    fake.seedTask(emergency);
    const { result: log } = await renderHook(() => useLogState(), { wrapper: wrapperFor() });
    await act(async () => {
      await log.current.mutateAsync({ taskId: routine.id, date: D('2024-06-01'), chip: 'done' } as never);
    });
    const before = await repos.progress.lifetimeXp();
    const { result: use } = await renderHook(() => useLogAsNeededUse(), { wrapper: wrapperFor() });
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await use.current.mutateAsync({ taskId: emergency.id, date: D('2024-06-01'), marker: 'fallback' });
      });
    }
    expect(before).toBe(10);
    expect(await repos.progress.lifetimeXp()).toBe(before);
  });
});
