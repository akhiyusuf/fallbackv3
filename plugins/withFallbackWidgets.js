/**
 * M7. Expo config plugin adding the iOS WidgetKit extension and the Android AppWidget
 * provider as native targets, plus wiring both to read the shared JSON snapshot
 * `src/services/widgets/index.ts` writes (see that file's header and
 * `native/README.md`). Referenced from `app.config.ts` (frozen) so M7 never edits app
 * config — only this file's contents.
 *
 * VERIFICATION NOTE (flagged in the module's final report, same honesty standard as
 * ARCHITECTURE §9.2.1's F20 sync gap): this plugin cannot be run end-to-end in this
 * environment — there is no macOS/Xcode or Android SDK toolchain here, and `expo prebuild`
 * needs both to actually generate `ios/`/`android/` and build. Every API used below
 * (`withDangerousMod`, `withAndroidManifest`, `withXcodeProject`, and the `xcode` npm
 * library's own `project.addTarget('app_extension', ...)` behaviour) is documented,
 * inspected against the installed `xcode`/`@expo/config-plugins` source in this repo, and
 * used the way community "raw" widget-extension plugins do — but the iOS half in
 * particular (a new `PBXNativeTarget`) needs a real `expo prebuild && pod install` pass in
 * a macOS dev environment to confirm the generated project actually opens and builds in
 * Xcode. Do not treat this as verified until that run happens.
 */
const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withDangerousMod,
  withXcodeProject,
  AndroidConfig,
} = require('expo/config-plugins');

const NATIVE_DIR = path.join(__dirname, '..', 'native');
const APP_GROUP_ID = 'group.com.fallback.app';
const ANDROID_WIDGET_PACKAGE = 'com.fallback.app.widgets';

const ANDROID_WIDGETS = [
  { providerClass: 'SmallTodayWidgetProvider', widgetInfo: 'widget_info_small_today' },
  { providerClass: 'SmallOneTaskWidgetProvider', widgetInfo: 'widget_info_small_one_task' },
  { providerClass: 'MediumUpNextWidgetProvider', widgetInfo: 'widget_info_medium_up_next' },
];

function copyFile(src, destDir, destName) {
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, path.join(destDir, destName ?? path.basename(src)));
}

/** Copies `native/android/widgets/**` into the generated Android project. */
function withAndroidWidgetFiles(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const androidRoot = cfg.modRequest.platformProjectRoot;
      const kotlinSrcDir = path.join(NATIVE_DIR, 'android', 'widgets', 'kotlin');
      const kotlinDestDir = path.join(
        androidRoot,
        'app',
        'src',
        'main',
        'java',
        ...ANDROID_WIDGET_PACKAGE.split('.'),
      );
      for (const file of fs.readdirSync(kotlinSrcDir)) {
        copyFile(path.join(kotlinSrcDir, file), kotlinDestDir);
      }

      const xmlSrcDir = path.join(NATIVE_DIR, 'android', 'widgets', 'res', 'xml');
      const xmlDestDir = path.join(androidRoot, 'app', 'src', 'main', 'res', 'xml');
      for (const file of fs.readdirSync(xmlSrcDir)) {
        copyFile(path.join(xmlSrcDir, file), xmlDestDir);
      }

      const layoutSrcDir = path.join(NATIVE_DIR, 'android', 'widgets', 'res', 'layout');
      const layoutDestDir = path.join(androidRoot, 'app', 'src', 'main', 'res', 'layout');
      for (const file of fs.readdirSync(layoutSrcDir)) {
        copyFile(path.join(layoutSrcDir, file), layoutDestDir);
      }

      return cfg;
    },
  ]);
}

