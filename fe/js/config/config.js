// ➍ URL web app Apps Script (chế độ "sheet"). Web tĩnh không có Apps Script nên để RỖNG;
//    app tự rơi vào chế độ firebase (có FIREBASE_CONFIG) hoặc demo. Điền lại nếu muốn dùng sheet.
const DEFAULT_SCRIPT_URL = "";

// ➊ Các trường người chơi nhập.
const DEFAULT_FIELDS = [
  { key:"name",       label:"Họ và tên",        type:"text", required:true, placeholder:"Nguyễn Văn A" },
  { key:"employeeId", label:"Mã số nhân viên",  type:"text", required:true, placeholder:"VD: NV001234" },
];

// ➊b Chống trùng theo MỘT field (phải là key trong FIELDS). "" = không chống trùng.
//     Công tắc bật/tắt nằm ở BLOCK_DUP trong firebase-config.js.
const DEFAULT_DEDUP_FIELD = "employeeId";

// ➊c Nhãn sự kiện — mọi dữ liệu (Firestore + cục bộ) nằm trong không gian riêng theo nhãn này.
//     Ở chế độ firebase: giá trị thực được đọc từ config/active trên Firestore khi khởi động.
//     Giá trị dưới đây là DỰ PHÒNG cho chế độ demo/sheet hoặc khi Firestore lỗi.
const DEFAULT_EVENT_ID = "su-kien-2026-q2";

// ➋ Sĩ số tối đa mỗi đội. Ở chế độ firebase: đọc từ events/{id}/meta/config trên Firestore.
const DEFAULT_CAPACITY = 10;

// ➌ Danh sách biểu tượng. Ở chế độ firebase: đọc từ events/{id}/meta/config trên Firestore.
const DEFAULT_ICONS = [
  { icon:"🦊", name:"Cáo",       color:"#ff7a45" },
  { icon:"🐉", name:"Rồng",      color:"#ff3b5c" },
  { icon:"🦅", name:"Đại Bàng",  color:"#ffb13d" },
  { icon:"🦁", name:"Sư Tử",     color:"#ffe14d" },
  { icon:"🐢", name:"Rùa",       color:"#4dd47a" },
  { icon:"🦈", name:"Cá Mập",    color:"#2fd4c4" },
  { icon:"🐬", name:"Cá Heo",    color:"#38bdf8" },
  { icon:"🐺", name:"Sói",       color:"#7a8cff" },
  { icon:"🐙", name:"Bạch Tuộc", color:"#b06cff" },
  { icon:"🦄", name:"Kỳ Lân",    color:"#ff6cce" },
];

const POLL_MS = 3000; // chu kỳ đồng bộ (ms) — chỉ dùng ở chế độ sheet/demo

// ➎ Giao diện (theme): chuyển sang js/config/theme.js — nạp ở <head> TRƯỚC khi vẽ
//    để áp data-theme không nháy (FOUC). Đổi giao diện = sửa ACTIVE_THEME ở file đó.

// ── Biến làm việc — được gán lại bởi boot() sau khi tải config từ Firestore ──
// Ở chế độ demo/sheet: giữ nguyên giá trị DEFAULT_* bên trên.
let SCRIPT_URL  = DEFAULT_SCRIPT_URL;
let FIELDS      = DEFAULT_FIELDS;
let DEDUP_FIELD = DEFAULT_DEDUP_FIELD;
let EVENT_ID    = DEFAULT_EVENT_ID;
let CAPACITY    = DEFAULT_CAPACITY;
let ICONS       = DEFAULT_ICONS;
let CAPS        = {};  // sĩ số RIÊNG theo từng đội (emoji → số). Trống/không có ⇒ đội đó dùng CAPACITY chung.
                       // boot() gán từ events/{id}/meta/config.caps. Enforce CỨNG ở firestore.rules (capFor(icon)).
let DATA_EPOCH  = 0;   // "thế hệ" dữ liệu sự kiện — admin "Xóa dữ liệu" tăng số này (events/{id}/meta/config.dataEpoch)
                       // để máy người chơi biết khóa chống trùng trên server đã bị xóa → tự nhả localStorage cũ.

