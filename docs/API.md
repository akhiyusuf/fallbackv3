# API — Fallback

Fallback is local-first, so "API" means two things:

1. **§1–§3 — the app's internal service surface.** The typed boundaries between modules.
   Builders code against *these*, never against each other's implementations.
2. **§4–§6 — the three network boundaries.** The managed-assistant backend (F16/F17), the
   BYO provider path (F18), and cloud sync (F20). These are the only outbound traffic the
   app ever produces.

Every interface below already exists as TypeScript in `src/types/ports.ts` (owned by M0,
frozen after M0 ships). This document is the prose contract for it.

**Universal conventions.**

- Every fallible call returns `Result<T, AppError>`. **No service throws across a module
  boundary.** `AppError.message` is developer-facing and is never rendered.
- All dates crossing a boundary are `LocalDate` (`'YYYY-MM-DD'`, device-local); all
  instants are ISO-8601 UTC.
- Error codes come from the closed `AppErrorCode` union in `src/types/primitives.ts`.

---

## 1. Data layer — `Repositories` (implemented by M1, `src/db/`)

The only SQL in the app. Consumed exclusively by M2's query/mutation layer; **a feature
module must never import `@/db`.**

```ts
interface TaskRepository {
  list(opts?: { includeDeleted?: boolean }): Promise<readonly TaskWithSteps[]>;
  get(id: Id): Promise<TaskWithSteps | null>;
  insert(task: Task, steps: readonly Step[]): Promise<Result<Id>>;
  update(id: Id, patch: Partial<Task>, steps?: readonly Step[]): Promise<Result<void>>;
  softDelete(id: Id): Promise<Result<void>>;   // cascades per SCHEMA.md §2.3
  duplicate(id: Id): Promise<Result<Id>>;      // copies defs + metadata + toggle state, EMPTY history
}

interface LogRepository {
  listForDate(date: LocalDate): Promise<readonly DayLog[]>;
  listForTask(taskId: Id, from: LocalDate, to: LocalDate): Promise<readonly DayLog[]>;
  listRange(from: LocalDate, to: LocalDate): Promise<readonly DayLog[]>;
  upsert(log: DayLog): Promise<Result<void>>;  // last-write-per-field; rapid taps cannot corrupt a row
  deleteForTask(taskId: Id): Promise<Result<void>>;
}

interface OffDayRepository {
  listRange(from: LocalDate, to: LocalDate): Promise<readonly OffDayMark[]>;
  mark(mark: OffDayMark): Promise<Result<void>>;     // snapshots prior chip state
  unmark(date: LocalDate, taskId: Id | null): Promise<Result<void>>;  // restores it exactly
}

interface AsNeededRepository {                        // F27 — reference-only, read by S23 alone
  listForTask(taskId: Id): Promise<readonly AsNeededUse[]>;
  append(use: AsNeededUse): Promise<Result<void>>;
}

interface ProgressRepository {
  listXpAwards(from?: LocalDate, to?: LocalDate): Promise<readonly XpAward[]>;
  appendXpAward(award: XpAward): Promise<Result<void>>;   // UNIQUE(task_id, date) — no farming
  lifetimeXp(): Promise<number>;
  cyclingXp(cycleId: Id): Promise<number>;
  listUnlocks(): Promise<readonly AchievementUnlock[]>;
  upsertUnlock(u: AchievementUnlock): Promise<Result<void>>;   // upsert-only, never deletes
  listCycleRecords(): Promise<readonly CycleRecord[]>;
  getCycleRecord(id: Id): Promise<CycleRecord | null>;
  appendCycleRecord(r: CycleRecord): Promise<Result<void>>;    // append-only, never overwrites
}

interface SettingsRepository {
  get(): Promise<Settings>;
  patch(patch: Partial<Settings>): Promise<Result<Settings>>;
}

interface AssistantRepository {
  listConversations(): Promise<readonly AssistantConversation[]>;
  getConversation(id: Id): Promise<AssistantConversation | null>;
  listMessages(conversationId: Id): Promise<readonly AssistantMessage[]>;
  upsertConversation(c: AssistantConversation): Promise<Result<void>>;
  appendMessage(m: AssistantMessage): Promise<Result<void>>;
}
```

### 1.1 `StoreLifecycle` (M1)

```ts
interface StoreLifecycle {
  open(): Promise<Result<'ready' | 'corrupt' | 'uninitialised'>>;  // S01 calls this
  status(): 'ready' | 'corrupt' | 'uninitialised';
  eraseAll(): Promise<Result<void>>;                                // F25 — atomic
  backup(): Promise<Result<{ uri: string; createdAt: Instant }>>;   // F19
  restore(uri: string): Promise<Result<void>>;                      // non-destructive on failure
}
```

