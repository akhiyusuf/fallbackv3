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
    ['expo-splash-screen', { backgroundColor: '#ffffff', resizeMode: 'contain' }],
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
    router: {},
  },
};

export default config;
