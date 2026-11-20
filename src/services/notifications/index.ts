/**
 * M7. F14 — `NotificationScheduler` (docs/API.md §8). Local only: `expo-notifications`,
 * no push tokens, no server, no notification service extension.
 *
 * JUDGMENT CALL (flagged in the module's final report): computing "what's due in the next 7
 * days" needs task + settings data. `docs/API.md` §1 says "a feature module must never
 * import `@/db`" — written for M3-M6's UI feature modules, to keep every read routed through
 * M2's reconciled `@/queries` layer. `@/queries`'s hooks are React-bound and cannot run from
 * a non-React scheduler reacting to the event bus, and `@/queries` exports no imperative
 * equivalent. This service is read-only and best-effort (a reminder that is a day stale
 * because a task changed 30 seconds ago is not a correctness bug the way a stale XP total
 * would be), so it reads `repos` (M1) directly and computes due-ness via `@/domain`'s `isDue`
 * (M2, pure, frozen) — never re-deriving cadence logic, and never writing anything back
 * through this path. If the architect disagrees, this is the one call site to redirect.
 */
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { resolveOccurrence } from '@/domain';
import { repos, store } from '@/db';
import { clearOnboardingProgress } from '@/features/onboarding/progress';
import { on } from '@/lib/events';
import { addDays, parseLocalDate, toLocalDate, today } from '@/lib/date';
import { err, ok } from '@/types';
import type { LocalDate, NotificationScheduler, Result } from '@/types';

import { buildRollingSchedule, NOTIFICATION_HORIZON_DAYS } from './schedule';

const REMINDER_PREFIX = 'fallback-reminder:';

/**
 * Android shows every notification through a named channel, and on Android 13 and later the
 * system's "Allow notifications?" question is only shown once the app has a channel. So the
 * channel is made before asking, and again (a no-op) before scheduling. The name is what the
 * person sees in the phone's own notification settings.
 */
const CHANNEL_ID = 'reminders';
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  } catch {
    // Without the channel Android falls back to its own default one; reminders still arrive.
  }
}

/**
 * F14's deep-link contract, cross-module (see the coordinator note this module's final
 * report responds to): `/today` accepts `?reentry=1&taskId=<id>` for the "gentle re-entry"
 * tap-through — ARCHITECTURE §9.3's "deep-links to S09's re-entry state." Any other reminder
 * kind just opens Today plain; M3 didn't document a param for those, and inventing one here
 * would be exactly the "say so, don't silently use something else" case the note warns about
 * — so a routine-due/event-starting/course-dose/course-ending-soon/milestone tap opens
 * `/today` with no query, which is Today's own default landing state.
 */
function routeForTap(data: Record<string, unknown> | undefined): string {
  if (data?.kind === 'gentle-reentry' && typeof data.taskId === 'string') {
    return `/today?reentry=1&taskId=${data.taskId}`;
  }
  return '/today';
}

let pendingTapRoute: string | null = null;

/**
 * The screen a reminder tap asked for while the app was still starting, once. The splash opens it
 * in place of plain Today when the person has finished onboarding.
 */
export function takePendingTapRoute(): string | null {
  const route = pendingTapRoute;
  pendingTapRoute = null;
  return route;
}

function triggerDateFor(date: LocalDate, timeOfDay: string): Date {
  const [hh, mm] = timeOfDay.split(':').map(Number);
  const d = parseLocalDate(date);
  d.setHours(hh ?? 9, mm ?? 0, 0, 0);
  return d;
}

async function requestPermission(): Promise<Result<boolean>> {
  try {
    await ensureChannel();
    const result = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
    return ok(!!result.granted);
  } catch (cause) {
    return err({ code: 'UNKNOWN', message: 'Failed to request notification permission.', cause });
  }
}

async function hasPermission(): Promise<boolean> {
  try {
    const result = await Notifications.getPermissionsAsync();
    return !!result.granted;
  } catch {
    return false;
  }
}

/**
 * iOS keeps at most 64 pending local notifications per app and silently drops the rest. The
 * soonest reminders are the ones worth keeping, so the batch is sorted by fire time first.
 */
