// Preview: the store is simulated. Nothing is charged; a "purchase" just flips a local flag.
const KEY = 'fallback-preview:purchase';
const SKUS = { monthly: 'fallback_ai_monthly', annual: 'fallback_ai_annual' };
let updated = [];
const read = () => { try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null; } catch { return null; } };
export const initConnection = async () => true;
export const endConnection = async () => true;
export const fetchProducts = async ({ skus }) => (skus ?? []).map((id) => ({ id, productId: id, displayPrice: /annual|year/i.test(id) ? '$39.99' : '$4.99', title: 'Fallback AI' }));
export const getAvailablePurchases = async () => { const p = read(); return p ? [p] : []; };
export const getActiveSubscriptions = getAvailablePurchases;
export const hasActiveSubscriptions = async () => !!read();
export const requestPurchase = async (args) => {
  const sku = args?.request?.apple?.sku ?? args?.request?.google?.skus?.[0] ?? SKUS.monthly;
  const p = { productId: sku, id: 'preview-' + Date.now(), transactionId: 'preview-' + Date.now(), purchaseToken: 'preview-receipt', transactionReceipt: 'preview-receipt', expirationDateIOS: Date.now() + 30 * 864e5 };
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
  updated.forEach((fn) => { try { fn(p); } catch {} });
};
export const finishTransaction = async () => undefined;
export const restorePurchases = async () => undefined;
export const deepLinkToSubscriptions = async () => { try { localStorage.removeItem(KEY); } catch {} };
export const purchaseUpdatedListener = (fn) => { updated.push(fn); return { remove() { updated = updated.filter((f) => f !== fn); } }; };
export const purchaseErrorListener = () => ({ remove() {} });
