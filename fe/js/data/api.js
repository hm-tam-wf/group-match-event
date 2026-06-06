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
  ERROR:         "error",
};

// Mọi collection của 1 sự kiện nằm dưới events/{EVENT_ID}/ → đổi EVENT_ID là sang không gian dữ liệu mới.
const col = name => db.collection("events").doc(EVENT_ID).collection(name);

function _dedupKey(v) { return String(v || "").trim().toUpperCase().replace(/\s+/g, ""); }

// Chuẩn hoá HỌ TÊN để so khớp với danh sách cho phép: bỏ dấu tiếng Việt, gộp khoảng trắng, IN HOA.
// "Lê Văn A" / "le  van a" → "LE VAN A". Khoan dung (bỏ dấu) để tránh chặn nhầm người gõ thiếu/khác dấu.
// Dùng ở cả popup (UX) lẫn transaction apiClaim (chốt). NFD không tách được đ/Đ nên thay tay.
function _normName(v) {
  return String(v || "")
    .normalize("NFD").replace(new RegExp("[" + String.fromCharCode(768) + "-" + String.fromCharCode(879) + "]", "g"), "")  // bỏ dấu kết hợp U+0300..U+036F
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .trim().replace(/\s+/g, " ").toUpperCase();
}

// Kiểm tra NHANH một giá trị dedup (vd MSNV) ĐÃ được đăng ký chưa — để CHẶN NGAY ở cổng vào
// (trước khi cho chọn đội), không đợi tới lúc claim. Chỉ đọc 1 doc dedup_keys (rules cho phép get).
// Trả false khi: không bật chống trùng / không firebase / lỗi mạng → KHÔNG chặn nhầm
// (transaction trong apiClaim vẫn là tuyến chặn cuối, an toàn trước tranh chấp).
async function apiDedupTaken(value) {
  if (MODE !== MODE_FIREBASE || !BLOCK_DUP || !DEDUP_FIELD) return false;
  const key = _dedupKey(value);
  if (!key) return false;
  try {
    const snap = await col(COL.DEDUP_KEYS).doc(key).get();
    return snap.exists;
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
// apiRegReserve: transaction — nếu reg_keys/{key} đã có & KHÔNG phải chỗ mình ⇒ {ok:false,reason:"dup"};
// chưa có ⇒ set {at} + nhớ reservedKey. Lỗi mạng/không bật ⇒ {ok:true} (fail-open; JOIN vẫn là chốt cuối).
async function apiRegReserve(value) {
  if (MODE !== MODE_FIREBASE || !BLOCK_DUP || !DEDUP_FIELD) return { ok: true };
  const key = _dedupKey(value);
  if (!key) return { ok: true };                          // không có MSNV ⇒ không đặt chỗ (như dedupVal rỗng)
  const mineKey = await sGet(SK.RESERVED_KEY, false);
  if (mineKey === key) return { ok: true };               // đúng chỗ mình đã giữ ⇒ cho qua (sửa lại hồ sơ)
  try {
    const ref = col(COL.REG_KEYS).doc(key);
    const res = await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (snap.exists) return { ok: false, reason: REASON.DUP }; // người khác đã giữ chỗ MSNV này
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

// Cổng VÀO TRANG: MSNV đã được người KHÁC giữ chỗ chưa? (chỗ của mình ⇒ không chặn). Chỉ đọc 1 doc reg_keys.
// Bịt lỗ "bị chặn ở save() rồi reload để vào lưới": người bị chặn không có reservedKey ⇒ vẫn bị chặn ở cổng.
async function apiRegTaken(value) {
  if (MODE !== MODE_FIREBASE || !BLOCK_DUP || !DEDUP_FIELD) return false;
  const key = _dedupKey(value);
  if (!key) return false;
  const mineKey = await sGet(SK.RESERVED_KEY, false);
  if (mineKey === key) return false;                      // chỗ của mình ⇒ KHÔNG chặn
  try {
    const snap = await col(COL.REG_KEYS).doc(key).get();
    return snap.exists;
  } catch (e) {
    return false;
  }
}

// Khi ALLOWLIST_MODE bật: kiểm tra định danh (DEDUP_FIELD) có nằm trong allowlist chưa — để CHẶN NGAY
// ở cổng vào (trước khi cho chọn đội), không đợi tới lúc claim. Chỉ đọc 1 doc allowlist (rules cho phép get).
// Trả {allowed, name}: allowed=TRUE (cho qua) khi không bật chế độ / không firebase / lỗi mạng → KHÔNG
// chặn nhầm; allowed=FALSE = NGOÀI danh sách. name = tên đã đăng ký ("" nếu danh sách không có cột tên),
// dùng để đối chiếu HỌ TÊN ở popup (transaction apiClaim vẫn là tuyến chặn cuối cho cả hai).
async function apiAllowlistInfo(value) {
  if (MODE !== MODE_FIREBASE || !ALLOWLIST_MODE || !DEDUP_FIELD) return { allowed: true, name: "" };
  const key = _dedupKey(value);
  if (!key) return { allowed: false, name: "" };   // bật allowlist mà không có định danh → coi như ngoài danh sách
  try {
    const snap = await col(COL.ALLOWLIST).doc(key).get();
    if (!snap.exists) return { allowed: false, name: "" };
    return { allowed: true, name: String((snap.data() || {}).name || "") };
  } catch (e) {
    return { allowed: true, name: "" };   // lỗi mạng → KHÔNG chặn nhầm; apiClaim là chốt cuối
  }
}
// Tiện ích boolean cho cổng vào lúc tải trang (chỉ cần biết được/không) — tái dùng apiAllowlistInfo.
async function apiAllowlistAllowed(value) { return (await apiAllowlistInfo(value)).allowed; }

async function apiState() {
  if (MODE === MODE_FIREBASE) {
    const snap  = await col(COL.TEAMS).get();
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
      const dedupRef  = dedupVal
        ? col(COL.DEDUP_KEYS).doc(_dedupKey(dedupVal)) : null; // guard chống trùng (theo DEDUP_FIELD)
      const allowRef  = allowVal
        ? col(COL.ALLOWLIST).doc(_dedupKey(allowVal)) : null;  // danh sách cho phép (chỉ khi ALLOWLIST_MODE)

      // Firestore: mọi lệnh ĐỌC phải xong trước mọi lệnh GHI
      const [teamSnap, memberSnap, dedupSnap, allowSnap] = await Promise.all([
        tx.get(teamRef), tx.get(memberRef),
        dedupRef ? tx.get(dedupRef) : Promise.resolve(null),
        allowRef ? tx.get(allowRef) : Promise.resolve(null),
      ]);
      // full/already/dup/notAllowed là kết quả TRẢ VỀ (không ném) → vòng retry bên dưới KHÔNG lặp lại chúng.
      if (pid && memberSnap.exists)   return { ok: false, reason: REASON.ALREADY };          // 1 người chỉ 1 đội
      if (dedupSnap && dedupSnap.exists)    return { ok: false, reason: REASON.DUP };
      if (allowRef && !allowSnap.exists) return { ok: false, reason: REASON.NOT_ALLOWED };   // ngoài danh sách cho phép
      // ĐỐI CHIẾU HỌ TÊN — dùng dữ liệu `allowSnap` ĐÃ ĐỌC ở trên (KHÔNG thêm lệnh đọc, KHÔNG đổi thứ tự đọc-ghi,
      // KHÔNG đụng vòng retry). Chỉ chặn khi BẬT cờ ALLOWLIST_NAMECHECK & dòng CÓ lưu tên & tên nhập lệch
      // sau chuẩn hoá (bỏ dấu). Cờ tắt (mặc định/sự kiện cũ) ⇒ bỏ qua, chỉ kiểm có-trong-danh-sách.
      if (allowRef && allowSnap.exists && ALLOWLIST_NAMECHECK) {
        const wantName = String((allowSnap.data() || {}).name || "");
        if (wantName && _normName(wantName) !== _normName(name)) return { ok: false, reason: REASON.NAME_MISMATCH };
      }

      const count = teamSnap.exists ? (teamSnap.data().count || 0) : 0;
      const names = teamSnap.exists ? (teamSnap.data().names || []) : [];
      if (count >= CAPACITY) return { ok: false, reason: REASON.FULL };              // đội đã đủ người

      const at = firebase.firestore.FieldValue.serverTimestamp();
      tx.set(teamRef,   { icon, count: count + 1, names: names.concat(name) }, { merge: true });
      tx.set(memberRef, { icon, at });                                           // guard: chỉ tên đội (đọc được)
      if (dedupRef) tx.set(dedupRef, { at });                                    // guard: chỉ tồn-tại
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
  const dedupVal = (BLOCK_DUP && DEDUP_FIELD) ? _dedupKey(fields[DEDUP_FIELD] || "") : "";
  for (const ic in obj) {
    for (const m of obj[ic]) {
      if (m.pid && m.pid === payload.playerId) return { ok: false, reason: REASON.ALREADY };
      if (dedupVal && _dedupKey(m[DEDUP_FIELD] || "") === dedupVal) return { ok: false, reason: REASON.DUP };
    }
  }
  // Danh sách cho phép (demo) — SAU already/dup, TRƯỚC full (khớp thứ tự nhánh firebase). Demo không có
  // UI admin nên seed thủ công khi dev: localStorage["linhthu:allowlistMode:<EVENT_ID>"]="true" +
  // localStorage["linhthu:allowlist:<EVENT_ID>"]=JSON.stringify({"NV2026001":1,"NV2026002":1,...}).
  if ((await sGet(SK.ALLOWLIST_MODE, true)) === "true" && DEDUP_FIELD) {
    const allowKey  = _dedupKey(fields[DEDUP_FIELD] || "");
    const allowList = JSON.parse(await sGet(SK.ALLOWLIST, true) || "{}");
    if (!allowKey || !allowList[allowKey]) return { ok: false, reason: REASON.NOT_ALLOWED };
  }
  const arr = obj[payload.icon] || (obj[payload.icon] = []);
  if (arr.length >= CAPACITY) return { ok: false, reason: REASON.FULL };
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
