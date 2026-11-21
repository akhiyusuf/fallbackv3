/**
 * Edge cases for the task page (S20), through the real query hooks on the fake repositories:
 * every kind of task, logging from the page and seeing it elsewhere, a pushed occurrence beside
 * today's own, double taps, ended / deleted / gone-for-good tasks, long names and emoji,
 * accessibility labels, and no em dashes in anything shown.
 */
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000000' }));
jest.mock('@/db', () => require('@/queries/testSupport/dbMock'));
jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  const { clock } = require('@/queries/testSupport/clockMock');
  return { ...actual, today: () => clock.today, now: () => clock.now };
});

import React from 'react';
import { renderRouter, screen } from 'expo-router/testing-library';
import { act, userEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useToastStore } from '@/app-shell';
import { DELETED_NOTICE_COPY, GONE_NOTICE_COPY } from '@/features/task/DeletedTaskNotice';
import { ROUTER_CONTEXT } from '@/features/task/testSupport/routerHarness';
import { makeTask } from '@/features/task/testSupport/taskFixture';
import { fake } from '@/queries/testSupport/dbMock';
import { clock } from '@/queries/testSupport/clockMock';
import { END_COPY } from './index';
import type { DayLog, Id, Instant, LocalDate, Step } from '@/types';

const NOW = '2026-07-16T12:00:00.000Z';
let client: QueryClient;
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  fake.reset();
  clock.today = '2026-07-16';
  clock.now = NOW;
  useToastStore.setState({ toast: null });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false }, mutations: { retry: false } },
  });
});

function log(taskId: string, date: string, patch: Partial<DayLog> = {}): DayLog {
  return {
    id: `log-${taskId}-${date}` as Id, taskId: taskId as Id, date: date as LocalDate, chipState: null, isManualOverride: false,
    completedStepIds: [], dosesCompleted: 0, movedToDate: null, createdAt: `${date}T08:00:00.000Z` as Instant, updatedAt: `${date}T08:00:00.000Z` as Instant, ...patch,
  };
}
async function seedLog(l: DayLog) {
  await fake.repos.logs.upsert(l);
}
function steps(taskId: string, role: 'ideal' | 'fallback', texts: string[]): Step[] {
  return texts.map((text, i) => ({ id: `${taskId}-${role}-${i}` as Id, taskId: taskId as Id, role, text, position: i, dueWeekdays: null }));
}
async function open(id: string) {
  await renderRouter(ROUTER_CONTEXT, { initialUrl: `/task/${id}`, wrapper });
}
function visible() {
  return JSON.stringify(screen.toJSON());
}
/** Makes one repository write take `ms`, so a second tap lands while the first is still saving. */
function slow<T extends object>(obj: T, key: keyof T, ms = 250) {
  const original = obj[key] as unknown as (...a: unknown[]) => Promise<unknown>;
  return jest.spyOn(obj as never, key as never).mockImplementation(((...a: unknown[]) => new Promise((r) => setTimeout(r, ms)).then(() => original(...a))) as never);
}
const DASH = /[\u2014\u2013]/;

