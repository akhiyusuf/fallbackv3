# Edge round 3, agent 35: Android build and native configuration

Date: 2026-11-20. Checked: last built APK `build-output/Fallback-1.0.0-arm64.apk` (built 04:05, before this round),
`app.config.ts`, `plugins/withFallbackWidgets.js`, the generated `android/` project (read only, no prebuild, no gradle).
Tools: SDK `aapt2` and `apksigner` 36.0.0, `zipalign`, `expo config` (read only).

## Summary

- **Changed:** `app.config.ts` (20 blocked permissions, one wrong comment corrected) and the git-ignored
  `android/app/src/main/AndroidManifest.xml` (the same 20 removals mirrored by hand, so a build without
  prebuild picks them up). Both are described below.
- **New tests:** `src/edge.nativeConfig.test.ts`, 33 tests. 27 normal tests pass. 5 `it.failing` tests pass
  because their defects exist. 1 normal test is red on purpose: the APK still carries the permissions that
  this round blocks, and it goes green only after the next build (see "Main session: do this").
- **Signing: release APK is signed with the public Android debug key** (`CN=Android Debug`, SHA-256
  `fac61745dc09…`). It installs and runs, but it is not a release key and must not be used for distribution.
- **Not fixed, left for the human:** cleartext to a local model server (a product and security decision),
  release minify (R8) off (a 52.6 MB dex payload), a deep link that auto-sends a prompt (`app/assistant/chat.tsx`),
  and the backup share on Android (`app/settings/data/index.tsx`). Details below.

## Checks

### Merged manifest (from the APK)

| Item | Result |
|---|---|
| package / versionCode / versionName | `com.fallback.app`, 1, `1.0.0` (matches `package.json`). **Every Android build must raise versionCode, or sideloaded updates fail with a downgrade error.** |
| minSdk / targetSdk / compileSdk | 24 / 36 / 36 |
| ABIs | arm64-v8a only |
| `android:allowBackup` | `false` in the APK (attribute `0x01010280=false`). Confirmed. |
| 16 KB page alignment (`zipalign -c -P 16`) | Passes. |
| Hermes | On. `libhermesvm.so` present; `assets/index.android.bundle` starts with the Hermes magic `c6 1f bc 03`, so it is bytecode. |
| Cleartext | No `usesCleartextTraffic`, no `networkSecurityConfig` in the manifest. Android's default for targetSdk ≥ 28 applies: cleartext is refused. See decision D1. |
| Label / icon / round icon | `Fallback` (`@string/app_name`); `mipmap/ic_launcher` and `ic_launcher_round` at all densities; adaptive icon for API 26+ present. |
| Notification small icon | `drawable/notification_icon` at mdpi to xxxhdpi, gray+alpha PNG (color type 4), so Android can mask it. Wired as `expo.modules.notifications.default_notification_icon`. |
| Notification channel | `reminders` is created in code (`src/services/notifications/index.ts:38-47`) and every DATE reminder is sent on it. |
| Splash | `drawable/splashscreen_logo` at all densities; background `#F2601A`. |
| Deep link | `fallback://` on a VIEW filter (BROWSABLE, DEFAULT), no host or path. Any installed app can open it. See D4. |
| Widgets | Three `AppWidgetProvider` receivers, all `exported=false`, each with an existing XML descriptor (`widget_info_*.xml`): min 110 dp or 250 dp wide, `updatePeriodMillis` 30 min, no `previewImage`. |
| Hermes / ProGuard | `hermesEnabled=true`. `proguard-rules.pro` is wired, but R8 is off, so the rules never run. See F3. |

### Exported components (merged manifest)

Exported: `MainActivity` (launcher and `fallback://`, required). Two library components are also exported, and both are
protected: `FirebaseInstanceIdReceiver` (needs `com.google.android.c2dm.permission.SEND`) and androidx
`ProfileInstallReceiver` (needs `android.permission.DUMP`, system and adb only). Everything else is `exported=false`:
the widgets, `NotificationsService`, `FileSystemFileProvider`, both billing activities, the Firebase services.
No change needed.

### Permissions (merged), each with a reason

