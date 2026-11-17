const { chromium } = require('playwright'); const S_ = '/tmp/claude-0/-home-user-fallbackv3/4065cf9b-48bb-5876-bcc5-38bb70a7fbe9/scratchpad';
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.addInitScript(() => { window.__played = []; const orig = window.AudioContext.prototype.createBufferSource; window.AudioContext.prototype.createBufferSource = function () { const s = orig.call(this); const st = s.start.bind(s); s.start = (...a) => { window.__played.push(Math.round((s.buffer ? s.buffer.duration : 0) * 100) / 100); return st(...a); }; return s; }; });
  await page.goto('http://localhost:8767/'); await page.waitForTimeout(2500);
  await page.evaluate(() => window.__fallbackPreview.loadSample()); await page.waitForTimeout(2500);
  const P = (p) => page.evaluate((x) => window.__fallbackPreview.go(x), p);
  const take = async (label) => { await page.waitForTimeout(1400); const v = await page.evaluate(() => { const x = window.__played; window.__played = []; return x; }); console.log(label.padEnd(34), JSON.stringify(v)); };
  await P('/settings/notifications'); await page.waitForTimeout(1000);
  await page.getByText('Too tired? The fallback still counts.', { exact: true }).locator('visible=true').first().click().catch(() => console.log('fail sample')); await take('reminder sample (1.6)');
  await page.getByRole('switch').locator('visible=true').nth(1).click().catch(() => console.log('fail switch')); await take('a switch (0.22 or 0.26)');
  await P('/todos'); await page.waitForTimeout(1000);
  await page.getByRole('checkbox').locator('visible=true').first().click().catch(() => console.log('fail todo')); await take('to-do tick (0.62)');
  await P('/today'); await page.waitForTimeout(1000);
  for (let i = 0; i < 3; i++) { await page.getByRole('button', { name: /ideal|Done/i }).locator('visible=true').first().click().catch(() => console.log('fail done', i)); await take('today log ' + i); }
  await P('/settings'); await page.waitForTimeout(1000);
  await page.screenshot({ path: S_ + '/v3/sfx-settings.png' });
  await page.getByRole('switch').locator('visible=true').first().click().catch(() => console.log('fail sounds switch')); await take('Sounds off (0.26)');
  await P('/settings/notifications'); await page.waitForTimeout(1000);
  await page.getByText('Too tired? The fallback still counts.', { exact: true }).locator('visible=true').first().click().catch(() => {}); await take('reminder with sounds off (none)');
  await b.close();
})();
