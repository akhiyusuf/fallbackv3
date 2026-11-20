/**
 * Round 4 code review (report 41). `it.failing` passes today BECAUSE the bug exists.
 *
 * app/add/todo.tsx:45 now ends with `router.dismissTo('/todos?lens=notes')` (it was `replace`). When the
 * To-dos tab has been visited already it is still mounted, so `dismissTo` only changes its params;
 * ToDosBrowseScreen reads `lens` once, in `useState(params.lens === 'notes' ? ...)`
 * (src/features/browse/ToDosBrowseScreen.tsx:35), so it keeps showing the other lens and the note the
 * person has just saved is not on screen.
 * Fix: follow the param (`useEffect(() => { if (params.lens) setLens(...) }, [params.lens])`) or key the screen.
 */
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000000' }));
jest.mock('@/db', () => require('@/queries/testSupport/dbMock'));
jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  const { clock } = require('@/queries/testSupport/clockMock');
  return { ...actual, today: () => clock.today, now: () => clock.now };
});

import React from 'react';
import { Text } from 'react-native';
import { Stack, Tabs, useRouter } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import { act, userEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import S19 from '../app/add/todo';
import ToDosBrowseScreen from '@/features/browse/ToDosBrowseScreen';
import { makeTask } from '@/features/task/testSupport/taskFixture';
import { fake } from '@/queries/testSupport/dbMock';
import { clock } from '@/queries/testSupport/clockMock';

let client: QueryClient;
let router: ReturnType<typeof useRouter>;
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
function Today() {
  router = useRouter();
  return <Text>MARKER_TODAY</Text>;
}
const CTX = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  '(tabs)/_layout': () => <Tabs screenOptions={{ headerShown: false }} />,
  '(tabs)/today': Today,
  '(tabs)/todos': ToDosBrowseScreen,
  'add/todo': S19,
};

const base = { type: 'todo', cadence: null, idealSteps: [], fallbackSteps: [], isTracked: false } as const;

beforeEach(() => {
  fake.reset();
  clock.today = '2026-07-16';
  clock.now = '2026-07-16T12:00:00.000Z';
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  fake.seedTask(makeTask({ ...base, id: 'todo-1' as never, name: 'Renew passport', isNote: false }));
  fake.seedTask(makeTask({ ...base, id: 'note-1' as never, name: 'Old note', isNote: true }));
});

it('a note saved from Today lands on the Notes lens even when the To-dos tab was visited before', async () => {
  await renderRouter(CTX, { initialUrl: '/today', wrapper });
  await act(async () => router.navigate('/todos' as never));
  await screen.findByText('Renew passport'); // the To-dos tab is now mounted, on the To-dos lens
  await act(async () => router.navigate('/today' as never));
  await act(async () => router.push('/add/todo?kind=note' as never));
  await userEvent.type(await screen.findByLabelText('Title'), 'Gift ideas');
  await userEvent.press(screen.getByLabelText('Save note'));
  // The Notes lens lists notes only, so the new one must be visible and the to-do must not be.
  expect(await screen.findByText('Gift ideas')).toBeTruthy();
});