const PENDING_LIMIT = 64;

interface PendingRequest {
  readonly identifier: string;
  readonly content: { readonly title: string; readonly body: string; readonly data?: Record<string, unknown> };
  readonly fireAt: Date;
}

/**
 * Re-arms are triggered in bursts (a log, a settings toggle, an app foreground, a task edit). Each
 * one reads data and then cancels and re-adds. Run one at a time, so an older run that read the
 * settings before a toggle cannot finish after a newer run that cancelled, and re-arm reminders
 * the person has just switched off.
 */
let rescheduleChain: Promise<unknown> = Promise.resolve();

function reschedule(): Promise<Result<void>> {
  const run = rescheduleChain.then(() => rescheduleOnce());
  rescheduleChain = run.catch(() => undefined);
  return run;
}

/**
 * Occurrences in the 7-day horizon that are already settled, keyed `taskId:date`: logged (done,
 * fallback or missed), marked off, or vacated by a snooze. `buildRollingSchedule` must not
 * remind for these. The occurrence itself is resolved through `resolveOccurrence`, the same
 * function Today uses, so a snoozed-in visitor and a snoozed-away source are judged the same way
 * everywhere. A pending occurrence is the only kind that still needs a reminder.
 */
function settledOccurrences(
  tasks: Awaited<ReturnType<typeof repos.tasks.list>>,
  logs: Awaited<ReturnType<typeof repos.logs.listRange>>,
  offMarks: Awaited<ReturnType<typeof repos.offDays.listRange>>,
  todayDate: LocalDate,
): Set<string> {
  const logByKey = new Map<string, (typeof logs)[number]>(logs.map((l) => [`${l.taskId}:${l.date}`, l]));
  const movedInByKey = new Map<string, (typeof logs)[number]>();
  for (const l of logs) {
    if (l.movedToDate !== null) movedInByKey.set(`${l.taskId}:${l.movedToDate}`, l);
  }
  const settled = new Set<string>();
  for (const task of tasks) {
    if (task.deletedAt) continue;
    for (let i = 0; i < NOTIFICATION_HORIZON_DAYS; i++) {
      const date = addDays(todayDate, i);
      const key = `${task.id}:${date}`;
      const occurrence = resolveOccurrence({
        task,
        date,
        today: todayDate,
        log: logByKey.get(key) ?? null,
        offMarks,
        movedInLog: movedInByKey.get(key) ?? null,
      });
      if (occurrence.outcome !== 'pending') settled.add(key);
    }
  }
  return settled;
}

async function rescheduleOnce(): Promise<Result<void>> {
  try {
    // Idempotent re-arm: clear, then rebuild from current data — never additive (API.md §8).
    await Notifications.cancelAllScheduledNotificationsAsync();

    const settings = await repos.settings.get();
    if (!settings.notifications.master) return ok(undefined);
    if (!(await hasPermission())) return ok(undefined); // fully usable if declined — a silent no-op, not an error

    await ensureChannel();
    const tasks = await repos.tasks.list();
    const todayDate = today();
    const horizonEnd = addDays(todayDate, NOTIFICATION_HORIZON_DAYS - 1);
    // One range read each for the horizon. Yesterday's rows are included so a snoozed-in visitor
    // (its source row sits on the day before) is seen too.
    const [horizonLogs, horizonOffMarks] = await Promise.all([
      repos.logs.listRange(addDays(todayDate, -1), horizonEnd),
      repos.offDays.listRange(todayDate, horizonEnd),
    ]);
    const settled = settledOccurrences(tasks, horizonLogs, horizonOffMarks, todayDate);
    const schedule = buildRollingSchedule({ tasks, prefs: settings.notifications, today: todayDate, vacatedDates: settled });

    const requests: PendingRequest[] = schedule.map((reminder) => ({
      identifier: `${REMINDER_PREFIX}${reminder.id}`,
      content: { title: reminder.title, body: reminder.body, data: { kind: reminder.kind, taskId: reminder.taskId } },
      fireAt: triggerDateFor(reminder.date, reminder.timeOfDay),
    }));

    if (settings.notifications.gentleReentry) {
      const nudge = await gentleReentryRequest(tasks);
      if (nudge) requests.push(nudge);
    }

    if (settings.notifications.dailyDigest) {
      for (let i = 0; i < NOTIFICATION_HORIZON_DAYS; i++) {
        const date = addDays(todayDate, i);
        requests.push({
          identifier: `${REMINDER_PREFIX}daily-digest:${date}`,
          content: { title: 'Your day, at a glance', body: "Check in on today's habits." },
          fireAt: triggerDateFor(date, settings.notifications.dailyDigestTime),
        });
      }
    }

    // Only what is still ahead. A DATE trigger in the past fires at once on Android, and this runs
    // after every log, so an earlier reminder (or today's digest) would pop up again on each tap.
    const nowMs = Date.now();
    const ahead = requests.filter((r) => r.fireAt.getTime() > nowMs);
    ahead.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
    for (const request of ahead.slice(0, PENDING_LIMIT)) {
      await Notifications.scheduleNotificationAsync({
        identifier: request.identifier,
        content: request.content,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, channelId: CHANNEL_ID, date: request.fireAt },
      });
    }

    return ok(undefined);
  } catch (cause) {
    return err({ code: 'UNKNOWN', message: 'Failed to reschedule notifications.', cause });
  }
}