// Sĩ số của MỘT đội: ưu tiên cap riêng (CAPS[icon]) nếu hợp lệ, nếu không thì dùng CAPACITY chung.
// Dùng ở api.js (chốt full), ui-render.js (hiển thị/khoá), app.js (confirm/toast). Định nghĩa ở config.js
// vì nạp ĐẦU chuỗi → mọi file sau đều gọi được (xem [[ui-pipeline]] thứ tự nạp).
function capOf(icon) { const c = CAPS && CAPS[icon]; return (typeof c === "number" && c > 0) ? c : CAPACITY; }

// ── ➏ Văn bản giao diện (i18n) — registry SONG NGỮ + cờ LANG ──────────────────
// Gom MỌI chuỗi UI tầng HARDCODE về một nguồn sự thật. Đổi ngôn ngữ = đổi LANG
// (cùng triết lý ACTIVE_THEME ở theme.js). KHÔNG chứa text tầng config per-event
// (tên icon, nhãn field, title/subtitle) — những thứ đó do admin/Firestore quản lý.
// Chuỗi có biến nội suy = HÀM (đối số rõ ràng); chuỗi tĩnh = string.

// Danh từ ĐƠN VỊ (đội/nhóm) — đổi Team/Squad/Group/… tại ĐÚNG MỘT nơi này, mỗi ngôn ngữ.
// Lưu dạng thường; _cap() viết hoa khi đứng đầu câu, làm nhãn, hoặc ghép với tên riêng.
const UNIT = {
  en: { one: "squad", many: "squads" },
  vi: { one: "đội",   many: "đội"    },
};
const _cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const UE = UNIT.en, UV = UNIT.vi;   // alias gọn cho registry bên dưới

