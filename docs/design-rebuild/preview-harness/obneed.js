// Onboarding: how much height does each step need below the banner (content + footer), per width and density?
const { chromium } = require('playwright');
const WIDTHS = [320, 344, 360, 375, 390, 412, 430];
const HEIGHTS = { tight: 600, compact: 700, regular: 844 };
const STEPS = ['concept', 'hook', 'types', 'consistency', 'personalize', 'notifications-primer', 'first-task'];
(async () => {
  const browser = await chromium.launch(); const out = {};
  for (const [density, h] of Object.entries(HEIGHTS)) for (const w of WIDTHS) {
    const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })).newPage();
    await page.goto('http://localhost:8767/', { waitUntil: 'load' }); await page.waitForTimeout(2500);
    const row = [];
    for (const step of STEPS) {
      await page.evaluate((p) => window.__fallbackPreview.go(p), '/onboarding/' + step); await page.waitForTimeout(900);
      row.push(await page.evaluate(() => {
        const els = [...document.querySelectorAll('*')].filter((e) => { const cs = getComputedStyle(e); const b = e.getBoundingClientRect(); return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && b.width > 200 && b.height > 0 && e.offsetParent !== null && b.left >= 0 && b.left < innerWidth; });
        const e = els[els.length - 1]; const root = e.parentElement; const foot = root.lastElementChild.getBoundingClientRect().height;
        return Math.ceil(e.scrollHeight + foot);
      }));
    }
    (out[density] = out[density] || {})[w] = row; console.log(density, w, row.join(' '));
    await page.context().close();
  }
  require('fs').writeFileSync(__dirname + '/obneed.json', JSON.stringify(out));
  await browser.close();
})();