| Call | Errors |
|---|---|
| `open` | `STORE_CORRUPT` → S01 routes to S50 · `MIGRATION_FAILED` → S50 |
| `eraseAll` | `WRITE_FAILED` → S48 shows "Something went wrong erasing your data. Nothing was lost — try again." Store is left coherent |
| `backup` | `WRITE_FAILED` → calm retry, **no partial file left behind** |
| `restore` | `VALIDATION_FAILED` (unreadable/foreign file) → S47's inline banner, existing data explicitly untouched |

---

## 2. Domain engine — pure functions (implemented by M2, `src/domain/`)

No I/O, no React, no `new Date()`. This is the layer qa-tester's golden fixtures target.

```ts
// occurrence.ts — cadence → occurrence set, F23/F24 due-step resolution
isDue(task: TaskWithSteps, date: LocalDate): boolean            // always false for as-needed & to-do
occurrencesBetween(task, from, to): LocalDate[]
dueIdealStepIds(task, date): Id[]                                // non-empty for any due tracked task

// dayState.ts — the ONE place the chip→outcome mapping lives
resolveOccurrence({ task, date, today, log, offMarks }): Occurrence
autoChipState(occurrence): 'todo' | 'done' | 'fallback'

// consistency.ts — F5 both scopes; F28 buckets and F30 cycles reuse it with a DateRange
perTaskConsistency({ taskId, occurrences, window, today }): ConsistencyResult
aggregateConsistency({ occurrences, window, today }): ConsistencyResult
dayFractions(occurrences): DayFraction[]                         // powers S25's disclosure table

// xp.ts — F13 lifetime and F31 cycling share ONE eligibility predicate
isXpEligible(o: Occurrence): boolean
xpForOccurrence(o: Occurrence): number                           // 10 ideal / 6 fallback / 0 otherwise
levelFor(lifetimeXp: number): LevelInfo

// achievements.ts — idempotent, upsert-only
reconcileAchievements({ occurrences, tenureAnchor, today, alreadyUnlocked }): AchievementUnlock[]

// cycles.ts — F30/F31 boundaries
currentCycleWindow(cadence, date): CycleWindow
nextCycleWindow(w): CycleWindow
cyclesElapsedSince(w, today): CycleWindow[]

// validation.ts — ONE implementation, called by S16–S19 (create) and S20 (edit)
validateTaskDraft(draft: TaskDraft): Result<TaskDraft>
emptyRunOccurrences(draft: TaskDraft): string[]                  // weekday names for the inline error
```

Hard invariants any implementation must satisfy — see ARCHITECTURE.md §6.6 for the golden
table:

- `numerator === denominator − missed`, at every read, including mid-day.
- `percent === null` when `denominator === 0`. **Never `0`.**
- As-needed routines contribute nothing at either scope, by never being due — a
  *structurally different* mechanism from off-days, which remove an otherwise-due day.
- Off-ness and pending-ness both compose **per task within a day**, never per day.

---

## 3. Query/mutation layer (implemented by M2, `src/queries/`)

**The only data surface a feature module may touch.** Read hooks compose repositories with
the domain engine; mutations own persistence *and* all downstream reconciliation.

```ts
// reads
useTasks(filter?)                       useTask(id)
useToday(date)                          useTaskOccurrences(taskId, range)
useConsistency({ scope, window, taskId })
useTrend()                              useProgress()
useCycleRecords()                       useCycleRecord(id)
useSettings()                           useConversations()   useConversation(id)

// mutations — each returns Result and NEVER reports success on a failed write
useCreateTask()      useUpdateTask()     useDeleteTask()     useDuplicateTask()
useLogState()        // chip tap: To do / Done / Fallback / Skip
useToggleStep()      // step checkbox → auto-log per F3
useLogDose()         // F12
useMarkOffDay()      // whole-day or task-day, and un-mark
useLogAsNeededUse()  // F27 — reference-only
useMoveOccurrence()  // F7 snooze / move
useUpdateSettings()
```

**Every mutation runs this exact sequence.** Deviating from it is how the app drifts.

```
1. persist through the repository                        (M1)
2. if !ok → return the error; the caller reverts optimistic UI and shows retry copy
3. reconcile XP awards for the affected occurrence       (domain/xp)
4. reconcile achievements + the tenure ladder            (domain/achievements)
5. reconcile cycle boundaries (archive-then-reset)       (domain/cycles)
6. invalidate the declared QUERY_KEYS
7. emit AppEvents                                        (src/lib/events)
```

Step 7's events are what let M7 reschedule notifications and republish the widget snapshot
without M2 importing M7. The event union in `src/types/ports.ts` is **closed**:
`store:ready · store:erased · task:changed · day:logged · offday:changed · xp:awarded ·
level:up · badge:unlocked · cycle:finalized · settings:changed`.

