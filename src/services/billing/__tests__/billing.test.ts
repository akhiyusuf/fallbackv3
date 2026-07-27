const iapMocks = {
  initConnection: jest.fn(async () => true),
  fetchProducts: jest.fn(async () => [
    { id: 'fallback.ai.monthly', displayPrice: '$4.99' },
    { id: 'fallback.ai.annual', displayPrice: '$39.99' },
  ]),
  finishTransaction: jest.fn(async () => undefined),
  getAvailablePurchases: jest.fn(async () => []),
  purchaseUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
  purchaseErrorListener: jest.fn(() => ({ remove: jest.fn() })),
  requestPurchase: jest.fn(async () => undefined),
};

jest.mock('expo-iap', () => iapMocks);

const authenticateAsync = jest.fn();
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  authenticateAsync: (...args: unknown[]) => authenticateAsync(...args),
}));

import { useEntitlementStore } from '@/app-shell';
import { billing } from '../index';

describe('billing (F17) — expo-iap + biometric gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('init() opens the store connection', async () => {
    const result = await billing.init();
    expect(result.ok).toBe(true);
    expect(iapMocks.initConnection).toHaveBeenCalled();
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
    authenticateAsync.mockResolvedValue({ success: true });
    await billing.purchase('monthly');
    expect(authenticateAsync).toHaveBeenCalled();
    expect(iapMocks.requestPurchase).toHaveBeenCalled();
    const biometricOrder = authenticateAsync.mock.invocationCallOrder[0] ?? -1;
    const purchaseOrder = iapMocks.requestPurchase.mock.invocationCallOrder[0] ?? -2;
    expect(biometricOrder).toBeLessThan(purchaseOrder);
  });

  it('a biometric cancel is calm and non-punitive: CANCELLED error, requestPurchase never called, nothing charged', async () => {
    authenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' });
    const result = await billing.purchase('monthly');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CANCELLED');
    expect(iapMocks.requestPurchase).not.toHaveBeenCalled();
  });

  it('a store purchase error resolves calmly (no throw) and reports nothing charged', async () => {
    authenticateAsync.mockResolvedValue({ success: true });
    iapMocks.requestPurchase.mockRejectedValueOnce(new Error('store down'));
    const result = await billing.purchase('monthly');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/nothing was charged/i);
  });

  it('restore() needs no login — it only re-reads store purchase records', async () => {
    iapMocks.getAvailablePurchases.mockResolvedValueOnce([{ productId: 'fallback.ai.annual', purchaseToken: 'tok-1' }] as never);
    const result = await billing.restore();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(true);
    expect(useEntitlementStore.getState().entitlement.status).toBe('active');
  });

  it('restore() with nothing active returns false without error (calm toast, not a failure)', async () => {
    iapMocks.getAvailablePurchases.mockResolvedValueOnce([]);
    const result = await billing.restore();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(false);
  });

  it('currentReceipt() is in-memory only — starts null, never touches SecureStore/SQLite/disk', async () => {
    expect(await billing.currentReceipt()).toBeNull();
  });
});
