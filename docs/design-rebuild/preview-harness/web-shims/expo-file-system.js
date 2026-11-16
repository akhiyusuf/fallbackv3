const mem = new Map();
export class Directory { constructor(...parts) { this.uri = parts.map((p) => (p && p.uri) || String(p)).join('/'); } get exists() { return true; } create() {} }
export class File {
  constructor(...parts) { this.uri = parts.map((p) => (p && p.uri) || String(p)).join('/'); }
  get exists() { return mem.has(this.uri); }
  write(s) { mem.set(this.uri, String(s)); try { window.__fallbackPreview = window.__fallbackPreview || {}; window.__fallbackPreview.files = Object.fromEntries(mem); } catch {} }
  text() { return Promise.resolve(mem.get(this.uri) ?? ''); }
  textSync() { return mem.get(this.uri) ?? ''; }
  delete() { mem.delete(this.uri); }
  create() { if (!mem.has(this.uri)) mem.set(this.uri, ''); }
}
export const Paths = { document: new Directory('preview://documents'), cache: new Directory('preview://cache'), appleSharedContainers: {} };
