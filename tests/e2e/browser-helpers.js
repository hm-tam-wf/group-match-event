'use strict';
// Hạ tầng Layer B (trình duyệt thật qua puppeteer-core): static server phục vụ fe/ của repo cần test + helper thao tác UI.
// App trỏ vào emulator mà KHÔNG sửa file repo: server vá firebase-config.js (projectId demo-* + useEmulator) khi phục vụ.
// Vá hỏng ⇒ trả 500 + suite FAIL (không bao giờ phục vụ bản gốc trỏ production); trình duyệt còn chặn DNS firestore.googleapis.com.
const http = require('http'), fs = require('fs'), path = require('path');
const C = require('../lib/config');
const L = require('../lib/firestore');
const { launch } = require('../lib/browser');
const { dedupKey, sleep, makeDevice, claim } = L;
const J = x => JSON.stringify(x);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };

const FE = path.join(C.REPO, 'fe');
const FIREBASE_CONFIG_JS = '/js/config/firebase-config.js';
const VIEWPORT = { width: 480, height: 1100 };
const srv = { failMem: false, server: null, port: 0, fatal: null };
const errs = [];
const contexts = new Set();
let browser = null;

function patchFirebaseConfig(t) {
  const out = t.replace(/projectId:\s*"[^"]*"/, `projectId: "${C.PROJECT}"`)
    .replace(/db\s*=\s*firebase\.firestore\(\);/, m => `${m} db.useEmulator("${C.EMU_HOST}", ${C.ports.firestore});`);
  if (!out.includes('useEmulator') || !out.includes(`projectId: "${C.PROJECT}"`)) {
    throw new Error(`vá ${FIREBASE_CONFIG_JS} không áp dụng được (file đổi cấu trúc?) — sửa patchFirebaseConfig trong tests/e2e/browser-helpers.js`);
  }
  return out;
}

function startServer() {
  return new Promise((res, rej) => {
    const s = http.createServer((req, rsp) => {
      try {
        let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
        const f = path.join(FE, p);
        if (!f.startsWith(FE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end('nf'); }
        let body = fs.readFileSync(f);
        if (p === FIREBASE_CONFIG_JS) body = Buffer.from(patchFirebaseConfig(body.toString('utf8')));
        if (p === '/js/data/api.js' && srv.failMem) {   // mô phỏng apiMyMembership lỗi mạng (hàm thật trả undefined khi catch)
          body = Buffer.from(body.toString('utf8') + '\napiMyMembership = async function () { return undefined; };\n');
        }
        rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); rsp.end(body);
      } catch (e) {
        srv.fatal = srv.fatal || e; errs.push('[server] ' + e.message);
        rsp.writeHead(500); rsp.end('test server error');
      }
    });
    s.once('error', rej);
    s.listen(0, C.EMU_HOST, () => { srv.server = s; srv.port = s.address().port; res(); });
  });
}

// Bật static server + trình duyệt. Kiểm vá firebase-config TRƯỚC khi mở trang nào.
async function start() {
  patchFirebaseConfig(fs.readFileSync(path.join(FE, FIREBASE_CONFIG_JS), 'utf8'));
  await startServer();
  browser = await launch();
  return browser;
}
// Đóng mọi context case quên đóng (kể cả khi case ném lỗi giữa chừng).
async function closeContexts() {
  for (const ctx of contexts) await ctx.close().catch(() => {});
  contexts.clear();
}
async function stop() {
  await closeContexts();
  if (browser) await browser.close().catch(() => {});
  if (srv.server) srv.server.close();
  browser = null; srv.server = null;
  if (errs.length) { console.log('\n[console/page errors thu được]'); [...new Set(errs)].slice(0, 20).forEach(e => console.log('  ' + e)); }
}
const baseUrl = () => `http://${C.EMU_HOST}:${srv.port}/`;

const EID = L.EVENT;
const LSK = k => `linhthu:${k}:${EID}`;

