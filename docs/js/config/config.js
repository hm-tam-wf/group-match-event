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

// ── Biến làm việc — được gán lại bởi boot() sau khi tải config từ Firestore ──
// Ở chế độ demo/sheet: giữ nguyên giá trị DEFAULT_* bên trên.
let SCRIPT_URL  = DEFAULT_SCRIPT_URL;
let FIELDS      = DEFAULT_FIELDS;
let DEDUP_FIELD = DEFAULT_DEDUP_FIELD;
let EVENT_ID    = DEFAULT_EVENT_ID;
let CAPACITY    = DEFAULT_CAPACITY;
let ICONS       = DEFAULT_ICONS;
