// export.js — Xuat danh sach dang ky tu Firestore "signups" ra CSV (mo bang Excel / Google Sheets).
// Chay: `node export.js`  (hoac `npm run export`).
// firebase-admin DUNG quyen admin -> BO QUA security rules, nen doc duoc collection da khoa read.
// CommonJS (package.json khong co "type":"module").

'use strict';

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// ── Map emoji DOI -> ten tieng Viet. Khong co trong map thi dung lai chinh emoji. ──
const ICON_NAMES = {
  '🦊': 'Cáo',
  '🐉': 'Rồng',
  '🦅': 'Đại Bàng',
  '🦁': 'Sư Tử',
  '🐢': 'Rùa',
  '🦈': 'Cá Mập',
  '🐬': 'Cá Heo',
  '🐺': 'Sói',
  '🐙': 'Bạch Tuộc',
  '🦄': 'Kỳ Lân',
};

// Tieu de cot CSV (dung thu tu yeu cau).
const HEADERS = ['STT', 'Thời gian', 'Họ tên', 'Email', 'SĐT', 'Đội', 'Icon', 'PlayerID'];

const PROJECT_ID = 'icon-picker';

// ── Phan tich tham so dong lenh: --key <path>, --out <path> (khong phu thuoc thu tu). ──
// Ho tro ca dang `--key=<path>`. Token `--` la khong nhan dien -> bao loi than thien.
function parseArgs(argv) {
  const args = {};
  // Bat dau tu index 2: bo qua "node" va duong dan script.
  for (let i = 2; i < argv.length; i++) {
    let token = argv[i];
    let inlineValue; // gia tri dinh kem qua dang --flag=value

    // Tach dang --flag=value (chi tach o dau '=' dau tien).
    const eq = token.indexOf('=');
    if (token.startsWith('--') && eq !== -1) {
      inlineValue = token.slice(eq + 1);
      token = token.slice(0, eq);
    }

    if (token === '--key' || token === '--out') {
      const key = token === '--key' ? 'key' : 'out';
      let value = inlineValue;
      if (value === undefined) {
        value = argv[i + 1];
        // Co flag nhung thieu gia tri (hoac gia tri lai la mot flag khac) -> bao loi ngay.
        if (value === undefined || value.startsWith('--')) {
          throw new Error(`Thiếu giá trị cho tham số ${token}. Ví dụ: ${token} <đường-dẫn>`);
        }
        i++; // bo qua gia tri vua doc o vi tri ke tiep
      }
      args[key] = value;
    } else if (token.startsWith('--')) {
      // Token `--xxx` khong nhan dien -> bao loi thay vi am tham bo qua (tranh go nham --ouput, v.v.).
      throw new Error(
        `Tham số không hợp lệ: ${token}. Các tham số hợp lệ: --key <đường-dẫn-key.json>, --out <đường-dẫn-file.csv>`
      );
    }
    // Cac token khac (khong co tien to --) thi bo qua.
  }
  return args;
}

// ── Thu tu tim service account key: (a) --key, (b) GOOGLE_APPLICATION_CREDENTIALS, (c) ./serviceAccountKey.json ──
function resolveKeyPath(args) {
  if (args.key) return path.resolve(args.key);
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  }
  return path.resolve(process.cwd(), 'serviceAccountKey.json');
}

// Thong bao huong dan lay key (tieng Viet), khong bao gio in noi dung key.
function printKeyHelp(keyPath, reason) {
  console.error('');
  console.error('❌ Không đọc được khóa dịch vụ (service account key).');
  if (reason) console.error(`   Lý do: ${reason}`);
  console.error(`   Đường dẫn đã thử: ${keyPath}`);
  console.error('');
  console.error('   Cách lấy khóa:');
  console.error('   1) Mở Firebase Console của dự án "icon-picker".');
  console.error('   2) Vào: Project settings (biểu tượng bánh răng) → Service accounts.');
  console.error('   3) Bấm "Generate new private key" → xác nhận tải file JSON về.');
  console.error('   4) Lưu file đó với tên "serviceAccountKey.json" ở thư mục gốc của dự án.');
  console.error('');
  console.error('   Hoặc chỉ định khóa khác:');
  console.error('     node export.js --key <đường-dẫn-tới-key.json>');
  console.error('   Hoặc đặt biến môi trường GOOGLE_APPLICATION_CREDENTIALS trỏ tới file key.');
  console.error('');
}

