# Review — M6 (pass 1)
VERDICT: CHANGES_REQUIRED

Module: Assistant, billing & BYO (+ backend) — S31–S40, S44.
Reviewed: `src/features/assistant/**`, `src/services/ai/**`, `src/services/billing/**`,
`server/**`, `app/assistant/**`, `app/settings/subscription.tsx`, plus the disclosed
`__mocks__/expo-iap.js`.

**Headline: the two hard security boundaries — the BYO key and the stateless backend —
are genuinely clean. I verified both independently (see Verified). What fails this pass
is payment-flow correctness (a subscriber loses the feature after every app restart;
billing facts on S44/S36 are fabricated fixture strings; cancellation is unreachable)
and assistant correctness (tool calls — the module's entire point — are dropped or
unassemblable on both providers; clarification claims a write that never happened).**

---

## Blocking items

Ordered: payment-flow correctness first, then the assistant's core action path, then
spec fidelity. The BYO key boundary itself has **no** blocking findings.

### B1 — A paying subscriber loses the assistant after every app restart: `latestReceipt` is never repopulated
`src/services/billing/index.ts:34,167-186`. `latestReceipt` is an in-memory module
variable stamped only by the `purchaseUpdatedListener` (line 84) and `restore()`
(line 157). `refreshEntitlement()` (lines 167–181) fetches the active purchase — which
carries the receipt — patches the entitlement store, and **discards the receipt**.
After any relaunch, `currentReceipt()` returns `null`, the managed provider sends
`X-Fallback-Receipt: ''` (`managedProvider.ts:36`), the server correctly 401s, and
(via B4) the user is told "You're offline." A subscriber must know to tap Restore
Purchases to get back what they paid for.
**Fix:** stamp `latestReceipt = receiptOf(active)` inside `refreshEntitlement`.
**Acceptance test:** mock `getAvailablePurchases` to return an active purchase with a
token; call `refreshEntitlement()`; assert `await billing.currentReceipt()` returns
that token without any `purchase()`/`restore()` call. (Also close the 50 ms
settle-window race at `index.ts:139` while here — see N6.)

### B2 — S44/S36 display fabricated billing facts
- `app/settings/subscription.tsx:96` — trial line hardcodes `3` days regardless of the
  actual trial: `` `${S44_COPY.trialEndsPrefix} 3 ${S44_COPY.trialSuffix}` ``. The
  spec's "Trial ends in 3 days" is sample copy, not a constant.
- `app/settings/subscription.tsx:97` — `entitlement.renewsOn` is never populated by
  `refreshEntitlement` (`billing/index.ts:176` patches only `source/plan/status`), so
  the active state renders "Renews —".
- `app/assistant/chat.tsx:198` — S36's Manage-subscription subtitle is the hardcoded
  spec fixture `"Fallback AI · renews Aug 20"`, shown to every user forever. The spec
  (ALLSCREENS S36, lines 3520–3523) requires this fetched async with a Skeleton — the
  `OptionsSheet` component even implements the Skeleton path (`OptionsSheet.tsx:86-90`)
  and the screen defeats it with a constant.
- Same cluster: S36's Voice & language selects are specced to "persist immediately
  (F16 setting) with a calm Toast ('Saved')" (spec line 3532) — `chat.tsx` never passes
  `onSaveVoiceLanguage`, so changes persist nowhere and no toast fires.
**Acceptance:** renewal/trial lines derived from real entitlement data (populate
`renewsOn`/`trialEndsOn` from the purchase record, or render nothing when unknown —
never a fake number); S36 subtitle from the same source; language/voice wired to a
persisted setting with the Saved toast; tests asserting no fixture string renders when
the store reports different data.

### B3 — Cancellation is unreachable in the shipped app: "Manage in App Store" is a toast
`app/settings/subscription.tsx:59-61` — `handleManageInStore` only shows the toast
`"Opens the App Store"`. The spec (S44 line 4043) is explicit that the toast is the
*mockup* behaviour and "this leaves the app in the shipped product"; MODULES M6
non-negotiable: "Cancellation hands off to the platform's own surface." `expo-iap`
ships `deepLinkToSubscriptions()` — it is even enumerated in this module's own mock
(`__mocks__/expo-iap.js:36`) — and it is never called anywhere (`grep` confirms).
**Fix:** call `deepLinkToSubscriptions()` (or `Linking.openURL` to the platform
subscription surface). **Acceptance test:** pressing the button invokes the deep-link
API; the toast may remain as feedback.

