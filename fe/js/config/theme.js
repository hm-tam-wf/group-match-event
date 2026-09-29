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
//   • Biến thể sự kiện (tuỳ chọn): đặt DEFAULT_VARIANT = 'tên' để kế thừa theme
//     nền và chỉ override phần riêng của dịp đó (xem §BIẾN THỂ trong themes/<tên>/<tên>.css;
//     biến thể lớn gói riêng trong themes/<tên>/variants/<biến-thể>/).
//   • Xem trước biến thể KHÔNG cần deploy cờ: thêm ?variant=<tên> vào URL (?variant= rỗng = ép tắt).
// ============================================================================
let activeTheme = 'tech';
try {
  activeTheme = localStorage.getItem('theme') || 'tech';
} catch (e) {}
const ACTIVE_THEME    = activeTheme;    // 'default' | 'tech'
const DEFAULT_VARIANT = 'tnt';          // CỜ GO-LIVE: '' = không dùng biến thể; vd 'tnt'

let activeVariant = DEFAULT_VARIANT;
try {
  const variantParam = new URLSearchParams(location.search).get('variant');
  if (variantParam !== null && /^[a-z0-9-]{0,32}$/.test(variantParam)) activeVariant = variantParam;
} catch (e) {}
const ACTIVE_VARIANT = activeVariant;   // biến thể đang áp — mọi file khác đọc tên này

document.documentElement.setAttribute('data-theme', ACTIVE_THEME);
if (ACTIVE_VARIANT) document.documentElement.setAttribute('data-variant', ACTIVE_VARIANT);
