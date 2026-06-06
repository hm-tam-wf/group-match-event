// ============================================================================
// theme.js — Giao diện (theme) + biến thể: NGUỒN SỰ THẬT DUY NHẤT cho cả site.
// ----------------------------------------------------------------------------
// Nạp trong <head> trên MỌI trang (index.html + admin.html) để áp data-theme
// TRƯỚC khi trình duyệt vẽ → không nháy giao diện (FOUC). File này độc lập:
// chỉ set thuộc tính trên <html>, không phụ thuộc/không bị script khác phụ thuộc,
// nên đặt ngoài chuỗi nạp "thiêng" config→firebase→storage→api→ui→app.
//
//   • Đổi giao diện cả site = đổi ĐÚNG chuỗi ACTIVE_THEME bên dưới.
//   • Thêm theme mới: tạo thư mục fe/themes/<tên>/ + <tên>.css (recipe ở assets/themes.css).
//   • Biến thể sự kiện (tuỳ chọn): đặt ACTIVE_VARIANT = 'tên' để kế thừa theme
//     nền và chỉ override ảnh nền + vài màu nhấn (xem §BIẾN THỂ trong themes/<tên>/<tên>.css).
// ============================================================================
let activeTheme = 'tech';
try {
  activeTheme = localStorage.getItem('theme') || 'tech';
} catch (e) {}
const ACTIVE_THEME   = activeTheme;    // 'default' | 'tech'
const ACTIVE_VARIANT = '';        // '' = không dùng biến thể; vd 'eventX'

document.documentElement.setAttribute('data-theme', ACTIVE_THEME);
if (ACTIVE_VARIANT) document.documentElement.setAttribute('data-variant', ACTIVE_VARIANT);
