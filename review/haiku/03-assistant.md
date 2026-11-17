# 03 — Assistant area report

Area: `app/assistant/**`, `src/features/assistant/**`, plus `src/services/ai/secureKeyStore.ts` (read as shared code; one security fix, see section 4).

## 1. Summary

**Security first.** The BYO (own) AI key was stored in the iOS keychain with the default accessibility, which lets it migrate to a new phone through an encrypted device backup. It is now pinned to "this device only". Details in section 4, item A. The human should know this changes behaviour: after restoring to a new phone the user must re-enter their own key.

| Check | Before | After |
|---|---|---|
| `npx jest app/assistant src/features/assistant --maxWorkers=2` | 6 of 11 suites failing; 13 of 50 tests failing | **11 of 11 suites, 61 of 61 tests pass** |
| `src/services/ai/__tests__/secureKeyStore.test.ts` (touched, shared) | pass | pass |
| `npx eslint app/assistant src/features/assistant --quiet` | 5 errors | **3 errors** (all `react-hooks/set-state-in-effect`, left on purpose, see section 8) |
| `npx tsc --noEmit` | not checked for my area | my area is clean. Errors remain in `src/services/sfx/index.test.ts` (lines 29, 43, 98, 103, 110, 122), which is another area's file. |

Lint errors fixed: 2 `react-hooks/refs` in `useAssistantChat.ts` (the conversation id was read from a ref during render).

Assistant-area tests that were failing before, all now passing: 13 of 13 (see section 3).

## 2. Every file I changed

App code:
- `src/services/ai/secureKeyStore.ts` — `setByoConfig` now writes all four keychain items with `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` so the BYO key cannot migrate through a device backup. (Security, shared file.)
- `src/features/assistant/useAssistantChat.ts` — conversation id is now `useState` (fixed for the life of the hook) instead of a ref read during render (lint, no behaviour change). `retryLast` re-runs the model over the existing transcript instead of appending the user's text again. A successfully applied `create_task` whose task card cannot be built now gets its calm confirmation line instead of silence.
- `app/assistant/paywall/index.tsx` — "Restore purchases" shows the "Couldn't reach the store" warning when the store fails, instead of "No active subscription found." Imports `S44_COPY.errorStore`.
- `app/assistant/paywall/byo.tsx` — a failed secure-store write sets the existing calm error state instead of leaving the button on "Connecting…" forever.
- `app/assistant/history/index.tsx` and `app/assistant/history/[id].tsx` — modality label is "Voice + text" (spec copy, ALLSCREENS_1.md S34 and S35), was "Voice and text". See section 4, item F.

