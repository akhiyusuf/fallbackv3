// usage: node obshot.js <scheme> <step> <out.png>   — onboarding step on a fresh install, 2x
const { chromium } = require('playwright');
(async () => {
  const [scheme, step, out] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme })).newPage();
  await page.goto('http://localhost:8767/', { waitUntil: 'load' }); await page.waitForTimeout(2500);
  await page.evaluate((p) => window.__fallbackPreview.go(p), '/onboarding/' + step); await page.waitForTimeout(1500);
  await page.screenshot({ path: out });
  await browser.close();
})();
