/**
 * S40 — BYO AI Key Setup    route: /assistant/paywall/byo
 * Owner: M6. Features: F18.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S40)
 */
import { ScreenStub } from '@/ui/ScreenStub';

export default function S40ByoAiKeySetup() {
  return (
    <ScreenStub
      screen="S40"
      title="BYO AI Key Setup"
      route="/assistant/paywall/byo"
      module="M6"
      features="F18"
    />
  );
}
