// FROZEN SCAFFOLD FILE — architect-owned. No feature module may edit.
// Add tests under the paths your module owns; never change this file.
// If you need a change here, raise an architect change request (docs/MODULES.md).
const expoPreset = require('jest-expo/jest-preset');

// `standard-navigation` (pulled in by expo-router) declares "type": "module" and ships raw
// ESM in a .js file, so it evades both the .mjs transform and the name mapping below and
// dies on `Cannot use import statement outside a module`. Whitelisting it for transform is
// sufficient: expo-router then imports, renders and spies UNMOCKED (verified).
//
// lucide-react-native's `exports` map resolves the react-native/import condition to an
// ESM .mjs build, which reaches Jest untranspiled and dies on `Unexpected token 'export'`.
// Pin the test resolver to lucide's prebuilt CJS output instead. Measured: ~3x faster than
// relying on the .mjs babel transform below, which has to transpile every icon file
// (44s -> 13s on a single-suite run). Same source, different build output.
const lucideCjs = {
  '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  '^lucide-react-native/icons/(.*)$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/icons/$1.js',
};

module.exports = {
  // Keeps `npm test` green for a project whose suites have not landed yet.
  passWithNoTests: true,
  projects: [
    {
      displayName: 'domain',
      preset: 'jest-expo',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/domain/**/*.test.ts'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    },
    {
      displayName: 'app',
      preset: 'jest-expo',
      testMatch: [
        '<rootDir>/src/**/*.test.ts',
        '<rootDir>/src/**/*.test.tsx',
        '<rootDir>/app/**/*.test.tsx',
      ],
      testPathIgnorePatterns: ['<rootDir>/src/domain/'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1', ...lucideCjs },
      transform: {
        // Reuse the preset's own babel-jest config so it cannot drift, extended to .mjs
        // for any future ESM-only dependency not covered by a name mapping above.
        ...expoPreset.transform,
        '^.+\\.mjs$': expoPreset.transform['\\.[jt]sx?$'],
      },
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|lucide-react-native|standard-navigation))',
      ],
    },
  ],
};
