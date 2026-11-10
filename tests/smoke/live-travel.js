'use strict';
// SMOKE TAY — CHỈ ĐỌC trên site thật (mặc định GitHub Pages; đổi bằng TEST_LIVE_BASE). KHÔNG chạy trong CI / npm test.
// travel.html → bấm "Chọn phòng" → index.html → gọi _travelSmoothBack() → phải về travel.html. Không submit form, không ghi dữ liệu.
// Thu: exception, console.error/warn, Log error/warn, HTTP >= 400, request lỗi. Chụp màn hình mỗi bước.
// Dùng: node tests/smoke/live-travel.js [outDir]   (mặc định tests/.out/smoke; W/H = kích thước màn hình, mặc định 390x844)
const path = require('path'), fs = require('fs');
const C = require('../lib/config');
const { launch } = require('../lib/browser');
const BASE = C.LIVE_BASE;
const outDir = path.resolve(process.argv[2] || path.join(C.OUT, 'smoke'));
const W = +(process.env.W || 390), H = +(process.env.H || 844);
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await launch({ allowProdFirestore: true, defaultViewport: null, args: [`--window-size=${W},${H}`] });
  try {
    const page = await browser.newPage();
    const cdp = await page.createCDPSession();
    let stage = 'init';
    const issues = [], reqUrl = {};
    cdp.on('Network.requestWillBeSent', p => { reqUrl[p.requestId] = p.request.url; });
    cdp.on('Runtime.exceptionThrown', p => { const d = p.exceptionDetails; issues.push([stage, 'EXC', ((d.exception && d.exception.description) || d.text || '').slice(0, 300)]); });
    cdp.on('Runtime.consoleAPICalled', p => {
      if (['error', 'warning', 'assert'].includes(p.type)) issues.push([stage, 'console.' + p.type, p.args.map(a => a.value !== undefined ? a.value : a.description).join(' ').slice(0, 300)]);
    });
    cdp.on('Log.entryAdded', p => { if (['error', 'warning'].includes(p.entry.level)) issues.push([stage, 'log.' + p.entry.level, (p.entry.text + ' ' + (p.entry.url || '')).slice(0, 300)]); });
    cdp.on('Network.responseReceived', p => { if (p.response.status >= 400) issues.push([stage, 'HTTP ' + p.response.status, p.response.url]); });
    cdp.on('Network.loadingFailed', p => { if (!p.canceled) issues.push([stage, 'NETFAIL ' + p.errorText, reqUrl[p.requestId] || p.requestId]); });
    const ev = async expr => {
      const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }).catch(e => ({ exceptionDetails: { text: e.message } }));
      return r.exceptionDetails ? 'EVAL-EXC ' + JSON.stringify(r.exceptionDetails).slice(0, 300) : r.result.value;
    };
    const shot = async name => {
      const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
      if (r && r.data) fs.writeFileSync(path.join(outDir, name), Buffer.from(r.data, 'base64'));
    };
    const waitFor = async (expr, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(expr) === true) return Date.now() - t0; await sleep(250); } return -1; };
    const VIS = `const vis = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && +getComputedStyle(el).opacity > 0.05;`;

    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Log.enable'); await cdp.send('Network.enable', {});
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });

    // 1) travel.html
    stage = 'travel';
    await cdp.send('Page.navigate', { url: BASE + 'travel.html' });
    const loaderMs = await waitFor(`(()=>{ ${VIS} return document.readyState === 'complete' && !vis(document.getElementById('travelLoader')); })()`, 15000);
    await sleep(1200);
    const travel = await ev(`(()=>{ ${VIS} const q = id => document.getElementById(id);
      const secs = {}; ['heroContainer','scheduleNavList','sec-timeline-content','sec-notes-content','sec-dresscode-content','sec-transport-content']
        .forEach(id => { const el = q(id); secs[id] = el ? el.querySelectorAll('*').length + ' el / ' + el.textContent.trim().length + ' ch' : 'MISSING'; });
      return JSON.stringify({ url: location.href, title: document.title, secs,
        brokenImgs: [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src),
        hScroll: document.documentElement.scrollWidth > innerWidth, ctaRooms: q('btnCtaRooms') && q('btnCtaRooms').getAttribute('href') }); })()`);
    console.log('[travel] loaderHiddenAfterMs=' + loaderMs, travel);
    await shot('live-1-travel.png');

    // 2) bấm "Chọn phòng" → index.html
    await ev(`document.getElementById('btnCtaRooms').click()`);
    const navMs = await waitFor(`location.pathname.endsWith('/index.html') && document.readyState === 'complete'`, 10000);
    stage = 'index';
    const bootMs = await waitFor(`(()=>{ ${VIS} return ['noEvent','appError','preOpen','eventClosed'].some(id => vis(document.getElementById(id)))
        || [...document.querySelectorAll('[id^="pm"]')].some(vis); })()`, 25000);
    await sleep(800);
    const index = await ev(`(()=>{ ${VIS} const st = {};
      ['appLoading','noEvent','appError','preOpen','eventClosed','appContent','profile','grid','taken'].forEach(id => st[id] = vis(document.getElementById(id)));
      return JSON.stringify({ url: location.href, referrer: document.referrer, eventId: typeof EVENT_ID !== 'undefined' ? EVENT_ID : '(n/a)',
        visible: st, pmIds: [...document.querySelectorAll('[id^="pm"]')].filter(vis).map(e => e.id),
        gridTiles: document.getElementById('grid') ? document.getElementById('grid').children.length : -1,
        travelBackFn: typeof _travelSmoothBack, hScroll: document.documentElement.scrollWidth > innerWidth }); })()`);
    console.log('[index] navMs=' + navMs + ' bootMs=' + bootMs, index);
    await shot('live-2-index.png');

    // 3) gọi đúng hàm quay lại của trang travel (không submit form, không ghi dữ liệu)
    stage = 'back';
    await ev(`_travelSmoothBack()`);
    const backMs = await waitFor(`location.pathname.endsWith('/travel.html') && document.readyState === 'complete'`, 8000);
    console.log('[back] travelAfterMs=' + backMs, await ev('location.href'));
    await sleep(1500);
    await shot('live-3-back.png');

    console.log('ISSUES (' + issues.length + '):'); issues.forEach(i => console.log('  ' + i.join(' | ')));
    console.log('Ảnh chụp: ' + outDir);
  } finally { await browser.close().catch(() => {}); }
})().catch(e => { console.error('FATAL', e); process.exit(1); });
