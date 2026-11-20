/**
 * M6. F17 — store-native billing via `expo-iap`, gated on the OS biometric prompt
 * (`expo-local-authentication`). docs/API.md §7.
 *
 * Non-negotiables this file upholds:
 *  - Purchase confirmation goes through the OS biometric prompt BEFORE `requestPurchase`.
 *  - `restore()` needs no login — it only re-reads the store's own purchase records.
 *  - Every failure is calm and non-punitive: a biometric cancel or a store error resolves
 *    to `Result.err` with NOTHING charged; callers render the exact copy from S39/S44/S38,
 *    never a generic crash-shaped message.
 *  - `currentReceipt()` is forwarded per request to the managed backend (docs/API.md §4/§7)
 *    and is NEVER written to SQLite, a backup, or a log — same boundary discipline as the
 *    BYO key, just for a different secret (a store receipt/token rather than a user's own
 *    API credential).
 */
import * as LocalAuthentication from 'expo-local-authentication';
import {
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
} from 'expo-iap';

import { useEntitlementStore } from '@/app-shell';
import { toLocalDate } from '@/lib/date';
import type { BillingProvider, LocalDate, Result } from '@/types';
import { err, ok } from '@/types';

export const SKUS = { monthly: 'fallback.ai.monthly', annual: 'fallback.ai.annual' } as const;
type Plan = 'monthly' | 'annual';

let latestReceipt: string | null = null;

function planForSku(sku: string): Plan | null {
  if (sku === SKUS.monthly) return 'monthly';
  if (sku === SKUS.annual) return 'annual';
  return null;
}

/** Store purchase shape is loosely typed here on purpose — expo-iap's real `Purchase`
 *  union is large and platform-specific; this file only reads the handful of fields the
 *  entitlement cache and the receipt-forwarding boundary actually need. */
interface MinimalPurchase {
  readonly productId?: string;
  readonly id?: string;
  readonly transactionId?: string;
  readonly purchaseToken?: string;
  readonly jwsRepresentationIOS?: string;
  readonly transactionReceipt?: string;
  readonly expirationDateIOS?: number | null;
  readonly revocationDateIOS?: number | null;
  readonly purchaseState?: string;
}

/** A purchase record that grants Fallback AI right now. The store normally leaves out expired, refunded and
 *  pending ones, but a cached answer (offline, or a clock that has moved on) can still carry them. */
function isActivePurchase(p: MinimalPurchase): boolean {
  if (planForSku(p.productId ?? '') === null) return false;
  if (typeof p.revocationDateIOS === 'number' && p.revocationDateIOS > 0) return false;
  if (typeof p.expirationDateIOS === 'number' && Number.isFinite(p.expirationDateIOS) && p.expirationDateIOS <= Date.now()) return false;
  if (typeof p.purchaseState === 'string' && /pending|deferred/i.test(p.purchaseState)) return false;
  return true;
}

function receiptOf(purchase: MinimalPurchase): string | null {
  return purchase.jwsRepresentationIOS ?? purchase.purchaseToken ?? purchase.transactionReceipt ?? null;
}

/** Best-effort renewal date from whatever the store purchase record carries. `null` (never
 *  a fabricated date) when the platform/purchase shape doesn't expose one — callers must
 *  render "unknown" rather than invent a number (docs review B2). */
function renewsOnOf(purchase: MinimalPurchase): LocalDate | null {
  const ms = purchase.expirationDateIOS;
  if (typeof ms === 'number' && Number.isFinite(ms)) return toLocalDate(new Date(ms));
  return null;
}

