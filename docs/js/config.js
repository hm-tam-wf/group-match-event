// ➍ URL web app Apps Script (chế độ "sheet"). Web tĩnh không có Apps Script nên để RỖNG;
//    app tự rơi vào chế độ firebase (có FIREBASE_CONFIG) hoặc demo. Điền lại nếu muốn dùng sheet.
const SCRIPT_URL = "";

// ➊ Các trường người chơi nhập.
const FIELDS = [
  { key:"name",       label:"Họ và tên",        type:"text", required:true, placeholder:"Nguyễn Văn A" },
  { key:"employeeId", label:"Mã số nhân viên",  type:"text", required:true, placeholder:"VD: NV001234" },
];

// ➊b Chống trùng theo MỘT field (phải là key trong FIELDS). "" = không chống trùng.
//     Công tắc bật/tắt nằm ở BLOCK_DUP trong firebase-config.js.
const DEDUP_FIELD = "employeeId";

// ➊c Nhãn sự kiện — mọi dữ liệu (Firestore + cục bộ) nằm trong không gian riêng theo nhãn này.
//     Sự kiện mới: đổi sang nhãn khác (chỉ chữ thường, số, gạch ngang). Dữ liệu sự kiện cũ vẫn còn.
const EVENT_ID = "su-kien-2026-q2";

// ➋ Sĩ số tối đa mỗi đội. Phải khớp CAPACITY ở Config.gs (backend).
const CAPACITY = 10;

// ➌ Danh sách biểu tượng. Mỗi cái = 1 ĐỘI (tối đa CAPACITY người).
const ICONS = [
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

const POLL_MS = 3000; // chu kỳ đồng bộ (ms)
