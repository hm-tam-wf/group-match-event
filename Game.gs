function getState() {
  const sh   = getSheet();
  const last = sh.getLastRow();
  const taken = [];
  if (last >= 2) {
    const rows = sh.getRange(2, 1, last - 1, TOTAL_COL).getValues();
    rows.forEach(r => {
      const icon = String(r[ICON_COL - 1] || "").trim();
      if (icon) taken.push({ icon, name: String(r[NAME_COL - 1] || "") });
    });
  }
  return { ok: true, taken };
}

function claim(data) {
  const icon   = String(data.icon     || "").trim();
  const pid    = String(data.playerId || "").trim();
  const fields = data.fields || {};
  const name   = String(fields.name   || "").trim();
  if (!icon || !name) return { ok: false, reason: "missing" };

  const sh   = getSheet();
  const last = sh.getLastRow();
  if (last >= 2) {
    const rows  = sh.getRange(2, 1, last - 1, TOTAL_COL).getValues();
    const email = String(fields.email || "").trim().toLowerCase();
    for (const r of rows) {
      if (String(r[ICON_COL  - 1] || "").trim() === icon) return { ok: false, reason: "taken" };
      if (pid && String(r[PID_COL - 1] || "").trim() === pid) return { ok: false, reason: "already" };
      if (BLOCK_DUP_EMAIL && email &&
          String(r[EMAIL_COL - 1] || "").trim().toLowerCase() === email) return { ok: false, reason: "dup_email" };
    }
  }

  sh.appendRow([new Date(), icon, ...FIELD_KEYS.map(k => String(fields[k] || "")), pid]);
  return { ok: true };
}

// Xoá toàn bộ dòng dữ liệu, GIỮ lại dòng tiêu đề. Idempotent (gọi nhiều lần vẫn an toàn).
// Gọi bên trong LockService ở doPost nên nhiều client cùng reset vẫn không tranh chấp.
function resetState() {
  const sh   = getSheet();
  const last = sh.getLastRow();
  if (last >= 2) sh.deleteRows(2, last - 1); // chừa row 1 (header)
  return { ok: true, reset: true };
}
