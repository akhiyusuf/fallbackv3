/**
 * M7. F21 — pure computation of the shared-container JSON snapshot the native widget
 * targets read. No I/O here: `index.ts` does the actual file write; this module only shapes
 * the data, so it is unit-testable without a filesystem.
 *
 * The native targets "never open the SQLite database directly" (MODULES.md M7) — this
 * snapshot is their ONLY input, which is why it carries pre-resolved display strings and
 * pre-resolved colours (not raw task/log rows) rather than pushing any business logic onto
 * the Swift/Kotlin side.
 */
import type { ColorScheme, Palette } from '@/theme';
import type { AccentKey, ChipState, LocalDate, OccurrenceOutcome, TaskWithSteps, WidgetConfig } from '@/types';

export interface WidgetSignalColors {
  readonly ideal: string;
  readonly fallback: string;
  readonly off: string;
}

export interface WidgetTaskSummary {
  readonly id: string;
  readonly name: string;
  readonly timeOfDay: string | null;
  /** `null` — nothing due yet today for this task; the native side renders the `todo` visual. */
  readonly chipState: ChipState | null;
}

export interface WidgetSnapshot {
  readonly version: 1;
  readonly generatedAt: string;
  readonly theme: { readonly scheme: ColorScheme; readonly accent: AccentKey; readonly accentHex: string };
  /** Rule 4 / §5 — signal colours are accent- and (for display purposes) theme-resolved already; missed has none. */
  readonly signalColors: WidgetSignalColors;
  readonly today: { readonly totalDue: number; readonly doneCount: number; readonly percent: number | null };
  /** Every DUE task today, chip-resolved, for the "smart — next due" / "fixed task" widget configs to select from. */
  readonly tasks: readonly WidgetTaskSummary[];
  readonly widgetConfigs: readonly WidgetConfig[];
}

export interface ResolvedTaskChip {
  readonly taskId: string;
  readonly chipState: ChipState | null;
  /**
   * Review pass 1, blocking item 3: the caller (`index.ts`) resolves this through
   * `resolveOccurrence`/`designateCarrier` (movedInLog-aware), not raw `isDue` — a task
   * snoozed AWAY from today resolves `'not-due'` here even though cadence still says today is
   * due; a task snoozed INTO today resolves a real due outcome even though cadence alone says
   * it is not. `dueTasks` below filters on THIS field, never on `isDue` directly.
   */
  readonly outcome: OccurrenceOutcome;
}

/**
 * `chips` — the day's resolved chip per due task, supplied by the caller (`index.ts`, which
 * has repo access). Kept as a plain parameter so this function stays a pure data shape, not a
 * second read-path implementation.
 */
export function buildWidgetSnapshot(input: {
  readonly tasks: readonly TaskWithSteps[];
  readonly chips: readonly ResolvedTaskChip[];
  readonly date: LocalDate;
  readonly scheme: ColorScheme;
  readonly accent: AccentKey;
  readonly accentHex: string;
  readonly palette: Palette;
  readonly widgetConfigs: readonly WidgetConfig[];
  readonly generatedAt: string;
}): WidgetSnapshot {
  const { tasks, chips, scheme, accent, accentHex, palette, widgetConfigs, generatedAt } = input;
  const chipByTask = new Map(chips.map((c) => [c.taskId, c]));

  const dueTasks = tasks.filter((t) => {
    if (t.deletedAt) return false;
    const resolved = chipByTask.get(t.id);
    return resolved !== undefined && resolved.outcome !== 'not-due';
  });
  const summaries: WidgetTaskSummary[] = dueTasks.map((t) => ({
    id: t.id,
    name: t.name,
    timeOfDay: t.timeOfDay,
    chipState: chipByTask.get(t.id)?.chipState ?? null,
  }));

  const doneCount = summaries.filter((s) => s.chipState === 'done' || s.chipState === 'fallback').length;
  const totalDue = summaries.length;

  return {
    version: 1,
    generatedAt,
    theme: { scheme, accent, accentHex },
    signalColors: { ideal: palette.ideal, fallback: palette.fallback, off: palette.off },
    today: { totalDue, doneCount, percent: totalDue > 0 ? Math.round((doneCount / totalDue) * 100) : null },
    tasks: summaries,
    widgetConfigs,
  };
}
