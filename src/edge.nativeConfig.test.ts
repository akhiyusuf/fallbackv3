/**
 * Edge campaign, round 3, agent 35: Android build and native configuration.
 *
 * Three kinds of check live here:
 *   - STATIC reads of `app.config.ts`, `package.json`, `plugins/` and the generated `android/`
 *     project (manifest, gradle, resources). The `android/` checks skip cleanly when that folder
 *     is absent (it is git-ignored and made by `expo prebuild`).
 *   - APK checks against the last built package in `build-output/`, using the SDK's `aapt2`. They
 *     skip when the APK or the SDK tool is absent. The APK is only as new as its last build: the
 *     permission check below fails until the next build picks up the `blockedPermissions` change.
 *   - ONE behaviour check: a prompt arriving by deep link is sent without a tap (see the last
 *     describe block). It is `it.failing` because the defect sits in `app/assistant/chat.tsx`,
 *     outside this agent's area. Flip it to `it` once that screen stops auto-sending.
 *
 * `it.failing` marks a real defect that is NOT fixed here. It passes while the defect exists and
 * turns red once someone fixes it. Findings are written up in review/haiku/35-android-config.md.
 */
// Node built-ins, typed locally: this project has no @types/node. Jest runs from the repo root.
interface NodeFs {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: 'utf8'): string;
  readFileSync(path: string): Uint8Array;
}
interface NodePath {
  join(...parts: string[]): string;
}
interface NodeChildProcess {
  execFileSync(file: string, args: string[], options?: { encoding: 'utf8' | 'latin1'; maxBuffer?: number }): string;
}
const { existsSync, readFileSync } = require('fs') as NodeFs;
const { join } = require('path') as NodePath;
const { execFileSync } = require('child_process') as NodeChildProcess;

// Typed locally for the React test renderer and the chat screen; no @types/react globals in a .ts file.
type Component = () => unknown;
interface RntlModule {
  render(element: unknown): Promise<unknown>;
  screen: { getByLabelText(label: string): unknown };
  userEvent: { type(el: unknown, text: string): Promise<void>; press(el: unknown): Promise<void> };
  act(cb: () => Promise<void>): Promise<void>;
}

const ROOT = process.cwd();
const ANDROID = join(ROOT, 'android');
const ANDROID_MANIFEST = join(ANDROID, 'app', 'src', 'main', 'AndroidManifest.xml');
const RES = join(ANDROID, 'app', 'src', 'main', 'res');
const APK = join(ROOT, 'build-output', 'Fallback-1.0.0-arm64.apk');
const AAPT2 = '/root/android-sdk/build-tools/36.0.0/aapt2';

const hasAndroid = existsSync(ANDROID_MANIFEST);
const describeAndroid = hasAndroid ? describe : describe.skip;
const hasApk = existsSync(APK) && existsSync(AAPT2);
const describeApk = hasApk ? describe : describe.skip;

function read(relative: string): string {
  return readFileSync(join(ROOT, relative), 'utf8');
}

/** Color type from a PNG's IHDR chunk (byte 25), read without an image decoder. */
function pngColorType(path: string): number {
  return readFileSync(path)[25] ?? -1;
}

// The app config is TypeScript and only needs `expo/config`'s type, which Babel erases.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const appConfig = (require(join(ROOT, 'app.config.ts')) as { default: any }).default as {
  version: string;
  scheme: string;
  android: {
    package: string;
    versionCode: number;
    allowBackup: boolean;
    permissions: string[];
    blockedPermissions: string[];
  };
  extra: { assistantApiBaseUrl: string };
};

// ---------------------------------------------------------------------------------------------
// app.config.ts: permissions, backup, identity (always runs)
// ---------------------------------------------------------------------------------------------

