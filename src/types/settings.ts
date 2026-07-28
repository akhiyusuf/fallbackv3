/** M0. F8 theme/accent, F9 onboarding, F14 notifications, F20 sync, F21 widgets, F17/F18 entitlement. */

import type { CycleCadence } from './progress';
import type { Id, Instant, LocalDate } from './primitives';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type AccentKey = 'forge-orange' | 'indigo' | 'berry' | 'plum';

export interface NotificationPrefs {
  readonly master: boolean;
  readonly routineDue: boolean;
  readonly eventStarting: boolean;
  readonly courseDose: boolean;
  readonly courseEndingSoon: boolean;
  readonly gentleReentry: boolean;
  readonly milestoneReached: boolean;
  readonly dailyDigest: boolean;
  /** `HH:mm`, device-local. */
  readonly dailyDigestTime: string;
}

/**
 * F16 — S36's "Voice & language" selection. Architect CR-6 (wave-2 review): this was
 * in-process-only module state in `src/features/assistant/voiceLanguagePrefs.ts` because no
 * durable home existed for it; it now lives on the `settings` singleton (SCHEMA §1,
 * migration 4) alongside theme/accent/notification prefs, so it survives a restart and rides
 * along in F19 backups for free.
 *
 * Both are free-form ids, NOT closed sets at the storage layer: S36's option lists are M6's
 * to grow (more voices, more languages) without a migration. Defaults `'en-US'` / `'warm'`.
 */
export interface AssistantPrefs {
  readonly language: string;
  readonly voice: string;
}

export type WidgetSize = 'small-today' | 'small-one-task' | 'medium-up-next';

export interface WidgetConfig {
  readonly size: WidgetSize;
  readonly mode: 'fixed-task' | 'smart-next-due';
  readonly fixedTaskId: Id | null;
}

export interface SyncState {
  readonly enabled: boolean;
  readonly lastSyncedAt: Instant | null;
  readonly lastError: string | null;
}

/** F17/F18. There is NO account — entitlement is derived from a store receipt or a local BYO key. */
export interface EntitlementState {
  readonly source: 'none' | 'subscription' | 'byo-key';
  readonly plan: 'monthly' | 'annual' | null;
  readonly status: 'none' | 'trial' | 'active' | 'expired';
  readonly renewsOn: LocalDate | null;
  readonly trialEndsOn: LocalDate | null;
  /** F18: true when a validated BYO endpoint exists. The key itself lives ONLY in SecureStore. */
  readonly hasByoKey: boolean;
  /** F18 graceful degradation: false => voice unavailable for this key, text still works. */
  readonly byoSupportsTranscription: boolean;
}

/** The whole singleton settings row. Wiped in full by F25. */
export interface Settings {
  readonly schemaVersion: number;
  readonly theme: ThemeMode;
  readonly accent: AccentKey;
  readonly onboardingCompletedAt: Instant | null;
  /** F29 anchor: the device-local calendar date the store was first created. */
  readonly tenureAnchorDate: LocalDate;
  readonly cycleCadence: CycleCadence;
  readonly notifications: NotificationPrefs;
  /** F16 — S36's voice/language selection (architect CR-6). */
  readonly assistant: AssistantPrefs;
  readonly widgets: readonly WidgetConfig[];
  readonly sync: SyncState;
  readonly lastBackupAt: Instant | null;
  readonly updatedAt: Instant;
}
