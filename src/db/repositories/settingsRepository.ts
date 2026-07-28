/**
 * M1. `SettingsRepository` — docs/API.md §1. The `settings` singleton (id=1) plus
 * `widget_config`, assembled into the one `Settings` shape M0 declared.
 */
import { now } from '@/lib/date';
import { err, ok } from '@/types';
import type {
  AccentKey,
  AssistantPrefs,
  CycleCadence,
  Id,
  Instant,
  LocalDate,
  NotificationPrefs,
  Result,
  Settings,
  ThemeMode,
  WidgetConfig,
  WidgetSize,
} from '@/types';
import { CURRENT_SCHEMA_VERSION } from '../migrations';

import type { DbClient } from '../client';

interface SettingsRow {
  readonly id: number;
  readonly theme: string;
  readonly accent: string;
  readonly onboarding_completed_at: string | null;
  readonly tenure_anchor_date: string;
  readonly cycle_cadence: string;
  readonly notif_master: number;
  readonly notif_routine_due: number;
  readonly notif_event_starting: number;
  readonly notif_course_dose: number;
  readonly notif_course_ending_soon: number;
  readonly notif_gentle_reentry: number;
  readonly notif_milestone_reached: number;
  readonly notif_daily_digest: number;
  readonly notif_digest_time: string;
  readonly assistant_language: string;
  readonly assistant_voice: string;
  readonly sync_enabled: number;
  readonly sync_last_synced_at: string | null;
  readonly sync_last_error: string | null;
  readonly last_backup_at: string | null;
  readonly updated_at: string;
}

interface WidgetConfigRow {
  readonly size: string;
  readonly mode: string;
  readonly fixed_task_id: string | null;
}

function rowToWidgetConfig(row: WidgetConfigRow): WidgetConfig {
  return {
    size: row.size as WidgetSize,
    mode: row.mode as WidgetConfig['mode'],
    fixedTaskId: row.fixed_task_id as Id | null,
  };
}

function rowToSettings(row: SettingsRow, widgets: readonly WidgetConfig[]): Settings {
  const notifications: NotificationPrefs = {
    master: row.notif_master === 1,
    routineDue: row.notif_routine_due === 1,
    eventStarting: row.notif_event_starting === 1,
    courseDose: row.notif_course_dose === 1,
    courseEndingSoon: row.notif_course_ending_soon === 1,
    gentleReentry: row.notif_gentle_reentry === 1,
    milestoneReached: row.notif_milestone_reached === 1,
    dailyDigest: row.notif_daily_digest === 1,
    dailyDigestTime: row.notif_digest_time,
  };
  // Architect CR-2 — S36's voice/language selection, persisted here rather than in process.
  const assistant: AssistantPrefs = { language: row.assistant_language, voice: row.assistant_voice };
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    theme: row.theme as ThemeMode,
    accent: row.accent as AccentKey,
    onboardingCompletedAt: row.onboarding_completed_at as Instant | null,
    tenureAnchorDate: row.tenure_anchor_date as LocalDate,
    cycleCadence: row.cycle_cadence as CycleCadence,
    notifications,
    assistant,
    widgets,
    sync: {
      enabled: row.sync_enabled === 1,
      lastSyncedAt: row.sync_last_synced_at as Instant | null,
      lastError: row.sync_last_error,
    },
    lastBackupAt: row.last_backup_at as Instant | null,
    updatedAt: row.updated_at as Instant,
  };
}

const SETTINGS_COLUMNS = `
  id, theme, accent, onboarding_completed_at, tenure_anchor_date, cycle_cadence,
  notif_master, notif_routine_due, notif_event_starting, notif_course_dose,
  notif_course_ending_soon, notif_gentle_reentry, notif_milestone_reached, notif_daily_digest,
  notif_digest_time, assistant_language, assistant_voice,
  sync_enabled, sync_last_synced_at, sync_last_error, last_backup_at, updated_at
`;