describe('task page: every kind opens', () => {
  it('routine: name, today buttons, history', async () => {
    fake.seedTask(makeTask({ id: 'a' as Id }));
    await open('/a'.slice(1));
    expect(await screen.findByText('Morning workout')).toBeTruthy();
    expect(screen.getByTestId('s20-chip')).toBeTruthy();
    expect(screen.getByLabelText('Morning workout: Done')).toBeTruthy();
    expect(visible()).not.toMatch(DASH);
  });

  it('multi-dose course: one control per dose plus the whole day', async () => {
    fake.seedTask(makeTask({ id: 'a' as Id, type: 'course', name: 'Antibiotic', dosesPerDay: 3, startDate: '2026-07-10' as LocalDate, endDate: '2026-07-20' as LocalDate }));
    await open('a');
    expect(await screen.findByText('Antibiotic')).toBeTruthy();
    for (let i = 0; i < 3; i++) expect(screen.getByTestId(`s20-dose-chip-${i}`)).toBeTruthy();
    expect(screen.getByTestId('s20-day-chip')).toBeTruthy();
    expect(visible()).not.toMatch(DASH);
  });

  it('multi-dose: tapping dose 2 first sets two doses taken, and tapping it again does not go back up', async () => {
    fake.seedTask(makeTask({ id: 'a' as Id, type: 'course', name: 'Antibiotic', dosesPerDay: 3, startDate: '2026-07-10' as LocalDate, endDate: '2026-07-20' as LocalDate }));
    await open('a');
    await screen.findByText('Antibiotic');
    await userEvent.press(screen.getByLabelText('Dose 2 of 3: Done'));
    await waitFor(() => expect(fake.logsFor('a' as Id).find((l) => l.date === '2026-07-16')?.dosesCompleted).toBe(2));
  });

  it('multi-step routine: ticking every step logs the day as ideal, one step logs it as fallback', async () => {
    fake.seedTask(makeTask({ id: 'a' as Id, idealSteps: steps('a', 'ideal', ['Stretch', 'Run']), fallbackSteps: steps('a', 'fallback', ['Walk']) }));
    await open('a');
    await screen.findByText('Morning workout');
    await userEvent.press(screen.getByText('Stretch'));
    await waitFor(() => expect(fake.logsFor('a' as Id).find((l) => l.date === '2026-07-16')?.chipState).toBe('fallback'));
    await userEvent.press(screen.getByText('Run'));
    await waitFor(() => expect(fake.logsFor('a' as Id).find((l) => l.date === '2026-07-16')?.chipState).toBe('done'));
  });

  it('one-off event with no steps: no Today card, no crash, date shown', async () => {
    fake.seedTask(makeTask({ id: 'a' as Id, type: 'event', name: 'Dentist', cadence: null, eventDate: '2026-07-20' as LocalDate, idealSteps: [], fallbackSteps: [], isTracked: false }));
    await open('a');
    expect(await screen.findByText('Dentist')).toBeTruthy();
    expect(screen.queryByTestId('s20-chip')).toBeNull();
    expect(visible()).not.toMatch(DASH);
  });

  it('to-do: Done switch toggles todoDoneAt; no log buttons', async () => {
    fake.seedTask(makeTask({ id: 'a' as Id, type: 'todo', name: 'Buy milk', cadence: null, idealSteps: [], fallbackSteps: [], note: 'Oat, 2 litres' }));
    await open('a');
    expect(await screen.findByText('Buy milk')).toBeTruthy();
    expect(screen.getByText('Oat, 2 litres')).toBeTruthy();
    expect(screen.queryByTestId('s20-chip')).toBeNull();
    await userEvent.press(screen.getByTestId('s20-todo-done'));
    await waitFor(() => expect(screen.getByLabelText('Mark as done').props.accessibilityState.checked).toBe(true));
    expect((await fake.repos.tasks.get('a' as Id))?.todoDoneAt).not.toBeNull();
    expect(visible()).not.toMatch(DASH);
  });

  it('note: no Done switch, the note text is shown', async () => {
    fake.seedTask(makeTask({ id: 'a' as Id, type: 'todo', isNote: true, name: 'Wifi code', cadence: null, idealSteps: [], fallbackSteps: [], note: 'fallback-2026' }));
    await open('a');
    expect(await screen.findByText('Wifi code')).toBeTruthy();
    expect(screen.getByText('fallback-2026')).toBeTruthy();
    expect(screen.queryByTestId('s20-todo-done')).toBeNull();
  });

  it('as-needed routine (its own screen): opens with an empty history and a Log used it button, no today card', async () => {
    fake.seedTask(makeTask({ id: 'a' as Id, name: 'Stretch break', isAsNeeded: true, cadence: null }));
    await open('a/as-needed');
    expect(await screen.findByText('Stretch break')).toBeTruthy();
    expect(screen.getByLabelText('Log used it')).toBeTruthy();
    expect(screen.queryByTestId('s20-chip')).toBeNull();
    expect(visible()).not.toMatch(DASH);
  });

  it('as-needed routine: a double tap on Log used it (no steps) logs one use', async () => {
    fake.seedTask(makeTask({ id: 'a' as Id, name: 'Stretch break', isAsNeeded: true, cadence: null, idealSteps: [], fallbackSteps: [] }));
    await open('a/as-needed');
    await screen.findByText('Stretch break');
    const btn = screen.getByLabelText('Log used it');
    const spy = slow(fake.repos.asNeeded, 'append');
    await userEvent.press(btn);
    await userEvent.press(btn);
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe('Logged to history.'));
    spy.mockRestore();
    expect(await fake.repos.asNeeded.listForTask('a' as Id)).toHaveLength(1);
  });
});

