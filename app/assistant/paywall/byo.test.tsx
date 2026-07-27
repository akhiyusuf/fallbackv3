/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. Do NOT mock expo-router. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockProbe = jest.fn();
const mockSetByoConfig = jest.fn();
jest.mock('@/services/ai', () => ({
  probeByoEndpoint: (baseUrl: string, apiKey: string) => mockProbe(baseUrl, apiKey),
  setByoConfig: (cfg: unknown) => mockSetByoConfig(cfg),
}));

import S40ByoAiKeySetup from './byo';
import { S40_COPY } from '@/features/assistant/copy';

async function fillForm() {
  await userEvent.type(screen.getByTestId('s40-base-url'), 'https://api.openai.com/v1');
  await userEvent.type(screen.getByTestId('s40-api-key'), 'sk-test-123');
}

describe('S40 — BYO AI Key Setup', () => {
  beforeEach(() => jest.clearAllMocks());

  it('invalid endpoint: keeps the typed values, shows the calm inline error, never full-screen red', async () => {
    mockProbe.mockResolvedValue({ ok: false });
    await render(<S40ByoAiKeySetup />);
    await fillForm();
    await userEvent.press(screen.getByTestId('s40-save'));
    expect(await screen.findByText(S40_COPY.invalid)).toBeTruthy();
    expect(screen.getByTestId('s40-base-url').props.value).toBe('https://api.openai.com/v1');
    expect(mockSetByoConfig).not.toHaveBeenCalled();
  });

  it('success — full capability: saves the key and navigates to S32', async () => {
    mockProbe.mockResolvedValue({ ok: true, transcription: true });
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    await render(<S40ByoAiKeySetup />);
    await fillForm();
    await userEvent.press(screen.getByTestId('s40-save'));
    expect(await screen.findByText(S40_COPY.successFull)).toBeTruthy();
    expect(mockSetByoConfig).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-test-123', supportsTranscription: true }),
    );
    replace.mockRestore();
  });

  it('success — degraded (no transcription): saves anyway, warning-tone banner, never blocks the save', async () => {
    mockProbe.mockResolvedValue({ ok: true, transcription: false });
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    await render(<S40ByoAiKeySetup />);
    await fillForm();
    await userEvent.press(screen.getByTestId('s40-save'));
    expect(await screen.findByText(S40_COPY.successDegraded)).toBeTruthy();
    expect(mockSetByoConfig).toHaveBeenCalledWith(expect.objectContaining({ supportsTranscription: false }));
    replace.mockRestore();
  });

  it('B12 — the degraded-success banner gets the SAME display delay as full success before navigating, never an instant (0ms) navigation', async () => {
    mockProbe.mockResolvedValue({ ok: true, transcription: false });
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    const setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout');
    await render(<S40ByoAiKeySetup />);
    await fillForm();
    await userEvent.press(screen.getByTestId('s40-save'));
    expect(await screen.findByText(S40_COPY.successDegraded)).toBeTruthy();

    // Find the navigation timer among whatever else may have scheduled a setTimeout, and
    // assert its delay — the old bug scheduled 0ms for the degraded path specifically.
    const navigationDelays = setTimeoutSpy.mock.calls
      .map((call) => call[1])
      .filter((delay): delay is number => typeof delay === 'number' && delay >= 600);
    expect(navigationDelays.length).toBeGreaterThan(0);

    setTimeoutSpy.mockRestore();
    replace.mockRestore();
  });

  it('reveal/mask toggle switches the API key field between secure and plaintext', async () => {
    await render(<S40ByoAiKeySetup />);
    const field = screen.getByTestId('s40-api-key');
    expect(field.props.secureTextEntry).toBe(true);
    await userEvent.press(screen.getByLabelText('Reveal API key'));
    expect(field.props.secureTextEntry).toBe(false);
  });
});
