// ─────────────────────────────────────────────────────────────────────────
// Tầng dữ liệu — MÔ HÌNH ĐỘI (mỗi icon = 1 đội, tối đa CAPACITY người). 3 chế độ:
//   firebase → Firestore (chịu tải lớn, ghi atomic, đọc realtime)  ← khuyến nghị cho ~500 người
//   sheet    → Google Apps Script + Sheet (legacy, không hợp >50 người cùng lúc)
//   demo     → in-memory / window.storage (chạy thử cục bộ)
// Hợp đồng: apiState()→{ icon:{count,names[]} }; apiClaim()→{ok}|{ok:false,reason};
//           apiSubscribe(cb) (chỉ firebase) đẩy realtime, thay cho việc poll mỗi 3s.
// ─────────────────────────────────────────────────────────────────────────

// Mô hình Firestore — MỌI collection nằm dưới events/{EVENT_ID}/ (mỗi sự kiện 1 không gian riêng):
//   events/{EVENT_ID}/teams/{icon}     : { icon, count, names:[...] }      — CÔNG KHAI, chỉ TÊN (realtime)
//   events/{EVENT_ID}/members/{pid}    : { icon, at }                      — guard 1-người-1-đội (đọc 1 doc, CẤM liệt kê)
//   events/{EVENT_ID}/dedup_keys/{key} : { at }                           — guard chống trùng (theo DEDUP_FIELD, chỉ tồn-tại)
//        (mỗi người 1 doc k1=_dedupKey; tên CÓ dấu ghi thêm "m~"+_foldKey nếu chưa có — chống trùng bất đối xứng, xem _dedupPlan)
//   events/{EVENT_ID}/signups/{pid}    : { ...fields, playerId, icon?, at } — FULL hồ sơ MỌI người đã nhập thông tin
//                                          (ghi ngay lúc điền xong, KHÔNG cần chọn đội; icon CHỈ có sau khi join). KHOÁ ĐỌC.
// Sĩ số tối đa được ép thêm ở Security Rules (count <= CAPACITY) nên client gian lận cũng không vượt được.

// ── Hằng số chống hardcode (một nguồn sự thật — §4) ─────────────────────────
// Tên 3 chế độ backend. VALUE giữ nguyên: ui-utils.js (tính MODE) + app.js so sánh theo các hằng này.
const MODE_FIREBASE = "firebase";
const MODE_SHEET    = "sheet";
const MODE_DEMO     = "demo";

// Tên collection Firestore (CONTRACT — value cố định theo dữ liệu đã lưu; chỉ gom về một nơi).
const COL = {
  TEAMS:      "teams",
  MEMBERS:    "members",
  DEDUP_KEYS: "dedup_keys",
  SIGNUPS:    "signups",
  REG_KEYS:   "reg_keys",
  ALLOWLIST:  "allowlist",
};

// Mã lý do apiClaim/apiReg* trả về (INTERNAL contract với app.js/ui-render.js; sheet backend cũng dùng value này).
const REASON = {
  MISSING:       "missing",
  ALREADY:       "already",
  DUP:           "dup",
  NOT_ALLOWED:   "notAllowed",
  NAME_MISMATCH: "nameMismatch",
  FULL:          "full",
  DEDUP_CONFIG:  "dedupConfig",   // chống trùng BẬT mà không lấy được giá trị để dedup (cấu hình sai) → fail-closed
  GENDER_MISMATCH: "genderMismatch", // "Check giới tính" BẬT & giới tính theo danh sách ≠ giới của phòng
  ERROR:         "error",
};

// Mọi collection của 1 sự kiện nằm dưới events/{EVENT_ID}/ → đổi EVENT_ID là sang không gian dữ liệu mới.
const col = name => db.collection("events").doc(EVENT_ID).collection(name);

function _dedupKey(v) { return String(v || "").normalize("NFC").trim().toUpperCase().replace(/\s+/g, ""); }   // NFC: tên tiếng Việt gõ dạng dấu tổ hợp (NFD) vẫn ra cùng khoá

// Chuẩn hoá HỌ TÊN để so khớp với danh sách cho phép: bỏ dấu tiếng Việt, gộp khoảng trắng, IN HOA.
// "Lê Văn A" / "le  van a" → "LE VAN A". Khoan dung (bỏ dấu) để tránh chặn nhầm người gõ thiếu/khác dấu.
// Dùng ở cả popup (UX) lẫn transaction apiClaim (chốt). NFD không tách được đ/Đ nên thay tay.
function _normName(v) {
  return String(v || "")
    .normalize("NFD").replace(new RegExp("[" + String.fromCharCode(768) + "-" + String.fromCharCode(879) + "]", "g"), "")  // bỏ dấu kết hợp U+0300..U+036F
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .trim().replace(/\s+/g, " ").toUpperCase();
}

// Khoá "gấp" (fold): bỏ dấu + hoa/thường + bỏ khoảng trắng ("Lê Văn A" / "LE VAN A" → "LEVANA").
// KHÔNG dùng để coi 2 tên CÓ dấu là cùng người ("Hùng"/"Hưng", "Lê"/"Lệ" gấp cùng khoá nhưng là người khác) — xem so BẤT ĐỐI XỨNG dưới.
function _foldKey(v) { return _normName(v).replace(/\s+/g, ""); }

