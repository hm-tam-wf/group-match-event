'use strict';
// Hạ tầng suite admin-e2e: fe/admin.html THẬT + Firestore & Auth Emulator (rules thật) + trình duyệt headless.
// Static server phục vụ fe/ của repo cần test và VÁ firebase-config.js khi phục vụ: projectId demo-*, Firestore + Auth trỏ emulator.
// Vá hỏng ⇒ 500 + FAIL (không bao giờ phục vụ bản gốc trỏ production). Tài khoản đăng nhập tạo bằng firebase-admin trên Auth Emulator:
//   root = UID gốc đầu tiên trong rules (isRootAdmin) · data = admin thêm bằng dữ liệu (admins/{uid}) · plain = đăng nhập được, không phải admin.
const http = require('http'), fs = require('fs'), path = require('path');
const C = require('../lib/config');
const L = require('../lib/firestore');
const { launch } = require('../lib/browser');
const XLSX = require('xlsx');

const FE = path.join(C.REPO, 'fe');
const FIREBASE_CONFIG_JS = '/js/config/firebase-config.js';
const FILES_DIR = path.join(C.OUT, 'admin-e2e-files');   // file .xlsx tạo tạm cho case nạp file mẫu
const SHOTS_DIR = path.join(C.OUT, 'admin-e2e-shots');   // ảnh minh hoạ (chỉ khi TEST_SHOTS=1)
const VIEWPORT = { width: 1440, height: 900 };
const PROTOCOL_TIMEOUT_MS = 60000;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const J = x => JSON.stringify(x);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// UID gốc đọc từ rules (danh sách cứng trong isRootAdmin) — test không chép UID vào code.
const rulesTxt = fs.readFileSync(C.RULES, 'utf8');
const ROOT_UIDS = ((/function isRootAdmin\(\)[\s\S]*?\[([^\]]*)\]/.exec(rulesTxt) || /request\.auth\.uid in \[([^\]]*)\]/.exec(rulesTxt) || [])[1] || '')
  .split(',').map(s => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
if (!ROOT_UIDS.length) throw new Error('không đọc được UID gốc trong ' + C.RULES + ' (isRootAdmin) — rules đổi mô hình admin? sửa tests/admin-e2e/lib.js');
const USERS = {
  root:  { uid: ROOT_UIDS[0], email: 'root@test.local', password: 'root-pass-123' },
  data:  { uid: 'dataAdminUid0001', email: 'data@test.local', password: 'data-pass-123' },
  plain: { uid: 'plainUserUid0001', email: 'plain@test.local', password: 'plain-pass-123' },
};

const srv = { server: null, port: 0, fatal: null };
const pageErrs = [], consoleErrs = [];
const contexts = new Set();
let browser = null, report = null;

function patchFirebaseConfig(t) {
  const out = t.replace(/projectId:\s*"[^"]*"/, `projectId: "${C.PROJECT}"`)
    .replace(/db\s*=\s*firebase\.firestore\(\);/, m => `${m} db.useEmulator("${C.EMU_HOST}", ${C.ports.firestore});`
      + ` if (firebase.auth) firebase.auth().useEmulator("http://${C.EMU_HOST}:${C.ports.auth}", { disableWarnings: true });`);
  if (!out.includes(`useEmulator("${C.EMU_HOST}", ${C.ports.firestore})`) || !out.includes(`projectId: "${C.PROJECT}"`) || !out.includes(`:${C.ports.auth}"`)) {
    throw new Error(`vá ${FIREBASE_CONFIG_JS} không áp dụng được (file đổi cấu trúc?) — sửa patchFirebaseConfig trong tests/admin-e2e/lib.js`);
  }
  return out;
}

function startServer() {
  return new Promise((res, rej) => {
    const s = http.createServer((req, rsp) => {
      try {
        let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/admin.html';
        const f = path.join(FE, p);
        if (!f.startsWith(FE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end('nf'); }
        let body = fs.readFileSync(f);
        if (p === FIREBASE_CONFIG_JS) body = Buffer.from(patchFirebaseConfig(body.toString('utf8')));
        rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); rsp.end(body);
      } catch (e) {
        srv.fatal = srv.fatal || e; pageErrs.push('[server] ' + e.message);
        rsp.writeHead(500); rsp.end('test server error');
      }
    });
    s.once('error', rej);
    s.listen(0, C.EMU_HOST, () => { srv.server = s; srv.port = s.address().port; res(); });
  });
}

async function createUsers() {
  const auth = L.admin.auth();   // FIREBASE_AUTH_EMULATOR_HOST do run.js đặt TRƯỚC khi nạp firebase-admin
  for (const u of Object.values(USERS)) {
    try { await auth.deleteUser(u.uid); } catch (e) { /* chưa có */ }
    await auth.createUser({ uid: u.uid, email: u.email, password: u.password });
  }
}

// Bật static server + tạo tài khoản Auth + trình duyệt. Kiểm vá firebase-config TRƯỚC khi mở trang nào.
async function start(rep) {
  report = rep;
  patchFirebaseConfig(fs.readFileSync(path.join(FE, FIREBASE_CONFIG_JS), 'utf8'));
  fs.mkdirSync(FILES_DIR, { recursive: true });
  if (C.SHOTS) fs.mkdirSync(SHOTS_DIR, { recursive: true });
  await startServer();
  await createUsers();
  browser = await launch({ protocolTimeout: PROTOCOL_TIMEOUT_MS });
  return browser;
}
async function closeContexts() {
  for (const ctx of contexts) await ctx.close().catch(() => {});
  contexts.clear();
}
async function stop() {
  await closeContexts();
  if (browser) await browser.close().catch(() => {});
  if (srv.server) srv.server.close();
  browser = null; srv.server = null;
  if (consoleErrs.length) { console.log('\n[console.error thu được — tham khảo]'); [...new Set(consoleErrs)].slice(0, 20).forEach(e => console.log('  ' + e)); }
}
const baseUrl = () => `http://${C.EMU_HOST}:${srv.port}/`;

// ── ghi nhận: rec(id, tên, đạt?, info khi FAIL) ──
const rec = (id, name, pass, info) => report.ok(id + ' ' + name, pass, info);

// ── dữ liệu (admin SDK, bỏ qua rules) ──
const adb = L.adb, FV = L.admin.firestore.FieldValue, TS = L.admin.firestore.Timestamp;
const evRef = id => adb.collection('events').doc(id);
async function seedEvent(id, cfg, { active = false } = {}) {
  await evRef(id).collection('meta').doc('config').set(Object.assign({ createdAt: TS.now() }, cfg));
  await adb.doc('config/eventList').set({ ids: FV.arrayUnion(id) }, { merge: true });
  if (active) await adb.doc('config/active').set({ eventId: id });
}
async function getCfg(id) { const s = await evRef(id).collection('meta').doc('config').get(); return s.exists ? s.data() : null; }
async function listCol(id, c) { const s = await evRef(id).collection(c).get(); const o = {}; s.forEach(d => { o[d.id] = d.data(); }); return o; }
async function fresh() { await L.clearAll(); await adb.doc('config/active').set({ eventId: '' }); await adb.doc('config/eventList').set({ ids: [] }); }

const FIELDS = [{ key: 'name', label: 'Họ tên', type: 'text', required: true, placeholder: '' }, { key: 'employeeId', label: 'Mã NV', type: 'text', required: true, placeholder: '' }];
const ICONS = [{ icon: '🦊', name: 'Cáo', color: '#ff7a45' }, { icon: '🐉', name: 'Rồng', color: '#ff3b5c' }, { icon: '🦅', name: 'Đại Bàng', color: '#ffb13d' }];
const baseCfg = (title, extra) => Object.assign({ title, subtitle: '', fields: FIELDS, icons: ICONS, capacity: 5, caps: {}, openAt: null, closeAt: null,
  dedupField: 'employeeId', blockDup: true, allowlistMode: false, allowlistNameCheck: false, allowlistGenderCheck: false }, extra || {});
// So 2 object không phụ thuộc thứ tự key (canonical JSON).
function flatKeys(o, out = {}) { if (o && typeof o === 'object' && !Array.isArray(o)) Object.keys(o).forEach(k => { out[k] = 1; flatKeys(o[k], out); }); return out; }
const sorted = o => JSON.stringify(o, Object.keys(flatKeys(o)).sort());
const same = (a, b) => sorted(a) === sorted(b);
const dk = v => String(v || '').normalize('NFC').trim().toUpperCase().replace(/\s+/g, '');
const fk = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase().replace(/\s+/g, '');
const RH = ['STT', 'Tên phòng', 'Số giường', 'Giới tính', 'Team', 'Emoji'];
function xlsxFile(name, people, rooms) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(people), 'Nhân sự');
  if (rooms) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rooms), 'Phòng');
  const f = path.join(FILES_DIR, name); XLSX.writeFile(wb, f); return f;
}

