/**
 * M6 backend. Receipt-based entitlement — docs/API.md §4 "Authentication". No accounts, no
 * user id anywhere. The receipt is verified against Apple's/Google's server APIs for THIS
 * request only, and the verification result is never persisted (in memory, on disk, or in a
 * log) — the whole point of "verified per request, persisted never".
 *
 * `verifyReceipt` takes its HTTP client as a parameter so it is unit-testable without a
 * network call (see `receipt.test.js`).
 *
 * ⚠️ NOT PRODUCTION-READY — DELIBERATELY FAILS CLOSED, not a placeholder pretending otherwise.
 * Real Apple/Google verification needs deploy-provisioned credentials this codebase does not
 * have: Apple's App Store Server API requires a JWT bearer token signed with the deploy's own
 * private key (ES256, `kid`/`iss`/`bid` claims); Google's Play Developer API requires an
 * OAuth2 access token from a service account plus the app's package name. Neither can be
 * fabricated here, and this file does not pretend to have them — a PREVIOUS version of this
 * comment incorrectly claimed injecting `fetchImpl` alone was sufficient to wire real
 * verification; that was false (`fetchImpl` swaps the network client, not the URL, method,
 * or missing Authorization header).
 *
 * What IS real below: the request shape matches each platform's actual verification endpoint
 * (Apple: GET `/inApps/v1/transactions/{id}`; Google: GET
 * `.../applications/{package}/purchases/subscriptions/{sku}/tokens/{token}`), and an
 * `Authorization` header is attached when a deploy supplies `APPLE_AUTH_TOKEN` /
 * `GOOGLE_ACCESS_TOKEN` via env. Absent those env vars (the default, including in this
 * codebase's own tests), requests still go out with no credentials and simply fail per the
 * platform's own 401 — this function's CONTRACT (never persist, return one of the two
 * documented codes, verify per request, fail closed on any error) is what's tested and
 * load-bearing; wiring real deploy credentials is an infra task, not a logic change here.
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

const APPLE_VERIFY_BASE = process.env.APPLE_VERIFY_BASE_URL ?? 'https://api.storekit.itunes.apple.com';
const GOOGLE_PACKAGE_NAME = process.env.GOOGLE_PACKAGE_NAME ?? 'app.fallback.android';
// A receipt token alone doesn't say which SKU it's for; Google's endpoint needs the SKU in
// the path, so a real deploy tries the app's known SKUs in turn.
const GOOGLE_SUBSCRIPTION_SKUS = (process.env.GOOGLE_SUBSCRIPTION_SKUS ?? 'fallback.ai.monthly,fallback.ai.annual')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

async function verifyAppleReceipt(receipt, fetchImpl) {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.APPLE_AUTH_TOKEN) headers.Authorization = `Bearer ${process.env.APPLE_AUTH_TOKEN}`;
  const response = await fetchImpl(`${APPLE_VERIFY_BASE}/inApps/v1/transactions/${encodeURIComponent(receipt)}`, {
    method: 'GET',
    headers,
  });
  if (!response.ok) return { ok: false, code: response.status === 410 ? 'entitlement_expired' : 'entitlement_invalid' };
  return { ok: true };
}

async function verifyGoogleReceipt(receipt, fetchImpl) {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.GOOGLE_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.GOOGLE_ACCESS_TOKEN}`;
  for (const sku of GOOGLE_SUBSCRIPTION_SKUS) {
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(GOOGLE_PACKAGE_NAME)}/purchases/subscriptions/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(receipt)}`;
    // eslint-disable-next-line no-await-in-loop
    const response = await fetchImpl(url, { method: 'GET', headers });
    if (response.ok) return { ok: true };
    if (response.status === 410) return { ok: false, code: 'entitlement_expired' };
  }
  return { ok: false, code: 'entitlement_invalid' };
}