Test files:
- `src/services/ai/__tests__/secureKeyStore.test.ts` — mock now defines `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; the write assertion checks the options argument.
- `app/assistant/chat.test.tsx` — CR-6 test no longer expects the removed accordion; uses the voice tabs by role and selected state. New offline retry test.
- `app/assistant/history/index.test.tsx` — meta-line assertion matches the one joined line; new row-tap test.
- `app/assistant/index.test.tsx` — chip labels without ", button"; new test for mic-without-permission routing.
- `app/assistant/mic-primer.test.tsx` — labels match the app ("Allow microphone access", "Open system settings"); primer no longer expects the duplicated reassurance line; new "Type instead" test.
- `app/assistant/paywall/byo.test.tsx` — "Show API key" / "Hide API key"; new failed-write test.
- `app/assistant/paywall/index.test.tsx` — waits with `waitFor`; new tests for the trial and BYO buttons, restore success, restore with store error.
- `src/features/assistant/__tests__/OptionsSheet.test.tsx` — rewritten for the inline voice tabs (no accordion).
- `src/features/assistant/__tests__/useAssistantChat.test.tsx` — new tests: create confirmation line; retry without duplicate user bubble.

## 3. Failing tests I dealt with (13 at the start)

1. **S31 `default: headline, subcopy, mic caption and all five suggestion chips render`** — mock/test drift. Test looked for `Suggestion: <chip>, button`; the app's label is `Suggestion: <chip>`. Test updated.
2. **S32 `CR-6 — S36 renders the PERSISTED voice…`** — deliberate design change. The options sheet no longer has a "Voice and language" row to expand; the voice tabs are always inline. Test now reads the selected tab (`Calm`) and presses `Direct`.
3. **S34 `default: a populated list renders…`** — the row's date, modality and task count are one joined meta line (`Jul 27, 8:14 AM · Voice + text · 3 tasks`), not separate texts. Test now matches that line. The modality text was also a real wording bug (item F).
4. **S36 `default: six rows collapsed, accordion closed`** — deliberate design change (no accordion; language is a static value row "English (US)", voice tabs inline). Test asserts the current layout.
5. **S36 `tapping "Voice & language" expands…`** — same deliberate change. Test now asserts the three voice tabs are reachable inline.
6. **S36 `B2 — changing Voice fires onSaveVoiceLanguage…`** — same change. Test presses the tab directly.
7. **S36 `a FAILED save snaps the picker back…`** — same change. Test checks the selected tab returns to `Warm`.
8. **S37 `primer context: headline/body/actions…`** — deliberate change, recorded in `docs/DESIGN_DECISIONS.md` (review item 4): the primer no longer prints "Audio is processed only when you tap the mic." twice. Test now asserts the body, the secondary line and that the reassurance sentence is absent. Label assertion updated to "Allow microphone access" (decision D11: "Allow" / "Not now").
9. **S37 `primer — tap Enable, granted…`** — label drift ("Enable" → "Allow", D11). Test updated.
10. **S37 `primer — tap Enable, denied…`** — same. Test updated.
11. **S37 `B11 — recovery: does NOT re-check…`** — label drift: app label is "Open system settings", no ", button". Test updated.
12. **S37 `B11 — recovery: rechecks permission on AppState…`** — it failed only because of an earlier label failure in the same render path; it passes with the label fix. Test unchanged.
13. **S40 `reveal/mask toggle…`** — label drift: app label is "Show API key" / "Hide API key". Test updated, and now checks both directions.

No test was skipped, deleted or weakened. The assertions that were replaced cover the same behaviour for the current screens.

## 4. Bugs found in app code

**A. (SECURITY, fixed) The BYO key could end up in a device backup.** `src/services/ai/secureKeyStore.ts`, `setByoConfig` (originally lines 49–55). `expo-secure-store` defaults to `WHEN_UNLOCKED` (checked in `node_modules/expo-secure-store/build/SecureStore.d.ts`). That accessibility lets keychain items migrate to a new device through an encrypted iCloud/iTunes backup, which breaks the rule that the key never ends up in a backup. How a person hits it: they back up their phone and restore on a new one; the key comes with it. Fix: pass `{ keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }` on all four writes. Side effect: the key must be re-entered on a restored phone. Test updated in `secureKeyStore.test.ts`.

**B. Restore purchases says "no subscription" when the store is down.** `app/assistant/paywall/index.tsx`, `handleRestore`. `billing.restore()` returns `err(STORE_UNAVAILABLE)` on failure (`src/services/billing/index.ts`, around line 162), but the screen treated every non-success as "nothing found". A person whose store is unreachable is told they have no subscription. Fixed: warning toast "Couldn't reach the store — try again." Test added.

**C. Retry after an offline error repeats the user's message.** `src/features/assistant/useAssistantChat.ts`, `retryLast`. The retry called `sendMessage` again, which appended a second user bubble and a second user turn in the model history. How a person hits it: send while offline, tap "Try again". Fixed: retry re-runs `streamAndApply()` over the transcript that already has the message, and clears `offline`. Test added.

**D. A successfully created task can produce no confirmation at all.** `src/features/assistant/useAssistantChat.ts` `handleToolCall`, with `src/features/assistant/toolExecutor.ts` (`create_task`, `task: created ?? undefined`). `created` is looked up in `tasksQuery.data`, which is the list from before the create, so the new task is never found. The result is no task card and no line in the transcript. Fixed in the hook: a `create_task` that applied without a card now appends its summary line ("Done — created …"). **Not fully fixed:** the task card itself is still missing. A proper fix needs a fresh task read after the mutation. Test added for the confirmation line.

**E. A failed BYO save left the button spinning forever.** `app/assistant/paywall/byo.tsx`, `handleSaveAndConnect`. `setByoConfig` was not in a try/catch, so a secure-store failure left the status on `validating`. Fixed: failure sets the existing calm error state, and Save is enabled again. Caveat: there is no separate copy for storage failures, so the banner says "Couldn't verify this endpoint…". Test added.

**F. Modality label contradicts the spec.** `app/assistant/history/index.tsx` and `[id].tsx`, `modalityLabel`. The code said "Voice and text", but the spec copy (ALLSCREENS_1.md, S34 and S35 sample rows) says "Voice + text", and so did the pre-rework code. Changed to "Voice + text". This is a wording change, reported as the brief requires.

**G. Lint: conversation id read during render.** `useAssistantChat.ts`, return value. Fixed by making the id a stable `useState` (no behaviour change).

**Bugs found but NOT fixed:**

- **H. Store-sheet cancel shows the Face ID message.** `app/assistant/paywall/plan.tsx` (`handleConfirm`, `result.error.code === 'CANCELLED'` → `biometricFailed`). `billing.purchase` returns `CANCELLED` both for a failed biometric check (`src/services/billing/index.ts`, line 82) and for the user cancelling the store sheet (line 156). So a person who cancels the store sheet reads "Face ID didn't recognize you — try again". Needs a distinct error code in the shared billing service, which I did not touch.
- **I. "Or just say which one" does nothing real.** `src/features/assistant/ClarificationModal.tsx`. The row toggles a caption to "Listening for your answer…" but no speech is captured. Voice capture is stubbed across the app (noted in `app/assistant/chat.tsx`), so the caption overpromises. Product decision: hide it or wire it.
- **J. Empty history rows.** `useAssistantChat.ts`, `streamAndApply`. `finalizeConversation` runs after every turn, including offline and tool-only turns, with an empty summary when there is no text. The history list can show conversations with a blank summary.
- **K. Provider exceptions are not handled in the hook.** `streamAndApply` only handles `error` events. If the provider throws instead, `sendMessage` rejects (unhandled from the screen's `void` call) and no offline banner appears. Unsure whether the providers can throw; they mostly yield `error` events.
- **L. Options sheet differs from spec S36.** `src/features/assistant/OptionsSheet.tsx` vs ALLSCREENS_1.md S36: the spec has an expandable "Voice & language" row with a Language select; the code has inline voice tabs and a static "English (US)" value. The sheet title is "Options" (`copy.ts`), where the spec and the old code say "Fallback AI options". I did not change the UI. Needs a human decision: is the rework's simpler sheet approved?
- **M. History dates differ from spec.** Spec S34 shows "Today, 8:14 AM" / "Yesterday, 6:40 PM"; the code always shows "Jul 27, 8:14 AM". Left as is; decision needed.
- **N. Unhandled promise in the mic primer.** `app/assistant/mic-primer.tsx`, `onPress: () => void Linking.openSettings()`. A rejection is unhandled. Minor.
- **O. Navigation timers without cleanup.** `app/assistant/paywall/byo.tsx` and `plan.tsx` schedule `router.replace` with `setTimeout(…, 600)` and never clear it on unmount. Minor.
- **P. Key sent over cleartext if the person types `http://`.** `src/services/ai/byoProbe.ts` and `byoProvider.ts` accept any base URL. The key then travels unencrypted. Unsure whether this should be blocked; a product/security decision.
- **Q. Android backup (unverified).** `app.config.ts` does not set `allowBackup`, and I did not verify the Android default. SecureStore values are encrypted with a Keystore key that does not restore, so they stay unreadable elsewhere, but the ciphertext may still appear in Google's backup. Check before shipping.

