/**
 * Where a BYO key may be sent. The key travels in an Authorization header, so the address must be
 * https, unless the model server is on this phone or the home network (http to a local server).
 * Used by S40 at save time AND by the provider before every request, so a config saved before this
 * rule existed can no longer send the key in clear text.
 */

/** True for an address where the key stays on this device or the home network: loopback, a private range or a .local name. */
export function isLocalHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h === '::1' || h.endsWith('.local') || h.endsWith('.localhost')) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

export function isSafeBaseUrl(raw: string): boolean {
  const m = /^(https?):\/\/(?:[^/@]*@)?(\[[^\]]+\]|[^/:?#]+)/i.exec(raw.trim());
  if (!m) return false;
  if (m[1]!.toLowerCase() === 'https') return true;
  return isLocalHost(m[2]!);
}
