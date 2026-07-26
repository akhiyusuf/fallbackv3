/**
 * S44 — Manage Subscription    route: /settings/subscription
 * Owner: M6. Features: F17.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S44)
 */
import { ScreenStub } from '@/ui/ScreenStub';

export default function S44ManageSubscription() {
  return (
    <ScreenStub
      screen="S44"
      title="Manage Subscription"
      route="/settings/subscription"
      module="M6"
      features="F17"
    />
  );
}