## 5. Tests added

- `app/assistant/chat.test.tsx`: "offline: Try again re-sends over the same transcript…" (offline → retry → reply lands, user line appears once). The existing offline-footer test is kept.
- `app/assistant/mic-primer.test.tsx`: recovery "Type instead" goes to the chat in text-input state.
- `app/assistant/index.test.tsx`: mic tapped while entitled but without OS permission goes to `/assistant/mic-primer?context=primer`, never the chat.
- `app/assistant/history/index.test.tsx`: tapping a conversation row opens `/assistant/history/c1` (S35).
- `app/assistant/paywall/index.test.tsx`: "Start free trial" → `/assistant/paywall/plan`; "Use your own AI key" → `/assistant/paywall/byo`; restore with an active subscription → chat; restore with the store unreachable → warning toast, not "no subscription".
- `app/assistant/paywall/byo.test.tsx`: Show/Hide API key toggles both ways; a failed secure write shows the error state and re-enables Save without navigating.
- `src/features/assistant/__tests__/useAssistantChat.test.tsx`: an applied `create_task` always leaves a confirmation line; retry after offline re-runs without repeating the user bubble.
- `src/services/ai/__tests__/secureKeyStore.test.ts`: the BYO write uses the this-device-only accessibility.

## 6. Shared files touched

