/**
 * `expo-iap` is mocked via the root-level manual mock `__mocks__/expo-iap.js` — see that
 * file's header for why an in-file `jest.mock('expo-iap', factory, { virtual: true })`
 * silently breaks once the mock is consumed indirectly (as it is here, through
 * `../index.ts`). No `jest.mock('expo-iap')` call is needed in this file.
 */
import * as ExpoIap from 'expo-iap';

const mockInitConnection = ExpoIap.initConnection as jest.Mock;
const mockFetchProducts = ExpoIap.fetchProducts as jest.Mock;
const mockGetAvailablePurchases = ExpoIap.getAvailablePurchases as jest.Mock;
const mockRequestPurchase = ExpoIap.requestPurchase as jest.Mock;

const mockAuthenticateAsync = jest.fn();
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  authenticateAsync: (...args: unknown[]) => mockAuthenticateAsync(...args),
}));

import { useEntitlementStore } from '@/app-shell';
import { billing } from '../index';

describe('billing (F17) — expo-iap + biometric gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchProducts.mockResolvedValue([
      { id: 'fallback.ai.monthly', displayPrice: '$4.99' },
      { id: 'fallback.ai.annual', displayPrice: '$39.99' },
    ]);
    mockGetAvailablePurchases.mockResolvedValue([]);
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

  // Runs first — `latestReceipt` is module-level state in `../index.ts` with no reset hook,
  // so this must execute before any purchase()/restore() call in this same file mutates it.
  it('currentReceipt() is in-memory only — starts null, never touches SecureStore/SQLite/disk', async () => {
    expect(await billing.currentReceipt()).toBeNull();
  });

  it('init() opens the store connection', async () => {
    const result = await billing.init();
    expect(result.ok).toBe(true);
    expect(mockInitConnection).toHaveBeenCalled();
  });

  it('getProducts() maps the two SKUs to {sku, plan, localizedPrice}', async () => {
    const result = await billing.getProducts();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([
      { sku: 'fallback.ai.monthly', plan: 'monthly', localizedPrice: '$4.99' },
      { sku: 'fallback.ai.annual', plan: 'annual', localizedPrice: '$39.99' },
    ]);
  });

  it('purchase() requires biometric confirmation BEFORE requestPurchase is called', async () => {
    mockAuthenticateAsync.mockResolvedValue({ success: true });
    await billing.purchase('monthly');
    expect(mockAuthenticateAsync).toHaveBeenCalled();
    expect(mockRequestPurchase).toHaveBeenCalled();
    const biometricOrder = mockAuthenticateAsync.mock.invocationCallOrder[0] ?? -1;
    const purchaseOrder = mockRequestPurchase.mock.invocationCallOrder[0] ?? -2;
    expect(biometricOrder).toBeLessThan(purchaseOrder);
  });

  it('a biometric cancel is calm and non-punitive: CANCELLED error, requestPurchase never called, nothing charged', async () => {
    mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' });
    const result = await billing.purchase('monthly');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CANCELLED');
    expect(mockRequestPurchase).not.toHaveBeenCalled();
  });

  it('a store purchase error resolves calmly (no throw) and reports nothing charged', async () => {
    mockAuthenticateAsync.mockResolvedValue({ success: true });
    mockRequestPurchase.mockRejectedValueOnce(new Error('store down'));
    const result = await billing.purchase('monthly');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/nothing was charged/i);
  });

  it('restore() needs no login — it only re-reads store purchase records', async () => {
    mockGetAvailablePurchases.mockResolvedValue([{ productId: 'fallback.ai.annual', purchaseToken: 'tok-1' }]);
    const result = await billing.restore();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(true);
    expect(useEntitlementStore.getState().entitlement.status).toBe('active');
  });

  it('restore() with nothing active returns false without error (calm toast, not a failure)', async () => {
    mockGetAvailablePurchases.mockResolvedValueOnce([]);
    const result = await billing.restore();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(false);
  });

  it('B1 — refreshEntitlement() alone (no purchase()/restore()) repopulates currentReceipt() from the active purchase, e.g. after a cold relaunch', async () => {
    mockGetAvailablePurchases.mockResolvedValue([{ productId: 'fallback.ai.monthly', purchaseToken: 'tok-after-relaunch' }]);
    const result = await billing.refreshEntitlement();
    expect(result.ok).toBe(true);
    expect(mockRequestPurchase).not.toHaveBeenCalled();
    expect(await billing.currentReceipt()).toBe('tok-after-relaunch');
  });

  it('B1/B2 — refreshEntitlement() populates renewsOn from the purchase record when the platform exposes one, never a fabricated date', async () => {
    mockGetAvailablePurchases.mockResolvedValue([
      { productId: 'fallback.ai.annual', purchaseToken: 'tok-2', expirationDateIOS: new Date(2026, 7, 20, 12, 0, 0).getTime() },
    ]);
    await billing.refreshEntitlement();
    expect(useEntitlementStore.getState().entitlement.renewsOn).toBe('2026-08-20');
  });
});
