/**
 * M4 test-only — the `expo-router/testing-library` in-memory route table used by every M4
 * screen test that needs a REAL `id` path param or REAL cross-screen navigation (S20-S24's
 * dynamic `[id]` segment; house pattern's own `useLocalSearchParams` note: outside a real
 * navigator, params come back empty, which is exactly the gap this closes). This is the
 * shipped, official expo-router test harness — not a hand-rolled mock, so it does not
 * conflict with MODULES.md's "do not mock expo-router" rule (that rule is about NOT
 * re-implementing the package; `expo-router/testing-library` runs the real router against
 * an in-memory route table instead of the real filesystem, purely so a test can target only
 * this module's own screens without importing every other module's in-progress route file).
 *
 * Every destination OUTSIDE this module (Today, the four browse tabs, search, S28) is a
 * trivial marker screen — tests assert BY NAVIGATION (which marker screen is now on screen),
 * never by importing another module's real implementation.
 */
import { Text } from 'react-native';

import S20 from '../../../../app/task/[id]/index';
import S21 from '../../../../app/task/[id]/icon';
import S22 from '../../../../app/task/[id]/delete';
import S23 from '../../../../app/task/[id]/as-needed';
import S24 from '../../../../app/task/[id]/celebrate';
import S15 from '../../../../app/add/index';
import S16 from '../../../../app/add/routine';
import S17 from '../../../../app/add/event';
import S18 from '../../../../app/add/course';
import S19 from '../../../../app/add/todo';

function marker(label: string) {
  return function Marker() {
    return <Text>{label}</Text>;
  };
}

export const ROUTER_CONTEXT = {
  'task/[id]/index': S20,
  'task/[id]/icon': S21,
  'task/[id]/delete': S22,
  'task/[id]/as-needed': S23,
  'task/[id]/celebrate': S24,
  'add/index': S15,
  'add/routine': S16,
  'add/event': S17,
  'add/course': S18,
  'add/todo': S19,
  today: marker('MARKER_TODAY'),
  routines: marker('MARKER_ROUTINES'),
  events: marker('MARKER_EVENTS'),
  courses: marker('MARKER_COURSES'),
  todos: marker('MARKER_TODOS'),
  search: marker('MARKER_SEARCH'),
  'achievements/celebrate': marker('MARKER_ACHIEVEMENTS_CELEBRATE'),
};
