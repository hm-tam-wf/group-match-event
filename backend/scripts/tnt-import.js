// tnt-import.js — Tao su kien TNT tu FILE MAU (sample-allowlist/tnt-mau-nhap-lieu.xlsx):
//   sheet 1 "Nhan su": NAME | Gender | Phong (so thu tu phong neu BTC xep san, trong = tu chon)
//   sheet "Phong":     STT | Ten phong | So giuong | Gioi tinh | Team | Emoji  (Team: ghi kem ten phong tren web)
//   Du lieu THAT de o btc-data/tnt-nhap-lieu.xlsx (git-ignore, repo public) — la file mac dinh neu co.
//
//   Mac dinh DRY-RUN: chi DOC + KIEM TRA file, in bao cao, KHONG dung Firestore.
//   Chay:  node backend/scripts/tnt-import.js --file "<duong-dan.xlsx>"                  (kiem tra)
//          node backend/scripts/tnt-import.js --file "<duong-dan.xlsx>" --apply          (tao that)
//          node backend/scripts/tnt-import.js --file "<duong-dan.xlsx>" --apply --open   (tao + MO su kien)
//   Tham so phu: --event <eventId> (mac dinh mini-outing-2026)  --key <path-key.json>
//
// Ghi GIONG HET admin.html: meta/config (form Tao su kien) + config/eventList + allowlist (addMany) + xep san
// (seedTeams: teams/members/dedup_keys/signups). firebase-admin bo qua rules. Su kien DA TON TAI => dung, khong ghi de.
'use strict';

const path = require('path');
const XLSX = require('xlsx');

const args = process.argv.slice(2);
const arg = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const APPLY = args.includes('--apply');
const OPEN = args.includes('--open');
const REAL_FILE = path.join(__dirname, '../../btc-data/tnt-nhap-lieu.xlsx');
const FILE = arg('file', require('fs').existsSync(REAL_FILE) ? REAL_FILE : path.join(__dirname, '../../sample-allowlist/tnt-mau-nhap-lieu.xlsx'));
const EID = arg('event', 'mini-outing-2026');
const KEY = arg('key', path.join(__dirname, '../../serviceAccountKey.json'));

// === Chuan hoa: GIONG admin.html / fe/js/data/api.js / fe/js/config/config.js ===
const _dedupKey = v => String(v == null ? '' : v).normalize('NFC').trim().toUpperCase().replace(/\s+/g, '');
const _fold = v => String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').trim();
const normGender = v => { const s = _fold(v);
  return (s === 'nam' || s === 'male' || s === 'm') ? 'Nam' : (s === 'nu' || s === 'female' || s === 'f') ? 'Nữ' : ''; };
const findCol = (headers, re) => headers.findIndex(h => re.test(_fold(h).replace(/\s+/g, ' ')));
const cell = (r, i) => (i >= 0 && r[i] != null ? String(r[i]).trim() : '');

const EMOJI_POOL = ['🌊', '🌸', '🐬', '🌷', '🦈', '🌻', '🐳', '🌼', '🌴', '🌺', '⭐', '🍀'];
const COLORS = ['#2f80ed', '#e0479e', '#38bdf8', '#ff6cce', '#7a8cff', '#ffb13d', '#4dd47a', '#b06cff', '#ff7a45', '#4dffe1', '#ffe14d', '#ff3b5c'];

const SUBTITLE = '"Chọn phòng đừng để phòng dư, chọn bạn đừng để phòng bạn to hơn phòng mình"<ul>'
  + '<li><b>Săn roommate phiên bản giới hạn:</b> Mỗi phòng sẽ chỉ bán ra vài chiếc giường giới hạn — gom đủ người, hệ thống tự động "khóa cửa" tiễn khách.</li>'
  + '<li>Mỗi công nhân sự kiện chỉ được <b>chốt cạ cứng 1 lần duy nhất</b>, đã chọn là không thể quay đầu.</li>'
  + '<li><b>Lưu ý:</b> Nam riêng, nữ riêng — hệ thống tự xếp theo giới tính trong danh sách của BTC.</li></ul>';

