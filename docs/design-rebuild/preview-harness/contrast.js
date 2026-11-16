// Contrast audit: node contrast.js  -> prints failing text/icon colour pairs per scheme
const { chromium } = require('playwright');
const ROUTES = ['/today','/routines','/events','/courses','/todos','/search','/add/routine','/add/event','/add/course','/add/todo','/task/{Morning workout}','/task/{Antibiotics}','/task/{Renew passport}','/task/{Headache relief}/as-needed','/task/{Morning workout}/icon','/progress','/progress/trend','/achievements','/records','/assistant','/assistant/paywall','/assistant/paywall/plan','/assistant/paywall/byo','/assistant/mic-primer','/assistant/chat','/assistant/history','/settings','/settings/notifications','/settings/theme','/settings/widgets','/settings/data','/settings/sync','/settings/help','/settings/subscription','/onboarding/hook','/onboarding/concept','/onboarding/types','/onboarding/consistency','/onboarding/personalize','/onboarding/notifications-primer','/onboarding/first-task'];
const ACTIONS = { '/today': ['Done'] };
function collect() {
  const parse = (c) => { const m = c.match(/[\d.]+/g); if (!m) return null; return { r: +m[0], g: +m[1], b: +m[2], a: m[3] === undefined ? 1 : +m[3] }; };
  const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); };
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const bgOf = (el) => { const layers = []; let e = el; while (e && e !== document.documentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; } e = e.parentElement; } let base = { r: 255, g: 255, b: 255, a: 1 }; const pageBg = parse(getComputedStyle(document.body).backgroundColor); if (pageBg && pageBg.a > 0) base = pageBg; for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base); return base; };
  const opacityOf = (el) => { let o = 1, e = el; while (e && e !== document.documentElement) { o *= +getComputedStyle(e).opacity; e = e.parentElement; } return o; };
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== 'hidden'; };
  const out = [];
  document.querySelectorAll('#root *, body > div:not(#root) *').forEach((el) => {
    if (!visible(el)) return;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
    const cs = getComputedStyle(el);
    if (own) {
      let fg = parse(cs.color); if (!fg) return; const bg = bgOf(el); fg = { ...fg, a: fg.a * opacityOf(el) }; const eff = over(fg, bg);
      const size = parseFloat(cs.fontSize), weight = +cs.fontWeight || 400; const large = size >= 24 || (size >= 18.66 && weight >= 700);
      out.push({ kind: 'text', text: own.slice(0, 28), fg: hex(eff), bg: hex(bg), ratio: +ratio(eff, bg).toFixed(2), size, weight, need: large ? 3 : 4.5, disabled: !!el.closest('[aria-disabled=true],[disabled]') });
    } else if (el.tagName.toLowerCase() === 'svg') {
      const kid = el.querySelector('path,circle,line,rect,polyline,polygon'); const kcs = kid ? getComputedStyle(kid) : cs;
      let col = kcs.stroke && kcs.stroke !== 'none' ? kcs.stroke : (kcs.fill && kcs.fill !== 'none' ? kcs.fill : cs.color);
      let fg = parse(col); if (!fg || el.getAttribute('aria-hidden') === 'true' && false) return; const bg = bgOf(el); fg = { ...fg, a: fg.a * opacityOf(el) }; const eff = over(fg, bg); const r = el.getBoundingClientRect();
      if (r.width > 60) return;
      out.push({ kind: 'icon', text: (el.closest('[aria-label]')?.getAttribute('aria-label') || 'icon').slice(0, 28), fg: hex(eff), bg: hex(bg), ratio: +ratio(eff, bg).toFixed(2), size: Math.round(r.width), weight: 0, need: 3, disabled: !!el.closest('[aria-disabled=true],[disabled]') });
    }
  });
  return out;
}
(async () => {
  const browser = await chromium.launch(); const report = {};
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme }); const page = await ctx.newPage();
    await page.goto('http://localhost:8767/'); await page.waitForTimeout(2500);
    await page.evaluate(() => window.__fallbackPreview.loadSample()); await page.waitForTimeout(2500);
    const tasks = await page.evaluate(async () => (await window.__fallbackPreview.repos.tasks.list()).map((t) => ({ id: t.id, name: t.name })));
    const fails = new Map(); let total = 0;
    for (const r of ROUTES) {
      const route = r.replace(/\{([^}]+)\}/g, (_, n) => (tasks.find((t) => t.name === n) || {}).id);
      await page.evaluate((p) => window.__fallbackPreview.go(p), route); await page.waitForTimeout(900);
      const passes = [null, ...(ACTIONS[r] || [])];
      for (const a of passes) {
        if (a) { try { const loc = a.startsWith('label:') ? page.getByLabel(a.slice(6), { exact: true }) : page.getByText(a, { exact: true }); await loc.locator('visible=true').first().click({ timeout: 2000 }); await page.waitForTimeout(600); } catch (e) {} }
        for (let scroll = 0; scroll < 3; scroll++) {
          const items = await page.evaluate(collect); total += items.length;
          for (const it of items) { if (it.ratio >= it.need || it.kind !== (process.argv[2] || it.kind)) continue; const key = [it.kind, it.fg, it.bg, it.size, it.weight, it.disabled ? 'disabled' : ''].join(' '); const e = fails.get(key) || { ...it, n: 0, where: new Set(), texts: new Set() }; e.n++; e.where.add(r); if (e.texts.size < 4) e.texts.add(it.text); fails.set(key, e); }
          await page.mouse.move(195, 500); await page.mouse.wheel(0, 700); await page.waitForTimeout(250);
        }
        if (a) { await page.keyboard.press('Escape'); await page.evaluate(() => window.__fallbackPreview.go('/today')); await page.waitForTimeout(400); }
      }
    }
    report[scheme] = { total, fails: [...fails.values()].sort((a, b) => a.ratio - b.ratio).map((e) => ({ kind: e.kind, fg: e.fg, bg: e.bg, ratio: e.ratio, need: e.need, size: e.size, weight: e.weight, disabled: e.disabled, n: e.n, texts: [...e.texts], where: [...e.where].slice(0, 5) })) };
    await ctx.close();
  }
  require('fs').writeFileSync('contrast.json', JSON.stringify(report, null, 1));
  for (const s of ['light', 'dark']) { console.log('==', s, 'checked', report[s].total, 'failing combos', report[s].fails.length); for (const f of report[s].fails) console.log(`${f.ratio}/${f.need} ${f.kind} ${f.fg} on ${f.bg} ${f.size}px w${f.weight}${f.disabled ? ' DISABLED' : ''} x${f.n} | ${f.texts.join(' ; ')} | ${f.where.join(' ')}`); }
  await browser.close();
})();
