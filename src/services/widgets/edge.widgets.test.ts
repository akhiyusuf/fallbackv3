/**
 * Edge-case campaign (review/EDGE-BRIEF.md, area 22): the widget snapshot the native widgets read.
 * Same mock harness as `index.test.ts`; plain jest.
 */
import { AppState, Appearance } from 'react-native';
import { File, Paths } from 'expo-file-system';

import { addDays, today } from '@/lib/date';

const mockSettingsGet = jest.fn();
const mockTasksList = jest.fn();
const mockOffDaysListRange = jest.fn();
const logsByDate = new Map<string, unknown[]>();
const mockLogsListForDate = jest.fn((date: string) => Promise.resolve(logsByDate.get(date) ?? []));

jest.mock('@/db', () => ({
  repos: {
    settings: { get: () => mockSettingsGet() },
    tasks: { list: () => mockTasksList() },
    offDays: { listRange: () => mockOffDaysListRange() },
    logs: { listForDate: (date: string) => mockLogsListForDate(date) },
  },
}));

const BASE_SETTINGS = { theme: 'light', accent: 'forge-orange', widgets: [] };
const TODAY = today();
const YESTERDAY = addDays(TODAY, -1);
const flush = () => new Promise<void>((resolve) => setImmediate(() => resolve()));

function habit(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    type: 'routine',
    name: `Habit ${id}`,
    isAsNeeded: false,
    cadence: { kind: 'daily' },
    timeOfDay: null,
    endDate: null,
    endedOn: null,
    deletedAt: null,
    idealSteps: [],
    fallbackSteps: [],
    dosesPerDay: 1,
    createdAt: `${addDays(TODAY, -30)}T08:00:00.000Z`,
    ...over,
  };
}

function manualLog(taskId: string, chipState: string, date = TODAY) {
  return { taskId, date, chipState, isManualOverride: true, completedStepIds: [], dosesCompleted: 0, movedToDate: null, createdAt: '', updatedAt: '' };
}

async function publishAndRead(): Promise<any> {
  const { widgets, SNAPSHOT_FILENAME } = require('./index') as typeof import('./index');
  const result = await widgets.publishSnapshot();
  expect(result.ok).toBe(true);
  return JSON.parse(await new File(Paths.document, SNAPSHOT_FILENAME).text());
}

describe('widget snapshot: edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logsByDate.clear();
    mockSettingsGet.mockResolvedValue(BASE_SETTINGS);
    mockTasksList.mockResolvedValue([]);
    mockOffDaysListRange.mockResolvedValue([]);
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('light');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('empty state: no habits gives zero due, a null percent (never 0) and an empty list', async () => {
    const contents = await publishAndRead();
    expect(contents.today).toEqual({ totalDue: 0, doneCount: 0, percent: null });
    expect(contents.tasks).toEqual([]);
  });

  it('counts done and fallback as shown up, leaves missed and pending out, and rounds the percent', async () => {
    mockTasksList.mockResolvedValue([habit('a'), habit('b'), habit('c'), habit('d')]);
    logsByDate.set(TODAY, [manualLog('a', 'done'), manualLog('b', 'fallback'), manualLog('c', 'skip')]);
    const contents = await publishAndRead();
    expect(contents.today).toEqual({ totalDue: 4, doneCount: 2, percent: 50 });
    expect(contents.tasks.find((t: { id: string }) => t.id === 'c').chipState).toBe('skip');
  });

  it('one of three done rounds to 33, not 33.333', async () => {
    mockTasksList.mockResolvedValue([habit('a'), habit('b'), habit('c')]);
    logsByDate.set(TODAY, [manualLog('a', 'done')]);
    const contents = await publishAndRead();
    expect(contents.today.percent).toBe(33);
  });

  it('a habit ended yesterday is not in the snapshot at all', async () => {
    mockTasksList.mockResolvedValue([habit('gone', { endedOn: YESTERDAY }), habit('live')]);
    const contents = await publishAndRead();
    expect(contents.tasks.map((t: { id: string }) => t.id)).toEqual(['live']);
    expect(contents.today.totalDue).toBe(1);
  });

  it('a to-do is never in the snapshot, even when it has a chip today', async () => {
    mockTasksList.mockResolvedValue([habit('todo', { type: 'todo', cadence: null }), habit('live')]);
    logsByDate.set(TODAY, [manualLog('todo', 'done')]);
    const contents = await publishAndRead();
    expect(contents.tasks.map((t: { id: string }) => t.id)).toEqual(['live']);
  });

  it('a fixed-task widget whose task was deleted: the config keeps the id, and the task is absent from the list the native side reads', async () => {
    mockSettingsGet.mockResolvedValue({
      ...BASE_SETTINGS,
      widgets: [{ size: 'small-one-task', mode: 'fixed-task', fixedTaskId: 'deleted-id' }],
    });
    mockTasksList.mockResolvedValue([habit('deleted-id', { deletedAt: '2026-11-01T00:00:00.000Z' }), habit('other')]);
    const contents = await publishAndRead();
    expect(contents.widgetConfigs).toEqual([{ size: 'small-one-task', mode: 'fixed-task', fixedTaskId: 'deleted-id' }]);
    expect(contents.tasks.map((t: { id: string }) => t.id)).not.toContain('deleted-id');
  });

  it('emoji and a very long name survive as valid JSON', async () => {
    const name = `🏃‍♀️ Walk ${'x'.repeat(300)}`;
    mockTasksList.mockResolvedValue([habit('e', { name })]);
    const contents = await publishAndRead();
    expect(contents.tasks[0].name).toBe(name);
  });

  it('an off day counts the habit as due and lowers the percent (see the report: this may be wrong)', async () => {
    mockTasksList.mockResolvedValue([habit('a'), habit('b')]);
    logsByDate.set(TODAY, [manualLog('a', 'done')]);
    mockOffDaysListRange.mockResolvedValue([{ id: 'o', date: TODAY, taskId: 'b', priorChipState: null, createdAt: '' }]);
    const contents = await publishAndRead();
    const b = contents.tasks.find((t: { id: string }) => t.id === 'b');
    // Recorded as the off state (not as missed); whether an off habit should count in
    // `totalDue` is a product call, so this only pins what the snapshot currently says.
    expect(b.chipState).toBe(null);
    expect(contents.today.totalDue).toBe(2);
  });

  describe('day rollover while the app is in the background', () => {
    it('coming back to the foreground republishes, so a new day replaces yesterday\'s counts', async () => {
      const addSpy = jest.spyOn(AppState, 'addEventListener');
      const { initWidgetsBridge } = require('./index') as typeof import('./index');
      const dispose = initWidgetsBridge();
      await flush();
      const handler = addSpy.mock.calls.find((c) => c[0] === 'change')?.[1] as (s: string) => void;
      expect(handler).toBeDefined();

      const before = mockSettingsGet.mock.calls.length;
      handler('background');
      await flush();
      expect(mockSettingsGet.mock.calls.length).toBe(before);

      handler('active');
      await flush();
      expect(mockSettingsGet.mock.calls.length).toBeGreaterThan(before);
      dispose();
    });

    it('a failing foreground republish never throws out of the AppState handler', async () => {
      const addSpy = jest.spyOn(AppState, 'addEventListener');
      const { initWidgetsBridge } = require('./index') as typeof import('./index');
      const dispose = initWidgetsBridge();
      await flush();
      mockSettingsGet.mockRejectedValue(new Error('db closed'));
      const handler = addSpy.mock.calls.find((c) => c[0] === 'change')?.[1] as (s: string) => void;
      expect(() => handler('active')).not.toThrow();
      await flush();
      dispose();
    });
  });
});
