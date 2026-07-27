# Review — M7 (pass 1)
VERDICT: CHANGES_REQUIRED

Scope: `src/features/onboarding/**`, `src/features/settings/**`,
`src/services/notifications/**`, `src/services/widgets/**`, `native/**`, `plugins/**`,
`app/onboarding/**`, `app/settings/{index,notifications,theme,widgets,help}.tsx`
(S02–S08, S41–S43, S46, S49), reviewed against PRD F8/F9/F14/F21/§3.7, ARCHITECTURE,
API.md §8, SCHEMA §4.2's standing principle, MODULES.md M7, and ALLSCREENS_1.md.

The screen work is largely faithful and well-tested — the resume-after-kill test and the
S43 accent-invariance test are both genuine (verified below, item by item). The blocking
findings cluster in the **services layer**: the two bridges are built but wired to
nothing, erase-all's cleanup contract is unconsumed, and both services do bare date-keyed
`day_log` resolution in snooze-adjacent logic.

## Blocking items

1. **`initNotificationsBridge()` / `initWidgetsBridge()` are never called — by anything.
   F14 and F21 are inert at runtime.**
   `src/services/notifications/index.ts:184` and `src/services/widgets/index.ts:94` have
   **zero** call sites outside their own doc comments (grep across all of `app/` and
   `src/`, test files excluded). The comment at `notifications/index.ts:171-183` frames
   this as only a boot-time gap for "a user who never visits an M7-owned screen" and
   claims the function is "safe to call from every M7-owned screen's mount effect" — but
   **no M7 screen calls it either**. Consequences in the shipped app: S07's Allow grants
   permission but nothing ever arms a reminder; S42's toggles emit `settings:changed`
   into a bus with no subscriber; S46 saves widget configs no snapshot is ever published
   for. The disclosed gap is real but understated — the M7-side mitigation the code
   itself describes was never implemented.
   **Fix (two halves):** (a) within M7 ownership, call both init functions from M7
   surfaces that mount in the relevant flows (they are idempotent by design) — at
   minimum S06/S07 and the S41/S42/S46 screens — and additionally trigger
   `notifications.reschedule()` directly after a successful
   `notifications.requestPermission()` in `NotificationsPrimerScreen.tsx:24-31` (a
   permission grant emits no bus event, so nothing else re-arms in that session).
   (b) The true boot-time call belongs in `app/_layout.tsx`, which is **M0-owned and
   frozen** (MODULES.md "Architect-frozen" + M0's owned paths) — that half is a
   legitimate cross-module contract: M7 must formally raise it as an architect change
   request in its result (orchestrator: route to the architect/M0, one
   `useEffect(() => initNotificationsBridge() && initWidgetsBridge(), [])`-shaped hook in
   the shell). Acceptance: a test proving `task:changed` after an M7 screen mounts causes
   a reschedule/publish, plus the CR raised explicitly.

2. **`store:erased` (and `store:ready`) are never consumed — erased habit data survives
   on the widget and in armed notifications, and the onboarding resume pointer survives
   erase-all.** Privacy-relevant (PRD F25: "no residual habit data recoverable
   on-device").
   - `src/services/widgets/index.ts:98-103` subscribes to
     `task:changed`/`day:logged`/`offday:changed`/`settings:changed` only. M1 emits
     `store:erased` **specifically for M7's WidgetBridge** (`src/db/lifecycle.ts:158-165`
     names it; MODULES.md M1 non-negotiable: eraseAll "clears … widget snapshot files
     too"; a wave-1 shipping-class defect — "erase-all leaving pre-erase habits on the
     home-screen widget" — was fixed by pinning this event). Unconsumed, the snapshot
     JSON — which contains task names — persists in the shared container after erase.
   - `src/services/notifications/index.ts:188-194` — same omission: reminders for erased
     tasks stay armed and will fire by name after a full erase.
   - `src/features/onboarding/progress.ts:20` — the `fallback.onboarding.progress`
     SecureStore key is M7-owned and outside M1's erase sweep
     (`src/db/lifecycle.ts:25` clears only `byo.*`). After erase-all, onboarding
     re-shows (F9/F25) but S02's resume redirect
     (`useOnboardingResume.ts:26-49`) silently jumps the now-fresh user to the stale
     mid-tour pointer (e.g. straight to S06), skipping the pitch screens.
   **Fix:** both bridges subscribe to `store:erased` (widgets: delete or republish an
   empty snapshot; notifications: `cancelAll()`; onboarding pointer:
   `clearOnboardingProgress()`), and to `store:ready` for the initial publish/arm.
   Acceptance test: emit `store:erased` → snapshot file gone/empty, `cancelAll` called,
   progress key cleared.

3. **Bare date-keyed `day_log` resolution in snooze-adjacent logic — SCHEMA §4.2's
   standing principle ("presumptively a blocking defect") applies to both services.**
   Both call `resolveOccurrence` (good — that routes through `designateCarrier`) but
   **never look up `movedInLog`**, so the carrier decision runs on incomplete inputs and
   degenerates to date-keyed behaviour:
   - `src/services/widgets/index.ts:52-59` + `snapshot.ts:65` (`dueTasks` filtered by
     raw `isDue` only): (a) an occurrence **snoozed away** from today (own row,
     `movedToDate = tomorrow`) still lands in `dueTasks` — the widget keeps showing, and
     counting in `totalDue`, a task the user deliberately pushed forward, contradicting
     both the Today screen and F7's non-punitive intent; (b) an occurrence **snoozed
     into** today on a non-naturally-due date is absent from the snapshot entirely —
     the widget contradicts Today in the other direction. Violates F21 "reflect current
     on-device state."
   - `src/services/notifications/index.ts:124-145` (`scheduleGentleReentry`): a visiting
     occurrence that was missed at yesterday (non-natural date, one-hop snooze-in)
     resolves as carrier `none` and never triggers the invitation — silent
     under-notification. (The snoozed-**away** case is handled correctly: the vacated
     own row correctly yields `none`, so no punitive nudge fires — verified against
     `designateCarrier`, `src/domain/dayState.ts:133-143`.)
   **Fix, within existing contracts (do NOT re-implement clause selection):** under the
   one-hop contract, `inbound(D)` can only originate at `D − 1`, so read
   `repos.logs.listForDate(addDays(D, -1))`, select the row with `movedToDate === D`,
   and pass it as `movedInLog`; in the widget path, derive inclusion from the resolved
   carrier/outcome instead of raw `isDue`. That supplies `designateCarrier`'s inputs —
   it does not fork its logic. Acceptance tests: snapshot excludes a snoozed-away task's
   today occurrence and includes a snoozed-in one; re-entry fires for a missed
   snoozed-in occurrence. (Related, same fix or an explicit disposition:
   `schedule.ts:39` `buildRollingSchedule` is cadence-only, so a routine-due reminder
   still fires on a vacated date.)
   *If the architect's pending ruling on M7's direct `@/db` reads (disclosed gap #6)
   instead lands on exporting an imperative resolved-read from the query layer, both
   this item and that gap resolve together — either path is acceptable; the current
   half-resolution is not.*

4. **Widget theme: `auto` always resolves to light.**
   `src/services/widgets/index.ts:63` — `resolveScheme(settings.theme, null)`;
   `src/theme/index.ts:39` maps `auto` + null OS scheme → `'light'`. Theme defaults to
   `auto` (PRD F8), so the default user's widget renders the light palette while their
   phone is dark — violating F21 "honour theme" and S46's own footer copy ("always match
   your current theme and accent"). `Appearance.getColorScheme()` (react-native, no
   React context needed) is available in a non-React service — pass it as `osScheme`,
   and (cheap, optional) republish on `Appearance.addChangeListener`. Acceptance: unit
   test — theme `auto` + OS dark ⇒ snapshot `theme.scheme === 'dark'`.

5. **S06 drops the onboarding shell's progress dots and the "Step 5 of 5"
   announcement.** `src/features/onboarding/PersonalizeScreen.tsx:65-115` renders no
   dots and no step announcement. Spec (ALLSCREENS_1.md:199): "Onboarding shell from
   S02, progress dots only (5-dot progress — all 5 steps complete)"; Interactions
   (line 226): "Progress dots announced as 'Step 5 of 5.'" Only the Skip control is
   meant to be absent — the dots are not. Also, the "Preview" button (line 94) is
   rendered with `disabled`, which applies the kit's 0.5-opacity inert treatment
   (`src/ui/Button.tsx:41,103`) — the spec wants a normal accent-filled,
   non-interactive button so the accent effect is "immediately visible"; S43 already
   does this correctly with `pointerEvents="none"` (`app/settings/theme.tsx:134`).
   Fix: render the shell/dots with an all-complete state + the Step-5 announcement
   (extend `OnboardingShell` — M7 owns it), and make Preview non-interactive without
   disabled styling. Acceptance: S06 test asserting dots render and the preview button
   is not in the disabled state.

6. **S08 validation copy deviates from the spec.**
   `src/features/onboarding/copy.ts:96` — `'Add a fallback version to continue'`;
   ALLSCREENS_1.md:300 pins `"Add a fallback to continue"`. Verbatim copy is a
   definition-of-done item (MODULES.md #3). One-word fix; update any test that quotes it.

7. **S49: no real hand-offs, and wrong accessibility labels.**
   `app/settings/help.tsx:30` labels **all three** Support rows "opens email" — for
   "FAQ & guides" and "Rate Fallback" that is simply false; the spec pins per-destination
   announcements ("each row announces as a link/button with its destination type").
   Separately, every row's `onPress` only shows a toast. The "(mockup: Toast …)"
   parentheticals in the spec are explicitly the **static-HTML-mockup** stand-in
   (ALLSCREENS_1.md:4286: "since a static build can't verify a real external hand-off");
   the shipped Contents section says "hands off to the device's mail app / external help
   center / app-store rating prompt / external page." The concrete targets (support
   email, FAQ URL, legal URLs, store listing) are pinned nowhere upstream — that is a
   genuine product gap, and the failure discipline is to **raise it**, not silently ship
   mockup behaviour. Fix: correct the three a11y labels now (objective, no product input
   needed); implement `Linking.openURL` hand-offs where a target exists, and formally
   flag the missing addresses/URLs in the module result so the orchestrator can route
   them to the human. Acceptance: labels per destination; either a real hand-off attempt
   per row or an explicitly sanctioned interim behaviour recorded upstream.

## Non-blocking notes

- **Native/plugin verifiability (inherent limitation, not a defect):**
  `plugins/withFallbackWidgets.js` and `native/**` cannot be executed here — no
  macOS/Xcode or Android SDK toolchain exists in this environment, and the plugin's own
  header (lines 8–18) discloses exactly that. I inspected rather than ran: the Android
  half (file copies, `<receiver>` manifest entries keyed to `@xml/widget_info_*`,
  package `com.fallback.app.widgets`) is conventional and internally consistent with
  `native/android/widgets/**`; the iOS half (`addTarget('app_extension', …)`, explicit
  Sources phase, `CODE_SIGN_ENTITLEMENTS` → `FallbackWidgets.entitlements`, deployment
  target 16.0) matches the `xcode` library's documented behaviour; the App Group id
  (`group.com.fallback.app`) agrees across `app.config.ts:27`, the plugin, the
  entitlements file, and `Snapshot.swift`. The Swift/Kotlin readers consume the JSON
  snapshot only — no SQLite access — and carry no `missed` fill, per Rule 4. **Carry to
  Gate 3: this must get one real `expo prebuild` + device build before ship.**
- `reschedule()` (`notifications/index.ts:72-114`) is not serialized; overlapping runs
  (event burst + foreground) can interleave cancel/schedule and transiently drop
  reminders until the next re-arm. Best-effort surface, so not blocking — a simple
  in-flight promise chain would close it.
- `snapshot.ts:81` uses `Math.round` for the widget percent. Numerically identical to
  round-half-up for positive inputs, so no behavioural defect — but `@/lib/number`'s
  pinned `roundHalfUp` exists precisely so there is one rounding implementation; use it.
- S41 renders the design's literal "Maya"/"M" profile identity
  (`src/features/settings/copy.ts:8`, `app/settings/index.tsx:95-97`). This *is* the
  spec's verbatim copy, and no name feature exists in the PRD — flagging for the human
  at Gate 3 as a product question, not against M7.
- Both services read `repos` from `@/db` directly — disclosed as cross-module gap #6 and
  already awaiting an architect ruling; not re-litigated here (see blocking item 3's
  note for how the two interact).
- M7's reported "20 suites / 101 tests" includes `app/settings/{sync,data,subscription}`
  tests owned by M1/M6. The M7-owned reality is 16 suites / 79 tests — all passing.
  Record-keeping only.
- The `expo-notifications` "removed from Expo Go" warning in test output is benign
  (dev-build-only API surface, declared in the frozen config).

## Verified (what and how)

- **Ran the owned-path suites:** `npx jest app/onboarding app/settings/{index,notifications,theme,widgets,help}.test.tsx src/services/notifications src/services/widgets`
  → **16 suites / 79 tests, all green.** `npx tsc --noEmit` → clean (exit 0).
- **Resume-after-kill is real, not a render-once shortcut:** read
  `app/onboarding/hook.test.tsx` in full — the resume test seeds the persisted pointer
  *before* mount (faithfully simulating kill-and-relaunch), then asserts both the
  redirect (`router.replace('/onboarding/personalize')`) **and** that S02's content
  never painted (`queryByText(...)` null). Traced the mechanism end-to-end in source:
  every screen S03–S08 calls `useOnboardingStepMarker(ownRoute)` on mount
  (grep-verified, all six call sites); S02 alone reads the pointer back
  (`useOnboardingResumeRedirect`, `useOnboardingResume.ts:26-49`) with a
  no-flash-before-redirect guard; Skip (all five shell screens) and S08's save both
  persist `onboardingCompletedAt` (grep-verified, five call sites) and clear the
  pointer. SecureStore is mocked in the test (native module — acceptable; the logic
  under test is real). Read failures degrade to restarting at S02, never a trap.
- **S43 accent-invariance asserts BOTH sides:** read `app/settings/theme.test.tsx` in
  full. The harness reproduces the app shell's live `buildTheme` wiring (not a static
  theme). Positive side: after picking Indigo, the preview's collected
  `backgroundColor`/`stroke` values contain `ACCENTS.indigo.base` and **no longer**
  contain the old accent. Negative side: the done/fallback/skip chips' colours are
  byte-equal before/after a Plum pick **and** asserted not to contain `ACCENTS.plum.base`.
  Cross-checked against the frozen `src/ui/StateChip.tsx:48-56`: fills read
  `t.color.ideal/fallback/off`, never `t.accent.*` (skip deliberately reuses the `off`
  signal per the chip map's cited handoff source). The caption is correctly scoped to
  accent-invariance only — no theme-invariance claim.
- **Notification content:** read every user-facing string in `schedule.ts`,
  `notifications/index.ts`, `app/settings/notifications.tsx`, and the onboarding copy.
  **No** arbitrary-date/move/snooze language, no multi-hop implication, no
  streak-punitive framing anywhere; the re-entry copy is invitational; "streak" grep
  across all M7 paths: zero hits. The S07 sample notification copy matches the design
  verbatim, and the real routine-due body reuses it ("Too tired? The fallback still
  counts."). As-needed routines and to-dos are excluded by construction (via `isDue`)
  and covered by named tests (`schedule.test.ts:61,73`).
- **Boot wiring:** grep for both init functions across `app/` + `src/` — zero
  non-definition call sites; read `app/_layout.tsx` (M0-owned per MODULES.md) —
  no bridge import. Verified `AppEvent` actually carries every event name M7 subscribes
  to (`src/types/ports.ts:173-183`) and that `settings:changed`/`offday:changed` are
  genuinely emitted (`src/queries/mutations.ts:585,737`) — the wiring gap is the only
  break in the chain. Verified `store:erased` emission and its M7-directed intent
  (`src/db/lifecycle.ts:158-165`), and that `SECURE_STORE_KEYS` excludes M7's
  onboarding key.
- **Carrier discipline:** read `designateCarrier`/`resolveOccurrence`
  (`src/domain/dayState.ts:120-190`) and both service call sites; worked the four
  snooze shapes (away/into × natural/non-natural) through the carrier table by hand to
  establish exactly which degenerate (blocking item 3) and which stay correct.
- **Copy spot-check (S02, S05, S07, S08, S41–S43, S46, S49):** compared
  `src/features/onboarding/copy.ts` and `src/features/settings/copy.ts` line-by-line
  against ALLSCREENS_1.md's Copy blocks — verbatim except the one S08 deviation
  (blocking item 6). S05's sample composition (3+2+1 off+1 unfilled, 83%, three-swatch
  legend, missed never named) matches the spec exactly; the local `SampleBreakdownBar`
  is a disclosed, justified deviation from the frozen kit component (which
  unconditionally renders a fourth "Missed" legend entry the spec forbids here) and
  uses theme tokens only.
- **Design discipline:** raw-hex grep across all M7 non-test paths — zero hits (colors
  come from `useTheme()`/`ACCENTS`/`PALETTES`); no text on a signal fill (S43's chips
  are the frozen icon-only `StateChip` with captions beside); no `src/domain`/
  `src/queries` write-path usage beyond the contracted hooks; no dependency added
  (`expo-secure-store`, `expo-notifications`, `expo-file-system` all pre-declared);
  `app.config.ts`'s plugin reference untouched at its pinned path.
- **S42's two all-off renderings:** Trigger A (master off → sections replaced, master
  row still present/toggleable) and Trigger B (master on/all subs off → sections stay
  visible + banner) are genuinely distinct branches in code
  (`app/settings/notifications.tsx:72-73,91-145`) and each has its own named test.

## Response

All 7 blocking items fixed. Ran `npx jest app/onboarding app/settings/{index,notifications,theme,widgets,help}.test.tsx src/services/notifications src/services/widgets` → 16 suites / 99 tests, all green. `npx tsc --noEmit` → clean.

1. **Fixed (M7 half).** `initNotificationsBridge()`/`initWidgetsBridge()` now called from a mount effect on S06, S07, S41, S42, S46. `NotificationsPrimerScreen.handleAllow` now calls `notifications.reschedule()` directly when `requestPermission()` resolves granted. **The M0-owned boot-time half (`app/_layout.tsx`) is unchanged, as instructed — still needs to be raised to the architect/M0** so a session that never visits an M7 screen still arms on boot.
2. **Fixed.** Both bridges subscribe to `store:erased` (widgets: delete the snapshot file; notifications: `cancelAll()` + `clearOnboardingProgress()`) and `store:ready` (widgets: republish; notifications: `reschedule()`). Colocated the onboarding-pointer clear in the notifications bridge's `store:erased` handler rather than a third bridge, since both cleanups share the same trigger and that init already reaches every relevant mount point.
3. **Fixed.** Widget snapshot and gentle-reentry both now look up `movedInLog` (the prior day's row whose `movedToDate` equals the target date) and pass it into `resolveOccurrence`; widget inclusion is now driven by the resolved `outcome`, not raw `isDue`. `buildRollingSchedule` also takes an optional `vacatedDates` set (built by the caller from a real repo read) and skips routine/event/course-dose reminders on a date whose own row was snoozed away.
4. **Fixed.** `resolveScheme` is now called with `Appearance.getColorScheme()` (normalized to `'light' | 'dark' | null`), not a hardcoded `null`.
5. **Fixed.** `OnboardingShell` gained `allStepsComplete` (all 5 dots render accent-filled, announcement reads the literal "Step 5 of 5.") and `icon` is now optional; `PersonalizeScreen` now renders through the shell with `allStepsComplete`. The Preview button is wrapped in a `pointerEvents="none"` View instead of using `disabled`.
6. **Fixed.** `S08_COPY.fallbackError` is now `'Add a fallback to continue'`.
7. **Fixed (objective half).** Each Support row now gets its own `a11yDestination` string ("opens email" / "opens an external help center" / "opens the app store"). Implemented a real hand-off for "Rate Fallback" on Android via `Linking.openURL('market://details?id=com.fallback.app')` (the package name is already pinned in `app.config.ts`; no numeric App Store id exists for iOS, so iOS keeps the toast). **Contact support / FAQ & guides / Privacy policy / Terms of service / iOS Rate Fallback still have no real destination pinned anywhere upstream — this is a genuine product gap, not something resolved by this pass**, and remains flagged for the human.

# Review — M7 (pass 2)
VERDICT: CHANGES_REQUIRED

All 7 pass-1 blocking items were independently re-verified as genuinely fixed — the
carrier-resolution fix (item 3) is real, routes through the frozen `designateCarrier`, and
is not a shadow implementation. But scrutiny of that same rework surfaced ONE remaining
correctness defect in the exact function it touched: `scheduleGentleReentry` still feeds
`resolveOccurrence` incomplete inputs — `movedInLog` is now supplied, `notBefore` still
isn't — and the consequence is a spurious "Yesterday slipped by" notification to brand-new
users. One precise item; everything else is clean.

## Pass-1 items, re-verified one by one

1. **FIXED.** Both init functions called from mount effects on all five claimed surfaces:
   `src/features/onboarding/PersonalizeScreen.tsx:39-42` (S06),
   `src/features/onboarding/NotificationsPrimerScreen.tsx:24-27` (S07),
   `app/settings/index.tsx:76-77` (S41), `app/settings/notifications.tsx:42-43` (S42),
   `app/settings/widgets.tsx:41-42` (S46) — grep-confirmed, no other non-test call sites.
   `reschedule()` fires after a granted S07 request and ONLY then
   (`NotificationsPrimerScreen.tsx:40`; both the granted and declined paths have named
   tests in `app/onboarding/notifications-primer.test.tsx:60-78`). `app/_layout.tsx` was
   NOT touched — `git log --all -- app/_layout.tsx` shows no commit since wave 1, and
   `git diff efa5fc1 HEAD -- app/_layout.tsx src/domain src/queries src/db src/ui docs
   design-input` is empty across the whole rework span. The boot-time half remains an open
   architect CR, correctly re-flagged in the builder's response — not held against M7.
2. **FIXED, verified by running the tests, not just reading.** Widgets:
   `src/services/widgets/index.ts:140-141` subscribes `store:erased` → `clearSnapshot()`
   (file deleted) and `store:ready` → republish; notifications:
   `src/services/notifications/index.ts:227-231` subscribes `store:erased` →
   `cancelAll()` + `clearOnboardingProgress()`, `store:ready` → `reschedule()`. The tests
   emit the real events through the real bus (`src/services/widgets/index.test.ts:115-141`
   asserts the snapshot file is genuinely gone from the mock FS then genuinely recreated;
   `src/services/notifications/index.test.ts:188-214` asserts cancelAll + pointer clear,
   with the mount-time reschedule's own cancel correctly excluded at line 191). Ran them —
   green. Colocating the pointer clear in the notifications bridge is acceptable: same
   trigger, and that init reaches every mount point the pointer matters to.
3. **FIXED — traced by hand, not taken on faith.** (a) No shadow implementation: both
   services call `resolveOccurrence` (which delegates to the frozen `designateCarrier`,
   `src/domain/dayState.ts:175`); grep found no new ad-hoc date/clause comparison. The
   `movedInLog` selection (`priorLogs.filter(l => l.movedToDate === D)`,
   `widgets/index.ts:59`, `notifications/index.ts:146`) is byte-for-byte the same pattern
   as the canonical resolvers (`src/queries/internal.ts:81,98,132`) — a data feed, not a
   fork. `vacatedDates` (`schedule.ts:52-60`) likewise supplies one fact (`movedToDate !=
   null` on D's own row) rather than reimplementing clause selection. (b) The D-1 lookup
   is correct per the one-hop contract; `UNIQUE(task_id, date)` guarantees at most one
   candidate, so no tie-break is needed. (c) Both failure directions traced through
   `designateCarrier` by hand: snoozed-AWAY (own row `movedToDate=D+1`, no movedIn) →
   R-2 `none` (`dayState.ts:140`) → `not-due` → excluded from the widget
   (`snapshot.ts:72-76` filters on resolved `outcome`, not `isDue`); snoozed-IN (visitor
   from D-1, `log=null`, `natural=false`) → clause (c) visitor (`dayState.ts:138`) → real
   due outcome → included. (d) Re-entry for a missed snoozed-in occurrence: visitor at
   yesterday, no chip → `mapChipToOutcome('todo', yesterday, today)` → `missed`
   (`dayState.ts:50`) → invitation fires; snoozed-away yesterday still yields `none` → no
   punitive nudge. All four shapes have named tests (`widgets/index.test.ts:86-113`,
   `notifications/index.test.ts:216-251`) whose fixtures match my hand traces exactly.
   **However — see blocking item 1 below: the same resolver call still omits `notBefore`,
   the third input both canonical callers pass.**
4. **FIXED.** `widgets/index.ts:78-79` — `Appearance.getColorScheme()` normalized (the
   Android-only `'unspecified'` → `null`) and passed to `resolveScheme`. Test at
   `widgets/index.test.ts:76-84`: theme `auto` + OS dark ⇒ snapshot `theme.scheme ===
   'dark'`. Ran it — green.
5. **FIXED.** S06 renders through `OnboardingShell` (`PersonalizeScreen.tsx:77-84`) with
   `allStepsComplete`; the shell fills all 5 dots (`OnboardingShell.tsx:79`) and announces
   the literal "Step 5 of 5." (`OnboardingShell.tsx:55`) — matching ALLSCREENS_1.md S06
   ("all 5 steps complete", "Progress dots announced as 'Step 5 of 5.'"); no Skip, per
   spec. Preview is wrapped in `pointerEvents="none"` (`PersonalizeScreen.tsx:110`), not
   `disabled`; the test asserts both dot presence and the absence of the kit's 0.5-opacity
   inert style (`app/onboarding/personalize.test.tsx:61-73`).
6. **FIXED.** `src/features/onboarding/copy.ts:96` is now exactly `'Add a fallback to
   continue'` — matches ALLSCREENS_1.md:300 verbatim (grep-confirmed; no other site quotes
   the old string).
7. **FIXED (objective half), honestly disclosed (product half).** Per-destination labels
   (`src/features/settings/copy.ts:77-81`) match the spec's own example wording ("Contact
   support, opens email"); legal rows announce "opens an external page"
   (`app/settings/help.tsx:71`). Android "Rate Fallback" performs a real
   `Linking.openURL('market://details?id=com.fallback.app')` with `canOpenURL` guard and
   toast fallback (`help.tsx:37-50`); tested including the no-toast-on-success and iOS
   no-target branches (`app/settings/help.test.tsx:28-67`). The remaining gaps (support
   email, FAQ/legal URLs, iOS store id) are genuinely pinned nowhere upstream — I checked
   ALLSCREENS_1.md S49 and found only the mockup-toast stand-ins — and the builder flagged
   them rather than inventing placeholder URLs. Correct per failure discipline;
   orchestrator: this product question still needs routing to the human.

## Blocking items

1. **`scheduleGentleReentry` resolves yesterday without the creation-day bound
   (`notBefore`) — a routine created today fires a false "Yesterday slipped by"
   notification, likely within minutes of onboarding.**
   `src/services/notifications/index.ts:150-157` calls `resolveOccurrence` with `log`,
   `offMarks`, and (since this rework) `movedInLog` — but not `notBefore`. Both canonical
   resolvers pass all four (`src/queries/internal.ts:60-64,93-99,127-135`, via
   `creationLocalDate`, internal.ts:31-33). Daily and specific-weekdays cadences carry NO
   anchor bound (`src/domain/occurrence.ts:10-13`), so for a routine created TODAY,
   `isDue(task, yesterday)` is true → carrier `own-create` → no log → `todo` →
   `mapChipToOutcome` returns `missed` for the ended day (`src/domain/dayState.ts:50`) →
   the re-entry invitation arms. This is precisely the fabricated pre-existence "missed"
   day the domain's own `notBefore` doc comment exists to prevent
   (`src/domain/occurrence.ts:46-55`). Concrete path: S07 Allow → S08 saves the user's
   first daily routine → `task:changed` → `reschedule()` → re-entry armed at
   `triggerDateFor(today, '09:00')` (`index.ts:166`) — a past DATE trigger any time after
   09:00, so it typically fires immediately: the user's first-ever notification is
   "Yesterday slipped by — today is a fresh one" about a habit that did not exist
   yesterday. Tonal poison for this product (PRD F14's re-entry is an invitation after a
   real lapse), and a correctness defect in the exact function this rework touched — the
   fix supplied one missing resolver input and left the other out.
   **Fix:** per task, compute `notBefore = toLocalDate(new Date(task.createdAt))` (the
   exact conversion `internal.ts:31-33` uses; `toLocalDate` is exported from `@/lib/date`)
   and pass it into the `resolveOccurrence` call — or equivalently skip the task when
   `yesterday < notBefore`. Passing it in the widget path too (`widgets/index.ts:63-70`)
   is behaviorally a no-op for `date = today` but keeps one calling convention; do it.
   **Acceptance test:** daily routine with `createdAt` = today (device-local), no logs →
   `reschedule()` arms NO gentle-reentry; existing missed-yesterday tests (whose fixtures
   must gain a `createdAt` of yesterday-or-earlier) stay green.

## Non-blocking notes

- **Snoozed-IN future dates arm no reminder** — `vacatedDates` fixes the snoozed-AWAY
  direction pass 1 named, but the mirror case (occurrence moved to a not-naturally-due
  D+1 gets no `routine-due` reminder at D+1) remains and is not covered by the
  `schedule.ts:43-51` disposition comment, which addresses vacated dates only. One-hop
  from today keeps exposure to a single day on a best-effort surface, so not blocking —
  but add either the fix or one explicit disposition sentence next pass.
- Theoretical chain case: a future date both vacated AND hosting a visitor (C6 shape)
  would have its reminder suppressed by `vacatedDates`. Unreachable while snooze operates
  only on today's occurrence; noting for the record, no action needed.
- Pass-1 non-blocking carries unchanged: `reschedule()` is still unserialized;
  `snapshot.ts:92` still uses `Math.round` instead of `@/lib/number`'s `roundHalfUp`.
- Record-keeping: the response's numbers are accurate this time — the M7-owned selection
  is genuinely 16 suites / 99 tests (up from 79; new bridge/carrier/theme/dots tests).

## Verified (what and how)

- **Ran:** `npx jest app/onboarding app/settings/{index,notifications,theme,widgets,help}.test.tsx
  src/services/notifications src/services/widgets` → **16 suites / 99 tests, all green**;
  `npx tsc --noEmit` → exit 0. Both match the builder's report.
- **Located the actual fix commits:** `f738cbd`/`d9f6c80` themselves carry almost nothing —
  the real M7 changes landed inside the mixed WIP snapshots (`026ec5e`, `ba5eec9`,
  `bf55f95`, `454f3f1`, `87c1abe`). Verified the end state of every touched file directly
  rather than trusting commit messages.
- **Scope discipline:** every M7-attributable change sits in M7-owned paths
  (`src/services/{notifications,widgets}`, `src/features/{onboarding,settings}`,
  `app/onboarding/**`, `app/settings/{index,notifications,widgets,help}`); frozen/foreign
  paths confirmed untouched via the empty `git diff efa5fc1 HEAD` over `app/_layout.tsx`,
  `src/domain`, `src/queries`, `src/db`, `src/ui`, `docs`, `design-input`. The currently
  uncommitted worktree changes are all M6 assistant files — not M7's.
- **Carrier traces:** worked snoozed-away and snoozed-in through `designateCarrier` by
  hand for both the widget (date = today) and re-entry (date = yesterday) paths; compared
  the services' `movedInLog`/`vacatedDates` lookups against `src/queries/internal.ts`'s
  canonical pattern line by line — same selection, no forked clause logic. The `notBefore`
  omission (blocking item 1) was found during this trace, confirmed against
  `cadenceDue`'s unanchored daily branch and `mapChipToOutcome`'s ended-day rule.
- **Spec checks:** re-read ALLSCREENS_1.md S06 (lines ~195-230) and S49 (lines ~4270-4295)
  against the shipped screens; S08's line 300 string grep-matched exactly.

## Response

Fixed. `scheduleGentleReentry` (`src/services/notifications/index.ts:150-159`) now computes
`notBefore = toLocalDate(new Date(task.createdAt))` per task, exactly matching
`src/queries/internal.ts`'s `creationLocalDate` conversion, and passes it into the
`resolveOccurrence` call alongside `log`/`offMarks`/`movedInLog`. Per the review's note that
"passing it in the widget path too is behaviorally a no-op for `date = today`" — left out of
this pass since it is explicitly a no-op and the instruction for this fix was narrowly scoped
to `scheduleGentleReentry`; flagging here in case a future pass wants the calling-convention
consistency anyway.

Added `src/services/notifications/index.test.ts`: "reschedule sends NO gentle-reentry
notification for a task created TODAY" — a daily routine with `createdAt` = today (device-local,
mid-day), no logs, asserts no `gentle-reentry` schedule call fires. Also updated every existing
task fixture that flows through `scheduleGentleReentry` (both the missed-yesterday and
snoozed-in-visitor cases) to carry a `createdAt` from 30 days ago, per the review's own
acceptance note ("existing missed-yesterday tests... must gain a `createdAt` of
yesterday-or-earlier") — without this, the new `notBefore` bound would have silently made those
fixtures start returning `false` from `isDue` and broken the very re-entry firing they test.

Ran `npx jest src/services/notifications` → 2 suites / 24 tests, all green (up from 22 — one
new test). `npx tsc --noEmit` → exit 0. `git diff --stat` confirms only
`src/services/notifications/index.ts` (already captured by an interim WIP safety commit) and
`src/services/notifications/index.test.ts` were touched — no other M7 path.

# Review — M7 (pass 3)
VERDICT: PASS

Targeted verification of the single pass-2 blocking item (`notBefore` anchor in
`scheduleGentleReentry`). The fix is genuine. **M7 clears code review entirely.**

## Blocking items

None.

## Non-blocking notes

- The fix commit `a4ce7f3` carries only the test file + this review's Response section;
  the source change itself sits in the disclosed interim snapshot `063a190` (index.ts,
  +7/−1). Combined scope across both commits: `src/services/notifications/index.ts`,
  `src/services/notifications/index.test.ts`, `review/REVIEW-M7.md` — nothing else.
  Record-keeping only; the builder disclosed this split accurately.
- `LONG_AGO_CREATED_AT` is a bare `LocalDate` string where `createdAt` is an Instant;
  `new Date('YYYY-MM-DD')` parses as UTC midnight, so west of UTC it resolves one day
  earlier — still ≥29 days before yesterday in any timezone, so harmless here.
- Carried, unchanged, for the orchestrator (not M7 defects): the M0-owned
  `app/_layout.tsx` boot-wiring CR (pass 1 item 1b), the S49 destination product gap
  (pass 1 item 7), the Gate-3 native-build note, and the pass-2 non-blocking notes
  (snoozed-IN future reminder disposition, unserialized `reschedule()`, `Math.round`).

## Verified (what and how)

1. **The fix matches the canonical pattern.** `src/services/notifications/index.ts:154`
   computes `const notBefore = toLocalDate(new Date(task.createdAt))` — byte-identical to
   `creationLocalDate` (`src/queries/internal.ts:31-33`) — and index.ts:162 passes it into
   `resolveOccurrence` alongside `log`/`offMarks`/`movedInLog`, the same four-input call
   shape as internal.ts:82, :99, and :135. Import of `toLocalDate` from `@/lib/date`
   added at index.ts:24. Cross-checked against `isDue`'s own doc comment
   (`src/domain/occurrence.ts:45-57`): this is exactly the caller-supplied device-local
   bound the domain requires.
2. **The regression test is real and non-vacuous.** New test at index.test.ts:161-169: a
   daily routine with `createdAt = ${today()}T12:00:00.000Z`, no logs → asserts NO
   `gentle-reentry` schedule call. Its sibling at :144-152 is byte-identical in setup
   except `createdAt: LONG_AGO_CREATED_AT` and asserts re-entry DOES fire — the pair
   isolates the creation date as the sole variable, so the negative cannot pass via an
   early bail elsewhere in `reschedule()`.
3. **Legitimate re-entry preserved; backfill checked fixture-by-fixture.** All 6 task
   fixtures in index.test.ts (lines 147, 158, 168, 220, 234, 252 — grep-confirmed, none
   missed, so no `new Date(undefined)` path) now carry `createdAt`. Each backfill is
   semantically right, not coincidental: the missed-yesterday (:147) and snoozed-in
   visitor (:234, whose task must predate day-before-yesterday) tests still assert firing
   WITH the bound active; the preference-off test (:168) would have become vacuous with a
   today-created task and now genuinely tests the pref gate. The backfill strengthens the
   suite rather than masking anything.
4. **Ran:** `npx jest src/services/notifications` → **2 suites / 24 tests, all green**
   (up from 22: one new test; the builder's "24 up from 22" count is off by one test vs.
   the pass-2 baseline but the suite total matches reality). `npx tsc --noEmit` → clean.
5. **Scope:** `git diff --stat 063a190~1 a4ce7f3` → exactly the three files listed above;
   worktree clean of M7 paths.