`useLogState` returns the celebration decision so the caller can present S24, and then S28
if the same completion crossed a level-up or milestone threshold:

```ts
{ ok: true, value: { outcome: OccurrenceOutcome, xpAwarded: number,
                     celebrate: 'none' | 'ideal' | 'fallback',
                     levelUp: LevelInfo | null, badgesUnlocked: string[] } }
```

A **Skip** returns `celebrate: 'none'` — calm neutral acknowledgment, no celebration. An
**as-needed "used it"** log returns `xpAwarded: 0`, `celebrate: 'none'`, `levelUp: null`,
`badgesUnlocked: []` — always, no matter how many times it is logged.

---

## 4. Managed assistant backend (F16 / F17) — network boundary #1

Owned by **M6**, source in `server/`. **The backend holds no accounts and stores no user
data.** It is a stateless proxy to Groq. It never sees habit data — only the conversation
messages the user chose to send, which the PRD discloses at the assistant/paywall boundary.

Base URL comes from `app.config.ts → extra.assistantApiBaseUrl`.

### Authentication — receipt-based, no identity
There is no login, no user id, no session. Each request carries the platform's own
purchase credential:

```
X-Fallback-Platform: ios | android
X-Fallback-Receipt:  <base64 StoreKit 2 transaction JWS | Google Play purchase token>
X-Fallback-Client:   fallback/1.0.0 (ios 17.4)
```

The backend verifies the credential against Apple's / Google's server APIs, uses the
result for that request only, and **persists nothing** — not the receipt, not a hash of it,
not the messages, not a log line containing message content.

### `POST /v1/chat` — streaming completion

Request:
```jsonc
{
  "messages": [ { "role": "user" | "assistant", "content": "…" } ],
  "tools": ["create_task","update_task","delete_task","log_state","ask_clarification"],
  "context": { "tasks": [ { "id": "…", "name": "…", "type": "routine" } ] }   // names+ids only, for disambiguation
}
```

Response: `text/event-stream`, one JSON object per `data:` line, mapping 1:1 onto
`AssistantEvent`:
```
data: {"type":"text-delta","delta":"Done — created it"}
data: {"type":"tool-call","call":{"id":"…","name":"create_task","args":{…}}}
data: {"type":"refusal","category":"medical-advice","text":"…"}
data: {"type":"done","summary":"Added a workout, a meditation course & a reminder to call mom"}
```

