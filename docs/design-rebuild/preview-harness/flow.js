const { chromium } = require('playwright');
const S = '/tmp/claude-0/-home-user-fallbackv3/4065cf9b-48bb-5876-bcc5-38bb70a7fbe9/scratchpad';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e.message).slice(0, 200)));
  await page.goto('http://localhost:8767/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const vis = (l) => l.locator('visible=true').last();
  const where = async (tag) => console.log(tag, await page.evaluate(() => location.pathname + location.search));
  const settings = async (tag) => console.log(tag, JSON.stringify(await page.evaluate(async () => { const s = await window.__fallbackPreview.repos.settings.get(); const v = s.value ?? s; return { accent: v.accent, master: v.notifications && v.notifications.master, done: !!v.onboardingCompletedAt }; })));
  await page.evaluate(() => window.__fallbackPreview.startOver ? window.__fallbackPreview.startOver() : window.__fallbackPreview.go('/onboarding/hook'));
  await page.waitForTimeout(1500); await where('start');
  for (let i = 0; i < 4; i++) { await vis(page.getByText('Next', { exact: true })).click(); await page.waitForTimeout(900); await where('after next ' + (i + 1)); }
  await vis(page.locator('[role="radio"][aria-label^="Lagoon"]')).click(); await page.waitForTimeout(400);
  await vis(page.locator('[role="switch"]')).click(); await page.waitForTimeout(400);
  await page.screenshot({ path: S + '/v3/flow-5.png' });
  await vis(page.getByText('Next', { exact: true })).click(); await page.waitForTimeout(1200); await where('after personalize'); await settings('settings');
  await page.screenshot({ path: S + '/v3/flow-6.png' });
  await vis(page.getByText('Allow', { exact: true })).click(); await page.waitForTimeout(1500); await where('after allow'); await settings('settings');
  await page.screenshot({ path: S + '/v3/flow-7.png' });
  // back from step 7
  await vis(page.getByLabel('Back', { exact: true })).click(); await page.waitForTimeout(1200); await where('back from 7');
  await page.screenshot({ path: S + '/v3/flow-back.png' });
  await page.evaluate(() => window.__fallbackPreview.go('/settings/notifications')); await page.waitForTimeout(1200);
  await page.screenshot({ path: S + '/v3/flow-notif.png' });
  await page.evaluate(() => window.__fallbackPreview.go('/onboarding/hook')); await page.waitForTimeout(1500); await where('jump to hook');
  await browser.close();
})();
