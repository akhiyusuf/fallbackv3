/**
 * Root-level Jest manual mock for `expo-iap` (M6, F17 billing).
 *
 * WHY THIS EXISTS (same class of gap `docs/MODULES.md`'s "House testing pattern" already
 * names for `lucide-react-native`/`standard-navigation`): `expo-iap`'s `package.json` points
 * `main` at `build/index.js`, but that file is raw ESM (`import`/`export`), not CJS, and it
 * is not in `jest.config.js`'s `transformIgnorePatterns` whitelist. An in-test-file
 * `jest.mock('expo-iap', factory, { virtual: true })` looked like a fix but silently breaks
 * as soon as the mock is consumed through a re-export/indirection (e.g. from
 * `src/services/billing/index.ts` rather than the test file itself) — Jest keys a *virtual*
 * mock by the requesting file's directory, so the same specifier resolves to two different
 * registry entries and the indirect one comes back `undefined`.
 *
 * A Jest **manual mock** at `<rootDir>/__mocks__/<package>.js` sidesteps this entirely: Jest
 * substitutes this file for every `require('expo-iap')` call, from any file, resolved through
 * the real module-resolution algorithm rather than a virtual key — exactly the same mechanism
 * `jest-expo`'s own built-in native-module mocks use. No test file needs `jest.mock('expo-iap')`
 * at all; this is automatic for a node_modules package once this file exists.
 *
 * Recommended follow-up (flagged in this module's builder report): promote this into
 * `jest.config.js`'s `transformIgnorePatterns`/`moduleNameMapper` the same way the lucide fix
 * was promoted, so a future contributor doesn't have to rediscover this. Left as a root-level
 * manual mock for now because `jest.config.js` is architect-frozen.
 */
module.exports = {
  initConnection: jest.fn(async () => true),
  endConnection: jest.fn(async () => true),
  fetchProducts: jest.fn(async () => []),
  getAvailablePurchases: jest.fn(async () => []),
  getActiveSubscriptions: jest.fn(async () => []),
  hasActiveSubscriptions: jest.fn(async () => false),
  getStorefront: jest.fn(async () => 'US'),
  requestPurchase: jest.fn(async () => undefined),
  finishTransaction: jest.fn(async () => undefined),
  restorePurchases: jest.fn(async () => undefined),
  deepLinkToSubscriptions: jest.fn(async () => undefined),
  validateReceipt: jest.fn(async () => ({ isValid: true })),
  verifyPurchase: jest.fn(async () => ({ isValid: true })),
  verifyPurchaseWithProvider: jest.fn(async () => ({ isValid: true })),
  purchaseUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
  purchaseErrorListener: jest.fn(() => ({ remove: jest.fn() })),
  promotedProductListenerIOS: jest.fn(() => ({ remove: jest.fn() })),
  userChoiceBillingListenerAndroid: jest.fn(() => ({ remove: jest.fn() })),
  developerProvidedBillingListenerAndroid: jest.fn(() => ({ remove: jest.fn() })),
  subscriptionBillingIssueListener: jest.fn(() => ({ remove: jest.fn() })),
  emitter: { addListener: jest.fn(() => ({ remove: jest.fn() })) },
  OpenIapEvent: {
    PurchaseUpdated: 'purchase-updated',
    PurchaseError: 'purchase-error',
    PromotedProductIOS: 'promoted-product-ios',
    UserChoiceBillingAndroid: 'user-choice-billing-android',
    DeveloperProvidedBillingAndroid: 'developer-provided-billing-android',
    SubscriptionBillingIssue: 'subscription-billing-issue',
  },
};
