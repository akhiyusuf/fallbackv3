// Empty-screen alignment: where do the drawing, headline and button sit on each empty tab?
const { chromium } = require('playwright');
const S = '/tmp/claude-0/-home-user-fallbackv3/4065cf9b-48bb-5876-bcc5-38bb70a7fbe9/scratchpad';
(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[390, 844], [375, 667], [320, 568]]) {
    const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
    await page.goto('http://localhost:8767/'); await page.waitForTimeout(2500);
    await page.addStyleTag({ content: "@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap'); #root *, body > div * { font-family: 'Nunito', system-ui, sans-serif !important; }" }).catch(() => {});
    await page.evaluate(() => window.__fallbackPreview.startOver()).catch(() => {}); await page.waitForTimeout(1500);
    await page.evaluate(async () => { await window.__fallbackPreview.repos.settings.patch({ onboardingCompletedAt: new Date().toISOString() }); });
    console.log(`${w}x${h}`);
    for (const r of ['/today', '/routines', '/events', '/courses', '/todos']) {
      await page.evaluate((p) => window.__fallbackPreview.go(p), r); await page.waitForTimeout(1000);
      const res = await page.evaluate(() => {
        const vis = (e) => { const b = e.getBoundingClientRect(); return e.offsetParent !== null && b.width > 0 && b.left >= 0 && b.left < innerWidth; };
        const head = [...document.querySelectorAll('[role=heading]')].filter(vis).filter((e) => e.getBoundingClientRect().top > 100).pop();
        const btn = [...document.querySelectorAll('[role=button]')].filter(vis).filter((e) => { const b = e.getBoundingClientRect(); return b.top > 200 && b.top < innerHeight - 90; }).pop();
        const root = head.parentElement; const art = root.firstElementChild.getBoundingClientRect(); const rb = root.getBoundingClientRect();
        const sc = [...document.querySelectorAll('*')].filter((e) => { const cs = getComputedStyle(e); return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && vis(e) && e.getBoundingClientRect().height > 100; }).pop();
        return { art: Math.round(art.top), head: Math.round(head.getBoundingClientRect().top), btn: btn ? Math.round(btn.getBoundingClientRect().top) : null, btnBottom: btn ? Math.round(btn.getBoundingClientRect().bottom) : null, area: [Math.round(rb.top), Math.round(rb.bottom)], over: sc ? sc.scrollHeight - sc.clientHeight : '?' };
      });
      console.log('  ' + r.padEnd(10), JSON.stringify(res));
      if (w === 390) await page.screenshot({ path: `${S}/v3/empty-${r.slice(1)}-390.png` });
    }
  }
  await browser.close();
})();
