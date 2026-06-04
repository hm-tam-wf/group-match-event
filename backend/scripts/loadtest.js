'use strict';
/**
 * loadtest.js — 500 user đăng ký đội đồng thời + kiểm chứng data/nhóm/thứ tự
 *
 * Chạy:
 *   SA_KEY_PATH=./serviceAccountKey.json node loadtest.js                       # burst (worst-case)
 *   SA_KEY_PATH=./serviceAccountKey.json node loadtest.js --from-active --gap 3  # số đội/slot THEO PROJECT, cách 3ms
 *   SA_KEY_PATH=./serviceAccountKey.json node loadtest.js --spread 120           # rải đều 120s
 *   SA_KEY_PATH=./serviceAccountKey.json node loadtest.js --no-retry             # tắt retry để so trước/sau
 *   SA_KEY_PATH=./serviceAccountKey.json node loadtest.js --cleanup
 *   SA_KEY_PATH=./serviceAccountKey.json node loadtest.js --cleanup-only loadtest-<ts>
 *
 * Số đội × slot: mặc định 50×10. --from-active → đọc CẤU HÌNH sự kiện đang mở (đúng số liệu project),
 *   nhưng GHI vào namespace test riêng (loadtest-<ts>) → KHÔNG đụng dữ liệu thật.
 * Nhịp đến: burst (mặc định) bắn cùng lúc; --gap <ms> cách nhau N ms/người; --spread <giây> rải đều cả cửa sổ.
 *
 * Tại sao 2 SDK?
 *   - firebase (client): GHI đi qua Security Rules → phản ánh đúng production
 *   - firebase-admin:    ĐỌC signups (bị khoá client) + dọn dẹp (bỏ qua Rules)
 */

const path = require('path');
const { initializeApp }    = require('firebase/app');
const { getFirestore, runTransaction, doc, serverTimestamp } = require('firebase/firestore');
const admin = require('firebase-admin');

// ── Client config (public — bảo mật qua Security Rules, không phải ẩn key) ───
const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyCddSYLOIQsYgp1bVrpWpdMHegRmZD3FEE',
  authDomain:        'icon-picker.firebaseapp.com',
  projectId:         'icon-picker',
  storageBucket:     'icon-picker.firebasestorage.app',
  messagingSenderId: '587236027049',
  appId:             '1:587236027049:web:d812f9abff01f0f20f97b8',
};

// ── Test params: mặc định 50 icons × 10 = 500 slots (ghi đè bởi --from-active) ─
let NUM_ICONS   = 50;
let CAPACITY    = 10;
let DEDUP_FIELD = 'employeeId';
// Danh sách cho phép: TAT cho load test (user tong hop khong nam trong allowlist nao). Giu false de
// mirror dung cau truc apiClaim ma khong lam hong test; bat len se khien moi claim tra 'notAllowed'.
let ALLOWLIST_MODE = false;
let ICONS = Array.from({ length: NUM_ICONS }, (_, i) => ({
  icon: `T${i}`, name: `Doi ${i}`, color: '#888',
}));

// Retry khi giao dịch NÉM lỗi tranh chấp (mirror y api.js). full/already/dup TRẢ VỀ → không retry.
const RETRY_MAX = 8, RETRY_BASE_MS = 150, RETRY_CAP_MS = 2500, RETRY_BUDGET_MS = 12000;

// ── CLI ────────────────────────────────────────────────────────────────────────
const args         = process.argv.slice(2);
const CLEANUP      = args.includes('--cleanup');
const NO_RETRY     = args.includes('--no-retry');
const FROM_ACTIVE  = args.includes('--from-active');
const cidx         = args.indexOf('--cleanup-only');
const CLEANUP_ONLY = cidx !== -1;
const OVERRIDE_ID  = CLEANUP_ONLY ? args[cidx + 1] : null;
const sidx         = args.indexOf('--spread');
const SPREAD_SEC   = sidx !== -1 ? Math.max(0, parseFloat(args[sidx + 1]) || 0) : 0;  // 0 = khong rai
const gidx         = args.indexOf('--gap');
const GAP_MS       = gidx !== -1 ? Math.max(0, parseFloat(args[gidx + 1]) || 0) : 0;  // ms giua moi nguoi
const STAGGERED    = SPREAD_SEC > 0 || GAP_MS > 0;                                    // co rai nhip → gate dung/sai

