// Trạng thái: mỗi icon = 1 ĐỘI. Trả về cho mỗi đội số lượng + DANH SÁCH TÊN.
// TUYỆT ĐỐI không trả email/SĐT ra ngoài (bảo mật) — chỉ trả tên để hiển thị.
function getState() {
  const sh   = getSheet();
  const last = sh.getLastRow();
  const teams = {}; // { "🦊": { count, names: [] }, ... }
  if (last >= 2) {
    const rows = sh.getRange(2, 1, last - 1, TOTAL_COL).getValues();
    rows.forEach(r => {
      const icon = String(r[ICON_COL - 1] || "").trim();
      if (!icon) return;
      const name = String(r[NAME_COL - 1] || "");
      const t = teams[icon] || (teams[icon] = { count: 0, names: [] });
      t.count++;
      t.names.push(name); // thứ tự dòng = thứ tự tham gia
    });
  }
  return { ok: true, teams };
}

// Tham gia một đội. Một icon chứa tối đa CAPACITY người; 1 token chỉ vào ĐÚNG 1 đội.
// Chạy bên trong LockService (doPost) nên việc đếm + ghi là nguyên tử → không ai chen thành người thứ 11.
function claim(data) {
  const icon   = String(data.icon     || "").trim();
  const pid    = String(data.playerId || "").trim();
  const fields = data.fields || {};
  const name   = String(fields.name   || "").trim();
  if (!icon || !name) return { ok: false, reason: "missing" };

  const sh   = getSheet();
  const last = sh.getLastRow();
  let count = 0; // số người hiện có của ĐỘI đang chọn
  if (last >= 2) {
    const rows  = sh.getRange(2, 1, last - 1, TOTAL_COL).getValues();
    const email = String(fields.email || "").trim().toLowerCase();
    for (const r of rows) {
      // token đã ở bất kỳ đội nào → chỉ được 1 đội
      if (pid && String(r[PID_COL - 1] || "").trim() === pid) return { ok: false, reason: "already" };
      // chặn trùng email trên toàn bộ bảng
      if (BLOCK_DUP_EMAIL && email &&
          String(r[EMAIL_COL - 1] || "").trim().toLowerCase() === email) return { ok: false, reason: "dup_email" };
      // đếm sĩ số đội đang chọn
      if (String(r[ICON_COL - 1] || "").trim() === icon) count++;
    }
  }
  if (count >= CAPACITY) return { ok: false, reason: "full" };

  sh.appendRow([new Date(), icon, ...FIELD_KEYS.map(k => String(fields[k] || "")), pid]);
  return { ok: true };
}
