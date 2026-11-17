// Empty-screen scroll check: on a fresh install, which screens can be scrolled although nothing is cut off?
const { chromium } = require('playwright');
const S = '/tmp/claude-0/-home-user-fallbackv3/4065cf9b-48bb-5876-bcc5-38bb70a7fbe9/scratchpad';
const ROUTES = ['/today', '/routines', '/events', '/courses', '/todos', '/search', '/progress', '/achievements', '/priorities'];
(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[390, 844], [375, 667]]) {
    const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
    await page.goto('http://localhost:8767/'); await page.waitForTimeout(2500);
    await page.evaluate(() => window.__fallbackPreview.startOver()).catch(() => {}); await page.waitForTimeout(1500);
    await page.evaluate(async () => { await window.__fallbackPreview.repos.settings.patch({ onboardingCompletedAt: new Date().toISOString() }); }); 
    const out = [];
    for (const r of ROUTES) {
      await page.evaluate((p) => window.__fallbackPreview.go(p), r); await page.waitForTimeout(1000);
      const res = await page.evaluate(() => {
        const els = [...document.querySelectorAll('*')].filter((e) => { const cs = getComputedStyle(e); const b = e.getBoundingClientRect(); return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && b.width > 200 && b.height > 100 && e.offsetParent !== null && b.left >= 0 && b.left < innerWidth; });
        return els.map((e) => ({ over: e.scrollHeight - e.clientHeight, h: e.clientHeight, last: Math.round([...e.querySelectorAll('*')].filter((c) => c.children.length === 0 && c.getBoundingClientRect().height > 0).reduce((m, c) => Math.max(m, c.getBoundingClientRect().bottom), 0) - e.getBoundingClientRect().top) }));
      });
      out.push(r + ' ' + res.map((x) => (x.over > 1 ? `SCROLL+${x.over} (content ends at ${x.last} of ${x.h})` : 'ok')).join(','));
      if (process.argv[2]) await page.screenshot({ path: `${S}/v3/empty-${r.slice(1).replace(/\//g, '-')}-${w}.png` });
    }
    console.log(`${w}x${h}\n  ` + out.join('\n  '));
  }
  await browser.close();
})();
