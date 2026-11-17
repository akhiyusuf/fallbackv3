// Sound wiring check, round three: tap on buttons and tabs, saved on a save, the page flip on skip.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));
  await page.addInitScript(() => {
    window.__played = [];
    const orig = window.AudioContext.prototype.createBufferSource;
    window.AudioContext.prototype.createBufferSource = function () { const s = orig.call(this); const st = s.start.bind(s); s.start = (...a) => { window.__played.push(Math.round((s.buffer ? s.buffer.duration : 0) * 1000) / 1000); return st(...a); }; return s; };
  });
  await page.goto('http://localhost:8767/'); await page.waitForTimeout(2500);
  await page.evaluate(() => window.__fallbackPreview.loadSample()); await page.waitForTimeout(2500);
  const P = (p) => page.evaluate((x) => window.__fallbackPreview.go(x), p);
  const click = async (t, exact = true) => { await page.getByText(t, { exact }).locator('visible=true').first().click({ timeout: 3000 }).catch(() => console.log('clickfail', t)); await page.waitForTimeout(900); };
  const take = async (label) => { const v = await page.evaluate(() => { const x = window.__played; window.__played = []; return x; }); console.log(label.padEnd(44), JSON.stringify(v)); };
  await P('/today'); await page.waitForTimeout(900); await take('arrive on Today (none)');
  await page.getByRole('tab', { name: /Routines/ }).first().click().catch(() => console.log('no tab role')); await page.waitForTimeout(700); await take('bottom tab Routines (tap 0.135)');
  await P('/today'); await page.waitForTimeout(700);
  await page.getByLabel(/: Skip today$/).locator('visible=true').first().click({ timeout: 3000 }).catch(() => console.log('no skip link')); await page.waitForTimeout(900); await take('Skip today (flip 0.43)');
  await page.evaluate(() => { const s = window.__fallbackPreview.repos; window.__fail = true; }); 
  await P('/add/todo'); await page.waitForTimeout(900);
  await page.locator('input:visible').first().fill('Buy stamps'); await page.waitForTimeout(300);
  const names = await page.getByRole('button').locator('visible=true').allInnerTexts(); console.log('buttons on add to-do:', JSON.stringify(names.slice(0, 12)));
  await click('Save', false); await take('Save to-do (tap 0.135 then saved 0.22)');
  console.log(errs.join('\n') || 'no page errors');
  await b.close();
})();
