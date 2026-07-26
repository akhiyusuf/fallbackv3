// FROZEN SCAFFOLD FILE — architect-owned. No feature module may edit.
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['node_modules/**', '.expo/**', '.expo-export-check/**', 'ios/**', 'android/**', 'server/dist/**'],
  },
  {
    rules: {
      // Design-system adherence: raw hex/rgb values are forbidden outside src/theme.
      // Enforced by review (docs/ARCHITECTURE.md §5), not lint, to keep the config frozen.
      'import/no-unresolved': 'off',
    },
  },
];
