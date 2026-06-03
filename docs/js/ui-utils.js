const MODE    = (typeof FIREBASE_ON !== "undefined" && FIREBASE_ON) ? "firebase" : (SCRIPT_URL ? "sheet" : "demo");
const REAL    = !!(window.storage && typeof window.storage.get === "function");
const $       = id => document.getElementById(id);
const byEmoji = {};
// byEmoji được dựng bởi rebuildByEmoji() sau khi boot() tải xong ICONS từ Firestore.
// Ở chế độ demo/sheet: boot() gọi ngay với DEFAULT_ICONS.
function rebuildByEmoji() {
  Object.keys(byEmoji).forEach(k => delete byEmoji[k]);
  ICONS.forEach(g => { byEmoji[g.icon] = g; });
}

// State cục bộ
let me      = { id: null, fields: {} };
let myIcon  = null;   // emoji mình đã chọn
let editing = false;
let state   = {};     // map đội { icon: { count, names } } từ server
let stateLoaded = false; // đã NHẬN được state thật từ server lần nào chưa (phân biệt "rỗng" với "chưa tải/lỗi mạng")
let busy    = false;
let lastSig = null;   // chữ ký dữ liệu — chỉ render lại khi đổi (chống nhấp nháy)
let _skipSelfHeal = false; // true trong window vừa tham gia → chặn self-heal stale-state

const initial      = s => (s || "?").trim().charAt(0).toUpperCase();
const firstName    = s => { const p = (s || "").trim().split(/\s+/); return p[p.length - 1] || s || ""; };
const profileComplete = () => FIELDS.every(f => !f.required || (me.fields[f.key] || "").trim());
const labelOf = key => (FIELDS.find(f => f.key === key) || {}).label || key;
const esc = s => (s || "").replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));

let toastTimer;
// sticky=true → giữ toast cho tới khi gọi toast() kế tiếp (dùng cho trạng thái "đang ghi nhận…").
function toast(msg, sticky) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  if (!sticky) toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

function validEmployeeId(v) { return /^[A-Za-z0-9]{3,20}$/.test((v || "").trim()); }
function fieldError(f, v) {
  v = (v || "").trim();
  if (f.required && !v) return "Bắt buộc nhập";
  if (!v) return "";
  if (f.key === "employeeId" && !validEmployeeId(v)) return "Mã số nhân viên không hợp lệ (chỉ chữ và số, 3–20 ký tự)";
  return "";
}
