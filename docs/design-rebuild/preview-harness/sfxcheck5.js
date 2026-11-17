// Do sounds start inside the published page when the host forbids network calls, as the artifact viewer does?
// The page is wrapped the way the viewer wraps it, with a policy that blocks fetch (data: URLs included).
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const body = fs.readFileSync(__dirname + '/page/fallback-preview.html', 'utf8');
  const html = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="connect-src \'none\'"></head><body>' + body + '</body></html>';
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160))); page.on('console', (m) => { if (/Content Security|Refused/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  await page.addInitScript(() => {
    window.__played = [];
    const orig = window.AudioContext.prototype.createBufferSource;
    window.AudioContext.prototype.createBufferSource = function () { const s = orig.call(this); const st = s.start.bind(s); s.start = (...a) => { window.__played.push(Math.round((s.buffer ? s.buffer.duration : 0) * 1000) / 1000); return st(...a); }; return s; };
  });
  await page.route('http://preview.test/', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  await page.goto('http://preview.test/'); await page.waitForTimeout(4000);
  await page.evaluate(() => window.__fallbackPreview.loadSample()); await page.waitForTimeout(2500);
  await page.evaluate(() => window.__fallbackPreview.go('/today')); await page.waitForTimeout(1200);
  await page.screenshot({ path: __dirname + '/v3/sfx5.png' }); console.log('tabs:', await page.getByRole('tab').count(), 'Routines texts:', await page.getByText('Routines', { exact: true }).count());
  await page.getByRole('tab', { name: /Routines/ }).locator('visible=true').first().click({ timeout: 3000 }).catch(() => console.log('no tab')); await page.waitForTimeout(900);
  console.log('bottom tab (expect [0.135]):', JSON.stringify(await page.evaluate(() => window.__played)));
  console.log([...new Set(errs)].slice(0, 4).join('\n') || 'no errors');
  await b.close();
})();