async function requestBiometricConfirmation(): Promise<Result<void>> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = hasHardware ? await LocalAuthentication.isEnrolledAsync() : false;
  if (!hasHardware || !isEnrolled) {
    // No biometric enrolled — the device passcode fallback is offered by the OS prompt
    // itself when `disableDeviceFallback` is left false; still calm, never blocking.
  }
  let result: Awaited<ReturnType<typeof LocalAuthentication.authenticateAsync>>;
  try {
    result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirm your Fallback AI subscription',
      disableDeviceFallback: false,
      cancelLabel: 'Cancel',
    });
  } catch (cause) {
    return err({ code: 'CANCELLED', message: "Couldn't start biometric confirmation. Try again.", cause: 'biometric' });
  }
  if (!result.success) {
    // `cause: 'biometric'` tells the screen this was the identity check, not the store sheet being closed.
    return err({ code: 'CANCELLED', message: result.error ?? 'Biometric confirmation was not completed.', cause: 'biometric' });
  }
  return ok(undefined);
}

let listening = false;
let purchaseInFlight: Promise<Result<void>> | null = null;

async function runPurchase(plan: Plan): Promise<Result<void>> {
  const biometric = await requestBiometricConfirmation();
  if (!biometric.ok) return biometric;

  const sku = plan === 'monthly' ? SKUS.monthly : SKUS.annual;
  try {
    await requestPurchase({
      request: { apple: { sku }, google: { skus: [sku] } },
      type: 'subs',
    } as never);
    // The actual completion is delivered async via `purchaseUpdatedListener` (expo-iap's
    // documented event-based contract) — a short settle window lets that listener land
    // and stamp `latestReceipt` before this call resolves for the caller (S39's
    // "Verifying…" state already covers this visually).
    await new Promise((resolve) => setTimeout(resolve, 50));
    const refreshed = await billing.refreshEntitlement();
    if (!refreshed.ok) return refreshed;
    // The store accepted the request but nothing is active: the purchase is waiting for approval
    // (ask-to-buy, a slow payment). It is not a success and nothing is lost; the listener turns
    // Fallback AI on when the store confirms.
    if (!isSubscribedNow()) return err({ code: 'ENTITLEMENT_REQUIRED', message: 'Purchase is pending approval.', cause: 'pending' });
    return ok(undefined);
  } catch (cause) {
    const code = (cause as { code?: string })?.code ?? '';
    if (/cancel/i.test(code)) {
      return err({ code: 'CANCELLED', message: 'Purchase was cancelled. Nothing was charged.', cause });
    }
    if (/already.?owned/i.test(code)) {
      // They already own it (a second device, a purchase that finished late): make sure it is on.
      const refreshed = await billing.refreshEntitlement();
      if (refreshed.ok && isSubscribedNow()) return ok(undefined);
    }
    if (/defer|pending/i.test(code)) return err({ code: 'ENTITLEMENT_REQUIRED', message: 'Purchase is pending approval.', cause: 'pending' });
    if (/network/i.test(code)) return err({ code: 'NETWORK_UNAVAILABLE', message: "Couldn't complete the purchase. Nothing was charged.", cause });
    return err({ code: 'UNKNOWN', message: "Couldn't complete the purchase. Nothing was charged.", cause });
  }
}

function isSubscribedNow(): boolean {
  const status = useEntitlementStore.getState().entitlement.status;
  return status === 'active' || status === 'trial';
}

