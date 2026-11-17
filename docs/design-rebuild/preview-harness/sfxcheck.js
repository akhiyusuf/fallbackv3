// Sound wiring check: count which sounds the app starts when you log, toggle and tick.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));
  await page.addInitScript(() => {
    window.__played = [];
    const orig = window.AudioContext.prototype.createBufferSource;
    window.AudioContext.prototype.createBufferSource = function () { const s = orig.call(this); const st = s.start.bind(s); s.start = (...a) => { window.__played.push(Math.round((s.buffer ? s.buffer.duration : 0) * 100) / 100); return st(...a); }; return s; };
  });
  await page.goto('http://localhost:8767/'); await page.waitForTimeout(2500);
  await page.evaluate(() => window.__fallbackPreview.loadSample()); await page.waitForTimeout(2500);
  const P = (p) => page.evaluate((x) => window.__fallbackPreview.go(x), p);
  const click = async (t) => { await page.getByText(t, { exact: true }).locator('visible=true').first().click({ timeout: 3000 }).catch(() => console.log('clickfail', t)); await page.waitForTimeout(900); };
  const take = async (label) => { const v = await page.evaluate(() => { const x = window.__played; window.__played = []; return x; }); console.log(label.padEnd(28), JSON.stringify(v)); };
  await P('/today'); await page.waitForTimeout(800);
  await click('Done'); await take('Done (ideal 1.15)');
  await click('Fallback'); await take('Fallback (0.85)');
  await click('Done'); await page.waitForTimeout(900); await take('last Done (+day 1.9)');
  await P('/settings'); await page.waitForTimeout(800); await page.getByLabel('Sounds, on', { exact: true }).locator('visible=true').first().click().catch(() => console.log('no switch')); await page.waitForTimeout(500); await take('Sounds switch off (0.26)');
  await P('/today'); await page.waitForTimeout(600);
  await P('/settings/notifications'); await page.waitForTimeout(800); await click('Time for your Morning workout'); await take('reminder while off (none)');
  console.log(errs.join('\n') || 'no page errors');
  await page.screenshot({ path: '/tmp/claude-0/-home-user-fallbackv3/4065cf9b-48bb-5876-bcc5-38bb70a7fbe9/scratchpad/v3/sfx-settings.png' });
  await b.close();
})();
