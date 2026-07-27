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
