// contact sheet: node sheet.js out.png a.png b.png ...
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const [out, ...files] = process.argv.slice(2);
  const html = path.resolve(path.dirname(out), '_sheet.html');
  fs.writeFileSync(html, '<body style="margin:0;background:#777;display:flex;gap:10px;padding:10px;align-items:flex-start">' + files.map((f) => `<img src="${path.basename(f)}" style="width:320px;display:block">`).join('') + '</body>');
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: files.length * 330 + 10, height: 700 } });
  await p.goto('file://' + html); await p.waitForTimeout(500); await p.screenshot({ path: out, fullPage: true }); await b.close();
})();
