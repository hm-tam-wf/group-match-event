'use strict';
// SMOKE TAY — CHỈ ĐỌC trên site thật (TEST_LIVE_BASE): travel → "Chọn phòng" → index → _travelSmoothBack() → travel
// → history.back() → index: có bị trắng (body opacity 0 từ bfcache) không? Không submit form, không ghi dữ liệu. KHÔNG chạy trong CI.
// Dùng: node tests/smoke/live-bfcache.js [outDir]   (mặc định tests/.out/smoke)
const path = require('path'), fs = require('fs');
const C = require('../lib/config');
const { launch } = require('../lib/browser');
const BASE = C.LIVE_BASE;
const outDir = path.resolve(process.argv[2] || path.join(C.OUT, 'smoke'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await launch({ allowProdFirestore: true, defaultViewport: null, args: ['--window-size=390,844'] });
  try {
    const page = await browser.newPage();
    const cdp = await page.createCDPSession();
    const bfEvents = [];
    cdp.on('Page.backForwardCacheNotUsed', p => bfEvents.push(p.notRestoredExplanations.map(x => x.reason).join(',')));
    const ev = async expr => {
      const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }).catch(() => ({ exceptionDetails: {} }));
      return r.exceptionDetails ? 'EVAL-EXC' : r.result.value;
    };
    const waitFor = async (expr, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(expr) === true) return Date.now() - t0; await sleep(250); } return -1; };

    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Page.navigate', { url: BASE + 'travel.html' });
    await waitFor(`document.readyState === 'complete' && !!document.getElementById('btnCtaRooms')`, 15000);
    await sleep(3500);
    await ev(`document.getElementById('btnCtaRooms').click()`);
    await waitFor(`location.pathname.endsWith('/index.html') && document.readyState === 'complete'`, 10000);
    await sleep(6500);                                   // đợi boot + form hiện
    await ev(`_travelSmoothBack()`);
    await waitFor(`location.pathname.endsWith('/travel.html') && document.readyState === 'complete'`, 8000);
    await sleep(2500);
    await ev(`history.back()`);
    const backMs = await waitFor(`location.pathname.endsWith('/index.html')`, 8000);
    await sleep(2000);
    const st = await ev(`JSON.stringify({ url: location.href, navType: (performance.getEntriesByType('navigation')[0] || {}).type,
      bodyInlineOpacity: document.body.style.opacity, bodyComputedOpacity: getComputedStyle(document.body).opacity })`);
    console.log('[after history.back] ms=' + backMs, st, 'bfcacheNotUsed=' + JSON.stringify(bfEvents));
    const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
    if (r && r.data) fs.writeFileSync(path.join(outDir, 'live-4-bfcache.png'), Buffer.from(r.data, 'base64'));
    console.log('Ảnh chụp: ' + outDir);
  } finally { await browser.close().catch(() => {}); }
})().catch(e => { console.error('FATAL', e); process.exit(1); });
