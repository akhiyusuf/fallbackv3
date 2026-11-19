# 08 — Settings that are not remembered

Area: `app/settings/**`, `src/features/settings/**`, `src/app-shell/stores/**`, `src/services/sfx/**`,
`src/services/ai/secureKeyStore.ts`, `src/features/agents/**`, and their tests.

Method: every control a person can change was traced (write path, where it is stored, what reads it back on a
cold start, whether the screen shows the saved value). Restart tests simulate a cold start: zustand stores
are put back to their start-up values, the screen is unmounted, and the saved values are read again.

## 1. Summary

| Check | Result |
|---|---|
| Area Jest (`app/settings`, `src/features/settings`, `src/features/agents`, `src/services/sfx`, `src/services/ai`, `src/app-shell`, `src/ui`) | 32 suites, **206 of 206 tests pass** |
| New restart tests | 7 in `app/settings/remembered.test.tsx`, 5 in `src/features/agents/store.test.ts`, 2 in `app/settings/index.test.tsx` |
| Whole suite (`npx jest --forceExit`), run 1 | 1 suite failed: `app/coldStart.test.tsx` (not my area; passes alone and with my suites) |
| Whole suite, run 2 | 1 suite failed: `src/queries/settingsCache.test.tsx` (not my area; passes alone, 5 of 5) |
| `npx tsc --noEmit` | My area: no errors. Repo-wide: 16 errors, all outside my area (see section 8) |
| `npx eslint <my paths> --quiet` | 3 errors, the same three `react-hooks/set-state-in-effect` errors as before (`app/settings/subscription.tsx` lines 42 and 46, and `app/settings/data/index.tsx` line 35). No new errors |

Bugs found in my area and fixed: 4. Items left for other areas: 6 (section 7).

## 2. The table

"Remembered" means the value is still shown after a cold start. "Fixed" means a change was made in this pass.

