/**
 * M0. Port interfaces — the seams between modules.
 * A module implements the ports it owns; every other module depends on the INTERFACE only.
 * Implementations and owners are listed in docs/API.md and docs/MODULES.md.
 */

import type {
  AssistantCapabilities,
  AssistantConversation,
  AssistantEvent,
  AssistantMessage,
} from './assistant';
import type { AsNeededUse, DayLog, OffDayMark } from './log';
import type { AchievementUnlock, CycleRecord, XpAward } from './progress';
import type { Id, Instant, LocalDate, Result } from './primitives';
import type { Settings } from './settings';
import type { Step, Task, TaskWithSteps } from './task';

/* ------------------------------------------------------------------ M1: repositories */

export interface TaskRepository {
  list(opts?: { includeDeleted?: boolean }): Promise<readonly TaskWithSteps[]>;
  get(id: Id): Promise<TaskWithSteps | null>;
  insert(task: Task, steps: readonly Step[]): Promise<Result<Id>>;
  update(id: Id, patch: Partial<Task>, steps?: readonly Step[]): Promise<Result<void>>;
  softDelete(id: Id): Promise<Result<void>>;
  duplicate(id: Id): Promise<Result<Id>>;
}

export interface LogRepository {
  listForDate(date: LocalDate): Promise<readonly DayLog[]>;
  listForTask(taskId: Id, from: LocalDate, to: LocalDate): Promise<readonly DayLog[]>;
  listRange(from: LocalDate, to: LocalDate): Promise<readonly DayLog[]>;
  upsert(log: DayLog): Promise<Result<void>>;
  deleteForTask(taskId: Id): Promise<Result<void>>;
}

export interface OffDayRepository {
  listRange(from: LocalDate, to: LocalDate): Promise<readonly OffDayMark[]>;
  mark(mark: OffDayMark): Promise<Result<void>>;
  unmark(date: LocalDate, taskId: Id | null): Promise<Result<void>>;
}

export interface AsNeededRepository {
  listForTask(taskId: Id): Promise<readonly AsNeededUse[]>;
  append(use: AsNeededUse): Promise<Result<void>>;
}

export interface ProgressRepository {
  listXpAwards(from?: LocalDate, to?: LocalDate): Promise<readonly XpAward[]>;
  appendXpAward(award: XpAward): Promise<Result<void>>;
  lifetimeXp(): Promise<number>;
  cyclingXp(cycleId: Id): Promise<number>;
  listUnlocks(): Promise<readonly AchievementUnlock[]>;
  upsertUnlock(unlock: AchievementUnlock): Promise<Result<void>>;
  listCycleRecords(): Promise<readonly CycleRecord[]>;
  getCycleRecord(id: Id): Promise<CycleRecord | null>;
  appendCycleRecord(record: CycleRecord): Promise<Result<void>>;
}

export interface SettingsRepository {
  get(): Promise<Settings>;
  patch(patch: Partial<Settings>): Promise<Result<Settings>>;
}

export interface AssistantRepository {
  listConversations(): Promise<readonly AssistantConversation[]>;
  getConversation(id: Id): Promise<AssistantConversation | null>;
  listMessages(conversationId: Id): Promise<readonly AssistantMessage[]>;
  upsertConversation(c: AssistantConversation): Promise<Result<void>>;
  appendMessage(m: AssistantMessage): Promise<Result<void>>;
}

export interface Repositories {
  readonly tasks: TaskRepository;
  readonly logs: LogRepository;
  readonly offDays: OffDayRepository;
  readonly asNeeded: AsNeededRepository;
  readonly progress: ProgressRepository;
  readonly settings: SettingsRepository;
  readonly assistant: AssistantRepository;
}

/* ------------------------------------------------------------------ M1: store lifecycle */

export type StoreStatus = 'ready' | 'corrupt' | 'uninitialised';

export interface StoreLifecycle {
  open(): Promise<Result<StoreStatus>>;
  status(): StoreStatus;
  /** F25. Atomic: fully erased or fully intact — never half-wiped. */
  eraseAll(): Promise<Result<void>>;
  /** F19. */
  backup(): Promise<Result<{ uri: string; createdAt: Instant }>>;
  restore(uri: string): Promise<Result<void>>;
}

/* ------------------------------------------------------------------ M1: sync (F20) */

export interface SyncProvider {
  readonly id: 'icloud-documents' | 'google-drive-appdata' | 'noop';
  isAvailable(): Promise<boolean>;
  /** Local is authoritative on conflict for the v1 best-effort tier. F22 (true convergence) is P2. */
  push(): Promise<Result<Instant>>;
  pull(): Promise<Result<Instant | null>>;
}

/* ------------------------------------------------------------------ M6: assistant */

export interface AssistantProvider {
  readonly id: 'managed' | 'byo';
  capabilities(): Promise<AssistantCapabilities>;
  streamChat(input: {
    conversationId: Id;
    messages: readonly AssistantMessage[];
    signal?: AbortSignal;
  }): AsyncIterable<AssistantEvent>;
  transcribe(input: { uri: string; signal?: AbortSignal }): Promise<Result<string>>;
}

/* ------------------------------------------------------------------ M6: billing (F17) */

export interface BillingProvider {
  init(): Promise<Result<void>>;
  getProducts(): Promise<Result<readonly { sku: string; plan: 'monthly' | 'annual'; localizedPrice: string }[]>>;
  purchase(plan: 'monthly' | 'annual'): Promise<Result<void>>;
  restore(): Promise<Result<boolean>>;
  /** Reads the current store entitlement. No login, no account, no server round-trip for the check itself. */
  refreshEntitlement(): Promise<Result<void>>;
  /** Opaque store receipt/token forwarded to the managed backend per request. Never persisted server-side. */
  currentReceipt(): Promise<string | null>;
}

/* ------------------------------------------------------------------ M7: notifications (F14) */

export interface NotificationScheduler {
  requestPermission(): Promise<Result<boolean>>;
  hasPermission(): Promise<boolean>;
  /** Idempotent: clears and re-arms the rolling horizon from current tasks + prefs. */
  reschedule(): Promise<Result<void>>;
  cancelAll(): Promise<Result<void>>;
}

/* ------------------------------------------------------------------ M7: widgets (F21) */

export interface WidgetBridge {
  /** Writes the shared-container snapshot the native widget targets read. */
  publishSnapshot(): Promise<Result<void>>;
}

/* ------------------------------------------------------------------ M0: event bus */

export type AppEvent =
  | { readonly type: 'store:ready' }
  | { readonly type: 'store:erased' }
  | { readonly type: 'task:changed'; readonly taskId: Id }
  | { readonly type: 'day:logged'; readonly taskId: Id; readonly date: LocalDate }
  | { readonly type: 'offday:changed'; readonly date: LocalDate }
  | { readonly type: 'xp:awarded'; readonly amount: number; readonly kind: 'ideal' | 'fallback' }
  | { readonly type: 'level:up'; readonly level: number }
  | { readonly type: 'badge:unlocked'; readonly key: string }
  | { readonly type: 'cycle:finalized'; readonly recordId: Id }
  | { readonly type: 'settings:changed' };
