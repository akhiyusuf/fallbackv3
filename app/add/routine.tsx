/**
 * S16 — Create Routine    route: /add/routine
 * Owner: M4. Features: F2, F23, F26, F27.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S16)
 */
import { ScreenStub } from '@/ui/ScreenStub';

export default function S16CreateRoutine() {
  return (
    <ScreenStub
      screen="S16"
      title="Create Routine"
      route="/add/routine"
      module="M4"
      features="F2, F23, F26, F27"
    />
  );
}