| Setting | Screen | Written by | Stored in | Read back by (cold start) | Remembered? | Fixed? |
|---|---|---|---|---|---|---|
| Appearance: Auto / Light / Dark | S43 `app/settings/theme.tsx` | `handleModeChange` → `setMode` (zustand) + `useUpdateSettings({theme})` | SQLite `settings.theme` (+ zustand) | `app/splash.tsx:54` `hydrate()`; S43 now also hydrates from the settings query | Yes | Hardened (see B4) |
| Named theme (Forge, Indigo, Berry, Plum, Lagoon, Mono) | S43 | `handleAccentChange` → `setAccent` + `useUpdateSettings({accent})` | SQLite `settings.accent` / `accent_ext` | splash `hydrate()`; S43 hydrate | Yes | Hardened (B4) |
| Own colour ("More colours", `hue-N`) | S43 | same | SQLite `accent_ext` | splash `hydrate()`; repo reads `accent_ext ?? accent` | Yes | Hardened (B4) |
| Sounds on/off | S41 `app/settings/index.tsx` Switch | `useSoundStore.setOn` (`src/services/sfx/index.ts`) | SecureStore `fallback.sounds` ('on'/'off') | module-load `getItemAsync` in `src/services/sfx/index.ts` | Yes | No change (tests already cover start-up read) |
| Allow notifications (master) | S42 `app/settings/notifications.tsx` | `patchPrefs` → `useUpdateSettings({notifications})` | SQLite `notif_master` | `useSettings()` | Yes | Race fixed (B2) |
| Routine due, Event starting, Course dose, Course ending soon | S42 | same | SQLite `notif_*` | `useSettings()` | Yes | Race fixed (B2) |
| Gentle re-entry, Milestone reached | S42 | same | SQLite `notif_*` | `useSettings()` | Yes | Race fixed (B2) |
| Daily digest on/off | S42 | same | SQLite `notif_daily_digest` | `useSettings()` | Yes | Race fixed (B2) |
| Digest time | S42 `Select` | same, `dailyDigestTime` | SQLite `notif_digest_time` | `useSettings()` | Yes | Race fixed (B2) |
| Account and sync (on/off) | S45 `app/settings/sync.tsx` | `handleToggle` → `useUpdateSettings({sync})`, then `push()` | SQLite `sync_enabled`, `sync_last_synced_at`, `sync_last_error` | `useSettings()` | Yes | No change (see section 7, item 9) |
| Widget 1–3: shows (count / next due / fixed task) | S46 `app/settings/widgets.tsx` (sheet) | `handleSave` → `useUpdateSettings({widgets})` | SQLite `widget_config` (DELETE + INSERT in one transaction) | `useSettings().widgets` | Yes | No change (tested) |
| AI agent access on/off | S41 row + S-agents `app/settings/agents.tsx` | `useAgentAccessStore.setEnabled` | **was memory only** → now SecureStore `fallback.agentAccess` | Module load in `src/features/agents/store.ts` | **Was no → now yes** | Fixed (B1) |
| AI agent permissions (5 scopes) | S-agents | `setPermission` | **was memory only** → now SecureStore `fallback.agentAccess` | same | **Was no → now yes** | Fixed (B1) |
| Connected agents (preview list) | S-agents | `connectExample`, `disconnect` | memory only | — | No (by design: nothing really connects) | Left as is (section 7, item 8) |
| Fallback AI subscription row (Active / Free plan) | S41 row | `billing.refreshEntitlement()` (store and receipt) | memory only (`useEntitlementStore`), derived from the store on each load | Was: nothing on S41. Now: S41 calls `billing.refreshEntitlement()` on open | **Was no (after cold start, "Free plan" until S44 or the assistant opened) → now yes** | Fixed (B3) |
| Subscription plan selected on S44 (Annual / Monthly) | S44 `app/settings/subscription.tsx` | `setSelectedPlan` (local state) | not stored; it only chooses which plan the paywall opens | — | Not a saved setting; defaults to Annual then follows the active plan | No change (by design) |
| BYO AI key, base URL, model, supports-transcription | `app/assistant/paywall/byo.tsx` (outside area) | `setByoConfig` | SecureStore `byo.*` | `hasByoConfig` / `getByoConfig` | Yes | No change |
| Assistant voice | S36 `OptionsSheet` (`src/features/assistant`, outside area) | `useVoiceLanguagePrefs().save` → `useUpdateSettings({assistant})` | SQLite `assistant_voice` | `useSettings().assistant` | Yes | No change (section 7) |
| Assistant language | S36 (shown as a fixed value; no picker) | — | SQLite `assistant_language` (default `en-US`) | `useSettings().assistant` | Yes (no way to change it yet) | n/a |
| Cycle cadence (weekly / monthly) | Achievements `app/achievements/index.tsx:124` (outside area) | `updateSettings.mutate({cycleCadence})` | SQLite `cycle_cadence` | `useSettings()` | Yes | No change (section 7, item 2) |
| Last backup time | S47 `app/settings/data/index.tsx` (read only) | `store.backup()` in `src/db/lifecycle.ts` | SQLite `last_backup_at` | `useSettings().lastBackupAt` | Yes (but see section 7, item 3) | No change |
| Look restored after a backup restore | S47 restore | `restoreBackup` then `hydrate()` | SQLite | `qc.getQueryData(settings)` | Yes | No change |

## 3. Bugs

### Fixed

**B1. AI agent access (switch and five permissions) forgot everything on a cold start.**
- File: `src/features/agents/store.ts` (the store had no persistence at all; the screen is `app/settings/agents.tsx`).
- What a person sees: they turn "Let AI agents connect" on, set "Add and edit tasks" to Allow, close the app, open it again. The Settings home row says "AI agent access: Off", the switch is off, and every permission is back at its default.
- Cause: the store was in-memory only, by design, with a comment saying no schema is implied.
- Fix: the on/off switch and the five permission choices are saved as one JSON value in SecureStore under `fallback.agentAccess` on every change. They are read once at start-up. A saved value the screen does not offer for that scope (for example "Allow" for Delete) is ignored and the default is kept. A damaged value keeps the defaults. A failed write keeps the choice for the current run only. Connected agents are still not saved.
- Decision for the human: this is a preview screen. If the preview should not remember anything, the alternative is to hide the Settings row and the switch until the feature is built (see section 7, item 8).

