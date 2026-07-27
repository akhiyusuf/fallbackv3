/**
 * M5 test-only — the `expo-router/testing-library` in-memory route table used by M5 screen
 * tests that need REAL params (`useLocalSearchParams`) or REAL cross-screen navigation, per
 * MODULES.md's "do not mock expo-router" rule and its sanctioned alternative (review pass 1,
 * blocking item 6): `expo-router/testing-library`'s `renderRouter` runs the real router against
 * an in-memory route table instead of the real filesystem — it is the shipped, official test
 * harness, not a hand-rolled mock, so it does not conflict with the rule. Mirrors M4's own
 * `src/features/task/testSupport/routerHarness.tsx`.
 *
 * Every destination OUTSIDE the screen under test is a trivial marker screen — tests assert BY
 * NAVIGATION (which marker screen is now on screen), never by importing another module's real
 * implementation (which would drag in that screen's own query dependencies).
 */
import { Text } from 'react-native';

import S28 from '../../../../app/achievements/celebrate';
import S30 from '../../../../app/records/[cycleId]';

function marker(label: string) {
  return function Marker() {
    return <Text>{label}</Text>;
  };
}

export const M5_ROUTER_CONTEXT = {
  'achievements/celebrate': S28,
  'achievements/index': marker('MARKER_ACHIEVEMENTS'),
  'records/[cycleId]': S30,
  'records/index': marker('MARKER_RECORDS'),
  today: marker('MARKER_TODAY'),
  settings: marker('MARKER_SETTINGS'),
};