if (CLEANUP_ONLY && !OVERRIDE_ID) {
  console.error('Cu phap: node loadtest.js --cleanup-only loadtest-<timestamp>');
  process.exit(1);
}

const EVENT_ID = CLEANUP_ONLY ? OVERRIDE_ID : `loadtest-${Date.now()}`;

// ── SDK init ───────────────────────────────────────────────────────────────────
const SA_KEY_PATH = process.env.SA_KEY_PATH;
if (!SA_KEY_PATH) {
  console.error('Thieu bien moi truong SA_KEY_PATH.\nVD: SA_KEY_PATH=./serviceAccountKey.json node loadtest.js');
  process.exit(1);
}

const clientApp = initializeApp(FIREBASE_CONFIG);
const cdb       = getFirestore(clientApp);

admin.initializeApp({ credential: admin.credential.cert(path.resolve(SA_KEY_PATH)) });
const adb = admin.firestore();

// ── Helpers ────────────────────────────────────────────────────────────────────
const norm = v => String(v || '').trim().toUpperCase().replace(/\s+/g, '');

function calcStats(arr) {
  if (!arr.length) return { min: 0, median: 0, p95: 0, max: 0 };
  const s  = [...arr].sort((a, b) => a - b);
  const at = pct => s[Math.floor((s.length - 1) * pct / 100)];
  return { min: s[0], median: at(50), p95: at(95), max: s[s.length - 1] };
}

const evDoc = (col, id) => doc(cdb, 'events', EVENT_ID, col, id);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Phân loại lỗi NÉM ra để biết THỰC SỰ cái gì fail (không gộp hết vào 'error').
function classify(e) {
  const code = e && e.code ? String(e.code) : 'unknown';
  if (code.includes('permission-denied'))               return { reason: 'denied',      code };
  if (code.includes('aborted'))                         return { reason: 'aborted',     code };
  if (code.includes('unavailable') || code.includes('deadline')) return { reason: 'unavailable', code };
  return { reason: 'error', code };
}

// Xen kẽ user theo đội (round-robin) → arrival liên tiếp rơi vào CÁC đội khác nhau, giống thật.
// makeUsers gom nhóm theo đội; nếu bắn nguyên thứ tự đó thì cả 1 đội ập vào cùng lúc (tệ nhất, ảo).
function interleave(users) {
  const byIcon = {};
  for (const u of users) (byIcon[u.icon] = byIcon[u.icon] || []).push(u);
  const groups = Object.values(byIcon), out = [];
  for (let i = 0; ; i++) {
    let any = false;
    for (const g of groups) if (i < g.length) { out.push(g[i]); any = true; }
    if (!any) break;
  }
  return out;
}

// Bắn cả mảng claim theo nhịp đến:
//   --gap N    → người thứ i đến sau i×N ms (cách nhau đúng N ms — "vài mili-giây"), xen kẽ đội
//   --spread S → rải đều trong cửa sổ S giây + jitter (giống dòng người vài phút), xen kẽ đội
//   không cờ   → bắn đồng loạt (burst, tranh chấp cực đại)
function fireClaims(users) {
  if (GAP_MS > 0) {
    const ord = interleave(users);
    return Promise.all(ord.map((u, i) => sleep(GAP_MS * i).then(() => claim(u))));
  }
  if (SPREAD_SEC > 0) {
    const ord = interleave(users);
    const spanMs = SPREAD_SEC * 1000, slot = spanMs / ord.length;
    return Promise.all(ord.map((u, i) =>
      sleep(slot * i + Math.random() * slot).then(() => claim(u))));   // arrival tăng dần, lệch nhẹ
  }
  return Promise.all(users.map(claim));
}