// Doc + parse + kiem tra hinh dang file key. Loi -> in huong dan than thien va exit(1).
function loadServiceAccount(keyPath) {
  let raw;
  try {
    raw = fs.readFileSync(keyPath, 'utf8');
  } catch (err) {
    const reason = err.code === 'ENOENT' ? 'Không tìm thấy file.' : err.message;
    printKeyHelp(keyPath, reason);
    process.exit(1);
  }

  let obj;
  try {
    obj = JSON.parse(raw);
  } catch (err) {
    // Khong in noi dung file (co the chua khoa bi mat) — chi bao JSON khong hop le.
    printKeyHelp(keyPath, 'File không phải JSON hợp lệ.');
    process.exit(1);
  }

  // Kiem tra hinh dang khoa service account TRUOC khi goi cert() (cert() nem loi DONG BO neu sai hinh dang).
  // Loi thuong gap: nguoi dung luu nham firebase web config { apiKey, projectId, appId } thay vi khoa admin.
  // Chi kiem tra su ton tai cua truong, KHONG in gia tri (private_key la bi mat).
  if (
    !obj ||
    typeof obj !== 'object' ||
    typeof obj.private_key !== 'string' ||
    typeof obj.client_email !== 'string' ||
    obj.type !== 'service_account'
  ) {
    printKeyHelp(
      keyPath,
      'File JSON không phải khóa service account (thiếu private_key/client_email hoặc type không phải "service_account").'
    );
    process.exit(1);
  }

  return obj;
}

// ── Chong dem 2 chu so (00-99). ──
function pad2(n) {
  return String(n).padStart(2, '0');
}

// ── Dinh dang gio Viet Nam (UTC+7) dang "YYYY-MM-DD HH:mm:ss", zero-pad. ──
// Dung Intl voi timeZone 'Asia/Ho_Chi_Minh' de chuan xac du may chay o mui gio nao.
const VN_DTF = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function vnParts(date) {
  return VN_DTF.formatToParts(date).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
}

function formatVN(date) {
  // en-CA + cac option tren cho ra cac phan "YYYY", "MM", "DD", "HH", "mm", "ss".
  const parts = vnParts(date);
  // 'hour' co the la "24" voi mot so phien ban -> ep ve "00".
  let hh = parts.hour;
  if (hh === '24') hh = '00';
  return `${parts.year}-${parts.month}-${parts.day} ${hh}:${parts.minute}:${parts.second}`;
}