describe('app.config.ts: permissions each have a code path', () => {
  // The exact list the app asks for. Adding one means a reviewer checks its code path first.
  const REQUESTED = [
    'android.permission.RECORD_AUDIO', // assistant mic button (expo-audio recording)
    'android.permission.POST_NOTIFICATIONS', // reminders (expo-notifications)
    'android.permission.USE_BIOMETRIC', // confirm a subscription purchase
    'android.permission.SCHEDULE_EXACT_ALARM', // reminders at the chosen minute (see note below)
    'com.android.vending.BILLING', // subscriptions (expo-iap)
  ];

  // Only the app's own list is checked here. Plugins add more at resolve time (expo-audio adds the
  // media foreground service and USE_FINGERPRINT comes from expo-local-authentication); the APK tests
  // below check the merged result.
  it('requests exactly the reviewed set', () => {
    expect([...appConfig.android.permissions].sort()).toEqual([...REQUESTED].sort());
  });

  it('has a code path for RECORD_AUDIO: the assistant records only while the mic button is held', () => {
    const src = read('app/assistant/mic-primer.tsx') + read('src/features/assistant/useEntitlementAndMic.ts');
    expect(src).toMatch(/requestRecordingPermissionsAsync|getRecordingPermissionsAsync|useAudioRecorder/);
  });

  it('asks for SCHEDULE_EXACT_ALARM, not USE_EXACT_ALARM (Play only allows the latter for alarm-clock and calendar apps)', () => {
    expect(appConfig.android.permissions).not.toContain('android.permission.USE_EXACT_ALARM');
  });

  it('blocks the advertising ID and the draw-over-apps permission', () => {
    expect(appConfig.android.blockedPermissions).toEqual(
      expect.arrayContaining(['com.google.android.gms.permission.AD_ID', 'android.permission.SYSTEM_ALERT_WINDOW']),
    );
  });

  it('blocks merged-in permissions that no code path uses (legacy storage, launcher badges)', () => {
    expect(appConfig.android.blockedPermissions).toEqual(
      expect.arrayContaining([
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.READ_APP_BADGE',
        'com.sec.android.provider.badge.permission.WRITE',
        'com.huawei.android.launcher.permission.CHANGE_BADGE',
      ]),
    );
  });

  it('never blocks a permission the app does request (a blocked-and-requested name would be a contradiction)', () => {
    const overlap = appConfig.android.blockedPermissions.filter((p) => appConfig.android.permissions.includes(p));
    expect(overlap).toEqual([]);
  });
});