// opts.seed: localStorage nạp trước khi trang chạy; opts.wait: chờ app tải xong state; opts.path: trang + query (mặc định index.html, vd 'index.html?e=abc').
async function openDevice(br, label, { seed, wait = true, path: pagePath = 'index.html' } = {}) {
  const ctx = await br.createBrowserContext();
  contexts.add(ctx);
  const page = await ctx.newPage();
  await page.setViewport(VIEWPORT);
  await page.setCacheEnabled(false);
  page.on('pageerror', e => errs.push(`[${label}] pageerror: ${String(e).slice(0, 200)}`));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|fonts\.g|ERR_|net::|Failed to load resource/i.test(m.text())) errs.push(`[${label}] console.error: ${m.text().slice(0, 200)}`); });
  if (seed) await page.evaluateOnNewDocument((entries) => { try { if (!localStorage.getItem('__seeded')) { localStorage.setItem('__seeded', '1'); for (const [k, v] of entries) localStorage.setItem(k, v); } } catch (e) {} }, Object.entries(seed));
  const dev = { label, ctx, page, path: pagePath };
  await load(dev, wait);
  return dev;
}
async function instrument(page) {
  await page.evaluate(() => { window.__claims = []; const o = window.apiClaim; window.apiClaim = function (p) { window.__claims.push(p.icon); return o.apply(this, arguments); }; });
}
async function load(dev, wait = true, reload = false) {
  const { page } = dev;
  if (reload) await page.reload({ waitUntil: 'domcontentloaded' }); else await page.goto(baseUrl() + dev.path, { waitUntil: 'domcontentloaded' });
  if (wait) {
    await page.waitForFunction(() => { try { return stateLoaded === true && !document.getElementById('appContent').hidden; } catch (e) { return false; } }, { timeout: 30000 });
    await sleep(300);
  }
  await instrument(page);
}
const until = (dev, fn, arg, timeout = 20000) => dev.page.waitForFunction(fn, { timeout, polling: 100 }, arg);

// Điền form lần đầu + lưu (DOM click: bỏ qua màn terminal-boot của theme tech).
async function enterName(dev, name) {
  await until(dev, () => !!document.getElementById('pmSave'));
  await dev.page.evaluate(n => { document.getElementById('f_name').value = n; document.getElementById('pmSave').click(); }, name);
}
async function ui(dev) {
  return dev.page.evaluate(() => {
    const q = s => document.querySelector(s);
    const tiles = [...document.querySelectorAll('#grid .tile')];
    const mates = [...document.querySelectorAll('#bannerWrap .ft-list li')].map(li => ({ t: li.textContent.replace(/^\s*\d+/, '').trim(), me: li.classList.contains('is-me') }));
    return {
      myIcon, remoteView: inRemoteView(), dupBlocked, allowBlocked, editing, pid: me.id, name: me.fields.name || '',
      banner: (q('#bannerWrap') || {}).innerText || '', rvNotMe: !!q('#rvNotMe'),
      sel: tiles.filter(t => t.classList.contains('sel')).length, tiles: tiles.length,
      profileModal: !!q('#profileModal'), cancelBtn: !!q('#pmCancel'), dupModal: !!q('#dupBlockedModal'), allowModal: !!q('#allowBlockedModal'),
      mates, badge: (q('#bannerWrap .ft-badge') || {}).textContent || '', roomName: (q('#bannerWrap .ft-name') || {}).textContent || '',
      claims: (window.__claims || []).length, toast: (q('#toast') || {}).textContent || '', lookupTitle: TEXT.lookup && TEXT.lookup.title,
    };
  });
}
async function clickTile(dev, icon) {   // mở confirm (KHÔNG bấm xác nhận)
  return dev.page.evaluate(ic => { const t = [...document.querySelectorAll('#grid .tile')].find(t => t.querySelector('.ic').textContent.trim() === ic); if (!t) return 'no-tile'; const b = t.querySelector('.pick'); if (!t.classList.contains('sel')) return 'disabled'; b.click(); return 'ok'; }, icon);
}
const confirmAll = dev => dev.page.evaluate(() => { document.querySelectorAll('#c1').forEach(b => b.click()); });
// Click CHUỘT THẬT (puppeteer page.click = di chuột + nhấn theo toạ độ), KHÔNG dùng el.click() qua evaluate (bỏ qua mọi lớp phủ). Trước khi click assert
// document.elementFromPoint(tâm nút) là chính nút hoặc con của nó ⇒ bắt được loader/toast/lớp phủ nào che nút.
async function realClick(dev, sel) {
  const r = await dev.page.evaluate(s => {
    const b = document.querySelector(s); if (!b) return 'no-element';
    b.scrollIntoView({ block: 'center' }); const q = b.getBoundingClientRect();
    const e = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
    return (e === b || b.contains(e)) ? 'ok' : 'covered-by:' + (e ? (e.id || e.className || e.tagName) : 'null');
  }, sel);
  if (r !== 'ok') throw new Error('realClick ' + sel + ' => ' + r);
  await dev.page.click(sel);
}
async function joinViaUI(dev, icon) {
  const r = await clickTile(dev, icon); if (r !== 'ok') throw new Error('clickTile ' + r);
  await realClick(dev, '#c1');   // nút xác nhận join: click chuột thật
}
async function waitJoined(dev, icon) { await until(dev, ic => myIcon === ic && !busy && !document.body.classList.contains('claiming'), icon, 25000); }
async function firstJoin(dev, name, icon) { await enterName(dev, name); await until(dev, () => !document.getElementById('profileModal') && document.querySelectorAll('#grid .tile.sel').length > 0, null, 25000); await joinViaUI(dev, icon); await waitJoined(dev, icon); }
async function settle(dev, ms = 700) { await sleep(ms); }
const roomBase = (icon) => L.EVENT_CFG.icons.find(i => i.icon === icon).name.split('·')[0].trim();
const seedFor = (pid, name) => ({ [LSK('me')]: J({ me: { id: pid, fields: { name } }, myIcon: null }), [LSK('dataEpoch')]: String(L.EVENT_CFG.dataEpoch), [LSK('reservedKey')]: dedupKey(name) });