**B2. Notification toggles could undo each other.**
- File: `app/settings/notifications.tsx` (`patchPrefs`, around line 48).
- What a person sees: turn off "Routine due", then quickly turn off "Event starting". "Routine due" switches back on after the screen refreshes. Also seen with any two quick toggles.
- Cause: each change sent the whole `notifications` object, built from the snapshot on screen. Until the query refetched, the second change sent a copy that still had the first switch on, and the repository saved that copy.
- Fix: send only the key that changed. `settingsRepository.patch` already merges nested notification fields into the saved row, so the other fields are kept. The line is `updateSettings.mutateAsync({ notifications: patch as NotificationPrefs })`.
- Verified: the new test "two quick toggles both stick" fails on the old code (`Expected: false, Received: true`) and passes with the fix.
- Note for the database agent: the repository's read of the current row (`src/db/repositories/settingsRepository.ts`, `patch`) is now inside the transaction. Keep it there. With the partial patch, two saves that overlap cannot drop each other's fields.

**B3. The Settings home showed "Free plan" to a paying subscriber after every cold start.**
- File: `app/settings/index.tsx` (the start-up `useEffect`, and the import of `billing`).
- What a person sees: they open Settings after a restart. The row "Fallback AI subscription" says "Free plan" until they open the Subscription screen or the assistant, which is when the store is refreshed.
- Cause: the entitlement is only in memory (`useEntitlementStore`), and only `billing.refreshEntitlement()` fills it. Nothing ran it on the Settings home.
- Fix: the Settings home calls `billing.refreshEntitlement()` once on open. That is the same call the Subscription screen makes.
- Tests: `app/settings/index.test.tsx`: "on open, loads the saved subscription" (the row shows Active after the refresh) and "on open, with no saved subscription, the row says Free plan".

**B4. The Theme screen could show a default instead of the saved look.**
- File: `app/settings/theme.tsx` (new effect after the `previewReopened` state).
- What a person sees: normally nothing, because the splash screen restores the saved look before any screen opens. But if the Theme screen is the first screen opened (for example by a link), it showed Auto and Forge even though the saved values were Dark and Amber.
- Cause: the screen read the in-memory store only, and only the splash screen filled it.
- Fix: the screen restores the saved theme and accent from the settings query whenever they load. The store is the same store the rest of the app reads.
- Tests: "the saved look (dark, amber) is restored when the screen is the first one opened" and "a theme picked before a restart is still picked after it".

### Found, not fixed

None in my area that needs a code change now. Items that belong to other areas are in section 7.

## 4. Files changed

- `src/features/agents/store.ts`: SecureStore persistence of the switch and permissions (`fallback.agentAccess`); a restart-safe read at start-up; a failed write is ignored. (B1)
- `app/settings/notifications.tsx`: `patchPrefs` sends only the changed key. (B2)
- `app/settings/index.tsx`: imports `billing` and calls `billing.refreshEntitlement()` on open. (B3)
- `app/settings/theme.tsx`: imports `useEffect`; restores the saved theme and accent from the settings query. (B4)
- `app/settings/notifications.test.tsx`: the one assertion that expected the whole notification object now expects the changed key only (same test, same behaviour).
- `app/settings/index.test.tsx`: mocks `@/services/billing`; adds two tests for B3; imports `waitFor`.
- `src/features/agents/store.test.ts`: mocks `expo-secure-store`; adds five restart tests for B1.

No styles, colours, layout or wording changed.

## 5. Tests added

`app/settings/remembered.test.tsx` (new, 7 tests). A fake saved-settings store merges partial updates the way the repository does, and each "restart" unmounts the screen and resets the stores.
- Notifications: "turning on Allow notifications is shown as on after a restart"
- Notifications: "two quick toggles both stick, even though the screen has not refetched between them" (fails on the old code)
- Notifications: "the digest time saved before a restart is shown again"
- Account and sync: "sync that was turned on is shown as on after a restart"
- Theme: "the saved look (dark, amber) is restored when the screen is the first one opened"
- Theme: "a theme picked before a restart is still picked after it"
- Widgets: "a widget set to a fixed task shows that task after a restart"

`src/features/agents/store.test.ts` (5 new): the switch and permissions are read back after a restart (through a fresh module load with SecureStore holding the saved value); nothing saved gives the defaults; a value the screen does not offer for that scope is ignored; damaged JSON gives the defaults without throwing; a failed write keeps the choice and throws nothing.

`app/settings/index.test.tsx` (2 new): the subscription row shows Active after the refresh on open; with no subscription it shows Free plan.