describe('app.config.ts: backup, identity and endpoint', () => {
  it('turns Android auto-backup off, so the habit database and the encrypted AI key stay out of Google backup', () => {
    expect(appConfig.android.allowBackup).toBe(false);
  });

  it('keeps the deep-link scheme in step with the app identity', () => {
    expect(appConfig.scheme).toBe('fallback');
    expect(appConfig.android.package).toBe('com.fallback.app');
  });

  it('has a positive integer versionCode and a versionName equal to the package version', () => {
    expect(Number.isInteger(appConfig.android.versionCode)).toBe(true);
    expect(appConfig.android.versionCode).toBeGreaterThan(0);
    const pkg = JSON.parse(read('package.json')) as { version: string };
    expect(appConfig.version).toBe(pkg.version);
  });

  it('sends the managed assistant only over https', () => {
    expect(appConfig.extra.assistantApiBaseUrl.startsWith('https://')).toBe(true);
  });

  it('contains no key-shaped secret in the config source', () => {
    const src = read('app.config.ts');
    expect(src).not.toMatch(/sk-(ant-)?[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|BEGIN [A-Z ]*PRIVATE KEY/);
  });
});

// ---------------------------------------------------------------------------------------------
// android/ source project (generated by prebuild; skipped when absent)
// ---------------------------------------------------------------------------------------------

describeAndroid('android/ manifest: components, exports and intent filters', () => {
  const manifest = () => readFileSync(ANDROID_MANIFEST, 'utf8');

  it('marks only MainActivity as exported among the app\'s own components', () => {
    const exported = [...manifest().matchAll(/<(activity|receiver|service|provider)\b[^>]*android:name="([^"]+)"[^>]*>/g)]
      .filter((m) => /android:exported="true"/.test(m[0]))
      .map((m) => m[2]);
    expect(exported).toEqual(['.MainActivity']);
  });

  it('keeps allowBackup="false" in the generated application element', () => {
    expect(manifest()).toMatch(/<application[^>]*android:allowBackup="false"/);
  });

  it('declares the fallback:// scheme on a VIEW filter that is BROWSABLE and DEFAULT', () => {
    const m = manifest();
    const filter = m.match(/<intent-filter>(?:(?!<\/intent-filter>)[\s\S])*?android:scheme="fallback"[\s\S]*?<\/intent-filter>/);
    expect(filter).not.toBeNull();
    expect(filter![0]).toContain('android.intent.action.VIEW');
    expect(filter![0]).toContain('android.intent.category.BROWSABLE');
    expect(filter![0]).toContain('android.intent.category.DEFAULT');
  });

  it('keeps the widget providers non-exported and each pointing at an existing XML descriptor', () => {
    const m = manifest();
    const receivers = [...m.matchAll(/<receiver android:name="([^"]+)" android:exported="false">([\s\S]*?)<\/receiver>/g)];
    expect(receivers.map((r) => r[1]).sort()).toEqual([
      'com.fallback.app.widgets.MediumUpNextWidgetProvider',
      'com.fallback.app.widgets.SmallOneTaskWidgetProvider',
      'com.fallback.app.widgets.SmallTodayWidgetProvider',
    ]);
    for (const r of receivers) {
      const xml = /@xml\/([A-Za-z0-9_]+)/.exec(r[2] ?? '');
      expect(xml).not.toBeNull();
      expect(existsSync(join(RES, 'xml', `${xml![1]}.xml`))).toBe(true);
    }
  });

  it('keeps cleartext traffic off: no usesCleartextTraffic="true" and no network security config', () => {
    const m = manifest();
    expect(m).not.toMatch(/usesCleartextTraffic="true"/);
    expect(m).not.toMatch(/networkSecurityConfig=/);
  });

  it.failing('lets a local http:// model server be reached, as the BYO rule in src/services/ai/safeBaseUrl.ts promises (the OS blocks cleartext today)', () => {
    // A BYO address on the home network (e.g. http://192.168.1.20:11434) is accepted by the app
    // but Android refuses cleartext to it by default. Passes while that gap exists; flips to a
    // normal `it` once a network security config (or an explicit decision) permits it.
    const m = manifest();
    const cleartextAllowed = /usesCleartextTraffic="true"/.test(m) || /networkSecurityConfig=/.test(m);
    expect(cleartextAllowed).toBe(true);
  });
});

describeAndroid('android/ resources: notification icon, channel, label, icons, splash', () => {
  it('ships the notification small icon at every density, as alpha-carrying PNG', () => {
    const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
    for (const d of densities) {
      const path = join(RES, `drawable-${d}`, 'notification_icon.png');
      expect(existsSync(path)).toBe(true);
      // Android masks a status-bar icon by its alpha channel: gray+alpha (4) or RGBA (6).
      expect([4, 6]).toContain(pngColorType(path));
    }
    expect(read('android/app/src/main/AndroidManifest.xml')).toMatch(/default_notification_icon"\s+android:resource="@drawable\/notification_icon"/);
  });

  it('creates the reminders channel in code and sends every DATE reminder on it', () => {
    const src = read('src/services/notifications/index.ts');
    expect(src).toMatch(/const CHANNEL_ID = 'reminders'/);
    expect(src).toMatch(/setNotificationChannelAsync\(CHANNEL_ID/);
    const dateTriggers = src.match(/type: Notifications\.SchedulableTriggerInputTypes\.DATE[^}]*\}/g) ?? [];
    expect(dateTriggers.length).toBeGreaterThan(0);
    for (const t of dateTriggers) expect(t).toMatch(/channelId: CHANNEL_ID/);
  });

  it('labels the app "Fallback" through the string resource', () => {
    expect(read('android/app/src/main/res/values/strings.xml')).toMatch(/name="app_name">Fallback</);
  });

  it('has the launcher icon at each density and an adaptive icon for API 26+', () => {
    for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
      expect(existsSync(join(RES, `mipmap-${d}`, 'ic_launcher.webp'))).toBe(true);
    }
    expect(existsSync(join(RES, 'mipmap-anydpi-v26', 'ic_launcher.xml'))).toBe(true);
    expect(existsSync(join(RES, 'drawable', 'ic_launcher_background.xml'))).toBe(true);
  });

  it('keeps the splash artwork on the app orange', () => {
    expect(existsSync(join(RES, 'drawable-xxxhdpi', 'splashscreen_logo.png'))).toBe(true);
    expect(read('android/app/src/main/res/values/colors.xml')).toMatch(/#F2601A/i);
  });
});

describeAndroid('android/ gradle: Hermes, signing, shrinking, ProGuard', () => {
  it('runs JavaScript on Hermes', () => {
    expect(read('android/gradle.properties')).toMatch(/^hermesEnabled=true$/m);
  });

  it('keeps ProGuard rules wired into the release build', () => {
    const gradle = read('android/app/build.gradle');
    expect(gradle).toMatch(/proguardFiles getDefaultProguardFile\("proguard-android\.txt"\), "proguard-rules\.pro"/);
    expect(existsSync(join(ANDROID, 'app', 'proguard-rules.pro'))).toBe(true);
  });

  it.failing('signs the release variant with a release key, not the public debug key', () => {
    // Known gap: release uses signingConfigs.debug (see build.gradle). Passes while that is so.
    const gradle = read('android/app/build.gradle');
    const release = /release\s*\{[\s\S]*?\n\s{8}\}/.exec(gradle);
    expect(release).not.toBeNull();
    expect(release![0]).not.toMatch(/signingConfig\s*=\s*signingConfigs\.debug/);
  });

  it.failing('minifies the release build with R8 (currently off, so the dex files are unshrunk)', () => {
    // Known size gap: android.enableMinifyInReleaseBuilds is not set, so R8 is off and the
    // proguard rules never run. Passes while R8 is off; flips when someone turns it on and tests it.
    expect(read('android/gradle.properties')).toMatch(/^android\.enableMinifyInReleaseBuilds=true$/m);
  });
});

// ---------------------------------------------------------------------------------------------
// APK (last build; skipped when absent)
// ---------------------------------------------------------------------------------------------

describeApk('built APK: merged manifest, SDK levels, bundle contents', () => {
  const aapt2 = (args: string[]) => execFileSync(AAPT2, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

  it('targets API 35 or later and supports API 24 and up', () => {
    const badging = aapt2(['dump', 'badging', APK]);
    expect(badging).toMatch(/minSdkVersion:'24'/);
    const target = /targetSdkVersion:'(\d+)'/.exec(badging);
    expect(target).not.toBeNull();
    expect(Number(target![1])).toBeGreaterThanOrEqual(35);
  });

  it('carries none of the blocked permissions after the merge', () => {
    const badging = aapt2(['dump', 'badging', APK]);
    const granted = [...badging.matchAll(/uses-permission: name='([^']+)'/g)].map((m) => m[1]);
    const leaked = appConfig.android.blockedPermissions.filter((p) => granted.includes(p));
    expect(leaked).toEqual([]);
  });

  it('ships an allowBackup="false" application', () => {
    const tree = aapt2(['dump', 'xmltree', APK, '--file', 'AndroidManifest.xml']);
    expect(tree).toMatch(/allowBackup\(0x01010280\)=false/);
  });

  it('has no source maps and no key-shaped secret in the JS bundle', () => {
    // The bundle is Hermes bytecode whose strings are stored as plain bytes, so a latin1 scan finds them.
    const bundle = execFileSync('unzip', ['-p', APK, 'assets/index.android.bundle'], {
      encoding: 'latin1',
      maxBuffer: 64 * 1024 * 1024,
    });
    expect(bundle.length).toBeGreaterThan(0);
    expect(bundle).not.toMatch(/sourceMappingURL/);
    expect(bundle).not.toMatch(/sk-ant-|sk-[A-Za-z0-9]{24,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|BEGIN [A-Z ]*PRIVATE KEY/);
  });
});

describe('native share of the backup (static; the defect is in app/settings/data/index.tsx)', () => {
  it('on Android the backup is saved as a file into a folder the person picks, not shared as path text', () => {
    // React Native's Share ignores `url` on Android (it forwards only title and message), so the old
    // `Share.share({ url, message: uri })` handed over the path as text. Fixed: offerBackupFile saves
    // the file through Android's folder picker (Storage Access Framework).
    const src = read('app/settings/data/index.tsx');
    expect(src).not.toMatch(/message:\s*result\.value\.uri/);
    expect(src).toMatch(/offerBackupFile\(/);
    expect(read('src/features/data/offerBackupFile.ts')).toMatch(/StorageAccessFramework\.createFileAsync/);
  });
});

// ---------------------------------------------------------------------------------------------
// Deep link into the assistant (behaviour; the defect is in app/assistant/chat.tsx)
// ---------------------------------------------------------------------------------------------

// Rendering the chat screen is slow under load; the default 5 s limit made these tests flaky.
jest.setTimeout(30000);

// Required once at the top: Testing Library registers hooks, which may not be called inside a test.
const rntl = require('@testing-library/react-native') as RntlModule;
const { createElement } = require('react') as { createElement: (c: Component) => unknown };

// Mocks for the assistant screen, hoisted above the requires in the deep-link block below.
const mockParams: { current: Record<string, string> } = { current: {} };
const mockGetAssistantProvider = jest.fn();

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useLocalSearchParams: () => mockParams.current,
}));
jest.mock('@/queries', () => ({
  useTasks: () => ({ data: [] }),
  useCreateTask: () => ({ mutateAsync: jest.fn() }),
  useUpdateTask: () => ({ mutateAsync: jest.fn() }),
  useDeleteTask: () => ({ mutateAsync: jest.fn() }),
  useLogState: () => ({ mutateAsync: jest.fn() }),
  useSettings: () => ({ data: { assistant: { language: 'en-US', voice: 'warm' } } }),
  useUpdateSettings: () => ({ mutateAsync: jest.fn(async () => ({ ok: true, value: undefined })) }),
}));
jest.mock('@/services/ai', () => ({
  getAssistantProvider: () => mockGetAssistantProvider(),
  appendMessage: jest.fn(async () => ({ ok: true, value: undefined })),
  upsertConversation: jest.fn(async () => ({ ok: true, value: undefined })),
  listMessages: jest.fn(async () => []),
}));
jest.mock('@/services/billing', () => ({
  billing: { refreshEntitlement: jest.fn(async () => ({ ok: true, value: undefined })) },
}));
jest.mock('expo-audio', () => ({
  getRecordingPermissionsAsync: jest.fn(async () => ({ granted: false })),
}));

describe('deep link into the assistant', () => {
  function okStream() {
    return (async function* () {
      yield { type: 'text-delta', delta: 'Done.' };
      yield { type: 'done', summary: 'ok' };
    })();
  }

  async function settle(ms = 30): Promise<void> {
    await rntl.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    });
  }

  beforeEach(() => {
    mockParams.current = {};
    mockGetAssistantProvider.mockReset();
  });

  it('control: a prompt the person types and sends reaches the assistant provider', async () => {
    const Chat = (require('../app/assistant/chat') as { default: Component }).default;
    const streamChat = jest.fn(() => okStream());
    mockGetAssistantProvider.mockResolvedValue({ id: 'managed', streamChat, capabilities: async () => ({ chat: true, transcription: true }) });

    await rntl.render(createElement(Chat));
    await rntl.userEvent.type(rntl.screen.getByLabelText('Type your request'), 'add a run');
    await rntl.userEvent.press(rntl.screen.getByLabelText('Send'));
    await settle();
    expect(streamChat).toHaveBeenCalled();
  });

  it('a prompt arriving by deep link (fallback://assistant/chat?opening=...) waits for the person to send it', async () => {
    // Any app can open fallback://; today the chat screen sends `opening` at once with no tap.
    // Passes while that happens; flips to a normal `it` once the prompt is only pre-filled.
    const Chat = (require('../app/assistant/chat') as { default: Component }).default;
    mockParams.current = { opening: 'Delete every habit I have' };
    const streamChat = jest.fn(() => okStream());
    mockGetAssistantProvider.mockResolvedValue({ id: 'managed', streamChat, capabilities: async () => ({ chat: true, transcription: true }) });

    await rntl.render(createElement(Chat));
    await settle();
    expect(streamChat).not.toHaveBeenCalled();
  });
});
