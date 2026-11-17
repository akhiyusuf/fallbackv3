import type { ExpoConfig } from 'expo/config';

/**
 * FROZEN SCAFFOLD FILE — architect-owned.
 * No feature module may edit this file. Adding a plugin, permission, entitlement
 * or native target requires an architect change request (docs/ARCHITECTURE.md §11).
 *
 * Every plugin the v1 feature set needs is already declared here so that no
 * builder ever has to touch app config to land their module.
 */
const config: ExpoConfig = {
  name: 'Fallback',
  slug: 'fallback',
  scheme: 'fallback',
  version: '1.0.0',
  orientation: 'portrait',
  // Placeholder mark until the human chooses one: the sprout pot from onboarding on the app orange.
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  platforms: ['ios', 'android'],
  assetBundlePatterns: ['**/*'],

  ios: {
    bundleIdentifier: 'com.fallback.app',
    buildNumber: '1',
    supportsTablet: false,
    // F21 widgets + F20 iCloud sync share the app group / ubiquity container.
    entitlements: {
      'com.apple.security.application-groups': ['group.com.fallback.app'],
      'com.apple.developer.icloud-container-identifiers': ['iCloud.com.fallback.app'],
      'com.apple.developer.icloud-services': ['CloudDocuments'],
      'com.apple.developer.ubiquity-container-identifiers': ['iCloud.com.fallback.app'],
    },
    infoPlist: {
      // F16 voice input. F9/F37 prime every prompt with a rationale first.
      NSMicrophoneUsageDescription:
        'Fallback uses your microphone only while you hold the assistant mic button, to turn what you say into tasks.',
      NSFaceIDUsageDescription:
        'Fallback uses Face ID only to confirm a subscription purchase.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },

  android: {
    package: 'com.fallback.app',
    versionCode: 1,
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#F2601A' },
    permissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.USE_BIOMETRIC',
      'android.permission.SCHEDULE_EXACT_ALARM',
      'com.android.vending.BILLING',
    ],
    blockedPermissions: [
      // Zero analytics / zero tracking is a ship-blocking PRD constraint (§4, §5).
      'com.google.android.gms.permission.AD_ID',
    ],
  },

  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-secure-store',
    'expo-localization',
    'expo-web-browser',
    ['expo-splash-screen', { backgroundColor: '#F2601A', image: './assets/splash-icon.png', imageWidth: 180, resizeMode: 'contain' }],
    // The app typeface, one file per weight. `Text` and `TextInput` from `@/ui/AppText` ask for it by family name.
    [
      'expo-font',
      {
        android: {
          fonts: [
            {
              fontFamily: 'Nunito',
              fontDefinitions: [
                { path: './assets/fonts/Nunito-Regular.ttf', weight: 400 },
                { path: './assets/fonts/Nunito-Medium.ttf', weight: 500 },
                { path: './assets/fonts/Nunito-SemiBold.ttf', weight: 600 },
                { path: './assets/fonts/Nunito-Bold.ttf', weight: 700 },
                { path: './assets/fonts/Nunito-ExtraBold.ttf', weight: 800 },
              ],
            },
          ],
        },
        ios: {
          fonts: [
            './assets/fonts/Nunito-Regular.ttf',
            './assets/fonts/Nunito-Medium.ttf',
            './assets/fonts/Nunito-SemiBold.ttf',
            './assets/fonts/Nunito-Bold.ttf',
            './assets/fonts/Nunito-ExtraBold.ttf',
          ],
        },
      },
    ],
    ['expo-local-authentication', { faceIDPermission: 'Confirm your subscription purchase with Face ID.' }],
    ['expo-audio', { microphonePermission: 'Fallback listens only while you hold the assistant mic button.' }],
    ['expo-notifications', { color: '#F2601A' }],
    'expo-iap',
    // M7 native widget targets (iOS WidgetKit + Android AppWidget). The plugin
    // file is owned by M7; this reference is frozen so M7 never edits app.config.ts.
    './plugins/withFallbackWidgets',
  ],

  experiments: {
    typedRoutes: true,
    reactCompiler: false,
  },

  extra: {
    // Managed-assistant backend base URL (F16/F17). Overridable per build profile.
    // NEVER receives habit data — see docs/API.md §4.
    assistantApiBaseUrl: process.env.FALLBACK_ASSISTANT_API ?? 'https://api.fallback.app',

    // F20 cloud sync, Android half. `expo-auth-session` cannot start a Drive
    // `appDataFolder` flow without an OAuth client ID, and none is provisioned yet.
    // Declared explicitly as null so SyncProvider.isAvailable() can key off a real value
    // instead of the gap being invisible. See ARCHITECTURE.md §9.2.1 (KNOWN GAP).
    // The iOS half additionally needs a native iCloud module that does not exist yet.
    googleOAuthClientId: process.env.FALLBACK_GOOGLE_OAUTH_CLIENT_ID ?? null,

    router: {},
  },
};

export default config;