- `src/services/ai/secureKeyStore.ts` — lines 49–63 (the `WRITE_OPTIONS` constant and `setByoConfig`). Why: security fix A.
- `src/services/ai/__tests__/secureKeyStore.test.ts` — the `expo-secure-store` mock (added the constant) and the write assertion (line ~30). Why: follows fix A.

Nothing in `src/ui`, `src/theme`, `src/queries`, `src/domain`, `src/db`, `src/navigation`, `src/app-shell` or `__mocks__` was touched.

## 7. What I read and found fine

App screens: `app/assistant/chat.tsx`, `index.tsx`, `mic-primer.tsx`, `history/index.tsx`, `history/[id].tsx`, `paywall/index.tsx`, `paywall/plan.tsx`, `paywall/byo.tsx`, and all six test files in these folders.

Feature code: `src/features/assistant/copy.ts`, `useAssistantChat.ts`, `toolExecutor.ts`, `useEntitlementAndMic.ts`, `OptionsSheet.tsx`, `ClarificationModal.tsx`, `EditUndoBanner.tsx`, `SayItInsteadRow.tsx`, `TaskCreatedCard.tsx` (the start), `voiceLanguagePrefs.ts`, and the four test files in `__tests__`.

Shared, read only: `src/services/ai/secureKeyStore.ts`, `byoProbe.ts`, `index.ts`, `src/services/billing/index.ts` (purchase, restore), `src/ui/Tabs.tsx`, `src/ui/Radio.tsx`, `src/ui/ButtonPair.tsx`, `src/navigation` (ROUTES), `src/app-shell` (entitlement store API), `design-input/fallback-handoff/uploads/ALLSCREENS_1.md` (S31–S40, S44), `docs/DESIGN_DECISIONS.md` (D3, D7, D11, review items), `git show 047f32d~1` for the pre-rework versions of the history, primer and options files.

Found fine (no change needed): the voice-language persistence path (`voiceLanguagePrefs.ts`), the clarification and undo banners, the BYO key never being logged (`byoProvider.ts` only puts it in the Authorization header), and the paywall's store-unreachable asymmetry (BYO stays enabled).

## 8. Not done / unsure

- **Lint, 3 left (all `react-hooks/set-state-in-effect`).** `src/features/assistant/useEntitlementAndMic.ts:46`, `app/assistant/history/[id].tsx:40`, `app/assistant/paywall/index.tsx:32`. Each calls a `load`/`checkStore` function that sets state synchronously. The fix means restructuring the loading state, which is not "obviously safe" under the brief, so I left them.
- **`npx tsc --noEmit` is not clean** because of `src/services/sfx/index.test.ts` (another area). My area type-checks.
- **Task card after create (item D)** is still missing; only the confirmation line was fixed.
- **Decisions needed from a human:** H (cancel message), I (fake voice caption), L (options sheet vs spec), M (date wording), P (cleartext base URL), and whether the BYO-key re-entry after restore (fix A) is acceptable.
- **Unverified:** Android backup behaviour (Q). The keychain change in fix A is verified against the installed `expo-secure-store` typings, not on a device.
