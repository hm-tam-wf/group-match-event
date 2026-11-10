// Nhân bản 1 sự kiện sang ID mới (giống nút "Nhân bản" ở admin + tuỳ chọn chép Danh sách cho phép).
// Dùng để tạo sự kiện DEMO/thử nghiệm chạy cùng cấu hình sự kiện thật mà KHÔNG đụng dữ liệu đăng ký thật.
// Mặc định DRY-RUN (chỉ đọc).
// Chạy:  cd backend && node scripts/clone-event.js --to <id> [--from <id>] [--with-allowlist] [--key <sa.json>] [--apply]
//   --from <id>        : sự kiện nguồn; mặc định config/active.eventId.
//   --to <id>          : sự kiện đích (bắt buộc; chữ thường/số/gạch ngang như form admin). ĐÃ TỒN TẠI ⇒ dừng, không ghi đè.
//   --with-allowlist   : chép events/<from>/allowlist/* (cần khi allowlistMode/allowlistGenderCheck bật, vì giới lấy từ danh sách).
//   --apply            : ghi thật. Chỉ chép meta/config (+ allowlist); KHÔNG chép teams/members/signups/dedup_keys/reg_keys ⇒ sự kiện đích rỗng.
// Kèm: thêm <to> vào config/eventList.ids (như admin tạo sự kiện). KHÔNG đổi config/active.
'use strict';
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const PROJECT_ID = 'icon-picker';
const BATCH_SIZE = 400;
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const APPLY = args.includes('--apply');
const WITH_ALLOWLIST = args.includes('--with-allowlist');
const KEY_CANDIDATES = [arg('key', ''), path.resolve(process.cwd(), 'serviceAccountKey.json'), path.resolve(__dirname, '../../serviceAccountKey.json')].filter(Boolean);
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;            // y hệt kiểm tra ID ở form admin
const SKIP_FIELDS = new Set(['createdAt', 'updatedAt']);

async function main() {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    admin.initializeApp({ projectId: arg('project', PROJECT_ID) });
    console.log('*** EMULATOR ' + process.env.FIRESTORE_EMULATOR_HOST + ' ***');
  } else {
    const keyFile = KEY_CANDIDATES.find(f => fs.existsSync(f));
    if (!keyFile) throw new Error('khong thay serviceAccountKey.json: ' + KEY_CANDIDATES.join(' | '));
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyFile, 'utf8'))), projectId: PROJECT_ID });
  }
  const db = admin.firestore();
  const FV = admin.firestore.FieldValue;

  let from = arg('from', '');
  if (!from) { const act = await db.doc('config/active').get(); from = act.exists ? String(act.data().eventId || '') : ''; }
  const to = arg('to', '');
  if (!from) throw new Error('khong xac dinh duoc su kien nguon (truyen --from)');
  if (!to || !ID_RE.test(to)) throw new Error('--to khong hop le (chu thuong/so/gach ngang): "' + to + '"');
  if (to === from) throw new Error('--to trung --from');

  const srcCfgSnap = await db.doc(`events/${from}/meta/config`).get();
  if (!srcCfgSnap.exists) throw new Error(`su kien nguon "${from}" khong co meta/config`);
  if ((await db.doc(`events/${to}/meta/config`).get()).exists) throw new Error(`su kien dich "${to}" DA TON TAI — khong ghi de`);

  const src = srcCfgSnap.data() || {};
  const cfg = {};
  for (const [k, v] of Object.entries(src)) if (!SKIP_FIELDS.has(k)) cfg[k] = v;
  cfg.dataEpoch = 1;                                  // sự kiện mới ⇒ epoch đầu
  const allow = WITH_ALLOWLIST ? (await db.collection(`events/${from}/allowlist`).get()).docs : [];

  console.log((APPLY ? '*** APPLY ***' : 'DRY-RUN (chi doc)') + ` | ${from} -> ${to}`);
  console.log('meta/config fields: ' + Object.keys(cfg).sort().join(', '));
  console.log(`title = ${JSON.stringify(cfg.title || '')} | allowlistMode = ${cfg.allowlistMode} | allowlistGenderCheck = ${cfg.allowlistGenderCheck} | dedupField = ${cfg.dedupField}`);
  console.log('allowlist: ' + (WITH_ALLOWLIST ? allow.length + ' doc se chep' : 'KHONG chep (them --with-allowlist neu can)'));
  if (!WITH_ALLOWLIST && (cfg.allowlistMode || cfg.allowlistGenderCheck)) console.log('CANH BAO: nguon bat allowlist nhung khong chep ⇒ su kien dich se chan moi nguoi cho toi khi import danh sach.');
  if (!APPLY) { console.log('\nDRY-RUN: khong ghi gi. Them --apply de ghi.'); return; }

  await db.doc(`events/${to}/meta/config`).set(Object.assign({}, cfg, { createdAt: FV.serverTimestamp() }));
  for (let i = 0; i < allow.length; i += BATCH_SIZE) {
    const batch = db.batch();
    allow.slice(i, i + BATCH_SIZE).forEach(d => batch.set(db.doc(`events/${to}/allowlist/${d.id}`), d.data()));
    await batch.commit();
  }
  await db.doc('config/eventList').set({ ids: FV.arrayUnion(to) }, { merge: true });
  console.log(`\nDa tao events/${to}/meta/config` + (allow.length ? ` + ${allow.length} allowlist` : '') + ' + them vao config/eventList.');
}

main().then(() => process.exit(0)).catch(e => { console.error('LOI:', e.message); process.exit(1); });