function readTemplate(file) {
  const wb = XLSX.readFile(file);
  const errors = [], warns = [];
  const sheet = n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' });

  // ---- Phong ----
  const roomSheet = wb.SheetNames.find(n => /^phong$/.test(_fold(n)));
  if (!roomSheet) { errors.push('Không thấy sheet "Phòng".'); return { errors, warns, rooms: [], people: [] }; }
  const ra = sheet(roomSheet), rh = ra[0] || [];
  const cStt = findCol(rh, /^stt$/), cName = findCol(rh, /^ten phong$/), cBeds = findCol(rh, /^so giuong$/),
        cG = findCol(rh, /^gioi tinh$/), cTeam = findCol(rh, /^(team|nhom)$/), cEmo = findCol(rh, /^emoji$/);
  if (cName < 0 || cBeds < 0) errors.push('Sheet "Phòng" cần cột "Tên phòng" và "Số giường".');
  const rooms = [];
  ra.slice(1).forEach((r, i) => {
    const name = cell(r, cName); if (!name) return;
    const line = `Phòng dòng ${i + 2}`;
    const stt = cStt >= 0 ? parseInt(cell(r, cStt), 10) : rooms.length + 1;
    if (stt !== rooms.length + 1) errors.push(`${line}: STT phải liên tục 1,2,3… (đang là "${cell(r, cStt)}").`);
    const beds = parseInt(cell(r, cBeds), 10);
    if (!(beds >= 1)) errors.push(`${line} (${name}): Số giường phải là số ≥ 1.`);
    const gRaw = cell(r, cG), gender = normGender(gRaw);
    if (gRaw && !gender) errors.push(`${line} (${name}): Giới tính "${gRaw}" không hiểu — ghi Nam hoặc Nữ.`);
    if (!gRaw) warns.push(`${name}: chưa ghi giới tính ⇒ phòng CHUNG (ai cũng vào được).`);
    const team = cell(r, cTeam);
    rooms.push({ stt, name, beds, gender, team, label: team ? `${name} · ${team}` : name, emoji: cell(r, cEmo) });
  });
  if (!rooms.length) errors.push('Sheet "Phòng" chưa có phòng nào.');
  const used = new Set(rooms.map(r => r.emoji).filter(Boolean));
  const pool = EMOJI_POOL.filter(e => !used.has(e));
  rooms.forEach(r => { if (!r.emoji) r.emoji = pool.shift(); });
  const emos = rooms.map(r => r.emoji);
  if (new Set(emos).size !== emos.length) errors.push('Emoji các phòng bị trùng — mỗi phòng cần 1 emoji khác nhau.');

  // ---- Nhan su (sheet DAU TIEN — admin cung chi doc sheet dau) ----
  const pa = sheet(wb.SheetNames[0]), ph = pa[0] || [];
  const pName = ph.findIndex(h => String(h).trim().toLowerCase() === 'name');
  const pG = findCol(ph, /^(gioi tinh|gioi|ma gioi|ma gioi tinh|gender|sex)$/);
  const pRoom = findCol(ph, /^(team|room|doi|nhom|phong)$/);
  if (pName < 0) errors.push(`Sheet đầu "${wb.SheetNames[0]}" cần cột "NAME" (đúng chữ NAME).`);
  const people = [], seen = new Map();
  pa.slice(1).forEach((r, i) => {
    const name = cell(r, pName); if (!name) return;
    const line = `Nhân sự dòng ${i + 2} (${name})`;
    const key = _dedupKey(name);
    if (seen.has(key)) { errors.push(`${line}: trùng tên với dòng ${seen.get(key)} — người sau sẽ bị chặn.`); return; }
    seen.set(key, i + 2);
    const gRaw = cell(r, pG), gender = normGender(gRaw);
    if (!gRaw) warns.push(`${line}: trống giới tính ⇒ vào được mọi phòng.`);
    else if (!gender) errors.push(`${line}: Gender "${gRaw}" không hiểu — ghi Nam hoặc Nữ.`);
    const roomRaw = cell(r, pRoom);
    let room = null;
    if (roomRaw) {
      const n = parseInt(roomRaw, 10);
      room = rooms.find(x => x.stt === n) || null;
      if (!room || String(n) !== roomRaw.replace(/\.0+$/, '')) { errors.push(`${line}: Phòng "${roomRaw}" không hợp lệ — ghi số 1…${rooms.length}.`); room = null; }
      else if (room.gender && gender && room.gender !== gender) errors.push(`${line}: là ${gender} nhưng xếp vào ${room.name} (phòng ${room.gender}).`);
    }
    people.push({ name, key, gender, room });
  });
  rooms.forEach(r => {
    const n = people.filter(p => p.room === r).length;
    if (n > r.beds) errors.push(`${r.name}: xếp sẵn ${n} người nhưng chỉ có ${r.beds} giường.`);
  });
  return { errors, warns, rooms, people };
}

