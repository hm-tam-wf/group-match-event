'use strict';
/**
 * loadtest.js — 500 user đăng ký đội đồng thời + kiểm chứng data/nhóm/thứ tự
 *
 * Chạy:
 *   SA_KEY_PATH=./serviceAccountKey.json node loadtest.js
 *   SA_KEY_PATH=./serviceAccountKey.json node loadtest.js --cleanup
 *   SA_KEY_PATH=./serviceAccountKey.json node loadtest.js --cleanup-only loadtest-<ts>
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

// ── Test params: 50 icons × 10 = 500 slots ────────────────────────────────────
const NUM_ICONS   = 50;
const CAPACITY    = 10;
const DEDUP_FIELD = 'employeeId';
const ICONS = Array.from({ length: NUM_ICONS }, (_, i) => ({
  icon: `T${i}`, name: `Doi ${i}`, color: '#888',
}));

// ── CLI ────────────────────────────────────────────────────────────────────────
const args         = process.argv.slice(2);
const CLEANUP      = args.includes('--cleanup');
const cidx         = args.indexOf('--cleanup-only');
const CLEANUP_ONLY = cidx !== -1;
const OVERRIDE_ID  = CLEANUP_ONLY ? args[cidx + 1] : null;

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
          name:       `Test User ${n}`,
          employeeId: `EMP${String(n).padStart(6, '0')}`,
        },
      });
    }
  }
  return users;
}

// ── claim() — sao y apiClaim, dung modular SDK → di qua Security Rules ─────────
async function claim(u) {
  const teamRef   = evDoc('teams',      u.icon);
  const memberRef = evDoc('members',    u.playerId);
  const signupRef = evDoc('signups',    u.playerId);
  const dedupVal  = norm(u.fields[DEDUP_FIELD]);
  const dedupRef  = dedupVal ? evDoc('dedup_keys', dedupVal) : null;
  const t0 = Date.now();
  try {
    const r = await runTransaction(cdb, async tx => {
      const [t, mb, dk] = await Promise.all([
        tx.get(teamRef),
        tx.get(memberRef),
        dedupRef ? tx.get(dedupRef) : Promise.resolve(null),
      ]);
      // modular SDK: .exists() la HAM (khac compat SDK la thuoc tinh)
      if (mb.exists())       return { ok: false, reason: 'already' };
      if (dk && dk.exists()) return { ok: false, reason: 'dup' };
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
    return { ...r, ms: Date.now() - t0, user: u };
  } catch (e) {
    return { ok: false, reason: 'error', detail: String(e), ms: Date.now() - t0, user: u };
  }
}

// ── Phase report ───────────────────────────────────────────────────────────────
function phaseReport(label, results, expected) {
  const cnt = key => results.filter(r => key === 'ok' ? r.ok : r.reason === key).length;
  console.log(`\n-- ${label} --`);
  console.table([{
    total: results.length,
    ok:      cnt('ok'),
    full:    cnt('full'),
    already: cnt('already'),
    dup:     cnt('dup'),
    error:   cnt('error'),
  }]);
  const okMs = results.filter(r => r.ok).map(r => r.ms);
  if (okMs.length) {
    const s = calcStats(okMs);
    console.log(`Timing ok tx (ms): min=${s.min}  med=${s.median}  p95=${s.p95}  max=${s.max}`);
  }
  // In mau error de phan tich nguyen nhan
  const errors = results.filter(r => r.reason === 'error').slice(0, 3);
  if (errors.length) {
    console.log(`Sample errors (${errors.length} shown):`);
    errors.forEach(r => console.log(`  [${r.user.playerId}/${r.user.icon}] ${r.detail}`));
  }
  if (!expected) return true;
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
                 && s.employeeId === u.fields.employeeId;
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

  const SEP = '='.repeat(66);
  console.log(`\n${SEP}`);
  console.log(`LOAD TEST -- ${EVENT_ID}`);
  console.log(`${NUM_ICONS} doi x CAPACITY ${CAPACITY} = ${NUM_ICONS * CAPACITY} slots tong`);
  console.log(SEP);

  // Setup
  process.stdout.write('\n[Setup] Tao meta/config... ');
  await adb.doc(`events/${EVENT_ID}/meta/config`).set({
    title: 'LOAD TEST', subtitle: '',
    fields: [
      { key: 'name',       label: 'Ho ten', type: 'text', required: true },
      { key: 'employeeId', label: 'MSNV',   type: 'text', required: true },
    ],
    icons: ICONS, capacity: CAPACITY,
    dedupField: DEDUP_FIELD, blockDup: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('Done.');

  // Phase 1 — 500 dong thoi
  process.stdout.write(`\n[Phase 1] Ban ${NUM_ICONS * CAPACITY} claim dong thoi... `);
  const users1   = makeUsers(0, CAPACITY);
  const t0P1     = Date.now();
  const results1 = await Promise.all(users1.map(claim));
  const wallP1   = Date.now() - t0P1;
  const okP1     = results1.filter(r => r.ok).length;
  console.log(`Done. ${wallP1}ms | ${(okP1 / (wallP1 / 1000)).toFixed(1)} ok/s`);
  const passP1 = phaseReport(
    'Phase 1 -- 500 dong thoi', results1,
    { ok: NUM_ICONS * CAPACITY, full: 0, already: 0, dup: 0, error: 0 },
  );

  // Verify ngay sau Phase 1 (truoc khi Phase 2/3 them data)
  const passVeri = await verify(results1.filter(r => r.ok));

  // Phan bo thoi gian tat ca Phase 1
  const s = calcStats(results1.map(r => r.ms));
  console.log(`\nPhan bo thoi gian 500 tx (ms): min=${s.min}  med=${s.median}  p95=${s.p95}  max=${s.max}`);

  // Phase 2 — vao doi da day (chay SAU verify de khong anh huong so lieu)
  process.stdout.write('\n[Phase 2] Ban 100 user vao doi da day (2/icon)... ');
  const results2 = await Promise.all(makeUsers(NUM_ICONS * CAPACITY, 2).map(claim));
  console.log('Done.');
  const passP2 = phaseReport('Phase 2 -- 100 full', results2, { ok: 0, full: 100 });

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
  console.log(`\n${SEP}`);
  console.log('KET QUA TONG');
  console.table([
    { phase: 'Phase 1 (500 dong thoi)',   ket_qua: passP1   ? 'PASS' : 'FAIL' },
    { phase: 'Phase 2 (100 vao doi day)', ket_qua: passP2   ? 'PASS' : 'FAIL' },
    { phase: 'Phase 3 (already + dup)',   ket_qua: passP3   ? 'PASS' : 'FAIL' },
    { phase: 'Invariants (a)-(d)',        ket_qua: passVeri ? 'PASS' : 'FAIL' },
  ]);
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
