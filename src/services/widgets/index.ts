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
import { Appearance } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

import { resolveOccurrence } from '@/domain';
import { repos } from '@/db';
import { on } from '@/lib/events';
import { addDays, now, today } from '@/lib/date';
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
    const todayDate = today();
    const yesterday = addDays(todayDate, -1);
    const [settings, tasks, offMarks] = await Promise.all([
      repos.settings.get(),
      repos.tasks.list(),
      repos.offDays.listRange(todayDate, todayDate),
    ]);
    // SCHEMA §4.2's standing principle / ADVICE-M2.md Ruling 1: under the one-hop snooze
    // contract `inbound(D)` can only originate at `D − 1`, so a bare date-keyed lookup of
    // today's log alone is incomplete input to `designateCarrier` — a task snoozed AWAY from
    // today (own row, `movedToDate` != today) must NOT count as due here, and a task snoozed
    // INTO today (a visitor row from yesterday) must. `resolveOccurrence`'s resolved `outcome`
    // (not raw `isDue`) is what `buildWidgetSnapshot` filters on below.
    const [logs, priorLogs] = await Promise.all([repos.logs.listForDate(todayDate), repos.logs.listForDate(yesterday)]);
    const logByTask = new Map(logs.map((l) => [l.taskId, l]));
    const movedInByTask = new Map(priorLogs.filter((l) => l.movedToDate === todayDate).map((l) => [l.taskId, l]));

    const liveTasks = tasks.filter((t) => !t.deletedAt);
    const chips: ResolvedTaskChip[] = liveTasks.map((t) => {
      const occurrence = resolveOccurrence({
        task: t,
        date: todayDate,
        today: todayDate,
        log: logByTask.get(t.id) ?? null,
        offMarks,
        movedInLog: movedInByTask.get(t.id) ?? null,
      });
      return { taskId: t.id, chipState: occurrence.chipState, outcome: occurrence.outcome };
    });

    // `Appearance.getColorScheme()` — review pass 1, blocking item 4: `auto` must resolve
    // against the device's actual OS scheme, not always fall through to light.
    const scheme = resolveScheme(settings.theme, Appearance.getColorScheme() ?? null);
    const snapshot = buildWidgetSnapshot({
      tasks: liveTasks,
      chips,
      date: todayDate,
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

/**
 * Review pass 1, blocking item 2: M1 emits `store:erased` SPECIFICALLY for this bridge
 * (`src/db/lifecycle.ts`, MODULES.md M1 non-negotiable — "clears … widget snapshot files
 * too"). The snapshot JSON carries task names, so a stale one surviving erase-all is a
 * privacy leak on the home screen, not just a staleness bug. Deletes the file outright
 * (best-effort — the empty/fresh store `publishSnapshot()` right after via `store:ready`
 * republishes a clean, empty snapshot anyway, so this only needs to not throw).
 */
async function clearSnapshot(): Promise<void> {
  try {
    const file = new File(snapshotTargetDirectory(), SNAPSHOT_FILENAME);
    if (file.exists) file.delete();
  } catch {
    // Best-effort: a delete failure here must never surface as an erase-all failure — the
    // very next `store:ready` publish overwrites this file with an empty snapshot anyway.
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
    // Erase-all: wipe the stale (privacy-relevant) snapshot; the paired `store:ready` fired
    // right after by `eraseAll()` republishes a clean, empty one. `store:ready` alone also
    // covers a plain fresh-boot initial publish.
    on('store:erased', () => void clearSnapshot()),
    on('store:ready', () => void publishSnapshot()),
  ];

  void publishSnapshot();

  return () => {
    unsubscribers.forEach((unsub) => unsub());
    bridgeInitialized = false;
  };
}