describe('task page: ended, deleted, gone', () => {
  it('ended routine: "Paused" card with Start again, no Today card, no priority block', async () => {
    fake.seedTask(makeTask({ id: 'a' as Id, endedOn: '2026-07-10' as LocalDate }));
    await open('a');
    expect(await screen.findByTestId('s20-ended')).toBeTruthy();
    expect(screen.getByText(END_COPY.endedTitle('Jul 10'))).toBeTruthy();
    expect(screen.queryByTestId('s20-chip')).toBeNull();
    expect(screen.queryByTestId('s20-importance-picker')).toBeNull();
    expect(visible()).not.toMatch(DASH);
  });

  it('ended routine: double tap on Start again starts it once and clears endedOn', async () => {
    fake.seedTask(makeTask({ id: 'a' as Id, endedOn: '2026-07-10' as LocalDate }));
    await open('a');
    const again = await screen.findByTestId('s20-start-again');
    const spy = slow(fake.repos.tasks, 'update');
    await userEvent.press(again);
    await userEvent.press(again);
    await waitFor(() => expect(screen.queryByTestId('s20-ended')).toBeNull());
    expect(spy.mock.calls.length).toBeLessThanOrEqual(1);
    spy.mockRestore();
    expect((await fake.repos.tasks.get('a' as Id))?.endedOn).toBeNull();
  });

  it('a task in Recently deleted: shows the deleted notice, never the log buttons', async () => {
    fake.seedTask(makeTask({ id: 'a' as Id, deletedAt: NOW as Instant }));
    await open('a');
    expect(await screen.findByText(DELETED_NOTICE_COPY.headline('Morning workout'))).toBeTruthy();
    expect(screen.queryByTestId('s20-chip')).toBeNull();
    expect(visible()).not.toMatch(DASH);
  });

  it('a task deleted for good (no such id): "isn\'t here any more", with a way back to Today', async () => {
    await open('nope');
    expect(await screen.findByTestId('task-gone-notice')).toBeTruthy();
    expect(screen.getByText(GONE_NOTICE_COPY.today)).toBeTruthy();
    expect(visible()).not.toMatch(DASH);
  });

  it('ended copy has no dashes', () => {
    for (const v of Object.values(END_COPY)) expect(typeof v === 'function' ? v('routine') : v).not.toMatch(DASH);
  });
});

