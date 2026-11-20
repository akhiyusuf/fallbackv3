# 30. Settings, data screens, subscription (Sonnet edge pass, round 2, 2026-11-20)

Files added: `app/settings/edge.settings.test.tsx` (51), `src/services/billing/edge.billing.test.ts` (38),
plus two small extra files because their mocks cannot share a file with the above: `app/assistant/paywall/edge.paywall.test.tsx` (S39, S38, S44, S40; 40+)
and `app/edge.recovery.test.tsx` (6). All pass. The 22 neighbouring suites (settings, paywall, recovery, billing, data) pass: 309 tests.
No tsc errors in my files. With the round-1 versions of the 7 changed source files put back, 38 of the new tests fail, so they test the fixes.

The settings tests run the real query hooks over a REAL SQLite store (node:sqlite). A "cold start" is a new QueryClient with the in-memory
theme/sound/agent stores reset, so anything shown again came from the database or SecureStore.

## Tests
Theme (S43): Dark saved and shown after cold start; Light/Dark/Auto each round-trip; colour swatch; named theme; failed save undoes the mode and toasts; a save that THROWS is undone; failed accent save; a slow failing first tap does not undo a later successful one.
Notifications (S42): each of the 7 switches saved, shown after cold start, no other pref moves; master off keeps sub-switch values; digest time picker saved, shown, hidden when digest off, time kept; failed save leaves switch and toasts; throwing save; two switches pressed back to back both land; all-off line.
Sounds (home): off is written and shown after cold start; back on remembered.
Agent access: master switch and a permission written to SecureStore and cleared by erase; off disconnects agents; an unknown saved value falls back to the default.
Widgets (S46): fixed task saved and shown after cold start; failed save keeps the sheet open and toasts.
Cycle cadence (Achievements screen): weekly to monthly mid-cycle writes the short record `[start, yesterday]`, new cycle starts today, survives cold start; changing twice in one day adds no empty record; failed save toasts and keeps the old cadence.
Backup (S47): file is real JSON and the share sheet gets it; last-backup line; a share sheet that throws does not undo it; failed and throwing backup toast; double tap makes one backup.
Restore: good file (data, look and bridges refreshed); cut-off file; not-a-backup and empty file; missing file; newer-version file; older-version file (no retired_day); cancelled picker; picker that throws then "Try a different file"; restore that throws; double tap opens one picker; banner clears after a later good restore.
Erase: cancel touches nothing; confirm wipes tasks, settings, BYO key, saved choices, onboarding due again, splash with dismissAll; store usable straight after; failed erase shows banner, data intact, Retry works.
Recovery (S50): fails twice then works; store that throws; double tap opens once; reset then cancel; reset then confirm; reset that fails.
Billing (expo-iap mocked): success; store sheet closed (two code spellings); biometric cancel, biometric that throws; pending (resolved and thrown forms, and a record marked pending); pending approved later by the listener; network failure; unknown error; already owned (with and without an active record); store failing after purchase; double tap on Buy; guard released after a failure; right SKU. Restore: none, one, only an expired one, foreign SKU, expired plus live, store unreachable. Over time: expiry, refund (record gone or revocation date), BYO key kept when the subscription ends, offline open keeps the held entitlement (two forms), no end date, NaN end date, unknown product. Connection: init failure, init twice adds listeners once, failing finishTransaction, products filtering, store failure. Receipt: never logged on any failure path; JWS preferred.
Paywall screens: S39 pending line, network retry, double tap, plan kept on retry; S38 restore none/one/offline/double tap/store unreachable; S44 active, expired or refunded reads Free plan, unknown renewal shows a dash, offline retry, three restore outcomes.
S40: 8 http:// addresses refused before anything is sent (including `localhost.evil.com`, `user@evil.com`, `10.0.0.1.evil.com`, 172.32, 192.169); 7 local ones accepted (localhost, 127.0.0.1, 192.168, 10., 172.16, [::1], .local); https and trimming; 5 non-addresses show the calm line with nothing sent; fixing a refused address; the refusal text has no em dash and no key; key is masked and never rendered as text; double tap on Save probes once.