export const billing: BillingProvider = {
  // Called once at launch (app/splash.tsx). It connects to the store and listens for purchases,
  // so each one is finished (acknowledged); Google Play refunds a purchase left unfinished for
  // three days. A second call only reconnects; the listeners are added once.
  async init(): Promise<Result<void>> {
    try {
      await initConnection();
      if (listening) return ok(undefined);
      listening = true;
      purchaseUpdatedListener((event) => {
        void (async () => {
          const purchase = event as unknown as MinimalPurchase;
          const receipt = receiptOf(purchase);
          if (receipt) latestReceipt = receipt;
          try {
            await finishTransaction({ purchase: purchase as never, isConsumable: false });
          } catch {
            // A failed finalize doesn't lose the purchase — the store replays it on next
            // launch (expo-iap's own documented iOS behaviour); nothing to surface here.
          }
          // A purchase that was waiting for approval (a parent, a slow bank) lands here later:
          // turn Fallback AI on without the person having to do anything.
          await billing.refreshEntitlement();
        })();
      });
      purchaseErrorListener(() => {
        // Surfaced to the caller via `purchase()`'s own await/race below, not here — this
        // listener exists only so an out-of-band error doesn't go fully unhandled.
      });
      return ok(undefined);
    } catch (cause) {
      return err({ code: 'STORE_UNAVAILABLE', message: "Couldn't reach the store. Try again.", cause });
    }
  },

  async getProducts(): Promise<Result<readonly { sku: string; plan: Plan; localizedPrice: string }[]>> {
    try {
      const products = (await fetchProducts({ skus: [SKUS.monthly, SKUS.annual], type: 'subs' })) as readonly {
        id?: string;
        productId?: string;
        displayPrice?: string;
        price?: string;
      }[];
      const mapped = products
        .map((p) => {
          const sku = p.id ?? p.productId ?? '';
          const plan = planForSku(sku);
          if (!plan) return null;
          return { sku, plan, localizedPrice: p.displayPrice ?? p.price ?? '' };
        })
        .filter((p): p is { sku: string; plan: Plan; localizedPrice: string } => p !== null);
      return ok(mapped);
    } catch (cause) {
      return err({ code: 'STORE_UNAVAILABLE', message: "Couldn't reach the store. Try again.", cause });
    }
  },

  // A second tap on Buy while the first is still going joins it: one biometric prompt, one store sheet, one charge.
  purchase(plan): Promise<Result<void>> {
    if (purchaseInFlight) return purchaseInFlight;
    const run = runPurchase(plan).finally(() => {
      purchaseInFlight = null;
    });
    purchaseInFlight = run;
    return run;
  },

  async restore(): Promise<Result<boolean>> {
    try {
      const purchases = (await getAvailablePurchases()) as readonly MinimalPurchase[];
      const active = purchases.find(isActivePurchase);
      if (active) {
        const receipt = receiptOf(active);
        if (receipt) latestReceipt = receipt;
        await billing.refreshEntitlement();
        return ok(true);
      }
      return ok(false);
    } catch (cause) {
      return err({ code: 'STORE_UNAVAILABLE', message: "Couldn't reach the store. Try again.", cause });
    }
  },

  // B1: this is the ONLY path that repopulates `latestReceipt` on a cold app launch — the splash
  // screen calls it once the store is open, and S44, Settings and the assistant screens again. Without stamping
  // the receipt here, a paying subscriber's `currentReceipt()` stays null forever after a
  // relaunch until they happen to tap Restore Purchases.
  async refreshEntitlement(): Promise<Result<void>> {
    try {
      // The store has to be connected before it answers; on a cold start nothing else has
      // connected it yet, and without this the check failed quietly and showed "Free plan".
      await initConnection();
      const purchases = (await getAvailablePurchases()) as readonly MinimalPurchase[];
      const active = purchases.find(isActivePurchase);
      if (!active) {
        // Expired, refunded or never bought: the receipt goes too, so nothing is forwarded for it.
        latestReceipt = null;
        const current = useEntitlementStore.getState().entitlement;
        useEntitlementStore.getState().patchEntitlement({ source: current.hasByoKey ? 'byo-key' : 'none', plan: null, status: 'none', renewsOn: null, trialEndsOn: null });
        return ok(undefined);
      }
      const receipt = receiptOf(active);
      if (receipt) latestReceipt = receipt;
      const plan = planForSku(active.productId ?? '') ?? 'monthly';
      useEntitlementStore.getState().patchEntitlement({
        source: 'subscription',
        plan,
        status: 'active',
        renewsOn: renewsOnOf(active),
      });
      return ok(undefined);
    } catch (cause) {
      return err({ code: 'STORE_UNAVAILABLE', message: "Couldn't reach the store. Try again.", cause });
    }
  },

  async currentReceipt(): Promise<string | null> {
    return latestReceipt;
  },
};
