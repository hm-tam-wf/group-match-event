const MODE    = (typeof FIREBASE_ON !== "undefined" && FIREBASE_ON) ? MODE_FIREBASE : (SCRIPT_URL ? MODE_SHEET : MODE_DEMO);
const REAL    = !!(window.storage && typeof window.storage.get === "function");
const $       = id => document.getElementById(id);
const byEmoji = {};
// byEmoji được dựng bởi rebuildByEmoji() sau khi boot() tải xong ICONS từ Firestore.
// Ở chế độ demo/sheet: boot() gọi ngay với DEFAULT_ICONS.
function rebuildByEmoji() {
  Object.keys(byEmoji).forEach(k => delete byEmoji[k]);
  ICONS.forEach(iconDef => { byEmoji[iconDef.icon] = iconDef; });
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
let dupBlocked = false; // true khi MSNV đã đăng ký rồi → chặn vào lưới chọn đội (cổng chống trùng)
let allowBlocked = false; // true khi bật allowlist & MSNV KHÔNG trong danh sách → chặn vào lưới (cổng allowlist)

const initial      = s => (s || "?").trim().charAt(0).toUpperCase();
const firstName    = s => { const p = (s || "").trim().split(/\s+/); return p[p.length - 1] || s || ""; };
const profileComplete = () => FIELDS.every(f => !f.required || (me.fields[f.key] || "").trim());
// HỢP LỆ để tham gia: mọi field qua được fieldError (bắt buộc đủ VÀ đúng định dạng, không chỉ khác rỗng).
// Dùng làm CỔNG vào lưới chọn đội — thông tin chưa đúng/đủ thì giữ ở popup, KHÔNG cho vào trang.
const profileValid = () => FIELDS.every(f => !fieldError(f, me.fields[f.key]));
const labelOf = key => (FIELDS.find(f => f.key === key) || {}).label || key;
const esc = s => (s || "").replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));

let toastTimer;
const TOAST_HIDE_MS = 2400;   // thời gian tự ẩn toast (ms) khi không sticky
// sticky=true → giữ toast cho tới khi gọi toast() kế tiếp (dùng cho trạng thái "đang ghi nhận…").
function toast(msg, sticky) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  if (!sticky) toastTimer = setTimeout(() => el.classList.remove("show"), TOAST_HIDE_MS);
}

function validEmployeeId(v) { return /^[A-Za-z0-9]{3,20}$/.test((v || "").trim()); }
// Tên hợp lệ: ≥2 ký tự VÀ có ít nhất 1 chữ cái (gồm chữ có dấu tiếng Việt qua \p{L}) → chặn tên rác
// kiểu "123", "!!!", chuỗi chỉ số/ký hiệu/khoảng trắng. Ô "Họ và tên" thực tế luôn ≥2 ký tự.
function validName(v) { v = (v || "").trim(); return v.length >= 2 && /\p{L}/u.test(v); }
function fieldError(f, v) {
  v = (v || "").trim();
  // Field "name" là hợp đồng BẮT BUỘC của app (apiClaim + ui-render dùng me.fields.name làm tên hiển thị)
  // → ép required dù config lỡ để required:false (vá lỗ "tên rỗng lọt" ở sự kiện cấu hình cũ).
  const required = f.required || f.key === "name";
  if (required && !v) return TEXT.validate.required;
  if (!v) return "";
  if (f.key === "employeeId" && !validEmployeeId(v)) return TEXT.validate.employeeId;
  if (f.key === "name" && !validName(v)) return TEXT.validate.name;
  return "";
}

// --- Cấu hình dùng chung cho Hoạt ảnh Modal ---
window.ModalConfig = {
  exitDuration: 300, // Thời gian chạy animation tối đa (ms)
  exitClass: "closing" // Tên CSS class khi đóng modal
};

// --- Hàm dùng chung đóng modal với hiệu ứng chuyển cảnh mượt mà ---
window.dismissModal = function (modalBgEl, callback) {
  if (!modalBgEl) {
    if (callback) callback();
    return;
  }

  // Nếu đang đóng thì bỏ qua để tránh bấm đúp sinh lỗi
  if (modalBgEl.classList.contains(window.ModalConfig.exitClass)) return;

  modalBgEl.classList.add(window.ModalConfig.exitClass);

  const onEnd = (e) => {
    // Chỉ phản hồi sự kiện kết thúc chuyển động của chính lớp phủ nền (modalBgEl)
    if (e.target === modalBgEl) {
      modalBgEl.removeEventListener("animationend", onEnd);
      modalBgEl.removeEventListener("transitionend", onEnd);
      modalBgEl.remove();
      if (callback) callback();
    }
  };

  modalBgEl.addEventListener("animationend", onEnd);
  modalBgEl.addEventListener("transitionend", onEnd);

  // Cơ chế dự phòng (fallback) nếu trình duyệt tắt hoạt ảnh hoặc lỗi sự kiện
  setTimeout(() => {
    if (document.body.contains(modalBgEl)) {
      modalBgEl.remove();
      if (callback) callback();
    }
  }, window.ModalConfig.exitDuration + 50);
};
