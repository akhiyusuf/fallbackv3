// Screenshots of the current app + how much of each screen carries colour.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const out = {};
  for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 760 }, colorScheme: scheme }); const p = await ctx.newPage();
    await p.goto('http://localhost:8767/'); await p.waitForTimeout(2500);
    await p.evaluate(() => window.__fallbackPreview.loadSample()); await p.waitForTimeout(2500);
    const tasks = await p.evaluate(async () => (await window.__fallbackPreview.repos.tasks.list()).map((t) => ({ id: t.id, name: t.name })));
    const id = (n) => (tasks.find((t) => t.name === n) || {}).id;
    const routes = { today: '/today', routines: '/routines', task: `/task/${id('Morning workout')}`, settings: '/settings', progress: '/progress', theme: '/settings/theme' };
    for (const [name, r] of Object.entries(routes)) {
      await p.evaluate((x) => window.__fallbackPreview.go(x), r); await p.waitForTimeout(1100);
      const buf = await p.screenshot({ type: 'png' });
      const cov = await p.evaluate(async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0, col = 0; for (let i = 0; i < d.length; i += 4) { const r = d[i], gg = d[i + 1], bb = d[i + 2]; const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb); n++; if (mx - mn > 40 && (mx - mn) / (mx || 1) > 0.22) col++; } return +(100 * col / n).toFixed(1); }, buf.toString('base64'));
      out[`${name}-${scheme}`] = cov;
      if (['today', 'routines', 'task', 'theme'].includes(name)) fs.writeFileSync(`cb/${name}-${scheme}.jpg`, await p.screenshot({ type: 'jpeg', quality: 74 }));
    }
    await ctx.close();
  }
  console.log(JSON.stringify(out)); await b.close();
})();
