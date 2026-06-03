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
//   events/{EVENT_ID}/signups/{pid}    : { ...fields, playerId, icon, at } — FULL hồ sơ, KHOÁ ĐỌC (xuất qua Console)
// Sĩ số tối đa được ép thêm ở Security Rules (count <= CAPACITY) nên client gian lận cũng không vượt được.

// Mọi collection của 1 sự kiện nằm dưới events/{EVENT_ID}/ → đổi EVENT_ID là sang không gian dữ liệu mới.
const col = name => db.collection("events").doc(EVENT_ID).collection(name);

function _dedupKey(v) { return String(v || "").trim().toUpperCase().replace(/\s+/g, ""); }

// Kiểm tra NHANH một giá trị dedup (vd MSNV) ĐÃ được đăng ký chưa — để CHẶN NGAY ở cổng vào
// (trước khi cho chọn đội), không đợi tới lúc claim. Chỉ đọc 1 doc dedup_keys (rules cho phép get).
// Trả false khi: không bật chống trùng / không firebase / lỗi mạng → KHÔNG chặn nhầm
// (transaction trong apiClaim vẫn là tuyến chặn cuối, an toàn trước tranh chấp).
async function apiDedupTaken(value) {
  if (MODE !== "firebase" || !BLOCK_DUP || !DEDUP_FIELD) return false;
  const key = _dedupKey(value);
  if (!key) return false;
  try {
    const snap = await col("dedup_keys").doc(key).get();
    return snap.exists;
  } catch (e) {
    return false;
  }
}

async function apiState() {
  if (MODE === "firebase") {
    const snap  = await col("teams").get();
    const teams = {};
    snap.forEach(d => { const v = d.data(); teams[v.icon] = { count: v.count || 0, names: v.names || [] }; });
    return teams;
  }
  if (MODE === "sheet") {
    const r = await fetch(SCRIPT_URL + "?action=state", { method: "GET" });
    const j = await r.json();
    return (j && j.teams) || {};
  }
  // demo: dựng map đội từ claims cục bộ ({ icon: [ {...fields, pid}, ... ] })  (claims đã namespace theo EVENT_ID ở storage.js)
  const obj = JSON.parse(await sGet("claims", true) || "{}");
  const teams = {};
  Object.keys(obj).forEach(icon => {
    const arr = obj[icon] || [];
    teams[icon] = { count: arr.length, names: arr.map(m => m.name || "") };
  });
  return teams;
}