### B4 — Entitlement errors mid-chat are rendered as "You're offline"
`src/features/assistant/useAssistantChat.ts:93-94` collapses **every** `error` event to
`setOffline(true)`. `managedProvider.ts:107-114` correctly maps 401→
`ENTITLEMENT_REQUIRED` and 402→`ENTITLEMENT_EXPIRED`, and API.md §4's client-behaviour
table pins both to "route to S38 paywall" — instead the user gets the offline copy
("You're offline…"), which is false. Compounds B1: today every restarted subscriber
hits exactly this path. **Acceptance test:** a stream yielding
`{type:'error', code:'ENTITLEMENT_REQUIRED'}` routes to `/assistant/paywall`, not the
offline footer.

### B5 — BYO provider silently drops every tool call: the BYO assistant cannot act at all
`src/services/ai/byoProvider.ts:132-140` — `mapOpenAiChunkToEvent` types
`tool_calls` out of the delta and never emits a `tool-call` event; only `text-delta`
and `done` are mapped. On the BYO path `create_task`/`update_task`/`delete_task`/
`log_state`/`ask_clarification` can never fire — the assistant is reduced to a chat
box that can't create anything. Violates API.md §5 ("the same five tools as §4") and
the provider-parity non-negotiable in its *behavioural* sense (the structural parity
test, `providerParity.test.ts`, cannot see this). **Fix:** accumulate OpenAI-style
fragmented tool-call deltas (keyed by `index`, name in the first fragment, `arguments`
concatenated across fragments) and emit one assembled `tool-call` per completed call.
**Acceptance test:** a streaming fixture with a tool call fragmented across ≥3 chunks
yields exactly one `tool-call` event whose `args` JSON-parse to the full draft.

### B6 — Server tool-call relay cannot assemble fragmented arguments; tools sent with no schema
- `server/src/index.js:77-89` emits a `tool-call` on the **first** chunk carrying
  `function.name`, with only that chunk's `arguments` (`safeParse` → `{}` on the
  typical empty/partial first fragment), and drops every later argument delta. In real
  OpenAI-compatible streaming, arguments arrive fragmented — so managed tool calls
  will reach the client as `{}`/partial args, fail `validateTaskDraft`, and be dropped
  every time. The fail-safe direction is right (dropped, never half-written), but the
  feature doesn't work.
- `server/src/groq.js:28` and `byoProvider.ts:62` send
  `{type:'function', function:{name}}` with **no `parameters` schema and no
  description** — the model has no contract for what arguments to produce, so even a
  single-chunk call arrives unusable.
**Fix:** accumulate by tool-call index until the choice finishes; define real JSON
schemas for the five tools (matching `AssistantToolCall` in `src/types/assistant.ts`)
in one place per deployable. **Acceptance:** server test streaming a 3-fragment
tool call asserts one SSE `tool-call` frame with complete parsed args.

