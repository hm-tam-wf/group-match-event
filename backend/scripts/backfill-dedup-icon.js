// Backfill field `icon` (KHÔNG chứa PII) vào dedup_keys/{key} cũ để tính năng "xem đăng ký của tôi" (tra cứu chéo thiết bị)
// hoạt động với người đã chọn đội TRƯỚC khi bật cờ DEDUP_STORE_ICON. Mặc định DRY-RUN (chỉ đọc).
// Chạy:  cd backend && node scripts/backfill-dedup-icon.js [--event <id>] [--key <sa.json>] [--apply]
//   (không --apply)  : chỉ in bảng kế hoạch + tổng, KHÔNG ghi gì.
//   --apply          : update({icon}) cho các key đủ điều kiện (admin SDK bỏ qua rules).
//   --event <id>     : mặc định đọc config/active.eventId.
// Thêm (2026-11): chống trùng BẤT ĐỐI XỨNG theo tên (xem _dedupPlan ở fe/js/data/api.js): người đăng ký bằng tên CÓ DẤU phải có doc
// M = "m~" + fold (fold = bỏ dấu/hoa-thường/khoảng trắng) để người gõ KHÔNG dấu sau đó bị chặn. Script QUÉT TOÀN BỘ dedup_keys (không dựa vào
// members/signups — sót member thiếu signup, dữ liệu mâu thuẫn, key ứng nhiều pid, doc dedup còn giữ sau unjoin): mỗi id không phải doc M mà
// foldKey(id) ≠ id ⇒ tạo M bằng create() (KHÔNG đè). {at} lấy từ doc k1 sớm nhất; icon lấy từ doc k1 đầu tiên có icon (không có ⇒ bỏ icon).
// Tên khác nhau cùng fold ("Hùng"/"Hưng") dùng chung 1 M — KHÔNG phải lỗi (INFO). CONFLICT = có doc k1 CÓ DẤU mà fold trùng id của một doc k1
// KHÔNG dấu (= đã đăng ký đôi từ trước). Chạy với FIRESTORE_EMULATOR_HOST thì không cần service account (dùng để test trên emulator).
// Điều kiện backfill 1 key: dedup_keys/{key} tồn tại + CHƯA có icon + teams/{icon}.names chứa tên người đó
// (+ icon của members/{pid} khớp icon của signup nếu signup có). Còn lại in SKIP kèm lý do.
'use strict';
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const PROJECT_ID = 'icon-picker';
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const APPLY = args.includes('--apply');
const EVENT_ID = arg('event', '');
const KEY_CANDIDATES = [arg('key', ''), path.resolve(process.cwd(), 'serviceAccountKey.json'), path.resolve(__dirname, '../../serviceAccountKey.json')].filter(Boolean);
// y hệt _dedupKey ở fe/js/data/api.js:50
const dedupKey = v => String(v == null ? '' : v).normalize('NFC').trim().toUpperCase().replace(/\s+/g, '');
const M_PREFIX = 'm~';   // y hệt _dedupPlan.M ở api.js
// y hệt _foldKey = _normName(v) bỏ khoảng trắng ở fe/js/data/api.js (đ→d, bỏ dấu kết hợp U+0300..U+036F)
const foldKey = v => String(v == null ? '' : v).normalize('NFD').replace(new RegExp('[' + String.fromCharCode(768) + '-' + String.fromCharCode(879) + ']', 'g'), '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').trim().replace(/\s+/g, ' ').toUpperCase().replace(/\s+/g, '');