// Đọc cấu hình SỰ KIỆN ĐANG MỞ (admin SDK) → lấy đúng số đội/slot/dedupField của project.
// Chỉ COPY tham số; vẫn ghi test vào loadtest-<ts> nên không đụng dữ liệu thật.
async function loadActiveConfig() {
  const act = await adb.doc('config/active').get();
  const aid = act.exists ? String(act.data().eventId || '').trim() : '';
  if (!aid) throw new Error('config/active.eventId rong — chua mo su kien nao. Vao admin "Mo su kien" truoc.');
  const cfgSnap = await adb.doc(`events/${aid}/meta/config`).get();
  if (!cfgSnap.exists) throw new Error(`events/${aid}/meta/config khong ton tai.`);
  const cfg = cfgSnap.data();
  if (Array.isArray(cfg.icons) && cfg.icons.length)         ICONS       = cfg.icons;
  if (typeof cfg.capacity === 'number')                     CAPACITY    = cfg.capacity;
  if (typeof cfg.dedupField === 'string' && cfg.dedupField) DEDUP_FIELD = cfg.dedupField;
  NUM_ICONS = ICONS.length;
  return aid;
}

// ── Data ───────────────────────────────────────────────────────────────────────
function makeUsers(startN, countPerIcon) {
  const users = [];
  let n = startN;
  for (const g of ICONS) {
    for (let k = 0; k < countPerIcon; k++) {
      n++;
      users.push({
        playerId: `u${String(n).padStart(5, '0')}`,
        icon: g.icon,
        fields: {
          name:          `Test User ${n}`,
          [DEDUP_FIELD]: `LT${String(n).padStart(6, '0')}`,   // giá trị dedup duy nhất (theo field của project)
        },
      });
    }
  }
  return users;
}

// ── claim() — sao y apiClaim (kể cả vòng retry jitter), dung modular SDK → di qua Security Rules ─
async function claim(u) {
  const teamRef   = evDoc('teams',      u.icon);
  const memberRef = evDoc('members',    u.playerId);
  const signupRef = evDoc('signups',    u.playerId);
  const dedupVal  = norm(u.fields[DEDUP_FIELD]);
  const dedupRef  = dedupVal ? evDoc('dedup_keys', dedupVal) : null;
  const allowVal  = (ALLOWLIST_MODE && DEDUP_FIELD) ? norm(u.fields[DEDUP_FIELD]) : '';
  const allowRef  = allowVal ? evDoc('allowlist', allowVal) : null;

  const runTx = () => runTransaction(cdb, async tx => {
    const [t, mb, dk, al] = await Promise.all([
      tx.get(teamRef),
      tx.get(memberRef),
      dedupRef ? tx.get(dedupRef) : Promise.resolve(null),
      allowRef ? tx.get(allowRef) : Promise.resolve(null),
    ]);
    // modular SDK: .exists() la HAM (khac compat SDK la thuoc tinh)
    if (mb.exists())       return { ok: false, reason: 'already' };
    if (dk && dk.exists()) return { ok: false, reason: 'dup' };
    if (allowRef && !al.exists()) return { ok: false, reason: 'notAllowed' };   // mirror apiClaim (TAT trong test)
    const count = t.exists() ? (t.data().count || 0) : 0;
    const names = t.exists() ? (t.data().names || []) : [];
    if (count >= CAPACITY) return { ok: false, reason: 'full' };
    const at = serverTimestamp();
    tx.set(teamRef,   { icon: u.icon, count: count + 1, names: [...names, u.fields.name] }, { merge: true });
    tx.set(memberRef, { icon: u.icon, at });
    if (dedupRef) tx.set(dedupRef, { at });
    tx.set(signupRef, { ...u.fields, playerId: u.playerId, icon: u.icon, at });
    return { ok: true };
  });

  // Mirror y vòng retry của apiClaim (--no-retry để so trước/sau). full/already/dup TRẢ VỀ → thoát ngay.
  const MAX_ATTEMPTS = NO_RETRY ? 1 : RETRY_MAX, BASE_MS = RETRY_BASE_MS, CAP_MS = RETRY_CAP_MS, BUDGET_MS = RETRY_BUDGET_MS;
  const t0 = Date.now();
  let attempts = 0, lastErr;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    attempts++;
    try {
      const r = await runTx();
      return { ...r, ms: Date.now() - t0, attempts, user: u };
    } catch (e) {
      lastErr = e;
      if (attempt === MAX_ATTEMPTS - 1 || Date.now() - t0 > BUDGET_MS) break;
      await sleep(Math.random() * Math.min(CAP_MS, BASE_MS * 2 ** attempt));   // full jitter
    }
  }
  const { reason, code } = classify(lastErr);
  return { ok: false, reason, code, detail: String(lastErr), ms: Date.now() - t0, attempts, user: u };
}