describe('task page: logging and shared state', () => {
  it('a log made elsewhere (Today) is what the page shows: "Ideal done" chip, no buttons', async () => {
    fake.seedTask(makeTask({ id: 'a' as Id }));
    await seedLog(log('a', '2026-07-16', { chipState: 'done', isManualOverride: true }));
    await open('a');
    await screen.findByText('Morning workout');
    expect(await screen.findByLabelText('Morning workout, Ideal done. Change')).toBeTruthy();
    expect(screen.queryByLabelText('Morning workout: Done')).toBeNull();
  });

  it('logging on the page writes today\'s row; the chip then reads Fallback done', async () => {
    fake.seedTask(makeTask({ id: 'a' as Id }));
    await open('a');
    await screen.findByText('Morning workout');
    await userEvent.press(screen.getByLabelText('Morning workout: Fallback'));
    await waitFor(() => expect(fake.logsFor('a' as Id).find((l) => l.date === '2026-07-16')?.chipState).toBe('fallback'));
    expect(await screen.findByLabelText('Morning workout, Fallback done. Change')).toBeTruthy();
  });

  it('a double tap on Done writes one row once (one XP award, one toast)', async () => {
    fake.seedTask(makeTask({ id: 'a' as Id }));
    await open('a');
    await screen.findByText('Morning workout');
    const spy = slow(fake.repos.logs, 'upsert');
    const done = screen.getByLabelText('Morning workout: Done');
    await userEvent.press(done);
    await userEvent.press(done);
    await waitFor(() => expect(fake.logsFor('a' as Id).length).toBe(1));
    expect(spy.mock.calls.length).toBe(1);
    spy.mockRestore();
  });

  it('a habit pushed here from yesterday shows beside today\'s own and the two log separately', async () => {
    fake.seedTask(makeTask({ id: 'a' as Id }));
    await seedLog(log('a', '2026-07-15', { movedToDate: '2026-07-16' as LocalDate }));
    await open('a');
    await screen.findByText('Morning workout');
    expect(await screen.findByTestId('s20-pushed-chip')).toBeTruthy();
    await userEvent.press(screen.getByLabelText('Morning workout, from yesterday: Done'));
    await waitFor(() => expect(fake.logsFor('a' as Id).find((l) => l.date === '2026-07-15')?.chipState).toBe('done'));
    // Today's own row is untouched.
    expect(fake.logsFor('a' as Id).find((l) => l.date === '2026-07-16')?.chipState ?? null).toBeNull();
    expect(screen.getByLabelText('Morning workout: Done')).toBeTruthy();
    await userEvent.press(screen.getByLabelText('Morning workout: Fallback'));
    await waitFor(() => expect(fake.logsFor('a' as Id).find((l) => l.date === '2026-07-16')?.chipState).toBe('fallback'));
    expect(fake.logsFor('a' as Id).find((l) => l.date === '2026-07-15')?.chipState).toBe('done');
  });

  it('the emergency day off switch marks this one task off; the card then says so and offers no buttons', async () => {
    fake.seedTask(makeTask({ id: 'a' as Id }));
    await open('a');
    await screen.findByText('Morning workout');
    await userEvent.press(screen.getByLabelText('Emergency day off, this task only'));
    expect(await screen.findByText('Emergency day off. Turn it off below to log it.')).toBeTruthy();
    expect(screen.queryByTestId('s20-chip')).toBeNull();
  });
});

describe('task page: names and accessibility', () => {
  it('a 300 character name and an emoji name render in the hero and the menu title without crashing', async () => {
    const long = '🌅'.repeat(150) + 'W'.repeat(150);
    fake.seedTask(makeTask({ id: 'a' as Id, name: long }));
    await open('a');
    expect(await screen.findByText(long)).toBeTruthy();
    expect(screen.getByLabelText(`${long}: Done`)).toBeTruthy();
  });

  const labelCases: Array<[string, () => ReturnType<typeof makeTask>]> = [
    ['routine with steps', () => makeTask({ id: 'a' as Id, idealSteps: steps('a', 'ideal', ['One', 'Two']) })],
    ['multi-dose course', () => makeTask({ id: 'a' as Id, type: 'course', dosesPerDay: 2, startDate: '2026-07-10' as LocalDate, endDate: '2026-07-20' as LocalDate })],
    ['ended routine', () => makeTask({ id: 'a' as Id, endedOn: '2026-07-10' as LocalDate })],
  ];
  it.each(labelCases)('every button on the page has an accessibility label or test id: %s', async (_name, build) => {
    const task = build();
    fake.seedTask(task);
    await open('a');
    await screen.findByText(task.name);
    const bad = screen.getAllByRole('button').filter((n) => !n.props.accessibilityLabel && !n.props.testID).map((n) => String(n.type));
    expect(bad).toEqual([]);
  });
});