// CHỐNG TRÙNG BẤT ĐỐI XỨNG theo tên (dedup_keys, giữ nguyên khoá cũ k1 = _dedupKey vì allowlist + dữ liệu production dùng nó):
//   k1 = _dedupKey(N) (giữ dấu) ; F = _foldKey(N) ; ascii = (k1 === F) = N gõ KHÔNG dấu ; M = "m~" + F (namespace riêng, chỉ tên CÓ dấu ghi).
//   Tiền tố "m~" có chữ thường ⇒ _dedupKey (luôn UPPER) KHÔNG BAO GIỜ trùng M: gõ "~Nguyen Van Hung" không chiếm được khoá M của "Hùng".
//   N không dấu : coi là trùng nếu tồn tại k1 HOẶC M (đã có người tên-có-dấu gấp về F). Ghi k1.
//   N có dấu    : coi là trùng nếu tồn tại k1 HOẶC F (F là k1 của 1 bản đăng ký KHÔNG dấu → coi cùng người). Ghi k1, và ghi M CHỈ KHI M chưa có.
//   M tồn tại KHÔNG chặn tên có dấu ⇒ "Hùng" ≠ "Hưng", "Lê Văn A" ≠ "Lệ Vân A": cả hai đăng ký được.
// MSNV (không dấu): k1 === F, thêm 1 read M (không bao giờ tồn tại) — vô hại.
// Tên gõ THIẾU MỘT PHẦN dấu ("Nguyen Văn Hùng" khi đã có "Nguyễn Văn Hùng") KHÔNG có doc nào bắt (k1 khác, F không có) ⇒ chốt MỀM ở FE
// dựa trên teams[*].names công khai (softCands/softConfirm + _markSubset, hộp xác nhận ở ui-render.js) — xem ghi chú ở đó.
function _dedupPlan(v) {
  const k1 = _dedupKey(v), F = _foldKey(v);
  return { k1, F, ascii: k1 === F, M: F ? "m~" + F : "" };
}
// Các doc dedup_keys cần đọc để biết "đã có người trùng chưa" (không gồm M của tên có dấu). Trả {k1, other:{kind:"f"|"m", key}|null}.
function _dedupReadKeys(v) {
  const pl = _dedupPlan(v);
  if (!pl.k1) return null;
  if (pl.ascii) return { k1: pl.k1, other: pl.M ? { kind: "m", key: pl.M } : null };
  return { k1: pl.k1, other: pl.F ? { kind: "f", key: pl.F } : null };
}
// Đọc doc dedup_keys cho 1 giá trị → { found, icon, hit:{k1,f,m} }. icon ưu tiên doc k1 (chính người này), rồi doc còn lại.
async function _readDedup(v) {
  const rk = _dedupReadKeys(v);
  if (!rk) return { found: false, icon: null, hit: { k1: false, f: false, m: false } };
  const [s1, s2] = await Promise.all([col(COL.DEDUP_KEYS).doc(rk.k1).get(), rk.other ? col(COL.DEDUP_KEYS).doc(rk.other.key).get() : Promise.resolve(null)]);
  return _dedupResult(s1, s2, rk.other && rk.other.kind);
}
function _dedupResult(s1, s2, kind) {
  const e1 = !!(s1 && s1.exists), e2 = !!(s2 && s2.exists);
  const ic = sn => (sn && sn.exists ? ((sn.data() || {}).icon || null) : null);
  return { found: e1 || e2, icon: ic(s1) || ic(s2) || null, hit: { k1: e1, f: kind === "f" && e2, m: kind === "m" && e2 } };
}
// Tách chuỗi (đã _dedupKey: NFC, HOA, bỏ khoảng trắng) thành từng chữ = {chữ gốc, tập dấu kết hợp U+0300..U+036F}. Đ/đ = gốc "D" + dấu "stroke" riêng
// (NFD không tách được đ). Dùng cho _markSubset.
function _markLetters(v) {
  const out = [];
  for (const ch of _dedupKey(v)) {
    const d = ch.normalize("NFD");
    const marks = new Set(Array.from(d).slice(1));
    let base = Array.from(d)[0];
    if (ch === "Đ") { base = "D"; marks.add("stroke"); }
    out.push({ base, marks });
  }
  return out;
}
// typed có phải bản "gõ thiếu dấu" của cand không: cùng dãy chữ gốc (tức _foldKey bằng nhau) VÀ ở MỌI vị trí tập dấu của typed ⊆ tập dấu của cand.
// "Nguyen Văn Hùng" ⊆ "Nguyễn Văn Hùng" ; "Nguyễn Văn Hưng" ⊄ "Nguyễn Văn Hùng" (u: móc ≠ huyền) ; "Dang" ⊆ "Đặng" ; "Đang" ⊄ "Dặng".
function _markSubset(typed, cand) {
  const a = _markLetters(typed), b = _markLetters(cand);
  if (!a.length || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].base !== b[i].base) return false;
    for (const m of a[i].marks) if (!b[i].marks.has(m)) return false;
  }
  return true;
}
// Demo (localStorage): 2 giá trị là CÙNG người? Cùng k1; hoặc cùng F mà một bên có dấu, một bên không dấu (bất đối xứng, như firebase).
function _sameDedup(a, b) {
  const pa = _dedupPlan(a), pb = _dedupPlan(b);
  if (!pa.k1 || !pb.k1) return false;
  if (pa.k1 === pb.k1) return true;
  return pa.F === pb.F && pa.ascii !== pb.ascii;
}