## Bugs fixed
1. **S40 accepted http:// (key in clear text)**. `app/assistant/paywall/byo.tsx` (`isSafeBaseUrl`, `isLocalHost`, status `insecure`). http:// is now refused before the probe unless the host is this phone or the home network (loopback, 10/8, 172.16/12, 192.168/16, .local); an address with no http(s) scheme gets the calm invalid line without a probe. Line: "This address starts with http://, which would send your key without protection. Use an https:// address. ..."
2. **A store purchase that is pending (ask to buy) was reported as success** and sent the person to the assistant with nothing active (`src/services/billing/index.ts` `runPurchase`; `app/assistant/paywall/plan.tsx`). Now an `ENTITLEMENT_REQUIRED` result with `cause: 'pending'` and S39 shows a calm waiting line; the purchase listener now refreshes the entitlement after finishing a transaction, so an approval that lands later turns Fallback AI on by itself.
3. **Expired, refunded or pending records were treated as active** (`isActivePurchase`). A cached or offline answer could keep a lapsed plan on; now an end date in the past, a revocation date or a pending state is not active.
4. **After expiry or refund the receipt stayed in memory** and was still forwarded to the managed backend (`latestReceipt = null` when nothing is active).
5. **Losing a subscription overwrote `source: 'byo-key'` with `'none'`** (refreshEntitlement). Kept as byo-key when `hasByoKey`.
6. **Double tap on Buy**: nothing stopped two biometric prompts and two store requests. In-flight guard in billing (second caller joins the first) and a ref guard in S39.
7. Biometric prompt that throws was an unhandled exception from `purchase()`; now a calm biometric CANCELLED. Network error from the store maps to `NETWORK_UNAVAILABLE`; "already owned" turns the plan on instead of failing.
8. **Restore never told the notification and widget bridges** (`app/settings/data/index.tsx`): reminders stayed built from the old tasks and the widget snapshot stale until the next launch. Now emits `store:ready` after a good restore.
9. S47: a throwing `backup()`/`restore()` was an unhandled rejection; double tap on Back up or Restore ran twice (two backups, two share sheets, two pickers). Guarded.
10. S43/S42/S46: a save that throws (rather than returns an error) skipped the undo and the toast. Theme now also undoes only if the screen still shows that choice, so a slow failure cannot undo a later successful tap.
11. Erase left `hasByoKey` true in the in-memory entitlement store until the assistant next loaded (`src/features/data/EraseDataSheet.tsx`). Now cleared (a store subscription stays: it is the store's).
12. S50 recovery: a store that throws was an unhandled rejection with the button stuck busy; double tap on Try again opened the store twice. Guarded.

## Existing tests touched (not weakened)
- `src/services/billing/__tests__/billing.test.ts`: the renewal-date fixture was 2026-08-20, which is now in the past, so it correctly counts as expired. Moved to 2099-08-20; the assertion is the same.
- `app/settings/data/index.test.tsx`: its `@/app-shell` mock lacked `useEntitlementStore`, which the erase sheet now uses; one line added to the mock.
- Note: that file's Share mock (`{ share }` with no `default`) makes `Share.share` undefined in the screen, so its error is swallowed by the "sharing is optional" catch. My file mocks it as `default`, which is what really exercises the call.

## Checked, no bug
Every settings value (theme, accent, 7 notification switches, digest time, widgets, cadence) is stored in SQLite and read back after a fresh launch; sounds and agent access use SecureStore and are cleared by erase. Restore of damaged, foreign, newer-schema and older-schema files leaves current data untouched. Erase wipes data, key, sounds, agent choices; the store is usable straight afterwards; onboarding is due again. The BYO key is never rendered as text, success or failure.

## Left for the main session (not fixed)
- **The entitlement is held only in memory.** A subscriber who cold-starts offline sees "Free plan" and the paywall until the store answers (`refreshEntitlement` fails and nothing is cached). Fixing needs a persisted, non-secret cache (plan, renews-on, last-checked) with an expiry; a design call, and it touches the app shell.
- A BYO config saved BEFORE this fix with an http:// URL still works and still sends the key in clear text; `src/services/ai/byoProvider.ts` and `secureKeyStore.ts` (not mine) should refuse or warn on a stored http:// non-local URL.
- `src/features/assistant/useEntitlementAndMic.ts` keeps `source: 'byo-key'` after the key is gone (`byo ? 'byo-key' : current.source`); harmless to gating (it uses `hasByoKey`) but stale.
- S39/S40 navigate on a 600 ms `setTimeout` that is not cleared on unmount, so backing out within that time still lands on the chat. Minor.
- Cycle cadence is changed from the Achievements screen, not Settings (outside my files); I tested it from there.
- Agent access is a design preview: connected agents are not saved by design.
- A failed restore leaves the picker's file in place; nothing to clean up.

## Needs a real phone
The real Play Billing and StoreKit sheets (ask to buy, pending states, refunds, grace period), `getAvailablePurchases` behaviour offline and across expiry on each platform (the active-only default differs), the biometric prompt, the system share sheet and document picker, SecureStore on a locked device, Android cleartext policy for http:// local servers (may block it regardless), notification rescheduling after a restore.