// ── dùng chung các nhóm H/Q/W (so bất đối xứng + hộp xác nhận tên gần giống), allowlist tắt ──
const OFF_CFG = { allowlistMode: false };
const NAMES = { HUNG: 'Nguyễn Văn Hùng', HUNG2: 'Nguyễn Văn Hưng', HUNG_PART: 'Nguyễn Văn Hung', THANH: 'Nguyễn Văn Thanh', THANH2: 'Nguyễn Văn Thành' };
const regOff = (label, icon, name) => claim(makeDevice(label, { cfg: OFF_CFG }), icon, name);   // người khác đăng ký sẵn (thiết bị Node)
const waitSoft = (dev, timeout = 25000) => until(dev, () => !!document.getElementById('softConfirmModal'), null, timeout);
const softInfo = dev => dev.page.evaluate(() => {
  const m = document.getElementById('softConfirmModal'); if (!m) return null;
  return { toast: document.getElementById('toast').classList.contains('show'), text: m.innerText, cands: [...m.querySelectorAll('button[data-i]')].map(b => b.innerText), no: (document.getElementById('softNo') || {}).innerText || '' };
});
const clickSoft = (dev, sel) => realClick(dev, '#softConfirmModal ' + sel);   // click chuột thật + assert không bị che (loader, toast…)
const noSoftModal = async dev => !(await softInfo(dev));
const qState = u => J({ rv: u.remoteView, ic: u.myIcon, name: u.name, dupBlocked: u.dupBlocked, sel: u.sel, claims: u.claims });

module.exports = { srv, start, stop, closeContexts, baseUrl, EID, LSK, VIEWPORT, openDevice, instrument, load, until, enterName, ui, clickTile, confirmAll,
  realClick, joinViaUI, waitJoined, firstJoin, settle, roomBase, seedFor, OFF_CFG, NAMES, regOff, waitSoft, softInfo, clickSoft, noSoftModal, qState };
