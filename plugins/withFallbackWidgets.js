/**
 * M7. Expo config plugin adding the iOS WidgetKit extension and the Android
 * AppWidget provider as native targets, plus the shared App Group container.
 * Referenced from app.config.ts (frozen) so M7 never edits app config.
 * STUB — currently a pass-through so `expo prebuild` succeeds before M7 lands.
 */
module.exports = function withFallbackWidgets(config) {
  return config;
};