const STRINGS = {
  en: {
    boot: {
      loading:   "Loading event…",
      noEvent:   "<b>No event is open right now.</b><br>Please check back later.",
      errNoName: 'This event is missing the name field (key "name") in its configuration. Please contact the organizer to update it.',
      errDedupField: "This event has duplicate-blocking turned on, but its duplicate field (dedupField) doesn't match any input field. Please contact the organizer to fix the configuration.",
      errLoad:   "Failed to load event configuration. Please try again.",
    },
    profile: {
      greeting:     `Welcome to Your ${_cap(UE.one)} Selection`,
      subtitle:     `Please enter your registered information to select a ${UE.one}.`,
      back:         "Back",
      start:        `It's Time to Choose Your ${_cap(UE.one)}!`,
      checking:     "Checking…",
      saved:        `Your info is saved. Now pick a ${UE.one} to join 👇`,
      nameMismatch: "Your name doesn't match the allowed list — please check again.",
    },
    dup: {
      title: "This code is already registered",
      body:  (label) => `The <b>${label}</b> you entered has already been used to join a ${UE.one} (including on other devices).<br>
         Each code can join <b>only once</b>.`,
      btn:   "Enter a different code",
    },
    allow: {
      title: "You're not on the list",
      body:  (label) => `The <b>${label}</b> you entered is not on the allowed list for this event.<br>
         Please double-check or contact the organizer.`,
      btn:   "Enter a different code",
    },
    celebrate: {
      title: `${_cap(UE.one)} Joined Successfully!`,
      body:  (name) => `You are now a member of <b>${name}</b>. Get ready and connect with your teammates to prepare for the challenges ahead!`,
      ok:    "Get Ready for Company Trip 2026!",
    },
    banner: {
      title: (name) => `You're on ${name}`,   // chỉ dùng tên đội (icon đã hiện ở .bi) — tránh "Squad 1 1"
      sub:   "",  // EN: tắt sub banner cho Company Trip 2026 (bật lại: thay "" bằng dòng dưới)
      // sub:   `Your info has been recorded. Each person can join only one ${UE.one}.`,
    },
    grid: {
      headOpen:     `${_cap(UE.many)} with Open Spots`,
      headFull:     `${_cap(UE.one)} completed Successfully`,
      count:        (shown, total) => `${shown}/${total} ${UE.many}`,
      hint:         `→ Enter your info to unlock joining a ${UE.one}.`,
      tileFill:     "Enter your info",
      tileMine:     `Your ${UE.one}`,
      tileOther:    `Already on a ${UE.one}`,
      tileJoin:     "Join",
      allFullTitle: `All ${UE.many} are full! 🎉`,
      allFullSub:   (total) => `All ${total} ${UE.many} are now full. Thanks everyone for joining — see you at the next event!`,
      ftLabel:      _cap(UE.one),
      ftForming:    "In progress",
      ftLocked:     "Locked",       // đội đủ người → danh sách đã chốt, không nhận thêm
      ftYou:        " · you",
      takenEmpty:   (capacity) => `No ${UE.one} has reached ${capacity} members yet. Invite more friends to join!`,
      player:       "Player",
    },
    confirm: {
      title: (name) => `Join ${name}?`,   // KHÔNG ghép đơn vị: tên đội (admin điền) là nhãn đầy đủ
      body:  (capacity) => `Each person can join only one ${UE.one} (up to ${capacity} per ${UE.one}). Confirming will record your information.`,
      back:  "Back",
      ok:    "Confirm",
    },
    toast: {
      processing:     "Processing your join…",
      saving:         "Saving…",
      full:           (name, capacity) => `${name} just filled up with ${capacity} members!`,
      already:        `You've already joined a ${UE.one}.`,
      dup:            (label) => `This ${label} is already registered (including on other devices). Each code can join only once.`,
      dupConfig:      "This event's duplicate check is misconfigured (identifier field not found). Please contact the organizer.",
      notAllowed:     "You're not on the allowed list for this event. Please contact the organizer.",
      nameMismatch:   "Your name doesn't match the allowed list. Please enter the exact name you registered with.",
      missing:        "Missing required info (display name) — check your details, or tell the organizer if the event has no name field.",
      network:        "The network's a bit busy — couldn't join. Please try again.",
      checkingResult: "Checking the result…",
    },
    validate: {
      required:   "Required",
      employeeId: "Invalid employee code (letters and numbers only, 3–20 characters)",
      name:       "Invalid name (enter your real name, at least 2 characters)",
    },
  },
  vi: {
    boot: {
      loading:   "Đang tải sự kiện…",
      noEvent:   "<b>Hiện chưa có sự kiện nào đang mở.</b><br>Vui lòng quay lại sau.",
      errNoName: 'Sự kiện này thiếu trường tên (key "name") trong cấu hình. Vui lòng liên hệ ban tổ chức để cập nhật.',
      errDedupField: "Sự kiện bật chống trùng nhưng field chống trùng (dedupField) không khớp ô nhập nào. Vui lòng liên hệ ban tổ chức để cập nhật cấu hình.",
      errLoad:   "Lỗi tải cấu hình sự kiện. Vui lòng thử lại.",
    },
    profile: {
      greeting:     "Chào bạn!",
      subtitle:     `Điền một chút thông tin để bắt đầu tham gia ${UV.one} của bạn nhé.`,
      back:         "Quay lại",
      start:        `Bắt đầu tham gia ${UV.one} →`,
      checking:     "Đang kiểm tra…",
      saved:        `Đã lưu thông tin. Giờ hãy chọn 1 ${UV.one} để tham gia 👇`,
      nameMismatch: "Họ tên không khớp với danh sách được phép — kiểm tra lại.",
    },
    dup: {
      title: "Mã này đã đăng ký rồi",
      body:  (label) => `<b>${label}</b> bạn nhập đã được dùng để tham gia một ${UV.one} (kể cả trên thiết bị khác).<br>
         Mỗi mã chỉ tham gia <b>một lần</b>.`,
      btn:   "Nhập mã khác",
    },
    allow: {
      title: "Bạn chưa có trong danh sách",
      body:  (label) => `<b>${label}</b> bạn nhập không nằm trong danh sách được phép tham gia sự kiện này.<br>
         Vui lòng kiểm tra lại hoặc liên hệ ban tổ chức.`,
      btn:   "Nhập mã khác",
    },
    celebrate: {
      title: `Tham gia ${UV.one} thành công!`,
      body:  (name) => `Bạn đã là thành viên của <b>${name}</b>. Hãy sẵn sàng và kết nối với đồng đội để chuẩn bị cho những thử thách phía trước!`,
      ok:    "Sẵn sàng cho Company Trip 2026!",
    },
    banner: {
      title: (name) => `Bạn đang ở ${name}`,   // chỉ dùng tên đội (icon đã hiện ở .bi) — tránh "Squad 1 1"
      sub:   `Đã ghi nhận thông tin của bạn. Mỗi người chỉ tham gia 1 ${UV.one}.`,
    },
    grid: {
      headOpen:     `${_cap(UV.one)} còn chỗ`,
      headFull:     `${_cap(UV.one)} đã đủ`,
      count:        (shown, total) => `${shown}/${total} ${UV.many}`,
      hint:         `→ Điền thông tin để mở khoá việc tham gia ${UV.one}.`,
      tileFill:     "Điền thông tin",
      tileMine:     `${_cap(UV.one)} của bạn`,
      tileOther:    `Đã có ${UV.one}`,
      tileJoin:     "Tham gia",
      allFullTitle: `Tất cả các ${UV.many} đã đủ người! 🎉`,
      allFullSub:   (total) => `Cả ${total} ${UV.many} đều đã kín chỗ. Cảm ơn cả nhà đã tham gia — hẹn gặp ở sự kiện sau nhé!`,
      ftLabel:      _cap(UV.one),
      ftForming:    "Đang ghép",
      ftLocked:     "Đã chốt",      // đội đủ người → danh sách đã chốt, không nhận thêm
      ftYou:        " · bạn",
      takenEmpty:   (capacity) => `Chưa có ${UV.one} nào đủ ${capacity} người. Cùng rủ thêm bạn nào!`,
      player:       "Người chơi",
    },
    confirm: {
      title: (name) => `Tham gia ${name}?`,   // KHÔNG ghép đơn vị: tên đội (admin điền) là nhãn đầy đủ
      body:  (capacity) => `Mỗi người chỉ tham gia 1 ${UV.one} (tối đa ${capacity} người/${UV.one}). Xác nhận xong sẽ ghi nhận thông tin của bạn.`,
      back:  "Quay lại",
      ok:    "Xác nhận",
    },
    toast: {
      processing:     "Đang xử lý lượt tham gia của bạn…",
      saving:         "Đang ghi nhận…",
      full:           (name, capacity) => `${name} vừa đủ ${capacity} người rồi!`,
      already:        `Bạn đã tham gia một ${UV.one} rồi.`,
      dup:            (label) => `${label} này đã được đăng ký rồi (kể cả trên thiết bị khác). Mỗi mã chỉ tham gia một lần.`,
      dupConfig:      "Cấu hình chống trùng của sự kiện chưa đúng (không tìm thấy field định danh). Vui lòng liên hệ ban tổ chức.",
      notAllowed:     "Bạn không có trong danh sách được phép tham gia sự kiện này. Vui lòng liên hệ ban tổ chức.",
      nameMismatch:   "Họ tên không khớp với danh sách được phép. Vui lòng nhập đúng họ tên đã đăng ký.",
      missing:        "Thiếu thông tin bắt buộc (tên hiển thị) — kiểm tra lại thông tin của bạn, hoặc báo ban tổ chức nếu sự kiện thiếu trường tên.",
      network:        "Mạng hơi đông, chưa tham gia được. Bạn thử lại nhé.",
      checkingResult: "Đang kiểm tra kết quả…",
    },
    validate: {
      required:   "Bắt buộc nhập",
      employeeId: "Mã số nhân viên không hợp lệ (chỉ chữ và số, 3–20 ký tự)",
      name:       "Họ tên chưa hợp lệ (nhập đúng họ tên, tối thiểu 2 ký tự)",
    },
  },
};

// Ngôn ngữ giao diện hiện hành: "en" | "vi". Đổi mặc định tại đây (giống ACTIVE_THEME).
// Cho phép ?lang=en / ?lang=vi trên URL để test nhanh mà không cần sửa file.
let LANG = "en";
try {
  const langParam = new URLSearchParams(location.search).get("lang");
  if (langParam === "en" || langParam === "vi") LANG = langParam;
} catch (e) {}
const TEXT = STRINGS[LANG] || STRINGS.en;   // bảng chuỗi theo ngôn ngữ đang chọn (fallback EN)
try { document.documentElement.lang = LANG; } catch (e) {}   // đồng bộ <html lang> với ngôn ngữ UI (a11y/SEO)
