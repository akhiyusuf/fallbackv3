// FROZEN SCAFFOLD FILE — architect-owned. No feature module may edit.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// SQL migration files are loaded as strings by src/db/migrations (M1).
config.resolver.sourceExts = [...config.resolver.sourceExts, 'sql'];

// Test files live next to the routes in app/. expo-router would otherwise treat them as routes and
// bundle them (and jest-only imports such as `expo-router/testing-library`), which breaks the release
// bundle. Hide them from Metro only; jest does not read this file.
const existing = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  /[\\/]app[\\/].*\.(test|spec)\.[jt]sx?$/,
];

module.exports = config;