| Permission | Source | Verdict |
|---|---|---|
| RECORD_AUDIO | app.config | Keep. The assistant mic button records only while held (`useEntitlementAndMic`, `mic-primer`). |
| POST_NOTIFICATIONS | app.config | Keep. Reminders. |
| USE_BIOMETRIC | app.config | Keep. Confirms a subscription purchase. |
| SCHEDULE_EXACT_ALARM | app.config | Keep. See "Reminders and exact alarms" below. |
| com.android.vending.BILLING | app.config | Keep. |
| USE_FINGERPRINT | expo-local-authentication | Keep. Needed on API 24 to 27, where `USE_BIOMETRIC` does not cover fingerprint. |
| MODIFY_AUDIO_SETTINGS | expo-audio | Keep. `setAudioModeAsync` in `src/services/sfx`. |
| FOREGROUND_SERVICE | expo-audio | Left. Declared by the expo-audio plugin, used by no code path. Blocking it is not safe without a device check (see F4). |
| FOREGROUND_SERVICE_MEDIA_PLAYBACK | expo-audio plugin (`permissions`) | Left. Same as above. Blocking it contradicts the plugin's own permission, so it stays. |
| VIBRATE | notifications | Keep. |
| RECEIVE_BOOT_COMPLETED | expo-notifications | Keep. Reminders are re-armed after a reboot. |
| WAKE_LOCK, ACCESS_NETWORK_STATE, INTERNET | libraries | Keep. |
| c2dm RECEIVE, DYNAMIC_RECEIVER permission, BIND_GET_INSTALL_REFERRER | Firebase messaging, Play billing | Left. Firebase is dormant (no `google_app_id` resource, so FirebaseApp never starts; no analytics service is merged). |
| READ/WRITE_EXTERNAL_STORAGE (max SDK 32) | expo-file-system | **Blocked now.** Export goes through the share sheet from app-private files, and import uses the system document picker. Nothing touches shared storage. |
| Launcher badge permissions (16 vendor names, `READ_APP_BADGE` among them) | expo-notifications | **Blocked now.** No code calls `setBadgeCountAsync`. |
| AD_ID, SYSTEM_ALERT_WINDOW | blocked earlier | Confirmed absent from the APK. |

Intent queries in the manifest: `https` VIEW, `OPEN_DOCUMENT`, `OPEN_DOCUMENT_TREE`, and the custom-tab and billing services. All used.

### Reminders and exact alarms (how expo-notifications schedules DATE triggers)

`node_modules/expo-notifications/.../ExpoSchedulingDelegate.kt:106-118` decides at each arm:
- If `Build.VERSION.SDK_INT < 31` or `alarmManager.canScheduleExactAlarms()` is true, it calls
  `setExactAndAllowWhileIdle`.
- Otherwise it calls `setAndAllowWhileIdle`, which still fires but **can be late** (the system batches inexact
  alarms, and under Doze an app gets roughly one per 9 minutes).

The app never checks `canScheduleExactAlarms()` and never sends the person to "Alarms & reminders". On Android 14 and
later, `SCHEDULE_EXACT_ALARM` is not granted to a new install by default (per Android's exact-alarm docs; not
confirmed on a device here). So on a fresh install reminders still fire, but possibly minutes late, until the person
allows exact alarms in system settings. The app re-arms on every log and settings change, so an exact alarm applies
once it is allowed. `USE_EXACT_ALARM` is the wrong permission (it is granted automatically but Play only allows it for
alarm-clock and calendar apps), and the app correctly does not request it.
**Decision:** keep `SCHEDULE_EXACT_ALARM`. Product follow-up for the human: show a one-line prompt when exact alarms
are off, with a link to the system page. Not built here (product copy).

### Cleartext traffic (BYO local servers)

`src/services/ai/safeBaseUrl.ts` accepts `http://` only for loopback, `.local`, and private IPv4 ranges
(10/8, 172.16/12, 192.168/16, 127/8). Android refuses cleartext to all of those by default. A network security config can
only name domains, not IP ranges, so letting a LAN model server through means `cleartextTrafficPermitted=true` for
every host. That removes the OS-level guard for every `http://` request, not just the BYO one.
**Decision D1:** keep the OS default. Consequence: a BYO address with `http://192.168.x.x` fails on Android with a
"cleartext not permitted" error, even though the app accepts it. Users need `https` (or a tunnel). To change this,
the human decides. Expected fix: a config plugin that adds `res/xml/network_security_config.xml`, scoped to
`<base-config>`. Pinned by `it.failing` in the test file. Not verified on a device.

### Release signing and shrinking

- **Signing (F1):** `android/app/build.gradle:109` and `:114`: both debug and release use `signingConfigs.debug`
  (`debug.keystore`, password `android`). The APK's signer is `CN=Android Debug`. This key is public, so anyone can sign
  an APK with the same package name, and that APK could replace an install on a phone. Acceptable for the test week
  only. Before any distribution, create a release keystore, keep it out of git, and set it in `build.gradle`.
