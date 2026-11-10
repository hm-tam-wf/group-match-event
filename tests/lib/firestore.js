'use strict';
// Fixture Firestore dùng chung (e2e / rules / scripts) — CHỈ chạy trên Firestore Emulator, project demo-*.
// Nạp module này ⇒ FIRESTORE_EMULATOR_HOST trỏ emulator của bộ test: admin SDK (adb) BỎ QUA rules để seed/kiểm tra,
// client compat (makeDevice / rawClient) đi QUA rules như trình duyệt thật.
const path = require('path'), fs = require('fs');
const C = require('./config');
if (!/^demo-/.test(C.PROJECT)) throw new Error('fixture Firestore chỉ dùng project demo-* (emulator)');

const NL = String.fromCharCode(10);
const { REPO, PROJECT, EMU_HOST } = C;
const EMU_PORT = C.ports.firestore;
const EVENT = 'mini-outing-2026';                                    // id sự kiện của fixtures/event-config.json
process.env.FIRESTORE_EMULATOR_HOST = EMU_HOST + ':' + EMU_PORT;     // admin SDK → emulator
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

const admin = require('firebase-admin');
admin.initializeApp({ projectId: PROJECT });
const adb = admin.firestore();
const fbNs = require('firebase/compat/app'); require('firebase/compat/firestore');

// Bản sao meta/config của một sự kiện thật (không PII); Timestamp lưu dạng { "__ts": ms }.
const EVENT_CFG = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'event-config.json'), 'utf8'));
const revive = v => (v && typeof v === 'object' && v.__ts !== undefined) ? admin.firestore.Timestamp.fromMillis(v.__ts)
  : Array.isArray(v) ? v.map(revive) : (v && typeof v === 'object') ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)])) : v;

// Tên GIẢ (có dấu để thử chuẩn hoá). Tất cả "Nữ" vì mọi phòng của sự kiện fixture đều gắn Nữ.
const NAMED = ['Lê Thị Alpha', 'Trần Bích Beta', 'Phạm Gamma Test', 'Võ Delta Test', 'Đặng Epsilon Test'];
const FAKE = n => 'Fake Person ' + String(n).padStart(2, '0');
const ALLOW_NAMES = NAMED.concat(Array.from({ length: 60 }, (_, i) => FAKE(i + 1)));
const dedupKey = v => String(v || '').normalize('NFC').trim().toUpperCase().replace(/\s+/g, '');
// khoá fold (bỏ dấu/đ/hoa-thường/khoảng trắng) — viết lại độc lập với api.js để test đối chiếu
const foldKey = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase().replace(/\s+/g, '');
// khoá M của tên CÓ dấu: "m~" + fold (doc dedup_keys riêng, chỉ tên có dấu ghi)
const mKey = v => 'm~' + foldKey(v);
const ICONS = EVENT_CFG.icons.map(i => i.icon);

const ev = () => adb.collection('events').doc(EVENT);

