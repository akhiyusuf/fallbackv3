/**
 * Round 2 edge pass: S39 (confirm), S38 (paywall, restore), S44 (manage) and S40 (own key) when the store
 * is slow, pending, offline or tapped twice, and the BYO key screen's handling of http:// and of the key itself.
 */
import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockPurchase = jest.fn();
const mockRestore = jest.fn();
const mockRefresh = jest.fn();
const mockGetProducts = jest.fn();
jest.mock('@/services/billing', () => ({
  billing: {
    purchase: (p: string) => mockPurchase(p),
    restore: () => mockRestore(),
    refreshEntitlement: () => mockRefresh(),
    getProducts: () => mockGetProducts(),
  },
}));
const mockProbe = jest.fn();
const mockSetByo = jest.fn();
jest.mock('@/services/ai', () => ({
  probeByoEndpoint: (u: string, k: string) => mockProbe(u, k),
  setByoConfig: (c: unknown) => mockSetByo(c),
}));

import { useEntitlementStore, useToastStore } from '@/app-shell';
import { S38_COPY, S39_COPY, S40_COPY, S44_COPY } from '@/features/assistant/copy';

import S38Paywall from './index';
import S39Plan from './plan';
import S40Byo from './byo';
import S44Manage from '../../settings/subscription';

beforeEach(() => {
  jest.restoreAllMocks();
  mockPurchase.mockReset();
  mockRestore.mockReset();
  mockRefresh.mockReset().mockResolvedValue({ ok: true, value: undefined });
  mockGetProducts.mockReset().mockResolvedValue({ ok: true, value: [] });
  mockProbe.mockReset().mockResolvedValue({ ok: true, transcription: true, model: 'm' });
  mockSetByo.mockReset().mockResolvedValue(undefined);
  useToastStore.setState({ toast: null });
  useEntitlementStore.getState().setEntitlement({ source: 'none', plan: null, status: 'none', renewsOn: null, trialEndsOn: null, hasByoKey: false, byoSupportsTranscription: false });
});

describe('S39 confirm purchase', () => {
  // The success path navigates after 600 ms; let that timer run inside its own test, not a later one.
  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 650));
  });

  it('pending approval: a calm waiting line, not "success", no navigation, button usable again', async () => {
    mockPurchase.mockResolvedValue({ ok: false, error: { code: 'ENTITLEMENT_REQUIRED', message: 'x', cause: 'pending' } });
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    await render(<S39Plan />);
    await userEvent.press(screen.getByTestId('s39-confirm'));
    expect(await screen.findByTestId('s39-pending')).toBeTruthy();
    expect(screen.queryByText(S39_COPY.success)).toBeNull();
    expect(screen.queryByText(S39_COPY.purchaseError)).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('the waiting line does not use an em dash', async () => {
    mockPurchase.mockResolvedValue({ ok: false, error: { code: 'ENTITLEMENT_REQUIRED', message: 'x', cause: 'pending' } });
    await render(<S39Plan />);
    await userEvent.press(screen.getByTestId('s39-confirm'));
    expect((await screen.findByTestId('s39-pending')).props.children).not.toMatch(/—/);
  });

  it('network failure: the calm retry banner, and Retry asks the store again', async () => {
    mockPurchase.mockResolvedValueOnce({ ok: false, error: { code: 'NETWORK_UNAVAILABLE', message: 'x' } }).mockResolvedValueOnce({ ok: true, value: undefined });
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    await render(<S39Plan />);
    await userEvent.press(screen.getByTestId('s39-confirm'));
    await userEvent.press(await screen.findByText(S39_COPY.retry));
    await screen.findByText(S39_COPY.success);
    expect(mockPurchase).toHaveBeenCalledTimes(2);
    replace.mockRestore();
  });

  it('a double tap on Buy asks the store once', async () => {
    mockPurchase.mockImplementation(() => new Promise((r) => setTimeout(() => r({ ok: true, value: undefined }), 40)));
    jest.spyOn(router, 'replace').mockImplementation(() => {});
    await render(<S39Plan />);
    const buy = screen.getByTestId('s39-confirm');
    await fireEvent.press(buy);
    await fireEvent.press(buy);
    await screen.findByText(S39_COPY.success);
    expect(mockPurchase).toHaveBeenCalledTimes(1);
  });

  it('the chosen plan is what is bought (monthly, then the retry keeps monthly)', async () => {
    mockPurchase.mockResolvedValue({ ok: false, error: { code: 'UNKNOWN', message: 'x' } });
    await render(<S39Plan />);
    await userEvent.press(screen.getByText(S39_COPY.monthly.title));
    await userEvent.press(screen.getByTestId('s39-confirm'));
    await userEvent.press(await screen.findByText(S39_COPY.retry));
    expect(mockPurchase.mock.calls.map((c) => c[0])).toEqual(['monthly', 'monthly']);
  });
});

