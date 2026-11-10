'use strict';
// Admin (fe/admin.html THẬT) với Firebase GIẢ (mock-firebase.js, không mạng, không emulator) trong trình duyệt headless.
// Mỗi file tests/admin/cases/*.js chạy trong 1 context trình duyệt sạch; export { run(t) }.
// Dùng: node tests/admin/run.js [chuỗi lọc tên file…]
const path = require('path');
const { pathToFileURL } = require('url');
const C = require('../lib/config');
const { launch } = require('../lib/browser');
const { listCases } = require('../lib/discover');
const { createReport, exitLater } = require('../lib/report');
const { buildAdmin } = require('./build');

const VIEWPORT = { width: 1440, height: 900 };
const ERR_MAX = 200;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// t.ev(expr): Runtime.evaluate qua CDP (await promise, trả giá trị JSON); lỗi trong trang ⇒ chuỗi 'EVAL-EXC …' (không ném).
function makeContext(page, cdp, buildDir, report) {
  const errs = [];
  cdp.on('Runtime.exceptionThrown', p => { const d = p.exceptionDetails; errs.push(((d.exception && d.exception.description) || d.text || '').slice(0, ERR_MAX)); });
  const ev = async expr => {
    try {
      const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      return r.exceptionDetails ? 'EVAL-EXC ' + JSON.stringify(r.exceptionDetails).slice(0, ERR_MAX) : r.result.value;
    } catch (e) { return 'EVAL-ERR ' + e.message; }
  };
  const waitFor = async (expr, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(expr) === true) return true; await sleep(100); } return false; };
  return {
    page, cdp, buildDir, errs, ev, waitFor, sleep, ok: report.ok,
    url: query => pathToFileURL(path.join(buildDir, 'admin.html')).href + (query ? '?' + query : ''),
    navigate: url => cdp.send('Page.navigate', { url }),
  };
}

(async () => {
  const report = createReport('admin');
  let code = 0, browser = null;
  try {
    const cases = listCases(path.join(__dirname, 'cases'));
    const buildDir = path.join(C.OUT, 'admin-build');
    buildAdmin(path.join(C.REPO, 'fe'), buildDir);
    browser = await launch();
    for (const c of cases) {
      console.log(`\n=== ${c.file} ===`);
      const ctx = await browser.createBrowserContext();
      try {
        const page = await ctx.newPage();
        await page.setViewport(VIEWPORT);
        const cdp = await page.createCDPSession();
        const t = makeContext(page, cdp, buildDir, report);
        await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
        await require(c.path).run(t);
      } catch (e) { report.crash(c.file, e); }
      finally { await ctx.close().catch(() => {}); }
    }
  } catch (e) { console.error('SUITE ERROR', e); code = 2; }
  finally { if (browser) await browser.close().catch(() => {}); }
  const failed = report.summary();
  exitLater(code || (failed ? 1 : 0));
})();
