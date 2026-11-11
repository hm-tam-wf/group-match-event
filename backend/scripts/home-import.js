// Nạp nội dung trang home (events/<id>/meta/home) từ file JSON hoặc Excel. Mặc định DRY-RUN (chỉ đọc).
// Chạy:  node backend/scripts/home-import.js --event <id> --file <home.json|home.xlsx> [--apply] [--key <sa.json>] [--project <id>]
//   --event <id>   : ID sự kiện (chữ thường/số/gạch ngang như form admin). Sự kiện PHẢI có meta/config (chặn gõ nhầm ID).
//   --file <path>  : .json theo schema documentation/md/HOME-TEMPLATE.md, hoặc .xlsx đúng định dạng "Xuất Excel" của trình soạn.
//   --apply        : ghi thật — set() TRỌN doc (thay toàn bộ trang home), rồi đọc lại để đối chiếu.
//   FIRESTORE_EMULATOR_HOST=host:port ⇒ chạy trên emulator (--project, mặc định icon-picker).
// Schema/validate dùng CHUNG với trang home + trình soạn admin: fe/js/home/home-schema.js (+ home-sheets.js cho Excel).
'use strict';
const fs = require('fs');
const path = require('path');
const HS = require('../../fe/js/home/home-schema.js');
const SH = require('../../fe/js/home/home-sheets.js');

const PROJECT_ID = 'icon-picker';
const MAX_DIFF_LINES = 60;
const SHORT_LEN = 60;
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const APPLY = args.includes('--apply');
const KEY_CANDIDATES = [arg('key', ''), path.resolve(process.cwd(), 'serviceAccountKey.json'), path.resolve(__dirname, '../../serviceAccountKey.json')].filter(Boolean);

const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(q => [q, x[q]])) : x));
const short = v => { const s = JSON.stringify(v); return s.length > SHORT_LEN ? s.slice(0, SHORT_LEN - 1) + '…' : s; };

function loadFile(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.json') return { raw: JSON.parse(fs.readFileSync(file, 'utf8')), errors: [], warnings: [] };
  if (ext === '.xlsx' || ext === '.xls') {
    const XLSX = require('xlsx');
    const res = SH.fromWorkbook(XLSX, XLSX.readFile(file));
    return { raw: res.doc, errors: res.errors, warnings: res.warnings };
  }
  throw new Error('--file phải là .json hoặc .xlsx: ' + file);
}

// Đường dẫn khác nhau giữa bản đang có (a) và bản mới (b): "+" thêm, "-" bỏ, "~" sửa.
function diff(a, b, p, out) {
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  const isMap = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (i >= a.length) out.push(`+ ${p}[${i}]`);
      else if (i >= b.length) out.push(`- ${p}[${i}]`);
      else diff(a[i], b[i], `${p}[${i}]`, out);
    }
  } else if (isMap(a) && isMap(b)) {
    for (const k of new Set(Object.keys(a).concat(Object.keys(b)))) {
      const q = p ? `${p}.${k}` : k;
      if (!(k in a)) out.push(`+ ${q}`);
      else if (!(k in b)) out.push(`- ${q}`);
      else diff(a[k], b[k], q, out);
    }
  } else out.push(`~ ${p}: ${short(a)} → ${short(b)}`);
  return out;
}

function summary(doc) {
  const lines = [`  pageTitle: ${short(doc.pageTitle)}`, `  hero.title: ${short(doc.hero.title)} · CTA: ${short(doc.cta.label)} → ${doc.cta.url || 'index.html?e=<id> (mặc định)'}`];
  doc.sections.forEach((s, i) => {
    const def = HS.TYPES[s.type];
    const counts = def ? Object.keys(def.lists).map(k => `${k}=${s[k].length}`).join(' ') : '(type lạ — giữ nguyên)';
    lines.push(`  ${i + 1}. [${s.type}] #sec-${s.id} ${short(s.title)} ${counts}`);
  });
  return lines.join('\n');
}

function initDb() {
  const admin = require('firebase-admin');
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    admin.initializeApp({ projectId: arg('project', PROJECT_ID) });
    console.log('*** EMULATOR ' + process.env.FIRESTORE_EMULATOR_HOST + ' ***');
  } else {
    const keyFile = KEY_CANDIDATES.find(f => fs.existsSync(f));
    if (!keyFile) throw new Error('không thấy serviceAccountKey.json: ' + KEY_CANDIDATES.join(' | '));
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyFile, 'utf8'))), projectId: PROJECT_ID });
  }
  return admin.firestore();
}

async function main() {
  const eventId = arg('event', '');
  const file = arg('file', '');
  if (!HS.EVENT_ID_RE.test(eventId)) throw new Error('--event không hợp lệ (chữ thường/số/gạch ngang): "' + eventId + '"');
  if (!file || !fs.existsSync(file)) throw new Error('--file không tồn tại: "' + file + '"');

  const src = loadFile(file);
  src.warnings.forEach(w => console.log(`  cảnh báo · sheet "${w.sheet}" dòng ${w.row}: ${w.msg}`));
  if (src.errors.length) {
    src.errors.forEach(e => console.log(`  LỖI · sheet "${e.sheet}"${e.row ? ' dòng ' + e.row : ''}: ${e.msg}`));
    throw new Error(`file có ${src.errors.length} lỗi — không ghi gì`);
  }
  const r = HS.validate(src.raw);
  r.warnings.forEach(w => console.log(`  cảnh báo · ${w.path || '(gốc)'}: ${w.msg}`));
  if (!r.ok) {
    r.errors.forEach(e => console.log(`  LỖI · ${e.path || '(gốc)'}: ${e.msg}`));
    throw new Error(`dữ liệu có ${r.errors.length} lỗi — không ghi gì`);
  }

  const db = initDb();
  if (!(await HS.configRef(db, eventId).get()).exists) throw new Error(`sự kiện "${eventId}" không có meta/config — kiểm tra lại --event`);
  const curSnap = await HS.homeRef(db, eventId).get();
  const cur = curSnap.exists ? HS.normalize(curSnap.data()) : null;

  console.log(`${APPLY ? '*** APPLY ***' : 'DRY-RUN (chỉ đọc)'} | events/${eventId}/meta/home ← ${file}`);
  console.log(summary(r.doc));
  if (!cur) console.log('Hiện CHƯA có meta/home ⇒ sẽ tạo mới.');
  else {
    const changes = diff(cur, r.doc, '', []);
    if (!changes.length) { console.log('Nội dung giống hệt bản đang có — không cần ghi.'); return; }
    console.log(`Khác bản đang có ở ${changes.length} chỗ:`);
    changes.slice(0, MAX_DIFF_LINES).forEach(c => console.log('  ' + c));
    if (changes.length > MAX_DIFF_LINES) console.log(`  … và ${changes.length - MAX_DIFF_LINES} chỗ nữa`);
  }
  if (!APPLY) { console.log('\nDRY-RUN: không ghi gì. Thêm --apply để ghi.'); return; }

  await HS.homeRef(db, eventId).set(r.doc);
  const back = HS.normalize((await HS.homeRef(db, eventId).get()).data());
  if (canon(back) !== canon(r.doc)) throw new Error('đã ghi nhưng đọc lại KHÔNG khớp — kiểm tra thủ công');
  console.log(`\nĐã ghi events/${eventId}/meta/home (${r.doc.sections.length} mục) — đọc lại khớp. Xem: home.html?e=${eventId}`);
}

main().then(() => process.exit(0)).catch(e => { console.error('LỖI:', e.message); process.exit(1); });