- **Shrinking (F3):** `android.enableMinifyInReleaseBuilds` is unset, so R8 is off. Result: five dex files totalling
  52.6 MB uncompressed. Enabling it is the largest size win available (not measured here). It needs a full test pass,
  because the `proguard-rules.pro` keeps are only the reanimated and TurboModule ones.

### Secrets and source maps in the bundle

- `index.android.bundle` (Hermes bytecode): no `sk-…`, `sk-ant-…`, `AKIA…`, `AIza…`, private-key block or
  `sourceMappingURL`. Hits for `sk-`, `api_key` and `secret` are library strings (`apiKeyHelper`, and words such as
  "task-deleted"). No `.map` files in the APK.
- The only `http://` URL in the bundle is `http://localhost:8081/progress?from=settingsDataErase`. It is a string
  that the app's own route `/progress?from=settings` does not produce, so it probably comes from a library's dev
  help. Not a leak; noted.
- `api.fallback.app` is the managed assistant endpoint, public by design.
- `assets/app.config` (the Expo config as shipped) contains `"googleOAuthClientId":{}`. The value is null in source, and
  nothing in `src/` or `app/` reads it (see F5).

### APK size breakdown (54.9 MB file)

| Part | Size | Note |
|---|---|---|
| dex (5 files, `classes*.dex`) | 52.6 MB stored, about 19.1 MB deflated | Unminified (F3). Largest saving available. |
| native libs, arm64 only | 23.6 MB stored | `libreactnative` 7.0 MB, `libhermesvm` 2.5 MB, `libexpo-sqlite` 1.8 MB, `libappmodules` 1.7 MB (probably the autolinked Expo module glue; not confirmed), `libreanimated` 1.5 MB, `libexpo-modules-core` 1.5 MB, `libc++_shared` 1.3 MB. Nothing to drop without losing a feature. |
| JS bundle (Hermes) | 6.05 MB | Not profiled by package. |
| resources.arsc | 2.4 MB | |
| Material Symbols font (`res/V6.ttf`) | 0.96 MB | Pulled in by `expo-symbols`, a dependency of `expo-router`. The app's own UI uses lucide icons. Removing it means changing expo-router, so it is left. |
| Nunito, 5 weights | 0.66 MB | The app's typeface. Keep. |
| Sound effects (18 WAV) | 0.99 MB | The 14 in `assets/sfx` plus 4 more. Keep. |
| Images, XML, WebP | about 1.9 MB | Mostly library resources. |

### Other notes (not changed)

- `src/services/sfx/index.ts:60` sets `playsInSilentMode` to true on Android, so sound effects play with the ringer off.
  This is a deliberate-looking choice but a product one; flagged for the human.
- `app/assistant/chat.tsx:95-100` and the deep-link route (D4, below).
- `plugins/withFallbackWidgets.js` is the one custom config plugin. It copies native sources and adds the three
  receivers, and it is durable (it runs on prebuild). The iOS half is not verified by its own header.

## Decisions and bugs

**Fixed in this round**

- **F-a. Launcher badges and legacy storage merged in with no code path.** Fixed durably in `app.config.ts`
  (`android.blockedPermissions`, 18 entries added: 2 storage permissions and 16 badge permissions). Mirrored by hand into
  the generated `android/app/src/main/AndroidManifest.xml` (`tools:node="remove"`, 20 lines in all with the two
  existing ones), so a build without prebuild includes the change. A prebuild regenerates the same result from
  `app.config.ts`. **Verify after the build:** `aapt2 dump badging <apk>` must no longer list those 18 permissions.
  `FOREGROUND_SERVICE_MEDIA_PLAYBACK` was considered and left: the expo-audio plugin adds it to `permissions`, so
  blocking it would contradict the plugin (caught by `expo config`).
- **F-b. Stale comment on `extra.googleOAuthClientId`.** It said `SyncProvider.isAvailable()` keys off it. Nothing reads it
  (`src/services/sync/index.ts` decides availability). Comment corrected in `app.config.ts`; the value is unchanged.

**Left, with the reason**

- **D1 Cleartext to a LAN model server.** Left blocked by the OS (see above). Needs a human decision.
- **D2 Exact alarms off on Android 14+.** Reminders still fire, but late. A prompt is a product choice, not built.
- **D3 Release signed with the debug key.** Needs a release keystore from the human (not something to generate here).
- **D4 Deep link auto-sends a prompt. Real defect, outside my area.** `app/assistant/chat.tsx:95-100`:
  `fallback://assistant/chat?opening=<text>` calls `sendMessage(params.opening)` at once, with no tap. Any app
  on the phone can open that link. Confirmed with a jest run: the provider's `streamChat` was called once with no
  interaction. Destructive routes are safe: `/settings/data/erase` and `/task/[id]/delete` only open their confirmation
  sheets (`app/settings/data/erase.tsx`, `app/task/[id]/delete.tsx`). Suggested fix: pre-fill the composer instead of
  sending. Pinned by `it.failing` in `src/edge.nativeConfig.test.ts`.
  Not checked: `listen=1` opens voice mode; I did not confirm whether it starts recording without a hold.
