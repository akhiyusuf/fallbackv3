/**
 * M7. F21 — `WidgetBridge` (docs/API.md §8). Writes the shared-container JSON snapshot the
 * two native widget targets read; they never open SQLite themselves (MODULES.md M7).
 *
 * Same read-access judgment call as `@/services/notifications` — see that module's header
 * comment for the full reasoning. This service additionally reuses `@/domain`'s
 * `resolveOccurrence` (M2, pure, frozen) to resolve each due task's chip for today, rather
 * than re-deriving the chip -> outcome mapping a second time.
 *
 * SHARED CONTAINER. `expo-file-system`'s class API exposes `Paths.appleSharedContainers` —
 * a real, JS-visible path into the iOS App Group container declared in `app.config.ts`
 * (`group.com.fallback.app`), so the iOS half of "shared-container JSON snapshot" needs no
 * separate native module: WidgetKit extensions run in their own process but share that
 * sandbox by construction. Android's `AppWidgetProvider`, by contrast, runs IN the host app's
 * own process (it's a `BroadcastReceiver`, not a separate extension), so `Paths.document` —
 * the same directory the app itself already writes to — is already directly readable by the
 * widget provider's Kotlin code; no shared container concept is needed there at all. Falls
 * back to `Paths.document` if the App Group entry isn't present (e.g. no provisioned iCloud/
 * App Group container yet, or under test) so a publish never fails outright over it.
 */
import { Directory, File, Paths } from 'expo-file-system';

import { resolveOccurrence } from '@/domain';
import { repos } from '@/db';
import { on } from '@/lib/events';
import { now, today } from '@/lib/date';
import { ACCENTS, PALETTES, resolveScheme } from '@/theme';
import { err, ok } from '@/types';
import type { Result, WidgetBridge } from '@/types';

import { buildWidgetSnapshot, type ResolvedTaskChip } from './snapshot';

export const SNAPSHOT_FILENAME = 'fallback-widget-snapshot.json';
export const APP_GROUP_ID = 'group.com.fallback.app';

function snapshotTargetDirectory(): Directory {
  const appGroupDir = Paths.appleSharedContainers[APP_GROUP_ID];
  return appGroupDir ?? Paths.document;
}

async function publishSnapshot(): Promise<Result<void>> {
  try {
    const [settings, tasks, offMarks] = await Promise.all([
      repos.settings.get(),
      repos.tasks.list(),
      repos.offDays.listRange(today(), today()),
    ]);
    const logs = await repos.logs.listForDate(today());
    const logByTask = new Map(logs.map((l) => [l.taskId, l]));

    const liveTasks = tasks.filter((t) => !t.deletedAt);
    const chips: ResolvedTaskChip[] = liveTasks.map((t) => {
      const occurrence = resolveOccurrence({
        task: t,
        date: today(),
        today: today(),
        log: logByTask.get(t.id) ?? null,
        offMarks,
      });
      return { taskId: t.id, chipState: occurrence.chipState };
    });

    const scheme = resolveScheme(settings.theme, null);
    const snapshot = buildWidgetSnapshot({
      tasks: liveTasks,
      chips,
      date: today(),
      scheme,
      accent: settings.accent,
      accentHex: ACCENTS[settings.accent].base,
      palette: PALETTES[scheme],
      widgetConfigs: settings.widgets,
      generatedAt: now(),
    });

    const file = new File(snapshotTargetDirectory(), SNAPSHOT_FILENAME);
    file.write(JSON.stringify(snapshot));

    return ok(undefined);
  } catch (cause) {
    return err({ code: 'WRITE_FAILED', message: 'Failed to publish the widget snapshot.', cause });
  }
}

export const widgets: WidgetBridge = { publishSnapshot };

let bridgeInitialized = false;

/**
 * Same shape as `initNotificationsBridge` — subscribes to the event bus (not called by M2),
 * idempotent, and needs the same architect-owned `app/_layout.tsx` boot hook to run for a
 * session that never touches an M7-owned screen. See that function's CONTRACT GAP note.
 */
export function initWidgetsBridge(): () => void {
  if (bridgeInitialized) return () => {};
  bridgeInitialized = true;

  const unsubscribers = [
    on('task:changed', () => void publishSnapshot()),
    on('day:logged', () => void publishSnapshot()),
    on('offday:changed', () => void publishSnapshot()),
    on('settings:changed', () => void publishSnapshot()),
  ];

  void publishSnapshot();

  return () => {
    unsubscribers.forEach((unsub) => unsub());
    bridgeInitialized = false;
  };
}
