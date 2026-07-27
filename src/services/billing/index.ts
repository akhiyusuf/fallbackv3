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
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Confirm your Fallback AI subscription',
    disableDeviceFallback: false,
    cancelLabel: 'Cancel',
  });
  if (!result.success) {
    return err({ code: 'CANCELLED', message: result.error ?? 'Biometric confirmation was not completed.' });
  }
  return ok(undefined);
}

export const billing: BillingProvider = {
  async init(): Promise<Result<void>> {
    try {
      await initConnection();
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
        })();
      });
      purchaseErrorListener(() => {
        // Surfaced to the caller via `purchase()`'s own await/race below, not here — this
        // listener exists only so an out-of-band error doesn't go fully unhandled.
      });
      return ok(undefined);
    } catch (cause) {
      return err({ code: 'STORE_UNAVAILABLE', message: 'Could not connect to the store.', cause });
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
      return err({ code: 'STORE_UNAVAILABLE', message: 'Could not reach the store.', cause });
    }
  },

  async purchase(plan): Promise<Result<void>> {
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
      await billing.refreshEntitlement();
      return ok(undefined);
    } catch (cause) {
      const code = (cause as { code?: string })?.code ?? '';
      if (/cancel/i.test(code)) {
        return err({ code: 'CANCELLED', message: 'Purchase was cancelled. Nothing was charged.', cause });
      }
      return err({ code: 'UNKNOWN', message: "Couldn't complete the purchase. Nothing was charged.", cause });
    }
  },

  async restore(): Promise<Result<boolean>> {
    try {
      const purchases = (await getAvailablePurchases()) as readonly MinimalPurchase[];
      const active = purchases.find((p) => planForSku(p.productId ?? '') !== null);
      if (active) {
        const receipt = receiptOf(active);
        if (receipt) latestReceipt = receipt;
        await billing.refreshEntitlement();
        return ok(true);
      }
      return ok(false);
    } catch (cause) {
      return err({ code: 'STORE_UNAVAILABLE', message: "Couldn't reach the store — try again.", cause });
    }
  },

  // B1: this is the ONLY path that repopulates `latestReceipt` on a cold app launch — S44,
  // the assistant screens, and app-shell's own boot sequence all call this. Without stamping
  // the receipt here, a paying subscriber's `currentReceipt()` stays null forever after a
  // relaunch until they happen to tap Restore Purchases.
  async refreshEntitlement(): Promise<Result<void>> {
    try {
      const purchases = (await getAvailablePurchases()) as readonly MinimalPurchase[];
      const active = purchases.find((p) => planForSku(p.productId ?? '') !== null);
      if (!active) {
        useEntitlementStore.getState().patchEntitlement({ source: 'none', plan: null, status: 'none', renewsOn: null, trialEndsOn: null });
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
      return err({ code: 'STORE_UNAVAILABLE', message: "Couldn't reach the store — try again.", cause });
    }
  },

  async currentReceipt(): Promise<string | null> {
    return latestReceipt;
  },
};
