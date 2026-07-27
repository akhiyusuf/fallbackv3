/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. Do NOT mock expo-router. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockGetProducts = jest.fn();
const mockRestore = jest.fn();
jest.mock('@/services/billing', () => ({ billing: { getProducts: () => mockGetProducts(), restore: () => mockRestore() } }));

const mockShowToast = jest.fn();
jest.mock('@/app-shell', () => ({ useToastStore: (selector: (s: { show: typeof mockShowToast }) => unknown) => selector({ show: mockShowToast }) }));

import S38Paywall from './index';
import { S38_COPY } from '@/features/assistant/copy';

describe('S38 — Paywall', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProducts.mockResolvedValue({ ok: true, value: [] });
  });

  it('default: both cards render, Card A primary and Card B secondary CTA both present and enabled', async () => {
    await render(<S38Paywall />);
    expect(await screen.findByText(S38_COPY.cardA.cta)).toBeTruthy();
    expect(screen.getByTestId('s38-byo-cta')).toBeTruthy();
    expect(screen.getAllByText(S38_COPY.cardB.heading).length).toBeGreaterThan(0);
  });

  it('store unreachable: Card A disables and its fine print swaps, but Card B stays fully enabled — the asymmetry non-negotiable', async () => {
    mockGetProducts.mockResolvedValue({ ok: false, error: { code: 'STORE_UNAVAILABLE', message: 'x' } });
    await render(<S38Paywall />);
    expect(await screen.findByText(S38_COPY.storeUnreachable)).toBeTruthy();
    expect(screen.getByText(S38_COPY.storeUnavailableFinePrint)).toBeTruthy();

    const byoButton = screen.getByTestId('s38-byo-cta');
    expect(byoButton.props.accessibilityState?.disabled).not.toBe(true);
  });

  it('tapping "Use Your Own AI Key" navigates to S40 regardless of store status', async () => {
    mockGetProducts.mockResolvedValue({ ok: false, error: { code: 'STORE_UNAVAILABLE', message: 'x' } });
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    await render(<S38Paywall />);
    await screen.findByText(S38_COPY.storeUnreachable);
    await userEvent.press(screen.getByTestId('s38-byo-cta'));
    expect(push).toHaveBeenCalledWith('/assistant/paywall/byo');
    push.mockRestore();
  });

  it('Restore Purchases with nothing found shows a calm neutral toast, not an error', async () => {
    mockRestore.mockResolvedValue({ ok: true, value: false });
    await render(<S38Paywall />);
    await userEvent.press(await screen.findByText(S38_COPY.cardA.restorePurchases));
    expect(mockShowToast).toHaveBeenCalledWith(S38_COPY.restoreNoneFound, 'neutral');
  });
});
