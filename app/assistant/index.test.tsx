/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. Do NOT mock expo-router. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockRefreshEntitlement = jest.fn();
const mockHasByoConfig = jest.fn();
jest.mock('@/services/billing', () => ({ billing: { refreshEntitlement: () => mockRefreshEntitlement() } }));
jest.mock('@/services/ai', () => ({ hasByoConfig: () => mockHasByoConfig() }));
jest.mock('expo-audio', () => ({ getRecordingPermissionsAsync: jest.fn(async () => ({ granted: false })) }));

import { useEntitlementStore } from '@/app-shell';
import S31AssistantHome from './index';
import { S31_COPY } from '@/features/assistant/copy';

describe('S31 — Assistant Home', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefreshEntitlement.mockResolvedValue({ ok: true, value: undefined });
    mockHasByoConfig.mockResolvedValue(false);
    useEntitlementStore.getState().setEntitlement({
      source: 'none',
      plan: null,
      status: 'none',
      renewsOn: null,
      trialEndsOn: null,
      hasByoKey: false,
      byoSupportsTranscription: false,
    });
  });

  it('default: headline, subcopy, mic caption and all five suggestion chips render', async () => {
    await render(<S31AssistantHome />);
    expect(await screen.findByText(S31_COPY.headline)).toBeTruthy();
    expect(screen.getByText(S31_COPY.subcopy)).toBeTruthy();
    expect(screen.getByText(S31_COPY.micCaption)).toBeTruthy();
    for (const chip of S31_COPY.chips) {
      expect(screen.getByLabelText(`Suggestion: ${chip}, button`)).toBeTruthy();
    }
  });

  it('error: entitlement/permission read fails -> InlineRetryBanner, chips hidden', async () => {
    mockRefreshEntitlement.mockResolvedValue({ ok: false, error: { code: 'STORE_UNAVAILABLE', message: 'x' } });
    mockHasByoConfig.mockRejectedValue(new Error('boom'));
    await render(<S31AssistantHome />);
    expect(await screen.findByText(S31_COPY.error)).toBeTruthy();
    expect(screen.queryByText(S31_COPY.headline)).toBeNull();
  });

  it('not entitled: tapping the mic routes to S38, never S37', async () => {
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    await render(<S31AssistantHome />);
    await screen.findByText(S31_COPY.headline);
    await userEvent.press(screen.getByTestId('s31-mic'));
    expect(push).toHaveBeenCalledWith('/assistant/paywall');
    push.mockRestore();
  });

  it('send button stays disabled until text is present', async () => {
    await render(<S31AssistantHome />);
    await screen.findByText(S31_COPY.headline);
    const send = screen.getByTestId('s31-send');
    expect(send.props.accessibilityState?.disabled).toBe(true);
  });
});
