// Onboarding fit check: for each screen size and step, does anything have to scroll?
const { chromium } = require('playwright');
const S = '/tmp/claude-0/-home-user-fallbackv3/4065cf9b-48bb-5876-bcc5-38bb70a7fbe9/scratchpad';
const SIZES = [[320, 568], [360, 640], [375, 667], [390, 700], [390, 776], [390, 844], [412, 915], [430, 932]];
const STEPS = ['concept', 'hook', 'types', 'consistency', 'personalize', 'notifications-primer', 'first-task'];
(async () => {
  const shots = process.argv.slice(2);
  const browser = await chromium.launch();
  for (const [w, h] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: 'light' });
    const page = await ctx.newPage();
    await page.goto('http://localhost:8767/', { waitUntil: 'load' });
    await page.addStyleTag({ content: "@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap'); #root *, body > div * { font-family: 'Nunito', system-ui, sans-serif !important; }" }).catch(() => {});
    await page.waitForTimeout(2500);
    const row = [];
    for (const step of STEPS) {
      await page.evaluate((p) => window.__fallbackPreview.go(p), '/onboarding/' + step);
      await page.waitForTimeout(900);
      const r = await page.evaluate(() => {
        const els = [...document.querySelectorAll('*')].filter((e) => { const cs = getComputedStyle(e); const b = e.getBoundingClientRect(); return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && b.width > 200 && b.height > 0 && e.offsetParent !== null; });
        const vis = els.filter((e) => { const b = e.getBoundingClientRect(); return b.left >= 0 && b.left < innerWidth; });
        const e = vis[vis.length - 1];
        return e ? { over: e.scrollHeight - e.clientHeight, top: Math.round(e.getBoundingClientRect().top) } : null;
      });
      row.push(`${step.slice(0, 6)}:${r ? (r.over > 1 ? 'SCROLL+' + r.over : 'ok') + '/top' + r.top : '?'}`);
      if (shots.includes(`${w}x${h}`)) await page.screenshot({ path: `${S}/v3/ob-${w}x${h}-${step}.png` });
    }
    console.log(`${w}x${h}  ` + row.join('  '));
    await ctx.close();
  }
  await browser.close();
})();
