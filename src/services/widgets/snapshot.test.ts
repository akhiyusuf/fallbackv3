import { buildWidgetSnapshot } from './snapshot';
import type { LocalDate, TaskWithSteps } from '@/types';

const PALETTE = {
  bg: '#fff', bgAlt: '#fff', surface: '#fff', canvas: '#fff',
  text: '#000', textMuted: '#000', textDim: '#000',
  border: '#000', borderStrong: '#000',
  ideal: '#8FBC6B', idealDeep: '#000', idealSoft: '#000',
  fallback: '#7FB2D4', fallbackDeep: '#000', fallbackSoft: '#000',
  off: '#A8A294', offDeep: '#000', offSoft: '#000',
  celebrationGold: '#000', goldDeep: '#000', goldSoft: '#000',
  danger: '#000', dangerSoft: '#000', dangerDeep: '#000',
  xp: '#000', iconOnSignal: '#fff', textOnAccent: '#fff',
} as const;

function task(overrides: Partial<TaskWithSteps> = {}): TaskWithSteps {
  return {
    id: 't1' as never,
    type: 'routine',
    name: 'Evening walk',
    note: null,
    icon: 'Repeat',
    color: 'forge-orange',
    isAsNeeded: false,
    cadence: { kind: 'daily' },
    eventDate: null,
    timeOfDay: '18:00',
    startDate: null,
    endDate: null,
    dosesPerDay: 1,
    isTracked: true,
    importance: 'med',
    necessity: 'recommended',
    todoDoneAt: null,
    snoozable: true,
    createdAt: '2026-01-01T00:00:00.000Z' as never,
    updatedAt: '2026-01-01T00:00:00.000Z' as never,
    deletedAt: null,
    idealSteps: [],
    fallbackSteps: [],
    ...overrides,
  } as TaskWithSteps;
}

describe('buildWidgetSnapshot', () => {
  const date = '2026-07-27' as LocalDate;

  it('includes only tasks due today, never an as-needed routine', () => {
    const tasks = [task(), task({ id: 't2' as never, isAsNeeded: true, cadence: null })];
    const snapshot = buildWidgetSnapshot({
      tasks,
      chips: [],
      date,
      scheme: 'light',
      accent: 'forge-orange',
      accentHex: '#F2601A',
      palette: PALETTE,
      widgetConfigs: [],
      generatedAt: '2026-07-27T08:00:00.000Z',
    });
    expect(snapshot.tasks).toHaveLength(1);
    expect(snapshot.tasks[0]?.id).toBe('t1');
  });

  it('carries only the three FILLED signal colours (ideal/fallback/off) — missed has none', () => {
    const snapshot = buildWidgetSnapshot({
      tasks: [],
      chips: [],
      date,
      scheme: 'light',
      accent: 'forge-orange',
      accentHex: '#F2601A',
      palette: PALETTE,
      widgetConfigs: [],
      generatedAt: '2026-07-27T08:00:00.000Z',
    });
    expect(snapshot.signalColors).toEqual({ ideal: PALETTE.ideal, fallback: PALETTE.fallback, off: PALETTE.off });
    expect(snapshot.signalColors).not.toHaveProperty('missed');
  });

  it('percent is null when nothing is due, never 0', () => {
    const snapshot = buildWidgetSnapshot({
      tasks: [],
      chips: [],
      date,
      scheme: 'light',
      accent: 'forge-orange',
      accentHex: '#F2601A',
      palette: PALETTE,
      widgetConfigs: [],
      generatedAt: '2026-07-27T08:00:00.000Z',
    });
    expect(snapshot.today.percent).toBeNull();
  });

  it('computes doneCount from done/fallback chips and a rounded percent', () => {
    const tasks = [task(), task({ id: 't2' as never, name: 'Meditate' })];
    const snapshot = buildWidgetSnapshot({
      tasks,
      chips: [
        { taskId: 't1' as never, chipState: 'done' },
        { taskId: 't2' as never, chipState: 'todo' },
      ],
      date,
      scheme: 'dark',
      accent: 'indigo',
      accentHex: '#4F46E5',
      palette: PALETTE,
      widgetConfigs: [],
      generatedAt: '2026-07-27T08:00:00.000Z',
    });
    expect(snapshot.today).toEqual({ totalDue: 2, doneCount: 1, percent: 50 });
    expect(snapshot.theme).toEqual({ scheme: 'dark', accent: 'indigo', accentHex: '#4F46E5' });
  });
});