// Kiểm tra NHANH một giá trị dedup (vd MSNV) ĐÃ được đăng ký chưa — để CHẶN NGAY ở cổng vào
// (trước khi cho chọn đội), không đợi tới lúc claim. Chỉ đọc 1 doc dedup_keys (rules cho phép get).
// Trả false khi: không bật chống trùng / không firebase / lỗi mạng → KHÔNG chặn nhầm
// (transaction trong apiClaim vẫn là tuyến chặn cuối, an toàn trước tranh chấp).
async function apiDedupTaken(value) {
  if (MODE !== MODE_FIREBASE || !BLOCK_DUP || !DEDUP_FIELD) return false;
  if (!_dedupKey(value)) return false;
  try {
    return (await _readDedup(value)).found;       // k1 + (F nếu tên có dấu | M nếu tên không dấu) — xem _dedupPlan
  } catch (e) {
    return false;
  }
}

// ── ĐẶT-CHỖ TIỀN-JOIN (reg_keys) ─────────────────────────────────────────────
// Vấn đề: dedup_keys chỉ được ghi lúc JOIN, nên 2 người điền CÙNG MSNV (trước khi ai join) đều tạo được
// signup → admin thấy 2 dòng trùng. signups KHOÁ ĐỌC nên client không thể tự dò trùng. Giải pháp: giữ chỗ
// công khai (reg_keys, get:true) keyed theo MSNV NGAY lúc điền form. Doc chỉ { at } — KHÔNG chứa pid (tránh
// lộ token vì key = MSNV dễ đoán). "Chỗ của mình" theo dõi bằng localStorage reservedKey (per-event).
//
// apiRegReserve: transaction — đặt chỗ {at} cho MSNV lúc điền form; chỉ chặn khi MSNV đã có HỒ SƠ THẬT.
// chưa có ⇒ set {at} + nhớ reservedKey. Lỗi mạng/không bật ⇒ {ok:true} (fail-open; JOIN vẫn là chốt cuối).
//
// CỜ `profiled` — sửa TẬN GỐC "kẹt reg_keys" (2026-06-18): CHỈ chặn khi `reg_keys/{key}.profiled===true`, tức
// ĐÃ có signup THẬT cho MSNV. apiSaveProfile gắn profiled=true NGAY khi ghi signup. Hold "trần" {at} (đặt-chỗ
// rồi BỎ DỞ: đóng tab / mất mạng / đổi máy TRƯỚC khi lưu hồ sơ) KHÔNG có profiled ⇒ KHÔNG chặn người vào lại
// → hết cảnh phải nhờ admin "Bỏ chặn" (đúng ca 3477: có reg_key nhưng 0 signup). signups KHOÁ ĐỌC nên client
// không kiểm trực tiếp được → profiled trên reg_keys (get công khai) là "tấm biển" thay cho signups. An toàn:
// dedup_keys (ghi lúc JOIN) vẫn là chốt CỨNG chặn double-join; đây chỉ là chốt MỀM tiền-join.
async function apiRegReserve(value) {
  if (MODE !== MODE_FIREBASE || !BLOCK_DUP || !DEDUP_FIELD) return { ok: true };
  const key = _dedupKey(value);
  if (!key) return { ok: true };                          // không có MSNV ⇒ không đặt chỗ (như dedupVal rỗng)
  const mineKey = await sGet(SK.RESERVED_KEY, false);
  try {
    const ref = col(COL.REG_KEYS).doc(key);
    const res = await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      // ĐÃ có HỒ SƠ THẬT (profiled=true) & của NGƯỜI KHÁC ⇒ trùng. Chỗ MÌNH, hoặc hold "trần" {at} chưa có
      // hồ sơ (ai đó đặt-chỗ rồi bỏ dở) ⇒ CHO QUA, KHÔNG ghi đè at (rule update chỉ cho phép field profiled).
      if (snap.exists) {
        if ((snap.data() || {}).profiled === true && mineKey !== key) return { ok: false, reason: REASON.DUP };
        return { ok: true };
      }
      // CHƯA có khóa — sự kiện mới HOẶC admin vừa "Xóa dữ liệu" xóa mất khóa cũ. TẠO khóa {at} (chưa profiled).
      // KHÔNG tin localStorage suông, LUÔN bảo đảm server có khóa thật: sau "Xóa dữ liệu", máy chủ cũ từng
      // short-circuit "chỗ mình" rồi bỏ qua nên MSNV bỏ ngỏ trên server → máy khác đăng ký trùng.
      tx.set(ref, { at: firebase.firestore.FieldValue.serverTimestamp() });
      return { ok: true };
    });
    if (res.ok) {
      // Đổi MSNV (gõ nhầm rồi sửa) ⇒ NHẢ chỗ cũ, tránh khoá vĩnh viễn mã của người khác.
      if (mineKey && mineKey !== key) { try { await col(COL.REG_KEYS).doc(mineKey).delete(); } catch (e) {} }
      await sSet(SK.RESERVED_KEY, key, false);
    }
    return res;
  } catch (e) {
    return { ok: true };                                  // lỗi mạng ⇒ KHÔNG chặn nhầm (JOIN là chốt cuối)
  }
}