describe('S38 paywall restore', () => {
  it('nothing to restore: a neutral toast, stays on the paywall', async () => {
    mockRestore.mockResolvedValue({ ok: true, value: false });
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    await render(<S38Paywall />);
    await userEvent.press(await screen.findByText(S44_COPY.restore));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe(S38_COPY.restoreNoneFound));
    expect(replace).not.toHaveBeenCalled();
  });

  it('one to restore: goes to the assistant', async () => {
    mockRestore.mockResolvedValue({ ok: true, value: true });
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    await render(<S38Paywall />);
    await userEvent.press(await screen.findByText(S44_COPY.restore));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/assistant/chat'));
  });

  it('store offline during restore: the store error toast, not "nothing found"', async () => {
    mockRestore.mockResolvedValue({ ok: false, error: { code: 'STORE_UNAVAILABLE', message: 'x' } });
    await render(<S38Paywall />);
    await userEvent.press(await screen.findByText(S44_COPY.restore));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe(S44_COPY.errorStore));
  });

  it('a double tap on Restore asks the store once', async () => {
    mockRestore.mockImplementation(() => new Promise((r) => setTimeout(() => r({ ok: true, value: false }), 40)));
    await render(<S38Paywall />);
    const row = await screen.findByText(S44_COPY.restore);
    await fireEvent.press(row);
    await fireEvent.press(row);
    await waitFor(() => expect(useToastStore.getState().toast).not.toBeNull());
    expect(mockRestore).toHaveBeenCalledTimes(1);
  });

  it('the store unreachable on open: banner with Retry, and the plan button is disabled', async () => {
    mockGetProducts.mockResolvedValueOnce({ ok: false, error: { code: 'STORE_UNAVAILABLE', message: 'x' } }).mockResolvedValueOnce({ ok: true, value: [] });
    await render(<S38Paywall />);
    await userEvent.press(await screen.findByText(S38_COPY.retry));
    await waitFor(() => expect(mockGetProducts).toHaveBeenCalledTimes(2));
  });
});

describe('S44 subscription screen', () => {
  it('active subscriber: shows Active, the plan and the renewal date', async () => {
    useEntitlementStore.getState().patchEntitlement({ source: 'subscription', plan: 'annual', status: 'active', renewsOn: '2027-03-04' as never });
    await render(<S44Manage />);
    expect(await screen.findByText('Active')).toBeTruthy();
    expect(screen.getAllByText('Annual').length).toBeGreaterThan(0);
    expect(screen.getByText('Mar 4, 2027')).toBeTruthy();
  });

  it('after an expiry or a refund (store says nothing is active) it reads Free plan and offers the trial again', async () => {
    useEntitlementStore.getState().patchEntitlement({ source: 'subscription', plan: 'monthly', status: 'active' });
    mockRefresh.mockImplementation(async () => {
      useEntitlementStore.getState().patchEntitlement({ source: 'none', plan: null, status: 'none', renewsOn: null });
      return { ok: true, value: undefined };
    });
    await render(<S44Manage />);
    expect(await screen.findByText('Free plan')).toBeTruthy();
    expect(screen.getByText(S44_COPY.startFreeTrial)).toBeTruthy();
    expect(screen.queryByText('Renews')).toBeNull();
  });

  it('a subscriber with an unknown renewal date sees a dash, never an invented date', async () => {
    useEntitlementStore.getState().patchEntitlement({ source: 'subscription', plan: 'monthly', status: 'active', renewsOn: null });
    await render(<S44Manage />);
    expect(await screen.findByText('–')).toBeTruthy();
  });

  it('offline on open: the retry banner; Retry loads it', async () => {
    mockRefresh.mockResolvedValueOnce({ ok: false, error: { code: 'STORE_UNAVAILABLE', message: 'x' } }).mockResolvedValueOnce({ ok: true, value: undefined });
    await render(<S44Manage />);
    await userEvent.press(await screen.findByText('Retry'));
    expect(await screen.findByText('Fallback AI')).toBeTruthy();
  });

  it('restore with none: neutral toast; with one: success toast; store error: warning toast', async () => {
    await render(<S44Manage />);
    mockRestore.mockResolvedValueOnce({ ok: true, value: false });
    await userEvent.press(await screen.findByText(S44_COPY.restore));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe(S44_COPY.restoreNone));
    mockRestore.mockResolvedValueOnce({ ok: true, value: true });
    await userEvent.press(await screen.findByText(S44_COPY.restore));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe(S44_COPY.restoreSuccess));
    mockRestore.mockResolvedValueOnce({ ok: false, error: { code: 'STORE_UNAVAILABLE', message: 'x' } });
    await userEvent.press(await screen.findByText(S44_COPY.restore));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe(S44_COPY.errorStore));
  });
});

