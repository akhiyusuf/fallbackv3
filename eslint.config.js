// FROZEN SCAFFOLD FILE — architect-owned. No feature module may edit.
const expoConfig = require('eslint-config-expo/flat');

// Globals for the folders that are plain Node or Jest code rather than app code. Written out here
// (not pulled from the `globals` package) so the lint setup adds no dependency.
const jestGlobals = {
  jest: 'readonly',
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
};

const nodeGlobals = {
  module: 'writable',
  exports: 'writable',
  require: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  process: 'readonly',
  Buffer: 'readonly',
  global: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setImmediate: 'readonly',
  URL: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
};

module.exports = [
  ...expoConfig,
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      '.expo-export-check/**',
      'ios/**',
      'android/**',
      'server/dist/**',
      // Human-owned design handoff and project docs: not lintable app code.
      'design-input/**',
      'docs/**',
    ],
  },
  {
    files: ['__mocks__/**'],
    languageOptions: { globals: { ...jestGlobals, ...nodeGlobals } },
  },
  {
    files: ['plugins/**', 'server/**'],
    languageOptions: { globals: nodeGlobals },
  },
  {
    rules: {
      // Design-system adherence: raw hex/rgb values are forbidden outside src/theme.
      // Enforced by review (docs/ARCHITECTURE.md §5), not lint, to keep the config frozen.
      'import/no-unresolved': 'off',
    },
  },
];