// Nhả chỗ giữ tiền-join của CHÍNH MÌNH nếu đang giữ đúng khoá của `value` (xoá reg_keys/{key} + RESERVED_KEY). Dùng khi người dùng xác nhận
// "tôi là <tên đã đăng ký>" ở hộp xác nhận tên gần giống: tên vừa gõ chỉ là bản gõ sai của người đã đăng ký, chỗ giữ cũ (profiled) không được
// tiếp tục chặn người có tên thật đó ở apiRegReserve/apiRegTaken. Best-effort.
async function apiRegRelease(value) {
  if (MODE !== MODE_FIREBASE) return;
  const key = _dedupKey(value);
  if (!key) return;
  if ((await sGet(SK.RESERVED_KEY, false)) !== key) return;
  try { await col(COL.REG_KEYS).doc(key).delete(); } catch (e) {}
  await sDel(SK.RESERVED_KEY, false);
}

// Cổng VÀO TRANG: MSNV đã có HỒ SƠ THẬT (profiled) của người KHÁC chưa? (chỗ của mình ⇒ không chặn; hold
// "trần" {at} chưa profiled = đặt-chỗ bỏ dở ⇒ KHÔNG chặn — bịt "kẹt reg_keys"). Chỉ đọc 1 doc reg_keys.
// Bịt lỗ "bị chặn ở save() rồi reload để vào lưới": người bị chặn không có reservedKey ⇒ vẫn bị chặn ở cổng.
async function apiRegTaken(value) {
  if (MODE !== MODE_FIREBASE || !BLOCK_DUP || !DEDUP_FIELD) return false;
  const key = _dedupKey(value);
  if (!key) return false;
  const mineKey = await sGet(SK.RESERVED_KEY, false);
  if (mineKey === key) return false;                      // chỗ của mình ⇒ KHÔNG chặn
  try {
    const snap = await col(COL.REG_KEYS).doc(key).get();
    return snap.exists && (snap.data() || {}).profiled === true;   // chỉ chặn khi ĐÃ có hồ sơ thật (profiled)
  } catch (e) {
    return false;
  }
}

// Tra cứu "đăng ký của tôi" xuyên thiết bị: từ giá trị dedup (họ tên/MSNV theo DEDUP_FIELD) → đội đã vào.
// Firebase: đọc 1 doc dedup_keys/{khoá} (rules cho get). {found, icon}: icon = null nếu doc cũ chưa lưu icon
// (join trước khi bật DEDUP_STORE_ICON → cần backfill). Lỗi mạng/rules ⇒ {found:false, error:true}.
// Demo: suy ra từ claims cục bộ để harness chạy được. Sheet: không hỗ trợ ⇒ {found:false}.
async function apiLookupRegistration(dedupVal) {
  if (!_dedupKey(dedupVal)) return { found: false };
  if (MODE === MODE_FIREBASE) {
    try {
      return await _readDedup(dedupVal);          // {found, icon, hit:{k1,f,m}} — FE kiểm chứng phòng bằng teams.names (rvResolve)
    } catch (e) {
      return { found: false, error: true };
    }
  }
  if (MODE === MODE_SHEET || !DEDUP_FIELD) return { found: false };
  try {
    const obj = JSON.parse(await sGet(SK.CLAIMS, true) || "{}");
    for (const ic in obj) {
      for (const m of obj[ic]) {
        if (_sameDedup(m[DEDUP_FIELD] || "", dedupVal)) return { found: true, icon: ic };   // demo: so bất đối xứng
      }
    }
    return { found: false };
  } catch (e) {
    return { found: false, error: true };
  }
}

