// Screenshot every main screen of the current preview and measure how much of each carries colour.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const out = {};
  const ctx = await b.newContext({ viewport: { width: 390, height: 760 }, colorScheme: 'light' }); const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message.slice(0, 160)));
  await p.goto('http://localhost:8767/'); await p.waitForTimeout(2500);
  const cov = async () => { const buf = await p.screenshot({ type: 'png' }); return p.evaluate(async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0, col = 0; for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); n++; if (mx - mn > 40 && (mx - mn) / (mx || 1) > 0.22) col++; } return +(100 * col / n).toFixed(1); }, buf.toString('base64')); };
  const shot = async (name) => { out[name] = await cov(); fs.writeFileSync(`pb/${name}.jpg`, await p.screenshot({ type: 'jpeg', quality: 72 })); };
  const go = async (r) => { await p.evaluate((x) => window.__fallbackPreview.go(x), r); await p.waitForTimeout(1100); };
  // fresh: onboarding + empty states
  await go('/onboarding/hook'); await shot('onboard1'); await go('/onboarding/concept'); await shot('onboard2');
  await p.evaluate(() => window.__fallbackPreview.loadSample()); await p.waitForTimeout(2500);
  const tasks = await p.evaluate(async () => (await window.__fallbackPreview.repos.tasks.list()).map((t) => ({ id: t.id, name: t.name, type: t.type })));
  const id = (n) => (tasks.find((t) => t.name === n) || {}).id;
  const routes = { today: '/today', routines: '/routines', events: '/events', courses: '/courses', todos: '/todos', task: `/task/${id('Morning workout')}`, progress: '/progress', trend: '/progress/trend', awards: '/achievements', records: '/records', settings: '/settings', notif: '/settings/notifications', search: '/search', assistant: '/assistant', addroutine: '/add/routine', paywall: '/assistant/paywall' };
  for (const [n, r] of Object.entries(routes)) { await go(r); await shot(n); }
  console.log(JSON.stringify(out)); console.log(tasks.map((t) => t.type + ':' + t.name).join(' | '));
  await b.close();
})();
