// hosts.js — Domain → sự kiện mặc định của domain (doc config/hosts.byHost).
// Trang sự kiện mở KHÔNG có ?e= trên một domain có trong map sẽ vào ĐÚNG sự kiện đó thay vì sự kiện đang mở
// (config/active) — vd GitHub Pages = bản demo, không đụng sự kiện thật. Thứ tự FE: ?e= > config/hosts > config/active.
// Chạy (từ thư mục gốc repo):
//   node backend/scripts/hosts.js                                              # liệt kê map hiện tại
//   node backend/scripts/hosts.js --set hm-tam-wf.github.io=event-demo         # XEM TRƯỚC (không ghi)
//   node backend/scripts/hosts.js --set hm-tam-wf.github.io=event-demo --apply # ghi thật
//   node backend/scripts/hosts.js --remove localhost --apply
// --set / --remove lặp lại được. --key <service-account.json> (mặc định GOOGLE_APPLICATION_CREDENTIALS, rồi ./serviceAccountKey.json).
// Sự kiện đích phải có events/<id>/meta/config (tránh map vào sự kiện không tồn tại) — --force để bỏ qua kiểm tra.
// firebase-admin dùng quyền admin (bỏ qua rules). Có FIRESTORE_EMULATOR_HOST ⇒ đọc/ghi emulator. CommonJS.
'use strict';

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const PROJECT_ID  = 'icon-picker';   // mặc định; ưu tiên project_id trong service account key
const HOSTS_DOC   = 'config/hosts';
const EVENT_ID_RE = /^[a-z0-9][a-z0-9-]{0,99}$/;   // = EVENT_ID_RE trong fe/js/config/theme.js
// = location.hostname (chữ thường, KHÔNG kèm cổng): localhost, 127.0.0.1, hm-tam-wf.github.io …
const HOST_RE = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;

function printHelp() {
  console.log([
    'Domain → sự kiện mặc định (config/hosts.byHost).',
    '  node backend/scripts/hosts.js                                   liệt kê',
    '  node backend/scripts/hosts.js --set <domain>=<id-sự-kiện>       xem trước thay đổi',
    '  node backend/scripts/hosts.js --remove <domain>                 xem trước thay đổi',
    '  thêm --apply để ghi thật; --force bỏ qua kiểm tra sự kiện tồn tại; --key <file.json> chọn service account',
  ].join('\n'));
}

function parseArgs(argv) {
  const out = { set: [], remove: [], apply: false, force: false, help: false, key: undefined };
  for (let i = 2; i < argv.length; i++) {
    let token = argv[i];
    let value;
    const eq = token.indexOf('=');
    if (token.startsWith('--') && eq !== -1) { value = token.slice(eq + 1); token = token.slice(0, eq); }
    if (token === '--apply') out.apply = true;
    else if (token === '--force') out.force = true;
    else if (token === '--help' || token === '-h') out.help = true;
    else if (token === '--set' || token === '--remove' || token === '--key') {
      if (value === undefined) {
        value = argv[++i];
        if (value === undefined || value.startsWith('--')) throw new Error(`Thiếu giá trị cho tham số ${token}.`);
      }
      if (token === '--key') out.key = value;
      else out[token.slice(2)].push(value);
    } else {
      throw new Error(`Tham số không hợp lệ: ${token}. Chạy với --help để xem cách dùng.`);
    }
  }
  return out;
}

function resolveKeyPath(args) {
  if (args.key) return path.resolve(args.key);
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  return path.resolve(process.cwd(), 'serviceAccountKey.json');
}

// Đọc + kiểm hình dạng service account. KHÔNG BAO GIỜ in nội dung key.
function loadServiceAccount(keyPath) {
  let obj;
  try {
    obj = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  } catch (err) {
    throw new Error(`Không đọc được service account key (${err.code === 'ENOENT' ? 'không tìm thấy file' : 'không phải JSON hợp lệ'}): ${keyPath}`);
  }
  if (!obj || obj.type !== 'service_account' || typeof obj.private_key !== 'string' || typeof obj.client_email !== 'string') {
    throw new Error(`File không phải service account key (thiếu private_key/client_email): ${keyPath}`);
  }
  return obj;
}

// Map hiện tại + các thay đổi ⇒ map mới (không đụng object gốc).
function applyChanges(current, sets, removes) {
  const next = Object.assign({}, current);
  sets.forEach(([host, id]) => { next[host] = id; });
  removes.forEach(host => { delete next[host]; });
  return next;
}

function readMap(snap) {
  const m = snap.exists ? snap.data().byHost : null;
  return (m && typeof m === 'object' && !Array.isArray(m)) ? m : {};
}

function printMap(title, map) {
  const hosts = Object.keys(map).sort();
  console.log(title + (hosts.length ? '' : ' (trống)'));
  hosts.forEach(h => console.log(`  ${h}  →  ${map[h]}`));
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); return; }

  const sets = args.set.map(s => {
    const i = s.indexOf('=');
    if (i <= 0) throw new Error(`--set cần dạng <domain>=<id-sự-kiện>, nhận được: "${s}"`);
    const host = s.slice(0, i).trim().toLowerCase();
    const id = s.slice(i + 1).trim();
    if (!HOST_RE.test(host)) throw new Error(`Domain không hợp lệ (chữ thường, không kèm http:// hay cổng): "${host}"`);
    if (!EVENT_ID_RE.test(id)) throw new Error(`ID sự kiện không hợp lệ (a-z, 0-9, "-"; ≤100 ký tự): "${id}"`);
    return [host, id];
  });
  const removes = args.remove.map(h => {
    const host = h.trim().toLowerCase();
    if (!HOST_RE.test(host)) throw new Error(`Domain không hợp lệ: "${host}"`);
    return host;
  });

  const sa = loadServiceAccount(resolveKeyPath(args));
  const projectId = sa.project_id || PROJECT_ID;
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId });
  const db = admin.firestore();
  const target = process.env.FIRESTORE_EMULATOR_HOST ? `EMULATOR ${process.env.FIRESTORE_EMULATOR_HOST}` : 'PRODUCTION';
  console.log(`Project: ${projectId} (${target})`);

  const ref = db.doc(HOSTS_DOC);
  const current = readMap(await ref.get());
  if (!sets.length && !removes.length) { printMap(`${HOSTS_DOC}:`, current); return; }

  if (!args.force) {
    for (const [, id] of sets) {
      const cfg = await db.doc(`events/${id}/meta/config`).get();
      if (!cfg.exists) throw new Error(`Không tìm thấy sự kiện "${id}" (events/${id}/meta/config). Thêm --force nếu cố ý.`);
    }
  }
  removes.forEach(h => { if (!(h in current)) console.log(`  (bỏ qua --remove ${h}: domain không có trong map)`); });

  printMap('Hiện tại:', current);
  printMap('Sau khi đổi:', applyChanges(current, sets, removes));
  if (!args.apply) { console.log('XEM TRƯỚC — chưa ghi gì. Thêm --apply để ghi.'); return; }

  // Ghi trong transaction: tính lại trên bản mới nhất ⇒ không đè mất thay đổi chen giữa.
  await db.runTransaction(async tx => {
    const fresh = readMap(await tx.get(ref));
    tx.set(ref, { byHost: applyChanges(fresh, sets, removes), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  });
  console.log(`Đã ghi ${HOSTS_DOC}.`);
}

main().catch(err => {
  console.error('❌ ' + (err && err.message ? err.message : err));
  process.exitCode = 1;
});