const DIGEST_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function createSettingsRepository(db: DbClient) {
  async function readWidgets(): Promise<WidgetConfig[]> {
    const rows = await db.getAllAsync<WidgetConfigRow>(`SELECT size, mode, fixed_task_id FROM widget_config`);
    return rows.map(rowToWidgetConfig);
  }

  return {
    async get(): Promise<Settings> {
      const row = await db.getFirstAsync<SettingsRow>(`SELECT ${SETTINGS_COLUMNS} FROM settings WHERE id = 1`);
      if (!row) {
        throw new Error('settings singleton missing — StoreLifecycle.open() must seed it before any read');
      }
      const widgets = await readWidgets();
      return rowToSettings(row, widgets);
    },

    async patch(patch: Partial<Settings>): Promise<Result<Settings>> {
      try {
        if (patch.notifications?.dailyDigestTime && !DIGEST_TIME_RE.test(patch.notifications.dailyDigestTime)) {
          return err({
            code: 'VALIDATION_FAILED',
            message: 'notif_digest_time must match HH:mm',
            fields: { dailyDigestTime: 'Invalid time' },
          });
        }

        const current = await db.getFirstAsync<SettingsRow>(`SELECT ${SETTINGS_COLUMNS} FROM settings WHERE id = 1`);
        if (!current) throw new Error('settings singleton missing');
        const currentWidgets = await readWidgets();
        const merged = rowToSettings(current, currentWidgets);

        const next: Settings = {
          ...merged,
          ...patch,
          notifications: { ...merged.notifications, ...patch.notifications },
          assistant: { ...merged.assistant, ...patch.assistant },
          sync: { ...merged.sync, ...patch.sync },
          updatedAt: now(),
        };

        await db.withTransactionAsync(async () => {
          await db.runAsync(
            `UPDATE settings SET theme=?, accent=?, onboarding_completed_at=?, tenure_anchor_date=?, cycle_cadence=?,
             notif_master=?, notif_routine_due=?, notif_event_starting=?, notif_course_dose=?,
             notif_course_ending_soon=?, notif_gentle_reentry=?, notif_milestone_reached=?, notif_daily_digest=?,
             notif_digest_time=?, assistant_language=?, assistant_voice=?,
             sync_enabled=?, sync_last_synced_at=?, sync_last_error=?, last_backup_at=?, updated_at=?
             WHERE id = 1`,
            [
              next.theme,
              next.accent,
              next.onboardingCompletedAt,
              next.tenureAnchorDate,
              next.cycleCadence,
              next.notifications.master ? 1 : 0,
              next.notifications.routineDue ? 1 : 0,
              next.notifications.eventStarting ? 1 : 0,
              next.notifications.courseDose ? 1 : 0,
              next.notifications.courseEndingSoon ? 1 : 0,
              next.notifications.gentleReentry ? 1 : 0,
              next.notifications.milestoneReached ? 1 : 0,
              next.notifications.dailyDigest ? 1 : 0,
              next.notifications.dailyDigestTime,
              next.assistant.language,
              next.assistant.voice,
              next.sync.enabled ? 1 : 0,
              next.sync.lastSyncedAt,
              next.sync.lastError,
              next.lastBackupAt,
              next.updatedAt,
            ],
          );

          if (patch.widgets) {
            await db.runAsync(`DELETE FROM widget_config`);
            for (const widget of patch.widgets) {
              await db.runAsync(`INSERT INTO widget_config (size, mode, fixed_task_id) VALUES (?,?,?)`, [
                widget.size,
                widget.mode,
                widget.fixedTaskId,
              ]);
            }
          }
        });

        return ok(next);
      } catch (cause) {
        if (cause && typeof cause === 'object' && 'code' in cause) return err(cause as never);
        return err({ code: 'WRITE_FAILED', message: cause instanceof Error ? cause.message : 'patch failed', cause });
      }
    },
  };
}