describe('S40 own AI key', () => {
  async function fill(url: string, key = 'sk-live-ABCDEF123456') {
    await userEvent.clear(screen.getByTestId('s40-base-url'));
    await userEvent.type(screen.getByTestId('s40-base-url'), url);
    await userEvent.type(screen.getByTestId('s40-api-key'), key);
    await userEvent.press(screen.getByTestId('s40-save'));
  }

  it.each(['http://api.openai.com/v1', 'HTTP://api.example.com', 'http://example.com:8080/v1', 'http://localhost.evil.com/v1', 'http://192.169.1.1/v1', 'http://172.32.0.1/v1', 'http://user@evil.com/v1', 'http://10.0.0.1.evil.com/v1'])(
    'refuses %s before anything is sent: the key is never probed or saved',
    async (url) => {
      await render(<S40Byo />);
      await fill(url);
      expect(await screen.findByText(/https:\/\//)).toBeTruthy();
      expect(mockProbe).not.toHaveBeenCalled();
      expect(mockSetByo).not.toHaveBeenCalled();
    },
  );

  it.each(['http://localhost:11434/v1', 'http://127.0.0.1:8080/v1', 'http://192.168.1.20:1234/v1', 'http://10.0.0.5/v1', 'http://172.16.4.4/v1', 'http://[::1]:8000/v1', 'http://mybox.local:8080/v1'])(
    'accepts %s (this phone or the home network)',
    async (url) => {
      jest.spyOn(router, 'replace').mockImplementation(() => {});
      await render(<S40Byo />);
      await fill(url);
      await waitFor(() => expect(mockProbe).toHaveBeenCalledTimes(1));
      expect(mockProbe.mock.calls[0]![0]).toBe(url);
    },
  );

  it('https goes through, with the key and URL trimmed', async () => {
    jest.spyOn(router, 'replace').mockImplementation(() => {});
    await render(<S40Byo />);
    await fill('  https://api.openai.com/v1  ', '  sk-abc  ');
    await waitFor(() => expect(mockSetByo).toHaveBeenCalled());
    expect(mockSetByo).toHaveBeenCalledWith(expect.objectContaining({ baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-abc' }));
  });

  it.each(['api.openai.com/v1', 'ftp://x.com', 'javascript:alert(1)', '', '   '])('"%s" is not an address: the calm invalid line, nothing sent', async (url) => {
    await render(<S40Byo />);
    await fill(url);
    expect(await screen.findByText(S40_COPY.invalid)).toBeTruthy();
    expect(mockProbe).not.toHaveBeenCalled();
  });

  it('fixing an http:// address and saving again clears the refusal', async () => {
    jest.spyOn(router, 'replace').mockImplementation(() => {});
    await render(<S40Byo />);
    await fill('http://api.example.com/v1');
    await screen.findByText(/https:\/\//);
    await userEvent.clear(screen.getByTestId('s40-base-url'));
    await userEvent.type(screen.getByTestId('s40-base-url'), 'https://api.example.com/v1');
    await userEvent.press(screen.getByTestId('s40-save'));
    await waitFor(() => expect(mockProbe).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/without protection/)).toBeNull();
  });

  it('the refusal text does not use an em dash and never contains the key', async () => {
    await render(<S40Byo />);
    await fill('http://api.example.com/v1', 'sk-SECRET-KEY-123');
    const line = await screen.findByText(/without protection/);
    expect(String(line.props.children)).not.toMatch(/—/);
    expect(screen.queryAllByText(/sk-SECRET/)).toHaveLength(0);
  });

  it('the key is masked while typing and is never rendered anywhere as text, success or failure', async () => {
    mockProbe.mockResolvedValue({ ok: false });
    await render(<S40Byo />);
    await fill('https://api.example.com/v1', 'sk-SECRET-KEY-123');
    await screen.findByText(S40_COPY.invalid);
    expect(screen.getByTestId('s40-api-key').props.secureTextEntry).toBe(true);
    // The only place the value exists is the masked field itself; no text on the screen echoes it.
    expect(screen.queryAllByText(/sk-SECRET/)).toHaveLength(0);
  });

  it('a double tap on Save probes once', async () => {
    mockProbe.mockImplementation(() => new Promise((r) => setTimeout(() => r({ ok: true, transcription: true, model: 'm' }), 40)));
    jest.spyOn(router, 'replace').mockImplementation(() => {});
    await render(<S40Byo />);
    await userEvent.type(screen.getByTestId('s40-base-url'), 'https://api.example.com/v1');
    await userEvent.type(screen.getByTestId('s40-api-key'), 'k');
    const save = screen.getByTestId('s40-save');
    await fireEvent.press(save);
    await fireEvent.press(save);
    await waitFor(() => expect(mockSetByo).toHaveBeenCalled());
    expect(mockProbe).toHaveBeenCalledTimes(1);
  });
});
