const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.addInitScript(() => { window.__played = []; const orig = window.AudioContext.prototype.createBufferSource; window.AudioContext.prototype.createBufferSource = function () { const s = orig.call(this); const st = s.start.bind(s); s.start = (...a) => { window.__played.push(Math.round((s.buffer ? s.buffer.duration : 0) * 100) / 100); return st(...a); }; return s; }; });
  await page.goto('http://localhost:8767/'); await page.waitForTimeout(2500);
  await page.evaluate(() => window.__fallbackPreview.loadSample()); await page.waitForTimeout(2500);
  const take = async (label) => { await page.waitForTimeout(1400); const v = await page.evaluate(() => { const x = window.__played; window.__played = []; return x; }); console.log(label.padEnd(34), JSON.stringify(v), 'stored:', await page.evaluate(() => localStorage.getItem('fallback.sounds'))); };
  await page.evaluate(() => window.__fallbackPreview.go('/settings')); await page.waitForTimeout(1200);
  const sw = page.getByLabel(/^Sounds, /).locator('visible=true').last();
  console.log('switch count', await page.getByLabel(/^Sounds, /).count());
  await sw.click().catch((e) => console.log('fail', String(e).slice(0, 120))); await take('Sounds off');
  await page.getByLabel(/^Sounds, /).locator('visible=true').last().click().catch(() => console.log('fail2')); await take('Sounds on again');
  await page.screenshot({ path: process.argv[2] });
  await b.close();
})();
