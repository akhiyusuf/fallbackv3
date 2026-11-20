/**
 * Round 2 edge pass: billing as a person would meet it. expo-iap and the biometric prompt are mocked;
 * everything else (the entitlement store, the receipt, the in-flight guard) is the real code.
 * The module is re-required for every test so its receipt and listener state start clean.
 */
const mockAuthenticateAsync = jest.fn();
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  authenticateAsync: (...args: unknown[]) => mockAuthenticateAsync(...args),
}));

type Iap = Record<string, jest.Mock>;
let iap: Iap;
let billing: typeof import('./index').billing;
let useEntitlementStore: typeof import('@/app-shell').useEntitlementStore;

const DAY = 24 * 60 * 60 * 1000;
const MONTHLY = 'fallback.ai.monthly';
const ANNUAL = 'fallback.ai.annual';

function resetEntitlement(over: Record<string, unknown> = {}) {
  useEntitlementStore.getState().setEntitlement({
    source: 'none',
    plan: null,
    status: 'none',
    renewsOn: null,
    trialEndsOn: null,
    hasByoKey: false,
    byoSupportsTranscription: false,
    ...over,
  } as never);
}
const ent = () => useEntitlementStore.getState().entitlement;

beforeEach(() => {
  jest.resetModules();
  iap = require('expo-iap') as Iap;
  billing = require('./index').billing;
  useEntitlementStore = require('@/app-shell').useEntitlementStore;
  mockAuthenticateAsync.mockReset().mockResolvedValue({ success: true });
  iap.getAvailablePurchases!.mockReset().mockResolvedValue([]);
  iap.requestPurchase!.mockReset().mockResolvedValue(undefined);
  iap.initConnection!.mockReset().mockResolvedValue(true);
  iap.finishTransaction!.mockReset().mockResolvedValue(undefined);
  resetEntitlement();
});

