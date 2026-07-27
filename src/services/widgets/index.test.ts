/** House pattern (docs/MODULES.md top matter): plain jest — no RNTL needed for a non-UI service. */
const mockSettingsGet = jest.fn();
const mockTasksList = jest.fn();
const mockOffDaysListRange = jest.fn();
const mockLogsListForDate = jest.fn();

jest.mock('@/db', () => ({
  repos: {
    settings: { get: () => mockSettingsGet() },
    tasks: { list: () => mockTasksList() },
    offDays: { listRange: () => mockOffDaysListRange() },
    logs: { listForDate: () => mockLogsListForDate() },
  },
}));

const BASE_SETTINGS = {
  theme: 'light',
  accent: 'forge-orange',
  widgets: [],
};

describe('widgets bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsGet.mockResolvedValue(BASE_SETTINGS);
    mockTasksList.mockResolvedValue([]);
    mockOffDaysListRange.mockResolvedValue([]);
    mockLogsListForDate.mockResolvedValue([]);
  });

  it('publishSnapshot writes a JSON snapshot file and reports ok', async () => {
    const { widgets, SNAPSHOT_FILENAME } = await import('./index');
    const { Paths, File } = await import('expo-file-system');
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
    const { widgets } = await import('./index');
    const result = await widgets.publishSnapshot();
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: 'WRITE_FAILED' }) });
  });

  it('excludes as-needed routines and soft-deleted tasks from the snapshot', async () => {
    mockTasksList.mockResolvedValue([
      { id: 't1', type: 'routine', name: 'Walk', isAsNeeded: false, cadence: { kind: 'daily' }, timeOfDay: null, deletedAt: null },
      { id: 't2', type: 'routine', name: 'Journal', isAsNeeded: true, cadence: null, timeOfDay: null, deletedAt: null },
      { id: 't3', type: 'routine', name: 'Old', isAsNeeded: false, cadence: { kind: 'daily' }, timeOfDay: null, deletedAt: '2026-01-01T00:00:00.000Z' },
    ]);
    const { widgets, SNAPSHOT_FILENAME } = await import('./index');
    await widgets.publishSnapshot();
    const { Paths, File } = await import('expo-file-system');
    const file = new File(Paths.document, SNAPSHOT_FILENAME);
    const contents = JSON.parse(await file.text());
    expect(contents.tasks.map((t: { id: string }) => t.id)).toEqual(['t1']);
  });
});
