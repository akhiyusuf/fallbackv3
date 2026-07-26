/**
 * S01 — Splash    route: /splash
 * Owner: M1. Features: F1, F9.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S01)
 */
import { ScreenStub } from '@/ui/ScreenStub';

export default function S01Splash() {
  return (
    <ScreenStub
      screen="S01"
      title="Splash"
      route="/splash"
      module="M1"
      features="F1, F9"
    />
  );
}