// ── Phase report ───────────────────────────────────────────────────────────────
function phaseReport(label, results, expected) {
  const cnt = key => results.filter(r => key === 'ok' ? r.ok : r.reason === key).length;
  console.log(`\n-- ${label} --`);
  console.table([{
    total:   results.length,
    ok:      cnt('ok'),
    full:    cnt('full'),
    already: cnt('already'),
    dup:     cnt('dup'),
    denied:  cnt('denied'),       // PERMISSION_DENIED (rule từ chối)
    aborted: cnt('aborted'),      // tranh chấp doc nóng, cạn budget retry
    unavail: cnt('unavailable'),  // mạng / deadline
    error:   cnt('error'),        // còn lại
  }]);
  console.log(`Ty le thanh cong: ${(cnt('ok') / results.length * 100).toFixed(1)}%`);
  const okRows = results.filter(r => r.ok);
  if (okRows.length) {
    const s = calcStats(okRows.map(r => r.ms));
    console.log(`Timing ok tx (ms): min=${s.min}  med=${s.median}  p95=${s.p95}  max=${s.max}`);
    const ts = calcStats(okRows.map(r => r.attempts || 1));
    console.log(`So lan thu (ok):   med=${ts.median}  max=${ts.max}`);   // >1 nghĩa là retry đã cứu
  }
  // In mau loi (moi loai NEM ra) de phan tich nguyen nhan that su
  const THROWN = ['error', 'denied', 'aborted', 'unavailable'];
  const errors = results.filter(r => THROWN.includes(r.reason)).slice(0, 5);
  if (errors.length) {
    console.log(`Sample errors (${errors.length} shown):`);
    errors.forEach(r => console.log(`  [${r.user.playerId}/${r.user.icon}] (${r.code || r.reason}) ${r.detail}`));
  }
  if (!expected) { console.log('(baseline — khong tinh PASS/FAIL)'); return true; }
  const pass = Object.entries(expected).every(([k, v]) => cnt(k) === v);
  console.log(`Ky vong: ${JSON.stringify(expected)}  =>  ${pass ? 'PASS' : 'FAIL'}`);
  return pass;
}

// ── Verify (admin doc lại Firestore) ─────────────────────────────────────────
async function verify(okResults) {
  console.log('\n== Kiem chung (admin doc lai Firestore) ==');
  const sent = new Map(okResults.map(r => [r.user.playerId, r.user]));

  const [teamSnap, suSnap, dkSnap] = await Promise.all([
    adb.collection(`events/${EVENT_ID}/teams`).get(),
    adb.collection(`events/${EVENT_ID}/signups`).orderBy('at').get(),
    adb.collection(`events/${EVENT_ID}/dedup_keys`).get(),
  ]);

  const teams = {};
  teamSnap.forEach(d => { teams[d.id] = d.data(); });
  const signups  = suSnap.docs.map(d => d.data());
  const sumCount = Object.values(teams).reduce((s, t) => s + (t.count || 0), 0);

  const checks = [
    ['(a) count <= CAPACITY va names.length == count (moi doi)',
      Object.values(teams).every(
        t => (t.count || 0) <= CAPACITY && (t.names || []).length === (t.count || 0))],
    ['(b) sum(count) == #signups == #ok',
      sumCount === signups.length && signups.length === okResults.length],
    ['(c) moi signup dung icon + dung data da gui',
      signups.every(s => {
        const u = sent.get(s.playerId);
        return u && s.icon === u.icon
                 && s.name === u.fields.name
                 && s[DEDUP_FIELD] === u.fields[DEDUP_FIELD];
      })],
    ['(d) #dedup_keys == #ok', dkSnap.size === okResults.length],
  ];

  console.table(checks.map(([c, p]) => ({ check: c, result: p ? 'PASS' : 'FAIL' })));

  // Thu tu ghi nhan tung doi (mang names = thu tu commit)
  console.log('\n-- Thu tu ghi nhan tung doi --');
  Object.entries(teams)
    .sort((a, b) => parseInt(a[0].slice(1)) - parseInt(b[0].slice(1)))
    .forEach(([icon, t]) =>
      console.log(`  ${icon.padEnd(4)} (${t.count}/${CAPACITY}): ${(t.names || []).join(' > ')}`));

  // Thu tu toan cuc (theo at)
  const fmt = s => `${s.name}[${s.icon}]`;
  console.log('\n-- Thu tu toan cuc (theo at) --');
  console.log('  10 dau :', signups.slice(0, 10).map(fmt).join(' > '));
  if (signups.length > 20) console.log('  ...');
  console.log('  10 cuoi:', signups.slice(-10).map(fmt).join(' > '));
  console.log(`  Tong: ${signups.length} signups, ${Object.keys(teams).length} doi`);

  return checks.every(([, p]) => p);
}

