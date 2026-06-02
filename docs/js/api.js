// ─────────────────────────────────────────────────────────────────────────
// Tầng dữ liệu — MÔ HÌNH ĐỘI (mỗi icon = 1 đội, tối đa CAPACITY người). 3 chế độ:
//   firebase → Firestore (chịu tải lớn, ghi atomic, đọc realtime)  ← khuyến nghị cho ~500 người
//   sheet    → Google Apps Script + Sheet (legacy, không hợp >50 người cùng lúc)
//   demo     → in-memory / window.storage (chạy thử cục bộ)
// Hợp đồng: apiState()→{ icon:{count,names[]} }; apiClaim()→{ok}|{ok:false,reason};
//           apiSubscribe(cb) (chỉ firebase) đẩy realtime, thay cho việc poll mỗi 3s.
// ─────────────────────────────────────────────────────────────────────────

// Mô hình Firestore (tách PII khỏi mọi doc đọc-được — xem firestore.rules):
//   teams/{icon}        : { icon, count, names:[...] }              — CÔNG KHAI, chỉ TÊN (hiển thị realtime)
//   members/{pid}       : { icon, at }                              — guard 1-người-1-đội (đọc 1 doc, CẤM liệt kê)
//   employee_ids/{key}  : { at }                                    — guard chống trùng MSNV (chỉ tồn-tại)
//   signups/{pid}       : { playerId, icon, name, employeeId, at }  — FULL hồ sơ, KHOÁ ĐỌC (xuất qua Console)
// Sĩ số tối đa được ép thêm ở Security Rules (count <= CAPACITY) nên client gian lận cũng không vượt được.

function _employeeIdKey(v) { return String(v || "").trim().toUpperCase().replace(/\s+/g, ""); }

async function apiState() {
  if (MODE === "firebase") {
    const snap  = await db.collection("teams").get();
    const teams = {};
    snap.forEach(d => { const v = d.data(); teams[v.icon] = { count: v.count || 0, names: v.names || [] }; });
    return teams;
  }
  if (MODE === "sheet") {
    const r = await fetch(SCRIPT_URL + "?action=state", { method: "GET" });
    const j = await r.json();
    return (j && j.teams) || {};
  }
  // demo: dựng map đội từ claims cục bộ ({ icon: [ {name,employeeId,pid}, ... ] })
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
    const icon       = String(payload.icon     || "").trim();
    const pid        = String(payload.playerId || "").trim();
    const f          = payload.fields || {};
    const name       = String(f.name       || "").trim();
    const employeeId = String(f.employeeId || "").trim();
    if (!icon || !name) return { ok: false, reason: "missing" };
    try {
      return await db.runTransaction(async tx => {
        const teamRef   = db.collection("teams").doc(icon);
        const memberRef = db.collection("members").doc(pid);           // guard 1-người-1-đội (chỉ {icon})
        const signupRef = db.collection("signups").doc(pid);           // full hồ sơ — KHOÁ đọc
        const eidRef    = (BLOCK_DUP_EMPLOYEE_ID && employeeId)
          ? db.collection("employee_ids").doc(_employeeIdKey(employeeId)) : null; // guard chống trùng MSNV

        // Firestore: mọi lệnh ĐỌC phải xong trước mọi lệnh GHI
        const [t, mb, eid] = await Promise.all([
          tx.get(teamRef), tx.get(memberRef), eidRef ? tx.get(eidRef) : Promise.resolve(null),
        ]);
        if (pid && mb.exists)   return { ok: false, reason: "already" };          // 1 người chỉ 1 đội
        if (eid && eid.exists)  return { ok: false, reason: "dup_employee_id" };

        const count = t.exists ? (t.data().count || 0) : 0;
        const names = t.exists ? (t.data().names || []) : [];
        if (count >= CAPACITY) return { ok: false, reason: "full" };              // đội đã đủ người

        const at = firebase.firestore.FieldValue.serverTimestamp();
        tx.set(teamRef,   { icon, count: count + 1, names: names.concat(name) }, { merge: true });
        tx.set(memberRef, { icon, at });                                           // guard: chỉ tên đội (đọc được)
        if (eidRef) tx.set(eidRef, { at });                                        // guard: chỉ tồn-tại
        tx.set(signupRef, { playerId: pid, icon, name, employeeId, at });          // PII (khoá đọc)
        return { ok: true };
      });
    } catch (e) { return { ok: false, reason: "error", detail: String(e) }; }
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
  // demo: áp luật đội y như backend (1 token 1 đội, tối đa CAPACITY, chặn trùng MSNV)
  const obj        = JSON.parse(await sGet("claims", true) || "{}");
  const fields     = payload.fields || {};
  const employeeId = _employeeIdKey(fields.employeeId || "");
  for (const ic in obj) {
    for (const m of obj[ic]) {
      if (m.pid && m.pid === payload.playerId) return { ok: false, reason: "already" };
      if (employeeId && _employeeIdKey(m.employeeId || "") === employeeId) return { ok: false, reason: "dup_employee_id" };
    }
  }
  const arr = obj[payload.icon] || (obj[payload.icon] = []);
  if (arr.length >= CAPACITY) return { ok: false, reason: "full" };
  arr.push({ name: String(fields.name || ""), employeeId, pid: payload.playerId });
  await sSet("claims", JSON.stringify(obj), true);
  return { ok: true };
}

// Realtime: server tự ĐẨY thay đổi của các đội cho mọi client → bỏ hẳn poll 3s (rẻ + tức thì).
// Mỗi đội = 1 doc nhỏ; 500 client cùng nghe vẫn nhẹ vì chỉ truyền phần thay đổi.
let _unsubTeams = null;
function apiSubscribe(onChange) {
  if (MODE !== "firebase") return null;       // sheet/demo vẫn dùng poll như cũ
  _unsubTeams = db.collection("teams").onSnapshot(
    snap => { const teams = {}; snap.forEach(d => { const v = d.data(); teams[v.icon] = { count: v.count || 0, names: v.names || [] }; }); onChange(teams); },
    _err => { /* mạng trục trặc → giữ state cũ; vòng poll dự phòng sẽ tự đồng bộ lại */ }
  );
  return () => { if (_unsubTeams) _unsubTeams(); };
}