/** Registers each `AppWidgetProvider` as a `<receiver>` in the merged AndroidManifest.xml. */
function withAndroidWidgetManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    if (!app.receiver) app.receiver = [];

    for (const widget of ANDROID_WIDGETS) {
      const receiverName = `${ANDROID_WIDGET_PACKAGE}.${widget.providerClass}`;
      const alreadyPresent = app.receiver.some((r) => r.$['android:name'] === receiverName);
      if (alreadyPresent) continue;

      app.receiver.push({
        $: {
          'android:name': receiverName,
          'android:exported': 'false',
        },
        'intent-filter': [
          { action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }] },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.appwidget.provider',
              'android:resource': `@xml/${widget.widgetInfo}`,
            },
          },
        ],
      });
    }

    return cfg;
  });
}

/**
 * Copies `native/ios/FallbackWidgets/**` into the generated iOS project, under the exact
 * filename the `xcode` library's own `addTarget('app_extension', ...)` expects for the
 * Info.plist (`<subfolder>/<subfolder>-Info.plist` — see `withIosWidgetTarget` below).
 */
function withIosWidgetFiles(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const iosRoot = cfg.modRequest.platformProjectRoot;
      const srcDir = path.join(NATIVE_DIR, 'ios', 'FallbackWidgets');
      const destDir = path.join(iosRoot, 'FallbackWidgets');
      fs.mkdirSync(destDir, { recursive: true });

      for (const file of fs.readdirSync(srcDir)) {
        if (file === 'Info.plist') {
          copyFile(path.join(srcDir, file), destDir, 'FallbackWidgets-Info.plist');
        } else {
          copyFile(path.join(srcDir, file), destDir);
        }
      }

      return cfg;
    },
  ]);
}

/**
 * Adds the WidgetKit extension as a real `PBXNativeTarget`, embedded into the app target.
 * `project.addTarget(name, 'app_extension', subfolder, bundleId)` (the `xcode` library
 * `withXcodeProject` hands us as `config.modResults`) already creates the build
 * configuration list, the product reference, the "Copy Files" embed phase on the app's
 * first target, AND the target dependency — see its source in `node_modules/xcode/lib/
 * pbxProject.js`. What it does NOT do: add our actual Swift sources to a Sources build
 * phase, or point `CODE_SIGN_ENTITLEMENTS` at our App Group entitlements file — both added
 * explicitly below.
 */
function withIosWidgetTarget(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const bundleId = `${cfg.ios.bundleIdentifier}.FallbackWidgets`;

    const existing = project.pbxTargetByName('FallbackWidgets');
    if (existing) return cfg; // idempotent across repeated prebuilds

    const target = project.addTarget('FallbackWidgets', 'app_extension', 'FallbackWidgets', bundleId);

    const swiftFiles = fs
      .readdirSync(path.join(NATIVE_DIR, 'ios', 'FallbackWidgets'))
      .filter((f) => f.endsWith('.swift'))
      .map((f) => `FallbackWidgets/${f}`);

    project.addBuildPhase(swiftFiles, 'PBXSourcesBuildPhase', 'Sources', target.uuid);
    project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);

    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      const entry = configurations[key];
      if (typeof entry !== 'object' || !entry.buildSettings) continue;
      if (entry.buildSettings.PRODUCT_NAME !== '"FallbackWidgets"') continue;

      entry.buildSettings.CODE_SIGN_ENTITLEMENTS = '"FallbackWidgets/FallbackWidgets.entitlements"';
      entry.buildSettings.SWIFT_VERSION = '5.0';
      entry.buildSettings.TARGETED_DEVICE_FAMILY = '"1,2"';
      entry.buildSettings.CURRENT_PROJECT_VERSION = '"1"';
      entry.buildSettings.MARKETING_VERSION = '"1.0.0"';
      // Matches `ios.bundleIdentifier`'s own deployment target (ARCHITECTURE §1.1's pin) —
      // a WidgetKit extension cannot target an OS version older than iOS 14.
      entry.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = '"16.0"';
    }

    return cfg;
  });
}

module.exports = function withFallbackWidgets(config) {
  config = withAndroidWidgetFiles(config);
  config = withAndroidWidgetManifest(config);
  config = withIosWidgetFiles(config);
  config = withIosWidgetTarget(config);
  return config;
};

module.exports.APP_GROUP_ID = APP_GROUP_ID;
