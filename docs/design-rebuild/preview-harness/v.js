// usage: node v.js <scheme> <name=route[@action]>...   screenshots at 1x into v3/
const { chromium } = require('playwright');
const S = '/tmp/claude-0/-home-user-fallbackv3/4065cf9b-48bb-5876-bcc5-38bb70a7fbe9/scratchpad';
(async () => {
  const [scheme, mode, ...specs] = process.argv.slice(2);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: scheme });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e.message).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 200)); });
  await page.goto('http://localhost:8767/', { waitUntil: 'load' });
  await page.addStyleTag({ content: "@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap'); #root *, body > div * { font-family: 'Nunito', system-ui, sans-serif !important; }" }).catch(() => {});
  await page.waitForTimeout(2500);
  const P = (fn, arg) => page.evaluate(fn, arg);
  if (mode === 'sample') { await P(() => window.__fallbackPreview.loadSample()); await page.waitForTimeout(2500); }
  else { await P(() => window.__fallbackPreview.go('/onboarding/concept')); await page.waitForTimeout(600); }
  let tasks = [];
  try { tasks = await P(async () => (await window.__fallbackPreview.repos.tasks.list()).map((t) => ({ id: t.id, name: t.name }))); } catch (e) {}
  const id = (n) => (tasks.find((t) => t.name === n) || {}).id;
  for (const spec of specs) {
    const [name, rest] = spec.split('=');
    let [route, ...actions] = rest.split('@');
    route = route.replace(/\{([^}]+)\}/g, (_, n) => id(n));
    await P((p) => window.__fallbackPreview.go(p), route); await page.waitForTimeout(1200);
    for (const a of actions) {
      if (a.startsWith('full')) { continue; }
      try { const loc = a.startsWith('label:') ? page.getByLabel(a.slice(6), { exact: true }) : page.getByText(a, { exact: true }); await loc.locator('visible=true').first().click({ timeout: 2500 }); await page.waitForTimeout(700); } catch (e) { errs.push('CLICKFAIL ' + name + ' ' + a); }
    }
    await page.screenshot({ path: `${S}/v3/${name}-${scheme}.png`, fullPage: actions.includes('full') });
  }
  console.log(errs.slice(0, 12).join('\n'));
  await browser.close();
})();
