// Watch the banner height while moving 4 -> 5 -> 6 through the real Next buttons.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.goto('http://localhost:8767/'); await page.waitForTimeout(2500);
  await page.evaluate(() => window.__fallbackPreview.go('/onboarding/consistency')); await page.waitForTimeout(1200);
  const top = () => page.evaluate(() => { const els = [...document.querySelectorAll('[data-testid="onboarding-dot-1"]')].filter((e) => e.offsetParent !== null && e.getBoundingClientRect().left >= 0 && e.getBoundingClientRect().left < innerWidth); const e = els[els.length - 1]; let n = e; for (let i = 0; i < 3; i++) n = n.parentElement; return Math.round(n.getBoundingClientRect().height); });
  for (const label of ['4 to 5', '5 to 6']) {
    const out = [await top()];
    await page.getByText('Next', { exact: true }).locator('visible=true').last().click();
    for (let i = 0; i < 8; i++) { await page.waitForTimeout(80); out.push(await top()); }
    await page.waitForTimeout(500); out.push(await top());
    console.log(label, out.join(' '));
  }
  await b.close();
})();
