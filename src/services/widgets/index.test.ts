/** House pattern (docs/MODULES.md top matter): plain jest — no RNTL needed for a non-UI service. */
import { Appearance } from 'react-native';
import { File, Paths } from 'expo-file-system';

import { emit } from '@/lib/events';
import { addDays, today } from '@/lib/date';

const mockSettingsGet = jest.fn();
const mockTasksList = jest.fn();
const mockOffDaysListRange = jest.fn();
/** Per-date log rows, keyed by exact LocalDate — tests set this to exercise movedInLog lookups. */
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

const BASE_SETTINGS = {
  theme: 'light',
  accent: 'forge-orange',
  widgets: [],
};

/** Flushes every pending microtask (safe for the multi-await chains inside `publishSnapshot()`). */
const flushAsync = () => new Promise((resolve) => setImmediate(resolve));

describe('widgets bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logsByDate.clear();
    mockSettingsGet.mockResolvedValue(BASE_SETTINGS);
    mockTasksList.mockResolvedValue([]);
    mockOffDaysListRange.mockResolvedValue([]);
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('light');
  });

  it('publishSnapshot writes a JSON snapshot file and reports ok', async () => {
    const { widgets, SNAPSHOT_FILENAME } = require('./index') as typeof import('./index');
    const result = await widgets.publishSnapshot();
    expect(result.ok).toBe(true);

    const file = new File(Paths.document, SNAPSHOT_FILENAME);
    expect(file.exists).toBe(true);
    const contents = JSON.parse(await file.text());
    expect(contents.version).toBe(1);
    expect(contents.theme).toEqual({ scheme: 'light', accent: 'forge-orange', accentHex: '#F2601A' });
  });

  it('a repository failure surfaces as a WRITE_FAILED Result, never a throw', async () => {
    mockSettingsGet.mockRejectedValue(new Error('boom'));
    const { widgets } = require('./index') as typeof import('./index');
    const result = await widgets.publishSnapshot();
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: 'WRITE_FAILED' }) });
  });

  it('excludes as-needed routines and soft-deleted tasks from the snapshot', async () => {
    const base = { idealSteps: [], fallbackSteps: [], dosesPerDay: 1 };
    mockTasksList.mockResolvedValue([
      { ...base, id: 't1', type: 'routine', name: 'Walk', isAsNeeded: false, cadence: { kind: 'daily' }, timeOfDay: null, deletedAt: null },
      { ...base, id: 't2', type: 'routine', name: 'Journal', isAsNeeded: true, cadence: null, timeOfDay: null, deletedAt: null },
      { ...base, id: 't3', type: 'routine', name: 'Old', isAsNeeded: false, cadence: { kind: 'daily' }, timeOfDay: null, deletedAt: '2026-01-01T00:00:00.000Z' },
    ]);
    const { widgets, SNAPSHOT_FILENAME } = require('./index') as typeof import('./index');
    await widgets.publishSnapshot();
    const file = new File(Paths.document, SNAPSHOT_FILENAME);
    const contents = JSON.parse(await file.text());
    expect(contents.tasks.map((t: { id: string }) => t.id)).toEqual(['t1']);
  });

  it('theme `auto` resolves against the OS scheme, not always light (review pass 1, blocking item 4)', async () => {
    mockSettingsGet.mockResolvedValue({ ...BASE_SETTINGS, theme: 'auto' });
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('dark');
    const { widgets, SNAPSHOT_FILENAME } = require('./index') as typeof import('./index');
    await widgets.publishSnapshot();
    const file = new File(Paths.document, SNAPSHOT_FILENAME);
    const contents = JSON.parse(await file.text());
    expect(contents.theme.scheme).toBe('dark');
  });

  it('excludes a task snoozed AWAY from today, even though it is naturally due (review pass 1, blocking item 3)', async () => {
    const todayDate = today();
    const base = { idealSteps: [], fallbackSteps: [], dosesPerDay: 1 };
    mockTasksList.mockResolvedValue([{ ...base, id: 't1', type: 'routine', name: 'Walk', isAsNeeded: false, cadence: { kind: 'daily' }, timeOfDay: null, deletedAt: null }]);
    logsByDate.set(todayDate, [
      { taskId: 't1', date: todayDate, chipState: null, isManualOverride: false, completedStepIds: [], dosesCompleted: 0, movedToDate: addDays(todayDate, 1), createdAt: '', updatedAt: '' },
    ]);
    const { widgets, SNAPSHOT_FILENAME } = require('./index') as typeof import('./index');
    await widgets.publishSnapshot();
    const file = new File(Paths.document, SNAPSHOT_FILENAME);
    const contents = JSON.parse(await file.text());
    expect(contents.tasks.map((t: { id: string }) => t.id)).toEqual([]);
  });

  it('includes a task snoozed INTO today, even though it is not naturally due today (review pass 1, blocking item 3)', async () => {
    const todayDate = today();
    const yesterday = addDays(todayDate, -1);
    const base = { idealSteps: [], fallbackSteps: [], dosesPerDay: 1 };
    mockTasksList.mockResolvedValue([{ ...base, id: 't1', type: 'routine', name: 'Walk', isAsNeeded: false, cadence: { kind: 'weekly', days: [] }, timeOfDay: null, deletedAt: null }]);
    logsByDate.set(yesterday, [
      { taskId: 't1', date: yesterday, chipState: null, isManualOverride: false, completedStepIds: [], dosesCompleted: 0, movedToDate: todayDate, createdAt: '', updatedAt: '' },
    ]);
    const { widgets, SNAPSHOT_FILENAME } = require('./index') as typeof import('./index');
    await widgets.publishSnapshot();
    const file = new File(Paths.document, SNAPSHOT_FILENAME);
    const contents = JSON.parse(await file.text());
    expect(contents.tasks.map((t: { id: string }) => t.id)).toEqual(['t1']);
  });

  it('store:erased deletes the snapshot file (privacy-relevant — review pass 1, blocking item 2)', async () => {
    const { initWidgetsBridge, SNAPSHOT_FILENAME } = require('./index') as typeof import('./index');
    const dispose = initWidgetsBridge();
    await flushAsync();
    expect(new File(Paths.document, SNAPSHOT_FILENAME).exists).toBe(true);

    emit({ type: 'store:erased' });
    await flushAsync();

    expect(new File(Paths.document, SNAPSHOT_FILENAME).exists).toBe(false);
    dispose();
  });

  it('store:ready republishes a fresh snapshot (initial publish on fresh/reopened boot)', async () => {
    const { initWidgetsBridge, SNAPSHOT_FILENAME } = require('./index') as typeof import('./index');
    const dispose = initWidgetsBridge();
    await flushAsync();
    emit({ type: 'store:erased' });
    await flushAsync();
    expect(new File(Paths.document, SNAPSHOT_FILENAME).exists).toBe(false);

    emit({ type: 'store:ready' });
    await flushAsync();

    expect(new File(Paths.document, SNAPSHOT_FILENAME).exists).toBe(true);
    dispose();
  });
});