// Khi ALLOWLIST_MODE bật: kiểm tra định danh (DEDUP_FIELD) có nằm trong allowlist chưa — để CHẶN NGAY
// ở cổng vào (trước khi cho chọn đội), không đợi tới lúc claim. Chỉ đọc 1 doc allowlist (rules cho phép get).
// Trả {allowed, name, gender}: allowed=TRUE (cho qua) khi không bật chế độ / không firebase / lỗi mạng → KHÔNG
// chặn nhầm; allowed=FALSE = NGOÀI danh sách. name = tên đã đăng ký ("" nếu danh sách không có cột tên),
// dùng để đối chiếu HỌ TÊN ở popup; gender = "Nam"|"Nữ"|"" theo cột giới tính (phân phòng theo giới — caller
// chỉ dùng khi ALLOWLIST_GENDERCHECK). Transaction apiClaim vẫn là tuyến chặn cuối cho cả ba.
async function apiAllowlistInfo(value) {
  if (MODE !== MODE_FIREBASE || !ALLOWLIST_MODE || !DEDUP_FIELD) return { allowed: true, name: "", gender: "" };
  const key = _dedupKey(value);
  if (!key) return { allowed: false, name: "", gender: "" };   // bật allowlist mà không có định danh → coi như ngoài danh sách
  try {
    const snap = await col(COL.ALLOWLIST).doc(key).get();
    if (!snap.exists) return { allowed: false, name: "", gender: "" };
    const d = snap.data() || {};
    return { allowed: true, name: String(d.name || ""), gender: normGender(d.gender) };
  } catch (e) {
    return { allowed: true, name: "", gender: "" };   // lỗi mạng → KHÔNG chặn nhầm; apiClaim là chốt cuối
  }
}
// Tiện ích boolean cho cổng vào lúc tải trang (chỉ cần biết được/không) — tái dùng apiAllowlistInfo.
async function apiAllowlistAllowed(value) { return (await apiAllowlistInfo(value)).allowed; }

async function apiState(fresh) {
  if (MODE === MODE_FIREBASE) {
    const snap  = await col(COL.TEAMS).get(fresh ? { source: "server" } : undefined);   // fresh=true: bắt buộc đọc từ SERVER (không lấy cache/listener trễ) — dùng để kiểm chứng trước khi chặn
    const teams = {};
    snap.forEach(d => { const v = d.data(); teams[v.icon] = { count: v.count || 0, names: v.names || [] }; });
    return teams;
  }
  if (MODE === MODE_SHEET) {
    const response = await fetch(SCRIPT_URL + "?action=state", { method: "GET" });
    const json = await response.json();
    return (json && json.teams) || {};
  }
  // demo: dựng map đội từ claims cục bộ ({ icon: [ {...fields, pid}, ... ] })  (claims đã namespace theo EVENT_ID ở storage.js)
  const obj = JSON.parse(await sGet(SK.CLAIMS, true) || "{}");
  const teams = {};
  Object.keys(obj).forEach(icon => {
    const arr = obj[icon] || [];
    teams[icon] = { count: arr.length, names: arr.map(m => m.name || "") };
  });
  return teams;
}

// Đọc tư cách THÀNH VIÊN thật trên server cho pid (self-heal). Trả {icon} nếu CÒN trong đội; null nếu KHÔNG
// còn (admin đã gỡ / un-join); undefined nếu KHÔNG xác định được (mạng lỗi / demo / sheet). Caller chỉ
// self-heal khi nhận `null` (chắc chắn đã bị gỡ) ⇒ KHÔNG xóa nhầm myIcon khi lỗi mạng. members/{pid}: get:true.
async function apiMyMembership(playerId) {
  if (MODE !== MODE_FIREBASE) return undefined;          // demo/sheet: không có nguồn chuẩn → bỏ qua
  const pid = String(playerId || "").trim();
  if (!pid) return undefined;
  try {
    const snap = await col(COL.MEMBERS).doc(pid).get();
    return snap.exists ? { icon: (snap.data() || {}).icon || null } : null;
  } catch (e) {
    return undefined;                                     // lỗi mạng ⇒ KHÔNG self-heal (giữ nguyên myIcon)
  }
}

// Ghi/đồng bộ HỒ SƠ lên server NGAY khi người dùng điền xong thông tin (CHƯA cần chọn đội)
// → admin thấy MỌI người đã nhập thông tin, không chỉ người đã join. Idempotent theo pid:
// gọi lại khi sửa thông tin chỉ cập nhật field, KHÔNG xoá icon/at đã có từ lúc join (nhờ merge).
// Best-effort: lỗi mạng không chặn UX (transaction lúc join vẫn ghi đủ hồ sơ).
async function apiSaveProfile(payload) {
  if (MODE !== MODE_FIREBASE) return { ok: true };   // sheet/demo: hồ sơ đã ở localStorage, không có bảng admin
  const pid  = String(payload.playerId || "").trim();
  const fields = payload.fields || {};
  const name = String(fields.name || "").trim();
  if (!pid || !name) return { ok: false, reason: REASON.MISSING };   // chưa đủ thông tin → chưa ghi
  try {
    await col(COL.SIGNUPS).doc(pid).set(
      { ...fields, playerId: pid, at: firebase.firestore.FieldValue.serverTimestamp() },
      { merge: true }                              // merge: KHÔNG đè icon nếu đã join trước đó
    );
    // Đã có HỒ SƠ THẬT cho MSNV này → gắn cờ `profiled` lên reg_keys (tấm biển công khai thay cho signups
    // khoá-đọc). Cổng/đặt-chỗ CHỈ chặn khi profiled=true → hold "trần" {at} (bỏ dở) không khoá nhầm người vào
    // lại. Best-effort: thường reg_keys/{key} đã có {at} từ apiRegReserve ⇒ merge = update field profiled.
    if (BLOCK_DUP && DEDUP_FIELD) {
      const dk = _dedupKey(fields[DEDUP_FIELD]);
      if (dk) { try { await col(COL.REG_KEYS).doc(dk).set({ profiled: true }, { merge: true }); } catch (e) {} }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: REASON.ERROR, detail: String(e) };
  }
}

