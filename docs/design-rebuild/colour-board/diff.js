const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 760 }, colorScheme: 'light' }); const p = await ctx.newPage();
  await p.goto('http://localhost:8767/'); await p.waitForTimeout(2500);
  await p.evaluate(() => window.__fallbackPreview.loadSample()); await p.waitForTimeout(2500);
  const shots = {};
  for (const acc of ['Orange', 'Indigo']) {
    await p.evaluate(() => window.__fallbackPreview.go('/settings/theme')); await p.waitForTimeout(900);
    await p.locator(`[role="radio"][aria-label^="${acc}" i]`).locator("visible=true").last().click(); await p.waitForTimeout(500);
    for (const [n, r] of [['today', '/today'], ['settings', '/settings'], ['routines', '/routines']]) {
      await p.evaluate((x) => window.__fallbackPreview.go(x), r); await p.waitForTimeout(1000);
      shots[`${n}-${acc}`] = (await p.screenshot({ type: 'png' })).toString('base64');
      if (acc === 'Indigo' && n === 'today') fs.writeFileSync('cb/today-indigo.jpg', await p.screenshot({ type: 'jpeg', quality: 74 }));
      if (acc === 'Orange' && n === 'settings') fs.writeFileSync('cb/settings-light.jpg', await p.screenshot({ type: 'jpeg', quality: 74 }));
    }
  }
  const out = {};
  for (const n of ['today', 'settings', 'routines']) {
    out[n] = await p.evaluate(async ([a, c]) => { const load = async (s) => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const cv = document.createElement('canvas'); cv.width = i.width; cv.height = i.height; const g = cv.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, cv.width, cv.height).data; }; const x = await load(a), y = await load(c); let d = 0; for (let i = 0; i < x.length; i += 4) { if (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]) > 30) d++; } return +(100 * d / (x.length / 4)).toFixed(2); }, [shots[`${n}-Orange`], shots[`${n}-Indigo`]]);
  }
  // put the accent back
  await p.evaluate(() => window.__fallbackPreview.go("/settings/theme")); await p.waitForTimeout(900); await p.locator(`[role="radio"][aria-label^="Orange" i]`).locator("visible=true").last().click(); await p.waitForTimeout(400);
  console.log(JSON.stringify(out)); await b.close();
})();