// ── Cleanup ────────────────────────────────────────────────────────────────────
async function wipe(eventId) {
  console.log(`\nDon dep: events/${eventId}`);
  for (const c of ['teams', 'members', 'dedup_keys', 'signups', 'meta']) {
    const snap = await adb.collection(`events/${eventId}/${c}`).get();
    if (snap.empty) continue;
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = adb.batch();
      snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    console.log(`  Da xoa ${snap.size} docs <- ${c}`);
  }
  console.log('  Done.');
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  if (CLEANUP_ONLY) { await wipe(EVENT_ID); return; }

  // Lấy số đội/slot từ project nếu yêu cầu (đọc trước khi in header để in đúng số liệu).
  let srcNote = 'tham so co dinh';
  if (FROM_ACTIVE) {
    process.stdout.write('\n[Config] Doc cau hinh su kien dang mo... ');
    const aid = await loadActiveConfig();
    srcNote = `theo su kien dang mo "${aid}"`;
    console.log('Done.');
  }

  const SEP  = '='.repeat(66);
  const MODE = GAP_MS > 0     ? `gap ${GAP_MS}ms/nguoi`
             : SPREAD_SEC > 0 ? `spread ${SPREAD_SEC}s`
             :                  'burst (stress baseline)';
  console.log(`\n${SEP}`);
  console.log(`LOAD TEST -- ${EVENT_ID}`);
  console.log(`${NUM_ICONS} doi x CAPACITY ${CAPACITY} = ${NUM_ICONS * CAPACITY} slots tong  (${srcNote})`);
  console.log(`Che do: ${MODE}  |  retry: ${NO_RETRY ? 'TAT' : `max ${RETRY_MAX}, budget ${RETRY_BUDGET_MS / 1000}s`}`);
  console.log(SEP);

  // Setup
  process.stdout.write('\n[Setup] Tao meta/config... ');
  await adb.doc(`events/${EVENT_ID}/meta/config`).set({
    title: 'LOAD TEST', subtitle: '',
    fields: [
      { key: 'name',       label: 'Ho ten',   type: 'text', required: true },
      { key: DEDUP_FIELD,  label: DEDUP_FIELD, type: 'text', required: true },
    ],
    icons: ICONS, capacity: CAPACITY,
    dedupField: DEDUP_FIELD, blockDup: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('Done.');

  // Phase 1 — lap day 500 slot
  process.stdout.write(`\n[Phase 1] Ban ${NUM_ICONS * CAPACITY} claim (${MODE})... `);
  const users1   = makeUsers(0, CAPACITY);
  const t0P1     = Date.now();
  const results1 = await fireClaims(users1);
  const wallP1   = Date.now() - t0P1;
  const okP1     = results1.filter(r => r.ok).length;
  console.log(`Done. ${wallP1}ms | ${(okP1 / (wallP1 / 1000)).toFixed(1)} ok/s`);
  // burst la kich ban nhan tao → chi bao so lieu (baseline), KHONG gate PASS/FAIL.
  // spread (giong that) → ky vong 500/500 ok, day moi la tin hieu dung/sai.
  const passP1 = phaseReport(
    `Phase 1 -- lap day ${NUM_ICONS * CAPACITY} slot`, results1,
    STAGGERED ? { ok: NUM_ICONS * CAPACITY } : null,
  );

  // Verify ngay sau Phase 1 (truoc khi Phase 2/3 them data)
  const passVeri = await verify(results1.filter(r => r.ok));

  // Phan bo thoi gian tat ca Phase 1
  const s = calcStats(results1.map(r => r.ms));
  console.log(`\nPhan bo thoi gian ${results1.length} tx (ms): min=${s.min}  med=${s.median}  p95=${s.p95}  max=${s.max}`);

  // Phase 2 — top-up: ky vong DONG theo so slot con trong sau Phase 1 (khong gia dinh doi da day).
  process.stdout.write('\n[Phase 2] Ban 100 user top-up cac doi... ');
  const p2users = makeUsers(NUM_ICONS * CAPACITY, 2);
  const filled  = {};
  results1.filter(r => r.ok).forEach(r => { filled[r.user.icon] = (filled[r.user.icon] || 0) + 1; });
  let expOkP2 = 0;
  for (const u of p2users) {                       // mo phong tuan tu: con cho thi ok, day thi 'full'
    const cur = filled[u.icon] || 0;
    if (cur < CAPACITY) { expOkP2++; filled[u.icon] = cur + 1; }
  }
  const results2 = await fireClaims(p2users);
  console.log('Done.');
  // chi gate khi co rai nhip (giong that, it tranh chap); burst → baseline.
  const passP2 = phaseReport('Phase 2 -- top-up', results2,
    STAGGERED ? { ok: expOkP2, full: p2users.length - expOkP2 } : null);

  // Phase 3 — already + dup (sau Phase 2)
  const okUsers = results1.filter(r => r.ok).slice(0, 5).map(r => r.user);
  let passP3 = true;
  if (okUsers.length < 5) {
    console.log('\n[Phase 3] Bo qua: khong du 5 user ok tu Phase 1.');
  } else {
    process.stdout.write('\n[Phase 3] Kiem already + dup... ');
    const alreadyBatch = okUsers.map(u => ({ ...u }));
    const dupBatch     = okUsers.map((u, i) => ({
      playerId: `uDUP${String(i + 1).padStart(4, '0')}`,
      icon:     u.icon,
      fields:   { ...u.fields },
    }));
    const results3 = await Promise.all([...alreadyBatch, ...dupBatch].map(claim));
    console.log('Done.');
    passP3 = phaseReport('Phase 3 -- already + dup', results3, { already: 5, dup: 5, ok: 0 });
  }

  // Summary
  const gate = STAGGERED ? 'PASS' : 'baseline';   // burst khong gate P1/P2
  console.log(`\n${SEP}`);
  console.log(`KET QUA TONG  (che do: ${MODE})`);
  console.table([
    { phase: 'Phase 1 (lap day slot)',  ket_qua: passP1   ? gate : 'FAIL' },
    { phase: 'Phase 2 (top-up)',        ket_qua: passP2   ? gate : 'FAIL' },
    { phase: 'Phase 3 (already + dup)', ket_qua: passP3   ? 'PASS' : 'FAIL' },
    { phase: 'Invariants (a)-(d)',      ket_qua: passVeri ? 'PASS' : 'FAIL' },
  ]);
  if (!STAGGERED) console.log('Luu y: burst la stress baseline (nhan tao). Them --gap 3 hoac --spread 120 de kiem chung tai THAT.');
  console.log(`\nData test: events/${EVENT_ID}`);
  if (CLEANUP) {
    await wipe(EVENT_ID);
  } else {
    console.log(`Don dep: SA_KEY_PATH=... node loadtest.js --cleanup-only ${EVENT_ID}`);
  }
}

main()
  .catch(e => { console.error('\n[ERROR]', e); process.exit(1); })
  .finally(() => process.exit(0));