describe('purchase', () => {
  it('success: active entitlement, plan, renewal date and the receipt are all set', async () => {
    iap.getAvailablePurchases!.mockResolvedValue([{ productId: ANNUAL, purchaseToken: 'tok-1', expirationDateIOS: Date.now() + 365 * DAY }]);
    const r = await billing.purchase('annual');
    expect(r.ok).toBe(true);
    expect(ent()).toMatchObject({ source: 'subscription', plan: 'annual', status: 'active' });
    expect(ent().renewsOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await billing.currentReceipt()).toBe('tok-1');
  });

  it('the store sheet closed by the person: CANCELLED without the biometric cause, nothing changes', async () => {
    iap.requestPurchase!.mockRejectedValue({ code: 'E_USER_CANCELLED' });
    const r = await billing.purchase('monthly');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('CANCELLED');
    expect(r.error.cause).not.toBe('biometric');
    expect(ent().status).toBe('none');
    expect(await billing.currentReceipt()).toBeNull();
  });

  it('the code spelled "user-cancelled" is also a cancel, not an error', async () => {
    iap.requestPurchase!.mockRejectedValue({ code: 'user-cancelled' });
    const r = await billing.purchase('monthly');
    expect(!r.ok && r.error.code).toBe('CANCELLED');
  });

  it('a biometric cancel never reaches the store', async () => {
    mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' });
    const r = await billing.purchase('monthly');
    expect(!r.ok && r.error.cause).toBe('biometric');
    expect(iap.requestPurchase).not.toHaveBeenCalled();
  });

  it('a biometric prompt that throws is a calm biometric CANCELLED, never an exception', async () => {
    mockAuthenticateAsync.mockRejectedValue(new Error('no activity'));
    const r = await billing.purchase('monthly');
    expect(!r.ok && r.error.code).toBe('CANCELLED');
    expect(!r.ok && r.error.cause).toBe('biometric');
    expect(iap.requestPurchase).not.toHaveBeenCalled();
  });

  it('pending (ask to buy): the store accepts but nothing is active, so it is NOT reported as success', async () => {
    const r = await billing.purchase('monthly');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.cause).toBe('pending');
    expect(ent().status).toBe('none');
  });

  it('pending reported as a thrown deferred-payment error is the same calm pending result', async () => {
    iap.requestPurchase!.mockRejectedValue({ code: 'deferred-payment' });
    const r = await billing.purchase('monthly');
    expect(!r.ok && r.error.cause).toBe('pending');
  });

  it('a purchase record still marked pending does not grant access', async () => {
    iap.getAvailablePurchases!.mockResolvedValue([{ productId: MONTHLY, purchaseToken: 'p', purchaseState: 'pending' }]);
    const r = await billing.purchase('monthly');
    expect(!r.ok && r.error.cause).toBe('pending');
    expect(ent().status).toBe('none');
  });

  it('a pending purchase that is approved later turns Fallback AI on by itself (the listener refreshes)', async () => {
    await billing.init();
    const onPurchase = iap.purchaseUpdatedListener!.mock.calls[0]![0] as (p: unknown) => void;
    iap.getAvailablePurchases!.mockResolvedValue([{ productId: MONTHLY, purchaseToken: 'late' }]);
    onPurchase({ productId: MONTHLY, purchaseToken: 'late' });
    await new Promise((r) => setTimeout(r, 20));
    expect(iap.finishTransaction).toHaveBeenCalledTimes(1);
    expect(ent().status).toBe('active');
    expect(await billing.currentReceipt()).toBe('late');
  });

  it('network failure: NETWORK_UNAVAILABLE, nothing charged, the earlier entitlement is untouched', async () => {
    resetEntitlement({ source: 'subscription', plan: 'monthly', status: 'active' });
    iap.requestPurchase!.mockRejectedValue({ code: 'network-error' });
    const r = await billing.purchase('annual');
    expect(!r.ok && r.error.code).toBe('NETWORK_UNAVAILABLE');
    expect(!r.ok && r.error.message).toMatch(/Nothing was charged/);
    expect(ent()).toMatchObject({ plan: 'monthly', status: 'active' });
  });

  it('an unknown store error is calm and says nothing was charged', async () => {
    iap.requestPurchase!.mockRejectedValue(new Error('boom'));
    const r = await billing.purchase('monthly');
    expect(!r.ok && r.error.code).toBe('UNKNOWN');
    expect(!r.ok && r.error.message).toMatch(/Nothing was charged/);
  });

  it('already owned (bought on another device, finished late): turns it on and succeeds', async () => {
    iap.requestPurchase!.mockRejectedValue({ code: 'already-owned' });
    iap.getAvailablePurchases!.mockResolvedValue([{ productId: MONTHLY, purchaseToken: 'own' }]);
    const r = await billing.purchase('monthly');
    expect(r.ok).toBe(true);
    expect(ent().status).toBe('active');
  });

  it('already owned but the store shows nothing active stays an error', async () => {
    iap.requestPurchase!.mockRejectedValue({ code: 'already-owned' });
    const r = await billing.purchase('monthly');
    expect(r.ok).toBe(false);
  });

  it('after the store connection fails while confirming, the result is an error, not a fake success', async () => {
    iap.getAvailablePurchases!.mockRejectedValue(new Error('offline'));
    const r = await billing.purchase('monthly');
    expect(r.ok).toBe(false);
  });

  it('double tap on Buy: one biometric prompt, one store request, both callers get the same answer', async () => {
    iap.getAvailablePurchases!.mockResolvedValue([{ productId: MONTHLY, purchaseToken: 't' }]);
    const [a, b] = await Promise.all([billing.purchase('monthly'), billing.purchase('monthly')]);
    expect(mockAuthenticateAsync).toHaveBeenCalledTimes(1);
    expect(iap.requestPurchase).toHaveBeenCalledTimes(1);
    expect(a.ok && b.ok).toBe(true);
  });

  it('after a finished purchase the next Buy starts fresh (the guard is released, also after a failure)', async () => {
    iap.requestPurchase!.mockRejectedValueOnce({ code: 'E_USER_CANCELLED' });
    await billing.purchase('monthly');
    iap.getAvailablePurchases!.mockResolvedValue([{ productId: MONTHLY, purchaseToken: 't' }]);
    const again = await billing.purchase('monthly');
    expect(again.ok).toBe(true);
    expect(iap.requestPurchase).toHaveBeenCalledTimes(2);
  });

  it('sends the right SKU for each plan', async () => {
    await billing.purchase('annual');
    expect(JSON.stringify(iap.requestPurchase!.mock.calls[0])).toContain(ANNUAL);
    await billing.purchase('monthly');
    expect(JSON.stringify(iap.requestPurchase!.mock.calls[1])).toContain(MONTHLY);
  });
});