// ── Ma hoa 1 o CSV ──
// 1) Chong chen cong thuc: neu ky tu dau la = + - @ hoac TAB/CR/LF -> them dau ' phia truoc.
//    (Spec yeu cau = + - @ TAB CR; them LF theo huong dan OWASP de chac chan an toan.)
// 2) Boc o trong dau nhay kep; nhan doi dau nhay kep ben trong.
function csvCell(value) {
  let s = value == null ? '' : String(value);
  const first = s.charAt(0);
  if (
    first === '=' ||
    first === '+' ||
    first === '-' ||
    first === '@' ||
    first === '\t' ||
    first === '\r' ||
    first === '\n'
  ) {
    s = "'" + s;
  }
  return '"' + s.replace(/"/g, '""') + '"';
}

// Ghep 1 hang tu mang gia tri, ket thuc bang CRLF (Excel-friendly).
function csvRow(values) {
  return values.map(csvCell).join(',') + '\r\n';
}

// ── Doc toan bo doc trong "signups" va sap xep theo `at` tang dan; at null/thieu -> cuoi cung. ──
async function fetchSignups(db) {
  const snap = await db.collection('signups').get();

  const rows = snap.docs.map((doc) => {
    const d = doc.data() || {};
    // `at` la Firestore Timestamp; co the null ngay sau khi ghi (server timestamp chua resolve).
    // firebase-admin luon tra ve admin Firestore Timestamp (co .toDate()) cho truong Timestamp.
    let date = null;
    if (d.at && typeof d.at.toDate === 'function') {
      date = d.at.toDate();
    }
    return {
      id: doc.id,
      playerId: d.playerId != null ? d.playerId : doc.id,
      icon: d.icon != null ? d.icon : '',
      name: d.name != null ? d.name : '',
      email: d.email != null ? d.email : '',
      phone: d.phone != null ? d.phone : '',
      date, // Date hoac null
    };
  });

  // Sap xep theo thoi gian tang dan; ban ghi khong co `at` xuong cuoi.
  rows.sort((a, b) => {
    if (a.date && b.date) return a.date.getTime() - b.date.getTime();
    if (a.date) return -1; // a co thoi gian -> truoc
    if (b.date) return 1; //  b co thoi gian -> truoc
    return 0; //             ca hai thieu -> giu nguyen tuong doi
  });

  return rows;
}

// ── Tao chuoi CSV hoan chinh (co BOM). ──
function buildCsv(rows) {
  let out = '﻿'; // BOM UTF-8 de Excel hien dung dau tieng Viet.
  out += csvRow(HEADERS);
  rows.forEach((r, idx) => {
    const team = ICON_NAMES[r.icon] || r.icon; // ten doi; fallback emoji.
    const timeCell = r.date ? formatVN(r.date) : ''; // thieu `at` -> de trong.
    out += csvRow([
      idx + 1, //   STT (1-based)
      timeCell, //  Thoi gian
      r.name, //    Ho ten
      r.email, //   Email
      r.phone, //   SDT (giu dang text qua viec boc nhay kep)
      team, //      Doi
      r.icon, //    Icon (emoji)
      r.playerId, // PlayerID
    ]);
  });
  return out;
}

// ── Ten file mac dinh: signups-YYYYMMDD-HHmmss.csv (theo gio VN). ──
function defaultOutName() {
  const p = vnParts(new Date());
  const hh = p.hour === '24' ? '00' : p.hour;
  return `signups-${p.year}${p.month}${p.day}-${hh}${p.minute}${p.second}.csv`;
}

// ── In tom tat ra console (tieng Viet). ──
function printSummary(rows, outPath) {
  console.log('');
  if (rows.length === 0) {
    console.log('📭 Chưa có ai đăng ký.');
  } else {
    console.log(`✅ Tổng số đăng ký: ${rows.length}`);

    // Dem theo doi.
    const counts = new Map();
    for (const r of rows) {
      const team = ICON_NAMES[r.icon] || r.icon || '(không rõ)';
      counts.set(team, (counts.get(team) || 0) + 1);
    }
    // Sap xep giam dan theo so luong.
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    console.log('   Theo đội (nhiều → ít):');
    for (const [team, n] of sorted) {
      console.log(`     - ${team}: ${n}`);
    }
  }
  console.log('');
  console.log(`📄 Đã ghi file: ${outPath}`);
  console.log('   Mẹo: SĐT có số 0 đầu hoặc dãy số dài có thể bị Excel định dạng lại.');
  console.log('   Để giữ nguyên dạng text, hãy mở bằng Google Sheets (File → Import) hoặc dùng Data → Import của Excel.');
  console.log('');
}

async function main() {
  const args = parseArgs(process.argv);

  // 1) Tim & nap service account key (tu exit(1) neu thieu file / JSON sai / sai hinh dang khoa).
  const keyPath = resolveKeyPath(args);
  const serviceAccount = loadServiceAccount(keyPath);

  // 2) Khoi tao firebase-admin.
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
  });
  const db = admin.firestore();

  // 3) Doc + sap xep du lieu.
  const rows = await fetchSignups(db);

  // 4-5) Tao noi dung CSV.
  const csv = buildCsv(rows);

  // 6) Xac dinh duong dan file ra & ghi (utf8).
  const outArg = args.out ? args.out : defaultOutName();
  const outPath = path.resolve(process.cwd(), outArg);
  fs.writeFileSync(outPath, csv, 'utf8');

  // 7) In tom tat.
  printSummary(rows, outPath);
}

main().catch((err) => {
  console.error('');
  console.error('❌ Lỗi khi xuất dữ liệu:');
  console.error(`   ${err && err.message ? err.message : err}`);
  console.error('');
  console.error('   Gợi ý: kiểm tra kết nối mạng và quyền của service account (Cloud Datastore/Firestore Viewer).');
  // 8) Bao loi qua process.exitCode (khong goi process.exit de stream kip flush).
  process.exitCode = 1;
});
