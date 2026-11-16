const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const config = getDefaultConfig(__dirname);
config.resolver.sourceExts = [...config.resolver.sourceExts, 'sql'];
const shim = (f) => path.join(__dirname, 'web-shims', f);
const SHIMS = {
  'expo-sqlite': shim('expo-sqlite.js'),
  'expo-secure-store': shim('expo-secure-store.js'),
  'expo-audio': shim('expo-audio.js'),
  'expo-notifications': shim('expo-notifications.js'),
  'expo-local-authentication': shim('expo-local-authentication.js'),
  'expo-iap': shim('expo-iap.js'),
  'expo-file-system': shim('expo-file-system.js'),
  'expo-file-system/legacy': shim('expo-file-system-legacy.js'),
  'expo-document-picker': shim('expo-document-picker.js'),
  'expo-crypto': shim('expo-crypto.js'),
  'sql.js/dist/sql-asm.js': path.join(__dirname, 'node_modules/sql.js/dist/sql-asm.js'),
};
const EMPTY = new Set(['fs', 'path', 'crypto']);
const prev = config.resolver.resolveRequest;
config.resolver.resolveRequest = (ctx, name, platform) => {
  if (platform === 'web') {
    if (SHIMS[name]) return { type: 'sourceFile', filePath: SHIMS[name] };
    if (EMPTY.has(name) && /sql\.js/.test(ctx.originModulePath)) return { type: 'empty' };
  }
  return (prev ?? ctx.resolveRequest)(ctx, name, platform);
};
module.exports = config;
