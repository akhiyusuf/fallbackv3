/**
 * S17 — Create Event    route: /add/event
 * Owner: M4. Features: F11, F24, F26.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S17)
 */
import { ScreenStub } from '@/ui/ScreenStub';

export default function S17CreateEvent() {
  return (
    <ScreenStub
      screen="S17"
      title="Create Event"
      route="/add/event"
      module="M4"
      features="F11, F24, F26"
    />
  );
}
