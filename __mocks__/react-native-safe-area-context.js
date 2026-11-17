// Root manual mock for `react-native-safe-area-context` (Jest picks it up without a jest.mock call).
// Why: the real `useSafeAreaInsets` throws "No safe area value available" unless a provider is
// mounted above it, and most screens read the insets. Every test then needs the same provider.
// This keeps the real module's exports and contexts, and gives the hooks and provider a default:
// zero insets and a 390x844 frame, which is the phone size the app's layout tests assume.
// Same shape as the library's own `jest/mock.tsx`, written as plain JS because that file is TSX
// and sits inside node_modules, where the jest transform does not reach.
const React = require('react');

const actual = jest.requireActual('react-native-safe-area-context');

const MOCK_INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

module.exports = {
  ...actual,
  initialWindowMetrics: MOCK_INITIAL_METRICS,
  useSafeAreaInsets: () => React.useContext(actual.SafeAreaInsetsContext) ?? MOCK_INITIAL_METRICS.insets,
  useSafeAreaFrame: () => React.useContext(actual.SafeAreaFrameContext) ?? MOCK_INITIAL_METRICS.frame,
  SafeAreaProvider: ({ children, initialMetrics }) =>
    React.createElement(
      actual.SafeAreaFrameContext.Provider,
      { value: initialMetrics?.frame ?? MOCK_INITIAL_METRICS.frame },
      React.createElement(
        actual.SafeAreaInsetsContext.Provider,
        { value: initialMetrics?.insets ?? MOCK_INITIAL_METRICS.insets },
        children,
      ),
    ),
};
