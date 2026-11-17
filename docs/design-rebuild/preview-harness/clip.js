// usage: node clip.js <scheme> <route> <out> <scrollY> [click text...]
const { chromium } = require('playwright');
const S = '/tmp/claude-0/-home-user-fallbackv3/4065cf9b-48bb-5876-bcc5-38bb70a7fbe9/scratchpad';
(async () => {
  const [scheme, route, out, y, ...clicks] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme })).newPage();
  await page.goto('http://localhost:8767/'); await page.waitForTimeout(2500);
  await page.evaluate(() => window.__fallbackPreview.loadSample()); await page.waitForTimeout(2500);
  if (process.env.ACCENT) { await page.evaluate(() => window.__fallbackPreview.go('/settings/theme')); await page.waitForTimeout(900); await page.getByText(process.env.ACCENT, { exact: true }).locator('visible=true').first().click(); await page.waitForTimeout(900); }
  await page.evaluate((p) => window.__fallbackPreview.go(p), route); await page.waitForTimeout(1200);
  for (const c of clicks) { await page.getByText(c, { exact: true }).locator('visible=true').first().click().catch(() => console.log('clickfail', c)); await page.waitForTimeout(700); }
  await page.mouse.move(195, 500); await page.mouse.wheel(0, +y); await page.waitForTimeout(600);
  await page.screenshot({ path: `${S}/v3/${out}.png` });
  await browser.close();
})();
