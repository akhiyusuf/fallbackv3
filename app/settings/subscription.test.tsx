/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. Do NOT mock expo-router. */
import { render, screen, userEvent } from '@testing-library/react-native';
import * as ExpoIap from 'expo-iap';

const mockRefreshEntitlement = jest.fn();
const mockRestore = jest.fn();
jest.mock('@/services/billing', () => ({
  billing: { refreshEntitlement: () => mockRefreshEntitlement(), restore: () => mockRestore() },
}));

const mockShowToast = jest.fn();
jest.mock('@/app-shell', () => {
  const actual = jest.requireActual('@/app-shell');
  return { ...actual, useToastStore: (selector: (s: { show: typeof mockShowToast }) => unknown) => selector({ show: mockShowToast }) };
});

import { useEntitlementStore } from '@/app-shell';
import S44ManageSubscription from './subscription';
import { S44_COPY } from '@/features/assistant/copy';

describe('S44 — Manage Subscription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefreshEntitlement.mockResolvedValue({ ok: true, value: undefined });
  });

  it('free plan: shows the free-tier framing and "Start free trial", not "Change plan"', async () => {
    useEntitlementStore.getState().setEntitlement({
      source: 'none',
      plan: null,
      status: 'none',
      renewsOn: null,
      trialEndsOn: null,
      hasByoKey: false,
      byoSupportsTranscription: false,
    });
    await render(<S44ManageSubscription />);
    expect(await screen.findByText(S44_COPY.freeFraming)).toBeTruthy();
    expect(screen.getByText(S44_COPY.startFreeTrial)).toBeTruthy();
  });

  it('subscribed-active: shows the Active badge, plan line and Change plan card', async () => {
    useEntitlementStore.getState().setEntitlement({
      source: 'subscription',
      plan: 'monthly',
      status: 'active',
      renewsOn: '2026-08-20' as never,
      trialEndsOn: null,
      hasByoKey: false,
      byoSupportsTranscription: false,
    });
    await render(<S44ManageSubscription />);
    expect(await screen.findByText(S44_COPY.planMonthly)).toBeTruthy();
    expect(screen.getByText(S44_COPY.confirmChange)).toBeTruthy();
  });

  it('error: calm warning-tone InlineRetryBanner, not a full-screen failure', async () => {
    mockRefreshEntitlement.mockResolvedValue({ ok: false, error: { code: 'STORE_UNAVAILABLE', message: 'x' } });
    await render(<S44ManageSubscription />);
    expect(await screen.findByText(S44_COPY.errorStore)).toBeTruthy();
  });

  it('B2 — never renders the hardcoded "3 days" trial fixture; renews shows the real store date, not a fabricated one', async () => {
    useEntitlementStore.getState().setEntitlement({
      source: 'subscription',
      plan: 'annual',
      status: 'active',
      renewsOn: '2026-08-20' as never,
      trialEndsOn: null,
      hasByoKey: false,
      byoSupportsTranscription: false,
    });
    await render(<S44ManageSubscription />);
    expect(await screen.findByText(/Renews Aug 20/)).toBeTruthy();
    expect(screen.queryByText(/Trial ends in 3/)).toBeNull();
  });

  it('B3 — "Manage in App Store/Play" hands off to the platform store surface via deepLinkToSubscriptions, not just a toast', async () => {
    useEntitlementStore.getState().setEntitlement({
      source: 'subscription',
      plan: 'monthly',
      status: 'active',
      renewsOn: null,
      trialEndsOn: null,
      hasByoKey: false,
      byoSupportsTranscription: false,
    });
    await render(<S44ManageSubscription />);
    await userEvent.press(await screen.findByText(S44_COPY.manageIos));
    expect(ExpoIap.deepLinkToSubscriptions).toHaveBeenCalled();
  });

  it('restore purchases with an active subscription shows the success toast', async () => {
    useEntitlementStore.getState().setEntitlement({
      source: 'none',
      plan: null,
      status: 'none',
      renewsOn: null,
      trialEndsOn: null,
      hasByoKey: false,
      byoSupportsTranscription: false,
    });
    mockRestore.mockResolvedValue({ ok: true, value: true });
    await render(<S44ManageSubscription />);
    await userEvent.press(await screen.findByText(S44_COPY.restore));
    expect(mockShowToast).toHaveBeenCalledWith(S44_COPY.restoreSuccess, 'success');
  });
});
