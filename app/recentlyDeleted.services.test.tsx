/**
 * Recently deleted and the background services, through the real mutations and the real event bus:
 * a deleted task gets no reminders and is dropped from the widget snapshot; a restored one gets both
 * back. (The widget's fixed task keeps its setting while deleted, so it works again on restore.)
 */
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000000' }));
jest.mock('@/db', () => require('@/queries/testSupport/dbMock'));

const mockCancelAll = jest.fn().mockResolvedValue(undefined);
const mockSchedule = jest.fn().mockResolvedValue('id');
jest.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: () => mockCancelAll(),
  scheduleNotificationAsync: (req: unknown) => mockSchedule(req),
  getPermissionsAsync: () => Promise.resolve({ granted: true }),
  requestPermissionsAsync: () => Promise.resolve({ granted: true }),
  addNotificationResponseReceivedListener: () => ({ remove: jest.fn() }),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));
jest.mock('@/features/onboarding/progress', () => ({ clearOnboardingProgress: jest.fn().mockResolvedValue(undefined) }));

import React from 'react';
import { File, Paths } from 'expo-file-system';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { emit } from '@/lib/events';
import { makeTask } from '@/features/task/testSupport/taskFixture';
import { useDeleteForever, useDeleteTask, useRestoreTask } from '@/queries';
import { fake } from '@/queries/testSupport/dbMock';
import { initNotificationsBridge } from '@/services/notifications';
import { SNAPSHOT_FILENAME, initWidgetsBridge } from '@/services/widgets';
import type { Id } from '@/types';

const flush = () => act(async () => new Promise<void>((resolve) => setTimeout(resolve, 30)));

function remindedTaskIds(): string[] {
  const ids = mockSchedule.mock.calls.map(([req]) => (req as { content: { data: { taskId: string } } }).content.data.taskId);
  return [...new Set(ids)].sort();
}

async function snapshotTaskIds(): Promise<string[]> {
  const file = new File(Paths.document, SNAPSHOT_FILENAME);
  const contents = JSON.parse(await file.text()) as { tasks: { id: string }[]; widgetConfigs: { fixedTaskId: string | null }[] };
  return contents.tasks.map((t) => t.id).sort();
}

let client: QueryClient;
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeAll(() => {
  initNotificationsBridge();
  initWidgetsBridge();
});

beforeEach(async () => {
  fake.reset();
  fake.seedSettings({
    notifications: { master: true, routineDue: true, eventStarting: true, courseDose: true, courseEndingSoon: true, gentleReentry: false, milestoneReached: false, dailyDigest: false, dailyDigestTime: '08:00' },
    widgets: [{ size: 'small-one-task', mode: 'fixed-task', fixedTaskId: 'gone' as Id }],
  });
  fake.seedTask(makeTask({ id: 'keep' as Id, name: 'Stays put' }));
  fake.seedTask(makeTask({ id: 'gone' as Id, name: 'Soon deleted' }));
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  await flush();
  mockSchedule.mockClear();
  mockCancelAll.mockClear();
});

async function actions() {
  const hook = await renderHook(() => ({ del: useDeleteTask(), restore: useRestoreTask(), forever: useDeleteForever() }), { wrapper });
  return {
    remove: (id: string) => act(async () => void (await hook.result.current.del.mutateAsync(id as Id))),
    restore: (id: string) => act(async () => void (await hook.result.current.restore.mutateAsync(id as Id))),
    forever: (id: string) => act(async () => void (await hook.result.current.forever.mutateAsync(id as Id))),
  };
}

describe('reminders', () => {
  it('a deleted task gets no reminders, the other task keeps its own, and a restored task gets them back', async () => {
    const app = await actions();

    await app.remove('gone');
    await flush();
    expect(mockCancelAll).toHaveBeenCalled();
    expect(remindedTaskIds()).toEqual(['keep']);

    mockSchedule.mockClear();
    await app.restore('gone');
    await flush();
    expect(remindedTaskIds()).toEqual(['gone', 'keep']);
  });

  it('deleting for good keeps it out of reminders', async () => {
    const app = await actions();
    await app.remove('gone');
    await flush();
    mockSchedule.mockClear();
    await app.forever('gone');
    await flush();
    expect(remindedTaskIds()).toEqual(['keep']);
  });
});

describe('widget snapshot', () => {
  it('a deleted task is dropped from the snapshot (even as the widget\'s fixed task) and is back after restore', async () => {
    const app = await actions();
    emit({ type: 'task:changed', taskId: 'keep' as Id });
    await flush();
    expect(await snapshotTaskIds()).toEqual(['gone', 'keep']);

    await app.remove('gone');
    await flush();
    expect(await snapshotTaskIds()).toEqual(['keep']);
    // The widget setting itself is kept, so the same widget works again once restored.
    expect(fake.currentSettings().widgets[0]?.fixedTaskId).toBe('gone');

    await app.restore('gone');
    await flush();
    expect(await snapshotTaskIds()).toEqual(['gone', 'keep']);
  });
});
