/**
 * Round 3 spec coverage (review/EDGE-BRIEF.md). PRD F17 (price points, 7-day trial, plan choice),
 * F18 and ALLSCREENS_1.md S39/S40: the reveal control on the BYO key field had no test, and no test
 * asserted the price points the store sheet shows. House pattern: RNTL v14.
 */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

const mockPurchase = jest.fn();
jest.mock('@/services/billing', () => ({ billing: { purchase: (plan: string) => mockPurchase(plan) } }));

const mockProbe = jest.fn();
const mockSetByoConfig = jest.fn();
jest.mock('@/services/ai', () => ({
  probeByoEndpoint: (baseUrl: string, apiKey: string) => mockProbe(baseUrl, apiKey),
  setByoConfig: (cfg: unknown) => mockSetByoConfig(cfg),
}));

import S39ChoosePlanAndConfirm from '../app/assistant/paywall/plan';
import S40ByoAiKeySetup from '../app/assistant/paywall/byo';
import { S39_COPY, S40_COPY } from '@/features/assistant/copy';

describe('S39 — plan prices and trial copy (spec coverage, F17)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the monthly price point, $4.99 a month', async () => {
    await render(<S39ChoosePlanAndConfirm />);
    expect(screen.getByText(/\$4\.99\/mo/)).toBeTruthy();
  });

  it('shows the annual price point: $39.99 a year, marked "Save 33%", against $59.88', async () => {
    await render(<S39ChoosePlanAndConfirm />);
    expect(screen.getByText(S39_COPY.annual.badge)).toBeTruthy();
    expect(screen.getByText(S39_COPY.annual.note)).toBeTruthy();
    expect(screen.getByText(/\$3\.33\/mo/)).toBeTruthy();
  });

  it('states the 7-day free trial and that it renews, with cancel anytime', async () => {
    await render(<S39ChoosePlanAndConfirm />);
    expect(screen.getByText(S39_COPY.subcopy)).toBeTruthy();
  });

  it('Annual is selected on arrival; choosing Monthly then confirming buys the monthly plan', async () => {
    mockPurchase.mockResolvedValue({ ok: false, error: { code: 'CANCELLED', message: 'x' } });
    await render(<S39ChoosePlanAndConfirm />);
    expect(screen.getByLabelText(/Annual.*selected/)).toBeTruthy();
    expect(screen.getByLabelText(/Monthly.*not selected/)).toBeTruthy();
    await userEvent.press(screen.getByLabelText(/Monthly.*not selected/));
    expect(screen.getByLabelText(/Monthly.*selected,?$/)).toBeTruthy();
    await userEvent.press(screen.getByTestId('s39-confirm'));
    await waitFor(() => expect(mockPurchase).toHaveBeenCalledWith('monthly'));
  });
});

describe('S40 — the API key reveal control (spec coverage, F18)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('the key starts masked, the eye control reveals it, and tapping again masks it', async () => {
    await render(<S40ByoAiKeySetup />);
    const field = screen.getByTestId('s40-api-key');
    expect(field.props.secureTextEntry).toBe(true);
    await userEvent.press(screen.getByLabelText('Show API key'));
    expect(screen.getByTestId('s40-api-key').props.secureTextEntry).toBe(false);
    await userEvent.press(screen.getByLabelText('Hide API key'));
    expect(screen.getByTestId('s40-api-key').props.secureTextEntry).toBe(true);
  });

  it('revealing the key does not change what is typed, and Save still sends the exact key', async () => {
    mockProbe.mockResolvedValue({ ok: true, value: { chat: true, transcription: true } });
    mockSetByoConfig.mockResolvedValue({ ok: true, value: undefined });
    await render(<S40ByoAiKeySetup />);
    await userEvent.type(screen.getByTestId('s40-base-url'), 'https://api.openai.com/v1');
    await userEvent.type(screen.getByTestId('s40-api-key'), 'sk-test-123');
    await userEvent.press(screen.getByLabelText('Show API key'));
    expect(screen.getByTestId('s40-api-key').props.value).toBe('sk-test-123');
    await userEvent.press(screen.getByText(S40_COPY.save));
    await waitFor(() => expect(mockProbe).toHaveBeenCalledWith('https://api.openai.com/v1', 'sk-test-123'));
  });
});