// Xoá hồ sơ của CHÍNH MÌNH khỏi signups (best-effort). Dùng khi MSNV của mình hoá ra TRÙNG
// (người khác đã JOIN trước) → bản ghi của mình là rác trùng, dọn đi để admin không thấy data trùng.
// CHỈ gọi với playerId = me.id (pid của mình); chỉ xoá đúng doc signups/{me.id}, KHÔNG đụng bản
// ghi của người thắng (pid khác). Rule cho delete tự do vẫn an toàn: signups khoá đọc + pid là
// token ngẫu nhiên ("u"+8) nên không ai đoán/enumerate được pid của người khác để xoá bừa.
async function apiRemoveProfile(playerId) {
  if (MODE !== MODE_FIREBASE) return { ok: true };   // sheet/demo: không có bảng signups trên server
  const pid = String(playerId || "").trim();
  if (!pid) return { ok: false, reason: REASON.MISSING };
  try {
    await col(COL.SIGNUPS).doc(pid).delete();        // xoá không tồn tại = no-op, không lỗi
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: REASON.ERROR, detail: String(e) };
  }
}

async function apiClaim(payload) {
  // FAIL-CLOSED (cấu hình chống trùng hỏng): chống trùng đang BẬT (BLOCK_DUP && DEDUP_FIELD) nhưng KHÔNG
  // lấy được giá trị để dedup — DEDUP_FIELD trỏ field không có trong fields, hoặc giá trị để trống → dedupVal
  // sẽ rỗng ⇒ transaction BỎ QUA chốt trùng (đúng lỗ khiến 2 trình duyệt cùng MSNV cùng lọt). TỪ CHỐI join
  // thay vì âm thầm cho qua. Mode-agnostic (chặn ở mọi backend). Bình thường UI đã validate nên không chạm tới.
  if (BLOCK_DUP && DEDUP_FIELD && !String((payload.fields || {})[DEDUP_FIELD] || "").trim())
    return { ok: false, reason: REASON.DEDUP_CONFIG };
  if (MODE === MODE_FIREBASE) {
    const icon     = String(payload.icon     || "").trim();
    const pid      = String(payload.playerId || "").trim();
    const fields   = payload.fields || {};
    const name     = String(fields.name || "").trim();
    const dedupVal = (BLOCK_DUP && DEDUP_FIELD) ? String(fields[DEDUP_FIELD] || "").trim() : "";
    // Danh sách cho phép: định danh đối chiếu là DEDUP_FIELD (độc lập với BLOCK_DUP). Chỉ tính khi bật chế độ.
    const allowVal = (ALLOWLIST_MODE && DEDUP_FIELD) ? String(fields[DEDUP_FIELD] || "").trim() : "";
    if (!icon || !name) return { ok: false, reason: REASON.MISSING };
    // allowlistMode bật nhưng KHÔNG có định danh để đối chiếu (cfg thiếu dedupField, hoặc chưa nhập field
    // đó) ⇒ coi như ngoài danh sách. Trả về luôn, không cần mở transaction (cũng không đụng schema cũ).
    if (ALLOWLIST_MODE && !allowVal) return { ok: false, reason: REASON.NOT_ALLOWED };

    // 1 lần chạy giao dịch — tách riêng để bọc retry bên ngoài.
    const runClaimTx = () => db.runTransaction(async tx => {
      const teamRef   = col(COL.TEAMS).doc(icon);              // col() = events/{EVENT_ID}/<name>
      const memberRef = col(COL.MEMBERS).doc(pid);             // guard 1-người-1-đội (chỉ {icon})
      const signupRef = col(COL.SIGNUPS).doc(pid);             // full hồ sơ — KHOÁ đọc
      const plan      = dedupVal ? _dedupPlan(dedupVal) : null;
      const dedupRef  = plan && plan.k1
        ? col(COL.DEDUP_KEYS).doc(plan.k1) : null;             // guard chống trùng (theo DEDUP_FIELD)
      const foldRef   = plan && plan.k1 && !plan.ascii && plan.F
        ? col(COL.DEDUP_KEYS).doc(plan.F) : null;              // tên CÓ dấu: bản đăng ký KHÔNG dấu (k1 của nó == F) ⇒ coi là cùng người
      const mRef      = plan && plan.k1 && plan.M
        ? col(COL.DEDUP_KEYS).doc(plan.M) : null;              // "~F": tên có dấu GHI (nếu chưa có); tên không dấu ĐỌC để chặn
      const allowRef  = allowVal
        ? col(COL.ALLOWLIST).doc(_dedupKey(allowVal)) : null;  // danh sách cho phép (chỉ khi ALLOWLIST_MODE)

      // Firestore: mọi lệnh ĐỌC phải xong trước mọi lệnh GHI
      const [teamSnap, memberSnap, dedupSnap, foldSnap, mSnap, allowSnap] = await Promise.all([
        tx.get(teamRef), tx.get(memberRef),
        dedupRef ? tx.get(dedupRef) : Promise.resolve(null),
        foldRef  ? tx.get(foldRef)  : Promise.resolve(null),
        mRef     ? tx.get(mRef)     : Promise.resolve(null),
        allowRef ? tx.get(allowRef) : Promise.resolve(null),
      ]);
      // full/already/dup/notAllowed là kết quả TRẢ VỀ (không ném) → vòng retry bên dưới KHÔNG lặp lại chúng.
      // Trả kèm `icon` (đội đã vào) từ snapshot ĐÃ ĐỌC để UI hiện thẳng đội/phòng — không thêm read. DUP: chỉ có
      // khi dedup_keys được ghi với DEDUP_STORE_ICON (doc cũ chỉ {at} ⇒ null).
      if (pid && memberSnap.exists)   return { ok: false, reason: REASON.ALREADY, icon: (memberSnap.data() || {}).icon || null };   // 1 người chỉ 1 đội
      if (plan) {
        // Trùng bất đối xứng (xem _dedupPlan): không dấu ⇒ k1 | M ; có dấu ⇒ k1 | F. Trả kèm `hit` để FE biết nhánh nào (rvResolve).
        const other = plan.ascii ? mSnap : foldSnap;
        if ((dedupSnap && dedupSnap.exists) || (other && other.exists)) {
          const r = _dedupResult(dedupSnap, other, plan.ascii ? "m" : "f"); return { ok: false, reason: REASON.DUP, icon: r.icon, hit: r.hit }; }
      }
      if (allowRef && !allowSnap.exists) return { ok: false, reason: REASON.NOT_ALLOWED };   // ngoài danh sách cho phép
      // ĐỐI CHIẾU HỌ TÊN — dùng dữ liệu `allowSnap` ĐÃ ĐỌC ở trên (KHÔNG thêm lệnh đọc, KHÔNG đổi thứ tự đọc-ghi,
      // KHÔNG đụng vòng retry). Chỉ chặn khi BẬT cờ ALLOWLIST_NAMECHECK & dòng CÓ lưu tên & tên nhập lệch
      // sau chuẩn hoá (bỏ dấu). Cờ tắt (mặc định/sự kiện cũ) ⇒ bỏ qua, chỉ kiểm có-trong-danh-sách.
      if (allowRef && allowSnap.exists && ALLOWLIST_NAMECHECK) {
        const wantName = String((allowSnap.data() || {}).name || "");
        if (wantName && _normName(wantName) !== _normName(name)) return { ok: false, reason: REASON.NAME_MISMATCH };
      }
      // PHÂN PHÒNG THEO GIỚI — cũng chỉ dùng `allowSnap` ĐÃ ĐỌC (không thêm read, không đổi thứ tự đọc-ghi).
      // Giới tính lấy từ DANH SÁCH (không phải người chơi tự khai). Thiếu giới ở dòng danh sách HOẶC phòng
      // không gắn giới ⇒ cho qua (fail-open, đúng quyết định sản phẩm).
      if (allowRef && allowSnap.exists && ALLOWLIST_GENDERCHECK) {
        const listGender = normGender((allowSnap.data() || {}).gender);
        const needGender = roomGender(icon);
        if (listGender && needGender && listGender !== needGender) return { ok: false, reason: REASON.GENDER_MISMATCH };
      }

      const count = teamSnap.exists ? (teamSnap.data().count || 0) : 0;
      const names = teamSnap.exists ? (teamSnap.data().names || []) : [];
      if (count >= capOf(icon)) return { ok: false, reason: REASON.FULL };           // đội đã đủ người (sĩ số riêng đội nếu có, ngược lại CAPACITY chung)

      const at = firebase.firestore.FieldValue.serverTimestamp();
      tx.set(teamRef,   { icon, count: count + 1, names: names.concat(name) }, { merge: true });
      tx.set(memberRef, { icon, at });                                           // guard: chỉ tên đội (đọc được)
      const dedupDoc = DEDUP_STORE_ICON ? { at, icon } : { at };                 // guard: tồn-tại (+ tên đội khi bật cờ; icon không phải PII)
      if (dedupRef) tx.set(dedupRef, dedupDoc);
      // M chỉ do tên CÓ dấu ghi, và CHỈ khi chưa có (rules update:false ⇒ set lên doc sẵn có bị từ chối). Hai tên có dấu cùng F
      // ("Hùng"/"Hưng") đua nhau tạo M: tx thua retry, thấy M đã có ⇒ bỏ qua ghi M ⇒ cả hai đều thành công.
      if (mRef && !plan.ascii && !(mSnap && mSnap.exists)) tx.set(mRef, dedupDoc);
      tx.set(signupRef, { ...fields, playerId: pid, icon, at }, { merge: true });     // PII: merge để GIỮ hồ sơ đã ghi lúc điền xong, chỉ gắn thêm icon
      return { ok: true };
    });

    // Bọc retry jitter quanh runTransaction. SDK tự retry ABORTED BÊN TRONG; lớp ngoài này cứu khi
    // giao dịch NÉM permission-denied (rule từ chối ghi đè stale do nhiều người GIÀNH CÙNG 1 đội).
    // Vì đội còn chỗ thì rốt cuộc ai cũng vào được → cần đủ lần thử + jitter rộng để các bên LỆCH nhịp,
    // tránh cùng retry một lúc rồi lại đụng nhau. Đủ chỗ thì hội tụ 'ok'; hết chỗ thì trả 'full' (dừng).
    // Lưu ý: full/already/dup/notAllowed TRẢ VỀ {ok:false} (không ném) nên thoát ngay, KHÔNG retry.
    // (Tham số phải khớp với loadtest.js để test phản ánh đúng production.)
    const MAX_ATTEMPTS = 8, BASE_MS = 150, CAP_MS = 2500, BUDGET_MS = 12000;
    const startMs = Date.now();
    let lastErr;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        return await runClaimTx();
      } catch (e) {
        lastErr = e;
        if (attempt === MAX_ATTEMPTS - 1 || Date.now() - startMs > BUDGET_MS) break;
        const backoffMs = Math.min(CAP_MS, BASE_MS * 2 ** attempt);
        await new Promise(resolve => setTimeout(resolve, Math.random() * backoffMs));            // full jitter → lệch nhịp
      }
    }
    return { ok: false, reason: REASON.ERROR, detail: String(lastErr) };
  }
  if (MODE === MODE_SHEET) {
    // text/plain tránh CORS preflight; Apps Script vẫn đọc được body JSON
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "claim", ...payload }),
    });
    return await response.json();
  }
  // demo: áp luật đội y như backend (1 token 1 đội, tối đa CAPACITY, chặn trùng theo DEDUP_FIELD)
  const obj      = JSON.parse(await sGet(SK.CLAIMS, true) || "{}");
  const fields   = payload.fields || {};
  const dedupVal = (BLOCK_DUP && DEDUP_FIELD) ? String(fields[DEDUP_FIELD] || "") : "";   // demo: so bất đối xứng (_sameDedup), khớp backend firebase
  for (const ic in obj) {
    for (const m of obj[ic]) {
      if (m.pid && m.pid === payload.playerId) return { ok: false, reason: REASON.ALREADY, icon: ic };
      if (dedupVal && _sameDedup(m[DEDUP_FIELD] || "", dedupVal)) return { ok: false, reason: REASON.DUP, icon: ic };
    }
  }
  // Danh sách cho phép (demo) — SAU already/dup, TRƯỚC full (khớp thứ tự nhánh firebase). Demo không có
  // UI admin nên seed thủ công khi dev: localStorage["linhthu:allowlistMode:<EVENT_ID>"]="true" +
  // localStorage["linhthu:allowlist:<EVENT_ID>"]=JSON.stringify({"NV2026001":1,"NV2026002":1,...})
  // (muốn thử phân phòng theo giới: entry dạng object, vd {"NV2026001":{"gender":"Nam"}}).
  if ((await sGet(SK.ALLOWLIST_MODE, true)) === "true" && DEDUP_FIELD) {
    const allowKey  = _dedupKey(fields[DEDUP_FIELD] || "");
    const allowList = JSON.parse(await sGet(SK.ALLOWLIST, true) || "{}");
    if (!allowKey || !allowList[allowKey]) return { ok: false, reason: REASON.NOT_ALLOWED };
    // Giới tính (khớp nhánh firebase): entry demo dạng object {gender:"Nam"} mới có giới; dạng 1/true ⇒ bỏ qua.
    if (ALLOWLIST_GENDERCHECK) {
      const listGender = normGender((allowList[allowKey] || {}).gender);
      const needGender = roomGender(payload.icon);
      if (listGender && needGender && listGender !== needGender) return { ok: false, reason: REASON.GENDER_MISMATCH };
    }
  }
  const arr = obj[payload.icon] || (obj[payload.icon] = []);
  if (arr.length >= capOf(payload.icon)) return { ok: false, reason: REASON.FULL };
  arr.push({ ...fields, pid: payload.playerId });
  await sSet(SK.CLAIMS, JSON.stringify(obj), true);
  return { ok: true };
}

// Realtime: server tự ĐẨY thay đổi của các đội cho mọi client → bỏ hẳn poll 3s (rẻ + tức thì).
// Mỗi đội = 1 doc nhỏ; 500 client cùng nghe vẫn nhẹ vì chỉ truyền phần thay đổi.
let _unsubTeams = null;
function apiSubscribe(onChange) {
  if (MODE !== MODE_FIREBASE) return null;       // sheet/demo vẫn dùng poll như cũ
  _unsubTeams = col(COL.TEAMS).onSnapshot(
    snap => { const teams = {}; snap.forEach(d => { const v = d.data(); teams[v.icon] = { count: v.count || 0, names: v.names || [] }; }); onChange(teams); },
    _err => { /* mạng trục trặc → giữ state cũ; vòng poll dự phòng sẽ tự đồng bộ lại */ }
  );
  return () => { if (_unsubTeams) _unsubTeams(); };
}