/**
 * ARCHITECTURE §9.3: "one invitation back after an off day" — a single reactive nudge, not
 * part of the rolling 7-day precompute (`schedule.ts` stays pure; this needs yesterday's log
 * data). Fires today, carrying the FIRST task that was genuinely missed yesterday (due,
 * tracked, not off, no showing-up chip) — that task id is what `/today?reentry=1&taskId=`
 * deep-links to. An off day yesterday is deliberately NOT a re-entry trigger (PRD F4: off
 * days are a sanctioned rest, never a lapse to be nudged back from).
 */
async function gentleReentryRequest(tasks: Awaited<ReturnType<typeof repos.tasks.list>>): Promise<PendingRequest | null> {
  const yesterday = addDays(today(), -1);
  const dayBeforeYesterday = addDays(yesterday, -1);
  // SCHEMA §4.2's standing principle: a visiting occurrence snoozed INTO yesterday (a
  // one-hop move from the day before) resolves through `designateCarrier` too, or a task
  // missed only via that visitor row would silently never trigger the re-entry invitation.
  const [logs, priorLogs, offMarks] = await Promise.all([
    repos.logs.listForDate(yesterday),
    repos.logs.listForDate(dayBeforeYesterday),
    repos.offDays.listRange(yesterday, yesterday),
  ]);
  const logByTask = new Map(logs.map((l) => [l.taskId, l]));
  const movedInByTask = new Map(priorLogs.filter((l) => l.movedToDate === yesterday).map((l) => [l.taskId, l]));

  for (const task of tasks) {
    // An ended habit is no longer part of the plan, so yesterday's miss on it is not a nudge to return to.
    if (task.deletedAt || task.isAsNeeded || task.type === 'todo' || task.endedOn != null) continue;
    // Review pass 2, blocking item 1: the creation-day lower bound (same conversion as the
    // canonical `src/queries/internal.ts`'s `creationLocalDate`), or a task created TODAY gets
    // a fabricated "missed yesterday" occurrence — daily/specific-weekdays cadences carry no
    // natural start anchor of their own (`src/domain/occurrence.ts`'s `notBefore` doc comment).
    const notBefore = toLocalDate(new Date(task.createdAt));
    const occurrence = resolveOccurrence({
      task,
      date: yesterday,
      today: today(),
      log: logByTask.get(task.id) ?? null,
      offMarks,
      movedInLog: movedInByTask.get(task.id) ?? null,
      notBefore,
    });
    if (occurrence.outcome === 'missed') {
      // One invitation, not one per missed task (ARCHITECTURE §9.3's own wording): the first match returns.
      return {
        identifier: `${REMINDER_PREFIX}gentle-reentry:${yesterday}`,
        content: {
          title: 'A quiet invitation back',
          body: 'Yesterday slipped by. Today is a fresh one. Even the fallback counts.',
          data: { kind: 'gentle-reentry', taskId: task.id },
        },
        fireAt: triggerDateFor(today(), '09:00'),
      };
    }
  }
  return null;
}