### B7 — Hardcoded `gpt-4o-mini` breaks every non-OpenAI endpoint the copy promises
`src/services/ai/byoProbe.ts:23` and `byoProvider.ts:57` hardcode
`model: 'gpt-4o-mini'`. A valid Groq key against `https://api.groq.com/openai/v1`
(the module's own test fixture URL, `byoKeyNeverInBackup.test.ts:74`) returns
model-not-found → probe fails → S40 shows "Couldn't verify this endpoint" for a
perfectly good endpoint. This directly contradicts verbatim shipped copy in the same
module: S38 Card B "Works with OpenAI, Groq, local models & more" and S40's intro
(spec lines 3682, 3798). **Fix:** discover a model at save time (e.g.
`GET {base}/models`, persist the chosen id alongside the config in SecureStore) with
`gpt-4o-mini` as a last-resort fallback. **Acceptance test:** a mocked Groq-shaped
endpoint (rejects `gpt-4o-mini`, lists its own models) validates and chats.

### B8 — Clarification resolution writes nothing but tells the user it logged
`src/features/assistant/useAssistantChat.ts:150-159` — `resolveClarification` closes
the modal and appends `"Got it — logged for <task>."` **without applying anything**:
no `applyToolCall`, no mutation, no follow-up turn to the model. The transcript
asserts a write that never happened — the inverse of "never a half-written task" and a
direct honesty violation on data state. **Fix:** carry the pending ambiguous action
through the clarification (apply the resolved `log_state`/edit via `useToolExecutor`,
or re-send the resolution to the model and let it re-propose), and only then confirm.
**Acceptance test:** resolving a clarification for a `log_state` proposal calls
`useLogState.mutateAsync` with the chosen taskId before the confirmation turn appears.

### B9 — Conversation continuity is not wired: `continueId` ignored, no history sent
- `app/assistant/history/[id].tsx:55` passes `continueId` to `/assistant/chat`;
  `app/assistant/chat.tsx:25` reads only `{opening, listen}` and never passes
  `conversationId` to `useAssistantChat` (which supports it,
  `useAssistantChat.ts:39`). S35's core interaction — "resuming this same
  conversation thread live" (spec lines 3457–3460) — silently starts a new thread.
- `useAssistantChat.ts:86` sends `messages: [userMessage]` — only the current turn,
  never prior turns (persisted or in-memory). Multi-turn conversation, S32's own
  worked example ("7:30am, right after the workout" as a follow-up), cannot work on
  either provider; the model has amnesia every turn.
**Acceptance:** chat.tsx forwards `continueId` as `conversationId` and seeds the
transcript from `listMessages`; `streamChat` receives the running message history;
tests for both.

### B10 — Assistant "Undo" reverts only part of the edit
`src/features/assistant/toolExecutor.ts:119-135` — the `update_task` revert restores
`name/note/cadence/timeOfDay` + steps but **not** `eventDate`, `startDate`, `endDate`,
`dosesPerDay`, `isTracked`, `importance`, `necessity`, `icon`, `color`, `snoozable` —
all of which the model may patch (they are all in `Partial<TaskDraft>`). Spec Flow 4+.A:
Undo "reverts that specific edit." An undo that leaves half the edit applied is a data
defect wearing a reassurance label. **Fix:** revert the full `previousDraft` (it is
already captured at line 91). **Acceptance test:** patch `importance` + `timeOfDay`
via `update_task`, undo, assert both restored.

### B11 — Voice path: S32→S37 recovery edge absent, misleading comment, and the managed backend's transcribe route is a 501
- `app/assistant/chat.tsx:72-77` — `handleMicToggle` flips a label. The comment claims
  "Permission is re-verified here rather than trusted" — **it is not**; there is no
  permission check and no navigation to S37's recovery framing (spec lines 3230–3240,
  a sitemap edge). Voice mode renders "Listening…" forever with no capture, no
  waveform, no `transcribe()` call. The builder's disclosure covers the native
  record loop (fair — untestable under Jest); the *permission recheck and the
  S32→S37 navigation* are plainly testable in Jest (mock
  `getRecordingPermissionsAsync`) and absent. At minimum: implement the permission
  recheck + S37 navigation, make the comment truthful about what remains stubbed,
  and route the un-wirable capture behind one clearly-marked seam.
- `app/assistant/mic-primer.tsx:44-49` — recovery's "Open Settings" awaits
  `Linking.openSettings()` (which resolves as Settings *launches*) and immediately
  reads permission — i.e. while the user is still inside Settings. The specced "on
  return to the app: if the permission is now on → S32 listening" (lines 3605–3608)
  can never fire on first return. Fix: re-check on `AppState` → `'active'`.
- `server/src/index.js:156-161` — `POST /v1/transcribe` returns **501**
  ("multipart transcription wiring is deploy-specific") even though `handleTranscribe`
  is implemented and tested. Multipart parsing in plain Node is not deploy-specific;
  this leaves managed voice with no working end-to-end path at all. Wire the route (a
  minimal multipart reader or raw-body variant) or this must be raised as an explicit,
  architect-acknowledged scope cut — not buried in a 501 string.
**Related dead code:** `S32_COPY.transcribing` and `S32_COPY.followUpPrompt` are
unused; `handleTranscribe` is exported from `index.js:185` but unrouted.