**Tool calls are proposals, not actions.** The model never touches a database. The client
validates each call against the same `validateTaskDraft` every form uses, applies it
locally through M2's mutations, and pushes an inverse onto the conversation's undo stack
(F16's Undo, `AssistantUndoEntry`). A malformed or invalid tool call is dropped and the
assistant is asked to restate — it never produces a half-written task.

### `POST /v1/transcribe` — speech-to-text
`multipart/form-data`, field `audio` (m4a/aac), ≤60 s. Returns `{ "text": "…" }`.

**Managed STT source — PINNED (PRD §7, OWNER: architect): Groq provides both.**
`whisper-large-v3-turbo` for transcription and `llama-3.3-70b-versatile` for chat. No
separate transcription vendor is needed, which removes a second contract, a second failure
mode and a second privacy disclosure. Model ids are server-side configuration, not client
constants. Vendor stays invisible; the user-facing name is **"Fallback AI"**.

### `GET /v1/health` → `{ "status": "ok" }`

### Error codes

| HTTP | `code` | Client behaviour |
|---|---|---|
| 400 | `bad_request` | developer error; calm generic failure |
| 401 | `entitlement_invalid` | route to S38 paywall |
| 402 | `entitlement_expired` | route to S38 paywall |
| 429 | `rate_limited` | calm inline retry with backoff |
| 502 | `upstream_unavailable` | S32's calm offline/error footer — never a hang, never full-screen red |
| 503 | `guardrail_unavailable` | refuse the turn rather than proceed unguarded |

### Guardrails (R15)
The same `GUARDRAIL_SYSTEM_PROMPT` constant (owned by M6) is injected on **both** paths.
On the managed path the backend re-injects it server-side and screens the response, so a
tampered client cannot bypass it. Five refusal categories: self-harm, harm to others,
illegal-activity instructions, medical/dosing/clinical advice, eating-disorder /
extreme-restriction facilitation.

**The literal logging task is always still fulfilled**, with no advice attached:

| Input | Behaviour |
|---|---|
| "add antibiotics twice a day" | **creates the task literally** — "Antibiotics — 2×/day", ideal+fallback, no dosing advice |
| "is 2 a day the right dose for me?" | **declines the medical-advice portion**, offers to log |
| "remind me to eat lunch every day" | **created literally** as a neutral eating routine |
| "goal to eat under 800 calories to lose weight fast" | **declines the unsafe goal-setting**, offers a neutral non-numeric eating routine |

It never claims to be a doctor, therapist, lawyer or emergency service. For an apparent
crisis it may surface a brief generic encouragement to seek qualified help, then decline
the harmful portion. Refusals are calm and non-preachy.

---

## 5. BYO provider (F18) — network boundary #2

`ByoAssistantProvider` implements the identical `AssistantProvider` port, so **no screen
knows which path it is on**. Calls go **directly to the user's endpoint and never touch
Fallback's backend**.

- Config: a single OpenAI-compatible **base URL + API key** (S40). No named per-provider
  integrations (PRD §4).
- Storage: **`expo-secure-store` only.** Never SQLite, never a backup file, never a log,
  never an outbound request to us.
- `POST {baseUrl}/chat/completions` with `Authorization: Bearer <key>`, `stream: true`,
  OpenAI tool-calling schema — the same five tools as §4.
- `POST {baseUrl}/audio/transcriptions` if supported.
- **Save-time capability probe (S40):** one lightweight chat-completion call, plus an
  opportunistic transcription probe. Completion fails → `Invalid` state, fields keep their
  values, calm inline error, never full-screen red. Completion succeeds and transcription
  fails or is unsupported → **saved anyway** in text-only mode with the warning-tone
  capability banner. **Uncertain transcription support must never block a save.**
- **Guardrails are best-effort here** (PRD Decisions item 8): Fallback injects its own
  system prompt and applies the same pre-send category screen, but cannot guarantee a
  third-party model's behaviour. This is an accepted, documented limitation.

---

## 6. Cloud sync (F20) — network boundary #3

```ts
interface SyncProvider {
  readonly id: 'icloud-documents' | 'google-drive-appdata' | 'noop';
  isAvailable(): Promise<boolean>;
  push(): Promise<Result<Instant>>;
  pull(): Promise<Result<Instant | null>>;
}
```

Opt-in, **off by default**; on-device stays the default and the baseline. Whole-store
snapshot replication of the same envelope F19 uses (SCHEMA.md §9), minus secrets.

- **iOS:** iCloud Documents ubiquity container. No sign-in; uses the device's Apple ID.
- **Android:** Google Drive `appDataFolder` via `expo-auth-session` + REST. The user signs
  into **their own** Google account, and only when enabling sync. Fallback still has no
  accounts and no server. Declining leaves sync off and nothing else changes.
- **Conflict: local always wins.** `pull()` only applies a remote snapshot when the local
  store has no unsynced changes. True convergent multi-device resolution is **F22, P2,
  out of v1** — do not build toward it, do not leave hooks implying it.
- Failure is calm and non-destructive: the toggle stays on, local data untouched, S45
  renders the warning-tone banner ("Couldn't sync right now. Your data is safe on this
  device — we'll try again automatically"), never `error`/red.
- `sync_last_synced_at` drives the "Last synced 2 min ago" line.

---

## 7. Billing (F17) — `BillingProvider` (M6)

```ts
init(): Promise<Result<void>>
getProducts(): Promise<Result<readonly { sku, plan: 'monthly'|'annual', localizedPrice }[]>>
purchase(plan): Promise<Result<void>>          // gated on the OS biometric prompt first
restore(): Promise<Result<boolean>>            // no login, no account
refreshEntitlement(): Promise<Result<void>>
currentReceipt(): Promise<string | null>       // forwarded per request to §4, never persisted server-side
```

SKUs: `fallback.ai.monthly` ($4.99/mo) and `fallback.ai.annual` ($39.99/yr), both with a
**7-day free trial**. Store-native only — no third-party or custom payment rails, and
deliberately no entitlement-as-a-service vendor (it would store user data server-side).
Cancellation is handed off to the platform's own subscription surface (S44); Fallback has
no in-app cancel API to call.

**Failure states are calm, never punitive:** biometric cancel → inline "try again, or use
your device passcode", plan selection preserved, no charge. Purchase error → "Couldn't
complete the purchase. Nothing was charged — try again." Store unreachable → Card A
disables, **Card B (BYO) is entirely unaffected** and the banner says so. That asymmetry is
the concrete, testable expression of "BYO is an equal alternative".

---

## 8. Platform services

```ts
interface NotificationScheduler {          // M7, F14 — local only, no push tokens
  requestPermission(): Promise<Result<boolean>>;   // ALWAYS primed first (S07 / S37)
  hasPermission(): Promise<boolean>;
  reschedule(): Promise<Result<void>>;             // idempotent; rolling 7-day horizon
  cancelAll(): Promise<Result<void>>;
}

interface WidgetBridge {                   // M7, F21
  publishSnapshot(): Promise<Result<void>>;        // writes the shared-container JSON
}
```

Both subscribe to the event bus rather than being called by M2. The app is **fully usable
if notification permission is declined**. As-needed routines are never due, so they
generate no "routine due" reminders.