Sounds were already covered: `src/services/sfx/index.test.ts` has "reads the saved choice once at start-up", "a saved on or no saved choice leaves sounds on", and "setOn writes the choice to SecureStore".

## 6. Shared files touched

None.

## 7. Fixes needed outside my area (exact instructions)

1. **`src/db/lifecycle.ts`, `eraseAll` (the list `SECURE_STORE_KEYS`).** Add `'fallback.agentAccess'`, so "Erase everything" also clears the AI agent access choices. Without it, the switch can stay on after an erase. Decide whether `'fallback.sounds'` should also be cleared (it is a device preference, so keeping it is reasonable).
2. **`app/achievements/index.tsx`, line 124 (cycle cadence Radio).** `onChange={(v) => updateSettings.mutate({ cycleCadence: v })}` ignores `{ ok: false }`. The Radio is controlled by the query, so a failed save snaps back with no message. Fix: `async (v) => { const r = await updateSettings.mutateAsync({ cycleCadence: v as CycleCadence }); if (!r.ok) showToast('Could not save that. Try again.', 'warning'); }`, using the screen's existing toast helper and an existing failure string if one is there.
3. **`src/db/lifecycle.ts`, `backup()`.** `last_backup_at` is written after the envelope is built, so the file carries the previous backup's time. After a restore of that file, "Last backup" shows the older time. Fix: write `last_backup_at` before `buildBackupEnvelope`, or set `envelope.lastBackupAt` to the same instant.
4. **`src/db/repositories/settingsRepository.ts`, `patch`.** Already fixed by the database agent (the read is now inside the transaction). Keep it that way; B2 depends on it.
5. **`src/features/assistant/OptionsSheet.tsx` (lines ~31–36).** `pending` is never cleared after a successful save. Harmless today, because the saved value and the pending value are the same. Mention only.
6. **Cold start through a notification tap.** `src/services/notifications/index.ts:275` calls `router.push(...)` when a notification is tapped. If that happens on a cold start, the route can run before the splash screen has opened the store. The layout agent should check that a cold start from a tap opens the store first (the settings screens will otherwise read an unopened database).
7. **Full-suite flakiness (not my area).** Run 1 failed `app/coldStart.test.tsx`; run 2 failed three tests in `src/queries/settingsCache.test.tsx` ("Cannot read properties of null (reading 'update')", where `renderHook`'s result is null). Both pass when run alone, and the cold-start test passes with my suites. Likely timing under parallel load. The database and queries agent should check.
8. **AI agent preview decision (human).** The Settings row and the switch now remember their state, but "Connect an agent" still shows a fixed code, and "Done" connects no one. Decide whether the preview should exist in the Settings home at all.
9. **Sync switch (my area, not changed).** `app/settings/sync.tsx` `handleToggle` returns silently when the save fails. The switch does not flip and no message is shown. Fixing this needs a warning string, and I did not add new wording. Decide the copy.
10. **BYO key users see "Free plan" (human decision).** `app/settings/index.tsx` shows "Free plan" unless the store status is active or trial. A BYO-key user (`entitlement.source === 'byo-key'`) is shown the free plan. This was true before and is not a restart-only problem. Decide whether the row should say something else for BYO users.

## 8. Repo-wide type and lint errors (not my area)

`npx tsc --noEmit` reports 16 errors, none in my area. They are in `src/db/__tests__/*` and `src/db/testSupport/expoSqliteTestDouble.ts` (no Node type definitions: `fs`, `os`, `path`) and in `src/features/onboarding/OnboardingShell.test.tsx` (the `BackHandler` listener signature).

## 9. What only a real phone can confirm

- That the SecureStore values for sounds (`fallback.sounds`) and agent access (`fallback.agentAccess`) survive killing the app on Android (the keystore is only exercised in tests with a mock).
- That the saved look appears on the first frame after a cold start, without a flash of the default (the splash screen restores it before the first real screen).
- That a subscriber sees "Active" on Settings home shortly after opening it (the check goes through the device's store purchase list, which is only exercised by a mock here).
- That the Sounds switch is silent when turned off and that sounds start at the saved state on a cold start (the start-up read is asynchronous; a sound played in the first few milliseconds could still play).
- That a notification tap on a cold start opens the right screen with the store open (section 7, item 6).
- That the digest time and widget choices show correctly at the phone's text size (not checked here).