async function clearAll() {
  const r = await fetch(`http://${EMU_HOST}:${EMU_PORT}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  if (!r.ok) throw new Error('clear failed ' + r.status);
}
// Reset + seed: config/active, meta/config (fixture), allowlist giả.
async function reset(cfgOverride) {
  await clearAll();
  await adb.collection('config').doc('active').set({ eventId: EVENT });
  await ev().collection('meta').doc('config').set(Object.assign(revive(EVENT_CFG), cfgOverride || {}));
  let b = adb.batch(), n = 0;
  for (const name of ALLOW_NAMES) {
    b.set(ev().collection('allowlist').doc(dedupKey(name)), { name, gender: 'Nữ' });
    if (++n % 400 === 0) { await b.commit(); b = adb.batch(); }
  }
  await b.commit();
}
// Ảnh chụp trạng thái server để assert.
async function snap() {
  const q = async c => { const s = await ev().collection(c).get(); const o = {}; s.forEach(d => o[d.id] = d.data()); return o; };
  const [teams, members, dedup, reg, signups] = await Promise.all(['teams', 'members', 'dedup_keys', 'reg_keys', 'signups'].map(q));
  return { teams, members, dedup, reg, signups };
}
const totalCount = s => Object.values(s.teams).reduce((a, t) => a + (t.count || 0), 0);
const totalNames = s => Object.values(s.teams).reduce((a, t) => a + (t.names || []).length, 0);

// ── "Thiết bị" Layer A: 1 scope hàm nạp NGUYÊN VĂN các file FE dưới đây (đúng thứ tự trong index.html) + 1 firebase app ──
// Thêm file FE mới vào luồng đăng ký (vd bước 2) ⇒ thêm vào DEVICE_SCRIPTS đúng vị trí như index.html.
const DEVICE_SCRIPTS = ['config/config.js', 'config/firebase-config.js', 'data/storage.js', 'data/api.js', 'ui/ui-utils.js'];
let devSeq = 0;
// opts.cfg: ghi đè meta/config của thiết bị (vd { allowlistMode: false }); opts.search: query giả cho location (vd '?e=abc').
function makeDevice(label, { cfg = {}, search = '' } = {}) {
  const app = fbNs.initializeApp({ projectId: PROJECT, apiKey: 'x' }, `dev-${label}-${++devSeq}`);
  const fdb = app.firestore(); fdb.useEmulator(EMU_HOST, EMU_PORT);
  const store = {};
  const sb = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, URL, Promise, JSON,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    document: { documentElement: { getAttribute: () => null, setAttribute() {}, lang: '' }, getElementById: () => null },
    navigator: {},
    location: { search, hostname: EMU_HOST, pathname: '/index.html', href: `http://${EMU_HOST}/index.html${search}` },
  };
  sb.window = sb;
  sb.firebase = { initializeApp() {}, firestore: Object.assign(() => fdb, { FieldValue: fbNs.firestore.FieldValue, Timestamp: fbNs.firestore.Timestamp }) };
  // KHÔNG dùng vm context: object tạo trong realm khác bị Firestore SDK từ chối ("custom Object object").
  // Nối nguyên văn các file thành 1 scope hàm (let/const/function dùng chung như <script> thường) trong cùng realm.
  const src = DEVICE_SCRIPTS.map(f => fs.readFileSync(path.join(REPO, 'fe/js', f), 'utf8')).join(NL + ';' + NL);
  const scope = new Function('window', 'document', 'localStorage', 'firebase', 'navigator', 'console', 'location',
    src + NL + ';return { run: c => eval(c) };')(sb, sb.document, sb.localStorage, sb.firebase, sb.navigator, console, sb.location);
  sb.__run = scope.run;
  const c = Object.assign({}, revive(EVENT_CFG), cfg);
  scope.run(`EVENT_ID=${JSON.stringify(EVENT)};FIELDS=${JSON.stringify(c.fields)};ICONS=${JSON.stringify(c.icons)};CAPACITY=${c.capacity};CAPS=${JSON.stringify(c.caps || {})};
    DEDUP_FIELD=${JSON.stringify(c.dedupField)};BLOCK_DUP=${c.blockDup};ALLOWLIST_MODE=${c.allowlistMode};ALLOWLIST_NAMECHECK=${!!c.allowlistNameCheck};
    ALLOWLIST_GENDERCHECK=${!!c.allowlistGenderCheck};`);
  const call = async (fn, ...args) => JSON.parse(JSON.stringify((await scope.run(fn)(...args)) ?? null));
  return { label, sb, fdb, store, call, pid: 'u' + label.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) + devSeq };
}
const claim = (dev, icon, name, pid) => dev.call('apiClaim', { icon, playerId: pid || dev.pid, fields: { name } });

// Client "trần" (không qua app code) để test rules. opts.uid ⇒ đăng nhập giả bằng mockUserToken (vd UID admin).
function rawClient(label, { uid } = {}) {
  const app = fbNs.initializeApp({ projectId: PROJECT, apiKey: 'x' }, `raw-${label}-${++devSeq}`);
  const fdb = app.firestore();
  fdb.useEmulator(EMU_HOST, EMU_PORT, uid ? { mockUserToken: { sub: uid, user_id: uid } } : undefined);
  return { app, fdb, col: n => fdb.collection('events').doc(EVENT).collection(n), FV: fbNs.firestore.FieldValue };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = { REPO, PROJECT, EMU_HOST, EMU_PORT, EVENT, admin, adb, fbNs, EVENT_CFG, revive, NAMED, FAKE, ALLOW_NAMES,
  dedupKey, foldKey, mKey, ICONS, ev, reset, clearAll, snap, totalCount, totalNames, DEVICE_SCRIPTS, makeDevice, claim, rawClient, sleep };