async function main() {
  if (process.env.FIRESTORE_EMULATOR_HOST) {            // EMULATOR: admin SDK tự trỏ vào emulator, không cần/không dùng service account
    admin.initializeApp({ projectId: arg('project', PROJECT_ID) });
    console.log('*** EMULATOR ' + process.env.FIRESTORE_EMULATOR_HOST + ' ***');
  } else {
    const keyFile = KEY_CANDIDATES.find(f => fs.existsSync(f));
    if (!keyFile) throw new Error('khong thay serviceAccountKey.json: ' + KEY_CANDIDATES.join(' | '));
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyFile, 'utf8'))), projectId: PROJECT_ID });
  }
  const db = admin.firestore();

  let eid = EVENT_ID;
  if (!eid) {
    const act = await db.collection('config').doc('active').get();
    eid = act.exists ? act.data().eventId : null;
  }
  if (!eid) throw new Error('khong xac dinh duoc EVENT_ID (truyen --event)');
  const ev = db.collection('events').doc(eid);
  const cfg = (await ev.collection('meta').doc('config').get()).data() || {};
  const dedupField = cfg.dedupField || 'name';
  console.log((APPLY ? '*** APPLY ***' : 'DRY-RUN (chi doc)') + ' | event = ' + eid + ' | dedupField = ' + dedupField);

  const [memSnap, sigSnap, teamSnap] = await Promise.all([
    ev.collection('members').get(), ev.collection('signups').get(), ev.collection('teams').get(),
  ]);
  const signups = new Map(sigSnap.docs.map(d => [d.id, d.data() || {}]));
  const teamNames = new Map(teamSnap.docs.map(d => [d.id, Array.isArray((d.data() || {}).names) ? d.data().names : []]));

  // Bước 1: gom member -> key; phát hiện 1 key map nhiều pid
  const rows = [];
  const byKey = new Map();
  for (const m of memSnap.docs) {
    const pid = m.id, icon = (m.data() || {}).icon;
    const s = signups.get(pid);
    const row = { pid, icon, name: s ? String(s.name || '').trim() : '', key: '', skip: '' };
    if (!icon) row.skip = 'member khong co icon';
    else if (!s) row.skip = 'thieu signup';
    else {
      row.key = dedupKey(s[dedupField]);
      row.fold = foldKey(s[dedupField]);
      if (!row.key) row.skip = 'signup thieu field ' + dedupField;
      else if (s.icon && String(s.icon) !== String(icon)) row.skip = 'mau thuan icon (signup=' + s.icon + ' vs member=' + icon + ')';
      else (byKey.get(row.key) || byKey.set(row.key, []).get(row.key)).push(row);
    }
    rows.push(row);
  }
  for (const [k, list] of byKey) {
    if (list.length > 1) list.forEach(r => { r.skip = '1 key map ' + list.length + ' pid'; });
  }

  // Bước 2: kiểm dedup_keys + teams.names
  for (const r of rows) {
    if (r.skip) continue;
    const dk = await ev.collection('dedup_keys').doc(r.key).get();
    if (!dk.exists) { r.skip = 'dedup_keys khong ton tai'; r.noDk = true; continue; }
    const cur = dk.data() || {};
    if (cur.icon) { r.skip = cur.icon === r.icon ? 'da co icon' : 'mau thuan icon (dedup_keys=' + cur.icon + ' vs member=' + r.icon + ')'; continue; }
    if (!(teamNames.get(r.icon) || []).includes(r.name)) { r.skip = 'teams/' + r.icon + '.names khong chua ten'; continue; }
  }

  // Bước 3: quét TOÀN BỘ dedup_keys → tạo doc M="m~"+fold cho mọi id CÓ DẤU (k1 ≠ fold). Không phụ thuộc members/signups.
  const dkAll = await ev.collection('dedup_keys').get();
  const ids = new Set(dkAll.docs.map(d => d.id));
  const byM = new Map();                       // M -> [{id, data}] (các doc k1 có dấu cùng fold)
  let nM = 0, nAscii = 0;
  for (const d of dkAll.docs) {
    if (d.id.startsWith(M_PREFIX)) { nM++; continue; }
    const f = foldKey(d.id);
    if (!f || f === d.id) { nAscii++; continue; }
    (byM.get(M_PREFIX + f) || byM.set(M_PREFIX + f, []).get(M_PREFIX + f)).push({ id: d.id, data: d.data() || {} });
  }
  const mCreate = [], conflicts = [], info = [];
  let mHave = 0, mNoIcon = 0;
  const iconByKey = new Map(rows.filter(r => r.key && r.icon).map(r => [r.key, r.icon]));
  const tsMs = x => (x && typeof x.toMillis === 'function') ? x.toMillis() : Infinity;
  for (const [mk, list] of byM) {
    const f = mk.slice(M_PREFIX.length);
    if (ids.has(f)) conflicts.push('CONFLICT fold=' + f.slice(0, 4) + '*** : doc KHONG dau "' + f + '"  <->  doc CO dau ' + list.map(x => '"' + x.id + '"').join(' ; '));
    if (list.length > 1) info.push('INFO nhom gan giong (fold=' + f.slice(0, 4) + '***, dung chung 1 doc M, KHONG phai loi): ' + list.map(x => '"' + x.id + '"').join(' , '));
    if (ids.has(mk)) { mHave++; continue; }
    list.sort((x, y) => tsMs(x.data.at) - tsMs(y.data.at));
    // icon: doc k1 đầu tiên có icon; chưa có (production hiện chưa backfill icon) ⇒ lấy từ members/signups (chỉ làm GỢI Ý icon, KHÔNG làm bộ lọc)
    const ic = list.map(x => x.data.icon || iconByKey.get(x.id)).find(Boolean) || null;
    if (!ic) mNoIcon++;
    mCreate.push({ mk, at: list[0].data.at || null, icon: ic });
  }

  // In bang ke hoach (khong in ten day du de han che PII: chi in key rut gon)
  const ok = rows.filter(r => !r.skip), skipped = rows.filter(r => r.skip);
  ok.forEach(r => console.log('BACKFILL pid=' + r.pid + ' key=' + r.key.slice(0, 4) + '*** icon=' + r.icon));
  skipped.forEach(r => console.log('SKIP     pid=' + r.pid + ' | ' + r.skip));
  const reasons = {};
  skipped.forEach(r => { const k = r.skip.replace(/\(.*\)|\d+ pid|teams\/\S+/g, '').trim(); reasons[k] = (reasons[k] || 0) + 1; });
  console.log('\nTONG: members=' + rows.length + ' | se backfill=' + ok.length + ' | skip=' + skipped.length);
  Object.entries(reasons).forEach(([k, n]) => console.log('   skip - ' + k + ': ' + n));

  console.log('\n--- DOC M (m~fold) cho ten CO DAU (quet toan bo dedup_keys) ---');
  mCreate.forEach(r => console.log('M-CREATE ' + r.mk.slice(0, 7) + '*** icon=' + (r.icon || '(khong co)')));
  info.forEach(m => console.log(m));
  conflicts.forEach(m => console.log(m));
  console.log('TONG M: dedup_keys=' + dkAll.size + ' | doc M da co=' + nM + ' | id khong dau=' + nAscii + ' | id co dau=' + (dkAll.size - nM - nAscii) + ' | M se tao=' + mCreate.length +
    ' (trong do khong xac dinh duoc icon=' + mNoIcon + ') | M ung vien da ton tai=' + mHave + ' | nhom gan giong=' + info.length + ' | CONFLICT=' + conflicts.length);

  if (!APPLY) { console.log('\nDRY-RUN: khong ghi gi. Them --apply de ghi.'); return; }
  let done = 0, gone = 0;
  for (const r of ok) {
    // update (KHÔNG set+merge): doc bị xoá giữa lúc đọc và ghi (admin gỡ đăng ký) ⇒ NOT_FOUND, không hồi sinh dedup_keys.
    try { await ev.collection('dedup_keys').doc(r.key).update({ icon: r.icon }); done++; }
    catch (e) { if (e && (e.code === 5 || /NOT_FOUND/.test(String(e.message)))) { gone++; console.log('BO QUA (doc da bi xoa) key=' + r.key.slice(0, 4) + '***'); } else throw e; }
  }
  let fdone = 0, fexist = 0;
  for (const r of mCreate) {
    // create() (KHÔNG set): M xuất hiện giữa lúc đọc và ghi (ai đó vừa join) => ALREADY_EXISTS, không đè.
    const doc = { at: r.at || admin.firestore.FieldValue.serverTimestamp() };
    if (r.icon) doc.icon = r.icon;
    try { await ev.collection('dedup_keys').doc(r.mk).create(doc); fdone++; }
    catch (e) { if (e && (e.code === 6 || /ALREADY_EXISTS/.test(String(e.message)))) { fexist++; console.log('BO QUA (M da ton tai) ' + r.mk.slice(0, 7) + '***'); } else throw e; }
  }
  console.log('Da tao ' + fdone + ' dedup_keys (M)' + (fexist ? ' | bo qua do da ton tai: ' + fexist : '') + '.');
  console.log('\nDa ghi ' + done + ' dedup_keys' + (gone ? ' | bo qua do da xoa: ' + gone : '') + '.');
}

main().then(() => process.exit(0)).catch(e => { console.error('LOI:', e.message || e); process.exit(1); });
