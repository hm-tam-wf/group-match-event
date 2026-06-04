// dedup-signups.js — DON h- so dang ky TRUNG MSNV (truoc khi tinh nang reg_keys ra doi, 2 nguoi cung MSNV
// co the tao 2 signup tien-join). Giu lai 1 h- so moi MSNV, xoa cac dong du.
//
//   Mac dinh DRY-RUN (chi LIET KE, KHONG xoa). Them `--apply` moi xoa that.
//   Chay:  node backend/scripts/dedup-signups.js            (xem truoc)
//          node backend/scripts/dedup-signups.js --apply    (xoa that)
//   Tham so phu (khong bat buoc): --event <eventId>  --field <dedupField>  --key <path-key.json>
//
// firebase-admin DUNG quyen admin -> BO QUA security rules (signups khoa read). CommonJS.
//
// Quy tac chon BAN GHI GIU LAI trong moi nhom cung MSNV:
//   1) Neu CO dong da JOIN (co `icon`) -> GIU dong do (thanh vien doi that), xoa cac dong CHUA join.
//      (dedup_keys o JOIN dam bao toi da 1 nguoi/MSNV vao doi -> moi nhom co toi da 1 dong da join.)
//   2) Neu KHONG dong nao join -> GIU dong SOM NHAT (theo `at`), xoa cac dong sau.
//   An toan: KHONG bao gio xoa mot dong da join. Neu mot nhom co >=2 dong da join (vi pham bat bien)
//   -> BO QUA nhom do, canh bao de nguoi dung xu ly tay. KHONG dung reg_keys/dedup_keys (giu nguyen).

'use strict';

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const PROJECT_ID = 'icon-picker';

// Chuan hoa GIONG HET _dedupKey o client (docs/js/data/api.js) de gom nhom khop tuyet doi.
function dedupKey(v) { return String(v == null ? '' : v).trim().toUpperCase().replace(/\s+/g, ''); }

// ── Phan tich tham so: --apply (co/khong), --event/--field/--key <value> (ho tro ca --flag=value). ──
function parseArgs(argv) {
  const args = { apply: false };
  for (let i = 2; i < argv.length; i++) {
    let token = argv[i];
    let inlineValue;
    const eq = token.indexOf('=');
    if (token.startsWith('--') && eq !== -1) { inlineValue = token.slice(eq + 1); token = token.slice(0, eq); }

    if (token === '--apply') { args.apply = true; continue; }
    if (token === '--event' || token === '--field' || token === '--key') {
      const name = token.slice(2);
      let value = inlineValue;
      if (value === undefined) {
        value = argv[i + 1];
        if (value === undefined || value.startsWith('--')) throw new Error(`Thiếu giá trị cho tham số ${token}.`);
        i++;
      }
      args[name] = value;
      continue;
    }
    if (token.startsWith('--')) {
      throw new Error(`Tham số không hợp lệ: ${token}. Hợp lệ: --apply, --event <id>, --field <key>, --key <path.json>`);
    }
  }
  return args;
}

// ── Tim service account key (giong export.js). KHONG BAO GIO in noi dung key. ──
function resolveKeyPath(args) {
  if (args.key) return path.resolve(args.key);
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  return path.resolve(process.cwd(), 'serviceAccountKey.json');
}
function printKeyHelp(keyPath, reason) {
  console.error('');
  console.error('❌ Không đọc được khóa dịch vụ (service account key).');
  if (reason) console.error(`   Lý do: ${reason}`);
  console.error(`   Đường dẫn đã thử: ${keyPath}`);
  console.error('   Lấy khóa: Firebase Console → Project settings → Service accounts → Generate new private key,');
  console.error('   lưu tên "serviceAccountKey.json" ở thư mục gốc dự án. Hoặc dùng: --key <đường-dẫn-key.json>');
  console.error('');
}
function loadServiceAccount(keyPath) {
  let raw;
  try { raw = fs.readFileSync(keyPath, 'utf8'); }
  catch (err) { printKeyHelp(keyPath, err.code === 'ENOENT' ? 'Không tìm thấy file.' : err.message); process.exit(1); }
  let obj;
  try { obj = JSON.parse(raw); }
  catch (err) { printKeyHelp(keyPath, 'File không phải JSON hợp lệ.'); process.exit(1); }
  if (!obj || typeof obj.private_key !== 'string' || typeof obj.client_email !== 'string' || obj.type !== 'service_account') {
    printKeyHelp(keyPath, 'File JSON không phải khóa service account (thiếu private_key/client_email hoặc type sai).');
    process.exit(1);
  }
  return obj;
}

// `at` (admin Firestore Timestamp) -> milli; thieu/null -> Infinity (xep CUOI khi tim "som nhat").
function atMillis(at) {
  if (at && typeof at.toMillis === 'function') return at.toMillis();
  if (at && typeof at.toDate === 'function') return at.toDate().getTime();
  return Infinity;
}
function fmtAt(at) {
  if (at && typeof at.toDate === 'function') {
    try { return at.toDate().toISOString(); } catch (e) { /* roi xuong duoi */ }
  }
  return '(không có thời gian)';
}