describe('restore purchases', () => {
  it('none: ok(false), entitlement stays free', async () => {
    const r = await billing.restore();
    expect(r).toEqual({ ok: true, value: false });
    expect(ent().status).toBe('none');
  });

  it('one: ok(true), entitlement active with the right plan', async () => {
    iap.getAvailablePurchases!.mockResolvedValue([{ productId: ANNUAL, purchaseToken: 'r1' }]);
    const r = await billing.restore();
    expect(r).toEqual({ ok: true, value: true });
    expect(ent()).toMatchObject({ plan: 'annual', status: 'active' });
  });

  it('only an expired one: nothing to restore (false), not a false "restored"', async () => {
    iap.getAvailablePurchases!.mockResolvedValue([{ productId: MONTHLY, purchaseToken: 'old', expirationDateIOS: Date.now() - DAY }]);
    const r = await billing.restore();
    expect(r).toEqual({ ok: true, value: false });
    expect(ent().status).toBe('none');
  });

  it('a record for a product that is not ours is ignored', async () => {
    iap.getAvailablePurchases!.mockResolvedValue([{ productId: 'other.app.sku', purchaseToken: 'x' }]);
    expect(await billing.restore()).toEqual({ ok: true, value: false });
  });

  it('with an expired record and a live one, the live one wins', async () => {
    iap.getAvailablePurchases!.mockResolvedValue([
      { productId: MONTHLY, purchaseToken: 'old', expirationDateIOS: Date.now() - DAY },
      { productId: ANNUAL, purchaseToken: 'new', expirationDateIOS: Date.now() + 30 * DAY },
    ]);
    expect(await billing.restore()).toEqual({ ok: true, value: true });
    expect(ent().plan).toBe('annual');
    expect(await billing.currentReceipt()).toBe('new');
  });

  it('the store cannot be reached: STORE_UNAVAILABLE, not "nothing to restore"', async () => {
    iap.getAvailablePurchases!.mockRejectedValue(new Error('offline'));
    const r = await billing.restore();
    expect(!r.ok && r.error.code).toBe('STORE_UNAVAILABLE');
  });
});

describe('entitlement over time', () => {
  it('expiry: a record whose end date has passed is not active, the receipt is dropped', async () => {
    iap.getAvailablePurchases!.mockResolvedValueOnce([{ productId: MONTHLY, purchaseToken: 'live', expirationDateIOS: Date.now() + DAY }]);
    await billing.refreshEntitlement();
    expect(ent().status).toBe('active');
    expect(await billing.currentReceipt()).toBe('live');
    iap.getAvailablePurchases!.mockResolvedValueOnce([{ productId: MONTHLY, purchaseToken: 'live', expirationDateIOS: Date.now() - 1000 }]);
    await billing.refreshEntitlement();
    expect(ent()).toMatchObject({ status: 'none', plan: null, source: 'none', renewsOn: null });
    expect(await billing.currentReceipt()).toBeNull();
  });

  it('refund / revoke: the record disappears, or carries a revocation date: both end access', async () => {
    iap.getAvailablePurchases!.mockResolvedValueOnce([{ productId: MONTHLY, purchaseToken: 'a' }]);
    await billing.refreshEntitlement();
    expect(ent().status).toBe('active');
    iap.getAvailablePurchases!.mockResolvedValueOnce([]);
    await billing.refreshEntitlement();
    expect(ent().status).toBe('none');
    iap.getAvailablePurchases!.mockResolvedValueOnce([{ productId: MONTHLY, purchaseToken: 'a', revocationDateIOS: Date.now() - DAY }]);
    await billing.refreshEntitlement();
    expect(ent().status).toBe('none');
    expect(await billing.currentReceipt()).toBeNull();
  });

  it('losing the subscription does not erase a BYO key: source falls back to byo-key and hasByoKey stays', async () => {
    resetEntitlement({ source: 'subscription', plan: 'monthly', status: 'active', hasByoKey: true });
    await billing.refreshEntitlement();
    expect(ent()).toMatchObject({ status: 'none', source: 'byo-key', hasByoKey: true });
  });

  it('opened offline with a cached entitlement: a failed refresh keeps what is held and says STORE_UNAVAILABLE', async () => {
    resetEntitlement({ source: 'subscription', plan: 'annual', status: 'active', renewsOn: '2027-01-01' });
    iap.initConnection!.mockRejectedValue(new Error('no network'));
    const r = await billing.refreshEntitlement();
    expect(!r.ok && r.error.code).toBe('STORE_UNAVAILABLE');
    expect(ent()).toMatchObject({ status: 'active', plan: 'annual', renewsOn: '2027-01-01' });
  });

  it('the same when the store answers with an error after connecting', async () => {
    resetEntitlement({ source: 'subscription', plan: 'monthly', status: 'active' });
    iap.getAvailablePurchases!.mockRejectedValue(new Error('service unavailable'));
    expect((await billing.refreshEntitlement()).ok).toBe(false);
    expect(ent().status).toBe('active');
  });

  it('a record with no end date shows no renewal date, never an invented one', async () => {
    iap.getAvailablePurchases!.mockResolvedValue([{ productId: MONTHLY, purchaseToken: 'x' }]);
    await billing.refreshEntitlement();
    expect(ent().renewsOn).toBeNull();
  });

  it('a garbage end date (NaN) is ignored instead of crashing', async () => {
    iap.getAvailablePurchases!.mockResolvedValue([{ productId: MONTHLY, purchaseToken: 'x', expirationDateIOS: Number.NaN }]);
    expect((await billing.refreshEntitlement()).ok).toBe(true);
    expect(ent().renewsOn).toBeNull();
  });

  it('an unknown product id never becomes a plan', async () => {
    iap.getAvailablePurchases!.mockResolvedValue([{ productId: 'weird', purchaseToken: 'x' }]);
    await billing.refreshEntitlement();
    expect(ent().status).toBe('none');
  });
});

