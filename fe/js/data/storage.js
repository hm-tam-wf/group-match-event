// Lưu trữ: ưu tiên window.storage (Claude artifact); nếu không có thì dùng localStorage
// để TOKEN định danh + đội đã tham gia NHỚ qua lần tải lại trang (không hiện lại popup).
// Nếu localStorage bị chặn (chế độ riêng tư) → fallback in-memory (mất khi tải lại).
const mem = {};
let LS_OK = false;
try { localStorage.setItem("__lt_probe", "1"); localStorage.removeItem("__lt_probe"); LS_OK = true; } catch (e) { LS_OK = false; }
const LS_PREFIX = "linhthu:";
const sk = key => key + ":" + EVENT_ID;   // namespace dữ liệu cục bộ theo sự kiện

// Khoá lưu trữ cục bộ ở tầng app (CONTRACT — đổi VALUE = mất trạng thái người dùng cũ; chỉ gom một nơi — §4).
const SK = {
  ME:             "me",
  CLAIMS:         "claims",
  RESERVED_KEY:   "reservedKey",
  DATA_EPOCH:     "dataEpoch",     // "thế hệ" dữ liệu đã đồng bộ — so với meta/config.dataEpoch để biết admin đã "Xóa dữ liệu" chưa
  ALLOWLIST_MODE: "allowlistMode",
  ALLOWLIST:      "allowlist",
};

async function sGet(key, shared) {
  try {
    if (REAL)  { const r = await window.storage.get(sk(key), shared); return r ? r.value : null; }
    if (LS_OK) { const v = localStorage.getItem(LS_PREFIX + sk(key)); return v === null ? null : v; }
    return sk(key) in mem ? mem[sk(key)] : null;
  } catch (e) { return null; }
}

async function sSet(key, val, shared) {
  try {
    if (REAL)  { await window.storage.set(sk(key), val, shared); return; }
    if (LS_OK) { localStorage.setItem(LS_PREFIX + sk(key), val);  return; }
    mem[sk(key)] = val;
  } catch (e) {}
}

async function sDel(key, shared) {
  try {
    if (REAL)  { await window.storage.delete(sk(key), shared);  return; }
    if (LS_OK) { localStorage.removeItem(LS_PREFIX + sk(key));  return; }
    delete mem[sk(key)];
  } catch (e) {}
}
