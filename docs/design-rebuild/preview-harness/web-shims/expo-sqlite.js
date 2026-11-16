// Browser stand-in for expo-sqlite: a real SQLite engine (sql.js, asm build) kept in memory
// and saved to localStorage so the preview remembers data between visits.
const initSqlJs = require('sql.js/dist/sql-asm.js');
const KEY = (name) => 'fallback-preview:db:' + name;
let SQLp = null;
const getSQL = () => (SQLp ??= initSqlJs());
const open = new Map();

function toB64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function fromB64(b) { const s = atob(b); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
function norm(params) {
  if (params === undefined || params === null) return [];
  const fix = (v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);
  if (Array.isArray(params)) return params.map(fix);
  const o = {}; for (const k of Object.keys(params)) o[k] = fix(params[k]); return o;
}

class WebDatabase {
  constructor(name, db) { this.name = name; this.db = db; this.tx = 0; this.timer = null; this.closed = false; }
  _dirty() {
    if (this.closed) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this._save(), 250);
  }
  _save() {
    if (this.closed) return;
    if (this.tx > 0) { this._dirty(); return; }
    try {
      const bytes = this.db.export(); // export() resets connection pragmas
      this.db.exec('PRAGMA foreign_keys = ON;');
      localStorage.setItem(KEY(this.name), toB64(bytes));
    } catch (e) { /* storage unavailable: keep running in memory */ }
  }
  async execAsync(sql) { this.db.exec(sql); this._dirty(); }
  async runAsync(sql, params) {
    this.db.run(sql, norm(params));
    const changes = this.db.getRowsModified();
    const r = this.db.exec('SELECT last_insert_rowid()');
    this._dirty();
    return { lastInsertRowId: Number(r[0]?.values?.[0]?.[0] ?? 0), changes };
  }
  async getAllAsync(sql, params) {
    const stmt = this.db.prepare(sql);
    try { stmt.bind(norm(params)); const rows = []; while (stmt.step()) rows.push(stmt.getAsObject()); return rows; }
    finally { stmt.free(); }
  }
  async getFirstAsync(sql, params) { const rows = await this.getAllAsync(sql, params); return rows[0] ?? null; }
  async withTransactionAsync(fn) {
    this.db.exec('BEGIN'); this.tx++;
    try { await fn(); this.db.exec('COMMIT'); }
    catch (e) { try { this.db.exec('ROLLBACK'); } catch {} throw e; }
    finally { this.tx--; this._dirty(); }
  }
  async closeAsync() { clearTimeout(this.timer); this._save(); this.closed = true; open.delete(this.name); try { this.db.close(); } catch {} }
}

export async function openDatabaseAsync(name) {
  const existing = open.get(name);
  if (existing) return existing;
  const SQL = await getSQL();
  let db = null;
  try { const saved = localStorage.getItem(KEY(name)); if (saved) db = new SQL.Database(fromB64(saved)); } catch (e) { db = null; }
  if (!db) db = new SQL.Database();
  const w = new WebDatabase(name, db);
  open.set(name, w);
  return w;
}
export async function deleteDatabaseAsync(name) {
  const w = open.get(name);
  if (w) { clearTimeout(w.timer); w.closed = true; open.delete(name); try { w.db.close(); } catch {} }
  try { localStorage.removeItem(KEY(name)); } catch {}
}
