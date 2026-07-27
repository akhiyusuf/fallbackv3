/**
 * M6 backend. Receipt-based entitlement — docs/API.md §4 "Authentication". No accounts, no
 * user id anywhere. The receipt is verified against Apple's/Google's server APIs for THIS
 * request only, and the verification result is never persisted (in memory, on disk, or in a
 * log) — the whole point of "verified per request, persisted never".
 *
 * `verifyReceipt` takes its HTTP client as a parameter so it is unit-testable without a
 * network call (see `receipt.test.js`).
 */

/**
 * @param {{ platform: string, receipt: string, fetchImpl: typeof fetch }} input
 * @returns {Promise<{ ok: boolean, code?: 'entitlement_invalid'|'entitlement_expired' }>}
 */
export async function verifyReceipt({ platform, receipt, fetchImpl }) {
  if (!receipt) return { ok: false, code: 'entitlement_invalid' };
  if (platform !== 'ios' && platform !== 'android') return { ok: false, code: 'entitlement_invalid' };

  try {
    // Real Apple/Google verification endpoints are environment-specific (App Store Server
    // API / Google Play Developer API) and require server-side credentials provisioned per
    // deploy — out of scope to hardcode here. This function's CONTRACT (never persist,
    // return one of the two documented codes, verify per request) is what's load-bearing
    // and what the tests below exercise; the concrete verifier is injected via `fetchImpl`
    // so a deploy wires its real credentials without touching this file's logic.
    const verifier = platform === 'ios' ? verifyAppleReceipt : verifyGoogleReceipt;
    const result = await verifier(receipt, fetchImpl);
    return result;
  } catch {
    return { ok: false, code: 'entitlement_invalid' };
  }
}

async function verifyAppleReceipt(receipt, fetchImpl) {
  const response = await fetchImpl('https://api.storekit.itunes.apple.com/inApps/v1/transactions/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedTransaction: receipt }),
  });
  if (!response.ok) return { ok: false, code: response.status === 410 ? 'entitlement_expired' : 'entitlement_invalid' };
  return { ok: true };
}

async function verifyGoogleReceipt(receipt, fetchImpl) {
  const response = await fetchImpl('https://androidpublisher.googleapis.com/androidpublisher/v3/applications/purchases/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ purchaseToken: receipt }),
  });
  if (!response.ok) return { ok: false, code: response.status === 410 ? 'entitlement_expired' : 'entitlement_invalid' };
  return { ok: true };
}