async function apiClaim(payload) {
  if (MODE === "firebase") {
    const icon     = String(payload.icon     || "").trim();
    const pid      = String(payload.playerId || "").trim();
    const f        = payload.fields || {};
    const name     = String(f.name || "").trim();
    const dedupVal = (BLOCK_DUP && DEDUP_FIELD) ? String(f[DEDUP_FIELD] || "").trim() : "";
    if (!icon || !name) return { ok: false, reason: "missing" };

    // 1 lần chạy giao dịch — tách riêng để bọc retry bên ngoài.
    const runClaimTx = () => db.runTransaction(async tx => {
      const teamRef   = col("teams").doc(icon);              // col() = events/{EVENT_ID}/<name>
      const memberRef = col("members").doc(pid);             // guard 1-người-1-đội (chỉ {icon})
      const signupRef = col("signups").doc(pid);             // full hồ sơ — KHOÁ đọc
      const dedupRef  = dedupVal
        ? col("dedup_keys").doc(_dedupKey(dedupVal)) : null; // guard chống trùng (theo DEDUP_FIELD)

      // Firestore: mọi lệnh ĐỌC phải xong trước mọi lệnh GHI
      const [t, mb, dk] = await Promise.all([
        tx.get(teamRef), tx.get(memberRef), dedupRef ? tx.get(dedupRef) : Promise.resolve(null),
      ]);
      // full/already/dup là kết quả TRẢ VỀ (không ném) → vòng retry bên dưới KHÔNG lặp lại chúng.
      if (pid && mb.exists)   return { ok: false, reason: "already" };          // 1 người chỉ 1 đội
      if (dk && dk.exists)    return { ok: false, reason: "dup" };

      const count = t.exists ? (t.data().count || 0) : 0;
      const names = t.exists ? (t.data().names || []) : [];
      if (count >= CAPACITY) return { ok: false, reason: "full" };              // đội đã đủ người

      const at = firebase.firestore.FieldValue.serverTimestamp();
      tx.set(teamRef,   { icon, count: count + 1, names: names.concat(name) }, { merge: true });
      tx.set(memberRef, { icon, at });                                           // guard: chỉ tên đội (đọc được)
      if (dedupRef) tx.set(dedupRef, { at });                                    // guard: chỉ tồn-tại
      tx.set(signupRef, { ...f, playerId: pid, icon, at });                      // PII (khoá đọc, ghi đủ field)
      return { ok: true };
    });

    // Bọc retry jitter quanh runTransaction. SDK tự retry ABORTED BÊN TRONG; lớp ngoài này cứu khi
    // giao dịch NÉM permission-denied (rule từ chối ghi đè stale do nhiều người GIÀNH CÙNG 1 đội).
    // Vì đội còn chỗ thì rốt cuộc ai cũng vào được → cần đủ lần thử + jitter rộng để các bên LỆCH nhịp,
    // tránh cùng retry một lúc rồi lại đụng nhau. Đủ chỗ thì hội tụ 'ok'; hết chỗ thì trả 'full' (dừng).
    // Lưu ý: full/already/dup TRẢ VỀ {ok:false} (không ném) nên thoát ngay, KHÔNG retry.
    // (Tham số phải khớp với loadtest.js để test phản ánh đúng production.)
    const MAX_ATTEMPTS = 8, BASE_MS = 150, CAP_MS = 2500, BUDGET_MS = 12000;
    const t0 = Date.now();
    let lastErr;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        return await runClaimTx();
      } catch (e) {
        lastErr = e;
        if (attempt === MAX_ATTEMPTS - 1 || Date.now() - t0 > BUDGET_MS) break;
        const back = Math.min(CAP_MS, BASE_MS * 2 ** attempt);
        await new Promise(r => setTimeout(r, Math.random() * back));            // full jitter → lệch nhịp
      }
    }
    return { ok: false, reason: "error", detail: String(lastErr) };
  }
  if (MODE === "sheet") {
    // text/plain tránh CORS preflight; Apps Script vẫn đọc được body JSON
    const r = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "claim", ...payload }),
    });
    return await r.json();
  }
  // demo: áp luật đội y như backend (1 token 1 đội, tối đa CAPACITY, chặn trùng theo DEDUP_FIELD)
  const obj      = JSON.parse(await sGet("claims", true) || "{}");
  const fields   = payload.fields || {};
  const dedupVal = (BLOCK_DUP && DEDUP_FIELD) ? _dedupKey(fields[DEDUP_FIELD] || "") : "";
  for (const ic in obj) {
    for (const m of obj[ic]) {
      if (m.pid && m.pid === payload.playerId) return { ok: false, reason: "already" };
      if (dedupVal && _dedupKey(m[DEDUP_FIELD] || "") === dedupVal) return { ok: false, reason: "dup" };
    }
  }
  const arr = obj[payload.icon] || (obj[payload.icon] = []);
  if (arr.length >= CAPACITY) return { ok: false, reason: "full" };
  arr.push({ ...fields, pid: payload.playerId });
  await sSet("claims", JSON.stringify(obj), true);
  return { ok: true };
}

// Realtime: server tự ĐẨY thay đổi của các đội cho mọi client → bỏ hẳn poll 3s (rẻ + tức thì).
// Mỗi đội = 1 doc nhỏ; 500 client cùng nghe vẫn nhẹ vì chỉ truyền phần thay đổi.
let _unsubTeams = null;
function apiSubscribe(onChange) {
  if (MODE !== "firebase") return null;       // sheet/demo vẫn dùng poll như cũ
  _unsubTeams = col("teams").onSnapshot(
    snap => { const teams = {}; snap.forEach(d => { const v = d.data(); teams[v.icon] = { count: v.count || 0, names: v.names || [] }; }); onChange(teams); },
    _err => { /* mạng trục trặc → giữ state cũ; vòng poll dự phòng sẽ tự đồng bộ lại */ }
  );
  return () => { if (_unsubTeams) _unsubTeams(); };
}