// ── trình duyệt ──
async function openAdmin(who, { width = VIEWPORT.width, height = VIEWPORT.height, label = who } = {}) {
  const ctx = await browser.createBrowserContext();
  contexts.add(ctx);
  const page = await ctx.newPage();
  await page.setViewport({ width, height });
  await page.setCacheEnabled(false);
  page.on('pageerror', e => pageErrs.push(`[${label}] ${String(e && (e.stack || e.message) || e).slice(0, 400)}`));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|fonts\.g|net::ERR|Failed to load resource/i.test(m.text())) consoleErrs.push(`[${label}] ${m.text().slice(0, 300)}`); });
  page.on('dialog', d => { pageErrs.push(`[${label}] native dialog: ${d.message()}`); d.dismiss(); });
  await page.goto(baseUrl() + 'admin.html', { waitUntil: 'domcontentloaded' });
  if (who) await login(page, USERS[who]);
  return { ctx, page };
}
async function login(page, u) {
  await page.waitForSelector('#loginView:not([hidden])', { timeout: 20000 });
  await page.type('#email', u.email); await page.type('#password', u.password);
  await page.click('#btnLogin');
  await page.waitForSelector('#adminView:not([hidden])', { timeout: 20000 });
  await page.waitForFunction(() => document.getElementById('bootView').hidden, { timeout: 20000 });
}
const until = (page, fn, arg, ms = 10000) => page.waitForFunction(fn, { timeout: ms, polling: 100 }, arg);
// Chờ hết View Transition khi đổi trang (lớp phủ của transition nuốt click khoảng 300ms).
async function clickTab(page, tabId) { await page.click(`.tab[data-tab="${tabId}"]`); await until(page, t => document.getElementById(t).classList.contains('active'), tabId); await sleep(700); }
// Hộp xác nhận: chờ lớp phủ gỡ HẲN (đang mờ dần vẫn chặn click).
async function confirmYes(page, { text } = {}) {
  await page.waitForSelector('.cm-bg .cm-confirm', { timeout: 10000 });
  if (text != null) await page.type('.cm-bg .cm-input', text);
  await page.click('.cm-bg .cm-confirm');
  await until(page, () => !document.querySelector('.cm-bg'), null, 5000);
}
async function confirmNo(page) { await page.waitForSelector('.cm-bg .cm-cancel'); await page.click('.cm-bg .cm-cancel'); await until(page, () => !document.querySelector('.cm-bg'), null, 5000); }
async function modalText(page) { return page.evaluate(() => { const b = document.querySelector('.cm-bg:not(.is-leaving) .cm-box'); return b ? b.innerText : ''; }); }
async function setVal(page, sel, val) {
  await page.evaluate((s, v) => { const el = document.querySelector(s); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, sel, val);
}
async function waitText(page, sel, re, ms = 15000) {
  try { await page.waitForFunction(([s, r]) => { const e = document.querySelector(s); return !!e && new RegExp(r).test(e.textContent); }, { timeout: ms, polling: 100 }, [sel, re.source]); }
  catch (e) { const t = await page.$eval(sel, x => x.textContent).catch(() => '?'); throw new Error(`chờ ${sel} ~ /${re.source}/ quá hạn; đang là: ${t}`); }
}
async function waitDrawerClosed(page, ms = 15000) {
  try { await until(page, () => document.getElementById('createCard').hidden, null, ms); }
  catch (e) {
    const info = await page.evaluate(() => ({ err: document.getElementById('formErr').textContent, modal: (document.querySelector('.cm-bg .cm-box') || {}).innerText || '',
      pane: document.getElementById('dpId').hidden ? 'cfg' : 'id', btn: document.getElementById('btnSave').textContent })).catch(x => String(x));
    throw new Error('form sự kiện không đóng: ' + J(info));
  }
}
// Ảnh minh hoạ: chỉ khi TEST_SHOTS=1 (không ảnh hưởng kết quả); width/height ⇒ đổi viewport trước khi chụp.
async function shot(page, name, { width, height } = {}) {
  if (!C.SHOTS) return null;
  if (width) await page.setViewport({ width, height });
  await sleep(450);
  const f = path.join(SHOTS_DIR, name + '.png'); await page.screenshot({ path: f }); return f;
}
async function openEdit(page, id) {
  await clickTab(page, 'tabEvents');
  await page.waitForSelector(`#evListWrap [data-action="edit"][data-id="${id}"]`, { timeout: 10000 });
  await page.click(`#evListWrap [data-action="edit"][data-id="${id}"]`);
  await page.waitForSelector('#createCard:not([hidden])');
  await sleep(150);
}
async function newEvent(page, title) {
  await clickTab(page, 'tabEvents');
  await page.click('#btnNew'); await page.waitForSelector('#createCard:not([hidden])');
  await page.type('#fTitle', title);
  await page.click('#btnAddIcon');
  await setVal(page, '#iconsList .dyn-row:last-child .inp-label', 'Đội A');
}
async function typeCopy(page, lang, pathKey, text) {
  await page.click(`.seg-btn[data-lang="${lang}"]`);
  await setVal(page, '#cpSearch', pathKey);
  await page.waitForSelector(`.cp-in[data-path="${pathKey}"]`);
  await setVal(page, `.cp-in[data-path="${pathKey}"]`, text);
}
async function upload(page, sel, file) { const h = await page.$(sel); await h.uploadFile(file); }
async function uploadTpl(page, file) {   // xoá bản xem trước cũ ⇒ chờ đúng kết quả của file MỚI
  await page.evaluate(() => { document.getElementById('tplPreview').innerHTML = ''; });
  await upload(page, '#tplFile', file);
  await page.waitForSelector('#tplPreview .tpl-status', { timeout: 15000 });
}
// Bọc db.batch trong trang: ghi lại thứ tự set/delete theo đường dẫn (kiểm "ghi mới xong mới xoá cũ").
async function recBatches(page) {
  await page.evaluate(() => { if (window.__ops) return; window.__ops = []; const orig = db.batch.bind(db);
    db.batch = () => { const b = orig(); const s = b.set.bind(b), d = b.delete.bind(b);
      b.set = (r, ...a) => { window.__ops.push('set ' + r.path); return s(r, ...a); }; b.delete = r => { window.__ops.push('del ' + r.path); return d(r); }; return b; }; });
}

module.exports = { C, L, XLSX, J, sleep, USERS, ROOT_UIDS, srv, pageErrs, start, stop, closeContexts, baseUrl, browser: () => browser, rec,
  adb, FV, TS, evRef, seedEvent, getCfg, listCol, fresh, FIELDS, ICONS, baseCfg, same, dk, fk, RH, xlsxFile,
  openAdmin, login, until, clickTab, confirmYes, confirmNo, modalText, setVal, waitText, waitDrawerClosed, shot, openEdit, newEvent, typeCopy,
  upload, uploadTpl, recBatches };