function report({ rooms, people, errors, warns }) {
  console.log(`\nFILE: ${FILE}\nSỰ KIỆN: ${EID}\n`);
  console.log('PHÒNG:');
  rooms.forEach(r => {
    const pre = people.filter(p => p.room === r);
    console.log(`  ${r.stt}. ${r.emoji} ${r.label} — ${r.beds} giường — ${r.gender || 'chung'} — xếp sẵn ${pre.length}${pre.length ? ': ' + pre.map(p => p.name).join(', ') : ''}`);
  });
  const nam = people.filter(p => p.gender === 'Nam').length, nu = people.filter(p => p.gender === 'Nữ').length;
  const beds = g => rooms.filter(r => r.gender === g).reduce((s, r) => s + r.beds, 0);
  const chung = rooms.filter(r => !r.gender).reduce((s, r) => s + r.beds, 0);
  console.log(`\nNHÂN SỰ: ${people.length} người (Nam ${nam}, Nữ ${nu}, trống giới ${people.length - nam - nu}) · xếp sẵn ${people.filter(p => p.room).length}`);
  console.log(`GIƯỜNG: Nam ${beds('Nam')} · Nữ ${beds('Nữ')} · chung ${chung} · tổng ${rooms.reduce((s, r) => s + r.beds, 0)}`);
  const total = rooms.reduce((s, r) => s + r.beds, 0);
  if (people.length > total) warns.push(`Thiếu giường: ${people.length} người nhưng tổng chỉ ${total} giường ⇒ ${people.length - total} người sẽ không còn chỗ.`);
  if (nam > beds('Nam') + chung) warns.push(`Thiếu giường Nam: ${nam} người Nam nhưng chỉ ${beds('Nam')} giường Nam (+${chung} chung).`);
  if (nu > beds('Nữ') + chung) warns.push(`Thiếu giường Nữ: ${nu} người Nữ nhưng chỉ ${beds('Nữ')} giường Nữ (+${chung} chung).`);
  if (warns.length) console.log('\nCẢNH BÁO:\n  - ' + warns.join('\n  - '));
  if (errors.length) console.log('\nLỖI (phải sửa file trước khi nạp):\n  - ' + errors.join('\n  - '));
  else console.log('\n✓ File hợp lệ.');
}

async function apply({ rooms, people }) {
  const admin = require('firebase-admin');
  admin.initializeApp({ credential: admin.credential.cert(require(path.resolve(KEY))) });
  const db = admin.firestore(), FV = admin.firestore.FieldValue, ts = FV.serverTimestamp();
  const ev = db.collection('events').doc(EID);
  if ((await ev.collection('meta').doc('config').get()).exists)
    throw new Error(`Sự kiện "${EID}" đã tồn tại — dừng, không ghi đè. Đổi --event hoặc xoá sự kiện cũ trong admin.`);

  const icons = rooms.map((r, i) => { const ic = { icon: r.emoji, name: r.label, color: COLORS[i % COLORS.length] }; if (r.gender) ic.gender = r.gender; return ic; });
  const capacity = Math.max(...rooms.map(r => r.beds));
  const caps = {}; rooms.forEach(r => { if (r.beds !== capacity) caps[r.emoji] = r.beds; });

  await ev.collection('meta').doc('config').set({
    title: 'BẠN MUỐN CHUNG CHĂN!', subtitle: SUBTITLE,
    fields: [{ key: 'name', label: 'Tên công nhân sự kiện', type: 'text', required: true, placeholder: 'Nguyễn Văn A' }],
    icons, capacity, caps, openAt: null, closeAt: null,
    dedupField: 'name', blockDup: true,
    allowlistMode: true, allowlistNameCheck: false, allowlistGenderCheck: true,
    createdAt: ts,
  });
  await db.collection('config').doc('eventList').set({ ids: FV.arrayUnion(EID) }, { merge: true });

  // allowlist (= admin addMany)
  for (let i = 0; i < people.length; i += 400) {
    const b = db.batch();
    people.slice(i, i + 400).forEach(p => { const d = { at: ts, name: p.name }; if (p.gender) d.gender = p.gender; b.set(ev.collection('allowlist').doc(p.key), d, { merge: true }); });
    await b.commit();
  }

  // xep san (= admin seedTeams)
  const pre = people.filter(p => p.room);
  for (const r of rooms) {
    const names = pre.filter(p => p.room === r).map(p => p.name);
    if (names.length) await ev.collection('teams').doc(r.emoji).set({ icon: r.emoji, count: names.length, names });
  }
  for (let i = 0; i < pre.length; i += 120) {
    const b = db.batch();
    pre.slice(i, i + 120).forEach(p => {
      const pid = 'seed_' + p.key;
      b.set(ev.collection('members').doc(pid), { icon: p.room.emoji, at: ts });
      b.set(ev.collection('dedup_keys').doc(p.key), { at: ts });
      b.set(ev.collection('signups').doc(pid), { name: p.name, playerId: pid, icon: p.room.emoji, at: ts });
    });
    await b.commit();
  }
  if (OPEN) await db.collection('config').doc('active').set({ eventId: EID });
  console.log(`\n✓ Đã tạo "${EID}": ${rooms.length} phòng, ${people.length} người trong danh sách, ${pre.length} người xếp sẵn.`
    + (OPEN ? ' Đã MỞ sự kiện (trang công khai hiện ngay).' : ' Chưa mở — vào admin bấm "Mở", hoặc chạy lại với --open.'));
}

const data = readTemplate(FILE);
report(data);
if (!APPLY) { console.log('\n(Chế độ KIỂM TRA — chưa ghi gì. Thêm --apply để tạo thật.)'); process.exit(data.errors.length ? 1 : 0); }
if (data.errors.length) { console.log('\nKhông ghi vì còn lỗi.'); process.exit(1); }
apply(data).catch(e => { console.error('\nLỖI:', e.message); process.exit(1); });
