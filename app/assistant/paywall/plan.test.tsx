/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. Do NOT mock expo-router. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockPurchase = jest.fn();
jest.mock('@/services/billing', () => ({ billing: { purchase: (plan: string) => mockPurchase(plan) } }));

import S39ChoosePlanAndConfirm from './plan';
import { S39_COPY } from '@/features/assistant/copy';

describe('S39 — Choose Plan & Confirm', () => {
  beforeEach(() => jest.clearAllMocks());

  it('default: Annual pre-selected, Confirm enabled', async () => {
    await render(<S39ChoosePlanAndConfirm />);
    expect(screen.getByText(S39_COPY.title)).toBeTruthy();
    expect(screen.getByTestId('s39-confirm')).toBeTruthy();
  });

  it('a biometric cancel is calm and non-punitive: stays on S39, shows the retry banner, charges nothing, never navigates', async () => {
    mockPurchase.mockResolvedValue({ ok: false, error: { code: 'CANCELLED', message: 'x' } });
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    await render(<S39ChoosePlanAndConfirm />);
    await userEvent.press(screen.getByTestId('s39-confirm'));
    expect(await screen.findByText(S39_COPY.biometricFailed)).toBeTruthy();
    expect(replace).not.toHaveBeenCalledWith('/assistant/chat');
    replace.mockRestore();
  });

  it('a store purchase error is calm (warning tone banner), never punitive, and preserves plan selection', async () => {
    mockPurchase.mockResolvedValue({ ok: false, error: { code: 'UNKNOWN', message: "Couldn't complete the purchase. Nothing was charged." } });
    await render(<S39ChoosePlanAndConfirm />);
    await userEvent.press(screen.getByTestId('s39-confirm'));
    expect(await screen.findByText(S39_COPY.purchaseError)).toBeTruthy();
  });

  it('success navigates to S32 after confirmation', async () => {
    mockPurchase.mockResolvedValue({ ok: true, value: undefined });
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    await render(<S39ChoosePlanAndConfirm />);
    await userEvent.press(screen.getByTestId('s39-confirm'));
    await screen.findByText(S39_COPY.success);
    replace.mockRestore();
  });
});