describe('store connection and products', () => {
  it('init failure is STORE_UNAVAILABLE, not an exception', async () => {
    iap.initConnection!.mockRejectedValue(new Error('no play services'));
    const r = await billing.init();
    expect(!r.ok && r.error.code).toBe('STORE_UNAVAILABLE');
  });

  it('init twice adds the listeners once', async () => {
    await billing.init();
    await billing.init();
    expect(iap.purchaseUpdatedListener).toHaveBeenCalledTimes(1);
    expect(iap.purchaseErrorListener).toHaveBeenCalledTimes(1);
  });

  it('a failing finishTransaction does not throw out of the listener', async () => {
    await billing.init();
    iap.finishTransaction!.mockRejectedValue(new Error('x'));
    iap.getAvailablePurchases!.mockResolvedValue([{ productId: MONTHLY, purchaseToken: 't' }]);
    const onPurchase = iap.purchaseUpdatedListener!.mock.calls[0]![0] as (p: unknown) => void;
    expect(() => onPurchase({ productId: MONTHLY, purchaseToken: 't' })).not.toThrow();
    await new Promise((r) => setTimeout(r, 20));
    expect(await billing.currentReceipt()).toBe('t');
  });

  it('products: an unknown SKU is left out and a missing price becomes an empty string', async () => {
    iap.fetchProducts!.mockResolvedValue([{ id: 'zzz', displayPrice: '$1' }, { id: MONTHLY }]);
    const r = await billing.getProducts();
    expect(r).toEqual({ ok: true, value: [{ sku: MONTHLY, plan: 'monthly', localizedPrice: '' }] });
  });

  it('products: the store failing is STORE_UNAVAILABLE', async () => {
    iap.fetchProducts!.mockRejectedValue(new Error('x'));
    const r = await billing.getProducts();
    expect(!r.ok && r.error.code).toBe('STORE_UNAVAILABLE');
  });
});

describe('the receipt', () => {
  it('is never logged, whatever fails', async () => {
    const spies = (['log', 'warn', 'error', 'info'] as const).map((k) => jest.spyOn(console, k).mockImplementation(() => {}));
    iap.getAvailablePurchases!.mockResolvedValue([{ productId: MONTHLY, purchaseToken: 'SECRET-RECEIPT-123' }]);
    iap.finishTransaction!.mockRejectedValue(new Error('x'));
    await billing.init();
    await billing.purchase('monthly');
    await billing.restore();
    iap.getAvailablePurchases!.mockRejectedValue(new Error('offline'));
    await billing.refreshEntitlement();
    const logged = spies.flatMap((s) => s.mock.calls).map((c) => JSON.stringify(c)).join('\n');
    expect(logged).not.toContain('SECRET-RECEIPT-123');
    spies.forEach((s) => s.mockRestore());
  });

  it('prefers the signed JWS on iOS, then the Android token, then the legacy receipt', async () => {
    iap.getAvailablePurchases!.mockResolvedValue([{ productId: MONTHLY, jwsRepresentationIOS: 'jws', purchaseToken: 'tok', transactionReceipt: 'rcpt' }]);
    await billing.refreshEntitlement();
    expect(await billing.currentReceipt()).toBe('jws');
  });
});
