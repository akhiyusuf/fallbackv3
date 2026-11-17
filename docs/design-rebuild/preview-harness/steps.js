const { chromium } = require('playwright');
const S = '/tmp/claude-0/-home-user-fallbackv3/4065cf9b-48bb-5876-bcc5-38bb70a7fbe9/scratchpad';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e.message).slice(0, 200)));
  await page.goto('http://localhost:8767/', { waitUntil: 'load' });
  await page.addStyleTag({ content: "@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap'); #root *, body > div * { font-family: 'Nunito', system-ui, sans-serif !important; }" }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.__fallbackPreview.loadSample()); await page.waitForTimeout(2500);
  await page.evaluate(() => window.__fallbackPreview.go('/add/routine')); await page.waitForTimeout(1200);
  const vis = (l) => l.locator('visible=true').last();
  await vis(page.getByLabel('Ideal step 1', { exact: true })).fill('walk dog');
  const add = page.getByText('Add step', { exact: true }).locator('visible=true').first(); await add.click(); await page.waitForTimeout(400);
  await vis(page.getByLabel('Ideal step 2', { exact: true })).fill('walk around park').catch((e) => console.log('fill2', String(e).slice(0, 80)));
  // choose Mon, Tue, Wed for the routine
  const picker = page.locator('[aria-label="Which days it runs"], [data-testid="routine-cadence-picker"]').locator('visible=true').last();
  const chips = page.locator('[role="checkbox"], [role="switch"], [role="button"]').filter({ hasText: /^[MTWFS]$/ }).locator('visible=true');
  console.log('chips', await chips.count());
  for (const i of [0, 1, 2]) await chips.nth(i).click().catch((e) => console.log('chip', String(e).slice(0, 80)));
  await page.waitForTimeout(600);
  await vis(page.getByLabel('Ideal step 1', { exact: true })).scrollIntoViewIfNeeded();
  await page.evaluate(() => { const els = [...document.querySelectorAll('*')].filter((e) => { const cs = getComputedStyle(e); return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 40; }); const e = els[els.length - 1]; if (e) e.scrollTop = 300; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: S + '/v3/r9-steps.png' });
  await browser.close();
})();