### B12 — S40's degraded-success banner is unreadable: the delay is inverted
`app/assistant/paywall/byo.tsx:40-41` — `const delay = probe.transcription ? 600 : 0`.
Full success (banner: "Connected — you're all set") waits 600 ms; **degraded** success
— the banner that carries real information the user must read ("this endpoint doesn't
support voice, so you'll type instead") — navigates after 0 ms and is never seen. Spec
(lines 3822–3823) has both banners display before navigating. **Fix:** ≥600 ms for
both (arguably longer for degraded). **Acceptance test:** degraded probe result →
banner visible before `router.replace` fires.

### B13 — Receipt verifier's endpoints are not real, and its header claims otherwise
`server/src/receipt.js:34-52` — the Apple URL
(`.../inApps/v1/transactions/verify`, POST) is not an App Store Server API endpoint,
and the Google URL is missing the required
`applications/{pkg}/purchases/subscriptions/{sku}/tokens/{token}` path (and uses POST
where the API is GET). As written, production verification **always fails closed** —
safe direction, but the managed tier can never authenticate anyone. The header's claim
that "the concrete verifier is injected via `fetchImpl` so a deploy wires its real
credentials without touching this file's logic" is untrue: `fetchImpl` cannot fix a
wrong URL/method. **Fix:** implement the real endpoints behind env-provided
credentials, or replace the fake URLs with an explicit injected-verifier seam and a
loud, honest "NOT PRODUCTION-READY: fails closed" header. What is not acceptable is
code that *looks* like real verification and isn't.

---

## Non-blocking notes

1. **Guardrail duplication (client TS / server JS)** — the rationale (separate
   deployable, no cross-runtime import) is sound and both copies are byte-consistent
   today (prompt, 5 rules, literal-logging patterns, 4 fixtures — diffed). Drift risk
   is real for safety-critical text: add a cheap parity test (server test reads
   `../../src/services/ai/guardrails.ts` as text and asserts the prompt string
   appears verbatim). Also: `guardrails.ts:4` references `server/src/guardrails.ts` —
   the file is `.js`; and the refusal strings are a **third** copy each in
   `byoProvider.ts:114-129` and `server/src/index.js:109-120`, with subtly different
   default branches — consolidate per deployable.
2. **BYO "pre-send" screen isn't pre-send** — `byoProvider.ts:49-77` sends the flagged
   turn to the endpoint *before* yielding the refusal, then discards the response when
   there's no literal request. Best-effort is satisfied, but screening before the
   fetch would match API §5's wording and save a wasted call. Same shape server-side
   (`routes.js:39-49`): Groq is called before the refusal decision is applied. Also
   note API §4's "screens the response" is implemented as request-screening +
   system-prompt only; the response stream itself is not screened — document or add.
3. **`log_state` date passes through as `call.args.date as never`**
   (`toolExecutor.ts:152`) with no format validation in this layer; harmless if M2's
   mutation validates, but a model could propose garbage — cheap to guard here.
4. **create_task undo entry is built but never surfaced** (`toolExecutor.ts:78-85`;
   only `update_task` pushes to the undo stack, `useAssistantChat.ts:128-130`). The
   spec only shows the banner for edits, so behaviourally fine — either surface it or
   drop the dead field.
5. **"New conversation" replaces to the same route** (`chat.tsx:180`) — expo-router
   `replace` to the identical route may not remount, leaving the old transcript/
   `conversationIdRef` intact. Untested; add a key/param to force a fresh thread.
6. **`purchase()` 50 ms settle race** (`billing/index.ts:139`) — a fixed `setTimeout`
   waiting for `purchaseUpdatedListener` is fragile; prefer resolving off the listener
   event (or expo-iap's returned purchase). Largely mooted once B1 makes
   `refreshEntitlement` stamp the receipt.
7. **S39 strike-through styling** (`plan.tsx:62`, `styles.strike`) strikes the whole
   `"$59.88 → $39.99/yr"` string; spec strikes only `$59.88`.
8. **S34 date labels** always render `"MMM d, h:mm a"`; spec shows relative
   "Today, 8:14 AM" / "Yesterday, 6:40 PM". Also `history/index.tsx:22` uses
   `new Date`/date-fns directly rather than `src/lib/date` — display-only, but the
   "one clock" convention would prefer a helper.
9. **S40 Validating state** doesn't disable the two inputs (spec line 3820 — fields
   render `disabled` during the check); only the button is disabled.
10. **S35 back** (`history/[id].tsx:51`) uses `router.push('/assistant/history')`
    instead of `back()` — grows the stack on every hop.
11. **S32 offline escape hatch** uses `router.replace('/add')` (`chat.tsx:140`) rather
    than the specced back-nav-then-open-S15; conversation is persisted per-turn so no
    data is lost — acceptable, noting the deviation.
12. **`providerParity.test.ts` is structural only** (method surface + shape). After B5
    lands, add one behavioural parity fixture: same simulated stream through both
    providers yields the same event sequence.
13. **`__mocks__/expo-iap.js`** — legitimate, minimal, and unusually well documented
    (the virtual-mock indirection failure it works around is real). It is not masking
    a runtime problem: the runtime API surface used by `billing/index.ts` exists in
    expo-iap 4.7.0. Endorse the flagged follow-up to promote it into the frozen jest
    config as an architect change.
14. **`conversationStore.ts` direct `@/db` import** — verified genuinely narrow: five
    one-line delegations to M1's typed `AssistantRepository`, no SQL, no task/log/XP
    path touches it, and the header documents the frozen-contract gap and the exact
    M2 follow-up. Accept as the flagged exception; the architect should schedule the
    `useUpsertConversation`/`useAppendAssistantMessage` promotion.

---

## Verified (what I checked and how)

**BYO key boundary — CLEAN.**
- Ran `npx jest src/services/ai/__tests__/byoKeyNeverInBackup.test.ts` → PASS. Read
  the test: it seeds a real secret into mocked SecureStore via the real
  `setByoConfig`, opens M1's real store through `@/db`, inserts a real task, drives
  the real `store.backup()`, and asserts the on-disk envelope contains neither the
  secret, the `byo.apiKey` key name, nor any `entitlement` table. It is what it
  claims — noting the mocked SecureStore is structurally disjoint from SQLite, so its
  value is as a regression tripwire, which is the right expectation.
- Independently grepped `src/services/ai/**`, `src/features/assistant/**`,
  `src/services/billing/**`, `app/assistant/**`: **zero `console.*` calls** in any of
  these trees; the key reaches exactly one sink — the `Authorization` header of a
  fetch to the user's own `baseUrl` (`byoProvider.ts:23,100`, `byoProbe.ts:21,41`).
  No `X-Fallback-*` header, no `assistantApiBaseUrl`, no `@/db` import anywhere near
  the key. `secureKeyStore.ts` is the only importer of `expo-secure-store` in the
  module; `describeByoConfig` provides the redacted shape. M1's `eraseAll` clears
  `byo.baseUrl`/`byo.apiKey` (`src/db/lifecycle.ts:25` — M1-owned, read-only check).
- S40 holds the key in component state and passes it only to `probeByoEndpoint` /
  `setByoConfig`; `secureTextEntry` masked with reveal toggle.

**Backend statelessness — CLEAN.**
- Read all of `server/src/`: no `fs`, no db, no cache of receipts or messages; the
  single log call (`index.js:14-17`) receives method/path/status only. Entitlement
  verified per-request in `handleChat`/`handleTranscribe`; result used and dropped.
- `cd server && npm test` → **19/19 pass**, including the receipt-never-persisted
  shape test and the message-content-never-logged test (which patches `console.log`
  and asserts the secret string never appears).
- `server/package.json` declares zero dependencies (Node built-ins only).

**Provider parity.** `src/types/ports.ts:130-138` defines the port; both providers
implement it; `providerParity.test.ts` asserts identical method surfaces; grep
confirms `getAssistantProvider()` in `src/services/ai/index.ts:44-47` is the only
place that constructs/branches on providers — no screen imports either provider
directly (`grep` over `app/**`, `src/features/**`).

**Tool-calls-are-proposals.** Read `toolExecutor.ts` end-to-end: every create/update
path runs the real `validateTaskDraft` (`@/domain`, unmocked in its test) and applies
only via `useCreateTask`/`useUpdateTask`/`useDeleteTask`/`useLogState`; invalid →
`{applied:false}`. `toolExecutor.test.tsx` (6 cases) asserts drops never reach
mutations and a repo `err` is never a false success. No direct write path exists —
the only `@/db` import in the module is `conversationStore.ts` (see note 14), which
touches only the assistant repository.

**S38 structural parity.** `paywall/index.tsx`: Card B is a full `Card` with eyebrow/
heading/description/bullets/full-width secondary `Button` + fine print; only Card A's
button carries `disabled={storeUnreachable}` (line 100); Card B has no disabled wiring
at all; banner copy names the BYO path staying live. Verbatim copy checked against
spec lines 3641–3726.

**Purchase/restore discipline.** `billing.test.ts` proves biometric-before-
`requestPurchase` by invocation order, biometric cancel → `CANCELLED` with
`requestPurchase` never called, store error → "Nothing was charged", restore with no
login. S39 renders calm inline banners for both failure classes, plan preserved.

**Copy.** `copy.ts` diffed against ALLSCREENS S31–S40/S44 sections: privacy
disclosure (S38 footer), BYO helper ("Stored only on this device — never sent
anywhere but your provider."), offline copy, refusal-adjacent copy all verbatim.

**Tests & scope.** `npx jest` over all M6 paths → **17 suites / 73 tests pass**;
`npx tsc --noEmit` → clean (exit 0). Scope: wave-2 commits `4227a07`/`e6db8ef`/
`420aa04` file lists contain nothing outside the M4/M6/M7 owned-path union plus
`docs/STATE.md` (orchestrator) and `__mocks__/expo-iap.js` (disclosed); no
`app/settings/*` file other than `subscription.tsx`(+test) is referenced by M6 code;
all imports (`expo-audio`, `expo-iap`, `expo-local-authentication`,
`expo-secure-store`, `date-fns`) are pre-declared in the frozen `package.json` — no
dependency added. The word "streak" appears nowhere in the module (grepped).
