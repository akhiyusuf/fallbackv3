// usage: node obshot.js <scheme> <step 1-7 | all> <out.png> [width height]   onboarding step(s) on a fresh install, 2x; "all" writes a contact sheet row
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const STEPS = ['concept', 'hook', 'types', 'consistency', 'personalize', 'notifications-primer', 'first-task'];
(async () => {
  const [scheme, step, out, w = '390', h = '844'] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, colorScheme: scheme })).newPage();
  await page.goto('http://localhost:8767/', { waitUntil: 'load' }); await page.waitForTimeout(2500);
  const list = step === 'all' ? STEPS.map((_, i) => i + 1) : [+step]; const files = [];
  for (const n of list) {
    await page.evaluate((p) => window.__fallbackPreview.go(p), '/onboarding/' + STEPS[n - 1]); await page.waitForTimeout(1400);
    const f = step === 'all' ? out.replace(/\.png$/, `-${n}.png`) : out; await page.screenshot({ path: f }); files.push(f);
  }
  if (step === 'all') { execFileSync('convert', [...files, '+append', '-resize', '50%', out]); files.forEach((f) => require('fs').unlinkSync(f)); }
  await browser.close();
})();
