// Cấu hình dự án Firebase. SDK (compat) được nạp qua CDN trong index.html nên KHÔNG cần bước build/bundle.
// ⚠️ DÁN CẤU HÌNH FIREBASE CỦA BẠN VÀO ĐÂY
//    Firebase Console → ⚙ Project settings → mục "Your apps" → Web app → "SDK setup and configuration".
//    Để trống projectId thì app tự chạy ở chế độ sheet/demo (không dùng Firebase).
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCddSYLOIQsYgp1bVrpWpdMHegRmZD3FEE",
  authDomain: "icon-picker.firebaseapp.com",
  projectId: "icon-picker",
  storageBucket: "icon-picker.firebasestorage.app",
  messagingSenderId: "587236027049",
  appId: "1:587236027049:web:d812f9abff01f0f20f97b8",
  measurementId: "G-M5SRNR2P36"
};

// Có bật chống trùng người đăng ký không (tiêu chí lấy theo DEDUP_FIELD trong config.js).
// Ở chế độ firebase: được gán lại bởi boot() từ events/{id}/meta/config.
let BLOCK_DUP = true;

// Chế độ "danh sách cho phép": true ⇒ chỉ định danh (theo DEDUP_FIELD) nằm trong collection
// allowlist mới claim được; false/thiếu ⇒ mở cho mọi người (tương thích ngược sự kiện cũ).
// Ở chế độ firebase: được gán lại bởi boot() từ events/{id}/meta/config.allowlistMode.
let ALLOWLIST_MODE = false;

const FIREBASE_ON = !!(FIREBASE_CONFIG.projectId && window.firebase);
let db = null;
if (FIREBASE_ON) {
  firebase.initializeApp(FIREBASE_CONFIG);
  db = firebase.firestore();
}