async function cancelAll(): Promise<Result<void>> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return ok(undefined);
  } catch (cause) {
    return err({ code: 'UNKNOWN', message: 'Failed to cancel notifications.', cause });
  }
}

export const notifications: NotificationScheduler = { requestPermission, hasPermission, reschedule, cancelAll };

/** So the OS tray actually shows a foreground notification (a reasonable UX default). */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let bridgeInitialized = false;

/**
 * Wires the "re-armed on app foreground and whenever a task changes" half of API.md §8 —
 * subscribing to the event bus rather than being called by M2 (MODULES.md M7 non-negotiable).
 * Idempotent: safe to call from every M7-owned screen's mount effect. Also fires an
 * immediate, un-scheduled "milestone reached" notification off `badge:unlocked`/`level:up`,
 * since those are one-off reactive alerts, not part of the rolling 7-day horizon.
 *
 * CONTRACT GAP — RESOLVED by architect CR-5 (docs/MODULES.md, post-wave-2 section). Nothing
 * used to call this at app boot, so a user who never visited an M7-owned screen in a session
 * (e.g. a returning user going straight from splash to Today) armed no reminders.
 * `app/_layout.tsx` is M0-owned and frozen to every other module, so the fix was an architect
 * change request rather than an M7 edit: `AppShell` now calls this once from a mount effect
 * (docs/API.md §8 — THE boot-time call site). The per-screen calls below stay: the guard above
 * makes the second call a no-op returning a no-op disposer, which keeps each M7 screen
 * independently testable without ever tearing the bridge down.
 */
export function initNotificationsBridge(): () => void {
  if (bridgeInitialized) return () => {};
  bridgeInitialized = true;

  const unsubscribers = [
    on('task:changed', () => void reschedule()),
    on('settings:changed', () => void reschedule()),
    on('day:logged', () => void reschedule()),
    on('badge:unlocked', () => void sendMilestoneNotification()),
    on('level:up', () => void sendMilestoneNotification()),
    // Review pass 1, blocking item 2: erase-all must cancel every armed reminder (privacy-
    // relevant — an erased task's name would otherwise still surface via a fired notification)
    // and, since M7 also owns the onboarding resume pointer (outside M1's SecureStore sweep,
    // `src/db/lifecycle.ts`'s `SECURE_STORE_KEYS`), clear it too so a post-erase user restarts
    // the pitch tour at S02 instead of silently resuming a stale mid-tour position. Colocated
    // here (rather than a third bridge) since this init already reaches every mount point that
    // matters (S06/S07/S41/S42/S46) and the two cleanups share the same trigger.
    on('store:erased', () => {
      void cancelAll();
      void clearOnboardingProgress();
    }),
    on('store:ready', () => void reschedule()),
  ];

  const appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') void reschedule();
  });

  // F14 tap-through — see `routeForTap`'s doc comment for the deep-link contract this
  // fulfils (`/today?reentry=1&taskId=<id>` for gentle re-entry, plain `/today` otherwise).
  const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, unknown> | undefined;
    const route = routeForTap(data);
    // A tap that opened the app from closed arrives while the splash is still opening the
    // database: hand the route to the splash instead of opening Today on a store not yet ready.
    if (store.status() !== 'ready') {
      pendingTapRoute = route;
      return;
    }
    router.push(route as never);
  });

  void reschedule();

  return () => {
    unsubscribers.forEach((unsub) => unsub());
    appStateSub.remove();
    tapSub.remove();
    bridgeInitialized = false;
  };
}

async function sendMilestoneNotification(): Promise<void> {
  try {
    const settings = await repos.settings.get();
    if (!settings.notifications.master || !settings.notifications.milestoneReached) return;
    if (!(await hasPermission())) return;
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Milestone reached', body: "You've hit a new level or badge. Nice work." },
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
    });
  } catch {
    // Best-effort celebration notification — never worth surfacing an error for.
  }
}
