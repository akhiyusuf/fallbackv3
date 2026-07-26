// FROZEN SCAFFOLD FILE — architect-owned. No feature module may edit.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// SQL migration files are loaded as strings by src/db/migrations (M1).
config.resolver.sourceExts = [...config.resolver.sourceExts, 'sql'];

module.exports = config;