- **D5 Backup share on Android, a real bug, outside my area.** `app/settings/data/index.tsx:61` calls
  `Share.share({ url, message: uri })`. React Native's Android `Share` forwards only `title` and `message`
  (`node_modules/react-native/Libraries/Share/Share.js`), so the share sheet gets the path as text, not the backup file.
  Fix needs a file-sharing API (for example `expo-sharing` with the `FileSystemFileProvider` already in the manifest), and
  that is a dependency decision. Pinned by a static `it.failing`.
- **F3 R8 off.** See above. Enabling it needs a full test pass; `android.enableMinifyInReleaseBuilds` cannot be set
  durably without `expo-build-properties` (not installed), so this is a decision for the human.
- **F4 FOREGROUND_SERVICE and FOREGROUND_SERVICE_MEDIA_PLAYBACK** are declared only by the expo-audio plugin and used by
  no code path. Removing them needs the plugin change plus a device check.
- **F5 googleOAuthClientId** is dead config (see fixed item b). No behaviour depends on it.

## Tests (`src/edge.nativeConfig.test.ts`)

Run: `timeout 500 npx jest src/edge.nativeConfig.test.ts --selectProjects app --maxWorkers=1 --testTimeout=60000 --forceExit`

- **app.config (permissions):** requested set is exactly the reviewed five; RECORD_AUDIO has a code path; USE_EXACT_ALARM
  not requested; AD_ID and SYSTEM_ALERT_WINDOW blocked; the new blocked set present; no name both requested and blocked.
- **app.config (backup, identity, endpoint):** allowBackup false; scheme `fallback`; versionCode positive integer and
  versionName equal to package.json; assistant endpoint https; no key-shaped secret in the config.
- **android/ manifest:** only MainActivity exported among app components; allowBackup false in the source manifest;
  fallback:// filter (VIEW, BROWSABLE, DEFAULT); three widget receivers non-exported, each with an existing XML;
  cleartext off (pins D1).
- **android/ resources:** notification icon at five densities with alpha; `reminders` channel created and used by every
  DATE trigger; label `Fallback`; launcher icon and adaptive icon present; splash present on orange.
- **android/ gradle:** Hermes on; ProGuard wired.
- **APK (last build, skipped when absent):** target ≥ 35, min 24; **no blocked permission in the merged manifest (red until
  the next build)**; allowBackup false in the APK; no source map and no key-shaped secret in the bundle.
- **Known defects, `it.failing` (each passes while the defect exists):** local http server reachable (D1);
  release signed with a release key (D3); R8 on (F3); deep-link prompt not auto-sent (D4); Android backup share sends the
  file (D5).
- **Behaviour control:** typing and sending a prompt in the assistant reaches the provider. This proves the D4 check
  is not passing for a setup reason.

Typecheck: `npx tsc --noEmit` shows no errors in `src/edge.nativeConfig.test.ts` or `app.config.ts`.
Lint: 7 warnings (`require` style imports, same as the other edge tests). No errors.

## What I could not test (needs a phone or a build)

- Exact-alarm timing on Android 14+ with the permission off, and the late-delivery window in Doze.
- A LAN `http://` model server (expected blocked; not seen on a device).
- A third-party app opening `fallback://assistant/chat?opening=...` (the code path is confirmed in jest, not from a real intent).
- The Android share sheet content for the backup (D5).
- Widget picker previews (no `previewImage`; Android 12+ shows the app icon instead).
- Whether the merged manifest is actually clean after a build (needs the build, per the brief).
- R8 and the size gain (needs a minified build).

## Main session: do this

1. Build the APK (the generated `android/` manifest already carries the 20 removals).
2. Run `aapt2 dump badging <apk> | grep uses-permission` and confirm none of the 18 new names is present. Then the
   APK test in `src/edge.nativeConfig.test.ts` goes green.
3. **Bump `versionCode`** in `app.config.ts` (and the generated `android/app/build.gradle` `versionCode`) for every build
   the phone will update over, or the install fails.
4. Decide D1, D3, F3 and D5, and the D4 fix, before a release build.