async function main() {
  const args = parseArgs(process.argv);
  const serviceAccount = loadServiceAccount(resolveKeyPath(args));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: PROJECT_ID });
  const db = admin.firestore();

  // ── 1) EVENT_ID: tu --event, hoac config/active.eventId ──
  let eventId = args.event;
  if (!eventId) {
    const active = await db.collection('config').doc('active').get();
    eventId = active.exists ? String((active.data() || {}).eventId || '').trim() : '';
  }
  if (!eventId) throw new Error('Không xác định được EVENT_ID (config/active.eventId trống). Truyền --event <id>.');

  const evRef = db.collection('events').doc(eventId);

  // ── 2) dedupField: tu --field, hoac meta/config.dedupField ──
  let dedupField = args.field;
  if (!dedupField) {
    const cfg = await evRef.collection('meta').doc('config').get();
    dedupField = cfg.exists ? String((cfg.data() || {}).dedupField || '').trim() : '';
  }
  if (!dedupField) throw new Error(`Sự kiện "${eventId}" không cấu hình dedupField → không có khái niệm "trùng" để dọn.`);

  console.log('');
  console.log(`📋 Sự kiện : ${eventId}`);
  console.log(`🔑 dedupField : ${dedupField}`);
  console.log(`⚙️  Chế độ : ${args.apply ? 'ÁP DỤNG (sẽ XOÁ thật)' : 'DRY-RUN (chỉ liệt kê)'}`);

  // ── 3) Doc toan bo signups, gom nhom theo dedupKey(<dedupField>) ──
  const snap = await evRef.collection('signups').get();
  const groups = new Map(); // key -> [{ pid, key, val, icon, at }]
  let skippedNoKey = 0;
  snap.docs.forEach(doc => {
    const d = doc.data() || {};
    const val = d[dedupField];
    const key = dedupKey(val);
    if (!key) { skippedNoKey++; return; }       // khong co MSNV -> khong tinh la "trung"
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ pid: doc.id, key, val, icon: d.icon || '', at: d.at });
  });

  console.log(`📦 Tổng signups: ${snap.size} (bỏ qua ${skippedNoKey} bản ghi không có ${dedupField}).`);

  // ── 4) Chon keeper + victims cho moi nhom >=2 ──
  const toDelete = [];                         // { pid, key, at }
  const manualGroups = [];                     // nhom >=2 dong da join -> can xem tay
  let dupGroupCount = 0;

  for (const [key, list] of groups) {
    if (list.length < 2) continue;             // khong trung -> bo qua
    dupGroupCount++;

    const joined = list.filter(s => s.icon);
    let keeper;
    if (joined.length >= 2) {                   // VI PHAM bat bien (dedup_keys le ra chan) -> khong tu xoa
      manualGroups.push({ key, list });
      continue;
    } else if (joined.length === 1) {
      keeper = joined[0];                        // giu dong da join
    } else {
      keeper = list.slice().sort((a, b) => atMillis(a.at) - atMillis(b.at))[0]; // giu dong som nhat
    }

    const victims = list.filter(s => s.pid !== keeper.pid);
    // An toan tuyet doi: KHONG xoa dong nao da join.
    if (victims.some(v => v.icon)) { manualGroups.push({ key, list }); continue; }

    console.log('');
    console.log(`  • MSNV ${key}  (giữ 1, xoá ${victims.length}):`);
    console.log(`      GIỮ   ${keeper.pid}  [${keeper.icon ? 'đã join ' + keeper.icon : 'chưa join'}]  ${fmtAt(keeper.at)}`);
    victims.forEach(v => {
      console.log(`      XOÁ   ${v.pid}  [chưa join]  ${fmtAt(v.at)}`);
      toDelete.push({ pid: v.pid, key, at: fmtAt(v.at) });
    });
  }

  // ── 5) Canh bao cac nhom can xem tay ──
  if (manualGroups.length) {
    console.log('');
    console.log(`⚠️  ${manualGroups.length} nhóm có ≥2 bản ghi ĐÃ JOIN (bất thường) — KHÔNG tự xoá, vui lòng xem tay:`);
    manualGroups.forEach(g => {
      console.log(`      MSNV ${g.key}: ` + g.list.map(s => `${s.pid}${s.icon ? '(' + s.icon + ')' : ''}`).join(', '));
    });
  }

  // ── 6) Tom tat / thuc thi ──
  console.log('');
  console.log(`📊 Nhóm trùng MSNV: ${dupGroupCount}  |  Bản ghi sẽ xoá: ${toDelete.length}`);

  if (!toDelete.length) {
    console.log('✅ Không có bản ghi dư để xoá.');
    console.log('');
    return;
  }

  if (!args.apply) {
    console.log('');
    console.log('ℹ️  ĐÂY LÀ DRY-RUN — chưa xoá gì. Kiểm tra danh sách trên, nếu đúng hãy chạy lại với:');
    console.log('      node backend/scripts/dedup-signups.js --apply');
    console.log('');
    return;
  }

  // --apply: xoa theo lo (batch toi da 400 thao tac).
  console.log('');
  console.log('🗑️  Đang xoá…');
  let done = 0;
  for (let i = 0; i < toDelete.length; i += 400) {
    const batch = db.batch();
    toDelete.slice(i, i + 400).forEach(v => batch.delete(evRef.collection('signups').doc(v.pid)));
    await batch.commit();
    done += Math.min(400, toDelete.length - i);
    console.log(`      …đã xoá ${done}/${toDelete.length}`);
  }
  console.log(`✅ Hoàn tất: đã xoá ${toDelete.length} hồ sơ trùng (giữ lại 1/nhóm).`);
  console.log('   Lưu ý: dedup_keys / reg_keys KHÔNG bị đụng (vẫn bảo vệ MSNV còn lại).');
  console.log('');
}

main().catch(err => {
  console.error('');
  console.error('❌ Lỗi khi dọn trùng:');
  console.error(`   ${err && err.message ? err.message : err}`);
  console.error('');
  process.exitCode = 1;
});
