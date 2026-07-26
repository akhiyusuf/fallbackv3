// FROZEN SCAFFOLD FILE — architect-owned. No feature module may edit.
// Add tests under the paths your module owns; never change this file.
module.exports = {
  // Empty until M1/M2 land their suites; keeps `npm test` green on the bare scaffold.
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
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|lucide-react-native))',
      ],
    },
  ],
};
